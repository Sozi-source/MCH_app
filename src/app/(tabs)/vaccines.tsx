// src/app/(tabs)/vaccines.tsx
// mamaTOTO — Immunization Screen

import { COLORS, FONTS, HEADER, RADIUS } from '@/lib/theme';
import { useChildStore } from '@/store/childStore';
import { useVaccineStore, VaccineRow, VaccineStatus } from '@/store/vaccineStore';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  // FIX (nit): KeyboardAvoidingView removed — it was imported but never used.
  // Keyboard handling is done via manual keyboardHeight state instead.
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardEvent,
} from 'react-native';



// ─── Types ────────────────────────────────────────────────────────────────────

type FilterKey = 'all' | VaccineStatus;

// ─── Modal state (replaces 7 flat useState calls) ─────────────────────────────

type ModalState =
  | { kind: 'closed' }
  | { kind: 'mark';   row: VaccineRow; facility: string; givenDate: Date; showPicker: boolean }
  | { kind: 'edit';   row: VaccineRow; facility: string; givenDate: Date; showPicker: boolean }
  | { kind: 'unmark'; row: VaccineRow };

type ModalAction =
  | { type: 'OPEN_MARK';        row: VaccineRow }
  | { type: 'OPEN_EDIT';        row: VaccineRow }
  | { type: 'OPEN_UNMARK';      row: VaccineRow }
  | { type: 'SET_FACILITY';     value: string }
  | { type: 'SET_DATE';         date: Date }
  | { type: 'TOGGLE_PICKER' }
  | { type: 'HIDE_PICKER' }
  | { type: 'CLOSE' };

