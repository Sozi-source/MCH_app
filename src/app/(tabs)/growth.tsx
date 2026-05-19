// src/app/(tabs)/growth.tsx
// mamaTOTO — Growth Tracker Screen (Full Visual Redesign)
// Strictly follows all 12 mamaTOTO design rules

import { useT } from '@/hooks/useT';
import { COLORS, RADIUS } from '@/lib/theme';
import { calculateZScores } from '@/lib/zscore';
import { getZScoreAlerts, getZScoreDisplay, ActiveAlert } from '@/lib/nutritionData';
import { GrowthRecord, useChildStore } from '@/store/childStore';
import { Ionicons } from '@expo/vector-icons';
import GrowthCharts from '@/components/GrowthCharts';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────
// Z-Score helpers
// ─────────────────────────────────────────────────────────────────

function getZLabel(z: number | null): { label: string; color: string; bg: string } {
  if (z === null)  return { label: 'N/A',            color: COLORS.textMuted, bg: '#F0F4F8' };
  if (z < -3)      return { label: 'Severely low',   color: '#A32D2D',        bg: '#FCEBEB' };
  if (z < -2)      return { label: 'Low',            color: '#854F0B',        bg: '#FAEEDA' };
  if (z > 3)       return { label: 'Obese',          color: '#7B3FA0',        bg: '#F3E8FC' };
  if (z > 2)       return { label: 'High',           color: '#185FA5',        bg: '#E6F1FB' };
  return            { label: 'Normal',               color: '#0F6E56',        bg: '#E1F5EE' };
}

// ─────────────────────────────────────────────────────────────────
// InlineDatePicker
// ─────────────────────────────────────────────────────────────────

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
      {/* Year */}
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

      {/* Month */}
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

      {/* Day */}
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

// ─────────────────────────────────────────────────────────────────
// ZScoreAlertBanner  (rule #5 — status badge + borderLeft accent)
// ─────────────────────────────────────────────────────────────────

