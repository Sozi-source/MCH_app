/**
 * src/store/nutritionMealPlanStore.ts
 *
 * ZuriHealth — DB-driven meal plan food pool builder.
 *
 * Changes in this version:
 *   - fetchAll now fetches user_foods for the authenticated user
 *   - buildFoodPool merges user_foods into the eligible pool alongside
 *     curated WHO foods — exchange-list energy defaults applied when
 *     the user left nutrition fields blank
 *   - DBUserFood type added; EnrichedFood gains is_user_added flag
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
  is_ingredient: boolean;
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

/** A food added by the user from the Add Food modal. */
export interface DBUserFood {
  id: string;                       // 'USR_xxxxxxxx'
  user_id: string;
  name_common: string;
  name_swahili: string | null;
  name_local: string | null;
  who_group: string;
  sub_group: string | null;
  energy_kcal: number | null;
  protein_g: number | null;
  fat_total_g: number | null;
  carbohydrate_g: number | null;
  iron_mg: number | null;
  vit_a_mcg: number | null;
  vit_c_mg: number | null;
  calcium_mg: number | null;
  zinc_mg: number | null;
  fibre_g: number | null;
  typical_form: string | null;
  prep_notes: string | null;
  where_found: string | null;
  price_tier: string | null;
  season: string | null;
  is_active: boolean;
}

// ─── EXCHANGE ENERGY DEFAULTS ──────────────────────────────────────────────────
// WHO/ADA Choose Your Foods exchange list (2022), per 100g cooked portion.
// Applied when the user leaves nutrition fields blank.

interface ExchangeDefaults {
  energy_kcal: number;
  protein_g: number;
  fat_total_g: number;
  carbohydrate_g: number;
  iron_mg: number;
  vit_a_mcg: number;
  vit_c_mg: number;
  calcium_mg: number;
  zinc_mg: number;
  fibre_g: number;
}

const EXCHANGE_DEFAULTS: Record<string, ExchangeDefaults> = {
  grains_roots:  { energy_kcal: 80,  protein_g: 3.0, fat_total_g: 1.0,   carbohydrate_g: 15, iron_mg: 1.5, vit_a_mcg: 0,   vit_c_mg: 0,  calcium_mg: 10,  zinc_mg: 0.5, fibre_g: 1.0 },
  legumes_nuts:  { energy_kcal: 110, protein_g: 7.0, fat_total_g: 3.0,   carbohydrate_g: 15, iron_mg: 3.0, vit_a_mcg: 0,   vit_c_mg: 1,  calcium_mg: 40,  zinc_mg: 1.0, fibre_g: 3.5 },
  dairy:         { energy_kcal: 150, protein_g: 8.0, fat_total_g: 8.0,   carbohydrate_g: 12, iron_mg: 0.1, vit_a_mcg: 50,  vit_c_mg: 2,  calcium_mg: 120, zinc_mg: 0.5, fibre_g: 0.0 },
  animal_source: { energy_kcal: 45,  protein_g: 7.0, fat_total_g: 2.0,   carbohydrate_g: 0,  iron_mg: 1.2, vit_a_mcg: 20,  vit_c_mg: 0,  calcium_mg: 10,  zinc_mg: 1.5, fibre_g: 0.0 },
  vita_veg:      { energy_kcal: 25,  protein_g: 2.0, fat_total_g: 0.0,   carbohydrate_g: 5,  iron_mg: 1.8, vit_a_mcg: 400, vit_c_mg: 30, calcium_mg: 40,  zinc_mg: 0.3, fibre_g: 2.0 },
  vita_fruit:    { energy_kcal: 60,  protein_g: 0.5, fat_total_g: 0.0,   carbohydrate_g: 15, iron_mg: 0.5, vit_a_mcg: 200, vit_c_mg: 50, calcium_mg: 15,  zinc_mg: 0.2, fibre_g: 1.5 },
  other_veg:     { energy_kcal: 25,  protein_g: 2.0, fat_total_g: 0.0,   carbohydrate_g: 5,  iron_mg: 0.8, vit_a_mcg: 20,  vit_c_mg: 15, calcium_mg: 30,  zinc_mg: 0.3, fibre_g: 2.0 },
  other_fruit:   { energy_kcal: 60,  protein_g: 0.5, fat_total_g: 0.0,   carbohydrate_g: 15, iron_mg: 0.3, vit_a_mcg: 10,  vit_c_mg: 15, calcium_mg: 10,  zinc_mg: 0.1, fibre_g: 1.5 },
  fats_oils:     { energy_kcal: 900, protein_g: 0.0, fat_total_g: 100.0, carbohydrate_g: 0,  iron_mg: 0.0, vit_a_mcg: 0,   vit_c_mg: 0,  calcium_mg: 0,   zinc_mg: 0.0, fibre_g: 0.0 },
};