function modalReducer(state: ModalState, action: ModalAction): ModalState {
  switch (action.type) {
    case 'OPEN_MARK':
      return { kind: 'mark', row: action.row, facility: '', givenDate: new Date(), showPicker: false };
    case 'OPEN_EDIT':
      return {
        kind: 'edit',
        row: action.row,
        facility: action.row.immunization?.facility ?? '',
        givenDate: action.row.immunization?.given_date
          ? new Date(action.row.immunization.given_date)
          : new Date(),
        showPicker: false,
      };
    case 'OPEN_UNMARK':
      return { kind: 'unmark', row: action.row };
    case 'SET_FACILITY':
      if (state.kind !== 'mark' && state.kind !== 'edit') return state;
      return { ...state, facility: action.value };
    case 'SET_DATE':
      if (state.kind !== 'mark' && state.kind !== 'edit') return state;
      return { ...state, givenDate: action.date, showPicker: false };
    case 'TOGGLE_PICKER':
      if (state.kind !== 'mark' && state.kind !== 'edit') return state;
      return { ...state, showPicker: !state.showPicker };
    case 'HIDE_PICKER':
      if (state.kind !== 'mark' && state.kind !== 'edit') return state;
      return { ...state, showPicker: false };
    case 'CLOSE':
      return { kind: 'closed' };
    default:
      return state;
  }
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  VaccineStatus,
  { label: string; color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  given:    { label: 'Given',    color: COLORS.given,    bg: COLORS.givenLight,    icon: 'checkmark-circle' },
  missed:   { label: 'Missed',   color: COLORS.missed,   bg: COLORS.missedLight,   icon: 'close-circle' },
  due:      { label: 'Due',      color: COLORS.due,      bg: COLORS.dueLight,      icon: 'time' },
  upcoming: { label: 'Upcoming', color: COLORS.upcoming, bg: COLORS.upcomingLight, icon: 'calendar-outline' },
};

const FILTER_TABS: { key: FilterKey; label: string }[] = [
  { key: 'all',      label: 'All' },
  { key: 'due',      label: 'Due' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'given',    label: 'Given' },
  { key: 'missed',   label: 'Missed' },
];

const SUMMARY_ACCENT: Record<string, string> = {
  Given:    COLORS.given,
  Due:      COLORS.due,
  Missed:   COLORS.missed,
  Upcoming: COLORS.upcoming,
};

// ─── Date formatter (single source of truth) ──────────────────────────────────

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── ChipDatePicker ───────────────────────────────────────────────────────────

interface ChipDatePickerProps {
  value: Date;
  maxDate?: Date;
  onConfirm: (date: Date) => void;
  onCancel: () => void;
}

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function range(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

function ChipDatePicker({ value, maxDate = new Date(), onConfirm, onCancel }: ChipDatePickerProps) {
  const [year,  setYear]  = useState(value.getFullYear());
  const [month, setMonth] = useState(value.getMonth());
  const [day,   setDay]   = useState(value.getDate());

  const maxYear     = maxDate.getFullYear();
  const years       = range(maxYear - 100, maxYear).reverse();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days        = range(1, daysInMonth);
  const clampedDay  = Math.min(day, daysInMonth);

  const yearRef  = useRef<ScrollView>(null);
  const monthRef = useRef<ScrollView>(null);
  const dayRef   = useRef<ScrollView>(null);

  const CHIP_W  = 56;
  const MONTH_W = 52;
  const DAY_W   = 44;

  useEffect(() => {
    const yi = years.indexOf(year);
    if (yi >= 0) yearRef.current?.scrollTo({ x: yi * (CHIP_W + 8), animated: false });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — intentionally runs once on mount

  useEffect(() => {
    monthRef.current?.scrollTo({ x: month * (MONTH_W + 8), animated: true });
  }, [month]);

  useEffect(() => {
    dayRef.current?.scrollTo({ x: (clampedDay - 1) * (DAY_W + 8), animated: true });
  }, [clampedDay, month, year]);

  // FIX (bug): confirmDate is now a shared helper called from year, month, AND day
  // changes. Previously onConfirm was only called from the day tap, so changing
  // only the year or month would silently discard the selection.
  const confirmDate = useCallback((y: number, m: number, d: number) => {
    const safeDays = new Date(y, m + 1, 0).getDate();
    const safeDay  = Math.min(d, safeDays);
    const date     = new Date(y, m, safeDay);
    // FIX (warning): maxDate is now enforced for year/month changes too.
    if (date <= maxDate) onConfirm(date);
  }, [maxDate, onConfirm]);

  return (
    <View style={cpStyles.container}>
      <Text style={cpStyles.rowLabel}>YEAR</Text>
      <ScrollView
        ref={yearRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={cpStyles.chipRow}
        keyboardShouldPersistTaps="handled"
      >
        {years.map(y => {
          const selected = y === year;
          // FIX (warning): disable future years that exceed maxDate
          const disabled = y > maxDate.getFullYear();
          return (
            <TouchableOpacity
              key={y}
              disabled={disabled}
              style={[cpStyles.chip, { width: CHIP_W }, selected && cpStyles.chipSelected, disabled && cpStyles.chipDisabled]}
              onPress={() => { setYear(y); confirmDate(y, month, clampedDay); }}
            >
              <Text style={[cpStyles.chipText, selected && cpStyles.chipTextSelected]}>{y}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Text style={cpStyles.rowLabel}>MONTH</Text>
      <ScrollView
        ref={monthRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={cpStyles.chipRow}
        keyboardShouldPersistTaps="handled"
      >
        {MONTH_SHORT.map((m, idx) => {
          const selected  = idx === month;
          // FIX (warning): disable months beyond maxDate for the selected year
          const disabled  = year === maxDate.getFullYear() && idx > maxDate.getMonth();
          return (
            <TouchableOpacity
              key={m}
              disabled={disabled}
              style={[cpStyles.chip, { width: MONTH_W }, selected && cpStyles.chipSelected, disabled && cpStyles.chipDisabled]}
              onPress={() => { setMonth(idx); confirmDate(year, idx, clampedDay); }}
            >
              <Text style={[cpStyles.chipText, selected && cpStyles.chipTextSelected]}>{m}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Text style={cpStyles.rowLabel}>DAY</Text>
      <ScrollView
        ref={dayRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={cpStyles.chipRow}
        keyboardShouldPersistTaps="handled"
      >
        {days.map(d => {
          const selected = d === clampedDay;
          // FIX (warning): disable days beyond maxDate when in the max month/year
          const atMaxMonth = year === maxDate.getFullYear() && month === maxDate.getMonth();
          const disabled   = atMaxMonth && d > maxDate.getDate();
          return (
            <TouchableOpacity
              key={d}
              disabled={disabled}
              style={[cpStyles.chip, { width: DAY_W }, selected && cpStyles.chipSelected, disabled && cpStyles.chipDisabled]}
              onPress={() => { setDay(d); confirmDate(year, month, d); }}
            >
              <Text style={[cpStyles.chipText, selected && cpStyles.chipTextSelected]}>
                {String(d).padStart(2, '0')}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <TouchableOpacity style={cpStyles.cancelRow} onPress={onCancel}>
        <Text style={cpStyles.cancelText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

const cpStyles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingTop: 12,
    paddingBottom: 4,
    marginTop: 6,
  },
  rowLabel: {
    fontFamily: FONTS.semibold,
    fontSize: 10,
    color: COLORS.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: 14,
    marginBottom: 6,
  },
  chipRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    gap: 8,
    paddingBottom: 12,
  },
  chip: {
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  // FIX (warning): style for disabled chips (future dates)
  chipDisabled: {
    opacity: 0.35,
  },
  chipText: {
    fontFamily: FONTS.semibold,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  chipTextSelected: {
    color: COLORS.white,
  },
  cancelRow: {
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: 2,
  },
  cancelText: {
    fontFamily: FONTS.semibold,
    fontSize: 13,
    color: COLORS.textMuted,
  },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function VaccinesScreen() {
  const { activeChild } = useChildStore();
  const {
    vaccineRows,
    loading,
    fetchSchedules,
    fetchImmunizations,
    computeRows,
    markAsGiven,
    markAsMissed,
    updateImmunization,
    unmarkImmunization,
    seedScheduleIfEmpty,
    seeded,
  } = useVaccineStore();

  const [filter, setFilter]         = useState<FilterKey>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [loadError, setLoadError]   = useState<string | null>(null); // FIX (warning): surface fetch errors
  const [modal, dispatch]           = useReducer(modalReducer, { kind: 'closed' });

  // FIX (bug): facilityInputRef, modalScrollRef, and keyboardHeight state/effect
  // were declared inside ChipDatePicker but used in VaccinesScreen's JSX.
  // Moved here so they are in scope where they are consumed.
  const facilityInputRef = useRef<TextInput>(null);
  const modalScrollRef   = useRef<ScrollView>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e: KeyboardEvent) => setKeyboardHeight(e.endCoordinates.height),
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0),
    );
    return () => { show.remove(); hide.remove(); };
  }, []);

  // ── Load ─────────────────────────────────────────────────────────────────
  const load = useCallback(async (force = false) => {
    // FIX (warning): errors are now caught and surfaced to the user instead of
    // being swallowed, which previously left the screen silently empty on failure.
    setLoadError(null);
    try {
      if (!seeded) await seedScheduleIfEmpty();
      await fetchSchedules(force);
      if (activeChild) {
        const fresh = await fetchImmunizations(activeChild.id);
        computeRows(activeChild.date_of_birth, fresh);
      }
    } catch (err: any) {
      setLoadError(err?.message ?? 'Failed to load vaccine schedule.');
    }
  }, [seeded, activeChild, seedScheduleIfEmpty, fetchSchedules, fetchImmunizations, computeRows]);
  // NOTE (warning): if store functions (fetchSchedules, fetchImmunizations, etc.)
  // are not wrapped in useCallback inside the store, they will be new references
  // on every render, causing this callback — and therefore the useEffect below —
  // to re-run on every render (infinite loop). Ensure those store methods are stable.

  useEffect(() => { load(); }, [load]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }, [load]);

  // ── Filtered rows ────────────────────────────────────────────────────────
  const filtered = useMemo(
    () => filter === 'all' ? vaccineRows : vaccineRows.filter(r => r.status === filter),
    [vaccineRows, filter],
  );

  // ── Counts ───────────────────────────────────────────────────────────────
  const counts = useMemo(() => ({
    given:    vaccineRows.filter(r => r.status === 'given').length,
    due:      vaccineRows.filter(r => r.status === 'due').length,
    missed:   vaccineRows.filter(r => r.status === 'missed').length,
    upcoming: vaccineRows.filter(r => r.status === 'upcoming').length,
  }), [vaccineRows]);

  // ── Mutations ────────────────────────────────────────────────────────────
  const handleMarkGiven = useCallback(async () => {
    if (modal.kind !== 'mark' && modal.kind !== 'edit') return;
    if (!activeChild) return;

    // FIX (warning): capture modal fields into locals before the async call so
    // that a race between the in-flight request and a modal close cannot cause
    // stale closure reads on modal.kind / modal.row / etc.
    const { kind, row, facility, givenDate } = modal;

    setSaving(true);
    try {
      if (kind === 'edit' && row.immunization?.id) {
        await updateImmunization(
          row.immunization.id,
          activeChild.id,
          facility,
          givenDate,
          activeChild.date_of_birth,
        );
      } else {
        await markAsGiven(
          row.schedule.id,
          activeChild.id,
          facility,
          givenDate,
          activeChild.date_of_birth,
        );
      }
      dispatch({ type: 'CLOSE' });
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Could not save record.');
    } finally {
      setSaving(false);
    }
  }, [modal, activeChild, markAsGiven, updateImmunization]);

  const handleMarkMissed = useCallback((row: VaccineRow) => {
    if (!activeChild) return;
    Alert.alert('Mark as Missed', `Mark ${row.schedule.vaccine_name} as missed?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark Missed',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            await markAsMissed(row.schedule.id, activeChild.id, activeChild.date_of_birth);
          } catch (err: any) {
            Alert.alert('Error', err.message ?? 'Could not update record.');
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  }, [activeChild, markAsMissed]);

  const handleUnmark = useCallback(async () => {
    if (modal.kind !== 'unmark') return;
    if (!activeChild) return;

    // FIX (warning): same stale-closure guard as handleMarkGiven
    const { row } = modal;

    setSaving(true);
    try {
      if (row.immunization?.id) {
        await unmarkImmunization(
          row.immunization.id,
          activeChild.id,
          activeChild.date_of_birth,
        );
      }
      dispatch({ type: 'CLOSE' });
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Could not unmark record.');
    } finally {
      setSaving(false);
    }
  }, [modal, activeChild, unmarkImmunization]);

  // ── Row renderer ─────────────────────────────────────────────────────────
  const renderRow = useCallback(({ item: row }: { item: VaccineRow }) => {
    const cfg = STATUS_CONFIG[row.status];
    return (
      <View style={styles.card}>
        {/* Left accent bar */}
        <View style={[styles.cardAccent, { backgroundColor: cfg.color }]} />

        <View style={styles.cardBody}>
          {/* Top row: name + dose badge | status badge */}
          <View style={styles.cardTop}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.vaccineName} numberOfLines={1}>
                {row.schedule.vaccine_name}
              </Text>
              {row.schedule.dose_number > 0 && (
                <View style={styles.doseBadge}>
                  <Text style={styles.doseText}>Dose {row.schedule.dose_number}</Text>
                </View>
              )}
            </View>
            <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
              <Ionicons name={cfg.icon} size={11} color={cfg.color} />
              <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
          </View>

          {/* Subtitle: diseases covered */}
          <Text style={styles.diseases} numberOfLines={1}>
            {row.schedule.diseases_covered}
          </Text>

          {/* Date */}
          {row.dueDate && (
            <View style={styles.metaRow}>
              <Ionicons name="calendar-outline" size={11} color={COLORS.textMuted} />
              <Text style={styles.metaText}>
                {row.status === 'given'
                  ? `Given: ${formatDate(row.immunization?.given_date)}`
                  : `Due: ${formatDate(row.dueDate)}`}
              </Text>
            </View>
          )}

          {/* Facility */}
          {row.immunization?.facility ? (
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={11} color={COLORS.textMuted} />
              <Text style={styles.metaText} numberOfLines={1}>{row.immunization.facility}</Text>
            </View>
          ) : null}

          {/* Divider */}
          <View style={styles.cardDivider} />

          {/* Actions */}
          <View style={styles.cardActions}>
            {row.status === 'given' && (
              <>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => dispatch({ type: 'OPEN_EDIT', row })}
                >
                  <Ionicons name="pencil-outline" size={13} color={COLORS.primary} />
                  <Text style={[styles.actionText, { color: COLORS.primary }]}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => dispatch({ type: 'OPEN_UNMARK', row })}
                >
                  <Ionicons name="arrow-undo-outline" size={13} color={COLORS.textSecondary} />
                  <Text style={[styles.actionText, { color: COLORS.textSecondary }]}>Unmark</Text>
                </TouchableOpacity>
              </>
            )}
            {(row.status === 'due' || row.status === 'upcoming') && (
              <>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnPrimary]}
                  onPress={() => dispatch({ type: 'OPEN_MARK', row })}
                >
                  <Ionicons name="checkmark" size={13} color={COLORS.white} />
                  <Text style={[styles.actionText, { color: COLORS.white }]}>Mark Given</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => handleMarkMissed(row)}
                >
                  <Ionicons name="close-outline" size={13} color={COLORS.missed} />
                  <Text style={[styles.actionText, { color: COLORS.missed }]}>Miss</Text>
                </TouchableOpacity>
              </>
            )}
            {row.status === 'missed' && (
              <>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnPrimary]}
                  onPress={() => dispatch({ type: 'OPEN_MARK', row })}
                >
                  <Ionicons name="checkmark" size={13} color={COLORS.white} />
                  <Text style={[styles.actionText, { color: COLORS.white }]}>Record Now</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => dispatch({ type: 'OPEN_UNMARK', row })}
                >
                  <Ionicons name="arrow-undo-outline" size={13} color={COLORS.textSecondary} />
                  <Text style={[styles.actionText, { color: COLORS.textSecondary }]}>Unmark</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    );
  }, [handleMarkMissed]);

  // ── No child ─────────────────────────────────────────────────────────────
  if (!activeChild) {
    return (
      <View style={styles.screen}>
        <View style={[styles.emptyFull, { backgroundColor: COLORS.background }]}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="person-add-outline" size={32} color={COLORS.primary} />
          </View>
          <Text style={styles.emptyTitle}>No child selected</Text>
          <Text style={styles.emptySubtitle}>Add a child profile to view their vaccine schedule.</Text>
        </View>
      </View>
    );
  }

  const isMarkOrEdit = modal.kind === 'mark' || modal.kind === 'edit';

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={styles.screen}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={HEADER.decorCircle1} />
        <View style={HEADER.decorCircle2} />

        <View style={styles.headerTop}>
          <View style={styles.headerTitleBlock}>
            <View style={styles.eyebrowRow}>
              <Ionicons name="shield-checkmark-outline" size={12} color="rgba(255,255,255,0.75)" />
              <Text style={styles.eyebrowText}>IMMUNIZATION RECORD</Text>
            </View>
            <Text style={styles.headerTitle}>Vaccines</Text>
            <View style={styles.childPill}>
              <Ionicons name="person-circle-outline" size={13} color="rgba(255,255,255,0.85)" />
              <Text style={styles.headerSub}>{activeChild.full_name}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.headerRefresh}
            onPress={handleRefresh}
            disabled={refreshing}
          >
            <Ionicons
              name="refresh"
              size={16}
              color={COLORS.white}
              style={refreshing ? { opacity: 0.4 } : undefined}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.headerDivider} />

        <View style={styles.summaryRow}>
          {[
            { label: 'Given',    value: counts.given,    icon: 'checkmark-circle' as const },
            { label: 'Due',      value: counts.due,      icon: 'time' as const },
            { label: 'Missed',   value: counts.missed,   icon: 'close-circle' as const },
            { label: 'Upcoming', value: counts.upcoming, icon: 'calendar-outline' as const },
          ].map(chip => (
            <View key={chip.label} style={styles.summaryChip}>
              <Ionicons
                name={chip.icon}
                size={13}
                color={SUMMARY_ACCENT[chip.label]}
                style={styles.summaryChipIcon}
              />
              <Text style={styles.summaryValue}>{chip.value}</Text>
              <Text style={styles.summaryLabel}>{chip.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── Filter tabs ─────────────────────────────────────────────────── */}
      <View style={styles.filterBarWrapper}>
        <View style={styles.filterBarContent}>
          {FILTER_TABS.map(tab => {
            const active = filter === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.filterTab, active && styles.filterTabActive]}
                onPress={() => setFilter(tab.key)}
              >
                <Text
                  style={[styles.filterTabText, active && styles.filterTabTextActive]}
                  numberOfLines={1}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── Error banner ────────────────────────────────────────────────── */}
      {/* FIX (warning): show a dismissible error banner when load() fails,
          rather than silently showing an empty list. */}
      {loadError && (
        <View style={styles.errorBanner}>
          <Ionicons name="warning-outline" size={15} color={COLORS.missed} />
          <Text style={styles.errorBannerText} numberOfLines={2}>{loadError}</Text>
          <TouchableOpacity onPress={() => load(true)} style={styles.errorRetryBtn}>
            <Text style={styles.errorRetryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── List ────────────────────────────────────────────────────────── */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading schedule…</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.schedule.id}
          renderItem={renderRow}
          contentContainerStyle={styles.listContent}
          initialNumToRender={10}
          maxToRenderPerBatch={8}
          windowSize={5}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="checkmark-done-circle-outline" size={28} color={COLORS.primary} />
              </View>
              <Text style={styles.emptyTitle}>No vaccines here</Text>
              <Text style={styles.emptySubtitle}>
                {filter === 'all' ? 'The schedule is empty.' : `No ${filter} vaccines found.`}
              </Text>
            </View>
          }
        />
      )}

      {/* ── Mark / Edit modal ─────────────────────────────────────────────── */}
      <Modal
        visible={isMarkOrEdit}
        transparent
        animationType="slide"
        onRequestClose={() => dispatch({ type: 'CLOSE' })}
        statusBarTranslucent
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => { Keyboard.dismiss(); dispatch({ type: 'CLOSE' }); }}
        >
          <Pressable
            style={[styles.modalSheet, { marginBottom: keyboardHeight }]}
            onPress={e => e.stopPropagation()}
          >
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>
              {modal.kind === 'edit' ? 'Edit Record' : 'Record Vaccine'}
            </Text>

            {isMarkOrEdit && (
              <View style={styles.modalSubRow}>
                <View style={[
                  styles.modalSubBadge,
                  { backgroundColor: STATUS_CONFIG[modal.row.status].bg },
                ]}>
                  <Ionicons
                    name={STATUS_CONFIG[modal.row.status].icon}
                    size={12}
                    color={STATUS_CONFIG[modal.row.status].color}
                  />
                  <Text style={[styles.modalSubText, { color: STATUS_CONFIG[modal.row.status].color }]}>
                    {modal.row.schedule.vaccine_name}
                    {modal.row.schedule.dose_number ? ` · Dose ${modal.row.schedule.dose_number}` : ''}
                  </Text>
                </View>
              </View>
            )}

            <ScrollView
              ref={modalScrollRef}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces={false}
              contentContainerStyle={styles.modalBodyContent}
            >
              <Text style={styles.inputLabel}>Date Given</Text>
              <TouchableOpacity
                style={[
                  styles.dateInput,
                  isMarkOrEdit && modal.showPicker && styles.dateInputActive,
                ]}
                onPress={() => { Keyboard.dismiss(); dispatch({ type: 'TOGGLE_PICKER' }); }}
              >
                <Ionicons name="calendar-outline" size={16} color={COLORS.primary} />
                <Text style={styles.dateInputText}>
                  {isMarkOrEdit ? formatDate(modal.givenDate) : ''}
                </Text>
                <Ionicons
                  name={isMarkOrEdit && modal.showPicker ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={COLORS.textMuted}
                />
              </TouchableOpacity>

              {isMarkOrEdit && modal.showPicker && (
                <ChipDatePicker
                  value={modal.givenDate}
                  maxDate={new Date()}
                  onConfirm={(d) => dispatch({ type: 'SET_DATE', date: d })}
                  onCancel={() => dispatch({ type: 'HIDE_PICKER' })}
                />
              )}

              <Text style={[styles.inputLabel, { marginTop: 16 }]}>Health Facility</Text>
              <TextInput
                ref={facilityInputRef}
                style={styles.input}
                placeholder="e.g. Kenyatta National Hospital"
                placeholderTextColor={COLORS.textMuted}
                value={isMarkOrEdit ? modal.facility : ''}
                onChangeText={v => dispatch({ type: 'SET_FACILITY', value: v })}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
                blurOnSubmit
                onFocus={() => {
                  setTimeout(() => {
                    modalScrollRef.current?.scrollToEnd({ animated: true });
                  }, 100);
                }}
              />

              <View style={styles.modalFooter}>
                {/* FIX (refinement): Cancel is never disabled — if the network call
                    hangs, the user must always be able to dismiss the modal. */}
                <TouchableOpacity
                  style={styles.modalCancel}
                  onPress={() => dispatch({ type: 'CLOSE' })}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalConfirm, saving && styles.modalBtnDisabled]}
                  onPress={handleMarkGiven}
                  disabled={saving}
                >
                  {saving
                    ? <ActivityIndicator size="small" color={COLORS.white} />
                    : (
                      <>
                        <Ionicons
                          name={modal.kind === 'edit' ? 'save-outline' : 'checkmark-circle-outline'}
                          size={16}
                          color={COLORS.white}
                        />
                        <Text style={styles.modalConfirmText}>
                          {modal.kind === 'edit' ? 'Save Changes' : 'Confirm'}
                        </Text>
                      </>
                    )}
                </TouchableOpacity>
              </View>
            </ScrollView>

          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Unmark confirmation modal ─────────────────────────────────────── */}
      <Modal
        visible={modal.kind === 'unmark'}
        transparent
        animationType="fade"
        onRequestClose={() => dispatch({ type: 'CLOSE' })}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => dispatch({ type: 'CLOSE' })}
        >
          <Pressable style={styles.unmarkSheet} onPress={e => e.stopPropagation()}>
            <View style={styles.modalHandle} />
            <View style={styles.unmarkIconWrap}>
              <Ionicons name="arrow-undo" size={22} color={COLORS.textSecondary} />
            </View>
            <Text style={styles.modalTitle}>Remove Record?</Text>
            <Text style={styles.unmarkBody}>
              This will remove the{' '}
              {modal.kind === 'unmark' ? modal.row.status : ''} record for{' '}
              <Text style={{ fontFamily: FONTS.semibold, color: COLORS.textPrimary }}>
                {modal.kind === 'unmark' ? modal.row.schedule.vaccine_name : ''}
              </Text>{' '}
              and restore it to its scheduled state.
            </Text>
            <View style={styles.modalFooter}>
              {/* FIX (refinement): Cancel is never disabled here either. */}
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => dispatch({ type: 'CLOSE' })}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalDanger, saving && styles.modalBtnDisabled]}
                onPress={handleUnmark}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator size="small" color={COLORS.white} />
                  : <Text style={styles.modalConfirmText}>Remove</Text>}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    backgroundColor: COLORS.primary,
    paddingTop: HEADER.paddingTop,
    paddingBottom: 20,
    paddingHorizontal: HEADER.paddingHorizontal,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
    zIndex: 2,
    ...HEADER.shadow,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  headerTitleBlock: {
    gap: 4,
    flex: 1,
    paddingRight: 12,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 2,
  },
  eyebrowText: {
    fontFamily: FONTS.semibold,
    fontSize: 10,
    color: 'rgba(255,255,255,0.70)',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontFamily: FONTS.extrabold,
    fontSize: 30,
    color: COLORS.white,
    letterSpacing: -0.6,
    lineHeight: 34,
  },
  childPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginTop: 4,
  },
  headerSub: {
    fontFamily: FONTS.semibold,
    fontSize: 12,
    color: 'rgba(255,255,255,0.88)',
    letterSpacing: 0.2,
  },
  headerRefresh: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  headerDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginBottom: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  summaryChip: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: 'center',
    gap: 2,
  },
  summaryChipIcon: {
    marginBottom: 1,
  },
  summaryValue: {
    fontFamily: FONTS.bold,
    fontSize: 22,
    color: COLORS.textPrimary,
    lineHeight: 24,
  },
  summaryLabel: {
    fontFamily: FONTS.regular,
    fontSize: 8,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── Filter bar ──────────────────────────────────────────────────────────────
  filterBarWrapper: {
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    zIndex: 1,
  },
  filterBarContent: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  filterTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  filterTabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterTabText: {
    fontFamily: FONTS.semibold,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  filterTabTextActive: {
    color: COLORS.white,
  },

  // ── Error banner ─────────────────────────────────────────────────────────────
  // FIX (warning): new styles for the error/retry banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.missedLight,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  errorBannerText: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.missed,
  },
  errorRetryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.missed,
  },
  errorRetryText: {
    fontFamily: FONTS.semibold,
    fontSize: 12,
    color: COLORS.missed,
  },

  listContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 10,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textMuted,
  },

  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardAccent: {
    width: 3.5,
    flexShrink: 0,
  },
  cardBody: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 12,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 4,
  },
  cardTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginRight: 4,
  },
  vaccineName: {
    fontFamily: FONTS.semibold,
    fontSize: 15,
    color: COLORS.textPrimary,
    flexShrink: 1,
  },
  doseBadge: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  doseText: {
    fontFamily: FONTS.semibold,
    fontSize: 10,
    color: COLORS.primary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    flexShrink: 0,
  },
  statusText: {
    fontFamily: FONTS.semibold,
    fontSize: 11,
  },
  diseases: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 2,
  },
  metaText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textMuted,
    flex: 1,
  },
  cardDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 10,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  actionBtnPrimary: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  actionText: {
    fontFamily: FONTS.semibold,
    fontSize: 12,
  },

  emptyFull: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 40,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
    gap: 10,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontFamily: FONTS.semibold,
    fontSize: 16,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: '92%',
  },
  unmarkSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
    gap: 12,
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: FONTS.bold,
    fontSize: 17,
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubRow: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalSubBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  modalSubText: {
    fontFamily: FONTS.semibold,
    fontSize: 13,
  },
  // FIX (nit): modalBody (flex: 1) removed — it was defined but never applied
  // to any component, so it was dead code.
  modalBodyContent: {
    paddingBottom: 8,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
  },
  inputLabel: {
    fontFamily: FONTS.semibold,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.surface,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
  },
  dateInputActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
  },
  dateInputText: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: COLORS.textPrimary,
    flex: 1,
  },
  modalCancel: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontFamily: FONTS.semibold,
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  modalConfirm: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  modalDanger: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.missed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnDisabled: {
    opacity: 0.5,
  },
  modalConfirmText: {
    fontFamily: FONTS.semibold,
    fontSize: 15,
    color: COLORS.white,
  },
  unmarkIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  unmarkBody: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});