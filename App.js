// App.js - VetLab Pro: Comprehensive Veterinary Student Application
// Dependencies required: @react-native-async-storage/async-storage, expo-clipboard, @expo/vector-icons, @react-native-picker/picker, react-native-svg, victory-native

import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Switch,
  Alert,
  FlatList,
  Platform,
  KeyboardAvoidingView,
  useColorScheme, // Use native hook for initial dark mode
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { VictoryChart, VictoryLine, VictoryScatter, VictoryAxis } from "victory-native";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";

/* -------------------- Configuration & Storage Keys -------------------- */
const HISTORY_KEY = "@vetlab_history_v3";
const ANIMALS_KEY = "@vetlab_animals_v1";
const MAX_HISTORY_ITEMS = 300;

/* -------------------- Unit Definitions (Comprehensive System) -------------------- */
const UNITS_MAP = {
  // Base unit: g
  MASS: {
    kg: 1000,
    g: 1,
    mg: 1e-3,
    ug: 1e-6,
  },
  // Base unit: L
  VOLUME: {
    L: 1,
    mL: 1e-3,
    uL: 1e-6,
  },
  // Base unit: M
  MOLARITY: {
    M: 1,
    mM: 1e-3,
    uM: 1e-6,
  },
  // Base unit: °C (Celsius - non-linear)
  TEMP: {
    C: 1,
    F: (c) => ((c * 9) / 5 + 32),
    K: (c) => (c + 273.15),
  },
  // Base unit: mg/mL (Dose Concentration)
  CONC_DOSE: {
"mg/mL": 1,
"g/L": 1,
"mcg/mL": 1e-3,
"% w/v": 10, // 1% w/v = 1g/100mL = 10mg/mL
  }
};

/* -------------------- Core Helpers (Safety and Accuracy) -------------------- */

// Filters input to allow only numbers and a single decimal point
const filterNumeric = (text) => {
  return String(text).replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
};

// Safely parses string input to number, returns 0 if invalid
const safeParse = (s) => {
  const n = Number(String(s).replace(',', '.')); // Handle common comma decimal
  return Number.isFinite(n) && n !== null ? n : 0;
};

// Formats a number to a fixed decimal place, using scientific notation for tiny numbers
const fmt = (v, d = 4) => {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "—";
  const num = Number(v);
  if (Math.abs(num) < 1e-4 && num !== 0) {
    return num.toExponential(d);
  }
  return Number(num.toFixed(d));
};

// Universal unit converter
const convertUnit = (value, fromUnit, toUnit, unitType) => {
  const map = UNITS_MAP[unitType];
  if (!map) return value;

  if (unitType === 'TEMP') {
    let baseC = value;
    if (fromUnit === 'F') { baseC = (value - 32) * 5 / 9; }
    else if (fromUnit === 'K') { baseC = value - 273.15; }

    if (toUnit === 'C') return baseC;
    if (toUnit === 'F') return map.F(baseC);
    if (toUnit === 'K') return map.K(baseC);
    return baseC;
  }

  // Linear conversions
  const baseValue = value * map[fromUnit];
  return baseValue / map[toUnit];
};

/* -------------------- Storage and History Management -------------------- */

const saveHistory = async (item, setHistory) => {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    const newItem = { ...item, time: new Date().toISOString() };
    arr.unshift(newItem);
    if (arr.length > MAX_HISTORY_ITEMS) arr.length = MAX_HISTORY_ITEMS;
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(arr));
    setHistory(arr);
  } catch (e) {
    console.error("Failed to save history:", e);
  }
};

const loadHistory = async (setHistory) => {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    setHistory(raw ? JSON.parse(raw) : []);
  } catch (e) {
    console.error("Failed to load history:", e);
  }
};

const clearAllHistory = async (setHistory) => {
  Alert.alert(
"Clear History",
"Are you sure you want to delete all calculation history? This action is irreversible.",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear All",
        style: "destructive",
        onPress: async () => {
          try {
            await AsyncStorage.removeItem(HISTORY_KEY);
            setHistory([]);
            Alert.alert("Success", "Calculation history successfully cleared.");
          } catch (e) {
            console.error("Failed to clear history:", e);
            Alert.alert("Error", "Failed to clear history.");
          }
        },
      },
    ]
  );
};

