import { COLORS, RADIUS } from '@/lib/theme';
import { useChildStore } from '@/store/childStore';
import { useVaccineStore, VaccineRow, VaccineStatus } from '@/store/vaccineStore';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   Types & constants
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

type StatusCfg = {
  label: string;
  color: string;
  bg: string;
  border: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
};

const STATUS_CONFIG: Record<VaccineStatus, StatusCfg> = {
  given: {
    label: 'Given',
    color: '#0D7A4E',
    bg: '#E8F8F1',
    border: '#A3E4C8',
    icon: 'checkmark-circle',
    accent: '#16A36A',
  },
  missed: {
    label: 'Missed',
    color: '#C0392B',
    bg: '#FDF0EF',
    border: '#F5C0BC',
    icon: 'close-circle',
    accent: '#E74C3C',
  },
  due: {
    label: 'Due Now',
    color: '#B7600A',
    bg: '#FEF6E7',
    border: '#FAD7A0',
    icon: 'alert-circle',
    accent: '#E67E22',
  },
  upcoming: {
    label: 'Upcoming',
    color: '#1A5C9A',
    bg: '#EBF4FD',
    border: '#AED6F1',
    icon: 'time-outline',
    accent: '#2E86C1',
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

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   Helpers
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function formatDate(iso: string | null | undefined): string {
  if (!iso) return 'â€”';
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

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   Inline date picker
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

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

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   Mark / Edit modal
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

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
        setDate(
          row.immunization.given_date
            ? new Date(row.immunization.given_date)
            : new Date(),
        );
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
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={mds.handle} />

        {/* Header stripe */}
        <View style={[mds.headerStripe, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
          <View style={[mds.iconCircle, { backgroundColor: cfg.accent }]}>
            <Ionicons name={cfg.icon} size={22} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={mds.title}>{editMode ? 'Edit Immunization Record' : row.schedule.vaccine_name}</Text>
            <Text style={mds.subtitle}>
              {'Dose ' + row.schedule.dose_number + ' Â· ' + row.schedule.diseases_covered}
            </Text>
          </View>
        </View>

        {/* Date */}
        <Text style={mds.fieldLabel}>Date Given</Text>
        <TouchableOpacity
          style={[mds.dateRow, showPicker && mds.dateRowActive]}
          onPress={() => setShowPicker(p => !p)}
        >
          <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
          <Text style={mds.dateText}>
            {date.toLocaleDateString('en-KE', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </Text>
          <Ionicons
            name={showPicker ? 'chevron-up-outline' : 'chevron-down-outline'}
            size={16}
            color={COLORS.textMuted}
          />
        </TouchableOpacity>
        {showPicker && <InlineDatePicker value={date} onChange={setDate} />}

        {/* Facility */}
        <Text style={mds.fieldLabel}>Health Facility</Text>
        <View style={mds.inputWrapper}>
          <Ionicons name="business-outline" size={17} color={COLORS.textMuted} style={{ marginRight: 8 }} />
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

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   Vaccine card â€” world-class design
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

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

  // Subtle press animation
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () => Animated.spring(scale, { toValue: 0.975, useNativeDriver: true, speed: 50 }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50 }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[vc.card, { borderColor: cfg.border }]}
        onPress={() => isGiven ? onEdit(row) : undefined}
        onPressIn={isGiven ? onPressIn : undefined}
        onPressOut={isGiven ? onPressOut : undefined}
        activeOpacity={isGiven ? 0.9 : 1}
      >
        {/* Colored left accent bar */}
        <View style={[vc.accentBar, { backgroundColor: cfg.accent }]} />

        <View style={vc.body}>
          {/* Top row: status badge + dose */}
          <View style={vc.topRow}>
            <View style={[vc.badge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
              <Ionicons name={cfg.icon} size={12} color={cfg.color} />
              <Text style={[vc.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
            <View style={vc.doseTag}>
              <Text style={vc.doseText}>Dose {row.schedule.dose_number}</Text>
            </View>
          </View>

          {/* Vaccine name */}
          <Text style={vc.name}>{row.schedule.vaccine_name}</Text>

          {/* Diseases */}
          <Text style={vc.diseases} numberOfLines={2}>{row.schedule.diseases_covered}</Text>

          {/* Info row: due date + facility */}
          <View style={vc.infoRow}>
            {dueLabel !== null && (
              <View style={[vc.infoPill, { backgroundColor: cfg.bg }]}>
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

          {/* Notes chip */}
          {row.schedule.notes !== null && (
            <View style={vc.notesChip}>
              <Ionicons name="information-circle-outline" size={12} color={COLORS.textMuted} />
              <Text style={vc.notesText}>{row.schedule.notes}</Text>
            </View>
          )}

          {/* Actions */}
          {isGiven ? (
            <View style={vc.editHint}>
              <Ionicons name="create-outline" size={12} color={cfg.accent} />
              <Text style={[vc.editHintText, { color: cfg.accent }]}>Tap to edit record</Text>
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
                  <Ionicons name="close-circle-outline" size={15} color={STATUS_CONFIG.missed.color} />
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

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   Filter bar
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

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
          return (
            <TouchableOpacity
              key={f.key}
              style={[
                fb.chip,
                isActive && (cfg ? { backgroundColor: cfg.accent, borderColor: cfg.accent } : fb.chipActiveAll),
              ]}
              onPress={() => onChange(f.key)}
              activeOpacity={0.75}
            >
              {f.key !== 'all' && cfg && (
                <View style={[fb.dot, { backgroundColor: isActive ? 'rgba(255,255,255,0.7)' : cfg.accent }]} />
              )}
              <Text style={[fb.label, isActive && fb.labelActive]}>
                {f.label}
              </Text>
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

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   Progress bar
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function ProgressBar({ given, total }: { given: number; total: number }) {
  const pct = total > 0 ? given / total : 0;
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: pct,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [pct]);

  return (
    <View style={pb.container}>
      <View style={pb.track}>
        <Animated.View
          style={[
            pb.fill,
            {
              width: widthAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
      <Text style={pb.label}>
        {given}/{total} completed
      </Text>
    </View>
  );
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   Main screen
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

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

  /* â”€â”€ Handlers â”€â”€ */

  const handleMarkGiven = async (facility: string, date: Date) => {
    if (!modalRow || !activeChild) return;
    setSaving(true);
    try {
      if (editMode && modalRow.immunization?.id) {
        await updateImmunization(
          modalRow.immunization.id,
          activeChild.id,
          facility,
          date,
          activeChild.date_of_birth,
        );
        const fresh = await fetchImmunizations(activeChild.id);
        computeRows(activeChild.date_of_birth, fresh);
      } else {
        await markAsGiven(modalRow.schedule.id, activeChild.id, facility, date, activeChild.date_of_birth);
        const fresh = await fetchImmunizations(activeChild.id);
        computeRows(activeChild.date_of_birth, fresh);
      }
      setModalRow(null);
      setEditMode(false);
    } catch (err: any) {
      const msg = err?.message ?? 'Failed to record';
      Platform.OS === 'web'
        ? window.alert(msg)
        : Alert.alert('Error', msg);
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
          Platform.OS === 'web'
            ? window.alert(err?.message)
            : Alert.alert('Error', err?.message);
        });
    };
    Platform.OS === 'web'
      ? window.confirm('Mark this vaccine as missed?') && doMiss()
      : Alert.alert('Mark as Missed', 'Record this vaccine as missed?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Mark Missed', style: 'destructive', onPress: doMiss },
        ]);
  };

  /* â”€â”€ Stats â”€â”€ */

  const counts = {
    due: vaccineRows.filter(r => r.status === 'due').length,
    upcoming: vaccineRows.filter(r => r.status === 'upcoming').length,
    given: vaccineRows.filter(r => r.status === 'given').length,
    missed: vaccineRows.filter(r => r.status === 'missed').length,
  };

  const filtered = filter === 'all' ? vaccineRows : vaccineRows.filter(r => r.status === filter);

  /* â”€â”€ Empty state â”€â”€ */

  if (!activeChild) {
    return (
      <View style={s.emptyContainer}>
        <View style={s.emptyIconRing}>
          <Ionicons name="shield-outline" size={40} color={COLORS.primary} />
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

  /* â”€â”€ Main UI â”€â”€ */

  return (
    <View style={s.container}>
      <MarkGivenModal
        visible={!!modalRow}
        row={modalRow}
        editMode={editMode}
        onConfirm={handleMarkGiven}
        onCancel={() => { setModalRow(null); setEditMode(false); }}
      />

      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerLabel}>KEPI Schedule</Text>
          <Text style={s.headerSub}>Kenya Expanded Programme on Immunization</Text>
        </View>
        {saving && <ActivityIndicator color="#fff" size="small" />}
      </View>

      {/* Child banner */}
      <View style={s.childBanner}>
        <View style={[s.avatar, { backgroundColor: activeChild.sex === 'female' ? '#FDE8F5' : '#E8F0FD' }]}>
          <Ionicons
            name={activeChild.sex === 'female' ? 'female' : 'male'}
            size={18}
            color={activeChild.sex === 'female' ? '#C0396E' : '#2E5BB5'}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.childName}>{activeChild.full_name}</Text>
          <Text style={s.childDob}>Born {formatDate(activeChild.date_of_birth)}</Text>
        </View>
        <ProgressBar given={counts.given} total={vaccineRows.length} />
      </View>

      {/* Stats row */}
      <View style={s.statsRow}>
        {(
          [
            { key: 'due', label: 'Due', count: counts.due },
            { key: 'upcoming', label: 'Upcoming', count: counts.upcoming },
            { key: 'given', label: 'Given', count: counts.given },
            { key: 'missed', label: 'Missed', count: counts.missed },
          ] as const
        ).map(({ key, label, count }) => {
          const cfg = STATUS_CONFIG[key];
          return (
            <TouchableOpacity
              key={key}
              style={[s.statBox, { backgroundColor: cfg.bg, borderColor: cfg.border }]}
              onPress={() => setFilter(key)}
              activeOpacity={0.8}
            >
              <Text style={[s.statNum, { color: cfg.accent }]}>{count}</Text>
              <Text style={[s.statLabel, { color: cfg.color }]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Filter bar */}
      <FilterBar active={filter} counts={counts} total={vaccineRows.length} onChange={setFilter} />

      {/* List */}
      {loading ? (
        <View style={s.centerBox}>
          <ActivityIndicator color={COLORS.primary} size="large" />
          <Text style={s.loadingText}>Loading immunization scheduleâ€¦</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={s.centerBox}>
          <Ionicons name="checkmark-done-circle-outline" size={52} color={COLORS.primaryMid} />
          <Text style={s.emptyListTitle}>All clear here</Text>
          <Text style={s.emptyListSub}>No vaccines in this category</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
          {filtered.map(row => (
            <VaccineCard
              key={row.schedule.id}
              row={row}
              onMarkGiven={r => { setEditMode(false); setModalRow(r); }}
              onMarkMissed={handleMarkMissed}
              onEdit={r => { setEditMode(true); setModalRow(r); }}
            />
          ))}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}
    </View>
  );
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   Styles
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6FA' },

  // Empty (no child)
  emptyContainer: {
    flex: 1, backgroundColor: '#F4F6FA',
    alignItems: 'center', justifyContent: 'center', padding: 36,
  },
  emptyIconRing: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: '#EBF1FD', alignItems: 'center', justifyContent: 'center',
    marginBottom: 20, borderWidth: 1.5, borderColor: '#C5D8F8',
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#1A202C', marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#718096', textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  goBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: 14,
    paddingHorizontal: 24, paddingVertical: 14,
  },
  goBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Header
  header: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 18,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  headerLabel: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.72)', marginTop: 2 },

  // Child banner
  childBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E8EDF5',
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  childName: { fontSize: 15, fontWeight: '700', color: '#1A202C' },
  childDob: { fontSize: 12, color: '#718096', marginTop: 1 },

  // Stats
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 4,
    gap: 8,
    backgroundColor: '#F4F6FA',
  },
  statBox: {
    flex: 1, borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  statNum: { fontSize: 24, fontWeight: '800', lineHeight: 28 },
  statLabel: { fontSize: 11, fontWeight: '600', marginTop: 3 },

  // List
  list: { paddingHorizontal: 14, paddingTop: 14 },

  // Loading / empty
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 40 },
  loadingText: { fontSize: 14, color: '#718096', marginTop: 8 },
  emptyListTitle: { fontSize: 17, fontWeight: '700', color: '#2D3748', marginTop: 4 },
  emptyListSub: { fontSize: 13, color: '#A0AEC0' },
});

/* Vaccine card */
const vc = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#1A3A6B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  accentBar: { width: 5 },
  body: { flex: 1, padding: 14, paddingLeft: 14 },

  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
  doseTag: {
    backgroundColor: '#F7F8FC', paddingHorizontal: 10,
    paddingVertical: 4, borderRadius: 20,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  doseText: { fontSize: 11, color: '#718096', fontWeight: '600' },

  name: { fontSize: 17, fontWeight: '800', color: '#1A202C', marginBottom: 3, letterSpacing: -0.2 },
  diseases: { fontSize: 12, color: '#718096', lineHeight: 18, marginBottom: 10 },

  infoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  infoPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: 20,
  },
  infoPillText: { fontSize: 11, fontWeight: '700' },
  facilityPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: 20, backgroundColor: '#F7F8FC',
    maxWidth: 160,
  },
  facilityText: { fontSize: 11, color: '#718096', flex: 1 },

  notesChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#F7F8FC', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 5,
    marginBottom: 8,
  },
  notesText: { fontSize: 11, color: '#A0AEC0', flex: 1 },

  actions: { flexDirection: 'row', gap: 8, marginTop: 2 },
  primaryBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 6,
    borderRadius: 12, paddingVertical: 11,
  },
  primaryBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 5,
    borderWidth: 1.5, borderColor: STATUS_CONFIG.missed.border,
    borderRadius: 12, paddingVertical: 11, paddingHorizontal: 16,
  },
  secondaryBtnText: { fontSize: 13, fontWeight: '700', color: STATUS_CONFIG.missed.color },

  editHint: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4,
  },
  editHintText: { fontSize: 12, fontWeight: '600' },
});

/* Filter bar */
const fb = StyleSheet.create({
  wrapper: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E8EDF5',
    paddingVertical: 10,
  },
  row: { paddingHorizontal: 14, gap: 8, flexDirection: 'row', alignItems: 'center' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, backgroundColor: '#F7F8FC',
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  chipActiveAll: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { fontSize: 13, fontWeight: '600', color: '#4A5568' },
  labelActive: { color: '#fff', fontWeight: '700' },
  countBadge: {
    backgroundColor: '#E2E8F0', borderRadius: 10,
    paddingHorizontal: 6, paddingVertical: 1, minWidth: 20, alignItems: 'center',
  },
  countBadgeActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  countText: { fontSize: 11, fontWeight: '700', color: '#718096' },
  countTextActive: { color: '#fff' },
});

/* Progress bar */
const pb = StyleSheet.create({
  container: { alignItems: 'flex-end', gap: 3 },
  track: {
    width: 72, height: 6, borderRadius: 3,
    backgroundColor: '#E8EDF5', overflow: 'hidden',
  },
  fill: {
    height: '100%', borderRadius: 3,
    backgroundColor: STATUS_CONFIG.given.accent,
  },
  label: { fontSize: 10, color: '#A0AEC0', fontWeight: '600' },
});

/* Inline date picker */
const ip = StyleSheet.create({
  wrapper: {
    backgroundColor: '#F7F8FC', borderRadius: 14, padding: 14,
    marginTop: 8, marginBottom: 8,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  label: {
    fontSize: 11, fontWeight: '700', color: '#A0AEC0',
    marginTop: 10, marginBottom: 6, letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  row: { flexDirection: 'row', gap: 6 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: '#4A5568' },
  chipTextActive: { color: '#fff', fontWeight: '700' },
});

/* Modal */
const mds = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(10,20,50,0.55)', justifyContent: 'flex-end' },
  webOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    zIndex: 999, backgroundColor: 'rgba(10,20,50,0.55)',
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
  headerStripe: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 14, borderRadius: 16, borderWidth: 1,
    marginBottom: 20,
  },
  iconCircle: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: '800', color: '#1A202C', letterSpacing: -0.2 },
  subtitle: { fontSize: 12, color: '#718096', marginTop: 2 },

  fieldLabel: {
    fontSize: 12, fontWeight: '700', color: '#A0AEC0',
    marginBottom: 8, marginTop: 16,
    letterSpacing: 0.4, textTransform: 'uppercase',
  },
  dateRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#F7F8FC', borderRadius: 14,
    padding: 14, borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  dateRowActive: { borderColor: COLORS.primary },
  dateText: { flex: 1, fontSize: 15, color: '#1A202C', fontWeight: '600' },

  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F7F8FC', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 2,
    borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  input: { flex: 1, fontSize: 15, color: '#1A202C', paddingVertical: 12 },

  btnRow: { flexDirection: 'row', gap: 12, marginTop: 28, marginBottom: 8 },
  cancelBtn: {
    flex: 1, backgroundColor: '#F7F8FC', borderRadius: 14,
    paddingVertical: 15, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  cancelText: { color: '#718096', fontWeight: '700', fontSize: 15 },
  confirmBtn: {
    flex: 2, borderRadius: 14, paddingVertical: 15,
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8,
  },
  confirmText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});