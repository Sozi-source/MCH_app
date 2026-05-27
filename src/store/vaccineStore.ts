/**
 * src/store/vaccineStore.ts
 *
 * PERFORMANCE FIXES:
 *  - fetchSchedules() is cached — skips DB if schedulesLoaded is true.
 *    Pass force=true to bypass (pull-to-refresh).
 *  - computeRows() no longer fires notifications inline. Notifications are
 *    fired via fireNotifications(), called only after real mutations.
 *  - unmarkImmunization() included and patched to not double-fire.
 *  - All public method signatures unchanged — no screen edits required
 *    beyond the vaccines.tsx companion file.
 */

import { supabase } from '@/lib/supabase';
import {
  notifyVaccineAlerts,
  scheduleVaccineDueReminders,
} from '@/lib/notificationService';
import { create } from 'zustand';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface VaccineSchedule {
  id: string;
  vaccine_name: string;
  dose_number: number;
  due_at_weeks: number | null;
  due_at_months: number | null;
  diseases_covered: string;
  notes: string | null;
  display_order: number;
}

export interface Immunization {
  id: string;
  child_id: string;
  vaccine_name: string;
  scheduled_date: string;
  given_date: string | null;
  batch_number: string | null;
  facility: string | null;
  status: 'scheduled' | 'given' | 'missed';
  notes: string | null;
  dose_number: number | null;
}

export type VaccineStatus = 'given' | 'missed' | 'due' | 'upcoming';