// CSV Export (Required Feature)
const exportHistoryCSV = async (history) => {
  if (history.length === 0) {
    Alert.alert("Empty History", "No history items to export.");
    return;
  }

  // Define CSV columns and header
  const header = "Type,Time,Input Values,Result Values,Summary\n";
  const csvRows = history.map(item => {
    // Flatten complex objects for CSV readability
    const inputs = JSON.stringify(item.inputs).replace(/"/g, "'");
    const results = JSON.stringify(item.result).replace(/"/g, "'");
    const summary = item.sentence || "N/A";

    return `${item.type},${item.time},"${inputs}","${results}","${summary}"`;
  });

  const csvString = header + csvRows.join('\n');

  try {
    await Clipboard.setStringAsync(csvString);
    Alert.alert("CSV Copied!", `${history.length} records copied to clipboard. You can now paste this data into a spreadsheet app.`);
  } catch (e) {
    Alert.alert("Error", "Failed to copy data to clipboard.");
  }
};

/* -------------------- Theming and Global Styles -------------------- */

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  darkContainer: { flex: 1, backgroundColor: "#0b1521" },
  header: { padding: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1 },
  lightHeader: { backgroundColor: '#f9f9f9', borderBottomColor: '#eee' },
  darkHeader: { backgroundColor: '#14253a', borderBottomColor: '#1e354d' },
  headerTitle: { fontSize: 20, fontWeight: "bold" },
  lightHeaderTitle: { color: "#333" },
  darkHeaderTitle: { color: "#d8e8ff" },
  card: { padding: 16, borderRadius: 16, marginVertical: 8, marginHorizontal: 0 },
  lightCard: { backgroundColor: "#fff", elevation: 4, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  darkCard: { backgroundColor: "#14253a", borderWidth: 1, borderColor: "#1e354d" },
  title: { fontSize: 18, fontWeight: "800", marginBottom: 6 },
  lightTitle: { color: "#333" },
  darkTitle: { color: "#d8e8ff" },
  label: { fontWeight: "700", marginTop: 12, fontSize: 13 },
  lightLabel: { color: "#444" },
  darkLabel: { color: "#bcd4ff" },
  input: { borderWidth: 1, padding: 12, borderRadius: 10, marginTop: 6, fontSize: 16 },
  lightInput: { borderColor: "#ccc", backgroundColor: "#f9f9f9", color: "#333" },
  darkInput: { borderColor: "#1e354d", backgroundColor: "#0b1521", color: "#fff" },
  btn: { backgroundColor: "#2d7fe8", padding: 14, borderRadius: 12, marginTop: 20, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  result: { marginTop: 10, fontWeight: "700", fontSize: 15 },
  lightResult: { color: "#000" },
  darkResult: { color: "#d8e8ff" },
  sep: { height: 1, marginVertical: 15 },
  lightSep: { backgroundColor: "#eee" },
  darkSep: { backgroundColor: "#1e354d" },
});

const getStyles = (isDark) => ({
  isDark,
  container: isDark ? baseStyles.darkContainer : baseStyles.container,
  header: { ...baseStyles.header, ...(isDark ? baseStyles.darkHeader : baseStyles.lightHeader) },
  headerTitle: { ...baseStyles.headerTitle, ...(isDark ? baseStyles.darkHeaderTitle : baseStyles.lightHeaderTitle) },
  card: { ...baseStyles.card, ...(isDark ? baseStyles.darkCard : baseStyles.lightCard) },
  title: { ...baseStyles.title, ...(isDark ? baseStyles.darkTitle : baseStyles.lightTitle) },
  label: { ...baseStyles.label, ...(isDark ? baseStyles.darkLabel : baseStyles.lightLabel) },
  input: { ...baseStyles.input, ...(isDark ? baseStyles.darkInput : baseStyles.lightInput) },
  btn: baseStyles.btn,
  btnText: baseStyles.btnText,
  result: { ...baseStyles.result, ...(isDark ? baseStyles.darkResult : baseStyles.lightResult) },
  sep: { ...baseStyles.sep, ...(isDark ? baseStyles.darkSep : baseStyles.lightSep) },
  pickerStyle: { 
    height: 50, 
    color: isDark ? '#fff' : '#333', 
    backgroundColor: isDark ? '#1e354d' : '#f0f0f0', 
    borderRadius: 10, 
    overflow: 'hidden', 
  },
  pickerItemStyle: { color: isDark ? '#fff' : '#333' },
  navCard: { 
    ...baseStyles.card, 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 18, 
    marginBottom: 10,
    backgroundColor: isDark ? '#1e354d' : '#fff',
  },
  navIconContainer: { marginRight: 15, padding: 12, borderRadius: 10, backgroundColor: isDark ? '#0b1521' : '#eaf2ff' },
  navTitle: { ...baseStyles.title, fontSize: 16, marginBottom: 0 },
  navDesc: { color: isDark ? '#a0b0c0' : '#666', fontSize: 12, marginTop: 2 },
  historyItem: { ...baseStyles.card, backgroundColor: isDark ? '#1e354d' : '#fff' },
  historyType: { ...baseStyles.title, fontSize: 16, color: '#2d7fe8' },
  historyInputs: { color: isDark ? '#bcd4ff' : '#444', fontSize: 13 },
  historyResult: { ...baseStyles.result, fontSize: 14, marginTop: 4, color: isDark ? '#4ade80' : '#10b981' },
  historyDate: { color: isDark ? '#6a788e' : '#aaa', fontSize: 10, alignSelf: 'flex-end', marginTop: 5 },
});

/* -------------------- Reusable Components -------------------- */

// Universal Screen Wrapper for form entry (Handles Keyboard and Scroll)
const FormScreenWrapper = ({ children, title, styles }) => {
  return (
<KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: styles.container.backgroundColor }}
      keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
>
<ScrollView contentContainerStyle={{ padding: 16 }}>
<View style={styles.card}>
<Text style={styles.title}>{title}</Text>
          {children}
</View>
</ScrollView>
</KeyboardAvoidingView>
  );
};

const NavCard = ({ icon, name, desc, onPress, styles, iconColor = "#2d7fe8" }) => (
<TouchableOpacity onPress={onPress} style={styles.navCard}>
<View style={styles.navIconContainer}>
<Ionicons name={icon} size={24} color={iconColor} />
</View>
<View style={{ flex: 1 }}>
<Text style={styles.navTitle}>{name}</Text>
<Text style={styles.navDesc}>{desc}</Text>
</View>
</TouchableOpacity>
);

const UnitPicker = ({ styles, unitType, selectedValue, onValueChange }) => {
  const units = Object.keys(UNITS_MAP[unitType] || {});
  return (
<View style={{ width: '30%', marginLeft: 10 }}>
<Picker
        style={styles.pickerStyle}
        selectedValue={selectedValue}
        onValueChange={onValueChange}
        dropdownIconColor={styles.isDark ? '#fff' : '#333'}
        itemStyle={styles.pickerItemStyle}
>
        {units.map(u =><Picker.Item key={u} label={u} value={u} />)}
</Picker>
</View>
  );
};


/* -------------------- 1. Animal Management Screen -------------------- */

