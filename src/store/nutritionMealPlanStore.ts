/**
 * src/store/nutritionMealPlanStore.ts
 *
 * ZuriHealth — DB-driven meal plan food pool builder.
 * Schema-accurate rewrite based on confirmed Supabase columns.
 *
 * CONFIRMED TABLE SCHEMAS:
 *   foods               — id(text), name_common, name_swahili, name_local,
 *                         name_scientific, group_id(int FK→food_groups.id),
 *                         sub_group, processing_state, is_native, is_common,
 *                         availability_region(array), season, typical_form,
 *                         price_tier, notes
 *   food_groups         — id(int), name, who_group(text)
 *   nutrition_per_100g  — id(int), food_id(text), prep_state, energy_kcal,
 *                         protein_g, fat_total_g, fat_unsaturated_g, fat_omega3_g,
 *                         fat_omega3_epa_mg, fat_omega3_dha_mg, carbohydrate_g,
 *                         fibre_g, calcium_mg, iron_mg, iron_heme_mg, iron_nonheme_mg,
 *                         zinc_mg, potassium_mg, sodium_mg, vit_a_mcg_rae,
 *                         vit_a_betacarotene_mcg, vit_b1_thiamine_mg, vit_b2_riboflavin_mg,
 *                         vit_b6_mg, vit_b9_folate_mcg, vit_b12_mcg, vit_c_mg,
 *                         vit_d_mcg, vit_e_mg, vit_k_mcg, choline_mg,
 *                         glycaemic_index, phytate_mg, tannin_mg, data_source
 *   diet_suitability    — id(int), food_id(text), condition(text),
 *                         suitability(text), max_serving_g, reason, source
 *   food_synergies      — id(int), food_id(text), paired_food_id(text),
 *                         synergy_type, nutrient, effect_size, notes, source
 */

import { supabase } from '@/lib/supabase';
import { create } from 'zustand';

// ─── RAW DB TYPES ──────────────────────────────────────────────────────────────

export interface DBFood {
  id: string;
  name_common: string;
  name_swahili: string | null;
  name_local: string | null;
  name_scientific: string | null;
  group_id: number;
  sub_group: string | null;
  processing_state: string | null;
  is_native: boolean;
  is_common: boolean;
  availability_region: string[];
  season: string | null;
  typical_form: string | null;
  price_tier: string | null;
  notes: string | null;
}

export interface DBFoodGroup {
  id: number;
  name: string;
  who_group: string;
}

export interface DBNutrition {
  id: number;
  food_id: string;
  prep_state: string | null;
  energy_kcal: number | null;
  protein_g: number | null;
  fat_total_g: number | null;
  fat_unsaturated_g: number | null;
  fat_omega3_g: number | null;
  fat_omega3_epa_mg: number | null;
  fat_omega3_dha_mg: number | null;
  carbohydrate_g: number | null;
  fibre_g: number | null;
  calcium_mg: number | null;
  iron_mg: number | null;
  iron_heme_mg: number | null;
  iron_nonheme_mg: number | null;
  zinc_mg: number | null;
  potassium_mg: number | null;
  sodium_mg: number | null;
  vit_a_mcg_rae: number | null;
  vit_a_betacarotene_mcg: number | null;
  vit_b1_thiamine_mg: number | null;
  vit_b2_riboflavin_mg: number | null;
  vit_b6_mg: number | null;
  vit_b9_folate_mcg: number | null;
  vit_b12_mcg: number | null;
  vit_c_mg: number | null;
  vit_d_mcg: number | null;
  vit_e_mg: number | null;
  vit_k_mcg: number | null;
  choline_mg: number | null;
  glycaemic_index: number | null;
  phytate_mg: number | null;
  tannin_mg: number | null;
  data_source: string | null;
}

export interface DBSuitability {
  id: number;
  food_id: string;
  condition: string;
  suitability: 'recommended' | 'allowed' | 'limit' | 'avoid' | 'contraindicated';
  max_serving_g: number | null;
  reason: string | null;
  source: string | null;
}

export interface DBSynergy {
  id: number;
  food_id: string;
  paired_food_id: string;
  synergy_type: string | null;
  nutrient: string | null;
  effect_size: string | null;
  notes: string | null;
  source: string | null;
}

// ─── CLINICAL CONDITIONS ───────────────────────────────────────────────────────

export interface ZScores {
  waz: number | null;
  haz: number | null;
  whz: number | null;
}

export type ClinicalCondition =
  | 'infant_6_12m'
  | 'child_12_23m'
  | 'child_24_59m'
  | 'malnutrition_sam'
  | 'malnutrition_mam'
  | 'stunting'
  | 'overweight'
  | 'anaemia_iron';

