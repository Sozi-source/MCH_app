import { COLORS, RADIUS } from '@/lib/theme';
import { useChildStore } from '@/store/childStore';
import { useVaccineStore, VaccineRow, VaccineStatus } from '@/store/vaccineStore';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
function toTitleCase(str: string): string { return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()); }

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

/* ─────────────────────────────────────────────
   Types & constants
───────────────────────────────────────────── */

type StatusCfg = {
  label: string;
  color: string;
  bg: string;
  border: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  emoji: string;
};

const STATUS_CONFIG: Record<VaccineStatus, StatusCfg> = {
  given: {
    label: 'Given',
    color: '#0D7A4E',
    bg: '#E8F8F1',
    border: '#A3E4C8',
    icon: 'checkmark-circle',
    accent: '#1D9E75',
    emoji: '✅',
  },
  missed: {
    label: 'Missed',
    color: '#C0392B',
    bg: '#FDF0EF',
    border: '#F5C0BC',
    icon: 'close-circle',
    accent: '#E24B4A',
    emoji: '⚠️',
  },
  due: {
    label: 'Due Now',
    color: '#B7600A',
    bg: '#FEF6E7',
    border: '#FAD7A0',
    icon: 'alert-circle',
    accent: '#BA7517',
    emoji: '🔔',
  },
  upcoming: {
    label: 'Upcoming',
    color: '#3D36A8',
    bg: '#EEEDF9',
    border: '#C5C2ED',
    icon: 'time-outline',
    accent: '#534AB7',
    emoji: '📅',
  },
};

