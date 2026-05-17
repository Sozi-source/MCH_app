import { useT } from '@/hooks/useT';
import { COLORS, RADIUS } from '@/lib/theme';
import { useChildStore } from '@/store/childStore';
import { useVaccineStore, VaccineRow, VaccineStatus } from '@/store/vaccineStore';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';

const STATUS_CONFIG: Record<VaccineStatus, { label: string; color: string; bg: string; icon: string }> = {
  given:    { label: 'Given',    color: COLORS.given,    bg: COLORS.givenLight,    icon: 'checkmark-circle' },
  missed:   { label: 'Missed',   color: COLORS.missed,   bg: COLORS.missedLight,   icon: 'close-circle' },
  due:      { label: 'Due',      color: COLORS.due,      bg: COLORS.dueLight,      icon: 'alert-circle' },
  upcoming: { label: 'Upcoming', color: COLORS.upcoming, bg: COLORS.upcomingLight, icon: 'time-outline' },
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
}

function MarkGivenModal({ visible, row, onConfirm, onCancel }: {
  visible: boolean; row: VaccineRow | null;
  onConfirm: (facility: string, date: Date) => void; onCancel: () => void;
}) {
  const t = useT();
  const [facility, setFacility] = useState('');
  const [date, setDate] = useState(new Date());
  useEffect(() => { if (visible) { setFacility(''); setDate(new Date()); } }, [visible]);
  if (!row) return null;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={modal.overlay}>
        <View style={modal.card}>
          <Text style={modal.title}>{row.schedule.vaccine_name}</Text>
          <Text style={modal.subtitle}>Dose {row.schedule.dose_number} · {row.schedule.diseases_covered}</Text>
          <Text style={modal.label}>{t('facility_name')}</Text>
          <TextInput style={modal.input} value={facility} onChangeText={setFacility}
            placeholder={t('facility_placeholder')} placeholderTextColor={COLORS.textMuted} />
          <Text style={modal.label}>Date Given</Text>
          <View style={modal.dateRow}>
            <Ionicons name="calendar-outline" size={16} color={COLORS.primary} />
            <Text style={modal.dateText}>{date.toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
          </View>
          <View style={modal.btnRow}>
            <TouchableOpacity style={modal.cancelBtn} onPress={onCancel}>
              <Text style={modal.cancelText}>{t('cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={modal.confirmBtn} onPress={() => onConfirm(facility, date)}>
              <Ionicons name="checkmark-circle-outline" size={16} color={COLORS.onPrimary} />
              <Text style={modal.confirmText}>{t('mark_given_today')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function VaccineCard({ row, onMarkGiven, onMarkMissed }: {
  row: VaccineRow; onMarkGiven: (row: VaccineRow) => void; onMarkMissed: (row: VaccineRow) => void;
}) {
  const t = useT();
  const cfg = STATUS_CONFIG[row.status];
  const dueLabel = () => {
    if (!row.dueDate) return null;
    if (row.status === 'given') return `${t('given_label')}: ${formatDate(row.immunization?.given_date)}`;
    const d = row.daysUntilDue ?? 0;
    if (d === 0) return t('today');
    if (d > 0) return `${t('in_days')} ${d} ${t('days')}`;
    return `${Math.abs(d)} ${t('days_ago')}`;
  };
  return (
    <View style={[card.container, { borderLeftColor: cfg.color }]}>
      <View style={card.top}>
        <View style={[card.badge, { backgroundColor: cfg.bg }]}>
          <Ionicons name={cfg.icon as any} size={14} color={cfg.color} />
          <Text style={[card.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
        <Text style={card.dose}>{t('dose')} {row.schedule.dose_number}</Text>
      </View>
      <Text style={card.name}>{row.schedule.vaccine_name}</Text>
      <Text style={card.diseases}>{row.schedule.diseases_covered}</Text>
      {dueLabel() && <Text style={[card.due, { color: cfg.color }]}>{dueLabel()}</Text>}
      {row.immunization?.facility && <Text style={card.facility}>📍 {row.immunization.facility}</Text>}
      {row.status !== 'given' && (
        <View style={card.actions}>
          <TouchableOpacity style={card.givenBtn} onPress={() => onMarkGiven(row)}>
            <Ionicons name="checkmark-circle-outline" size={14} color={COLORS.onPrimary} />
            <Text style={card.givenBtnText}>{t('mark_given_today')}</Text>
          </TouchableOpacity>
          {row.status !== 'missed' && (
            <TouchableOpacity style={card.missedBtn} onPress={() => onMarkMissed(row)}>
              <Ionicons name="close-circle-outline" size={14} color={COLORS.missed} />
              <Text style={card.missedBtnText}>{t('mark_missed')}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const FILTERS: { key: VaccineStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' }, { key: 'due', label: 'Due' },
  { key: 'upcoming', label: 'Upcoming' }, { key: 'given', label: 'Given' }, { key: 'missed', label: 'Missed' },
];

export default function VaccinesScreen() {
  const t = useT();
  const router = useRouter();
  const { children, selectedChildId } = useChildStore();
  const { vaccineRows, loading, fetchSchedules, fetchImmunizations, computeRows,
          seedScheduleIfEmpty, markAsGiven, markAsMissed } = useVaccineStore();
  const [filter, setFilter] = useState<VaccineStatus | 'all'>('all');
  const [modalRow, setModalRow] = useState<VaccineRow | null>(null);
  const [saving, setSaving] = useState(false);
  const activeChild = children.find(c => c.id === selectedChildId);

  const load = useCallback(async () => {
    await seedScheduleIfEmpty();
    await fetchSchedules();
    if (activeChild) { await fetchImmunizations(activeChild.id); computeRows(activeChild.date_of_birth); }
  }, [activeChild?.id]);

  useEffect(() => { load(); }, [load]);

  const handleMarkGiven = async (facility: string, date: Date) => {
    if (!modalRow || !activeChild) return;
    setSaving(true);
    try {
      await markAsGiven(modalRow.schedule.id, activeChild.id, facility, date);
      computeRows(activeChild.date_of_birth);
      setModalRow(null);
    } catch (err: any) {
      Platform.OS === 'web' ? window.alert(err?.message ?? t('failed_record')) : Alert.alert('Error', err?.message ?? t('failed_record'));
    } finally { setSaving(false); }
  };

  const handleMarkMissed = (row: VaccineRow) => {
    if (!activeChild) return;
    const confirm = () => {
      markAsMissed(row.schedule.id, activeChild.id)
        .then(() => computeRows(activeChild.date_of_birth))
        .catch((err: any) => { Platform.OS === 'web' ? window.alert(err?.message ?? t('failed_record')) : Alert.alert('Error', err?.message ?? t('failed_record')); });
    };
    Platform.OS === 'web'
      ? (window.confirm(t('mark_missed_confirm')) && confirm())
      : Alert.alert(t('mark_missed_confirm'), t('mark_missed_msg'), [
          { text: t('cancel'), style: 'cancel' },
          { text: t('mark_missed'), style: 'destructive', onPress: confirm },
        ]);
  };

  const filtered = filter === 'all' ? vaccineRows : vaccineRows.filter(r => r.status === filter);

  if (!activeChild) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="shield-outline" size={56} color={COLORS.primaryMid} />
        <Text style={styles.emptyTitle}>{t('no_child_selected')}</Text>
        <Text style={styles.emptySub}>{t('go_to_children')}</Text>
        <TouchableOpacity style={styles.goBtn} onPress={() => router.push('/(tabs)/children' as any)}>
          <Ionicons name="people" size={16} color={COLORS.onPrimary} />
          <Text style={styles.goBtnText}>Go to Children</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MarkGivenModal visible={!!modalRow} row={modalRow} onConfirm={handleMarkGiven} onCancel={() => setModalRow(null)} />
      <View style={styles.header}>
        <Ionicons name="shield" size={22} color={COLORS.onPrimary} />
        <Text style={styles.headerTitle}>{t('kepi_schedule')}</Text>
        {saving && <ActivityIndicator color={COLORS.onPrimary} size="small" />}
      </View>
      <View style={styles.childBanner}>
        <Ionicons name={activeChild.sex === 'female' ? 'female' : 'male'} size={16} color={COLORS.primary} />
        <Text style={styles.childName}>{activeChild.full_name}</Text>
        <Text style={styles.childDob}>· Born {formatDate(activeChild.date_of_birth)}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {FILTERS.map(f => (
          <TouchableOpacity key={f.key} style={[styles.chip, filter === f.key && styles.chipActive]} onPress={() => setFilter(f.key)}>
            <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>
              {f.label}{f.key !== 'all' && ` (${vaccineRows.filter(r => r.status === f.key).length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {loading ? (
        <View style={styles.loadingBox}><ActivityIndicator color={COLORS.primary} size="large" /></View>
      ) : filtered.length === 0 ? (
        <View style={styles.loadingBox}><Text style={styles.emptyText}>{t('no_vaccines_category')}</Text></View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {filtered.map(row => (
            <VaccineCard key={row.schedule.id} row={row} onMarkGiven={setModalRow} onMarkMissed={handleMarkMissed} />
          ))}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: COLORS.background },
  emptyContainer: { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle:     { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginTop: 16, marginBottom: 8 },
  emptySub:       { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  goBtn:          { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  goBtnText:      { color: COLORS.onPrimary, fontWeight: '700', fontSize: 14 },
  header:         { backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingTop: 52, paddingBottom: 16 },
  headerTitle:    { flex: 1, fontSize: 18, fontWeight: '700', color: COLORS.onPrimary },
  childBanner:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: COLORS.primaryLight, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  childName:      { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  childDob:       { fontSize: 12, color: COLORS.textSecondary },
  filterRow:      { maxHeight: 52, paddingVertical: 10 },
  chip:           { paddingHorizontal: 14, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  chipActive:     { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText:       { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  chipTextActive: { color: COLORS.onPrimary },
  loadingBox:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText:      { fontSize: 14, color: COLORS.textMuted },
  list:           { padding: 16, gap: 12 },
});

const card = StyleSheet.create({
  container:     { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 14, borderWidth: 1, borderColor: COLORS.border, borderLeftWidth: 4 },
  top:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  badge:         { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  badgeText:     { fontSize: 11, fontWeight: '700' },
  dose:          { fontSize: 11, color: COLORS.textMuted, fontWeight: '600' },
  name:          { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 2 },
  diseases:      { fontSize: 12, color: COLORS.textSecondary, marginBottom: 4 },
  due:           { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  facility:      { fontSize: 12, color: COLORS.textMuted, marginBottom: 6 },
  actions:       { flexDirection: 'row', gap: 8, marginTop: 8 },
  givenBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: 8 },
  givenBtnText:  { fontSize: 12, fontWeight: '700', color: COLORS.onPrimary },
  missedBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1, borderColor: COLORS.missed, borderRadius: RADIUS.md, paddingVertical: 8, paddingHorizontal: 12 },
  missedBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.missed },
});

const modal = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  card:        { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  title:       { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 2 },
  subtitle:    { fontSize: 13, color: COLORS.textSecondary, marginBottom: 16 },
  label:       { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6, marginTop: 12 },
  input:       { backgroundColor: COLORS.surface, color: COLORS.textPrimary, borderRadius: RADIUS.md, padding: 12, fontSize: 14, borderWidth: 1, borderColor: COLORS.border },
  dateRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: 12, borderWidth: 1, borderColor: COLORS.border },
  dateText:    { fontSize: 14, color: COLORS.textPrimary, fontWeight: '600' },
  btnRow:      { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancelBtn:   { flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  cancelText:  { color: COLORS.textSecondary, fontWeight: '600', fontSize: 15 },
  confirmBtn:  { flex: 2, backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  confirmText: { color: COLORS.onPrimary, fontWeight: '700', fontSize: 15 },
});