export type SeverityTier = 'critical' | 'moderate' | 'stunted' | 'normal';

export function deriveConditions(ageMonths: number, z: ZScores): ClinicalCondition[] {
  const c: ClinicalCondition[] = [];

  if (ageMonths >= 6 && ageMonths < 12) c.push('infant_6_12m');
  // child_12_23m not in DB - no age gate needed
  // child_24_59m not in DB - no age gate needed

  // Precautionary iron anaemia for 6–23m (Kenya DHS 2022: ~55% prevalence)
  if (ageMonths >= 6 && ageMonths < 24) c.push('anaemia_iron');

  // SAM: WHZ < -3, or WAZ < -3 when WHZ unavailable
  const isSAM =
    z.whz != null ? z.whz < -3 : z.waz != null && z.waz < -3;
  // MAM: not SAM, but WHZ < -2 (or WAZ < -2 fallback)
  const isMAM =
    !isSAM && (z.whz != null ? z.whz < -2 : z.waz != null && z.waz < -2);

  if (isSAM) c.push('malnutrition_sam');
  if (isMAM) c.push('malnutrition_mam');
  if (z.haz != null && z.haz < -2) c.push('stunting');
  if (z.whz != null && z.whz > 2) c.push('overweight');

  return c;
}

export function deriveSeverity(conditions: ClinicalCondition[]): SeverityTier {
  if (conditions.includes('malnutrition_sam')) return 'critical';
  if (conditions.includes('malnutrition_mam')) return 'moderate';
  if (conditions.includes('stunting')) return 'stunted';
  return 'normal';
}

export function textureLabel(ageMonths: number): string {
  if (ageMonths < 7) return 'smooth purée';
  if (ageMonths < 9) return 'mashed / soft purée';
  if (ageMonths < 12) return 'minced / soft finger foods';
  if (ageMonths < 24) return 'soft family foods';
  return 'family foods';
}

// ─── ENRICHED FOOD (what AI and UI consume) ────────────────────────────────────

export interface EnrichedFood {
  food_id: string;
  food_name: string;
  local_name: string | null;
  who_group: string;
  group_name: string;
  // nutrition_per_100g fields (best available prep state)
  energy_kcal: number | null;
  protein_g: number | null;
  fat_total_g: number | null;
  carbohydrate_g: number | null;
  iron_mg: number | null;
  iron_heme_mg: number | null;
  calcium_mg: number | null;
  zinc_mg: number | null;
  vit_a_mcg: number | null;
  vit_c_mg: number | null;
  omega3_g: number | null;
  vit_b12_mcg: number | null;
  choline_mg: number | null;
  fibre_g: number | null;
  phytate_mg: number | null;
  tannin_mg: number | null;
  glycaemic_index: number | null;
  // diet_suitability derived
  suitability_notes: string[];
  max_serving_g: number | null;
  // computed flags
  is_high_iron: boolean;
  is_high_vit_a: boolean;
  is_high_vit_c: boolean;
  is_energy_dense: boolean;
  is_animal_source: boolean;
  has_antinutrients: boolean;
}

export interface ResolvedSynergy {
  food_name: string;
  paired_food_name: string;
  nutrient: string | null;
  notes: string | null;
  effect_size: string | null;
}

export interface FoodPool {
  byWhoGroup: Record<string, EnrichedFood[]>;
  all: EnrichedFood[];
  conditions: ClinicalCondition[];
  severity: SeverityTier;
  synergies: ResolvedSynergy[];
  ageMonths: number;
  textureLabel: string;
  energyTarget: string;
}

// ─── STORE ─────────────────────────────────────────────────────────────────────

interface MealPlanStoreState {
  foods: DBFood[];
  foodGroups: DBFoodGroup[];
  nutrition: DBNutrition[];
  suitability: DBSuitability[];
  synergies: DBSynergy[];
  loading: boolean;
  error: string | null;
  hydrated: boolean;
  fetchAll: () => Promise<void>;
  buildFoodPool: (ageMonths: number, zscores: ZScores) => FoodPool;
}

// Prep state priority: prefer cooked/ready-to-eat states over raw
const PREP_PRIORITY = ['dried', 'boiled', 'cooked', 'steamed', 'roasted', 'fermented', 'raw', 'fresh'];