function getExchangeDefault(whoGroup: string): ExchangeDefaults {
  return EXCHANGE_DEFAULTS[whoGroup] ?? EXCHANGE_DEFAULTS['other_veg'];
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

const ALL_AGE_BAND_CONDITIONS = new Set<ClinicalCondition | string>([
  'infant_0_6m',
  'infant_6_12m',
  'infant_0_12m',
  'child_12_23m',
  'child_24_59m',
]);

export function deriveConditions(ageMonths: number, z: ZScores): ClinicalCondition[] {
  const c: ClinicalCondition[] = [];

  if (ageMonths >= 6  && ageMonths < 12) c.push('infant_6_12m');
  if (ageMonths >= 12 && ageMonths < 24) c.push('child_12_23m');
  if (ageMonths >= 24 && ageMonths < 60) c.push('child_24_59m');

  if (ageMonths >= 6 && ageMonths < 60) c.push('anaemia_iron');

  const isSAM = z.whz != null ? z.whz < -3 : z.waz != null && z.waz < -3;
  const isMAM = !isSAM && (z.whz != null ? z.whz < -2 : z.waz != null && z.waz < -2);

  if (isSAM) c.push('malnutrition_sam');
  if (isMAM) c.push('malnutrition_mam');
  if (z.haz != null && z.haz < -2) c.push('stunting');
  if (z.whz != null && z.whz > 2)  c.push('overweight');

  return c;
}

export function deriveSeverity(conditions: ClinicalCondition[]): SeverityTier {
  if (conditions.includes('malnutrition_sam')) return 'critical';
  if (conditions.includes('malnutrition_mam')) return 'moderate';
  if (conditions.includes('stunting'))         return 'stunted';
  return 'normal';
}

export function getTextureLabel(ageMonths: number): string {
  if (ageMonths < 7)  return 'Smooth purée — no lumps';
  if (ageMonths < 9)  return 'Mashed / soft purée';
  if (ageMonths < 12) return 'Minced / soft finger foods';
  if (ageMonths < 24) return 'Soft family foods';
  return 'Family foods';
}

export function getEnergyTarget(ageMonths: number, severity: SeverityTier): string {
  let base: string;
  if (ageMonths < 9)       base = '200 kcal/day from complementary foods';
  else if (ageMonths < 12) base = '300 kcal/day from complementary foods';
  else if (ageMonths < 24) base = '550 kcal/day from complementary foods';
  else                     base = '~1,000 kcal/day total';

  if (severity === 'critical') return base + ' — INCREASE for SAM catch-up feeding';
  if (severity === 'moderate') return base + ' — INCREASE for MAM energy-dense feeding';
  return base;
}

// ─── WHO food groups excluded from meal planning ──────────────────────────────

const EXCLUDED_WHO_GROUPS = new Set([
  'processed',
  'beverages',
  'condiments',
  'sugars',
]);

// ─── ENRICHED FOOD ─────────────────────────────────────────────────────────────

export interface EnrichedFood {
  food_id: string;
  food_name: string;
  local_name: string | null;
  who_group: string;
  group_name: string;
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
  suitability_notes: string[];
  max_serving_g: number | null;
  is_high_iron: boolean;
  is_high_vit_a: boolean;
  is_high_vit_c: boolean;
  is_energy_dense: boolean;
  is_animal_source: boolean;
  has_antinutrients: boolean;
  /** true for foods the parent added themselves */
  is_user_added: boolean;
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
  userFoods: DBUserFood[];
  loading: boolean;
  error: string | null;
  hydrated: boolean;
  fetchAll: () => Promise<void>;
  refetchUserFoods: () => Promise<void>;
  buildFoodPool: (ageMonths: number, zscores: ZScores) => FoodPool;
}

const PREP_PRIORITY = [
  'dried', 'boiled', 'cooked', 'steamed', 'roasted',
  'fermented', 'raw', 'fresh',
];

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

/** Convert a DBUserFood row into EnrichedFood, filling blanks from exchange defaults. */
function enrichUserFood(uf: DBUserFood): EnrichedFood {
  const def = getExchangeDefault(uf.who_group);

  const energy = uf.energy_kcal ?? def.energy_kcal;
  const fat    = uf.fat_total_g ?? def.fat_total_g;
  const iron   = uf.iron_mg     ?? def.iron_mg;
  const vit_a  = uf.vit_a_mcg   ?? def.vit_a_mcg;
  const vit_c  = uf.vit_c_mg    ?? def.vit_c_mg;
  const whoG   = uf.who_group.toLowerCase();

  return {
    food_id:          uf.id,
    food_name:        uf.name_common,
    local_name:       uf.name_swahili ?? uf.name_local ?? null,
    who_group:        uf.who_group,
    group_name:       whoGroupLabel(uf.who_group),
    energy_kcal:      energy,
    protein_g:        uf.protein_g     ?? def.protein_g,
    fat_total_g:      fat,
    carbohydrate_g:   uf.carbohydrate_g ?? def.carbohydrate_g,
    iron_mg:          iron,
    iron_heme_mg:     null,
    calcium_mg:       uf.calcium_mg    ?? def.calcium_mg,
    zinc_mg:          uf.zinc_mg       ?? def.zinc_mg,
    vit_a_mcg:        vit_a,
    vit_c_mg:         vit_c,
    omega3_g:         null,
    vit_b12_mcg:      null,
    choline_mg:       null,
    fibre_g:          uf.fibre_g       ?? def.fibre_g,
    phytate_mg:       null,
    tannin_mg:        null,
    glycaemic_index:  null,
    suitability_notes:[],
    max_serving_g:    null,
    is_high_iron:     iron > 2,
    is_high_vit_a:    vit_a > 100,
    is_high_vit_c:    vit_c > 10,
    is_energy_dense:  energy > 200 || fat > 10,
    is_animal_source: whoG === 'animal_source' || whoG === 'dairy',
    has_antinutrients:false,
    is_user_added:    true,
  };
}

/** Human-readable label for a who_group string. */
function whoGroupLabel(whoGroup: string): string {
  const LABELS: Record<string, string> = {
    grains_roots:  'Grains & Roots',
    legumes_nuts:  'Legumes & Nuts',
    dairy:         'Dairy',
    animal_source: 'Meat, Fish & Eggs',
    vita_veg:      'Vitamin A Vegetables',
    vita_fruit:    'Vitamin A Fruits',
    other_veg:     'Other Vegetables',
    other_fruit:   'Other Fruits',
    fats_oils:     'Fats & Oils',
  };
  return LABELS[whoGroup] ?? whoGroup;
}

export const useMealPlanStore = create<MealPlanStoreState>((set, get) => ({
  foods:      [],
  foodGroups: [],
  nutrition:  [],
  suitability:[],
  synergies:  [],
  userFoods:  [],
  loading:    false,
  error:      null,
  hydrated:   false,

  fetchAll: async () => {
    if (get().hydrated) return;
    set({ loading: true, error: null });
    try {
      const [
        { data: foods,       error: e1 },
        { data: foodGroups,  error: e2 },
        { data: nutrition,   error: e3 },
        { data: suitability, error: e4 },
        { data: synergies,   error: e5 },
        { data: userFoods,   error: e6 },
      ] = await Promise.all([
        supabase.from('foods').select('*').eq('is_ingredient', false),  // ← excludes raw flours/grains
        supabase.from('food_groups').select('*'),
        supabase.from('nutrition_per_100g').select('*'),
        supabase.from('diet_suitability').select('*'),
        supabase.from('food_synergies').select('*'),
        supabase.from('user_foods').select('*').eq('is_active', true),
      ]);

      const firstErr = [e1, e2, e3, e4, e5, e6].find(Boolean);
      if (firstErr) console.warn('[mealPlanStore] Supabase error:', firstErr.message);

      set({
        foods:       (foods       ?? []) as DBFood[],
        foodGroups:  (foodGroups  ?? []) as DBFoodGroup[],
        nutrition:   (nutrition   ?? []) as DBNutrition[],
        suitability: (suitability ?? []) as DBSuitability[],
        synergies:   (synergies   ?? []) as DBSynergy[],
        userFoods:   (userFoods   ?? []) as DBUserFood[],
        hydrated:    true,
        error:       firstErr?.message ?? null,
      });
    } catch (err: any) {
      set({ error: err?.message ?? 'Failed to load food database' });
      console.error('[mealPlanStore] fetchAll failed:', err);
    } finally {
      set({ loading: false });
    }
  },

  /** Re-fetch only user_foods — called after adding/deleting a food. */
  refetchUserFoods: async () => {
    const { data, error } = await supabase
      .from('user_foods')
      .select('*')
      .eq('is_active', true);

    if (error) {
      console.warn('[mealPlanStore] refetchUserFoods error:', error.message);
      return;
    }
    set({ userFoods: (data ?? []) as DBUserFood[] });
  },

  buildFoodPool: (ageMonths, zscores) => {
    const { foods, foodGroups, nutrition, suitability, synergies, userFoods } = get();

    const conditions = deriveConditions(ageMonths, zscores);
    const severity   = deriveSeverity(conditions);

    const childAgeBands = new Set<string>(
      conditions.filter(c => ALL_AGE_BAND_CONDITIONS.has(c))
    );

    // ── Lookup maps ──────────────────────────────────────────────────────────

    const groupMap: Record<number, DBFoodGroup> = {};
    for (const g of foodGroups) groupMap[g.id] = g;

    const nutritionByFood: Record<string, DBNutrition[]> = {};
    for (const n of nutrition) {
      if (!nutritionByFood[n.food_id]) nutritionByFood[n.food_id] = [];
      nutritionByFood[n.food_id].push(n);
    }
    const nutritionMap: Record<string, DBNutrition | undefined> = {};
    for (const [fid, rows] of Object.entries(nutritionByFood)) {
      nutritionMap[fid] = bestNutritionRow(rows);
    }

    // ── Suitability index ────────────────────────────────────────────────────

    const suitByFood: Record<string, DBSuitability[]> = {};
    for (const row of suitability) {
      if (!suitByFood[row.food_id]) suitByFood[row.food_id] = [];
      suitByFood[row.food_id].push(row);
    }

    type SuitEntry = { ok: boolean; notes: string[]; maxServing: number | null };
    const conditionSet = new Set<string>(conditions);
    const suitMap: Record<string, SuitEntry> = {};

    for (const row of suitability) {
      if (!conditionSet.has(row.condition)) continue;

      if (!suitMap[row.food_id]) {
        suitMap[row.food_id] = { ok: true, notes: [], maxServing: null };
      }
      const entry = suitMap[row.food_id];

      if (row.suitability === 'avoid' || row.suitability === 'contraindicated') {
        entry.ok = false;
      }
      if (row.reason) entry.notes.push(row.reason);
      if (row.max_serving_g != null) {
        entry.maxServing = entry.maxServing == null
          ? row.max_serving_g
          : Math.min(entry.maxServing, row.max_serving_g);
      }
    }

    // ── Enrich curated WHO foods ─────────────────────────────────────────────
    // foods[] is already filtered to is_ingredient=false at fetch time.

    const eligible: EnrichedFood[] = [];

    for (const food of foods) {
      const group = groupMap[food.group_id];
      if (!group) continue;
      if (EXCLUDED_WHO_GROUPS.has(group.who_group)) continue;

      const suit = suitMap[food.id];
      if (suit && !suit.ok) continue;

      const foodSuitRows = suitByFood[food.id] ?? [];
      if (foodSuitRows.length > 0) {
        const allRowsAreOtherAgeBands = foodSuitRows.every(row => {
          const isAgeBandRow = ALL_AGE_BAND_CONDITIONS.has(row.condition);
          const matchesChild = childAgeBands.has(row.condition);
          return isAgeBandRow && !matchesChild;
        });
        if (allRowsAreOtherAgeBands) continue;
      }

      const nut    = nutritionMap[food.id];
      const iron   = nut?.iron_mg ?? 0;
      const vit_a  = nut?.vit_a_mcg_rae ?? 0;
      const vit_c  = nut?.vit_c_mg ?? 0;
      const energy = nut?.energy_kcal ?? 0;
      const fat    = nut?.fat_total_g ?? 0;
      const whoG   = group.who_group.toLowerCase();

      eligible.push({
        food_id:          food.id,
        food_name:        food.name_common,
        local_name:       food.name_swahili ?? food.name_local ?? null,
        who_group:        group.who_group,
        group_name:       group.name,
        energy_kcal:      nut?.energy_kcal     ?? null,
        protein_g:        nut?.protein_g        ?? null,
        fat_total_g:      nut?.fat_total_g      ?? null,
        carbohydrate_g:   nut?.carbohydrate_g   ?? null,
        iron_mg:          nut?.iron_mg           ?? null,
        iron_heme_mg:     nut?.iron_heme_mg      ?? null,
        calcium_mg:       nut?.calcium_mg        ?? null,
        zinc_mg:          nut?.zinc_mg           ?? null,
        vit_a_mcg:        nut?.vit_a_mcg_rae     ?? null,
        vit_c_mg:         nut?.vit_c_mg          ?? null,
        omega3_g:         nut?.fat_omega3_g      ?? null,
        vit_b12_mcg:      nut?.vit_b12_mcg       ?? null,
        choline_mg:       nut?.choline_mg        ?? null,
        fibre_g:          nut?.fibre_g           ?? null,
        phytate_mg:       nut?.phytate_mg        ?? null,
        tannin_mg:        nut?.tannin_mg         ?? null,
        glycaemic_index:  nut?.glycaemic_index   ?? null,
        suitability_notes:suit?.notes            ?? [],
        max_serving_g:    suit?.maxServing        ?? null,
        is_high_iron:     iron > 2,
        is_high_vit_a:    vit_a > 100,
        is_high_vit_c:    vit_c > 10,
        is_energy_dense:  energy > 200 || fat > 10,
        is_animal_source: whoG === 'animal_source' || whoG === 'dairy',
        has_antinutrients:(nut?.phytate_mg ?? 0) > 200 || (nut?.tannin_mg ?? 0) > 50,
        is_user_added:    false,
      });
    }

    // ── Merge user_foods ─────────────────────────────────────────────────────

    for (const uf of userFoods) {
      if (!uf.is_active) continue;
      if (EXCLUDED_WHO_GROUPS.has(uf.who_group)) continue;
      eligible.push(enrichUserFood(uf));
    }

    // ── Group by who_group ───────────────────────────────────────────────────

    const byWhoGroup: Record<string, EnrichedFood[]> = {};
    for (const f of eligible) {
      if (!byWhoGroup[f.who_group]) byWhoGroup[f.who_group] = [];
      byWhoGroup[f.who_group].push(f);
    }

    // ── Resolve synergies ────────────────────────────────────────────────────

    const eligibleIds = new Set(eligible.map(f => f.food_id));
    const nameById: Record<string, string> = {};
    for (const f of eligible) nameById[f.food_id] = f.local_name ?? f.food_name;

    const resolvedSynergies: ResolvedSynergy[] = synergies
      .filter(s => eligibleIds.has(s.food_id) && eligibleIds.has(s.paired_food_id))
      .map(s => ({
        food_name:        nameById[s.food_id]        ?? s.food_id,
        paired_food_name: nameById[s.paired_food_id] ?? s.paired_food_id,
        nutrient:         s.nutrient,
        notes:            s.notes,
        effect_size:      s.effect_size,
      }));

    return {
      byWhoGroup,
      all: eligible,
      conditions,
      severity,
      synergies:   resolvedSynergies,
      ageMonths,
      textureLabel: getTextureLabel(ageMonths),
      energyTarget: getEnergyTarget(ageMonths, severity),
    };
  },
}));