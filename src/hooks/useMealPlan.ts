/**
 * src/hooks/useMealPlan.ts
 * ZuriHealth — DB-driven meal plan assembly hook.
 *
 * Architecture:
 *   1. CODE selects all foods deterministically (clinical rules, age, conditions)
 *   2. AI (Groq) only adds meal names + synergy notes — never picks foods
 *   3. If Groq fails, fallback English names are used — plan still works
 *   4. No cache read — always generates fresh
 *   5. Cache write kept so other parts of the app can read if needed
 *   6. Concurrency guard + cancellation token prevent race conditions
 *   7. Exponential back-off on Groq 429
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

// ─── Cache helpers ────────────────────────────────────────────────────────────

async function saveCachedPlan(key: string, plan: GeneratedMealPlan): Promise<void> {
  try {
    await AsyncStorage.setItem(
      `mealplan:${key}`,
      JSON.stringify({ plan, ts: Date.now() }),
    );
  } catch {
    // storage failures are non-fatal
  }
}

// ─── Groq API ─────────────────────────────────────────────────────────────────

async function askGroqMeal(
  userMessage: string,
  systemPrompt: string,
  temp: number,
  retries = 3,
): Promise<string> {
  const key = process.env.EXPO_PUBLIC_GROQ_MEAL_KEY || '';

  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + key,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: temp,
        max_tokens: 400,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      }),
    });

    if (res.status === 429) {
      const retryAfter = res.headers.get('retry-after');
      const waitMs = retryAfter
        ? parseFloat(retryAfter) * 1000
        : Math.min(1000 * 2 ** attempt, 30000);
      console.warn(
        `[Groq] 429 rate limited. Retrying in ${waitMs}ms (attempt ${attempt + 1}/${retries})`,
      );
      await new Promise(r => setTimeout(r, waitMs));
      continue;
    }

    if (!res.ok) throw new Error('Groq meal API error: ' + res.status);

    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
  }

  throw new Error('Groq meal API error: 429 after ' + retries + ' retries');
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

interface AiNameResult {
  slot_type: string;
  meal_name: string;
  synergy_note: string | null;
}

// ─── Slot specs by age ────────────────────────────────────────────────────────

function getSlotsForAge(ageMonths: number): SlotSpec[] {
  if (ageMonths < 9) {
    return [
      { type: 'Breakfast',     isSnack: false, primaryGroups: ['grains_roots'],              secondGroups: ['dairy'],                       thirdGroups: [] },
      { type: 'Lunch',         isSnack: false, primaryGroups: ['grains_roots'],              secondGroups: ['animal_source', 'legumes_nuts'], thirdGroups: ['vita_veg', 'other_veg'] },
      { type: 'Dinner',        isSnack: false, primaryGroups: ['grains_roots'],              secondGroups: ['legumes_nuts', 'dairy'],         thirdGroups: ['vita_veg', 'other_veg'] },
    ];
  }
  if (ageMonths < 12) {
    return [
      { type: 'Breakfast',     isSnack: false, primaryGroups: ['grains_roots'],              secondGroups: ['dairy'],                        thirdGroups: [] },
      { type: 'Morning snack', isSnack: true,  primaryGroups: ['vita_fruit', 'other_fruit'], secondGroups: [],                               thirdGroups: [] },
      { type: 'Lunch',         isSnack: false, primaryGroups: ['grains_roots'],              secondGroups: ['animal_source', 'legumes_nuts'], thirdGroups: ['vita_veg', 'other_veg'] },
      { type: 'Dinner',        isSnack: false, primaryGroups: ['grains_roots'],              secondGroups: ['legumes_nuts', 'animal_source'], thirdGroups: ['vita_veg', 'other_veg'] },
    ];
  }
  if (ageMonths < 24) {
    return [
      { type: 'Breakfast',       isSnack: false, primaryGroups: ['grains_roots'],              secondGroups: ['dairy'],                        thirdGroups: [] },
      { type: 'Morning snack',   isSnack: true,  primaryGroups: ['vita_fruit', 'other_fruit'], secondGroups: [],                               thirdGroups: [] },
      { type: 'Lunch',           isSnack: false, primaryGroups: ['grains_roots'],              secondGroups: ['animal_source', 'legumes_nuts'], thirdGroups: ['vita_veg', 'other_veg'] },
      { type: 'Afternoon snack', isSnack: true,  primaryGroups: ['vita_fruit', 'other_fruit'], secondGroups: ['dairy'],                         thirdGroups: [] },
      { type: 'Dinner',          isSnack: false, primaryGroups: ['grains_roots'],              secondGroups: ['legumes_nuts', 'animal_source'], thirdGroups: ['vita_veg', 'other_veg'] },
    ];
  }
  return [
    { type: 'Breakfast',       isSnack: false, primaryGroups: ['grains_roots'],              secondGroups: ['dairy'],                         thirdGroups: [] },
    { type: 'Morning snack',   isSnack: true,  primaryGroups: ['vita_fruit', 'other_fruit'], secondGroups: [],                                thirdGroups: [] },
    { type: 'Lunch',           isSnack: false, primaryGroups: ['grains_roots'],              secondGroups: ['animal_source', 'legumes_nuts'],  thirdGroups: ['vita_veg', 'other_veg'] },
    { type: 'Afternoon snack', isSnack: true,  primaryGroups: ['vita_fruit', 'other_fruit'], secondGroups: ['dairy', 'legumes_nuts'],          thirdGroups: [] },
    { type: 'Dinner',          isSnack: false, primaryGroups: ['grains_roots'],              secondGroups: ['animal_source', 'legumes_nuts'],  thirdGroups: ['vita_veg', 'other_veg'] },
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
  if (food.is_high_iron)                        tags.push('Iron');
  if (food.is_high_vit_a)                       tags.push('Vitamin A');
  if (food.is_high_vit_c)                       tags.push('Vitamin C');
  if (food.is_energy_dense)                     tags.push('Energy');
  if (food.omega3_g   && food.omega3_g   > 0.3) tags.push('Omega-3');
  if (food.zinc_mg    && food.zinc_mg    > 1)   tags.push('Zinc');
  if (food.calcium_mg && food.calcium_mg > 100) tags.push('Calcium');
  if (food.protein_g  && food.protein_g  > 5)   tags.push('Protein');
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
    .map(f => f!.food_name)
    .join(' with ');
}

// ─── Referral logic ───────────────────────────────────────────────────────────

function buildReferral(pool: FoodPool): { requiresReferral: boolean; referralReason: string | null } {
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

// ─── STEP 1: Code assembles the plan deterministically ───────────────────────

function pickRandom(
  byWhoGroup: Record<string, EnrichedFood[]>,
  groupPatterns: string[],
  usedIds: Set<string>,
  limit = 10,
): EnrichedFood | null {
  const candidates = pickCandidates(byWhoGroup, groupPatterns, limit)
    .filter(f => !usedIds.has(f.food_id));
  if (candidates.length === 0) return null;

  const priority = candidates.filter(f => f.is_high_iron || f.is_energy_dense);
  const normal   = candidates.filter(f => !f.is_high_iron && !f.is_energy_dense);

  const shuffle = <T>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const pool = priority.length > 0
    ? [...shuffle(priority), ...shuffle(normal)]
    : shuffle(normal);

  return pool[0] ?? null;
}

function buildMealPlan(pool: FoodPool): MealSlot[] {
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

    const allFoods = [primary, second, third].filter(Boolean) as EnrichedFood[];
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

// ─── STEP 2: AI adds meal names + synergy notes only ─────────────────────────

async function nameMealsWithAI(
  slots: MealSlot[],
  pool: FoodPool,
  childName: string,
  sex: 'male' | 'female',
): Promise<MealSlot[]> {
  const slotSummaries = slots.map(s => ({
    slot_type: s.type,
    primary:   s.primaryFood.food_name,
    second:    s.secondFood?.food_name ?? null,
    third:     s.thirdFood?.food_name  ?? null,
  }));

  const systemPrompt = `You are a Kenyan MCH nutritionist writing meal labels for a mobile app.

You will receive a list of meal slots. The foods in each slot have already been chosen by the system — do NOT suggest different foods or change what is listed.

Your ONLY job:
1. Give each slot a short natural English meal name (e.g. "Maize Porridge with Milk" or "Ugali with Sardines and Kale")
2. Write ONE plain English sentence explaining the nutritional benefit of that specific combination.

OUTPUT: Valid JSON array only. No markdown, no explanation, no preamble.
Each element: {"slot_type":"<exact slot_type string>","meal_name":"<short name>","synergy_note":"<one sentence or null>"}`;

  const userMessage = `Child: ${childName}, ${sex}, ${pool.ageMonths} months
Conditions: ${pool.conditions.join(', ') || 'none'}

Meals to name:
${JSON.stringify(slotSummaries, null, 2)}`;

  try {
    const rawText = await askGroqMeal(userMessage, systemPrompt, 0.4);
    const clean   = rawText.replace(/```json|```/gi, '').trim();
    const named: AiNameResult[] = JSON.parse(clean);
    if (!Array.isArray(named)) return slots;

    const nameMap = Object.fromEntries(named.map(n => [n.slot_type, n]));
    return slots.map(s => ({
      ...s,
      mealName:    nameMap[s.type]?.meal_name    ?? s.mealName,
      synergyNote: nameMap[s.type]?.synergy_note ?? null,
    }));
  } catch (err) {
    console.warn('[useMealPlan] AI naming failed, using fallback names:', err);
    return slots;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

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

  const refreshTokenRef = useRef(0);
  const isGeneratingRef = useRef(false);

  const { waz, haz, whz } = zscores;
  const stableZscores = useMemo(() => ({ waz, haz, whz }), [waz, haz, whz]);
  const zscoresRef = useRef(stableZscores);
  useEffect(() => { zscoresRef.current = stableZscores; }, [stableZscores]);

  const childNameRef = useRef(childName);
  useEffect(() => { childNameRef.current = childName; }, [childName]);

  const sexRef = useRef(sex);
  useEffect(() => { sexRef.current = sex; }, [sex]);

  const generate = useCallback(async () => {
    if (!enabled) return;

    if (isGeneratingRef.current) return;
    isGeneratingRef.current = true;

    refreshTokenRef.current += 1;
    const token = refreshTokenRef.current;

    setIsLoading(true);
    setError(null);

    try {
      if (!hydrated) await fetchAll();

      const pool = buildFoodPool(ageMonths, zscoresRef.current);
      if (pool.all.length === 0) {
        setError('No eligible foods found for this age and conditions. Please tap Refresh.');
        setIsUsingFallback(true);
        return;
      }

      const codeSlots = buildMealPlan(pool);
      if (codeSlots.length < 2) {
        setError('Could not assemble a plan from available foods. Please tap Refresh.');
        setIsUsingFallback(true);
        return;
      }

      const namedSlots = await nameMealsWithAI(
        codeSlots,
        pool,
        childNameRef.current,
        sexRef.current,
      );

      if (token !== refreshTokenRef.current) return;

      const { referralReason, requiresReferral } = buildReferral(pool);
      const finalPlan: GeneratedMealPlan = {
        slots:           namedSlots,
        conditions:      pool.conditions,
        severity:        pool.severity,
        requiresReferral,
        referralReason,
        textureLabel:    pool.textureLabel,
        energyTarget:    pool.energyTarget,
        isAiAssembled:   false,
      };

      const cacheKey = `${childNameRef.current}-${sexRef.current}-${ageMonths}`;
      await saveCachedPlan(cacheKey, finalPlan);

      setPlan(finalPlan);
      setIsUsingFallback(false);
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

  useEffect(() => {
    if (!enabled || !hydrated) return;
    const t = setTimeout(() => generate(), 300);
    return () => clearTimeout(t);
  }, [ageMonths, hydrated, enabled, generate]);

  return { plan, isLoading, error, isUsingFallback, refresh: generate };
}