const FILTER_OPTIONS: { key: VaccineStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'due', label: 'Due' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'given', label: 'Given' },
  { key: 'missed', label: 'Missed' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-KE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getDueLabel(row: VaccineRow): string | null {
  if (!row.dueDate) return null;
  if (row.status === 'given') return formatDate(row.immunization?.given_date);
  const d = row.daysUntilDue ?? 0;
  if (d === 0) return 'Due today';
  if (d > 0) return `In ${d} day${d === 1 ? '' : 's'}`;
  return `${Math.abs(d)} day${Math.abs(d) === 1 ? '' : 's'} overdue`;
}

/* ─────────────────────────────────────────────
   Inline date picker
───────────────────────────────────────────── */

function InlineDatePicker({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => currentYear - i);
  const [selYear, setSelYear] = useState(value.getFullYear());
  const [selMonth, setSelMonth] = useState(value.getMonth());
  const [selDay, setSelDay] = useState(value.getDate());

  const daysInMonth = new Date(selYear, selMonth + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const commit = (y: number, m: number, d: number) => {
    const safeDay = Math.min(d, new Date(y, m + 1, 0).getDate());
    onChange(new Date(y, m, safeDay));
  };

  return (
    <View style={ip.wrapper}>
      {(['Year', 'Month', 'Day'] as const).map((label, idx) => {
        const items = idx === 0 ? years : idx === 1 ? MONTHS : days;
        const selVal = idx === 0 ? selYear : idx === 1 ? selMonth : selDay;
        return (
          <View key={label}>
            <Text style={ip.label}>{label}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={ip.row}>
                {(items as (number | string)[]).map((item, i) => {
                  const val = idx === 1 ? i : item;
                  const active = val === selVal;
                  return (
                    <TouchableOpacity
                      key={String(item)}
                      style={[ip.chip, active && ip.chipActive]}
                      onPress={() => {
                        if (idx === 0) { setSelYear(item as number); commit(item as number, selMonth, selDay); }
                        if (idx === 1) { setSelMonth(i); commit(selYear, i, selDay); }
                        if (idx === 2) { setSelDay(item as number); commit(selYear, selMonth, item as number); }
                      }}
                    >
                      <Text style={[ip.chipText, active && ip.chipTextActive]}>{item}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        );
      })}
    </View>
  );
}

/* ─────────────────────────────────────────────
   Mark / Edit modal — premium sheet
───────────────────────────────────────────── */

function MarkGivenModal({
  visible, row, onConfirm, onCancel, editMode,
}: {
  visible: boolean;
  row: VaccineRow | null;
  editMode?: boolean;
  onConfirm: (facility: string, date: Date) => void;
  onCancel: () => void;
}) {
  const [facility, setFacility] = useState('');
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    if (visible) {
      if (editMode && row?.immunization) {
        setFacility(row.immunization.facility ?? '');
        setDate(row.immunization.given_date ? new Date(row.immunization.given_date) : new Date());
      } else {
        setFacility('');
        setDate(new Date());
      }
      setShowPicker(false);
    }
  }, [visible, editMode, row]);

  if (!row) return null;

  const cfg = STATUS_CONFIG[row.status];

  const content = (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={mds.card}
        contentContainerStyle={{ paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={mds.handle} />

        {/* Vaccine identity hero */}
        <View style={[mds.heroStripe, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
          {/* Decorative circle */}
          <View style={[mds.heroCircle, { borderColor: cfg.border }]} />
          <View style={[mds.iconCircle, { backgroundColor: cfg.accent }]}>
            <Ionicons name={cfg.icon} size={22} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <View style={mds.heroTopRow}>
              <Text style={mds.heroEmoji}>{cfg.emoji}</Text>
              <View style={[mds.heroBadge, { backgroundColor: cfg.accent }]}>
                <Text style={mds.heroBadgeText}>{cfg.label}</Text>
              </View>
            </View>
            <Text style={mds.title}>{editMode ? 'Edit Immunization Record' : row.schedule.vaccine_name}</Text>
            <Text style={mds.subtitle}>
              {'Dose ' + row.schedule.dose_number + ' · ' + row.schedule.diseases_covered}
            </Text>
          </View>
        </View>

        {/* Info tip */}
        <View style={mds.infoTip}>
          <Ionicons name="information-circle-outline" size={15} color={COLORS.primary} />
          <Text style={mds.infoTipText}>
            {editMode
              ? 'Update the vaccination details below.'
              : 'Enter the date and facility where this vaccine was administered.'}
          </Text>
        </View>

        {/* Date */}
        <Text style={mds.fieldLabel}>📅 Date Given</Text>
        <TouchableOpacity
          style={[mds.dateRow, showPicker && mds.dateRowActive]}
          onPress={() => setShowPicker(p => !p)}
        >
          <View style={mds.dateIconWrap}>
            <Ionicons name="calendar-outline" size={17} color={COLORS.primary} />
          </View>
          <Text style={mds.dateText}>
            {date.toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })}
          </Text>
          <Ionicons
            name={showPicker ? 'chevron-up-outline' : 'chevron-down-outline'}
            size={16}
            color={COLORS.textMuted}
          />
        </TouchableOpacity>
        {showPicker && <InlineDatePicker value={date} onChange={setDate} />}

        {/* Facility */}
        <Text style={mds.fieldLabel}>🏥 Health Facility</Text>
        <View style={mds.inputWrapper}>
          <View style={mds.inputIconWrap}>
            <Ionicons name="business-outline" size={17} color={COLORS.primary} />
          </View>
          <TextInput
            style={mds.input}
            value={facility}
            onChangeText={setFacility}
            placeholder="e.g. Kenyatta National Hospital"
            placeholderTextColor={COLORS.textMuted}
          />
        </View>

        {/* Buttons */}
        <View style={mds.btnRow}>
          <TouchableOpacity style={mds.cancelBtn} onPress={onCancel}>
            <Text style={mds.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[mds.confirmBtn, { backgroundColor: cfg.accent }]}
            onPress={() => onConfirm(facility, date)}
          >
            <Ionicons name={editMode ? 'save-outline' : 'checkmark-circle-outline'} size={18} color="#fff" />
            <Text style={mds.confirmText}>{editMode ? 'Save Changes' : 'Mark as Given'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  if (Platform.OS === 'web') {
    if (!visible) return null;
    return <View style={mds.webOverlay}>{content}</View>;
  }
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={mds.overlay}>{content}</View>
    </Modal>
  );
}

/* ─────────────────────────────────────────────
   Vaccine card — premium
───────────────────────────────────────────── */

function VaccineCard({
  row, onMarkGiven, onMarkMissed, onEdit,
}: {
  row: VaccineRow;
  onMarkGiven: (row: VaccineRow) => void;
  onMarkMissed: (row: VaccineRow) => void;
  onEdit: (row: VaccineRow) => void;
}) {
  const cfg = STATUS_CONFIG[row.status];
  const dueLabel = getDueLabel(row);
  const facility = row.immunization?.facility ?? null;
  const isGiven = row.status === 'given';
  const isMissed = row.status === 'missed';

  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () =>
    Animated.spring(scale, { toValue: 0.972, useNativeDriver: true, speed: 50 }).start();
  const onPressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50 }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[vc.card, { borderColor: cfg.border }]}
        onPress={() => (isGiven ? onEdit(row) : undefined)}
        onPressIn={isGiven ? onPressIn : undefined}
        onPressOut={isGiven ? onPressOut : undefined}
        activeOpacity={isGiven ? 0.9 : 1}
      >
        {/* Bold left accent bar */}
        <View style={[vc.accentBar, { backgroundColor: cfg.accent }]} />

        <View style={vc.body}>
          {/* Top row */}
          <View style={vc.topRow}>
            <View style={[vc.badge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
              <Text style={vc.badgeEmoji}>{cfg.emoji}</Text>
              <Ionicons name={cfg.icon} size={11} color={cfg.color} />
              <Text style={[vc.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
            <View style={[vc.doseTag, { borderColor: cfg.border }]}>
              <Text style={[vc.doseText, { color: cfg.color }]}>Dose {row.schedule.dose_number}</Text>
            </View>
          </View>

          {/* Vaccine name */}
          <Text style={vc.name}>{row.schedule.vaccine_name}</Text>

          {/* Diseases */}
          <Text style={vc.diseases} numberOfLines={2}>{row.schedule.diseases_covered}</Text>

          {/* Divider */}
          <View style={vc.divider} />

          {/* Info row */}
          <View style={vc.infoRow}>
            {dueLabel !== null && (
              <View style={[vc.infoPill, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
                <Ionicons
                  name={isGiven ? 'checkmark-circle-outline' : 'calendar-outline'}
                  size={11}
                  color={cfg.color}
                />
                <Text style={[vc.infoPillText, { color: cfg.color }]}>{dueLabel}</Text>
              </View>
            )}
            {facility !== null && (
              <View style={vc.facilityPill}>
                <Ionicons name="business-outline" size={11} color={COLORS.textMuted} />
                <Text style={vc.facilityText} numberOfLines={1}>{facility}</Text>
              </View>
            )}
          </View>

          {/* Notes */}
          {row.schedule.notes !== null && (
            <View style={vc.notesChip}>
              <Ionicons name="information-circle-outline" size={12} color={COLORS.primary} />
              <Text style={vc.notesText}>{row.schedule.notes}</Text>
            </View>
          )}

          {/* Actions */}
          {isGiven ? (
            <View style={[vc.editHint, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
              <Ionicons name="create-outline" size={13} color={cfg.accent} />
              <Text style={[vc.editHintText, { color: cfg.accent }]}>Tap card to edit record</Text>
            </View>
          ) : (
            <View style={vc.actions}>
              <TouchableOpacity
                style={[vc.primaryBtn, { backgroundColor: cfg.accent }]}
                onPress={() => onMarkGiven(row)}
                activeOpacity={0.85}
              >
                <Ionicons name="checkmark-circle-outline" size={15} color="#fff" />
                <Text style={vc.primaryBtnText}>Mark Given</Text>
              </TouchableOpacity>
              {!isMissed && (
                <TouchableOpacity
                  style={vc.secondaryBtn}
                  onPress={() => onMarkMissed(row)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="close-circle-outline" size={15} color={STATUS_CONFIG.missed.accent} />
                  <Text style={vc.secondaryBtnText}>Missed</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

/* ─────────────────────────────────────────────
   Filter bar — premium chips
───────────────────────────────────────────── */

function FilterBar({
  active, counts, total, onChange,
}: {
  active: VaccineStatus | 'all';
  counts: Record<VaccineStatus, number>;
  total: number;
  onChange: (k: VaccineStatus | 'all') => void;
}) {
  return (
    <View style={fb.wrapper}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={fb.row}>
        {FILTER_OPTIONS.map(f => {
          const isActive = active === f.key;
          const count = f.key === 'all' ? total : counts[f.key as VaccineStatus];
          const cfg = f.key !== 'all' ? STATUS_CONFIG[f.key as VaccineStatus] : null;
          const activeBg = cfg ? cfg.accent : COLORS.primary;
          return (
            <TouchableOpacity
              key={f.key}
              style={[
                fb.chip,
                isActive && { backgroundColor: activeBg, borderColor: activeBg },
              ]}
              onPress={() => onChange(f.key)}
              activeOpacity={0.75}
            >
              {f.key !== 'all' && cfg && (
                <Text style={fb.emoji}>{cfg.emoji}</Text>
              )}
              {f.key === 'all' && (
                <Ionicons
                  name="apps-outline"
                  size={13}
                  color={isActive ? '#fff' : COLORS.textSecondary}
                />
              )}
              <Text style={[fb.label, isActive && fb.labelActive]}>{f.label}</Text>
              <View style={[fb.countBadge, isActive && fb.countBadgeActive]}>
                <Text style={[fb.countText, isActive && fb.countTextActive]}>{count}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

/* ─────────────────────────────────────────────
   Circular progress ring
───────────────────────────────────────────── */

function CircleProgress({ given, total }: { given: number; total: number }) {
  const pct = total > 0 ? given / total : 0;
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: pct,
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, [pct]);

  const pctInt = Math.round(pct * 100);

  return (
    <View style={cp.wrap}>
      {/* Track */}
      <View style={cp.track}>
        {/* Fill bar */}
        <Animated.View
          style={[
            cp.fill,
            {
              width: widthAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
      <View style={cp.labels}>
        <Text style={cp.pct}>{pctInt}%</Text>
        <Text style={cp.sub}>{given}/{total} done</Text>
      </View>
    </View>
  );
}

/* ─────────────────────────────────────────────
   Main screen
───────────────────────────────────────────── */

export default function VaccinesScreen() {
  const router = useRouter();
  const { children, selectedChildId } = useChildStore();
  const {
    vaccineRows, loading,
    fetchSchedules, fetchImmunizations, computeRows,
    seedScheduleIfEmpty, markAsGiven, markAsMissed, updateImmunization,
  } = useVaccineStore();

  const [filter, setFilter] = useState<VaccineStatus | 'all'>('all');
  const [modalRow, setModalRow] = useState<VaccineRow | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  const activeChild = children.find(c => c.id === selectedChildId) ?? children[0];

  const load = useCallback(async () => {
    await seedScheduleIfEmpty();
    await fetchSchedules();
    if (activeChild) {
      const fresh = await fetchImmunizations(activeChild.id);
      computeRows(activeChild.date_of_birth, fresh);
    }
  }, [activeChild?.id]);

  useEffect(() => { load(); }, [load]);

  /* Handlers */
  const handleMarkGiven = async (facility: string, date: Date) => {
    if (!modalRow || !activeChild) return;
    setSaving(true);
    try {
      if (editMode && modalRow.immunization?.id) {
        await updateImmunization(
          modalRow.immunization.id, activeChild.id, facility, date, activeChild.date_of_birth,
        );
      } else {
        await markAsGiven(modalRow.schedule.id, activeChild.id, facility, date, activeChild.date_of_birth);
      }
      const fresh = await fetchImmunizations(activeChild.id);
      computeRows(activeChild.date_of_birth, fresh);
      setModalRow(null);
      setEditMode(false);
    } catch (err: any) {
      const msg = err?.message ?? 'Failed to record';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleMarkMissed = (row: VaccineRow) => {
    if (!activeChild) return;
    const doMiss = () => {
      markAsMissed(row.schedule.id, activeChild.id, activeChild.date_of_birth)
        .then(async () => {
          const fresh = await fetchImmunizations(activeChild.id);
          computeRows(activeChild.date_of_birth, fresh);
        })
        .catch((err: any) => {
          Platform.OS === 'web' ? window.alert(err?.message) : Alert.alert('Error', err?.message);
        });
    };
    Platform.OS === 'web'
      ? window.confirm('Mark this vaccine as missed?') && doMiss()
      : Alert.alert('Mark as Missed', 'Record this vaccine as missed?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Mark Missed', style: 'destructive', onPress: doMiss },
        ]);
  };

  /* Stats */
  const counts = {
    due: vaccineRows.filter(r => r.status === 'due').length,
    upcoming: vaccineRows.filter(r => r.status === 'upcoming').length,
    given: vaccineRows.filter(r => r.status === 'given').length,
    missed: vaccineRows.filter(r => r.status === 'missed').length,
  };
  const filtered = filter === 'all' ? vaccineRows : vaccineRows.filter(r => r.status === filter);

  /* No child */
  if (!activeChild) {
    return (
      <View style={s.emptyContainer}>
        <View style={s.emptyIconRing}>
          <Text style={{ fontSize: 36 }}>💉</Text>
        </View>
        <Text style={s.emptyTitle}>No child selected</Text>
        <Text style={s.emptySub}>Go to the Children tab to select or add a child first.</Text>
        <TouchableOpacity style={s.goBtn} onPress={() => router.push('/(tabs)/children' as any)}>
          <Ionicons name="people-outline" size={16} color="#fff" />
          <Text style={s.goBtnText}>Go to Children</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isFemale = activeChild.sex === 'female';

  return (
    <View style={s.container}>
      <MarkGivenModal
        visible={!!modalRow}
        row={modalRow}
        editMode={editMode}
        onConfirm={handleMarkGiven}
        onCancel={() => { setModalRow(null); setEditMode(false); }}
      />

      {/* ── HERO HEADER ── */}
      <View style={s.header}>
        {/* Decorative circles */}
        <View style={s.heroDeco1} />
        <View style={s.heroDeco2} />

        <View style={s.headerTop}>
          <View>
            <Text style={s.headerEyebrow}>Kenya KEPI Schedule 💉</Text>
            <Text style={s.headerTitle}>Immunizations</Text>
            <Text style={s.headerSub}>Kenya Expanded Programme on Immunization</Text>
          </View>
          {saving
            ? <ActivityIndicator color="rgba(255,255,255,0.8)" size="small" />
            : (
              <View style={s.headerIconWrap}>
                <Ionicons name="shield-checkmark" size={22} color="rgba(255,255,255,0.9)" />
              </View>
            )}
        </View>

        {/* Child strip inside hero */}
        <View style={s.childStrip}>
          <View style={[s.avatar, { backgroundColor: isFemale ? '#FDE8F5' : '#E8F0FD' }]}>
            <Text style={{ fontSize: 18 }}>{isFemale ? '👧' : '👦'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.childName}>{toTitleCase(activeChild.full_name)}</Text>
            <Text style={s.childDob}>Born {formatDate(activeChild.date_of_birth)}</Text>
          </View>
          <CircleProgress given={counts.given} total={vaccineRows.length} />
        </View>
      </View>

      {/* ── STATS ROW ── */}
      <View style={s.statsRow}>
        {(
          [
            { key: 'due' as VaccineStatus, label: 'Due', icon: 'alert-circle' as const },
            { key: 'upcoming' as VaccineStatus, label: 'Upcoming', icon: 'time-outline' as const },
            { key: 'given' as VaccineStatus, label: 'Given', icon: 'checkmark-circle' as const },
            { key: 'missed' as VaccineStatus, label: 'Missed', icon: 'close-circle' as const },
          ]
        ).map(({ key, label, icon }) => {
          const cfg = STATUS_CONFIG[key];
          const isActive = filter === key;
          return (
            <TouchableOpacity
              key={key}
              style={[
                s.statCard,
                { backgroundColor: isActive ? cfg.accent : '#fff', borderColor: isActive ? cfg.accent : cfg.border },
              ]}
              onPress={() => setFilter(key)}
              activeOpacity={0.8}
            >
              <View style={[s.statIconWrap, { backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : cfg.bg }]}>
                <Ionicons name={icon} size={16} color={isActive ? '#fff' : cfg.accent} />
              </View>
              <Text style={[s.statNum, { color: isActive ? '#fff' : cfg.accent }]}>
                {counts[key]}
              </Text>
              <Text style={[s.statLabel, { color: isActive ? 'rgba(255,255,255,0.85)' : cfg.color }]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── FILTER BAR ── */}
      <FilterBar active={filter} counts={counts} total={vaccineRows.length} onChange={setFilter} />

      {/* ── LIST ── */}
      {loading ? (
        <View style={s.centerBox}>
          <View style={s.loadingIconWrap}>
            <ActivityIndicator color={COLORS.primary} size="large" />
          </View>
          <Text style={s.loadingText}>Loading immunization schedule…</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={s.centerBox}>
          <View style={s.emptyListIconWrap}>
            <Text style={{ fontSize: 40 }}>✅</Text>
          </View>
          <Text style={s.emptyListTitle}>All clear here</Text>
          <Text style={s.emptyListSub}>No vaccines in this category</Text>
          <TouchableOpacity style={s.resetBtn} onPress={() => setFilter('all')}>
            <Text style={s.resetBtnText}>View all vaccines</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
        >
          {/* Section label */}
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>
              {filter === 'all'
                ? `All Vaccines`
                : `${STATUS_CONFIG[filter as VaccineStatus].label} · ${filtered.length}`}
            </Text>
            {filter !== 'all' && (
              <TouchableOpacity onPress={() => setFilter('all')}>
                <Text style={s.sectionAction}>See all</Text>
              </TouchableOpacity>
            )}
          </View>

          {filtered.map(row => (
            <VaccineCard
              key={row.schedule.id}
              row={row}
              onMarkGiven={r => { setEditMode(false); setModalRow(r); }}
              onMarkMissed={handleMarkMissed}
              onEdit={r => { setEditMode(true); setModalRow(r); }}
            />
          ))}
          <View style={{ height: 140 }} />
        </ScrollView>
      )}
    </View>
  );
}

/* ─────────────────────────────────────────────
   Styles
───────────────────────────────────────────── */

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4F8' },

  /* Empty — no child */
  emptyContainer: {
    flex: 1, backgroundColor: '#F0F4F8',
    alignItems: 'center', justifyContent: 'center', padding: 36,
  },
  emptyIconRing: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: '#E6F4FE', alignItems: 'center', justifyContent: 'center',
    marginBottom: 20, borderWidth: 2, borderColor: '#90C5F7',
  },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: '#1A202C', marginBottom: 10 },
  emptySub: { fontSize: 14, color: '#4A5568', textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  goBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#208AEF', borderRadius: 16,
    paddingHorizontal: 28, paddingVertical: 15,
    ...Platform.select({ ios: { shadowColor: '#208AEF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 }, android: { elevation: 6 }, default: {} }), elevation: 6,
  },
  goBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  /* Hero header */
  header: {
    backgroundColor: '#208AEF',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 20,
    overflow: 'hidden',
  },
  heroDeco1: {
    position: 'absolute', width: 220, height: 220, borderRadius: 110,
    borderWidth: 40, borderColor: 'rgba(255,255,255,0.06)',
    top: -60, right: -60,
  },
  heroDeco2: {
    position: 'absolute', width: 130, height: 130, borderRadius: 65,
    borderWidth: 24, borderColor: 'rgba(255,255,255,0.05)',
    bottom: 20, left: -30,
  },
  headerTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 18,
  },
  headerEyebrow: {
    fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '700',
    letterSpacing: 0.4, marginBottom: 4,
  },
  headerTitle: {
    fontSize: 28, fontWeight: '800', color: '#fff',
    letterSpacing: -0.5, lineHeight: 32,
  },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 4 },
  headerIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },

  /* Child strip (inside hero) */
  childStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 16, padding: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)',
  },
  childName: { fontSize: 15, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
  childDob: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  /* Stats */
  statsRow: {
    flexDirection: 'row', paddingHorizontal: 16, paddingTop: 18,
    paddingBottom: 6, gap: 10,
  },
  statCard: {
    flex: 1, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 6,
    alignItems: 'center', borderWidth: 1.5,
    ...Platform.select({ ios: { shadowColor: '#1A3A6B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 }, android: { elevation: 6 }, default: {} }), elevation: 2,
  },
  statIconWrap: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  statNum: { fontSize: 22, fontWeight: '800', lineHeight: 26 },
  statLabel: { fontSize: 11, fontWeight: '700', marginTop: 2 },

  /* Filter bar */
  /* (styles in fb object below) */

  /* Section header */
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#1A202C' },
  sectionAction: { fontSize: 13, fontWeight: '700', color: '#208AEF' },

  /* List */
  list: { paddingHorizontal: 16, paddingTop: 16 },

  /* Loading / empty */
  centerBox: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40,
  },
  loadingIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#E6F4FE', alignItems: 'center', justifyContent: 'center',
  },
  loadingText: { fontSize: 14, color: '#718096', marginTop: 4, fontWeight: '500' },
  emptyListIconWrap: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: '#E8F8F1', alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  emptyListTitle: { fontSize: 20, fontWeight: '800', color: '#1A202C' },
  emptyListSub: { fontSize: 13, color: '#A0AEC0', fontWeight: '500' },
  resetBtn: {
    marginTop: 8, backgroundColor: '#208AEF', borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  resetBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});

/* Vaccine card */
const vc = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',

    ...Platform.select({

      ios: { shadowColor: '#1A3A6B', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 10 },

      android: { elevation: 8 },

      default: {},

    }),
    elevation: 3,
  },
  accentBar: { width: 5 },
  body: { flex: 1, padding: 14 },

  topRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 8,
  },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1,
  },
  badgeEmoji: { fontSize: 11 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  doseTag: {
    backgroundColor: '#F7F8FC', paddingHorizontal: 10,
    paddingVertical: 5, borderRadius: 20,
    borderWidth: 1,
  },
  doseText: { fontSize: 11, fontWeight: '700' },

  name: { fontSize: 17, fontWeight: '800', color: '#1A202C', marginBottom: 3, letterSpacing: -0.3 },
  diseases: { fontSize: 12, color: '#718096', lineHeight: 18, marginBottom: 10 },

  divider: {
    height: 1, backgroundColor: '#F0F4F8', marginBottom: 10,
  },

  infoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  infoPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1,
  },
  infoPillText: { fontSize: 11, fontWeight: '700' },
  facilityPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: 20, backgroundColor: '#F7F8FC',
    borderWidth: 1, borderColor: '#E2E8F0', maxWidth: 160,
  },
  facilityText: { fontSize: 11, color: '#718096', flex: 1 },

  notesChip: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: '#E6F4FE', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 6,
    marginBottom: 10, borderLeftWidth: 3, borderLeftColor: '#208AEF',
  },
  notesText: { fontSize: 11, color: '#4A5568', flex: 1, lineHeight: 16 },

  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  primaryBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 6,
    borderRadius: 12, paddingVertical: 12,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4 }, android: { elevation: 6 }, default: {} }), elevation: 2,
  },
  primaryBtnText: { fontSize: 13, fontWeight: '800', color: '#fff' },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    borderWidth: 1.5, borderColor: STATUS_CONFIG.missed.border,
    borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16,
  },
  secondaryBtnText: { fontSize: 13, fontWeight: '700', color: STATUS_CONFIG.missed.accent },

  editHint: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 6, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1,
  },
  editHintText: { fontSize: 12, fontWeight: '700' },
});

/* Filter bar */
const fb = StyleSheet.create({
  wrapper: {
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
    paddingVertical: 12,
    ...Platform.select({ ios: { shadowColor: '#1A3A6B', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 }, android: { elevation: 6 }, default: {} }), elevation: 1,
  },
  row: { paddingHorizontal: 16, gap: 8, flexDirection: 'row', alignItems: 'center' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 9999, backgroundColor: '#fff',
    borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  emoji: { fontSize: 12 },
  label: { fontSize: 13, fontWeight: '700', color: '#4A5568' },
  labelActive: { color: '#fff' },
  countBadge: {
    backgroundColor: '#F0F4F8', borderRadius: 10,
    paddingHorizontal: 6, paddingVertical: 1, minWidth: 20, alignItems: 'center',
  },
  countBadgeActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  countText: { fontSize: 11, fontWeight: '700', color: '#718096' },
  countTextActive: { color: '#fff' },
});

/* Circle progress */
const cp = StyleSheet.create({
  wrap: { alignItems: 'flex-end', gap: 4, minWidth: 80 },
  track: {
    width: 80, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden',
  },
  fill: {
    height: '100%', borderRadius: 3,
    backgroundColor: '#fff',
  },
  labels: { alignItems: 'flex-end' },
  pct: { fontSize: 14, fontWeight: '800', color: '#fff' },
  sub: { fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
});

/* Inline date picker */
const ip = StyleSheet.create({
  wrapper: {
    backgroundColor: '#F7F8FC', borderRadius: 14, padding: 14,
    marginTop: 8, marginBottom: 8,
    borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  label: {
    fontSize: 11, fontWeight: '700', color: '#A0AEC0',
    marginTop: 10, marginBottom: 6, letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  row: { flexDirection: 'row', gap: 6 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 9999,
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  chipActive: { backgroundColor: '#208AEF', borderColor: '#208AEF' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#4A5568' },
  chipTextActive: { color: '#fff', fontWeight: '800' },
});

/* Modal */
const mds = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(10,20,50,0.6)', justifyContent: 'flex-end' },
  webOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    zIndex: 999, backgroundColor: 'rgba(10,20,50,0.6)',
  },
  card: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 22, paddingTop: 12,
    maxHeight: '92%',
  },
  handle: {
    width: 44, height: 4, borderRadius: 2,
    backgroundColor: '#E2E8F0', alignSelf: 'center', marginBottom: 20,
  },

  /* Vaccine hero strip */
  heroStripe: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 16, borderRadius: 20, borderWidth: 1.5,
    marginBottom: 16, overflow: 'hidden', position: 'relative',
  },
  heroCircle: {
    position: 'absolute', width: 100, height: 100, borderRadius: 50,
    borderWidth: 20, right: -20, bottom: -30,
  },
  iconCircle: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4 }, android: { elevation: 6 }, default: {} }), elevation: 3,
  },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  heroEmoji: { fontSize: 16 },
  heroBadge: {
    borderRadius: 9999, paddingHorizontal: 8, paddingVertical: 3,
  },
  heroBadgeText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  title: { fontSize: 17, fontWeight: '800', color: '#1A202C', letterSpacing: -0.2 },
  subtitle: { fontSize: 12, color: '#718096', marginTop: 2, lineHeight: 17 },

  /* Info tip */
  infoTip: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#E6F4FE', borderRadius: 12, padding: 12,
    borderLeftWidth: 3, borderLeftColor: '#208AEF', marginBottom: 4,
  },
  infoTipText: { flex: 1, fontSize: 12, color: '#4A5568', lineHeight: 17, fontWeight: '500' },

  fieldLabel: {
    fontSize: 12, fontWeight: '800', color: '#1A202C',
    marginBottom: 8, marginTop: 18, letterSpacing: 0.2,
  },
  dateRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#F7F8FC', borderRadius: 14,
    padding: 14, borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  dateRowActive: { borderColor: '#208AEF', backgroundColor: '#F0F8FF' },
  dateIconWrap: {
    width: 32, height: 32, borderRadius: 9, backgroundColor: '#E6F4FE',
    alignItems: 'center', justifyContent: 'center',
  },
  dateText: { flex: 1, fontSize: 15, color: '#1A202C', fontWeight: '700' },

  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F7F8FC', borderRadius: 14,
    paddingLeft: 10, paddingRight: 14,
    borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  inputIconWrap: {
    width: 32, height: 32, borderRadius: 9, backgroundColor: '#E6F4FE',
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  input: { flex: 1, fontSize: 15, color: '#1A202C', paddingVertical: 14, fontWeight: '500' },

  btnRow: { flexDirection: 'row', gap: 12, marginTop: 28, marginBottom: 8 },
  cancelBtn: {
    flex: 1, backgroundColor: '#F7F8FC', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  cancelText: { color: '#718096', fontWeight: '800', fontSize: 15 },
  confirmBtn: {
    flex: 2, borderRadius: 14, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 }, android: { elevation: 6 }, default: {} }), elevation: 4,
  },
  confirmText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});