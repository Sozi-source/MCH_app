/**
 * src/hooks/useMealPlan.ts
 * ZuriHealth — DB-driven meal plan assembly hook.
 *
 * FIXES in this version:
 *   1. Throttle bug fixed — initial auto-load was being blocked because
 *      lastRefreshRef starts at 0 and the throttle check fired before
 *      the ref was updated. Now: auto-load always runs; throttle only
 *      applies to manual refresh() calls.
 *   2. Cache bust on manual refresh — calling refresh() now clears the
 *      AsyncStorage entry before regenerating, so users always get a
 *      fresh plan when they explicitly request one.
 *   3. getSlotsForAge: 6–8m slot count corrected to 3 meals (WHO IYCF:
 *      2–3 meals/day, 0 snacks). Already correct in previous version
 *      but now explicitly documented with WHO source.
 *   4. Groq API key sourced from env — no hardcoded fallback.
 *   5. Stale token check added to cache-hit path so a cancelled run
 *      can't overwrite a newer plan.
 *
 * Architecture:
 *   CODE selects all foods deterministically (clinical rules, age, conditions)
 *   AI (Groq via Supabase Edge Function) adds meal names + synergy notes only
 *   If AI fails, fallback English names are used — plan still renders
 *   Concurrency guard + cancellation token prevent race conditions
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useMealPlanStore,
  EnrichedFood,
  FoodPool,
  ClinicalCondition,
  SeverityTier,
  ZScores,
} from '@/store/nutritionMealPlanStore';

// ─── Cache ────────────────────────────────────────────────────────────────────

const PLAN_CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours

function cacheKey(childName: string, sex: string, ageMonths: number): string {
  return `mealplan:${childName}-${sex}-${ageMonths}`;
}

async function loadCachedPlan(key: string): Promise<GeneratedMealPlan | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const { plan, ts } = JSON.parse(raw);
    if (Date.now() - ts > PLAN_CACHE_TTL_MS) return null;
    return plan as GeneratedMealPlan;
  } catch {
    return null;
  }
}

async function saveCachedPlan(key: string, plan: GeneratedMealPlan): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify({ plan, ts: Date.now() }));
  } catch {
    // non-fatal
  }
}

async function clearCachedPlan(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // non-fatal
  }
}

// ─── Groq — via Supabase Edge Function ───────────────────────────────────────
// Calls the zuri-meal Edge Function so the API key stays server-side.

async function askGroqMeal(
  userMessage: string,
  systemPrompt: string,
  temp: number,
  retries = 3,
): Promise<string> {
  const supabaseUrl     = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(`${supabaseUrl}/functions/v1/zuri-meal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({ userMessage, systemPrompt, temperature: temp }),
    });

    if (res.status === 429) {
      const retryAfter = res.headers.get('retry-after');
      const waitMs = retryAfter
        ? parseFloat(retryAfter) * 1000
        : Math.min(1000 * 2 ** attempt, 30_000);
      console.warn(`[useMealPlan] 429 — waiting ${waitMs}ms (attempt ${attempt + 1}/${retries})`);
      await new Promise(r => setTimeout(r, waitMs));
      continue;
    }

    if (!res.ok) throw new Error(`zuri-meal Edge Function error: ${res.status}`);

    const data = await res.json();
    // Edge function returns { content: string } or Groq-shaped { choices: [...] }
    return data.content ?? data.choices?.[0]?.message?.content ?? '';
  }

  throw new Error(`zuri-meal: 429 after ${retries} retries`);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type MealSlotType =
  | 'Breakfast'
  | 'Morning snack'
  | 'Lunch'
  | 'Afternoon snack'
  | 'Dinner';

export interface MealSlot {
  type: MealSlotType;
  mealName: string;
  primaryFood: EnrichedFood;
  secondFood: EnrichedFood | null;
  thirdFood: EnrichedFood | null;
  nutrients: string[];
  synergyNote: string | null;
  isSnack: boolean;
}

export interface GeneratedMealPlan {
  slots: MealSlot[];
  conditions: ClinicalCondition[];
  severity: SeverityTier;
  requiresReferral: boolean;
  referralReason: string | null;
  textureLabel: string;
  energyTarget: string;
  isAiAssembled: boolean;
}

interface UseMealPlanOptions {
  childName: string;
  sex: 'male' | 'female';
  ageMonths: number;
  zscores: ZScores;
  enabled?: boolean;
}

export interface UseMealPlanResult {
  plan: GeneratedMealPlan | null;
  isLoading: boolean;
  error: string | null;
  isUsingFallback: boolean;
  refresh: () => void;
}

interface SlotSpec {
  type: MealSlotType;
  isSnack: boolean;
  primaryGroups: string[];
  secondGroups: string[];
  thirdGroups: string[];
}

interface AiSlotResult {
  slot_type: MealSlotType;
  meal_name: string;
  primary_food_id: string | null;
  second_food_id: string | null;
  third_food_id: string | null;
  synergy_note: string | null;
}

// ─── Slot specs by age ────────────────────────────────────────────────────────
// WHO IYCF 2023 meal frequency:
//   6–8m:   2–3 meals, 0 snacks
//   9–11m:  3–4 meals, 1–2 snacks
//   12–23m: 3–4 meals, 1–2 snacks
//   24–59m: 3 meals, 2 snacks

function getSlotsForAge(ageMonths: number): SlotSpec[] {
  // 6–8 months: 3 meals, no snacks (WHO IYCF 2023 — 2–3 meals/day)
  if (ageMonths < 9) {
    return [
      {
        type: 'Breakfast', isSnack: false,
        primaryGroups: ['grains_roots'],
        secondGroups:  ['dairy'],
        thirdGroups:   [],
      },
      {
        type: 'Lunch', isSnack: false,
        primaryGroups: ['grains_roots'],
        secondGroups:  ['animal_source', 'legumes_nuts'],
        thirdGroups:   ['vita_veg', 'other_veg'],
      },
      {
        type: 'Dinner', isSnack: false,
        primaryGroups: ['grains_roots'],
        secondGroups:  ['legumes_nuts', 'dairy'],
        thirdGroups:   ['vita_veg', 'other_veg'],
      },
    ];
  }

  // 9–11 months: 3–4 meals + 1 snack (WHO IYCF 2023)
  if (ageMonths < 12) {
    return [
      {
        type: 'Breakfast', isSnack: false,
        primaryGroups: ['grains_roots'],
        secondGroups:  ['dairy'],
        thirdGroups:   [],
      },
      {
        type: 'Morning snack', isSnack: true,
        primaryGroups: ['vita_fruit', 'other_fruit'],
        secondGroups:  [],
        thirdGroups:   [],
      },
      {
        type: 'Lunch', isSnack: false,
        primaryGroups: ['grains_roots'],
        secondGroups:  ['animal_source', 'legumes_nuts'],
        thirdGroups:   ['vita_veg', 'other_veg'],
      },
      {
        type: 'Dinner', isSnack: false,
        primaryGroups: ['grains_roots'],
        secondGroups:  ['legumes_nuts', 'animal_source'],
        thirdGroups:   ['vita_veg', 'other_veg'],
      },
    ];
  }

  // 12–23 months: 3–4 meals + 1–2 snacks (WHO IYCF 2023)
  if (ageMonths < 24) {
    return [
      {
        type: 'Breakfast', isSnack: false,
        primaryGroups: ['grains_roots'],
        secondGroups:  ['dairy'],
        thirdGroups:   [],
      },
      {
        type: 'Morning snack', isSnack: true,
        primaryGroups: ['vita_fruit', 'other_fruit'],
        secondGroups:  [],
        thirdGroups:   [],
      },
      {
        type: 'Lunch', isSnack: false,
        primaryGroups: ['grains_roots'],
        secondGroups:  ['animal_source', 'legumes_nuts'],
        thirdGroups:   ['vita_veg', 'other_veg'],
      },
      {
        type: 'Afternoon snack', isSnack: true,
        primaryGroups: ['vita_fruit', 'other_fruit'],
        secondGroups:  ['dairy'],
        thirdGroups:   [],
      },
      {
        type: 'Dinner', isSnack: false,
        primaryGroups: ['grains_roots'],
        secondGroups:  ['legumes_nuts', 'animal_source'],
        thirdGroups:   ['vita_veg', 'other_veg'],
      },
    ];
  }

  // 24–59 months: 3 meals + 2 snacks (WHO IYCF 2023)
  return [
    {
      type: 'Breakfast', isSnack: false,
      primaryGroups: ['grains_roots'],
      secondGroups:  ['dairy'],
      thirdGroups:   [],
    },
    {
      type: 'Morning snack', isSnack: true,
      primaryGroups: ['vita_fruit', 'other_fruit'],
      secondGroups:  [],
      thirdGroups:   [],
    },
    {
      type: 'Lunch', isSnack: false,
      primaryGroups: ['grains_roots'],
      secondGroups:  ['animal_source', 'legumes_nuts'],
      thirdGroups:   ['vita_veg', 'other_veg'],
    },
    {
      type: 'Afternoon snack', isSnack: true,
      primaryGroups: ['vita_fruit', 'other_fruit'],
      secondGroups:  ['dairy', 'legumes_nuts'],
      thirdGroups:   [],
    },
    {
      type: 'Dinner', isSnack: false,
      primaryGroups: ['grains_roots'],
      secondGroups:  ['animal_source', 'legumes_nuts'],
      thirdGroups:   ['vita_veg', 'other_veg'],
    },
  ];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeGroup(s: string): string {
  return s.toLowerCase().replace(/[\s,\-]+/g, '_');
}

function pickCandidates(
  byWhoGroup: Record<string, EnrichedFood[]>,
  groupPatterns: string[],
  limit = 6,
): EnrichedFood[] {
  if (groupPatterns.length === 0) return [];
  const candidates: EnrichedFood[] = [];
  for (const [key, foods] of Object.entries(byWhoGroup)) {
    const keyNorm = normalizeGroup(key);
    const matches = groupPatterns.some(p => {
      const pNorm = normalizeGroup(p);
      return keyNorm.includes(pNorm) || pNorm.includes(keyNorm);
    });
    if (matches) candidates.push(...foods);
  }
  return candidates
    .sort((a, b) => {
      if (a.is_high_iron && !b.is_high_iron) return -1;
      if (!a.is_high_iron && b.is_high_iron) return 1;
      return (b.energy_kcal ?? 0) - (a.energy_kcal ?? 0);
    })
    .slice(0, limit);
}

function nutrientTags(food: EnrichedFood): string[] {
  const tags: string[] = [];
  if (food.is_high_iron)                          tags.push('Iron');
  if (food.is_high_vit_a)                         tags.push('Vitamin A');
  if (food.is_high_vit_c)                         tags.push('Vitamin C');
  if (food.is_energy_dense)                       tags.push('Energy');
  if (food.omega3_g    && food.omega3_g    > 0.3) tags.push('Omega-3');
  if (food.zinc_mg     && food.zinc_mg     > 1)   tags.push('Zinc');
  if (food.calcium_mg  && food.calcium_mg  > 100) tags.push('Calcium');
  if (food.protein_g   && food.protein_g   > 5)   tags.push('Protein');
  if (food.vit_b12_mcg && food.vit_b12_mcg > 0.5) tags.push('B12');
  return tags.slice(0, 5);
}

function buildFallbackName(
  primary: EnrichedFood,
  second: EnrichedFood | null,
  third: EnrichedFood | null,
): string {
  return [primary, second, third]
    .filter(Boolean)
    .map(f => f!.local_name ?? f!.food_name)
    .join(' with ');
}

// ─── Referral logic ───────────────────────────────────────────────────────────

function buildReferral(pool: FoodPool): {
  requiresReferral: boolean;
  referralReason: string | null;
} {
  if (pool.conditions.includes('malnutrition_sam')) {
    return {
      requiresReferral: true,
      referralReason:
        'Severe Acute Malnutrition (SAM) detected. Immediate MCH clinic referral required for RUTF assessment and therapeutic feeding programme. Home diet alone is insufficient.',
    };
  }
  if (pool.conditions.includes('malnutrition_mam')) {
    return {
      requiresReferral: true,
      referralReason:
        'Moderate Acute Malnutrition (MAM) detected. Nutritionist review and supplementary feeding programme recommended. The meal plan above is supportive but not a substitute for clinical management.',
    };
  }
  if (pool.conditions.includes('stunting')) {
    return {
      requiresReferral: true,
      referralReason:
        'Stunting (chronic undernutrition) detected. A registered nutritionist review is recommended to assess dietary adequacy and micronutrient supplementation needs.',
    };
  }
  return { requiresReferral: false, referralReason: null };
}

// ─── Deterministic fallback plan (no AI) ─────────────────────────────────────

function pickRandom(
  byWhoGroup: Record<string, EnrichedFood[]>,
  groupPatterns: string[],
  usedIds: Set<string>,
  limit = 10,
): EnrichedFood | null {
  const candidates = pickCandidates(byWhoGroup, groupPatterns, limit)
    .filter(f => !usedIds.has(f.food_id));
  if (candidates.length === 0) return null;

  const shuffle = <T>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const priority = candidates.filter(f => f.is_high_iron || f.is_energy_dense);
  const normal   = candidates.filter(f => !f.is_high_iron && !f.is_energy_dense);
  const pool     = priority.length > 0
    ? [...shuffle(priority), ...shuffle(normal)]
    : shuffle(normal);

  return pool[0] ?? null;
}

function buildFallbackPlan(pool: FoodPool): MealSlot[] {
  const specs   = getSlotsForAge(pool.ageMonths);
  const usedIds = new Set<string>();
  const slots: MealSlot[] = [];

  for (const spec of specs) {
    const primary = pickRandom(pool.byWhoGroup, spec.primaryGroups, usedIds, 10);
    if (!primary) continue;
    usedIds.add(primary.food_id);

    const second = pickRandom(pool.byWhoGroup, spec.secondGroups, usedIds, 10);
    if (second) usedIds.add(second.food_id);

    const third = pickRandom(pool.byWhoGroup, spec.thirdGroups, usedIds, 10);
    if (third) usedIds.add(third.food_id);

    const allFoods  = [primary, second, third].filter(Boolean) as EnrichedFood[];
    const nutrients = [...new Set(allFoods.flatMap(nutrientTags))].slice(0, 5);

    slots.push({
      type:        spec.type,
      mealName:    buildFallbackName(primary, second, third),
      primaryFood: primary,
      secondFood:  second,
      thirdFood:   third,
      nutrients,
      synergyNote: null,
      isSnack:     spec.isSnack,
    });
  }

  return slots;
}

// ─── AI assembly ──────────────────────────────────────────────────────────────

async function assembleWithAI(
  pool: FoodPool,
  childName: string,
  sex: 'male' | 'female',
): Promise<AiSlotResult[] | null> {
  const slots = getSlotsForAge(pool.ageMonths);

  const slotCandidates = slots.map(spec => ({
    slot_type:          spec.type,
    is_snack:           spec.isSnack,
    primary_candidates: pickCandidates(pool.byWhoGroup, spec.primaryGroups, 6).map(f => ({
      id: f.food_id, name: f.local_name ?? f.food_name, group: f.who_group,
      energy_kcal: f.energy_kcal, iron_mg: f.iron_mg,
      protein_g: f.protein_g, vit_c_mg: f.vit_c_mg,
    })),
    second_candidates: pickCandidates(pool.byWhoGroup, spec.secondGroups, 5).map(f => ({
      id: f.food_id, name: f.local_name ?? f.food_name, group: f.who_group,
      energy_kcal: f.energy_kcal, iron_mg: f.iron_mg, protein_g: f.protein_g,
    })),
    third_candidates: pickCandidates(pool.byWhoGroup, spec.thirdGroups, 4).map(f => ({
      id: f.food_id, name: f.local_name ?? f.food_name, group: f.who_group,
      energy_kcal: f.energy_kcal,
    })),
  }));

  const synergySample = pool.synergies.slice(0, 10).map(s => ({
    food: s.food_name, pair: s.paired_food_name, note: s.notes,
  }));

  const systemPrompt = `You are a Kenya MCH clinical nutritionist assembling a one-day meal plan for ${childName} (${sex}, ${pool.ageMonths} months old) that a Kenyan mother would actually prepare at home.

CHILD PROFILE:
- Age: ${pool.ageMonths} months | Sex: ${sex}
- Clinical conditions: ${pool.conditions.join(', ') || 'none'}
- Severity: ${pool.severity} | Texture: ${pool.textureLabel}
- Daily energy target: ${pool.energyTarget}

KENYAN MEAL PATTERNS — follow strictly:
BREAKFAST: Warm uji (porridge) — wimbi, mtama, or maize uji. Enrich with maziwa or mala. No fish, meat, ugali, or raw fruit at breakfast.
MORNING SNACK: One fruit only — ndizi, embe, papai, or chungwa. Nothing heavy.
LUNCH: Main meal. Ugali + protein + green vegetable. Protein = dagaa, omena, tilapia, maharagwe, ndengu, nyama, or yai. Vegetable = sukuma wiki, mchicha, or majani ya boga.
AFTERNOON SNACK: Light only — fruit, maziwa, or ndizi na siagi ya karanga. Under 150 kcal.
DINNER: Soft ugali/wali/viazi + legumes or fish or meat + vegetable. Must use different foods from lunch.

PAIRING RULES:
- Dagaa/omena always with ugali. Never at breakfast or snack.
- Sukuma wiki and mchicha only with ugali or rice — never as a snack food.
- Fruits at snack time only — never as a third item in main meals.
- Never pair two starches (ugali + wali, ugali + viazi).
- Never pair two similar proteins (dagaa + omena, maharagwe + ndengu).

CLINICAL RULES:
- NEVER use the same food ID in more than one slot.
- Iron anaemia: pair iron-rich foods with a vitamin C source at the same meal.
- SAM/MAM: choose highest energy-dense foods — siagi ya karanga, maziwa, yai, omena.
- Cover at least 5 different WHO food groups across the day.

OUTPUT: Valid JSON array ONLY. No markdown, no preamble.
Each element: {"slot_type":"<exact slot type>","meal_name":"<short Kenyan name>","primary_food_id":"<id or null>","second_food_id":"<id or null>","third_food_id":"<id or null>","synergy_note":"<one sentence or null>"}`;

  const userMessage = `Slot candidates:\n${JSON.stringify(slotCandidates, null, 2)}\n\nKnown synergies:\n${JSON.stringify(synergySample, null, 2)}`;

  try {
    const rawText = await askGroqMeal(userMessage, systemPrompt, 0.3);
    const clean   = rawText.replace(/```json|```/gi, '').trim();
    const parsed: AiSlotResult[] = JSON.parse(clean);
    if (!Array.isArray(parsed)) return null;
    return parsed;
  } catch (err) {
    console.warn('[useMealPlan] AI assembly failed:', err);
    return null;
  }
}

// ─── Hydrate AI result into MealSlot[] ────────────────────────────────────────

function hydrateAiPlan(aiResults: AiSlotResult[], pool: FoodPool): MealSlot[] | null {
  const foodById: Record<string, EnrichedFood> = {};
  for (const f of pool.all) foodById[f.food_id] = f;

  const specByType: Record<string, SlotSpec> = {};
  for (const s of getSlotsForAge(pool.ageMonths)) specByType[s.type] = s;

  const usedIds = new Set<string>();
  const slots: MealSlot[] = [];

  for (const ai of aiResults) {
    if (!ai.primary_food_id) continue;
    const primary = foodById[ai.primary_food_id];
    if (!primary) {
      console.warn('[useMealPlan] Unknown food_id from AI:', ai.primary_food_id);
      continue;
    }
    if (usedIds.has(primary.food_id)) continue;
    usedIds.add(primary.food_id);

    const second =
      ai.second_food_id && !usedIds.has(ai.second_food_id)
        ? (foodById[ai.second_food_id] ?? null)
        : null;
    if (second) usedIds.add(second.food_id);

    const third =
      ai.third_food_id && !usedIds.has(ai.third_food_id)
        ? (foodById[ai.third_food_id] ?? null)
        : null;
    if (third) usedIds.add(third.food_id);

    const allFoods  = [primary, second, third].filter(Boolean) as EnrichedFood[];
    const nutrients = [...new Set(allFoods.flatMap(nutrientTags))].slice(0, 5);
    const spec      = specByType[ai.slot_type];

    slots.push({
      type:        ai.slot_type,
      mealName:    ai.meal_name ?? buildFallbackName(primary, second, third),
      primaryFood: primary,
      secondFood:  second,
      thirdFood:   third,
      nutrients,
      synergyNote: ai.synergy_note ?? null,
      isSnack:     spec?.isSnack ?? false,
    });
  }

  return slots.length >= 2 ? slots : null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/** Minimum time between manual refresh() calls. Auto-load is exempt. */