export interface VaccineRow {
  schedule: VaccineSchedule;
  immunization: Immunization | null;
  status: VaccineStatus;
  dueDate: Date | null;
  daysUntilDue: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// KEPI seed data
// ─────────────────────────────────────────────────────────────────────────────

const KEPI_SEED: Omit<VaccineSchedule, 'id'>[] = [
  { vaccine_name: 'BCG',             dose_number: 1, due_at_weeks: 0,    due_at_months: null, diseases_covered: 'Tuberculosis',                                       notes: 'Given at birth',                   display_order: 1  },
  { vaccine_name: 'OPV',             dose_number: 0, due_at_weeks: 0,    due_at_months: null, diseases_covered: 'Polio',                                              notes: 'Birth dose (OPV0)',                display_order: 2  },
  { vaccine_name: 'Hepatitis B',     dose_number: 1, due_at_weeks: 0,    due_at_months: null, diseases_covered: 'Hepatitis B',                                        notes: 'Birth dose',                       display_order: 3  },
  { vaccine_name: 'OPV',             dose_number: 1, due_at_weeks: 6,    due_at_months: null, diseases_covered: 'Polio',                                              notes: null,                               display_order: 4  },
  { vaccine_name: 'DPT-HepB-Hib',   dose_number: 1, due_at_weeks: 6,    due_at_months: null, diseases_covered: 'Diphtheria, Pertussis, Tetanus, Hepatitis B, Hib',  notes: 'Pentavalent 1',                    display_order: 5  },
  { vaccine_name: 'PCV',             dose_number: 1, due_at_weeks: 6,    due_at_months: null, diseases_covered: 'Pneumococcal disease',                              notes: null,                               display_order: 6  },
  { vaccine_name: 'Rotavirus',       dose_number: 1, due_at_weeks: 6,    due_at_months: null, diseases_covered: 'Rotavirus diarrhoea',                               notes: null,                               display_order: 7  },
  { vaccine_name: 'IPV',             dose_number: 1, due_at_weeks: 6,    due_at_months: null, diseases_covered: 'Polio (inactivated)',                               notes: null,                               display_order: 8  },
  { vaccine_name: 'OPV',             dose_number: 2, due_at_weeks: 10,   due_at_months: null, diseases_covered: 'Polio',                                              notes: null,                               display_order: 9  },
  { vaccine_name: 'DPT-HepB-Hib',   dose_number: 2, due_at_weeks: 10,   due_at_months: null, diseases_covered: 'Diphtheria, Pertussis, Tetanus, Hepatitis B, Hib',  notes: 'Pentavalent 2',                    display_order: 10 },
  { vaccine_name: 'PCV',             dose_number: 2, due_at_weeks: 10,   due_at_months: null, diseases_covered: 'Pneumococcal disease',                              notes: null,                               display_order: 11 },
  { vaccine_name: 'Rotavirus',       dose_number: 2, due_at_weeks: 10,   due_at_months: null, diseases_covered: 'Rotavirus diarrhoea',                               notes: null,                               display_order: 12 },
  { vaccine_name: 'OPV',             dose_number: 3, due_at_weeks: 14,   due_at_months: null, diseases_covered: 'Polio',                                              notes: null,                               display_order: 13 },
  { vaccine_name: 'DPT-HepB-Hib',   dose_number: 3, due_at_weeks: 14,   due_at_months: null, diseases_covered: 'Diphtheria, Pertussis, Tetanus, Hepatitis B, Hib',  notes: 'Pentavalent 3',                    display_order: 14 },
  { vaccine_name: 'PCV',             dose_number: 3, due_at_weeks: 14,   due_at_months: null, diseases_covered: 'Pneumococcal disease',                              notes: null,                               display_order: 15 },
  { vaccine_name: 'Malaria (RTS,S)', dose_number: 1, due_at_weeks: null, due_at_months: 5,    diseases_covered: 'Malaria',                                            notes: 'R21 vaccine - 5 months',           display_order: 16 },
  { vaccine_name: 'Malaria (RTS,S)', dose_number: 2, due_at_weeks: null, due_at_months: 6,    diseases_covered: 'Malaria',                                            notes: null,                               display_order: 17 },
  { vaccine_name: 'Malaria (RTS,S)', dose_number: 3, due_at_weeks: null, due_at_months: 7,    diseases_covered: 'Malaria',                                            notes: null,                               display_order: 18 },
  { vaccine_name: 'Measles-Rubella', dose_number: 1, due_at_weeks: null, due_at_months: 9,    diseases_covered: 'Measles, Rubella',                                   notes: null,                               display_order: 19 },
  { vaccine_name: 'Yellow Fever',    dose_number: 1, due_at_weeks: null, due_at_months: 9,    diseases_covered: 'Yellow Fever',                                       notes: null,                               display_order: 20 },
  { vaccine_name: 'Malaria (RTS,S)', dose_number: 4, due_at_weeks: null, due_at_months: 24,   diseases_covered: 'Malaria',                                            notes: 'Booster dose at 24 months',        display_order: 21 },
  { vaccine_name: 'Measles-Rubella', dose_number: 2, due_at_weeks: null, due_at_months: 18,   diseases_covered: 'Measles, Rubella',                                   notes: 'Booster',                          display_order: 22 },
  { vaccine_name: 'Vitamin A',       dose_number: 1, due_at_weeks: null, due_at_months: 6,    diseases_covered: 'Vitamin A deficiency',                               notes: 'Supplementation - every 6 months', display_order: 23 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getDueDate(schedule: VaccineSchedule, dob: string): Date | null {
  const birth = new Date(dob);
  if (schedule.due_at_weeks !== null) {
    const d = new Date(birth);
    d.setDate(d.getDate() + schedule.due_at_weeks * 7);
    return d;
  }
  if (schedule.due_at_months !== null) {
    const d = new Date(birth);
    d.setMonth(d.getMonth() + schedule.due_at_months);
    return d;
  }
  return null;
}

function computeStatus(dueDate: Date | null, immunization: Immunization | null): VaccineStatus {
  if (immunization?.status === 'given')  return 'given';
  if (immunization?.status === 'missed') return 'missed';
  if (!dueDate) return 'upcoming';
  const diffDays = Math.floor((dueDate.getTime() - Date.now()) / 86400000);
  if (diffDays < -14) return 'missed';
  if (diffDays <= 14) return 'due';
  return 'upcoming';
}

function findImmunization(
  immunizations: Immunization[],
  schedule: VaccineSchedule,
  dueDate: Date | null,
): Immunization | null {
  const candidates = immunizations.filter(i =>
    i.vaccine_name === schedule.vaccine_name &&
    (i.dose_number === undefined || i.dose_number === null || i.dose_number === schedule.dose_number),
  );
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  if (!dueDate) return candidates[0];
  return candidates.reduce((best, curr) => {
    const bestDiff = Math.abs(new Date(best.scheduled_date).getTime() - dueDate.getTime());
    const currDiff = Math.abs(new Date(curr.scheduled_date).getTime() - dueDate.getTime());
    return currDiff < bestDiff ? curr : best;
  });
}

function assertNoError(
  error: { message: string; details?: string; hint?: string; code?: string } | null,
  context: string,
) {
  if (error) {
    const detail = [error.code, error.message, error.details, error.hint].filter(Boolean).join(' | ');
    console.error(`[vaccineStore] ${context}:`, detail);
    throw new Error(detail);
  }
}

async function getAuthUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// State interface
// ─────────────────────────────────────────────────────────────────────────────

interface VaccineState {
  schedules:       VaccineSchedule[];
  immunizations:   Immunization[];
  vaccineRows:     VaccineRow[];
  loading:         boolean;
  seeded:          boolean;
  /** True once schedules have been fetched at least once this session. */
  schedulesLoaded: boolean;

  seedScheduleIfEmpty: () => Promise<void>;
  /**
   * Fetches vaccine schedules from Supabase.
   * Cached — returns immediately if already loaded this session.
   * Pass force=true to bypass the cache (e.g. pull-to-refresh).
   */
  fetchSchedules:      (force?: boolean) => Promise<void>;
  fetchImmunizations:  (childId: string) => Promise<Immunization[]>;
  /**
   * Recomputes vaccineRows from loaded schedules + immunizations.
   * Does NOT fire notifications — call fireNotifications() explicitly
   * after a mutation if alerts are needed.
   */
  computeRows: (
    childDob: string,
    freshImmunizations?: Immunization[],
    child?: import('@/types').Child,
  ) => void;
  /**
   * Fires vaccine alert + reminder notifications.
   * Called internally by markAsGiven / markAsMissed / updateImmunization /
   * unmarkImmunization — NOT on every computeRows call.
   */
  fireNotifications: (rows: VaccineRow[], child: import('@/types').Child) => void;

  markAsGiven:         (scheduleId: string, childId: string, facilityName?: string, givenDate?: Date, childDob?: string) => Promise<void>;
  markAsMissed:        (scheduleId: string, childId: string, childDob?: string) => Promise<void>;
  updateImmunization:  (immunizationId: string, childId: string, facilityName: string, givenDate: Date, childDob: string) => Promise<void>;
  unmarkImmunization:  (immunizationId: string, childId: string, childDob: string) => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────

export const useVaccineStore = create<VaccineState>((set, get) => ({
  schedules:       [],
  immunizations:   [],
  vaccineRows:     [],
  loading:         false,
  seeded:          false,
  schedulesLoaded: false,

  seedScheduleIfEmpty: async () => {
    const { data: existing } = await supabase.from('vaccine_schedules').select('id').limit(1);
    if (existing && existing.length > 0) { set({ seeded: true }); return; }
    const { error } = await supabase.from('vaccine_schedules').insert(KEPI_SEED);
    if (!error) set({ seeded: true });
    else console.error('[vaccineStore] seed:', error.message);
  },

  // ── Cached fetch — skips DB if schedules already loaded ──────────────────
  fetchSchedules: async (force = false) => {
    const { schedulesLoaded } = get();
    if (schedulesLoaded && !force) return;

    set({ loading: true });
    const { data, error } = await supabase
      .from('vaccine_schedules')
      .select('*')
      .order('display_order', { ascending: true });
    if (error) console.error('[vaccineStore] fetchSchedules:', error.message);
    if (data)  set({ schedules: data, schedulesLoaded: true });
    set({ loading: false });
  },

  fetchImmunizations: async (childId) => {
    const { data, error } = await supabase
      .from('immunizations')
      .select('*')
      .eq('child_id', childId);
    if (error) console.error('[vaccineStore] fetchImmunizations:', error.message);
    const imms: Immunization[] = data ?? [];
    set({ immunizations: imms });
    return imms;
  },

  // ── Notifications removed — use fireNotifications() after mutations only ─
  computeRows: (childDob, freshImmunizations) => {
    const { schedules } = get();
    const immunizations = freshImmunizations ?? get().immunizations;

    const rows: VaccineRow[] = schedules.map(schedule => {
      const dueDate      = getDueDate(schedule, childDob);
      const immunization = findImmunization(immunizations, schedule, dueDate);
      const status       = computeStatus(dueDate, immunization);
      const daysUntilDue = dueDate
        ? Math.floor((dueDate.getTime() - Date.now()) / 86400000)
        : null;
      return { schedule, immunization, status, dueDate, daysUntilDue };
    });

    set({ vaccineRows: rows });
  },

  // ── Explicit notification trigger — call only after real mutations ────────
  fireNotifications: (rows, child) => {
    notifyVaccineAlerts(rows, child).catch(err =>
      console.warn('[vaccineStore] notifyVaccineAlerts failed:', err),
    );
    scheduleVaccineDueReminders(rows, child).catch(err =>
      console.warn('[vaccineStore] scheduleVaccineDueReminders failed:', err),
    );
  },

  markAsGiven: async (scheduleId, childId, facilityName, givenDate, childDob) => {
    const userId = await getAuthUserId();
    if (!userId) throw new Error('Not authenticated. Please log in and try again.');
    const schedule = get().schedules.find(s => s.id === scheduleId);
    if (!schedule) throw new Error('Vaccine schedule not found.');

    const { immunizations } = get();
    const row = get().vaccineRows.find(r => r.schedule.id === scheduleId);
    const dueDate = getDueDate(schedule, row?.dueDate?.toISOString() ?? new Date().toISOString());
    const scheduledDateStr = dueDate ? toDateStr(dueDate) : toDateStr(new Date());
    const givenDateStr = toDateStr(
      givenDate instanceof Date && !isNaN(givenDate.getTime()) ? givenDate : new Date(),
    );

    const existing = findImmunization(immunizations, schedule, dueDate);
    if (existing) {
      const { error } = await supabase
        .from('immunizations')
        .update({ status: 'given', given_date: givenDateStr, facility: facilityName ?? null })
        .eq('id', existing.id);
      assertNoError(error, 'markAsGiven/update');
    } else {
      const { error } = await supabase.from('immunizations').insert({
        child_id:       childId,
        vaccine_name:   schedule.vaccine_name,
        dose_number:    schedule.dose_number,
        scheduled_date: scheduledDateStr,
        given_date:     givenDateStr,
        facility:       facilityName ?? null,
        status:         'given',
      });
      assertNoError(error, 'markAsGiven/insert');
    }

    const fresh = await get().fetchImmunizations(childId);
    if (childDob) {
      get().computeRows(childDob, fresh);
      // Fire notifications only after this real mutation
      const { vaccineRows } = get();
      const { children } = await import('@/store/childStore').then(m => m.useChildStore.getState());
      const child = children.find(c => c.id === childId);
      if (child) get().fireNotifications(vaccineRows, child);
    }
  },

  updateImmunization: async (immunizationId, childId, facilityName, givenDate, childDob) => {
    const givenDateStr = toDateStr(
      givenDate instanceof Date && !isNaN(givenDate.getTime()) ? givenDate : new Date(),
    );
    const { data, error } = await supabase
      .from('immunizations')
      .update({ given_date: givenDateStr, facility: facilityName || null, status: 'given' })
      .eq('id', immunizationId)
      .select();
    assertNoError(error, 'updateImmunization');
    if (!data || data.length === 0)
      throw new Error('Save failed — Supabase RLS may be blocking updates on immunizations.');

    const fresh = await get().fetchImmunizations(childId);
    get().computeRows(childDob, fresh);
    // Fire notifications after mutation
    const { vaccineRows } = get();
    const { children } = await import('@/store/childStore').then(m => m.useChildStore.getState());
    const child = children.find(c => c.id === childId);
    if (child) get().fireNotifications(vaccineRows, child);
  },

  markAsMissed: async (scheduleId, childId, childDob) => {
    const userId = await getAuthUserId();
    if (!userId) throw new Error('Not authenticated. Please log in and try again.');
    const schedule = get().schedules.find(s => s.id === scheduleId);
    if (!schedule) throw new Error('Vaccine schedule not found.');

    const { immunizations } = get();
    const row = get().vaccineRows.find(r => r.schedule.id === scheduleId);
    const dueDate = row?.dueDate ?? new Date();
    const existing = findImmunization(immunizations, schedule, dueDate);

    if (existing) {
      const { error } = await supabase
        .from('immunizations')
        .update({ status: 'missed' })
        .eq('id', existing.id);
      assertNoError(error, 'markAsMissed/update');
    } else {
      const { error } = await supabase.from('immunizations').insert({
        child_id:       childId,
        vaccine_name:   schedule.vaccine_name,
        dose_number:    schedule.dose_number,
        scheduled_date: toDateStr(dueDate),
        given_date:     null,
        facility:       null,
        status:         'missed',
      });
      assertNoError(error, 'markAsMissed/insert');
    }

    const fresh = await get().fetchImmunizations(childId);
    if (childDob) {
      get().computeRows(childDob, fresh);
      const { vaccineRows } = get();
      const { children } = await import('@/store/childStore').then(m => m.useChildStore.getState());
      const child = children.find(c => c.id === childId);
      if (child) get().fireNotifications(vaccineRows, child);
    }
  },

  unmarkImmunization: async (immunizationId, childId, childDob) => {
    const { error } = await supabase
      .from('immunizations')
      .delete()
      .eq('id', immunizationId)
      .eq('child_id', childId);
    assertNoError(error, 'unmarkImmunization');
    const fresh = await get().fetchImmunizations(childId);
    get().computeRows(childDob, fresh);
    // No fireNotifications on unmark — restoring to scheduled state
  },
}));