function bestNutritionRow(rows: DBNutrition[]): DBNutrition | undefined {
  if (rows.length === 0) return undefined;
  if (rows.length === 1) return rows[0];
  return rows.reduce((best, cur) => {
    const bi = PREP_PRIORITY.indexOf((best.prep_state ?? '').toLowerCase());
    const ci = PREP_PRIORITY.indexOf((cur.prep_state ?? '').toLowerCase());
    if (ci !== -1 && (bi === -1 || ci < bi)) return cur;
    return best;
  });
}

export const useMealPlanStore = create<MealPlanStoreState>((set, get) => ({
  foods: [],
  foodGroups: [],
  nutrition: [],
  suitability: [],
  synergies: [],
  loading: false,
  error: null,
  hydrated: false,

  fetchAll: async () => {
    if (get().hydrated) return;
    set({ loading: true, error: null });
    try {
      const [
        { data: foods, error: e1 },
        { data: foodGroups, error: e2 },
        { data: nutrition, error: e3 },
        { data: suitability, error: e4 },
        { data: synergies, error: e5 },
      ] = await Promise.all([
        supabase.from('foods').select('*'),
        supabase.from('food_groups').select('*'),
        supabase.from('nutrition_per_100g').select('*'),
        supabase.from('diet_suitability').select('*'),
        supabase.from('food_synergies').select('*'),
      ]);

      const firstErr = [e1, e2, e3, e4, e5].find(Boolean);
      if (firstErr) console.warn('[mealPlanStore] Supabase error:', firstErr.message);

        set({
        foods: (foods ?? []) as DBFood[],
        foodGroups: (foodGroups ?? []) as DBFoodGroup[],
        nutrition: (nutrition ?? []) as DBNutrition[],
        suitability: (suitability ?? []) as DBSuitability[],
        synergies: (synergies ?? []) as DBSynergy[],
        hydrated: true,
        error: firstErr?.message ?? null,
      });
    } catch (err: any) {
      set({ error: err?.message ?? 'Failed to load food database' });
      console.error('[mealPlanStore] fetchAll failed:', err);
    } finally {
      set({ loading: false });
    }
  },

  buildFoodPool: (ageMonths, zscores) => {
    const { foods, foodGroups, nutrition, suitability, synergies } = get();

    const conditions = deriveConditions(ageMonths, zscores);
    const severity = deriveSeverity(conditions);

    // ── Lookup maps ──────────────────────────────────────────────────────────

    const groupMap: Record<number, DBFoodGroup> = {};
    for (const g of foodGroups) groupMap[g.id] = g;

    // Best nutrition row per food_id
    const nutritionByFood: Record<string, DBNutrition[]> = {};
    for (const n of nutrition) {
      if (!nutritionByFood[n.food_id]) nutritionByFood[n.food_id] = [];
      nutritionByFood[n.food_id].push(n);
    }
    const nutritionMap: Record<string, DBNutrition | undefined> = {};
    for (const [fid, rows] of Object.entries(nutritionByFood)) {
      nutritionMap[fid] = bestNutritionRow(rows);
    }

    // Suitability per food for active conditions only
    type SuitEntry = { ok: boolean; notes: string[]; maxServing: number | null };
    const suitMap: Record<string, SuitEntry> = {};

    // Index all suitability rows by food_id for age-gate check
    const suitByFood: Record<string, DBSuitability[]> = {};
    for (const row of suitability) {
      if (!suitByFood[row.food_id]) suitByFood[row.food_id] = [];
      suitByFood[row.food_id].push(row);

      // Only process rows whose condition matches this child
      if (!conditions.includes(row.condition as ClinicalCondition)) continue;

      if (!suitMap[row.food_id]) suitMap[row.food_id] = { ok: true, notes: [], maxServing: null };
      const entry = suitMap[row.food_id];

      if (row.suitability === 'avoid' || row.suitability === 'contraindicated') entry.ok = false;
      if (row.reason) entry.notes.push(row.reason);
      if (row.max_serving_g != null) {
        entry.maxServing = entry.maxServing == null
          ? row.max_serving_g
          : Math.min(entry.maxServing, row.max_serving_g);
      }
    }

    // Age-band conditions for age-gate logic
    const AGE_BAND_CONDITIONS = new Set([
      'infant_0_6m', 'infant_6_12m', 'infant_0_12m',
    ]);

    // ── Filter and enrich ────────────────────────────────────────────────────
    const eligible: EnrichedFood[] = [];

    for (const food of foods) {
      const group = groupMap[food.group_id];
      if (!group) continue;

      // Skip if any active condition explicitly excludes this food
      const suit = suitMap[food.id];
      if (suit && !suit.ok) continue;

      // Age gate: if a food has diet_suitability rows but ALL of them are for
      // OTHER age bands (not this child's age), exclude it.
      const foodSuitRows = suitByFood[food.id] ?? [];
      if (foodSuitRows.length > 0) {
        const allOtherAgeBands = foodSuitRows.every(r =>
          AGE_BAND_CONDITIONS.has(r.condition) &&
          !conditions.includes(r.condition as ClinicalCondition)
        );
        if (allOtherAgeBands) continue;
      }

      const nut = nutritionMap[food.id];
      const iron_mg = nut?.iron_mg ?? 0;
      const vit_a = nut?.vit_a_mcg_rae ?? 0;
      const vit_c = nut?.vit_c_mg ?? 0;
      const energy = nut?.energy_kcal ?? 0;
      const fat = nut?.fat_total_g ?? 0;
      const whoG = group.who_group.toLowerCase();
      const isAnimal =
            whoG === 'animal_source' || whoG === 'dairy';
      eligible.push({
        food_id: food.id,
        food_name: food.name_common,
        local_name: food.name_swahili ?? food.name_local ?? null,
        who_group: group.who_group,
        group_name: group.name,
        energy_kcal: nut?.energy_kcal ?? null,
        protein_g: nut?.protein_g ?? null,
        fat_total_g: nut?.fat_total_g ?? null,
        carbohydrate_g: nut?.carbohydrate_g ?? null,
        iron_mg: nut?.iron_mg ?? null,
        iron_heme_mg: nut?.iron_heme_mg ?? null,
        calcium_mg: nut?.calcium_mg ?? null,
        zinc_mg: nut?.zinc_mg ?? null,
        vit_a_mcg: nut?.vit_a_mcg_rae ?? null,
        vit_c_mg: nut?.vit_c_mg ?? null,
        omega3_g: nut?.fat_omega3_g ?? null,
        vit_b12_mcg: nut?.vit_b12_mcg ?? null,
        choline_mg: nut?.choline_mg ?? null,
        fibre_g: nut?.fibre_g ?? null,
        phytate_mg: nut?.phytate_mg ?? null,
        tannin_mg: nut?.tannin_mg ?? null,
        glycaemic_index: nut?.glycaemic_index ?? null,
        suitability_notes: suit?.notes ?? [],
        max_serving_g: suit?.maxServing ?? null,
        is_high_iron: iron_mg > 2,
        is_high_vit_a: vit_a > 100,
        is_high_vit_c: vit_c > 10,
        is_energy_dense: energy > 200 || fat > 10,
        is_animal_source: isAnimal,
        has_antinutrients: (nut?.phytate_mg ?? 0) > 200 || (nut?.tannin_mg ?? 0) > 50,
      });
    }

    // ── Group by who_group ───────────────────────────────────────────────────
    const byWhoGroup: Record<string, EnrichedFood[]> = {};
    for (const f of eligible) {
      if (!byWhoGroup[f.who_group]) byWhoGroup[f.who_group] = [];
      byWhoGroup[f.who_group].push(f);
    }

    // ── Resolve synergies between eligible foods only ────────────────────────
    const eligibleIds = new Set(eligible.map(f => f.food_id));
    const nameById: Record<string, string> = {};
    for (const f of eligible) nameById[f.food_id] = f.local_name ?? f.food_name;

    const resolvedSynergies: ResolvedSynergy[] = synergies
      .filter(s => eligibleIds.has(s.food_id) && eligibleIds.has(s.paired_food_id))
      .map(s => ({
        food_name: nameById[s.food_id] ?? s.food_id,
        paired_food_name: nameById[s.paired_food_id] ?? s.paired_food_id,
        nutrient: s.nutrient,
        notes: s.notes,
        effect_size: s.effect_size,
      }));

    // ── WHO energy targets (IYCF 2023) ───────────────────────────────────────
    let energyTarget = '200 kcal/day from complementary foods';
    if (ageMonths >= 9 && ageMonths < 12) energyTarget = '300 kcal/day from complementary foods';
    if (ageMonths >= 12 && ageMonths < 24) energyTarget = '550 kcal/day from complementary foods';
    if (ageMonths >= 24) energyTarget = '~1,000 kcal/day total';
    if (severity === 'critical') energyTarget += ' — INCREASE for SAM catch-up feeding';
    if (severity === 'moderate') energyTarget += ' — INCREASE for MAM energy-dense feeding';

    return {
      byWhoGroup,
      all: eligible,
      conditions,
      severity,
      synergies: resolvedSynergies,
      ageMonths,
      textureLabel: textureLabel(ageMonths),
      energyTarget,
    };
  },
}));