const AnimalManagementScreen = ({ styles, setAnimals, animals }) => {
    const [name, setName] = useState("");
    const [type, setType] = useState("Dog");
    const [weight, setWeight] = useState("");
    const [condition, setCondition] = useState("");
    const [editingId, setEditingId] = useState(null);

    const animalTypes = useMemo(() => ["Dog", "Cat", "Horse", "Cattle", "Other"], []);

    useEffect(() => {
        if (editingId !== null) {
            const animal = animals.find(a => a.id === editingId);
            if (animal) {
                setName(animal.name);
                setType(animal.type);
                setWeight(String(animal.weight));
                setCondition(animal.condition);
            }
        }
    }, [editingId, animals]);

    const saveAnimal = async () => {
        const W = safeParse(weight);
        if (!name || W <= 0) {
            Alert.alert("Input Error", "Please enter a valid name and weight.");
            return;
        }

        const newAnimal = {
            id: editingId || Date.now().toString(),
            name,
            type,
            weight: W,
            condition,
            updatedAt: new Date().toISOString(),
        };

        const newAnimals = editingId 
            ? animals.map(a => a.id === editingId ? newAnimal : a)
            : [...animals, newAnimal];

        try {
            await AsyncStorage.setItem(ANIMALS_KEY, JSON.stringify(newAnimals));
            setAnimals(newAnimals);
            Alert.alert("Success", `Animal ${editingId ? 'updated' : 'added'} successfully!`);
            setName("");
            setWeight("");
            setCondition("");
            setEditingId(null);
        } catch (e) {
            console.error("Failed to save animal:", e);
        }
    };

    const deleteAnimal = (id) => {
        Alert.alert("Delete Animal", "Are you sure you want to delete this animal's record?", [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: async () => {
                const newAnimals = animals.filter(a => a.id !== id);
                await AsyncStorage.setItem(ANIMALS_KEY, JSON.stringify(newAnimals));
                setAnimals(newAnimals);
                setEditingId(null);
            }}
        ]);
    };

    const renderAnimalItem = ({ item }) => (
<View style={{ ...styles.card, padding: 12, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
<View>
<Text style={styles.title}>{item.name} ({item.type})</Text>
<Text style={styles.label}>Weight: {fmt(item.weight)} kg</Text>
<Text style={{ ...styles.label, marginTop: 4 }}>Condition: {item.condition || 'Healthy'}</Text>
</View>
<View style={{ flexDirection: 'row' }}>
<TouchableOpacity onPress={() => setEditingId(item.id)} style={{ padding: 8, marginRight: 10, backgroundColor: '#f59e0b', borderRadius: 8 }}>
<MaterialIcons name="edit" size={20} color="#fff" />
</TouchableOpacity>
<TouchableOpacity onPress={() => deleteAnimal(item.id)} style={{ padding: 8, backgroundColor: '#ef4444', borderRadius: 8 }}>
<MaterialIcons name="delete" size={20} color="#fff" />
</TouchableOpacity>
</View>
</View>
    );

    return (
<FormScreenWrapper title="🐾 Animal Health Management" styles={styles}>
<Text style={styles.label}>Animal Name</Text>
<TextInput style={styles.input} onChangeText={setName} value={name} placeholder="e.g., Buddy" />

<Text style={styles.label}>Species</Text>
<View style={styles.pickerStyle}>
<Picker selectedValue={type} onValueChange={setType} itemStyle={styles.pickerItemStyle} dropdownIconColor={styles.isDark ? '#fff' : '#333'}>
                    {animalTypes.map(t =><Picker.Item key={t} label={t} value={t} />)}
</Picker>
</View>

<Text style={styles.label}>Weight (kg)</Text>
<TextInput style={styles.input} onChangeText={(t) => setWeight(filterNumeric(t))} value={weight} keyboardType="numeric" placeholder="e.g., 15.5" />

<Text style={styles.label}>Medical Condition</Text>
<TextInput style={styles.input} onChangeText={setCondition} value={condition} placeholder="e.g., Renal Failure, Post-Op" />

<TouchableOpacity style={styles.btn} onPress={saveAnimal}>
<Text style={styles.btnText}>{editingId ? "Update Animal Record" : "Add New Animal"}</Text>
</TouchableOpacity>

<View style={styles.sep} />
<Text style={styles.title}>Registered Animals ({animals.length})</Text>

<FlatList
                data={animals}
                renderItem={renderAnimalItem}
                keyExtractor={item => item.id}
                scrollEnabled={false}
                ListEmptyComponent={<Text style={{ ...styles.label, textAlign: 'center' }}>No animals tracked yet.</Text>}
            />
</FormScreenWrapper>
    );
};


/* -------------------- 2. Dose Calculation Screen -------------------- */

const DoseScreen = ({ styles, saveHistory, animals }) => {
    const [weight, setWeight] = useState("");
    const [dose, setDose] = useState("");
    const [doseUnit, setDoseUnit] = useState("mg/kg"); // Base unit for dose amount per kg
    const [conc, setConc] = useState(""); // Concentration of stock solution
    const [concUnit, setConcUnit] = useState("mg/mL");
    const [time, setTime] = useState(""); // Infusion time in minutes
    const [selectedAnimalId, setSelectedAnimalId] = useState("");

    const { totalDoseMg, volNeeded, mlHrRate, dropRate } = useMemo(() => {
        const W = safeParse(weight);
        const D = safeParse(dose);
        const C = safeParse(conc);
        const T = safeParse(time); // Time in minutes
        const DF = 20; // Standard drop factor

        if (W <= 0 || D <= 0 || C <= 0) return {};

        // 1. Convert Dose to mg/kg
        const D_mg_kg = convertUnit(D, doseUnit, 'mg/kg', 'MASS');

        // 2. Convert Concentration to mg/mL
        const C_mg_mL = convertUnit(C, concUnit, 'mg/mL', 'CONC_DOSE');

        // Total Dose (mg)
        const totalDoseMg = W * D_mg_kg;

        // Volume Needed (mL)
        const volNeeded = totalDoseMg / C_mg_mL;

        let mlHrRate = 0, dropRate = 0;
        if (volNeeded > 0 && T > 0) {
            mlHrRate = (volNeeded / T) * 60;
            dropRate = (volNeeded * DF) / T;
        }

        return { totalDoseMg, volNeeded, mlHrRate, dropRate };
    }, [weight, dose, doseUnit, conc, concUnit, time]);

    const handleAnimalSelect = (id) => {
        setSelectedAnimalId(id);
        const animal = animals.find(a => a.id === id);
        if (animal) {
            setWeight(String(animal.weight));
        }
    };

    const calculate = () => {
        if (totalDoseMg > 0) {
            const animalName = animals.find(a => a.id === selectedAnimalId)?.name || 'Unknown Animal';
            const inputs = { weight, dose, doseUnit, conc, concUnit, time, animalName };
            const result = { totalDoseMg, volNeeded, mlHrRate, dropRate };
            const sentence = `Dose for ${animalName} (${weight}kg): ${totalDoseMg} mg required, volume ${fmt(volNeeded)} mL from ${conc} ${concUnit} stock. Infusion rate: ${fmt(mlHrRate)} mL/hr.`;

            saveHistory({ type: "Dose Calculation", inputs, result, sentence }, saveHistory);
        }
    };

    return (
<FormScreenWrapper title="💊 Dose & Infusion Rate Calculator" styles={styles}>
<Text style={styles.label}>Select Animal (Optional)</Text>
<View style={styles.pickerStyle}>
<Picker selectedValue={selectedAnimalId} onValueChange={handleAnimalSelect} itemStyle={styles.pickerItemStyle} dropdownIconColor={styles.isDark ? '#fff' : '#333'}>
<Picker.Item label="— Select or Manually Enter Weight —" value="" />
                    {animals.map(a =><Picker.Item key={a.id} label={`${a.name} (${fmt(a.weight)} kg)`} value={a.id} />)}
</Picker>
</View>

<Text style={styles.label}>Patient Weight (kg)</Text>
<TextInput style={styles.input} onChangeText={(t) => setWeight(filterNumeric(t))} value={weight} keyboardType="numeric" placeholder="e.g., 15.5" />

<Text style={styles.label}>Dose per kg</Text>
<View style={{ flexDirection: 'row', alignItems: 'center' }}>
<TextInput style={[styles.input, { flex: 1 }]} onChangeText={(t) => setDose(filterNumeric(t))} value={dose} keyboardType="numeric" placeholder="Dose amount" />
<UnitPicker styles={styles} unitType="MASS" selectedValue={doseUnit} onValueChange={setDoseUnit} />
</View>

<Text style={styles.label}>Stock Concentration</Text>
<View style={{ flexDirection: 'row', alignItems: 'center' }}>
<TextInput style={[styles.input, { flex: 1 }]} onChangeText={(t) => setConc(filterNumeric(t))} value={conc} keyboardType="numeric" placeholder="Concentration value" />
<UnitPicker styles={styles} unitType="CONC_DOSE" selectedValue={concUnit} onValueChange={setConcUnit} />
</View>

<Text style={styles.label}>Infusion Time (minutes) (Optional for Rate)</Text>
<TextInput style={styles.input} onChangeText={(t) => setTime(filterNumeric(t))} value={time} keyboardType="numeric" placeholder="e.g., 30 minutes" />

<TouchableOpacity style={styles.btn} onPress={calculate}>
<Text style={styles.btnText}>Calculate Dose and Volume</Text>
</TouchableOpacity>

<View style={styles.sep} />
<Text style={styles.result}>Total Dose Required: <Text style={{ color: '#4ade80' }}>{fmt(totalDoseMg)} mg</Text></Text>
<Text style={styles.result}>Volume Needed from Stock: <Text style={{ color: '#4ade80' }}>{fmt(volNeeded)} mL</Text></Text>
            {safeParse(time) > 0 && (
<>
<Text style={styles.result}>Infusion Rate: <Text style={{ color: '#4ade80' }}>{fmt(mlHrRate)} mL/hr</Text></Text>
<Text style={styles.result}>Drop Rate (20 gtt/mL set): <Text style={{ color: '#4ade80' }}>{fmt(dropRate)} drops/min</Text></Text>
</>
            )}
</FormScreenWrapper>
    );
};


/* -------------------- 3. Solution Calculation Screen -------------------- */

const SolutionScreen = ({ styles, saveHistory }) => {
    const [mw, setMw] = useState("");
    const [conc, setConc] = useState("");
    const [volume, setVolume] = useState("");
    const [concUnit, setConcUnit] = useState("M");
    const [volUnit, setVolUnit] = useState("mL");

    const g_result = useMemo(() => {
        const MW = safeParse(mw);
        const C = safeParse(conc);
        const V = safeParse(volume);

        if (MW <= 0 || V <= 0 || C <= 0) return 0;

        const V_L = convertUnit(V, volUnit, 'L', 'VOLUME');

        if (concUnit === '% w/v') {
            // Mass (g) = % w/v * Volume (mL) / 100
            const V_mL = convertUnit(V, volUnit, 'mL', 'VOLUME');
            return (C * V_mL) / 100;
        }

        // Standard Molarity calculation: M * Volume(L) * MW
        if (concUnit === 'M') {
            return C * V_L * MW;
        }

        // Convert input conc to Molarity, then calculate g
        const C_M = convertUnit(C, concUnit, 'M', 'MOLARITY');
        return C_M * V_L * MW;

    }, [mw, conc, volume, concUnit, volUnit]);

    const calculate = () => {
        if (g_result > 0) {
            const inputs = { mw, conc, concUnit, volume, volUnit };
            const result = { gramsNeeded: g_result };
            const sentence = `To make a solution of ${conc} ${concUnit} in ${volume} ${volUnit} (MW: ${mw}), ${fmt(g_result)} grams are needed.`;
            saveHistory({ type: "Solution Calculation", inputs, result, sentence }, saveHistory);
        }
    };

    return (
<FormScreenWrapper title="🔬 Solution & Grams Needed" styles={styles}>
<Text style={styles.label}>Molecular Weight (MW - g/mol)</Text>
<TextInput style={styles.input} onChangeText={(t) => setMw(filterNumeric(t))} value={mw} keyboardType="numeric" placeholder="e.g., 58.44 (NaCl)" />

<Text style={styles.label}>Target Concentration</Text>
<View style={{ flexDirection: 'row', alignItems: 'center' }}>
<TextInput style={[styles.input, { flex: 1 }]} onChangeText={(t) => setConc(filterNumeric(t))} value={conc} keyboardType="numeric" placeholder="Concentration value" />
<View style={{ width: '30%', marginLeft: 10 }}>
<Picker style={styles.pickerStyle} selectedValue={concUnit} onValueChange={setConcUnit} dropdownIconColor={styles.isDark ? '#fff' : '#333'}>
<Picker.Item label="M" value="M" />
<Picker.Item label="mM" value="mM" />
<Picker.Item label="µM" value="uM" />
<Picker.Item label="% w/v" value="% w/v" />
</Picker>
</View>
</View>

<Text style={styles.label}>Final Volume</Text>
<View style={{ flexDirection: 'row', alignItems: 'center' }}>
<TextInput style={[styles.input, { flex: 1 }]} onChangeText={(t) => setVolume(filterNumeric(t))} value={volume} keyboardType="numeric" placeholder="Volume value" />
<UnitPicker styles={styles} unitType="VOLUME" selectedValue={volUnit} onValueChange={setVolUnit} />
</View>

<TouchableOpacity style={styles.btn} onPress={calculate}>
<Text style={styles.btnText}>Calculate Grams Required</Text>
</TouchableOpacity>

<View style={styles.sep} />
<Text style={styles.result}>Grams Required: <Text style={{ color: '#4ade80' }}>{fmt(g_result)} g</Text></Text>
<Text style={{ ...styles.label, marginTop: 12, fontSize: 11 }}>*MW is not required for % w/v calculation.</Text>
</FormScreenWrapper>
    );
};


/* -------------------- 4. Serial Dilution + Chart Screen -------------------- */

const DilutionScreen = ({ styles, saveHistory }) => {
    const [startConc, setStartConc] = useState("");
    const [dilutionFactor, setDilutionFactor] = useState("");
    const [steps, setSteps] = useState("");
    const [concUnit, setConcUnit] = useState("M");

    const dilutionData = useMemo(() => {
        const C0 = safeParse(startConc);
        const DF = safeParse(dilutionFactor);
        const S = safeParse(steps);

        if (C0 <= 0 || DF <= 1 || S <= 0 || S > 10) return []; // Limit steps for performance/viewing

        let currentC = C0;
        const data = [{ x: 0, y: C0, label: `Start: ${fmt(C0)} ${concUnit}` }];

        for (let i = 1; i <= S; i++) {
            currentC /= DF;
            data.push({ x: i, y: currentC, label: `Step ${i}: ${fmt(currentC)} ${concUnit}` });
        }
        return data;
    }, [startConc, dilutionFactor, steps, concUnit]);

    const calculate = () => {
        if (dilutionData.length > 0) {
            const finalConc = dilutionData[dilutionData.length - 1].y;
            const inputs = { startConc, dilutionFactor, steps, concUnit };
            const result = { finalConc, data: dilutionData.map(d => ({ step: d.x, conc: d.y })) };
            const sentence = `Serial dilution of ${startConc} ${concUnit} with factor ${dilutionFactor} for ${steps} steps. Final concentration: ${fmt(finalConc)} ${concUnit}.`;
            saveHistory({ type: "Serial Dilution", inputs, result, sentence }, saveHistory);
        }
    };

    return (
<FormScreenWrapper title="📈 Serial Dilution & Chart" styles={styles}>
<Text style={styles.label}>Starting Concentration</Text>
<View style={{ flexDirection: 'row', alignItems: 'center' }}>
<TextInput style={[styles.input, { flex: 1 }]} onChangeText={(t) => setStartConc(filterNumeric(t))} value={startConc} keyboardType="numeric" placeholder="C0" />
<UnitPicker styles={styles} unitType="MOLARITY" selectedValue={concUnit} onValueChange={setConcUnit} />
</View>

<Text style={styles.label}>Dilution Factor (e.g., 10 for 1:10)</Text>
<TextInput style={styles.input} onChangeText={(t) => setDilutionFactor(filterNumeric(t))} value={dilutionFactor} keyboardType="numeric" placeholder="e.g., 10" />

<Text style={styles.label}>Number of Steps (Max 10)</Text>
<TextInput style={styles.input} onChangeText={(t) => setSteps(filterNumeric(t))} value={steps} keyboardType="numeric" placeholder="e.g., 5" />

<TouchableOpacity style={styles.btn} onPress={calculate}>
<Text style={styles.btnText}>Calculate & Visualize Dilution</Text>
</TouchableOpacity>

<View style={styles.sep} />
            {dilutionData.length > 0 && (
<View style={{ height: 300, paddingVertical: 10 }}>
<Text style={styles.title}>Concentration Over Steps</Text>
<VictoryChart 
                        domainPadding={20} 
                        padding={{ top: 20, bottom: 50, left: 60, right: 30 }}
                        height={280}
                        style={{ parent: { backgroundColor: styles.card.backgroundColor, borderRadius: 16 } }}
>
<VictoryAxis 
                            label="Dilution Step (x)"
                            style={{ 
                                axisLabel: { padding: 30, fill: styles.darkLabel.color },
                                tickLabels: { fill: styles.darkLabel.color } 
                            }} 
                        />
<VictoryAxis 
                            dependentAxis 
                            label={`Concentration (${concUnit})`} 
                            style={{ 
                                axisLabel: { padding: 40, fill: styles.darkLabel.color },
                                tickLabels: { fill: styles.darkLabel.color } 
                            }} 
                        />
<VictoryLine 
                            data={dilutionData} 
                            x="x"
                            y="y"
                            style={{ data: { stroke: "#4ade80", strokeWidth: 3 } }}
                        />
<VictoryScatter 
                            data={dilutionData} 
                            x="x"
                            y="y"
                            size={5} 
                            style={{ data: { fill: "#2d7fe8" } }}
                        />
</VictoryChart>
<Text style={styles.result}>Final Concentration: <Text style={{ color: '#4ade80' }}>{fmt(dilutionData[dilutionData.length - 1].y)} {concUnit}</Text></Text>
</View>
            )}
</FormScreenWrapper>
    );
};

/* -------------------- 5. Buffer Calculation Screen -------------------- */

const BufferScreen = ({ styles, saveHistory }) => {
    const [pH, setPh] = useState("");
    const [pKa, setPka] = useState("");
    const [mwAcid, setMwAcid] = useState("");
    const [mwSalt, setMwSalt] = useState("");
    const [totalVol, setTotalVol] = useState(""); // mL
    const [totalConc, setTotalConc] = useState(""); // M

    // Calculate Ratio [A-]/[HA] and required mass of components (g)
    const { ratio, acidMass, saltMass } = useMemo(() => {
        const pHVal = safeParse(pH);
        const pKaVal = safeParse(pKa);
        const MWa = safeParse(mwAcid);
        const MWs = safeParse(mwSalt);
        const V = safeParse(totalVol); // mL
        const C = safeParse(totalConc); // M

        if (pKaVal <= 0 || V <= 0 || C <= 0 || MWa <= 0 || MWs <= 0) return {};

        // Calculate Ratio [A-]/[HA]
        const diff = pHVal - pKaVal;
        const ratio = Math.pow(10, diff);

        // Calculate Molar Fractions
        const X_Salt = ratio / (1 + ratio); // Fraction of Conjugate Base (A-)
        const X_Acid = 1 / (1 + ratio); // Fraction of Weak Acid (HA)

        // Calculate Mass (g) needed for each component
        // Mass (g) = X * C (mol/L) * V (L) * MW (g/mol)
        const V_L = convertUnit(V, 'mL', 'L', 'VOLUME');

        const acidMass = X_Acid * C * V_L * MWa;
        const saltMass = X_Salt * C * V_L * MWs;

        return { ratio, acidMass, saltMass };

    }, [pH, pKa, mwAcid, mwSalt, totalVol, totalConc]);

    const calculate = () => {
        if (acidMass > 0 && saltMass > 0) {
            const inputs = { pH, pKa, mwAcid, mwSalt, totalVol, totalConc };
            const result = { ratio, acidMass, saltMass };
            const sentence = `Buffer calculated: Ratio [A-]/[HA] = ${fmt(ratio)}. Required: ${fmt(acidMass)} g Acid, ${fmt(saltMass)} g Salt for ${totalVol} mL of ${totalConc} M solution.`;
            saveHistory({ type: "Buffer Calculation", inputs, result, sentence }, saveHistory);
        }
    };

    return (
<FormScreenWrapper title="⚖️ Buffer Solution (H-H Equation)" styles={styles}>
<Text style={styles.label}>Target pH of Buffer</Text>
<TextInput style={styles.input} onChangeText={(t) => setPh(filterNumeric(t))} value={pH} keyboardType="numeric" placeholder="pH (e.g., 7.4)" />

<Text style={styles.label}>pKa of Weak Acid</Text>
<TextInput style={styles.input} onChangeText={(t) => setPka(filterNumeric(t))} value={pKa} keyboardType="numeric" placeholder="pKa (e.g., 6.86 for Phosphate)" />

<View style={styles.sep} />
<Text style={styles.title}>Required Components for Preparation</Text>
<Text style={styles.label}>Total Required Concentration (M)</Text>
<TextInput style={styles.input} onChangeText={(t) => setTotalConc(filterNumeric(t))} value={totalConc} keyboardType="numeric" placeholder="e.g., 0.1 M" />
<Text style={styles.label}>Total Volume (mL)</Text>
<TextInput style={styles.input} onChangeText={(t) => setTotalVol(filterNumeric(t))} value={totalVol} keyboardType="numeric" placeholder="e.g., 1000 mL" />

<Text style={styles.label}>MW of Weak Acid (g/mol)</Text>
<TextInput style={styles.input} onChangeText={(t) => setMwAcid(filterNumeric(t))} value={mwAcid} keyboardType="numeric" placeholder="MW of HA" />
<Text style={styles.label}>MW of Conjugate Salt (g/mol)</Text>
<TextInput style={styles.input} onChangeText={(t) => setMwSalt(filterNumeric(t))} value={mwSalt} keyboardType="numeric" placeholder="MW of A-" />

<TouchableOpacity style={styles.btn} onPress={calculate}>
<Text style={styles.btnText}>Calculate Grams Needed</Text>
</TouchableOpacity>

<View style={styles.sep} />
<Text style={styles.result}>Ratio $[A^-]/[HA]$: <Text style={{ color: '#4ade80' }}>{fmt(ratio)}</Text></Text>
<Text style={styles.result}>**Mass of Acid (HA): <Text style={{ color: '#4ade80' }}>{fmt(acidMass)} g</Text>**</Text>
<Text style={styles.result}>**Mass of Conjugate Salt ($A^-$): <Text style={{ color: '#4ade80' }}>{fmt(saltMass)} g</Text>**</Text>
</FormScreenWrapper>
    );
};


/* -------------------- 6. Conversion Screen -------------------- */

const ConversionScreen = ({ styles, saveHistory }) => {
    const categories = useMemo(() => ([
        { key: 'MASS', name: 'Mass (kg, g, mg, μg)' },
        { key: 'VOLUME', name: 'Volume (L, mL, uL)' },
        { key: 'MOLARITY', name: 'Molarity (M, mM, µM)' },
        { key: 'TEMP', name: 'Temperature (°C, °F, K)' },
    ]), []);

    const [category, setCategory] = useState(categories[0].key);
    const [value, setValue] = useState("");

    const initialUnits = useMemo(() => Object.keys(UNITS_MAP[category]), [category]);

    const [fromUnit, setFromUnit] = useState(initialUnits[1] || initialUnits[0]);
    const [toUnit, setToUnit] = useState(initialUnits[0]);

    // Update unit lists when category changes
    useEffect(() => {
        const units = Object.keys(UNITS_MAP[category] || UNITS_MAP.MASS);
        if (units.length > 0) {
            setFromUnit(units[1] || units[0]);
            setToUnit(units[0]);
        }
    }, [category]);

    const result = useMemo(() => {
        const val = safeParse(value);
        if (val === 0 || fromUnit === toUnit) return val;
        return convertUnit(val, fromUnit, toUnit, category);
    }, [value, fromUnit, toUnit, category]);

    const calculate = () => {
        if (result !== 0) {
            const inputs = { value, fromUnit, toUnit, category };
            const resultObj = { convertedValue: result };
            const sentence = `Converted ${value} ${fromUnit} to ${fmt(result)} ${toUnit} (${categories.find(c => c.key === category).name}).`;
            saveHistory({ type: "Unit Conversion", inputs, result: resultObj, sentence }, saveHistory);
        }
    };

    const units = Object.keys(UNITS_MAP[category] || {});

    return (
<FormScreenWrapper title="🔄 Comprehensive Unit Conversion" styles={styles}>
<Text style={styles.label}>Select Category</Text>
<View style={styles.pickerStyle}>
<Picker selectedValue={category} onValueChange={setCategory} itemStyle={styles.pickerItemStyle} dropdownIconColor={styles.isDark ? '#fff' : '#333'}>
                    {categories.map(c =><Picker.Item key={c.key} label={c.name} value={c.key} />)}
</Picker>
</View>

<Text style={styles.label}>Value to Convert</Text>
<TextInput style={styles.input} onChangeText={(t) => setValue(filterNumeric(t))} value={value} keyboardType="numeric" placeholder="Enter value" />

<Text style={styles.label}>From Unit</Text>
<View style={styles.pickerStyle}>
<Picker selectedValue={fromUnit} onValueChange={setFromUnit} itemStyle={styles.pickerItemStyle} dropdownIconColor={styles.isDark ? '#fff' : '#333'}>
                    {units.map(u =><Picker.Item key={u} label={u} value={u} />)}
</Picker>
</View>

<Text style={styles.label}>To Unit</Text>
<View style={styles.pickerStyle}>
<Picker selectedValue={toUnit} onValueChange={setToUnit} itemStyle={styles.pickerItemStyle} dropdownIconColor={styles.isDark ? '#fff' : '#333'}>
                    {units.map(u =><Picker.Item key={u} label={u} value={u} />)}
</Picker>
</View>

<TouchableOpacity style={styles.btn} onPress={calculate}>
<Text style={styles.btnText}>Calculate Conversion</Text>
</TouchableOpacity>

<View style={styles.sep} />
<Text style={styles.result}>Result: <Text style={{ color: '#4ade80' }}>{fmt(result)} {toUnit}</Text></Text>
</FormScreenWrapper>
    );
};


/* -------------------- 7. History Screen (Searchable & Exportable) -------------------- */

const HistoryScreen = ({ styles, history, clearAllHistory }) => {
    const [searchText, setSearchText] = useState("");

    const filteredHistory = useMemo(() => {
        if (!searchText) return history;
        const lowerSearch = searchText.toLowerCase();
        return history.filter(item =>
            item.type.toLowerCase().includes(lowerSearch) || 
            item.sentence?.toLowerCase().includes(lowerSearch) ||
            JSON.stringify(item.inputs).toLowerCase().includes(lowerSearch)
        );
    }, [history, searchText]);

    const renderItem = ({ item }) => {
        const date = new Date(item.time).toLocaleDateString(undefined, { hour: '2-digit', minute: '2-digit' });
        return (
<View style={styles.historyItem}>
<Text style={styles.historyType}>{item.type}</Text>
<Text style={styles.historyInputs}>Inputs: {JSON.stringify(item.inputs).substring(0, 100)}...</Text>
<Text style={styles.historyResult}>Result Summary: {item.sentence}</Text>
<Text style={styles.historyDate}>Date: {date}</Text>
</View>
        );
    };

    return (
<SafeAreaView style={styles.container}>
<View style={{ padding: 16 }}>
<Text style={styles.title}>Calculation History ({filteredHistory.length} of {history.length})</Text>
<TextInput 
                    style={[styles.input, { marginBottom: 15 }]} 
                    onChangeText={setSearchText} 
                    value={searchText} 
                    placeholderTextColor={styles.isDark ? '#a0b0c0' : '#888'}
                    placeholder="Search by calculation type or keywords..."
                />

<View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 }}>
<TouchableOpacity style={{ ...styles.btn, flex: 1, marginRight: 10, backgroundColor: '#f59e0b' }} onPress={() => exportHistoryCSV(history)}>
<Text style={styles.btnText}>Export CSV</Text>
</TouchableOpacity>
<TouchableOpacity style={{ ...styles.btn, flex: 1, backgroundColor: '#ef4444' }} onPress={clearAllHistory}>
<Text style={styles.btnText}>Clear All</Text>
</TouchableOpacity>
</View>
</View>

<FlatList
                data={filteredHistory}
                renderItem={renderItem}
                keyExtractor={item => item.time}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 50 }}
                ListEmptyComponent={<Text style={{ ...styles.label, textAlign: 'center', marginTop: 20 }}>No matching history found.</Text>}
            />
