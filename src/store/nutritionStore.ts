/**
 * src/store/nutritionStore.ts
 *
 * Zustand store for the mamaTOTO nutrition module.
 * Fetches all nutrition reference data from Supabase tables seeded with
 * WHO CF Guideline 2023, UNICEF C-IYCF 2024, Kenya Clinical Nutrition
 * Manual 2010, and Kenya MIYCN Strategy 2023-2028.
 *
 * TABLES:
 *   nutrition_feeding_stages      — feeding stage cards by age band
 *   nutrition_food_groups         — WHO 8 MDD food groups
 *   nutrition_tips                — rotating IYCF tip cards
 *   nutrition_counselling_messages — per-age-band counselling messages
 *   nutrition_ebf_guidance        — EBF cards for 0-5 months
 *   nutrition_milestones          — feeding development + growth checkpoints
 */

import { supabase } from '@/lib/supabase';
import { create } from 'zustand';

// -----------------------------------------------------------------------------
// TYPES — mirror the Supabase table columns exactly
// -----------------------------------------------------------------------------

export interface NutritionFeedingStage {
  id: string;
  age_band: string;            // '0-5' | '6-8' | '9-11' | '12-23' | '24+'
  sort_order: number;
  stage_name: string;
  breastfeeding_guidance: string;
  meals_per_day: string;
  snacks_per_day: string;
  texture: string;
  amount_per_meal: string;
  key_facts: string[];         // jsonb array
  source: string;
  guideline_version: string;
}

export interface NutritionFoodGroup {
  id: string;
  mdd_group_number: number;    // 1-8, WHO 2021 numbering
  sort_order: number;
  name: string;
  description: string;
  color_hex: string;
  why_important: string;
  serving_size: string;
  frequency: string;
  examples_local: string | null;
  icon_name: string;
  source: string;
  guideline_version: string;
}

export interface NutritionTip {
  id: string;
  age_min_months: number;
  age_max_months: number;
  tip: string;
  source: string;
  category: string;
  priority: number;
}

export interface CounsellingMessage {
  id: string;
  food_group_id: string | null;
  age_band: string;            // '0-5' | '6-8' | '9-11' | '12-23' | '6-23'
  category: string;
  message_text: string;
  counsellor_note: string | null;
  priority: number;
  source: string;
  guideline_version: string;
}

export interface EBFGuidance {
  id: string;
  sort_order: number;
  age_band: string;            // '0-1' | '0-5' | '1-3' | '3-5'
  category: string;
  title: string;
  message_text: string;
  counsellor_note: string | null;
  priority: number;
  source: string;
  guideline_version: string;
}

export interface NutritionMilestone {
  id: string;
  trigger_age_months: number;
  type: 'development' | 'nutrition' | 'clinic_visit';
  title: string;
  body: string;
  source: string;
  guideline_version: string;
}

// -----------------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------------

/**
 * Map a child's age in months to the age_band string used in Supabase tables.
 * Used for feeding stages, counselling messages, and EBF guidance.
 */
export function getAgeBand(
  ageMonths: number,
): '0-5' | '6-8' | '9-11' | '12-23' | '24+' {
  if (ageMonths <= 5)  return '0-5';
  if (ageMonths <= 8)  return '6-8';
  if (ageMonths <= 11) return '9-11';
  if (ageMonths <= 23) return '12-23';
  return '24+';
}

/**
 * Map a child's age in months to the age_band string used in
 * nutrition_counselling_messages (which uses '6-23' as a catch-all).
 */
export function getCounsellingAgeBand(
  ageMonths: number,
): '0-5' | '6-8' | '9-11' | '12-23' | '6-23' {
  if (ageMonths <= 5)  return '0-5';
  if (ageMonths <= 8)  return '6-8';
  if (ageMonths <= 11) return '9-11';
  return '12-23';
}

/**
 * Map a child's age in months to the EBF age_band.
 * Returns null if child is outside EBF period (>= 6 months).
 */
export function getEBFAgeBand(
  ageMonths: number,
): '0-1' | '1-3' | '3-5' | '0-5' | null {
  if (ageMonths > 5) return null;
  if (ageMonths <= 1) return '0-1';
  if (ageMonths <= 3) return '1-3';
  return '3-5';
}

// -----------------------------------------------------------------------------
// STORE
// -----------------------------------------------------------------------------

interface NutritionState {
  // Data
  feedingStages: NutritionFeedingStage[];
  foodGroups: NutritionFoodGroup[];
  tips: NutritionTip[];
  counsellingMessages: CounsellingMessage[];
  ebfGuidance: EBFGuidance[];
  milestones: NutritionMilestone[];

  // Status
  loading: boolean;
  error: string | null;
  hydrated: boolean;

  // Actions
  fetchAll: () => Promise<void>;

  // Selectors — derived data based on child age
  getFeedingStageForAge:        (ageMonths: number) => NutritionFeedingStage | null;
  getTipsForAge:                (ageMonths: number) => NutritionTip[];
  getCounsellingForAge:         (ageMonths: number) => CounsellingMessage[];
  getCounsellingForAgeAndGroup: (ageMonths: number, foodGroupId: string) => CounsellingMessage[];
  getEBFGuidanceForAge:         (ageMonths: number) => EBFGuidance[];
  getMilestonesForAge:          (ageMonths: number) => NutritionMilestone[];
  getUpcomingMilestones:        (ageMonths: number, lookaheadMonths?: number) => NutritionMilestone[];
}

