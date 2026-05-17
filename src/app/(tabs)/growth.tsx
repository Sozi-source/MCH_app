import { useT } from '@/hooks/useT';
import { COLORS, RADIUS } from '@/lib/theme';
import { calculateZScores } from '@/lib/zscore';
import { GrowthRecord, useChildStore } from '@/store/childStore';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';

function getAgeMonthsFromDates(dob: string, measureDate: Date): number {
  const birth = new Date(dob);
  return (measureDate.getFullYear() - birth.getFullYear()) * 12 +
    (measureDate.getMonth() - birth.getMonth());
}

function getZLabel(z: number | null): { label: string; color: string; bg: string } {
  if (z === null) return { label: 'N/A',          color: COLORS.textMuted, bg: COLORS.surface };
  if (z < -3)     return { label: 'Severely low', color: '#A32D2D',        bg: '#FCEBEB' };
  if (z < -2)     return { label: 'Low',          color: '#854F0B',        bg: '#FAEEDA' };
  if (z > 2)      return { label: 'High',         color: '#185FA5',        bg: '#E6F1FB' };
  return           { label: 'Normal',             color: '#0F6E56',        bg: '#E1F5EE' };
}

function formatDate(d: Date) {
  return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' });
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function InlineDatePicker({ value, onChange }: {
  value: Date;
  onChange: (d: Date) => void;
}) {
  const currentYear = new Date().getFullYear();
  const years  = Array.from({ length: 6 }, (_, i) => currentYear - i);
  const [selYear,  setSelYear]  = useState(value.getFullYear());
  const [selMonth, setSelMonth] = useState(value.getMonth());
  const [selDay,   setSelDay]   = useState(value.getDate());

  const daysInMonth = new Date(selYear, selMonth + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const commit = (y: number, m: number, d: number) => {
    const safeDay = Math.min(d, new Date(y, m + 1, 0).getDate());
    onChange(new Date(y, m, safeDay));
  };

  return (
    <View style={ip.wrapper}>
      <Text style={ip.label}>Year</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={ip.row}>
          {years.map(y => (
            <TouchableOpacity
              key={y}
              style={[ip.chip, selYear === y && ip.chipActive]}
              onPress={() => { setSelYear(y); commit(y, selMonth, selDay); }}
            >
              <Text style={[ip.chipText, selYear === y && ip.chipTextActive]}>{y}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <Text style={ip.label}>Month</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={ip.row}>
          {MONTHS.map((m, i) => (
            <TouchableOpacity
              key={m}
              style={[ip.chip, selMonth === i && ip.chipActive]}
              onPress={() => { setSelMonth(i); commit(selYear, i, selDay); }}
            >
              <Text style={[ip.chipText, selMonth === i && ip.chipTextActive]}>{m}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <Text style={ip.label}>Day</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={ip.row}>
          {days.map(d => (
            <TouchableOpacity
              key={d}
              style={[ip.chip, ip.dayChip, selDay === d && ip.chipActive]}
              onPress={() => { setSelDay(d); commit(selYear, selMonth, d); }}
            >
              <Text style={[ip.chipText, selDay === d && ip.chipTextActive]}>{d}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function RecordCard({ rec }: { rec: GrowthRecord }) {
  const t = useT();
  return (
    <View style={styles.recCard}>
      <View style={styles.recHeader}>
        <View style={styles.recAgeBadge}>
          <Text style={styles.recAgeBadgeText}>{rec.age_months} mo</Text>
        </View>
        <Text style={styles.recDate}>
          {new Date(rec.recorded_at).toLocaleDateString('en-KE', {
            day: 'numeric', month: 'short', year: 'numeric',
          })}
        </Text>
      </View>
      <View style={styles.recStats}>
        <View style={styles.recStat}>
          <Text style={styles.recStatVal}>{rec.weight_kg} kg</Text>
          <Text style={styles.recStatLabel}>{t('weight_label')}</Text>
        </View>
        {rec.height_cm ? (
          <View style={styles.recStat}>
            <Text style={styles.recStatVal}>{rec.height_cm} cm</Text>
            <Text style={styles.recStatLabel}>{t('height_label')}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.zRow}>
        {([['WAZ', rec.waz], ['HAZ', rec.haz], ['WHZ', rec.whz]] as [string, number | null][]).map(([label, val]) => {
          const info = getZLabel(val);
          return (
            <View key={label} style={[styles.zChip, { backgroundColor: info.bg }]}>
              <Text style={styles.zChipLabel}>{label}</Text>
              <Text style={[styles.zChipVal, { color: info.color }]}>
                {val !== null ? val.toFixed(1) : 'N/A'}
              </Text>
              <Text style={[styles.zChipStatus, { color: info.color }]}>{info.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default function GrowthScreen() {
  const t      = useT();
  const router = useRouter();
  const { children, selectedChildId, growthRecords, fetchGrowthRecords, addGrowthRecord } = useChildStore();
  const activeChild = children.find(c => c.id === selectedChildId);

  const [weight, setWeight]           = useState('');
  const [height, setHeight]           = useState('');
  const [loading, setLoading]         = useState(false);
  const [showForm, setShowForm]       = useState(false);
  const [showPicker, setShowPicker]   = useState(false);
  const [measureDate, setMeasureDate] = useState(new Date());

  const ageMonths = activeChild
    ? getAgeMonthsFromDates(activeChild.date_of_birth, measureDate)
    : 0;

  useEffect(() => {
    if (selectedChildId) fetchGrowthRecords(selectedChildId);
  }, [selectedChildId]);

  const handleAdd = async () => {
    if (!activeChild) return;
    if (!weight) {
      Platform.OS === 'web'
        ? window.alert(t('weight_age_required'))
        : Alert.alert(t('missing_fields'), t('weight_age_required'));
      return;
    }
    const w = parseFloat(weight);
    const h = height ? parseFloat(height) : null;
    if (isNaN(w)) {
      Platform.OS === 'web'
        ? window.alert(t('enter_valid_numbers'))
        : Alert.alert(t('invalid_input'), t('enter_valid_numbers'));
      return;
    }
    if (ageMonths < 0) {
      Platform.OS === 'web'
        ? window.alert('Measurement date is before the child\'s birth date.')
        : Alert.alert('Invalid date', 'Measurement date is before the child\'s birth date.');
      return;
    }
    setLoading(true);
    try {
      const zscores = await calculateZScores(w, h, ageMonths, activeChild.sex);
      await addGrowthRecord({
        child_id:    activeChild.id,
        weight_kg:   w,
        height_cm:   h,
        age_months:  ageMonths,
        waz:         zscores.waz,
        haz:         zscores.haz,
        whz:         zscores.whz,
        recorded_at: measureDate.toISOString(),
      });
      setWeight('');
      setHeight('');
      setMeasureDate(new Date());
      setShowForm(false);
      setShowPicker(false);
      Platform.OS === 'web'
        ? window.alert(t('growth_saved'))
        : Alert.alert(t('saved'), t('growth_saved'));
    } catch {
      Platform.OS === 'web'
        ? window.alert(t('failed_save'))
        : Alert.alert('Error', t('failed_save'));
    } finally {
      setLoading(false);
    }
  };

  if (!activeChild) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconCircle}>
          <Ionicons name="people-outline" size={48} color={COLORS.primaryMid} />
        </View>
        <Text style={styles.emptyTitle}>{t('no_child_selected')}</Text>
        <Text style={styles.emptySub}>{t('go_to_children')}</Text>
        <TouchableOpacity style={styles.goBtn} onPress={() => router.push('/(tabs)/children')}>
          <Ionicons name="people" size={16} color={COLORS.onPrimary} />
          <Text style={styles.goBtnText}>Go to Children</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="trending-up" size={22} color={COLORS.onPrimary} />
        <Text style={styles.headerTitle}>{t('growth_tracker')}</Text>
        <TouchableOpacity onPress={() => { setShowForm(f => !f); setShowPicker(false); }}>
          <Ionicons
            name={showForm ? 'close-circle' : 'add-circle'}
            size={26}
            color={COLORS.onPrimary}
          />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.childBanner}>
          <View style={[styles.childIcon, activeChild.sex === 'female' ? styles.childIconFemale : styles.childIconMale]}>
            <Ionicons
              name={activeChild.sex === 'female' ? 'female' : 'male'}
              size={20}
              color={activeChild.sex === 'female' ? COLORS.primary : '#185FA5'}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.childName}>{activeChild.full_name}</Text>
            <Text style={styles.childAge}>
              Current age: <Text style={styles.childAgeBold}>
                {getAgeMonthsFromDates(activeChild.date_of_birth, new Date())} months
              </Text>
            </Text>
          </View>
        </View>

        {showForm && (
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="add-circle-outline" size={18} color={COLORS.primary} />
              <Text style={styles.cardTitle}>{t('add_measurement')}</Text>
            </View>

            <Text style={styles.label}>Measurement Date</Text>
            <TouchableOpacity style={styles.dateBtn} onPress={() => setShowPicker(p => !p)}>
              <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
              <Text style={styles.dateBtnText}>{formatDate(measureDate)}</Text>
              <Ionicons name={showPicker ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textMuted} />
            </TouchableOpacity>

            {showPicker && (
              <InlineDatePicker
                value={measureDate}
                onChange={(d) => setMeasureDate(d)}
              />
            )}

            <Text style={styles.label}>{t('age_months')}</Text>
            <View style={styles.readonlyInput}>
              <Ionicons name="lock-closed-outline" size={14} color={COLORS.textMuted} />
              <Text style={styles.readonlyText}>
                {ageMonths >= 0 ? `${ageMonths} months (auto-calculated)` : 'Invalid - before birth date'}
              </Text>
            </View>

            <Text style={styles.label}>{t('weight_kg')} *</Text>
            <TextInput
              style={styles.input}
              value={weight}
              onChangeText={setWeight}
              placeholder={t('weight_placeholder')}
              placeholderTextColor={COLORS.textMuted}
              keyboardType="decimal-pad"
            />

            <Text style={styles.label}>{t('height_cm')}</Text>
            <TextInput
              style={styles.input}
              value={height}
              onChangeText={setHeight}
              placeholder={t('height_placeholder')}
              placeholderTextColor={COLORS.textMuted}
              keyboardType="decimal-pad"
            />

            <TouchableOpacity style={styles.btn} onPress={handleAdd} disabled={loading}>
              {loading ? (
                <View style={styles.btnInner}>
                  <ActivityIndicator color={COLORS.onPrimary} size="small" />
                  <Text style={styles.btnText}>{t('calculating')}</Text>
                </View>
              ) : (
                <View style={styles.btnInner}>
                  <Ionicons name="save-outline" size={16} color={COLORS.onPrimary} />
                  <Text style={styles.btnText}>{t('calculate_save')}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.cardTitleRow}>
          <Ionicons name="time-outline" size={18} color={COLORS.primary} />
          <Text style={styles.sectionTitle}>{t('history')}</Text>
        </View>

        {growthRecords.length === 0 ? (
          <Text style={styles.emptyText}>{t('no_records')}</Text>
        ) : (
          growthRecords.map(rec => <RecordCard key={rec.id} rec={rec} />)
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const ip = StyleSheet.create({
  wrapper:        { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: 12, marginTop: 8, borderWidth: 1, borderColor: COLORS.border },
  label:          { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary, marginTop: 10, marginBottom: 6 },
  row:            { flexDirection: 'row', gap: 8 },
  chip:           { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border },
  dayChip:        { paddingHorizontal: 10, minWidth: 38, alignItems: 'center' },
  chipActive:     { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText:       { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  chipTextActive: { color: COLORS.onPrimary, fontWeight: '700' },
});

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: COLORS.background },
  emptyContainer:   { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIconCircle:  { width: 88, height: 88, borderRadius: 44, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle:       { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 8 },
  emptySub:         { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  goBtn:            { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  goBtnText:        { color: COLORS.onPrimary, fontWeight: '700', fontSize: 14 },
  header:           { backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 52, paddingBottom: 16 },
  headerTitle:      { fontSize: 20, fontWeight: '700', color: COLORS.onPrimary, flex: 1, marginLeft: 10 },
  scroll:           { padding: 16, paddingBottom: 32 },
  childBanner:      { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.lg, padding: 14, marginBottom: 12, gap: 12, borderWidth: 1, borderColor: COLORS.border },
  childIcon:        { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  childIconMale:    { backgroundColor: '#E6F1FB' },
  childIconFemale:  { backgroundColor: COLORS.primaryLight },
  childName:        { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  childAge:         { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  childAgeBold:     { fontWeight: '700', color: COLORS.primary },
  card:             { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  cardTitleRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardTitle:        { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  sectionTitle:     { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  label:            { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6, marginTop: 12 },
  input:            { backgroundColor: COLORS.surface, color: COLORS.textPrimary, borderRadius: RADIUS.md, padding: 12, fontSize: 14, borderWidth: 1, borderColor: COLORS.border },
  readonlyInput:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: 12, borderWidth: 1, borderColor: COLORS.border, opacity: 0.7 },
  readonlyText:     { fontSize: 14, color: COLORS.textSecondary, fontWeight: '600' },
  dateBtn:          { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: COLORS.border },
  dateBtnText:      { fontSize: 14, color: COLORS.textPrimary, fontWeight: '600', flex: 1 },
  btn:              { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: 14, alignItems: 'center', marginTop: 16 },
  btnInner:         { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText:          { color: COLORS.onPrimary, fontWeight: '700', fontSize: 15 },
  emptyText:        { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', marginTop: 8, marginBottom: 24 },
  recCard:          { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border },
  recHeader:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  recAgeBadge:      { backgroundColor: COLORS.primaryLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  recAgeBadgeText:  { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  recDate:          { fontSize: 12, color: COLORS.textMuted },
  recStats:         { flexDirection: 'row', gap: 24, marginBottom: 12 },
  recStat:          { alignItems: 'center' },
  recStatVal:       { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  recStatLabel:     { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  zRow:             { flexDirection: 'row', gap: 8 },
  zChip:            { flex: 1, borderRadius: RADIUS.md, padding: 8, alignItems: 'center' },
  zChipLabel:       { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, marginBottom: 2 },
  zChipVal:         { fontSize: 15, fontWeight: '700' },
  zChipStatus:      { fontSize: 9, fontWeight: '600', marginTop: 2 },
});