</SafeAreaView>
    );
};


/* -------------------- 8. AI / Smart Suggestions (Mock Implementation) -------------------- */

const SuggestionCard = ({ styles, history }) => {
    // Mock AI Logic: Suggest a related calculation type based on the last history item
    const lastCalculation = history[0];
    const suggestion = useMemo(() => {
        if (!lastCalculation) return { title: "Start Calculating!", desc: "Perform your first calculation to get smart suggestions.", screen: 'Dose' };

        switch (lastCalculation.type) {
            case "Dose Calculation":
                return { title: "Smart Suggestion: Serial Dilution", desc: "You calculated a dose. Need to prepare the solution from a higher concentration stock?", screen: 'Dilution' };
            case "Solution Calculation":
                return { title: "Smart Suggestion: Unit Conversion", desc: "You prepared a solution. Do you need to convert the final concentration to a different unit (e.g., M to mM)?", screen: 'Convert' };
            case "Buffer Calculation":
                return { title: "Smart Suggestion: Animal Profile", desc: "Buffer calculation is complete. Time to check patient vitals or add a new animal profile?", screen: 'Animals' };
            default:
                return { title: "Suggestion: Dose Calculation", desc: "Dose calculation is the most common task. Let's calculate a required drug amount.", screen: 'Dose' };
        }
    }, [lastCalculation]);

    return (
<NavCard 
            styles={styles} 
            icon="bulb-outline"
            name={suggestion.title} 
            desc={suggestion.desc} 
            iconColor="#facc15"
            onPress={() => Alert.alert("AI Feature", `This would navigate to the ${suggestion.screen} screen to complete the suggested task.`)}
        />
    );
};