export const useNutritionStore = create<NutritionState>((set, get) => ({
  // -- Initial state ----------------------------------------------------------
  feedingStages:        [],
  foodGroups:           [],
  tips:                 [],
  counsellingMessages:  [],
  ebfGuidance:          [],
  milestones:           [],
  loading:              false,
  error:                null,
  hydrated:             false,

  // -- fetchAll ---------------------------------------------------------------
  // Fetches all 6 nutrition tables in parallel. Safe to call multiple times —
  // skips if already hydrated. Call once on app load or on nutrition tab focus.
  fetchAll: async () => {
  if (get().hydrated) return;
  set({ loading: true, error: null });

  try {
    const [
      { data: stages,     error: e1 },
      { data: groups,     error: e2 },
      { data: tips,       error: e3 },
      { data: messages,   error: e4 },
      { data: ebf,        error: e5 },
      { data: milestones, error: e6 },
    ] = await Promise.all([
      supabase.from('nutrition_feeding_stages').select('*').order('sort_order', { ascending: true }),
      supabase.from('nutrition_food_groups').select('*').order('mdd_group_number', { ascending: true }),
      supabase.from('nutrition_tips').select('*').order('age_min_months', { ascending: true }), // ? removed priority sort
      supabase.from('nutrition_counselling_messages').select('*').order('priority', { ascending: true }),
      supabase.from('nutrition_ebf_guidance').select('*').order('sort_order', { ascending: true }),
      supabase.from('nutrition_milestones').select('*').order('trigger_age_months', { ascending: true }),
    ]);

    // Log individual errors without killing everything
    const errors = [e1, e2, e3, e4, e5, e6].filter(Boolean);
    if (errors.length) {
      console.warn('[nutritionStore] Some tables had errors:', errors.map(e => e?.message));
    }

    set({
      feedingStages:       (stages     ?? []) as NutritionFeedingStage[],
      foodGroups:          (groups     ?? []) as NutritionFoodGroup[],
      tips:                (tips       ?? []) as NutritionTip[],
      counsellingMessages: (messages   ?? []) as CounsellingMessage[],
      ebfGuidance:         (ebf        ?? []) as EBFGuidance[],
      milestones:          (milestones ?? []) as NutritionMilestone[],
      hydrated: true,
      error: errors.length ? errors[0]?.message ?? null : null,
    });
  } catch (err: any) {
    set({ error: err.message ?? 'Failed to load nutrition data' });
    console.error('[nutritionStore] fetchAll failed:', err);
  } finally {
    set({ loading: false });
  }
},

  // -- Selectors --------------------------------------------------------------

  /**
   * Returns the feeding stage card matching the child's age.
   * Falls back to the last stage if no match found.
   */
  getFeedingStageForAge: (ageMonths) => {
    const band = getAgeBand(ageMonths);
    const { feedingStages } = get();
    return (
      feedingStages.find((s) => s.age_band === band) ??
      feedingStages[feedingStages.length - 1] ??
      null
    );
  },

  /**
   * Returns all tips applicable to the child's age,
   * sorted by priority ascending.
   */
  getTipsForAge: (ageMonths) => {
    return get().tips.filter(
      (t) => ageMonths >= t.age_min_months && ageMonths <= t.age_max_months,
    );
  },

  /**
   * Returns counselling messages for the child's specific age band
   * PLUS any messages tagged '6-23' (apply across full CF period).
   * Deduped and sorted by priority.
   */
  getCounsellingForAge: (ageMonths) => {
    const band = getCounsellingAgeBand(ageMonths);
    return get().counsellingMessages.filter(
      (m) => m.age_band === band || m.age_band === '6-23',
    );
  },

  /**
   * Returns counselling messages for a specific food group + age band.
   * Used in the food group detail drawer/modal.
   */
  getCounsellingForAgeAndGroup: (ageMonths, foodGroupId) => {
    const band = getCounsellingAgeBand(ageMonths);
    return get().counsellingMessages.filter(
      (m) =>
        m.food_group_id === foodGroupId &&
        (m.age_band === band || m.age_band === '6-23'),
    );
  },

  /**
   * Returns EBF guidance cards for the child's age.
   * Returns empty array if child is 6 months or older.
   * Includes '0-5' (general) plus the specific sub-band.
   */
  getEBFGuidanceForAge: (ageMonths) => {
    if (ageMonths >= 6) return [];
    const subBand = getEBFAgeBand(ageMonths);
    return get().ebfGuidance.filter(
      (e) => e.age_band === '0-5' || e.age_band === subBand,
    );
  },

  /**
   * Returns all milestones triggered at exactly the child's current age.
   */
  getMilestonesForAge: (ageMonths) => {
    return get().milestones.filter(
      (m) => m.trigger_age_months === ageMonths,
    );
  },

  /**
   * Returns upcoming milestones within the next N months (default 3).
   * Useful for the home screen "coming up" strip.
   */
  getUpcomingMilestones: (ageMonths, lookaheadMonths = 3) => {
    return get().milestones.filter(
      (m) =>
        m.trigger_age_months > ageMonths &&
        m.trigger_age_months <= ageMonths + lookaheadMonths,
    );
  },
}));