function ZScoreAlertBanner({ alerts }: { alerts: ActiveAlert[] }) {
  if (alerts.length === 0) return null;

  const isUrgent = alerts[0].urgency === 'urgent';
  const accentColor  = isUrgent ? '#A32D2D' : '#854F0B';
  const bgColor      = isUrgent ? '#FCEBEB' : '#FAEEDA';
  const badgeLabel   = isUrgent ? 'URGENT'  : 'MONITOR';

  return (
    <View style={[ab.card, { borderLeftColor: accentColor }]}>
      {/* Header row */}
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

      {/* Alert rows */}
      {alerts.map((alert, i) => (
        <View
          key={i}
          style={[
            ab.alertRow,
            { backgroundColor: alert.urgency === 'urgent' ? '#FCEBEB' : '#FAEEDA' },
          ]}
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

      {/* Source */}
      <View style={ab.sourceRow}>
        <Ionicons name="shield-checkmark" size={11} color="#2A9D6E" />
        <Text style={ab.sourceText}>
          Kenya IMAM Guidelines 2019 · WHO Child Growth Standards
        </Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────
// LatestStatusBanner  — all-good or alert for latest record
// ─────────────────────────────────────────────────────────────────

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
          <Text style={s.allGoodTitle}>All measurements normal ✓</Text>
          <Text style={s.allGoodSub}>WHO Child Growth Standards</Text>
        </View>
      </View>
    );
  }

  return <ZScoreAlertBanner alerts={alerts} />;
}

// ─────────────────────────────────────────────────────────────────
// RecordCard  (rule #2 — white card, depth, rule #5 — z-score badges)
// ─────────────────────────────────────────────────────────────────

function RecordCard({
  rec,
  isLatest,
}: {
  rec: GrowthRecord;
  isLatest: boolean;
}) {
  const t = useT();
  const alerts = getZScoreAlerts(rec.waz, rec.haz, rec.whz, rec.age_months);

  const zScores: [string, number | null][] = [
    ['WAZ', rec.waz],
    ['HAZ', rec.haz],
    ['WHZ', rec.whz],
  ];

  return (
    <View style={[rc.card, isLatest && rc.cardLatest]}>
      {/* Latest badge */}
      {isLatest && (
        <View style={rc.latestBadge}>
          <Ionicons name="star" size={10} color={COLORS.onPrimary} />
          <Text style={rc.latestBadgeText}>Latest</Text>
        </View>
      )}

      {/* Header: age chip + date */}
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

      {/* Z-Score chips (rule #5) */}
      <View style={rc.zRow}>
        {zScores.map(([label, val]) => {
          const info = getZScoreDisplay(val);
          return (
            <View key={label} style={[rc.zChip, { backgroundColor: info.bg }]}>
              <Text style={rc.zChipLabel}>{label}</Text>
              <Text style={[rc.zChipVal, { color: info.color }]}>
                {val !== null ? val.toFixed(1) : 'N/A'}
              </Text>
              <Text style={[rc.zChipStatus, { color: info.color }]}>
                {info.label}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Per-card alert banner */}
      {alerts.length > 0 && (
        <View style={{ marginTop: 10 }}>
          <ZScoreAlertBanner alerts={alerts} />
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────
// AddMeasurementForm  (rule #9 — dashed border for "add new")
// ─────────────────────────────────────────────────────────────────

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
      {/* Card title row */}
      <View style={fm.titleRow}>
        <View style={fm.titleIcon}>
          <Ionicons name="add-circle" size={16} color={COLORS.primary} />
        </View>
        <Text style={fm.title}>{t('add_measurement')}</Text>
        <Text style={fm.emoji}>📏</Text>
      </View>

      {/* Date picker trigger */}
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

      {/* Age (auto-calc) */}
      <Text style={fm.label}>{t('age_months')}</Text>
      <View style={fm.readonlyRow}>
        <Ionicons name="lock-closed-outline" size={13} color={COLORS.textMuted} />
        <Text style={fm.readonlyText}>
          {ageMonths >= 0
            ? `${ageMonths} months — auto-calculated`
            : 'Invalid — before birth date'}
        </Text>
      </View>

      {/* Weight */}
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

      {/* Height */}
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

      {/* WHO tip card (rule #9 — borderLeft accent) */}
      <View style={fm.tipCard}>
        <View style={fm.tipAccent} />
        <View style={{ flex: 1, paddingLeft: 10 }}>
          <Text style={fm.tipTitle}>💡 WHO Measurement Tips</Text>
          <Text style={fm.tipBody}>
            Weigh children undressed, early morning. Measure height lying down
            (under 2 yrs) or standing (2 yrs+).
          </Text>
        </View>
      </View>

      {/* Submit */}
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

// ─────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────

export default function GrowthScreen() {
  const t      = useT();
  const router = useRouter();
  const {
    children,
    selectedChildId,
    growthRecords,
    fetchGrowthRecords,
    addGrowthRecord,
  } = useChildStore();

  const activeChild =
    children.find((c) => c.id === selectedChildId) ?? children[0];

  const [weight,      setWeight]      = useState('');
  const [height,      setHeight]      = useState('');
  const [loading,     setLoading]     = useState(false);
  const [showForm,    setShowForm]    = useState(false);
  const [showPicker,  setShowPicker]  = useState(false);
  const [measureDate, setMeasureDate] = useState(new Date());

  const ageMonths = activeChild
    ? getAgeMonthsFromDates(activeChild.date_of_birth, measureDate)
    : 0;

  useEffect(() => {
    if (activeChild?.id) fetchGrowthRecords(activeChild.id);
  }, [activeChild?.id]);

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
        : Alert.alert('Invalid date', 'Measurement date is before birth date.');
      return;
    }

    setLoading(true);
    try {
      const zscores = await calculateZScores(w, h, ageMonths, activeChild.sex);
      await addGrowthRecord({
        child_id:   activeChild.id,
        weight_kg:  w,
        height_cm:  h,
        age_months: ageMonths,
        waz:        zscores.waz,
        haz:        zscores.haz,
        whz:        zscores.whz,
        date:       measureDate.toISOString().split('T')[0],
      });

      setWeight('');
      setHeight('');
      setMeasureDate(new Date());
      setShowForm(false);
      setShowPicker(false);

      const newAlerts = getZScoreAlerts(zscores.waz, zscores.haz, zscores.whz);
      if (newAlerts.length > 0 && newAlerts[0].urgency === 'urgent') {
        const msg = newAlerts
          .map((a) => `${a.indicator}: ${a.classification}\n${a.action}`)
          .join('\n\n');
        Platform.OS === 'web'
          ? window.alert('⚠️ Action Required\n\n' + msg)
          : Alert.alert('⚠️ Action Required', msg, [{ text: 'Understood' }]);
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

  // ── No child empty state (rule #8) ──
  if (!activeChild) {
    return (
      <View style={s.container}>
        {/* Hero header */}
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

  return (
    <View style={s.container}>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          RULE #1 — Hero header: deep primary blue,
          rounded bottom, white text, paddingTop 56
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <View style={s.hero}>
        {/* Decorative overlay circles (rule #9) */}
        <View style={s.heroDecor} />
        <View style={s.heroDecor2} />

        {/* Top row: icon + title + toggle */}
        <View style={s.heroTop}>
          <View style={s.heroIconCircle}>
            <Ionicons name="trending-up" size={20} color={COLORS.onPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.heroTitle}>Growth Tracker 📈</Text>
            <Text style={s.heroSub}>WHO-standard z-score monitoring</Text>
          </View>
          <TouchableOpacity
            style={s.heroAddBtn}
            onPress={() => { setShowForm((f) => !f); setShowPicker(false); }}
            activeOpacity={0.8}
          >
            <Ionicons
              name={showForm ? 'close' : 'add'}
              size={20}
              color={COLORS.onPrimary}
            />
          </TouchableOpacity>
        </View>

        {/* Child info pill */}
        <View style={s.heroPill}>
          <View style={[
            s.heroPillAvatar,
            { backgroundColor: isFemale ? 'rgba(255,214,234,0.3)' : 'rgba(189,217,247,0.3)' },
          ]}>
            <Ionicons
              name={isFemale ? 'female' : 'male'}
              size={14}
              color={COLORS.onPrimary}
            />
          </View>
          <View>
            <Text style={s.heroPillName}>{activeChild.full_name}</Text>
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

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Child switcher chips (rule #11 — horizontal scroll) ── */}
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
                  <Text style={[s.switcherChipText, active && s.switcherChipTextActive]}>
                    {c.full_name.split(' ')[0]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* ── Latest z-score status banner ── */}
        <LatestStatusBanner records={growthRecords} />

        {/* ── Add measurement form ── */}
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
            onSubmit={handleAdd}
          />
        )}

        {/* ── Quick stats row ── */}
        {growthRecords.length > 0 && (() => {
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
                    ? (latest.waz > 0 ? `+${latest.waz.toFixed(1)}` : latest.waz.toFixed(1))
                    : '—'}
                </Text>
                <Text style={s.statLabel}>WAZ</Text>
              </View>
            </View>
          );
        })()}

        {/* ── WHO Growth Charts section ── */}
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
            childName={activeChild.full_name}
          />
        </View>

        {/* ── History section ── */}
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

        {/* Empty state (rule #8) */}
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
            <RecordCard key={rec.id} rec={rec} isLatest={i === 0} />
          ))
        )}

        <View style={{ height: 140 }} />
      </ScrollView>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          RULE #12 — FAB bottom-right
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <TouchableOpacity
        style={[
          s.fab,
          Platform.OS === 'web' ? s.fabWeb : s.fabNative,
          showForm && s.fabClose,
        ]}
        onPress={() => { setShowForm((f) => !f); setShowPicker(false); }}
        activeOpacity={0.88}
      >
        <Ionicons
          name={showForm ? 'close' : 'add'}
          size={28}
          color={COLORS.onPrimary}
        />
      </TouchableOpacity>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  // ── Hero (Rule #1) ──
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
    position: 'absolute',
    width: 220, height: 220, borderRadius: 110,
    borderWidth: 44, borderColor: 'rgba(255,255,255,0.07)',
    bottom: -70, right: -50,
  },
  heroDecor2: {
    position: 'absolute',
    width: 110, height: 110, borderRadius: 55,
    borderWidth: 24, borderColor: 'rgba(255,255,255,0.05)',
    top: 20, left: -18,
  },
  heroTop: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16,
  },
  heroIconCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroTitle: { fontSize: 22, fontWeight: '800', color: COLORS.onPrimary },
  heroSub:   { fontSize: 12, color: 'rgba(255,255,255,0.72)', marginTop: 2, fontWeight: '500' },
  heroAddBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroPill: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: RADIUS.full,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  heroPillAvatar: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
  },
  heroPillName:   { fontSize: 14, fontWeight: '700', color: COLORS.onPrimary },
  heroPillAge:    { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 1 },
  heroPillRecordsBadge: {
    marginLeft: 'auto',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: RADIUS.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  heroPillRecordsText: { fontSize: 11, fontWeight: '700', color: COLORS.onPrimary },

  // ── Scroll content ──
  scroll: { paddingHorizontal: 16, paddingTop: 16 },

  // ── Child switcher chips (Rule #11) ──
  switcherRow: {
    flexDirection: 'row', gap: 8,
    paddingBottom: 14,
  },
  switcherChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.white,
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  switcherChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  switcherChipText:       { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  switcherChipTextActive: { color: COLORS.onPrimary },

  // ── All-good banner ──
  allGoodBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#E1F5EE',
    borderRadius: RADIUS.lg,
    padding: 14, marginBottom: 14,
    borderWidth: 1, borderColor: '#A8DEC8',
  },
  allGoodIconCircle: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#C3ECD9',
    alignItems: 'center', justifyContent: 'center',
  },
  allGoodTitle: { fontSize: 14, fontWeight: '700', color: '#0F6E56' },
  allGoodSub:   { fontSize: 11, color: '#2A9D6E', marginTop: 2, fontStyle: 'italic' },

  // ── Quick stats row ──
  statsRow: {
    flexDirection: 'row', gap: 10, marginBottom: 18,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: 12, alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
  },
  statIcon: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  statVal:   { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary },
  statLabel: { fontSize: 10, fontWeight: '600', color: COLORS.textMuted, marginTop: 3 },

  // ── Section headers (Rule #7) ──
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 10, marginTop: 4,
  },
  sectionIconWrap: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary, flex: 1 },
  sectionCount: { fontSize: 12, color: COLORS.textMuted, fontWeight: '600' },
  whoBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#E1F5EE',
    borderRadius: RADIUS.full,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: '#A8DEC8',
  },
  whoBadgeText: { fontSize: 10, fontWeight: '700', color: '#2A9D6E' },

  // ── Charts card (Rule #2) ──
  chartsCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: 12, marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8,
    elevation: 3,
  },

  // ── Empty states (Rule #8) ──
  emptyWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  emptyIconCircle: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  emptyTitle:   { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 8 },
  emptySub:     { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  emptyBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.full,
    paddingHorizontal: 24, paddingVertical: 13,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  emptyBtnText: { color: COLORS.onPrimary, fontWeight: '700', fontSize: 14 },

  emptyRecords: {
    alignItems: 'center', paddingVertical: 32, gap: 10,
  },
  emptyRecordsIcon: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyRecordsTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary },
  emptyRecordsSub:   { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },
  emptyRecordsBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.full,
    paddingHorizontal: 22, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4,
  },
  emptyRecordsBtnText: { color: COLORS.onPrimary, fontWeight: '700', fontSize: 14 },

  // ── FAB (Rule #12) ──
  fab: {
    position: 'absolute', right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22, shadowRadius: 10,
    elevation: 6,
  },
  fabNative: { bottom: 158 },
  fabWeb:    { bottom: 76 },
  fabClose:  { backgroundColor: '#C0392B' },
});