/* -------------------- 9. Home Screen (Central Navigation) -------------------- */

const HomeScreen = ({ styles, navigate, history, animals }) => (
<ScrollView contentContainerStyle={{ padding: 16 }} style={{ flex: 1, backgroundColor: styles.container.backgroundColor }}>
<Text style={styles.title}>Quick Access Calculations</Text>
<View style={{ marginVertical: 10 }}>
<NavCard styles={styles} icon="eyedrop-outline" name="Dose & Infusion Rate" desc="Calculate drug doses, volumes, and infusion rates." onPress={() => navigate("Dose")} />
<NavCard styles={styles} icon="flask-outline" name="Solution & Grams Needed" desc="Molarity, % w/v to mass (g) calculations." onPress={() => navigate("Solution")} />
<NavCard styles={styles} icon="water-outline" name="Serial Dilution & Chart" desc="Calculate sequential dilutions and visualize results." onPress={() => navigate("Dilution")} />
<NavCard styles={styles} icon="scale-outline" name="Buffer Solution (H-H)" desc="Calculate pH and required mass of buffer components." onPress={() => navigate("Buffer")} />
<NavCard styles={styles} icon="swap-horizontal-outline" name="Comprehensive Unit Conversion" desc="Convert Mass, Volume, Molarity, and Temperature units." onPress={() => navigate("Convert")} />
</View>

<View style={styles.sep} />
<Text style={styles.title}>Management & Tools</Text>
<View style={{ marginVertical: 10 }}>
<NavCard styles={styles} icon="paw-outline" name="Animal Health Management" desc={`Manage ${animals.length} animal records (Weight, Vitals, Condition).`} onPress={() => navigate("Animals")} />
<NavCard styles={styles} icon="time-outline" name="Calculation History" desc={`View and search ${history.length} past calculations (CSV export).`} onPress={() => navigate("History")} />
</View>

<View style={styles.sep} />
<SuggestionCard styles={styles} history={history} />
</ScrollView>
);

