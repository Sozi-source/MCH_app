import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS } from '@/lib/theme';
import { useChildStore } from '@/store/childStore';
import { useRouter } from 'expo-router';
import { Sex } from '@/types';

export default function AddChildScreen() {
  const [fullName, setFullName]       = useState('');
  const [dob, setDob]                 = useState('');
  const [sex, setSex]                 = useState<Sex>('male');
  const [birthWeight, setBirthWeight] = useState('');
  const [birthHeight, setBirthHeight] = useState('');
  const [facility, setFacility]       = useState('');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const { addChild } = useChildStore();
  const router = useRouter();

  const handleAdd = async () => {
    setError('');
    if (!fullName || !dob) { setError('Name and date of birth are required.'); return; }
    const dobDate = new Date(dob);
    if (isNaN(dobDate.getTime())) { setError('Please enter a valid date (YYYY-MM-DD).'); return; }
    setLoading(true);
    try {
      await addChild({
        full_name:        fullName.trim(),
        date_of_birth:    dob,
        sex,
        birth_weight_kg:  birthWeight ? parseFloat(birthWeight) : undefined,
        birth_height_cm:  birthHeight ? parseFloat(birthHeight) : undefined,
        health_facility:  facility.trim() || undefined,
        parent_id:        '',
        created_at:       new Date().toISOString(),
      });
      router.back();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to add child.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.onPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Child</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.form}>
          {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}

          <Text style={styles.label}>Full Name *</Text>
          <TextInput style={styles.input} value={fullName} onChangeText={setFullName}
            placeholder="e.g. Amina Wanjiku" placeholderTextColor={COLORS.textMuted} />

          <Text style={styles.label}>Date of Birth * (YYYY-MM-DD)</Text>
          <TextInput style={styles.input} value={dob} onChangeText={setDob}
            placeholder="e.g. 2024-03-15" placeholderTextColor={COLORS.textMuted} />

          <Text style={styles.label}>Sex *</Text>
          <View style={styles.sexRow}>
            {(['male', 'female'] as Sex[]).map(s => (
              <TouchableOpacity key={s} style={[styles.sexBtn, sex === s && styles.sexBtnActive]} onPress={() => setSex(s)}>
                <Ionicons name={s === 'female' ? 'female' : 'male'} size={18}
                  color={sex === s ? COLORS.onPrimary : COLORS.textSecondary} />
                <Text style={[styles.sexBtnText, sex === s && styles.sexBtnTextActive]}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionLabel}>Optional Details</Text>

          <Text style={styles.label}>Health Facility</Text>
          <TextInput style={styles.input} value={facility} onChangeText={setFacility}
            placeholder="e.g. Kenyatta National Hospital" placeholderTextColor={COLORS.textMuted} />

          <Text style={styles.label}>Birth Weight (kg)</Text>
          <TextInput style={styles.input} value={birthWeight} onChangeText={setBirthWeight}
            placeholder="e.g. 3.2" placeholderTextColor={COLORS.textMuted} keyboardType="decimal-pad" />

          <Text style={styles.label}>Birth Height (cm)</Text>
          <TextInput style={styles.input} value={birthHeight} onChangeText={setBirthHeight}
            placeholder="e.g. 50" placeholderTextColor={COLORS.textMuted} keyboardType="decimal-pad" />

          <TouchableOpacity style={styles.btn} onPress={handleAdd} disabled={loading}>
            {loading ? <ActivityIndicator color={COLORS.onPrimary} /> : (
              <View style={styles.btnInner}>
                <Ionicons name="add-circle-outline" size={18} color={COLORS.onPrimary} />
                <Text style={styles.btnText}>Add Child</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: COLORS.background },
  header:          { backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16 },
  headerTitle:     { fontSize: 20, fontWeight: '700', color: COLORS.onPrimary },
  scroll:          { padding: 16 },
  form:            { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 18, borderWidth: 1, borderColor: COLORS.border },
  errorBox:        { backgroundColor: '#FCEBEB', borderRadius: RADIUS.md, padding: 10, marginBottom: 12 },
  errorText:       { color: '#A32D2D', fontSize: 13 },
  sectionLabel:    { fontSize: 13, fontWeight: '700', color: COLORS.primary, marginTop: 24, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  label:           { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6, marginTop: 12 },
  input:           { backgroundColor: COLORS.surface, color: COLORS.textPrimary, borderRadius: RADIUS.md, padding: 12, fontSize: 14, borderWidth: 1, borderColor: COLORS.border },
  sexRow:          { flexDirection: 'row', gap: 10, marginTop: 4 },
  sexBtn:          { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 10, borderRadius: RADIUS.md, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  sexBtnActive:    { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  sexBtnText:      { color: COLORS.textSecondary, fontWeight: '600', fontSize: 14 },
  sexBtnTextActive:{ color: COLORS.onPrimary },
  btn:             { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: 14, alignItems: 'center', marginTop: 24 },
  btnInner:        { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText:         { color: COLORS.onPrimary, fontWeight: '700', fontSize: 15 },
});