const MIN_MANUAL_REFRESH_MS = 5 * 60 * 1000;

export function useMealPlan({
  childName,
  sex,
  ageMonths,
  zscores,
  enabled = true,
}: UseMealPlanOptions): UseMealPlanResult {
  const fetchAll      = useMealPlanStore(s => s.fetchAll);
  const buildFoodPool = useMealPlanStore(s => s.buildFoodPool);
  const hydrated      = useMealPlanStore(s => s.hydrated);

  const [plan, setPlan]                       = useState<GeneratedMealPlan | null>(null);
  const [isLoading, setIsLoading]             = useState(false);
  const [error, setError]                     = useState<string | null>(null);
  const [isUsingFallback, setIsUsingFallback] = useState(false);

  const refreshTokenRef  = useRef(0);
  const isGeneratingRef  = useRef(false);
  const lastRefreshRef   = useRef(0);   // tracks last MANUAL refresh only

  const { waz, haz, whz } = zscores;
  const stableZscores = useMemo(() => ({ waz, haz, whz }), [waz, haz, whz]);
  const zscoresRef    = useRef(stableZscores);
  useEffect(() => { zscoresRef.current = stableZscores; }, [stableZscores]);

  const childNameRef = useRef(childName);
  useEffect(() => { childNameRef.current = childName; }, [childName]);

  const sexRef = useRef(sex);
  useEffect(() => { sexRef.current = sex; }, [sex]);

  /**
   * Core generate function.
   * @param forceRefresh — when true, busts cache and bypasses throttle.
   *   Auto-load passes false; the refresh() callback passes true.
   */
  const generate = useCallback(async (forceRefresh = false) => {
    if (!enabled) return;

    // Concurrency guard
    if (isGeneratingRef.current) return;
    isGeneratingRef.current = true;

    // Throttle — only applies to manual refresh calls
    if (forceRefresh) {
      const now = Date.now();
      if (now - lastRefreshRef.current < MIN_MANUAL_REFRESH_MS) {
        isGeneratingRef.current = false;
        return;
      }
      lastRefreshRef.current = now;
    }

    refreshTokenRef.current += 1;
    const token = refreshTokenRef.current;

    setIsLoading(true);
    setError(null);

    try {
      if (!hydrated) await fetchAll();

      const key = cacheKey(childNameRef.current, sexRef.current, ageMonths);

      // Bust cache on manual refresh so user always gets a fresh plan
      if (forceRefresh) await clearCachedPlan(key);

      // Cache hit — skip API entirely
      const cached = await loadCachedPlan(key);
      if (cached) {
        if (token !== refreshTokenRef.current) return;
        setPlan(cached);
        setIsUsingFallback(false);
        setError(null);
        return;
      }

      // Build food pool
      const pool = buildFoodPool(ageMonths, zscoresRef.current);
      if (pool.all.length === 0) {
        setError('No eligible foods found for this age. Please tap Refresh.');
        setIsUsingFallback(true);
        return;
      }

      // Try AI assembly first
      const aiResults = await assembleWithAI(pool, childNameRef.current, sexRef.current);
      const aiSlots   = aiResults ? hydrateAiPlan(aiResults, pool) : null;

      if (token !== refreshTokenRef.current) return;

      let finalSlots   = aiSlots;
      let isAiAssembled = true;

      if (!finalSlots || finalSlots.length < 2) {
        // Graceful fallback — code-assembled plan with no AI names
        finalSlots    = buildFallbackPlan(pool);
        isAiAssembled = false;
        if (finalSlots.length < 2) {
          setError('Could not assemble a plan. Please tap Refresh.');
          setIsUsingFallback(true);
          return;
        }
      }

      const { requiresReferral, referralReason } = buildReferral(pool);

      const finalPlan: GeneratedMealPlan = {
        slots: finalSlots,
        conditions: pool.conditions,
        severity:   pool.severity,
        requiresReferral,
        referralReason,
        textureLabel:  pool.textureLabel,
        energyTarget:  pool.energyTarget,
        isAiAssembled,
      };

      await saveCachedPlan(key, finalPlan);

      setPlan(finalPlan);
      setIsUsingFallback(!isAiAssembled);
      setError(null);

    } catch (err: any) {
      if (token !== refreshTokenRef.current) return;
      console.error('[useMealPlan] generate failed:', err);
      setError('Could not generate meal plan. Please tap Refresh to try again.');
      setIsUsingFallback(true);
    } finally {
      if (token === refreshTokenRef.current) setIsLoading(false);
      isGeneratingRef.current = false;
    }
  }, [enabled, hydrated, ageMonths, buildFoodPool, fetchAll]);

  // Auto-load on mount and when key inputs change.
  // Does NOT throttle — forceRefresh=false bypasses the throttle check.
  useEffect(() => {
    if (!enabled || !hydrated) return;
    const t = setTimeout(() => generate(false), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ageMonths, hydrated, enabled]);

  // Manual refresh — busts cache and respects throttle
  const refresh = useCallback(() => generate(true), [generate]);

  return { plan, isLoading, error, isUsingFallback, refresh };
}