// ─── Date picker styles ───────────────────────────────────────────

const dp = StyleSheet.create({
  wrapper: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.lg, padding: 12,
    marginTop: 8, marginBottom: 4,
    borderWidth: 1, borderColor: COLORS.border,
  },
  rowLabel: {
    fontSize: 11, fontWeight: '700',
    color: COLORS.textSecondary,
    marginTop: 10, marginBottom: 6,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.white,
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  dayChip: { paddingHorizontal: 10, minWidth: 38, alignItems: 'center' },
  chipActive:     { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText:       { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  chipTextActive: { color: COLORS.onPrimary, fontWeight: '700' },
});

// ─── Alert banner styles ──────────────────────────────────────────

const ab = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border,
    borderLeftWidth: 4,                           // Rule #9 accent
    padding: 14, marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6,
    elevation: 2,
  },
  headerRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  iconCircle:  { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 14, fontWeight: '800' },
  urgencyPill: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  urgencyPillText: { color: COLORS.white, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  alertRow: {
    borderRadius: RADIUS.md, padding: 12, marginBottom: 6,
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
  },
  indicatorBadge: {
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: RADIUS.sm, marginTop: 1,
  },
  indicatorText:  { color: COLORS.white, fontSize: 11, fontWeight: '800' },
  classification: { fontSize: 13, fontWeight: '700', marginBottom: 3 },
  action:         { fontSize: 12, color: COLORS.textPrimary, lineHeight: 18 },
  sourceRow:      { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  sourceText:     { fontSize: 10, color: '#2A9D6E', fontStyle: 'italic', fontWeight: '600' },
});

// ─── Record card styles ───────────────────────────────────────────

const rc = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8,
    elevation: 3,
  },
  cardLatest: {
    borderColor: COLORS.primary, borderWidth: 2,
  },
  latestBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: RADIUS.full, marginBottom: 10,
  },
  latestBadgeText: { color: COLORS.onPrimary, fontSize: 10, fontWeight: '700' },

  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  agePill:   { backgroundColor: COLORS.primaryLight, paddingHorizontal: 12, paddingVertical: 5, borderRadius: RADIUS.full },
  agePillText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  dateRow:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dateText:  { fontSize: 12, color: COLORS.textMuted, fontWeight: '500' },

  measureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  measureBlock: { flex: 1, alignItems: 'center', gap: 4 },
  measureIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#E6F1FB',
    alignItems: 'center', justifyContent: 'center',
  },
  measureVal:     { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  measureLabel:   { fontSize: 11, color: COLORS.textMuted, fontWeight: '600' },
  measureDivider: { width: 1, height: 48, backgroundColor: COLORS.border, marginHorizontal: 8 },

  zRow:       { flexDirection: 'row', gap: 8 },
  zChip:      { flex: 1, borderRadius: RADIUS.md, padding: 9, alignItems: 'center' },
  zChipLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, marginBottom: 3 },
  zChipVal:   { fontSize: 16, fontWeight: '800' },
  zChipStatus:{ fontSize: 9, fontWeight: '700', marginTop: 2, textAlign: 'center' },
});