/* -------------------- 10. Main App Component (Routing) -------------------- */

export default function App() {
  const colorScheme = useColorScheme();
  const [activeScreen, setActiveScreen] = useState("Home");
  const [isDark, setIsDark] = useState(colorScheme === 'dark');
  const [history, setHistory] = useState([]);
  const [animals, setAnimals] = useState([]);

  // Load state on mount
  useEffect(() => {
    loadHistory(setHistory);
    loadAnimals(setAnimals);
  }, []);

  const loadAnimals = async (setter) => {
    try {
        const raw = await AsyncStorage.getItem(ANIMALS_KEY);
        setter(raw ? JSON.parse(raw) : []);
    } catch (e) {
        console.error("Failed to load animals:", e);
    }
  };


 const styles = useMemo(() => getStyles(isDark), [isDark]); 
  
  const currentStyles = styles; 
  
  const screenMap = useMemo(() => ({
    Home: () =><HomeScreen styles={styles} navigate={setActiveScreen} history={history} animals={animals} />,
    Dose: () =><DoseScreen styles={styles} saveHistory={(item) => saveHistory(item, setHistory)} animals={animals} />,
    Solution: () =><SolutionScreen styles={styles} saveHistory={(item) => saveHistory(item, setHistory)} />,
    Dilution: () =><DilutionScreen styles={styles} saveHistory={(item) => saveHistory(item, setHistory)} />,
    Buffer: () =><BufferScreen styles={styles} saveHistory={(item) => saveHistory(item, setHistory)} />,
    Convert: () =><ConversionScreen styles={styles} saveHistory={(item) => saveHistory(item, setHistory)} />,
    History: () =><HistoryScreen styles={styles} history={history} clearAllHistory={() => clearAllHistory(setHistory)} />,
    Animals: () =><AnimalManagementScreen styles={styles} setAnimals={setAnimals} animals={animals} />,
  }), [styles, history, animals]);

  const CurrentScreenComponent = screenMap[activeScreen];

  const getHeaderTitle = (screen) => {
    switch (screen) {
        case "Dose": return "محاسبه دوز و نرخ تزریق";
        case "Solution": return "محاسبه غلظت محلول";
        case "Dilution": return "رقت سریالی (Serial Dilution)";
        case "Buffer": return "محلول بافر";
        case "Convert": return "تبدیل واحد";
        case "History": return "تاریخچه محاسبات";
        case "Animals": return "مدیریت پرونده حیوانات";
        default: return "VetLab Pro";
    }
  };
  
  // این تابع اصلاح شده مشکل "color of undefined" را حل می‌کند
  const renderHeader = () => {
    // استفاده از currentStyles به جای styles.darkHeaderTitle.color که ناامن بود
    const headerTextColor = currentStyles.headerTitle.color;
    
    return (
      <View style={currentStyles.header}>
        {activeScreen !== "Home" && (
          <TouchableOpacity onPress={() => setActiveScreen("Home")} style={{ position: 'absolute', left: 15, padding: 5 }}>
            <Ionicons name="arrow-back" size={26} color={headerTextColor} />
          </TouchableOpacity>
        )}
        <Text style={currentStyles.headerTitle}>{getHeaderTitle(activeScreen)}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', position: 'absolute', right: 15 }}>
          <Text style={{ color: headerTextColor, marginRight: 8, fontSize: 12 }}>Dark Mode</Text>
          <Switch
            trackColor={{ false: "#767577", true: "#81b0ff" }}
            thumbColor={isDark ? "#f4f3f4" : "#f4f3f4"}
            ios_backgroundColor="#3e3e3e"
            onValueChange={setIsDark}
            value={isDark}
          />
        </View>
      </View>
    );
  };

  return (
<SafeAreaView style={styles.container}>
      {renderHeader()}
<CurrentScreenComponent />
</SafeAreaView>
  );
}
