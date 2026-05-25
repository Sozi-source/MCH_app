// src/app/(tabs)/growth.tsx
// mamaTOTO — Growth Tracker Screen

import { useT } from '@/hooks/useT';
import { COLORS, RADIUS } from '@/lib/theme';
import { calculateZScores } from '@/lib/zscore';
import { getZScoreAlerts, getZScoreDisplay, ActiveAlert } from '@/lib/nutritionData';
import { GrowthRecord, useChildStore } from '@/store/childStore';
import { Ionicons } from '@expo/vector-icons';
import GrowthCharts from '@/components/GrowthCharts';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// ── Helpers ──────────────────────────────────────────────────────────────────

function toTitleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function getAgeMonthsFromDates(dob: string, measureDate: Date): number {
  const birth = new Date(dob);
  return (
    (measureDate.getFullYear() - birth.getFullYear()) * 12 +
    (measureDate.getMonth() - birth.getMonth())
  );
}

function formatDate(d: Date) {
  return d.toLocaleDateString('en-KE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatShort(iso: string) {
  return new Date(iso).toLocaleDateString('en-KE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function getZLabel(z: number | null): { label: string; color: string; bg: string } {
  if (z === null) return { label: 'N/A',          color: COLORS.textMuted, bg: '#F0F4F8' };
  if (z < -3)     return { label: 'Severely low', color: '#A32D2D',        bg: '#FCEBEB' };
  if (z < -2)     return { label: 'Low',          color: '#854F0B',        bg: '#FAEEDA' };
  if (z > 3)      return { label: 'Obese',        color: '#7B3FA0',        bg: '#F3E8FC' };
  if (z > 2)      return { label: 'High',         color: '#185FA5',        bg: '#E6F1FB' };
  return           { label: 'Normal',             color: '#0F6E56',        bg: '#E1F5EE' };
}

// ── InlineDatePicker ──────────────────────────────────────────────────────────

function InlineDatePicker({
  value,
  onChange,
}: {
  value: Date;
  onChange: (d: Date) => void;
}) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => currentYear - i);
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
    <View style={dp.wrapper}>
      <Text style={dp.rowLabel}>Year</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={dp.chipRow}>
          {years.map((y) => (
            <TouchableOpacity
              key={y}
              style={[dp.chip, selYear === y && dp.chipActive]}
              onPress={() => { setSelYear(y); commit(y, selMonth, selDay); }}
            >
              <Text style={[dp.chipText, selYear === y && dp.chipTextActive]}>{y}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <Text style={dp.rowLabel}>Month</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={dp.chipRow}>
          {MONTHS.map((m, i) => (
            <TouchableOpacity
              key={m}
              style={[dp.chip, selMonth === i && dp.chipActive]}
              onPress={() => { setSelMonth(i); commit(selYear, i, selDay); }}
            >
              <Text style={[dp.chipText, selMonth === i && dp.chipTextActive]}>{m}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <Text style={dp.rowLabel}>Day</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={dp.chipRow}>
          {days.map((d) => (
            <TouchableOpacity
              key={d}
              style={[dp.chip, dp.dayChip, selDay === d && dp.chipActive]}
              onPress={() => { setSelDay(d); commit(selYear, selMonth, d); }}
            >
              <Text style={[dp.chipText, selDay === d && dp.chipTextActive]}>{d}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

// ── ZScoreAlertBanner ─────────────────────────────────────────────────────────

function ZScoreAlertBanner({ alerts }: { alerts: ActiveAlert[] }) {
  if (alerts.length === 0) return null;
  const isUrgent    = alerts[0].urgency === 'urgent';
  const accentColor = isUrgent ? '#A32D2D' : '#854F0B';
  const badgeLabel  = isUrgent ? 'URGENT'  : 'MONITOR';

  return (
    <View style={[ab.card, { borderLeftColor: accentColor }]}>
      <View style={ab.headerRow}>
        <View style={[ab.iconCircle, { backgroundColor: isUrgent ? '#FCEBEB' : '#FAEEDA' }]}>
          <Ionicons
            name={isUrgent ? 'alert-circle' : 'warning'}
            size={16}
            color={accentColor}
          />
        </View>
        <Text style={[ab.headerTitle, { color: accentColor }]}>
          {isUrgent ? 'Action Required' : 'Monitoring Needed'}
        </Text>
        <View style={[ab.urgencyPill, { backgroundColor: accentColor }]}>
          <Text style={ab.urgencyPillText}>{badgeLabel}</Text>
        </View>
      </View>

      {alerts.map((alert, i) => (
        <View
          key={i}
          style={[ab.alertRow, { backgroundColor: isUrgent ? '#FCEBEB' : '#FAEEDA' }]}
        >
          <View style={[ab.indicatorBadge, { backgroundColor: accentColor }]}>
            <Text style={ab.indicatorText}>{alert.indicator}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[ab.classification, { color: accentColor }]}>
              {alert.classification}
            </Text>
            <Text style={ab.action}>{alert.action}</Text>
          </View>
        </View>
      ))}

      <View style={ab.sourceRow}>
        <Ionicons name="shield-checkmark" size={11} color="#2A9D6E" />
        <Text style={ab.sourceText}>
          Kenya IMAM Guidelines 2019 · WHO Child Growth Standards
        </Text>
      </View>
    </View>
  );
}

// ── LatestStatusBanner ────────────────────────────────────────────────────────

function LatestStatusBanner({ records }: { records: GrowthRecord[] }) {
  if (records.length === 0) return null;
  const latest = records[0];
  const alerts = getZScoreAlerts(latest.waz, latest.haz, latest.whz, latest.age_months);

  if (alerts.length === 0) {
    return (
      <View style={s.allGoodBanner}>
        <View style={s.allGoodIconCircle}>
          <Ionicons name="checkmark-circle" size={18} color="#0F6E56" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.allGoodTitle}>All measurements normal</Text>
          <Text style={s.allGoodSub}>WHO Child Growth Standards</Text>
        </View>
      </View>
    );
  }
  return <ZScoreAlertBanner alerts={alerts} />;
}

// ── RecordCard — entire card tappable to edit ─────────────────────────────────

function RecordCard({
  rec,
  isLatest,
  isEditing,
  onEdit,
}: {
  rec: GrowthRecord;
  isLatest: boolean;
  isEditing: boolean;
  onEdit: (rec: GrowthRecord) => void;
}) {
  const t = useT();
  const alerts = getZScoreAlerts(rec.waz, rec.haz, rec.whz, rec.age_months);
  const zScores: [string, number | null][] = [
    ['WAZ', rec.waz],
    ['HAZ', rec.haz],
    ['WHZ', rec.whz],
  ];

  return (
    <TouchableOpacity
      style={[rc.card, isLatest && rc.cardLatest, isEditing && rc.cardEditing]}
      onPress={() => onEdit(rec)}
      activeOpacity={0.75}
    >
      {/* Badges row */}
      <View style={rc.badgesRow}>
        {isLatest && (
          <View style={rc.latestBadge}>
            <Ionicons name="star" size={10} color={COLORS.onPrimary} />
            <Text style={rc.latestBadgeText}>Latest</Text>
          </View>
        )}
        {isEditing && (
          <View style={rc.editingBadge}>
            <Ionicons name="create" size={10} color="#0F6E56" />
            <Text style={rc.editingBadgeText}>Editing</Text>
          </View>
        )}
        <View style={{ flex: 1 }} />
        <View style={rc.tapHint}>
          <Ionicons name="create-outline" size={12} color={COLORS.textMuted} />
          <Text style={rc.tapHintText}>Tap to edit</Text>
        </View>
      </View>

      {/* Header */}
      <View style={rc.header}>
        <View style={rc.agePill}>
          <Text style={rc.agePillText}>{rec.age_months} mo</Text>
        </View>
        <View style={rc.dateRow}>
          <Ionicons name="calendar-outline" size={12} color={COLORS.textMuted} />
          <Text style={rc.dateText}>{formatShort(rec.date)}</Text>
        </View>
      </View>

      {/* Measurements */}
      <View style={rc.measureRow}>
        <View style={rc.measureBlock}>
          <View style={rc.measureIconWrap}>
            <Ionicons name="scale-outline" size={16} color="#185FA5" />
          </View>
          <Text style={rc.measureVal}>{rec.weight_kg} kg</Text>
          <Text style={rc.measureLabel}>{t('weight_label')}</Text>
        </View>
        {rec.height_cm ? (
          <>
            <View style={rc.measureDivider} />
            <View style={rc.measureBlock}>
              <View style={[rc.measureIconWrap, { backgroundColor: '#E1F5EE' }]}>
                <Ionicons name="resize-outline" size={16} color="#0F6E56" />
              </View>
              <Text style={rc.measureVal}>{rec.height_cm} cm</Text>
              <Text style={rc.measureLabel}>{t('height_label')}</Text>
            </View>
          </>
        ) : null}
      </View>

      {/* Z-score chips */}
      <View style={rc.zRow}>
        {zScores.map(([label, val]) => {
          const info = getZScoreDisplay(val);
          return (
            <View key={label} style={[rc.zChip, { backgroundColor: info.bg }]}>
              <Text style={rc.zChipLabel}>{label}</Text>
              <Text style={[rc.zChipVal, { color: info.color }]}>
                {val !== null ? val.toFixed(1) : 'N/A'}
              </Text>
              <Text style={[rc.zChipStatus, { color: info.color }]}>{info.label}</Text>
            </View>
          );
        })}
      </View>

      {alerts.length > 0 && (
        <View style={{ marginTop: 10 }}>
          <ZScoreAlertBanner alerts={alerts} />
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── EditModal — full-height bottom sheet with KeyboardAvoidingView ─────────────

function EditModal({
  visible,
  rec,
  ageMonths,
  weight,
  height,
  measureDate,
  showPicker,
  loading,
  onWeightChange,
  onHeightChange,
  onDateToggle,
  onDateChange,
  onSubmit,
  onCancel,
}: {
  visible: boolean;
  rec: GrowthRecord | null;
  ageMonths: number;
  weight: string;
  height: string;
  measureDate: Date;
  showPicker: boolean;
  loading: boolean;
  onWeightChange: (v: string) => void;
  onHeightChange: (v: string) => void;
  onDateToggle: () => void;
  onDateChange: (d: Date) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  if (!visible || !rec) return null;

  return (
    <View style={em.overlay}>
      <TouchableOpacity style={em.backdrop} onPress={onCancel} activeOpacity={1} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={em.kavWrapper}
        keyboardVerticalOffset={0}
      >
        <View style={em.sheet}>
          {/* Handle bar */}
          <View style={em.handle} />

          {/* Header — always visible, outside ScrollView */}
          <View style={em.sheetHeader}>
            <View style={em.sheetHeaderIcon}>
              <Ionicons name="create-outline" size={18} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={em.sheetTitle}>Edit measurement</Text>
              <Text style={em.sheetSub}>Recorded at {rec.age_months} months old</Text>
            </View>
            <TouchableOpacity onPress={onCancel} style={em.closeBtn}>
              <Ionicons name="close" size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Scrollable body */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={em.scrollContent}
          >
            {/* Date */}
            <Text style={em.label}>Measurement Date</Text>
            <TouchableOpacity
              style={em.dateBtn}
              onPress={onDateToggle}
              activeOpacity={0.8}
            >
              <View style={em.dateBtnIcon}>
                <Ionicons name="calendar" size={16} color={COLORS.primary} />
              </View>
              <Text style={em.dateBtnText}>{formatDate(measureDate)}</Text>
              <Ionicons
                name={showPicker ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={COLORS.textMuted}
              />
            </TouchableOpacity>
            {showPicker && (
              <InlineDatePicker value={measureDate} onChange={onDateChange} />
            )}

            {/* Age (read-only) */}
            <Text style={em.label}>{t('age_months')}</Text>
            <View style={em.readonlyRow}>
              <Ionicons name="lock-closed-outline" size={13} color={COLORS.textMuted} />
              <Text style={em.readonlyText}>
                {ageMonths >= 0
                  ? `${ageMonths} months - auto-calculated`
                  : 'Invalid - before birth date'}
              </Text>
            </View>

            {/* Weight */}
            <Text style={em.label}>{t('weight_kg')} *</Text>
            <View style={em.inputWrap}>
              <View style={[em.inputIcon, { backgroundColor: '#E6F1FB' }]}>
                <Ionicons name="scale-outline" size={15} color="#185FA5" />
              </View>
              <TextInput
                style={em.input}
                value={weight}
                onChangeText={onWeightChange}
                placeholder={t('weight_placeholder')}
                placeholderTextColor={COLORS.textMuted}
                keyboardType="decimal-pad"
                autoFocus
              />
            </View>

            {/* Height */}
            <Text style={em.label}>{t('height_cm')}</Text>
            <View style={em.inputWrap}>
              <View style={[em.inputIcon, { backgroundColor: '#E1F5EE' }]}>
                <Ionicons name="resize-outline" size={15} color="#0F6E56" />
              </View>
              <TextInput
                style={em.input}
                value={height}
                onChangeText={onHeightChange}
                placeholder={t('height_placeholder')}
                placeholderTextColor={COLORS.textMuted}
                keyboardType="decimal-pad"
              />
            </View>

            {/* Save button */}
            <TouchableOpacity
              style={[em.saveBtn, loading && { opacity: 0.7 }]}
              onPress={onSubmit}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.onPrimary} size="small" />
              ) : (
                <Ionicons
                  name="checkmark-circle-outline"
                  size={18}
                  color={COLORS.onPrimary}
                />
              )}
              <Text style={em.saveBtnText}>
                {loading ? t('calculating') : 'Save changes'}
              </Text>
            </TouchableOpacity>

            {/* Cancel button */}
            <TouchableOpacity
              style={em.cancelBtn}
              onPress={onCancel}
              activeOpacity={0.8}
            >
              <Ionicons name="close-circle-outline" size={16} color={COLORS.textSecondary} />
              <Text style={em.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            {/* Safe area spacer */}
            <View style={{ height: 32 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ── AddMeasurementForm ────────────────────────────────────────────────────────

function AddMeasurementForm({
  ageMonths,
  weight,
  height,
  measureDate,
  showPicker,
  loading,
  onWeightChange,
  onHeightChange,
  onDateToggle,
  onDateChange,
  onSubmit,
}: {
  ageMonths: number;
  weight: string;
  height: string;
  measureDate: Date;
  showPicker: boolean;
  loading: boolean;
  onWeightChange: (v: string) => void;
  onHeightChange: (v: string) => void;
  onDateToggle: () => void;
  onDateChange: (d: Date) => void;
  onSubmit: () => void;
}) {
  const t = useT();

  return (
    <View style={fm.card}>
      <View style={fm.titleRow}>
        <View style={fm.titleIcon}>
          <Ionicons name="add-circle" size={16} color={COLORS.primary} />
        </View>
        <Text style={fm.title}>{t('add_measurement')}</Text>
      </View>

      <Text style={fm.label}>Measurement Date</Text>
      <TouchableOpacity style={fm.dateBtn} onPress={onDateToggle} activeOpacity={0.8}>
        <View style={fm.dateBtnIcon}>
          <Ionicons name="calendar" size={16} color={COLORS.primary} />
        </View>
        <Text style={fm.dateBtnText}>{formatDate(measureDate)}</Text>
        <Ionicons
          name={showPicker ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={COLORS.textMuted}
        />
      </TouchableOpacity>
      {showPicker && (
        <InlineDatePicker value={measureDate} onChange={onDateChange} />
      )}

      <Text style={fm.label}>{t('age_months')}</Text>
      <View style={fm.readonlyRow}>
        <Ionicons name="lock-closed-outline" size={13} color={COLORS.textMuted} />
        <Text style={fm.readonlyText}>
          {ageMonths >= 0
            ? `${ageMonths} months - auto-calculated`
            : 'Invalid - before birth date'}
        </Text>
      </View>

      <Text style={fm.label}>{t('weight_kg')} *</Text>
      <View style={fm.inputWrap}>
        <View style={[fm.inputIcon, { backgroundColor: '#E6F1FB' }]}>
          <Ionicons name="scale-outline" size={15} color="#185FA5" />
        </View>
        <TextInput
          style={fm.input}
          value={weight}
          onChangeText={onWeightChange}
          placeholder={t('weight_placeholder')}
          placeholderTextColor={COLORS.textMuted}
          keyboardType="decimal-pad"
        />
      </View>

      <Text style={fm.label}>{t('height_cm')}</Text>
      <View style={fm.inputWrap}>
        <View style={[fm.inputIcon, { backgroundColor: '#E1F5EE' }]}>
          <Ionicons name="resize-outline" size={15} color="#0F6E56" />
        </View>
        <TextInput
          style={fm.input}
          value={height}
          onChangeText={onHeightChange}
          placeholder={t('height_placeholder')}
          placeholderTextColor={COLORS.textMuted}
          keyboardType="decimal-pad"
        />
      </View>

      <TouchableOpacity
        style={[fm.submitBtn, loading && { opacity: 0.7 }]}
        onPress={onSubmit}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.onPrimary} size="small" />
        ) : (
          <Ionicons name="save-outline" size={18} color={COLORS.onPrimary} />
        )}
        <Text style={fm.submitText}>
          {loading ? t('calculating') : t('calculate_save')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function GrowthScreen() {
  const t      = useT();
  const router = useRouter();
  const {
    children,
    selectedChildId,
    growthRecords,
    fetchGrowthRecords,
    addGrowthRecord,
    updateGrowthRecord,
  } = useChildStore();

  const activeChild = children.find((c) => c.id === selectedChildId) ?? children[0];

  const [weight,        setWeight]        = useState('');
  const [height,        setHeight]        = useState('');
  const [loading,       setLoading]       = useState(false);
  const [showForm,      setShowForm]      = useState(false);
  const [showPicker,    setShowPicker]    = useState(false);
  const [measureDate,   setMeasureDate]   = useState(new Date());
  const [editRecord,    setEditRecord]    = useState<GrowthRecord | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const scrollRef = useRef<ScrollView>(null);

  const ageMonths = activeChild
    ? getAgeMonthsFromDates(activeChild.date_of_birth, measureDate)
    : 0;

  useEffect(() => {
    if (activeChild?.id) fetchGrowthRecords(activeChild.id);
  }, [activeChild?.id]);

  const handleEdit = (rec: GrowthRecord) => {
    setEditRecord(rec);
    setWeight(String(rec.weight_kg));
    setHeight(rec.height_cm ? String(rec.height_cm) : '');
    setMeasureDate(new Date(rec.date));
    setShowPicker(false);
    setShowEditModal(true);
  };

  const handleCancel = () => {
    setEditRecord(null);
    setWeight('');
    setHeight('');
    setMeasureDate(new Date());
    setShowPicker(false);
    setShowEditModal(false);
  };

  const handleSubmit = async (isEdit: boolean) => {
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
        ? window.alert("Measurement date is before the child's birth date.")
        : Alert.alert('Invalid date', 'Measurement date is before birth date.');
      return;
    }

    setLoading(true);
    try {
      const zscores = await calculateZScores(w, h, ageMonths, activeChild.sex);
      const recordData = {
        child_id:   activeChild.id,
        weight_kg:  w,
        height_cm:  h,
        age_months: ageMonths,
        waz:        zscores.waz,
        haz:        zscores.haz,
        whz:        zscores.whz,
        date:       measureDate.toISOString().split('T')[0],
      };

      if (isEdit && editRecord) {
        await updateGrowthRecord(editRecord.id, recordData);
        setShowEditModal(false);
        setEditRecord(null);
      } else {
        await addGrowthRecord(recordData);
        setShowForm(false);
        setShowPicker(false);
      }

      setWeight('');
      setHeight('');
      setMeasureDate(new Date());

      const newAlerts = getZScoreAlerts(zscores.waz, zscores.haz, zscores.whz);
      if (newAlerts.length > 0 && newAlerts[0].urgency === 'urgent') {
        const msg = newAlerts
          .map((a) => `${a.indicator}: ${a.classification}\n${a.action}`)
          .join('\n\n');
        Platform.OS === 'web'
          ? window.alert('Action Required\n\n' + msg)
          : Alert.alert('Action Required', msg, [{ text: 'Understood' }]);
      } else {
        Platform.OS === 'web'
          ? window.alert(t('growth_saved'))
          : Alert.alert(t('saved'), t('growth_saved'));
      }
    } catch {
      Platform.OS === 'web'
        ? window.alert(t('failed_save'))
        : Alert.alert('Error', t('failed_save'));
    } finally {
      setLoading(false);
    }
  };

  // ── No child selected ────────────────────────────────────────────────────

  if (!activeChild) {
    return (
      <View style={s.container}>
        <View style={s.hero}>
          <View style={s.heroDecor} />
          <View style={s.heroDecor2} />
          <View style={s.heroTop}>
            <View style={s.heroIconCircle}>
              <Ionicons name="trending-up" size={22} color={COLORS.onPrimary} />
            </View>
            <View>
              <Text style={s.heroTitle}>Growth Tracker</Text>
              <Text style={s.heroSub}>WHO-standard z-score monitoring</Text>
            </View>
          </View>
        </View>
        <View style={s.emptyWrap}>
          <View style={s.emptyIconCircle}>
            <Ionicons name="people-outline" size={52} color={COLORS.primaryMid} />
          </View>
          <Text style={s.emptyTitle}>{t('no_child_selected')}</Text>
          <Text style={s.emptySub}>{t('go_to_children')}</Text>
          <TouchableOpacity
            style={s.emptyBtn}
            onPress={() => router.push('/(tabs)/children')}
          >
            <Ionicons name="people" size={16} color={COLORS.onPrimary} />
            <Text style={s.emptyBtnText}>Go to Children</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isFemale = activeChild.sex === 'female';

  // ── Main render ──────────────────────────────────────────────────────────

  return (
    <View style={s.container}>
      {/* Hero */}
      <View style={s.hero}>
        <View style={s.heroDecor} />
        <View style={s.heroDecor2} />
        <View style={s.heroTop}>
          <View style={s.heroIconCircle}>
            <Ionicons name="trending-up" size={20} color={COLORS.onPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.heroTitle}>Growth Tracker</Text>
            <Text style={s.heroSub}>WHO-standard z-score monitoring</Text>
          </View>
          <TouchableOpacity
            style={s.heroAddBtn}
            activeOpacity={0.8}
            onPress={() => { setShowForm((f) => !f); setShowPicker(false); }}
          >
            <Ionicons name={showForm ? 'close' : 'add'} size={20} color={COLORS.onPrimary} />
          </TouchableOpacity>
        </View>

        <View style={s.heroPill}>
          <View
            style={[
              s.heroPillAvatar,
              {
                backgroundColor: isFemale
                  ? 'rgba(255,214,234,0.3)'
                  : 'rgba(189,217,247,0.3)',
              },
            ]}
          >
            <Ionicons
              name={isFemale ? 'female' : 'male'}
              size={14}
              color={COLORS.onPrimary}
            />
          </View>
          <View>
            <Text style={s.heroPillName}>{toTitleCase(activeChild.full_name)}</Text>
            <Text style={s.heroPillAge}>
              {getAgeMonthsFromDates(activeChild.date_of_birth, new Date())} months old
            </Text>
          </View>
          <View style={s.heroPillRecordsBadge}>
            <Text style={s.heroPillRecordsText}>
              {growthRecords.length} record{growthRecords.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
      </View>

      {/* Main scrollable content */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Child switcher */}
        {children.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.switcherRow}
          >
            {children.map((c) => {
              const active = c.id === activeChild.id;
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[s.switcherChip, active && s.switcherChipActive]}
                  onPress={() => useChildStore.getState().selectChild(c.id)}
                >
                  <Ionicons
                    name={c.sex === 'female' ? 'female' : 'male'}
                    size={13}
                    color={active ? COLORS.onPrimary : COLORS.textMuted}
                  />
                  <Text
                    style={[
                      s.switcherChipText,
                      active && s.switcherChipTextActive,
                    ]}
                  >
                    {c.full_name.split(' ')[0]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        <LatestStatusBanner records={growthRecords} />

        {/* Add form */}
        {showForm && (
          <AddMeasurementForm
            ageMonths={ageMonths}
            weight={weight}
            height={height}
            measureDate={measureDate}
            showPicker={showPicker}
            loading={loading}
            onWeightChange={setWeight}
            onHeightChange={setHeight}
            onDateToggle={() => setShowPicker((p) => !p)}
            onDateChange={(d) => setMeasureDate(d)}
            onSubmit={() => handleSubmit(false)}
          />
        )}

        {/* Quick stats */}
        {growthRecords.length > 0 &&
          (() => {
            const latest = growthRecords[0];
            const wazInfo = getZLabel(latest.waz);
            return (
              <View style={s.statsRow}>
                <View style={s.statCard}>
                  <View style={[s.statIcon, { backgroundColor: '#E6F1FB' }]}>
                    <Ionicons name="scale-outline" size={18} color="#185FA5" />
                  </View>
                  <Text style={s.statVal}>{latest.weight_kg} kg</Text>
                  <Text style={s.statLabel}>Weight</Text>
                </View>
                {latest.height_cm ? (
                  <View style={s.statCard}>
                    <View style={[s.statIcon, { backgroundColor: '#E1F5EE' }]}>
                      <Ionicons name="resize-outline" size={18} color="#0F6E56" />
                    </View>
                    <Text style={s.statVal}>{latest.height_cm} cm</Text>
                    <Text style={s.statLabel}>Height</Text>
                  </View>
                ) : null}
                <View style={s.statCard}>
                  <View style={[s.statIcon, { backgroundColor: wazInfo.bg }]}>
                    <Ionicons name="pulse-outline" size={18} color={wazInfo.color} />
                  </View>
                  <Text style={[s.statVal, { color: wazInfo.color }]}>
                    {latest.waz !== null
                      ? latest.waz > 0
                        ? `+${latest.waz.toFixed(1)}`
                        : latest.waz.toFixed(1)
                      : '--'}
                  </Text>
                  <Text style={s.statLabel}>WAZ</Text>
                </View>
              </View>
            );
          })()}

        {/* Charts */}
        <View style={s.sectionHeader}>
          <View style={s.sectionIconWrap}>
            <Ionicons name="analytics-outline" size={15} color={COLORS.primary} />
          </View>
          <Text style={s.sectionTitle}>Growth Charts</Text>
          <View style={s.whoBadge}>
            <Ionicons name="shield-checkmark" size={10} color="#2A9D6E" />
            <Text style={s.whoBadgeText}>WHO Reference</Text>
          </View>
        </View>
        <View style={s.chartsCard}>
          <GrowthCharts
            records={growthRecords}
            sex={activeChild.sex}
            childName={toTitleCase(activeChild.full_name)}
          />
        </View>

        {/* History */}
        <View style={s.sectionHeader}>
          <View style={s.sectionIconWrap}>
            <Ionicons name="time-outline" size={15} color={COLORS.primary} />
          </View>
          <Text style={s.sectionTitle}>{t('history')}</Text>
          {growthRecords.length > 0 && (
            <Text style={s.sectionCount}>
              {growthRecords.length} record{growthRecords.length !== 1 ? 's' : ''}
            </Text>
          )}
        </View>

        {growthRecords.length > 0 && (
          <View style={s.editHintBanner}>
            <Ionicons name="finger-print-outline" size={14} color={COLORS.primary} />
            <Text style={s.editHintText}>Tap any record card to edit it</Text>
          </View>
        )}

        {growthRecords.length === 0 ? (
          <View style={s.emptyRecords}>
            <View style={s.emptyRecordsIcon}>
              <Ionicons name="bar-chart-outline" size={48} color={COLORS.primaryMid} />
            </View>
            <Text style={s.emptyRecordsTitle}>{t('no_records')}</Text>
            <Text style={s.emptyRecordsSub}>
              Tap the + button to add your child's first measurement
            </Text>
            <TouchableOpacity
              style={s.emptyRecordsBtn}
              onPress={() => setShowForm(true)}
            >
              <Ionicons name="add-circle-outline" size={16} color={COLORS.onPrimary} />
              <Text style={s.emptyRecordsBtnText}>Add First Measurement</Text>
            </TouchableOpacity>
          </View>
        ) : (
          growthRecords.map((rec, i) => (
            <RecordCard
              key={rec.id}
              rec={rec}
              isLatest={i === 0}
              isEditing={editRecord?.id === rec.id && showEditModal}
              onEdit={handleEdit}
            />
          ))
        )}

        {/* Bottom scroll spacer — enough room for FAB + tab bar */}
        <View style={{ height: 160 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={[
          s.fab,
          Platform.OS === 'web' ? s.fabWeb : s.fabNative,
          showForm && s.fabClose,
        ]}
        onPress={() => { setShowForm((f) => !f); setShowPicker(false); }}
        activeOpacity={0.88}
      >
        <Ionicons name={showForm ? 'close' : 'add'} size={28} color={COLORS.onPrimary} />
      </TouchableOpacity>

      {/* Edit Modal — rendered last so it sits on top of everything */}
      <EditModal
        visible={showEditModal}
        rec={editRecord}
        ageMonths={ageMonths}
        weight={weight}
        height={height}
        measureDate={measureDate}
        showPicker={showPicker}
        loading={loading}
        onWeightChange={setWeight}
        onHeightChange={setHeight}
        onDateToggle={() => setShowPicker((p) => !p)}
        onDateChange={(d) => setMeasureDate(d)}
        onSubmit={() => handleSubmit(true)}
        onCancel={handleCancel}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  hero: {
    backgroundColor: COLORS.primary,
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 22,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  heroDecor: {
    position: 'absolute', width: 220, height: 220, borderRadius: 110,
    borderWidth: 44, borderColor: 'rgba(255,255,255,0.07)', bottom: -70, right: -50,
  },
  heroDecor2: {
    position: 'absolute', width: 110, height: 110, borderRadius: 55,
    borderWidth: 24, borderColor: 'rgba(255,255,255,0.05)', top: 20, left: -18,
  },
  heroTop:        { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  heroIconCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroTitle:  { fontSize: 22, fontWeight: '800', color: COLORS.onPrimary },
  heroSub:    { fontSize: 12, color: 'rgba(255,255,255,0.72)', marginTop: 2, fontWeight: '500' },
  heroAddBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },

  heroPill: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 10,
  },
  heroPillAvatar: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
  },
  heroPillName:         { fontSize: 14, fontWeight: '700', color: COLORS.onPrimary },
  heroPillAge:          { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 1 },
  heroPillRecordsBadge: {
    marginLeft: 'auto', backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4,
  },
  heroPillRecordsText:  { fontSize: 11, fontWeight: '700', color: COLORS.onPrimary },

  scroll:      { paddingHorizontal: 16, paddingTop: 16 },
  switcherRow: { flexDirection: 'row', gap: 8, paddingBottom: 14 },
  switcherChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: RADIUS.full, backgroundColor: COLORS.white,
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  switcherChipActive:     { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  switcherChipText:       { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  switcherChipTextActive: { color: COLORS.onPrimary },

  allGoodBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#E1F5EE', borderRadius: RADIUS.lg, padding: 14, marginBottom: 14,
    borderWidth: 1, borderColor: '#A8DEC8',
  },
  allGoodIconCircle: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#C3ECD9', alignItems: 'center', justifyContent: 'center',
  },
  allGoodTitle: { fontSize: 14, fontWeight: '700', color: '#0F6E56' },
  allGoodSub:   { fontSize: 11, color: '#2A9D6E', marginTop: 2, fontStyle: 'italic' },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  statCard: {
    flex: 1, backgroundColor: COLORS.white, borderRadius: RADIUS.xl,
    padding: 12, alignItems: 'center',
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6 },
      android: { elevation: 5 },
      default: {},
    }),
  },
  statIcon:  {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  statVal:   { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary },
  statLabel: { fontSize: 10, fontWeight: '600', color: COLORS.textMuted, marginTop: 3 },

  sectionHeader:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, marginTop: 4 },
  sectionIconWrap:{
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  sectionTitle:   { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary, flex: 1 },
  sectionCount:   { fontSize: 12, color: COLORS.textMuted, fontWeight: '600' },
  whoBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#E1F5EE', borderRadius: RADIUS.full,
    paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: '#A8DEC8',
  },
  whoBadgeText: { fontSize: 10, fontWeight: '700', color: '#2A9D6E' },

  chartsCard: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.xl, padding: 12, marginBottom: 18,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8 },
      android: { elevation: 6 },
      default: {},
    }),
  },
  editHintBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10,
  },
  editHintText: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },

  emptyWrap:       { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIconCircle: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 8 },
  emptySub:   { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  emptyBtn:   {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.full,
    paddingHorizontal: 24, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  emptyBtnText: { color: COLORS.onPrimary, fontWeight: '700', fontSize: 14 },

  emptyRecords:     { alignItems: 'center', paddingVertical: 32, gap: 10 },
  emptyRecordsIcon: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  emptyRecordsTitle:   { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary },
  emptyRecordsSub:     { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },
  emptyRecordsBtn:     {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.full,
    paddingHorizontal: 22, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4,
  },
  emptyRecordsBtnText: { color: COLORS.onPrimary, fontWeight: '700', fontSize: 14 },

  fab: {
    position: 'absolute', right: 20, width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.22, shadowRadius: 10 },
      android: { elevation: 6 },
      default: {},
    }),
  },
  fabNative: { bottom: 158 },
  fabWeb:    { bottom: 76 },
  fabClose:  { backgroundColor: '#C0392B' },
});

const dp = StyleSheet.create({
  wrapper: {
    backgroundColor: COLORS.background, borderRadius: RADIUS.lg, padding: 12,
    marginTop: 8, marginBottom: 4, borderWidth: 1, borderColor: COLORS.border,
  },
  rowLabel: {
    fontSize: 11, fontWeight: '700', color: COLORS.textSecondary,
    marginTop: 10, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  chipRow:        { flexDirection: 'row', gap: 8 },
  chip:           {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full,
    backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border,
  },
  dayChip:        { paddingHorizontal: 10, minWidth: 38, alignItems: 'center' },
  chipActive:     { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText:       { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  chipTextActive: { color: COLORS.onPrimary, fontWeight: '700' },
});

const ab = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border, borderLeftWidth: 4,
    padding: 14, marginBottom: 12,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 },
      android: { elevation: 6 },
      default: {},
    }),
  },
  headerRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  iconCircle:      { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  headerTitle:     { flex: 1, fontSize: 14, fontWeight: '800' },
  urgencyPill:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  urgencyPillText: { color: COLORS.white, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  alertRow: {
    borderRadius: RADIUS.md, padding: 12, marginBottom: 6,
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
  },
  indicatorBadge:  { paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.sm, marginTop: 1 },
  indicatorText:   { color: COLORS.white, fontSize: 11, fontWeight: '800' },
  classification:  { fontSize: 13, fontWeight: '700', marginBottom: 3 },
  action:          { fontSize: 12, color: COLORS.textPrimary, lineHeight: 18 },
  sourceRow:       { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  sourceText:      { fontSize: 10, color: '#2A9D6E', fontStyle: 'italic', fontWeight: '600' },
});

const rc = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.xl, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: COLORS.border,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8 },
      android: { elevation: 6 },
      default: {},
    }),
  },
  cardLatest:      { borderColor: COLORS.primary, borderWidth: 2 },
  cardEditing:     { borderColor: '#0F6E56', borderWidth: 2, backgroundColor: '#F8FFFC' },
  badgesRow:       { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  latestBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full,
  },
  latestBadgeText: { color: COLORS.onPrimary, fontSize: 10, fontWeight: '700' },
  editingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#E1F5EE', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: RADIUS.full, borderWidth: 1, borderColor: '#A8DEC8',
  },
  editingBadgeText: { color: '#0F6E56', fontSize: 10, fontWeight: '700' },
  tapHint:          { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tapHintText:      { fontSize: 11, color: COLORS.textMuted, fontWeight: '500' },
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  agePill:    {
    backgroundColor: COLORS.primaryLight, paddingHorizontal: 12,
    paddingVertical: 5, borderRadius: RADIUS.full,
  },
  agePillText:    { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  dateRow:        { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dateText:       { fontSize: 12, color: COLORS.textMuted, fontWeight: '500' },
  measureRow:     { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  measureBlock:   { flex: 1, alignItems: 'center', gap: 4 },
  measureIconWrap:{
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#E6F1FB', alignItems: 'center', justifyContent: 'center',
  },
  measureVal:     { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  measureLabel:   { fontSize: 11, color: COLORS.textMuted, fontWeight: '600' },
  measureDivider: { width: 1, height: 48, backgroundColor: COLORS.border, marginHorizontal: 8 },
  zRow:           { flexDirection: 'row', gap: 8 },
  zChip:          { flex: 1, borderRadius: RADIUS.md, padding: 9, alignItems: 'center' },
  zChipLabel:     { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, marginBottom: 3 },
  zChipVal:       { fontSize: 16, fontWeight: '800' },
  zChipStatus:    { fontSize: 9, fontWeight: '700', marginTop: 2, textAlign: 'center' },
});

const fm = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.xl, padding: 18, marginBottom: 16,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: COLORS.primary,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8 },
      android: { elevation: 6 },
      default: {},
    }),
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  titleIcon:{
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  title:       { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, flex: 1 },
  label:       { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 6, marginTop: 14 },
  dateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.background, borderRadius: RADIUS.md, padding: 12,
    borderWidth: 1, borderColor: COLORS.border,
  },
  dateBtnIcon: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  dateBtnText:  { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  readonlyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.background, borderRadius: RADIUS.md, padding: 12,
    borderWidth: 1, borderColor: COLORS.border, opacity: 0.75,
  },
  readonlyText: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '600' },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.background, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden',
  },
  inputIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  input:     {
    flex: 1, paddingVertical: 12, paddingRight: 12,
    fontSize: 14, color: COLORS.textPrimary, fontWeight: '600',
  },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, padding: 15, marginTop: 18,
    ...Platform.select({
      ios:     { shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
      android: { elevation: 6 },
      default: {},
    }),
  },
  submitText: { color: COLORS.onPrimary, fontWeight: '800', fontSize: 15 },
});

// Edit modal styles — renders as full bottom sheet with KeyboardAvoidingView
const em = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 999, justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  // KeyboardAvoidingView fills bottom portion
  kavWrapper: {
    width: '100%',
    maxHeight: '90%',
  },
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    // No fixed height — grows with content, capped by maxHeight on kavWrapper
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 16 },
      android: { elevation: 16 },
      default: {},
    }),
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginBottom: 4, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  sheetHeaderIcon: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: COLORS.textPrimary },
  sheetSub:   { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  closeBtn:   {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center',
  },
  // ScrollView content padding
  scrollContent: { paddingTop: 4, paddingBottom: 8 },
  label: {
    fontSize: 12, fontWeight: '700', color: COLORS.textSecondary,
    marginBottom: 6, marginTop: 14,
  },
  dateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.background, borderRadius: RADIUS.md, padding: 12,
    borderWidth: 1, borderColor: COLORS.border,
  },
  dateBtnIcon: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  dateBtnText: { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  readonlyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.background, borderRadius: RADIUS.md, padding: 12,
    borderWidth: 1, borderColor: COLORS.border, opacity: 0.75,
  },
  readonlyText: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '600' },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.background, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden',
  },
  inputIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  input: {
    flex: 1, paddingVertical: 12, paddingRight: 12,
    fontSize: 14, color: COLORS.textPrimary, fontWeight: '600',
  },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#0F6E56', borderRadius: RADIUS.lg, padding: 16, marginTop: 20,
    ...Platform.select({
      ios:     { shadowColor: '#0F6E56', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
      android: { elevation: 6 },
      default: {},
    }),
  },
  saveBtnText: { color: COLORS.onPrimary, fontWeight: '800', fontSize: 15 },
  cancelBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: RADIUS.lg, padding: 14, marginTop: 10,
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  cancelBtnText: { color: COLORS.textSecondary, fontWeight: '700', fontSize: 14 },
});