// ─── Add form styles ──────────────────────────────────────────────

const fm = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: 18, marginBottom: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',                        // Rule #9 — dashed for "add new"
    borderColor: COLORS.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8,
    elevation: 3,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  titleIcon: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, flex: 1 },
  emoji: { fontSize: 18 },

  label: {
    fontSize: 12, fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 6, marginTop: 14,
  },

  dateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md, padding: 12,
    borderWidth: 1, borderColor: COLORS.border,
  },
  dateBtnIcon: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  dateBtnText: { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },

  readonlyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md, padding: 12,
    borderWidth: 1, borderColor: COLORS.border,
    opacity: 0.75,
  },
  readonlyText: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '600' },

  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
    overflow: 'hidden',
  },
  inputIcon: {
    width: 44, height: 44,
    alignItems: 'center', justifyContent: 'center',
  },
  input: {
    flex: 1, paddingVertical: 12, paddingRight: 12,
    fontSize: 14, color: COLORS.textPrimary, fontWeight: '600',
  },

  // Rule #9 — tip card with borderLeft accent
  tipCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.md,
    marginTop: 16, overflow: 'hidden',
  },
  tipAccent: { width: 4, backgroundColor: COLORS.primary },
  tipTitle:  { fontSize: 13, fontWeight: '700', color: COLORS.primary, marginBottom: 4 },
  tipBody:   { fontSize: 12, color: COLORS.textSecondary, lineHeight: 18, paddingVertical: 10, paddingRight: 10 },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg, padding: 15, marginTop: 18,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8,
    elevation: 4,
  },
  submitText: { color: COLORS.onPrimary, fontWeight: '800', fontSize: 15 },
});