/**
 * src/components/nutrition/AddFoodModal.tsx
 * ZuriHealth — Add Local / Composite Food
 *
 * Flow:
 *   Step 1 — User enters dish name + free-text ingredients
 *   Step 2 — Groq matches ingredients to Kenya food database entries,
 *             returns matched WHO food groups (no ratios, no nutrient numbers)
 *   Step 3 — User confirms matched groups + optional context fields → save
 *
 * Composite foods are stored with:
 *   who_groups TEXT[]   — all matched groups (used for MDD diversity scoring)
 *   who_group  TEXT     — primary group (used for meal slot assignment, nullable)
 *   is_composite BOOL   — true for multi-ingredient dishes
 *   ingredients_raw TEXT — what the user typed (for display/audit)
 *
 * Nutrient values are NOT calculated for composite dishes — only WHO group
 * credits are stored. This is clinically honest: ratio uncertainty makes
 * per-nutrient estimates unreliable. MDD scoring does not require ratios.
 *
 * Sources: WHO IYCF MDD scoring methodology · Kenya MoH MIYCN 2023–2028
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Modal, ActivityIndicator, KeyboardAvoidingView,
  Platform, Alert, StyleSheet, Animated, Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { COLORS, FONTS, RADIUS } from '@/lib/theme';

// ─── WHO MDD food group metadata ──────────────────────────────────────────────

interface WHOGroup {
  key: string;
  label: string;
  emoji: string;
  color: string;
  bg: string;
  examples: string;
}

const WHO_GROUPS: WHOGroup[] = [
  { key: 'grains_roots',   label: 'Grains & Roots',      emoji: '🌾', color: '#E65100', bg: '#FFF3E0', examples: 'Maize, wheat, rice, potato, cassava, yam' },
  { key: 'legumes_nuts',   label: 'Legumes & Nuts',       emoji: '🫘', color: '#2E7D32', bg: '#E8F5E9', examples: 'Beans, lentils, peas, groundnuts, cowpeas' },
  { key: 'dairy',          label: 'Dairy',                emoji: '🥛', color: '#1565C0', bg: '#E3F2FD', examples: 'Milk, yoghurt, cheese' },
  { key: 'animal_source',  label: 'Meat, Fish & Eggs',    emoji: '🥚', color: '#6A1B9A', bg: '#F3E5F5', examples: 'Beef, chicken, omena, tilapia, eggs, liver' },
  { key: 'vita_veg',       label: 'Vit A Vegetables',     emoji: '🥕', color: '#558B2F', bg: '#F1F8E9', examples: 'Pumpkin leaves, spinach, kale, carrots' },
  { key: 'vita_fruit',     label: 'Vit A Fruits',         emoji: '🥭', color: '#F57F17', bg: '#FFFDE7', examples: 'Mango, papaya, passion fruit' },
  { key: 'other_veg',      label: 'Other Vegetables',     emoji: '🥦', color: '#00695C', bg: '#E0F2F1', examples: 'Tomato, onion, pepper, aubergine, okra' },
  { key: 'other_fruit',    label: 'Other Fruits',         emoji: '🍌', color: '#AD1457', bg: '#FCE4EC', examples: 'Banana, orange, guava, apple' },
  { key: 'fats_oils',      label: 'Fats & Oils',          emoji: '🫒', color: '#4E342E', bg: '#EFEBE9', examples: 'Cooking oil, peanut butter, avocado' },
];

const GROUP_MAP = Object.fromEntries(WHO_GROUPS.map(g => [g.key, g]));

// ─── Groq ingredient matcher ──────────────────────────────────────────────────

const GROQ_URL     = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL   = 'llama3-8b-8192';

// Two API keys — use meal key to avoid conflicting with chat usage
const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_MEAL_KEY
                  ?? process.env.EXPO_PUBLIC_GROQ_API_KEY
                  ?? '';

interface MatchResult {
  matched_groups: string[];      // WHO group keys present in the dish
  primary_group:  string;        // dominant group for slot assignment
  unrecognised:   string[];      // ingredients the model couldn't place
  confidence:     'high' | 'medium' | 'low';
}

async function matchIngredientsToGroups(
  dishName: string,
  ingredientsText: string,
): Promise<MatchResult> {
  const systemPrompt = `You are a Kenya clinical nutrition assistant. Your ONLY job is to map food ingredients to WHO IYCF food groups for Minimum Dietary Diversity (MDD) scoring.

WHO food groups (use ONLY these keys):
- grains_roots: cereals, grains, roots, tubers (maize/unga, rice, wheat, potato/viazi, cassava/muhogo, yam, sweet potato/ngwaci, matoke/ndizi ngumu, millet/wimbi, sorghum)
- legumes_nuts: legumes, pulses, nuts (beans/maharagwe, lentils/dengu, peas, groundnuts/karanga, cowpeas/kunde, soybeans)
- dairy: milk/maziwa, yoghurt/mtindi, cheese/jibini, fermented milk
- animal_source: meat, fish, eggs, offal (beef/nyama ya ng'ombe, chicken/kuku, goat/mbuzi, pork, liver/ini, omena/dagaa, tilapia/sato, eggs/mayai)
- vita_veg: vitamin A-rich vegetables (pumpkin/boga, pumpkin leaves/matembele, spinach/mchicha, kale/sukuma wiki, amaranth/terere, sweet potato leaves, carrots/karoti, cowpea leaves)
- vita_fruit: vitamin A-rich fruits (mango/embe, papaya/pawpaw, passion fruit/tunda la passion, yellow/orange fruits)
- other_veg: other vegetables (tomato/nyanya, onion/vitunguu, capsicum/pilipili hoho, aubergine/biringanya, okra/bamia, courgette, cabbage/kabichi, cucumber)
- other_fruit: other fruits (banana/ndizi, orange/chungwa, guava/mapera, apple/tofaa, pineapple/nanasi, watermelon/tikiti)
- fats_oils: fats and oils (cooking oil/mafuta ya kupika, butter/siagi, margarine, peanut butter, avocado/parachichi, coconut/nazi)

Respond ONLY with valid JSON, no markdown, no explanation:
{
  "matched_groups": ["grains_roots", "legumes_nuts"],
  "primary_group": "grains_roots",
  "unrecognised": ["ingredient_name"],
  "confidence": "high"
}

Rules:
- matched_groups: list ONLY groups actually present in the ingredients
- primary_group: the group that contributes the most bulk/energy (usually grains_roots for Kenyan staples)
- unrecognised: ingredients you cannot confidently place in any group
- confidence: high = all recognised, medium = most recognised, low = many unrecognised
- Salt, water, spices (pilipili, chumvi, tangawizi) are NOT food groups — ignore them`;

  const userMsg = `Dish: "${dishName}"
Ingredients: ${ingredientsText}

Map these ingredients to WHO food groups for MDD scoring.`;

  const resp = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model:       GROQ_MODEL,
      temperature: 0.1,
      max_tokens:  256,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMsg },
      ],
    }),
  });

  if (!resp.ok) throw new Error(`Groq error ${resp.status}`);
  const data = await resp.json();
  const raw  = data.choices?.[0]?.message?.content ?? '{}';

  // Strip any accidental markdown fences
  const clean = raw.replace(/```json|```/g, '').trim();
  const parsed: MatchResult = JSON.parse(clean);

  // Validate group keys — discard any hallucinated keys
  const validKeys = new Set(WHO_GROUPS.map(g => g.key));
  parsed.matched_groups = (parsed.matched_groups ?? []).filter(k => validKeys.has(k));
  if (!validKeys.has(parsed.primary_group)) {
    parsed.primary_group = parsed.matched_groups[0] ?? 'grains_roots';
  }
  return parsed;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'entry' | 'matching' | 'review' | 'context' | 'success';

interface FormState {
  dish_name:    string;
  ingredients:  string;
  who_groups:   string[];
  primary_group: string;
  prep_notes:   string;
  where_found:  string;
  price_tier:   '' | 'low' | 'medium' | 'high';
  season:       string;
}

export interface AddFoodModalProps {
  visible:   boolean;
  onClose:   () => void;
  onSuccess: () => void;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AddFoodModal({ visible, onClose, onSuccess }: AddFoodModalProps) {
  const [step, setStep]     = useState<Step>('entry');
  const [saving, setSaving] = useState(false);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  const [form, setForm] = useState<FormState>({
    dish_name:     '',
    ingredients:   '',
    who_groups:    [],
    primary_group: '',
    prep_notes:    '',
    where_found:   '',
    price_tier:    '',
    season:        '',
  });

  const scrollRef = useRef<ScrollView>(null);

  const setField = useCallback(<K extends keyof FormState>(key: K, val: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: val }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
  }, []);

  // ── Step 1: Match ingredients ──────────────────────────────────────────────

  const handleMatch = async () => {
    const errs: Record<string, string> = {};
    if (!form.dish_name.trim())   errs.dish_name   = 'Enter a dish name';
    if (!form.ingredients.trim()) errs.ingredients = 'Enter at least one ingredient';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setStep('matching');
    try {
      const result = await matchIngredientsToGroups(form.dish_name, form.ingredients);
      setMatchResult(result);
      setField('who_groups',    result.matched_groups);
      setField('primary_group', result.primary_group);
      setStep('review');
    } catch (err: any) {
      // Fallback: let user pick groups manually
      setMatchResult({ matched_groups: [], primary_group: '', unrecognised: [], confidence: 'low' });
      setStep('review');
    }
  };

  // ── Step 3: Toggle a group ─────────────────────────────────────────────────

  const toggleGroup = (key: string) => {
    setForm(prev => {
      const has = prev.who_groups.includes(key);
      const next = has
        ? prev.who_groups.filter(g => g !== key)
        : [...prev.who_groups, key];
      const primary = next.includes(prev.primary_group)
        ? prev.primary_group
        : (next[0] ?? '');
      return { ...prev, who_groups: next, primary_group: primary };
    });
  };

  const setPrimary = (key: string) => {
    setForm(prev => ({
      ...prev,
      primary_group: key,
      who_groups: prev.who_groups.includes(key)
        ? prev.who_groups
        : [...prev.who_groups, key],
    }));
  };

  // ── Save ───────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.who_groups.length) {
      setErrors({ who_groups: 'Select at least one food group' });
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const isComposite = form.who_groups.length > 1;

      const payload = {
        user_id:         user.id,
        name_common:     form.dish_name.trim(),
        who_group:       form.primary_group || null,
        who_groups:      form.who_groups,
        is_composite:    isComposite,
        ingredients_raw: form.ingredients.trim() || null,
        prep_notes:      form.prep_notes.trim()  || null,
        where_found:     form.where_found.trim() || null,
        price_tier:      form.price_tier         || null,
        season:          form.season.trim()       || null,
        is_active:       true,
      };

      const { error } = await supabase.from('user_foods').insert(payload);
      if (error) throw error;

      setStep('success');
    } catch (err: any) {
      Alert.alert('Could not save', err.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Reset + close ──────────────────────────────────────────────────────────

  const handleClose = () => {
    setForm({ dish_name:'', ingredients:'', who_groups:[], primary_group:'', prep_notes:'', where_found:'', price_tier:'', season:'' });
    setErrors({});
    setStep('entry');
    setMatchResult(null);
    onClose();
  };

  const handleSuccess = () => { handleClose(); onSuccess(); };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={m.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* Header */}
        <View style={m.header}>
          <TouchableOpacity onPress={handleClose} style={m.headerBtn} hitSlop={{ top:8,bottom:8,left:8,right:8 }}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={m.headerCenter}>
            <Text style={m.headerTitle}>Add Local Food</Text>
            {step !== 'success' && step !== 'matching' && (
              <Text style={m.headerSub}>
                {step === 'entry'   ? 'Step 1 of 3 · Ingredients'  :
                 step === 'review'  ? 'Step 2 of 3 · Confirm Groups' :
                                     'Step 3 of 3 · Extra details'}
              </Text>
            )}
          </View>
          <View style={m.headerBtn} />
        </View>

        {/* Progress bar */}
        {step !== 'success' && (
          <View style={m.progressTrack}>
            <View style={[m.progressFill, {
              width: step === 'entry' || step === 'matching' ? '33%'
                   : step === 'review' ? '66%' : '100%',
            }]} />
          </View>
        )}

        {/* ── STEP: ENTRY ──────────────────────────────────────────────── */}
        {step === 'entry' && (
          <ScrollView
            ref={scrollRef}
            style={m.scroll}
            contentContainerStyle={m.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={m.infoCard}>
              <Text style={m.infoEmoji}>🍲</Text>
              <Text style={m.infoText}>
                Enter the dish name and its ingredients. We'll identify the food groups
                for dietary diversity scoring — no measurements or ratios needed.
              </Text>
            </View>

            <Label text="Dish or food name" required />
            <TextInput
              style={[m.input, errors.dish_name && m.inputError]}
              placeholder="e.g. Mukimo, Githeri, Pilau ya nyumbani"
              placeholderTextColor={COLORS.textMuted}
              value={form.dish_name}
              onChangeText={v => setField('dish_name', v)}
              autoCapitalize="words"
              returnKeyType="next"
            />
            {errors.dish_name && <Err msg={errors.dish_name} />}

            <Label text="Ingredients" required />
            <Text style={m.hint}>
              List what goes into it — Swahili or English, however you know them.
              Salt, water, and spices are not needed.
            </Text>
            <TextInput
              style={[m.input, m.inputMulti, errors.ingredients && m.inputError]}
              placeholder={'e.g. Mahindi, njegere, viazi,\nmchicha, mafuta kidogo'}
              placeholderTextColor={COLORS.textMuted}
              value={form.ingredients}
              onChangeText={v => setField('ingredients', v)}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            {errors.ingredients && <Err msg={errors.ingredients} />}

            <View style={m.examplesCard}>
              <Text style={m.examplesTitle}>Common Kenyan composite dishes</Text>
              {[
                { dish: 'Mukimo',  ingredients: 'Maize, peas, potato, pumpkin leaves' },
                { dish: 'Githeri', ingredients: 'Maize, beans' },
                { dish: 'Irio',    ingredients: 'Peas, potato, maize, spinach' },
                { dish: 'Ugali + Sukuma', ingredients: 'Maize flour, kale, tomato, onion' },
              ].map(ex => (
                <TouchableOpacity
                  key={ex.dish}
                  style={m.exampleRow}
                  onPress={() => {
                    setField('dish_name',   ex.dish);
                    setField('ingredients', ex.ingredients);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={m.exampleDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={m.exampleDish}>{ex.dish}</Text>
                    <Text style={m.exampleIngredients}>{ex.ingredients}</Text>
                  </View>
                  <Ionicons name="arrow-up-circle-outline" size={18} color={COLORS.primary} />
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={m.primaryBtn} onPress={handleMatch} activeOpacity={0.85}>
              <Ionicons name="sparkles-outline" size={18} color="#fff" />
              <Text style={m.primaryBtnLabel}>Identify Food Groups</Text>
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        )}

        {/* ── STEP: MATCHING (loading) ──────────────────────────────────── */}
        {step === 'matching' && (
          <View style={m.matchingWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={m.matchingTitle}>Identifying food groups…</Text>
            <Text style={m.matchingBody}>
              Matching ingredients to the Kenya food database
            </Text>
          </View>
        )}

        {/* ── STEP: REVIEW ─────────────────────────────────────────────── */}
        {step === 'review' && (
          <ScrollView
            style={m.scroll}
            contentContainerStyle={m.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Dish summary */}
            <View style={m.dishSummaryCard}>
              <Text style={m.dishSummaryName}>{form.dish_name}</Text>
              <Text style={m.dishSummaryIngredients}>{form.ingredients}</Text>
            </View>

            {/* MDD score preview */}
            <View style={m.mddCard}>
              <View style={m.mddRow}>
                <View style={m.mddScoreCircle}>
                  <Text style={m.mddScoreNum}>{form.who_groups.length}</Text>
                  <Text style={m.mddScoreLabel}>groups</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={m.mddTitle}>WHO Food Group Credits</Text>
                  <Text style={m.mddBody}>
                    This dish will contribute{' '}
                    <Text style={{ fontFamily: FONTS.semibold, color: COLORS.primary }}>
                      {form.who_groups.length} food group{form.who_groups.length !== 1 ? 's' : ''}
                    </Text>{' '}
                    toward the WHO Minimum Dietary Diversity score of 5+.
                  </Text>
                </View>
              </View>
              <View style={m.mddNote}>
                <Ionicons name="information-circle-outline" size={13} color={COLORS.textMuted} />
                <Text style={m.mddNoteText}>
                  Nutrient amounts are not calculated for mixed dishes — only food group
                  diversity is recorded. This follows WHO MDD field assessment methodology.
                </Text>
              </View>
            </View>

            {/* Unrecognised warning */}
            {(matchResult?.unrecognised?.length ?? 0) > 0 && (
              <View style={m.warnCard}>
                <Ionicons name="warning-outline" size={15} color={COLORS.due} />
                <Text style={m.warnText}>
                  Could not recognise:{' '}
                  <Text style={{ fontFamily: FONTS.semibold }}>
                    {matchResult!.unrecognised.join(', ')}
                  </Text>
                  {'. These were not counted. You can add them manually below.'}
                </Text>
              </View>
            )}

            {/* Group grid — tap to toggle, long-press to set as primary */}
            <Label text="Food groups in this dish" required />
            <Text style={m.hint}>
              Tap to add or remove a group. Long-press to mark as the primary group
              (used for meal slot matching).
            </Text>
            {errors.who_groups && <Err msg={errors.who_groups} />}

            <View style={m.groupGrid}>
              {WHO_GROUPS.map(g => {
                const selected  = form.who_groups.includes(g.key);
                const isPrimary = form.primary_group === g.key;
                return (
                  <TouchableOpacity
                    key={g.key}
                    style={[
                      m.groupChip,
                      selected  && { borderColor: g.color, backgroundColor: g.bg },
                      isPrimary && { borderWidth: 2.5 },
                    ]}
                    onPress={() => toggleGroup(g.key)}
                    onLongPress={() => setPrimary(g.key)}
                    activeOpacity={0.7}
                  >
                    <Text style={m.groupEmoji}>{g.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[m.groupLabel, selected && { color: g.color, fontFamily: FONTS.semibold }]}>
                        {g.label}
                      </Text>
                      {selected && (
                        <Text style={[m.groupExamples, { color: g.color }]} numberOfLines={1}>
                          {g.examples}
                        </Text>
                      )}
                    </View>
                    {isPrimary && (
                      <View style={[m.primaryBadge, { backgroundColor: g.color }]}>
                        <Text style={m.primaryBadgeText}>primary</Text>
                      </View>
                    )}
                    {selected && !isPrimary && (
                      <Ionicons name="checkmark-circle" size={16} color={g.color} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={m.btnRow}>
              <TouchableOpacity style={m.secondaryBtn} onPress={() => setStep('entry')} activeOpacity={0.8}>
                <Ionicons name="arrow-back" size={15} color={COLORS.primary} />
                <Text style={m.secondaryBtnLabel}>Edit ingredients</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[m.primaryBtn, { flex: 1 }, !form.who_groups.length && m.primaryBtnDisabled]}
                onPress={() => form.who_groups.length && setStep('context')}
                activeOpacity={0.85}
              >
                <Text style={m.primaryBtnLabel}>Continue</Text>
                <Ionicons name="arrow-forward" size={15} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        )}

        {/* ── STEP: CONTEXT (optional details) ─────────────────────────── */}
        {step === 'context' && (
          <ScrollView
            style={m.scroll}
            contentContainerStyle={m.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={m.infoCard}>
              <Text style={m.infoEmoji}>✅</Text>
              <Text style={m.infoText}>
                <Text style={{ fontFamily: FONTS.semibold }}>{form.dish_name}</Text>
                {' '}is ready to save with {form.who_groups.length} food group credit{form.who_groups.length !== 1 ? 's' : ''}.
                The fields below are optional.
              </Text>
            </View>

            <Label text="How do you prepare it?" />
            <TextInput
              style={[m.input, m.inputMulti]}
              placeholder="e.g. Boil maize and peas together, mash with potato"
              placeholderTextColor={COLORS.textMuted}
              value={form.prep_notes}
              onChangeText={v => setField('prep_notes', v)}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />

            <TwoCol>
              <View style={{ flex: 1 }}>
                <Label text="Where found / bought" />
                <TextInput
                  style={m.input}
                  placeholder="e.g. Githurai market"
                  placeholderTextColor={COLORS.textMuted}
                  value={form.where_found}
                  onChangeText={v => setField('where_found', v)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Label text="Season available" />
                <TextInput
                  style={m.input}
                  placeholder="e.g. Rainy season"
                  placeholderTextColor={COLORS.textMuted}
                  value={form.season}
                  onChangeText={v => setField('season', v)}
                />
              </View>
            </TwoCol>

            <Label text="Cost" />
            <View style={m.priceRow}>
              {(['low','medium','high'] as const).map(tier => (
                <TouchableOpacity
                  key={tier}
                  style={[m.priceChip, form.price_tier === tier && m.priceChipOn]}
                  onPress={() => setField('price_tier', form.price_tier === tier ? '' : tier)}
                  activeOpacity={0.7}
                >
                  <Text style={[m.priceLabel, form.price_tier === tier && m.priceLabelOn]}>
                    {tier === 'low' ? '💚 Affordable' : tier === 'medium' ? '🟡 Moderate' : '🔴 Expensive'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[m.primaryBtn, saving && m.primaryBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <>
                    <Ionicons name="add-circle-outline" size={18} color="#fff" />
                    <Text style={m.primaryBtnLabel}>Save food</Text>
                  </>
              }
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        )}

        {/* ── STEP: SUCCESS ─────────────────────────────────────────────── */}
        {step === 'success' && (
          <View style={m.successWrap}>
            <View style={m.successCircle}>
              <Ionicons name="checkmark" size={48} color="#fff" />
            </View>
            <Text style={m.successTitle}>Food Added!</Text>
            <Text style={m.successBody}>
              <Text style={{ fontFamily: FONTS.semibold }}>{form.dish_name}</Text>
              {' '}has been saved with{' '}
              <Text style={{ fontFamily: FONTS.semibold, color: COLORS.primary }}>
                {form.who_groups.length} food group credit{form.who_groups.length !== 1 ? 's' : ''}
              </Text>.
              {'\n\n'}
              It will appear in the meal planner next time a plan is generated and will
              count toward your child's dietary diversity score.
            </Text>

            {/* Group chips preview */}
            <View style={m.successGroups}>
              {form.who_groups.map(key => {
                const g = GROUP_MAP[key];
                if (!g) return null;
                return (
                  <View key={key} style={[m.successGroupChip, { backgroundColor: g.bg, borderColor: g.color + '44' }]}>
                    <Text style={{ fontSize: 14 }}>{g.emoji}</Text>
                    <Text style={[m.successGroupLabel, { color: g.color }]}>{g.label}</Text>
                  </View>
                );
              })}
            </View>

            <TouchableOpacity style={m.primaryBtn} onPress={handleSuccess} activeOpacity={0.85}>
              <Ionicons name="restaurant-outline" size={18} color="#fff" />
              <Text style={m.primaryBtnLabel}>Back to Nutrition</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function Label({ text, required }: { text: string; required?: boolean }) {
  return (
    <Text style={m.label}>
      {text}{required && <Text style={{ color: COLORS.missed }}> *</Text>}
    </Text>
  );
}

function Err({ msg }: { msg: string }) {
  return (
    <View style={m.errRow}>
      <Ionicons name="alert-circle-outline" size={13} color={COLORS.missed} />
      <Text style={m.errText}>{msg}</Text>
    </View>
  );
}

function TwoCol({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', gap: 10 }}>{children}</View>;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const m = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.white },

  // Header
  header: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 16 : 20,
    paddingBottom: 14, paddingHorizontal: 16,
  },
  headerBtn:    { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { alignItems: 'center', gap: 2 },
  headerTitle:  { fontFamily: FONTS.bold, fontSize: 17, color: '#fff' },
  headerSub:    { fontFamily: FONTS.regular, fontSize: 11, color: 'rgba(255,255,255,0.75)' },

  // Progress
  progressTrack: { height: 3, backgroundColor: COLORS.border },
  progressFill:  { height: 3, backgroundColor: COLORS.primary, borderRadius: 2 },

  // Scroll
  scroll:   { flex: 1, backgroundColor: '#F2F4F7' },
  content:  { padding: 16, gap: 4 },

  // Info / example cards
  infoCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md,
    padding: 14, marginBottom: 12,
  },
  infoEmoji: { fontSize: 20, marginTop: 1 },
  infoText:  { flex: 1, fontFamily: FONTS.regular, fontSize: 13, color: COLORS.primary, lineHeight: 19 },

  examplesCard: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.lg, borderWidth: 1,
    borderColor: COLORS.border, padding: 14, marginTop: 16, gap: 4,
  },
  examplesTitle:       { fontFamily: FONTS.semibold, fontSize: 11, color: COLORS.textMuted, letterSpacing: 0.5, marginBottom: 6 },
  exampleRow:          { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: COLORS.border },
  exampleDot:          { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.primary, flexShrink: 0, marginTop: 2 },
  exampleDish:         { fontFamily: FONTS.semibold, fontSize: 13, color: COLORS.textPrimary },
  exampleIngredients:  { fontFamily: FONTS.regular, fontSize: 11, color: COLORS.textMuted, lineHeight: 16 },

  // Form
  label:       { fontFamily: FONTS.semibold, fontSize: 13, color: COLORS.textPrimary, marginTop: 14, marginBottom: 6 },
  hint:        { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textMuted, marginBottom: 8, lineHeight: 17 },
  input: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.md, borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontFamily: FONTS.regular, fontSize: 15, color: COLORS.textPrimary,
  },
  inputError: { borderColor: COLORS.missed },
  inputMulti: { minHeight: 88, paddingTop: 12 },

  errRow:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  errText: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.missed },

  // Matching loading
  matchingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32, backgroundColor: '#F2F4F7' },
  matchingTitle: { fontFamily: FONTS.bold, fontSize: 17, color: COLORS.textPrimary },
  matchingBody:  { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },

  // Dish summary
  dishSummaryCard: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.lg, borderWidth: 1,
    borderColor: COLORS.border, padding: 14, marginBottom: 4, gap: 4,
  },
  dishSummaryName:        { fontFamily: FONTS.bold, fontSize: 16, color: COLORS.textPrimary },
  dishSummaryIngredients: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textMuted, lineHeight: 17 },

  // MDD card
  mddCard: {
    backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.lg, padding: 14, marginBottom: 4, gap: 10,
  },
  mddRow:         { flexDirection: 'row', alignItems: 'center', gap: 14 },
  mddScoreCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  mddScoreNum:    { fontFamily: FONTS.bold, fontSize: 22, color: '#fff', lineHeight: 26 },
  mddScoreLabel:  { fontFamily: FONTS.regular, fontSize: 9, color: 'rgba(255,255,255,0.8)' },
  mddTitle:       { fontFamily: FONTS.bold, fontSize: 14, color: COLORS.primary, marginBottom: 4 },
  mddBody:        { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.primary, lineHeight: 18 },
  mddNote:        { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: RADIUS.md, padding: 10 },
  mddNoteText:    { fontFamily: FONTS.regular, fontSize: 11, color: COLORS.textSecondary, flex: 1, lineHeight: 16 },

  // Warn
  warnCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: COLORS.dueLight, borderRadius: RADIUS.md, borderWidth: 1,
    borderColor: COLORS.due + '44', padding: 12, marginBottom: 4,
  },
  warnText: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.due, flex: 1, lineHeight: 17 },

  // Group grid
  groupGrid: { gap: 6, marginTop: 2 },
  groupChip: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.white, borderRadius: RADIUS.md,
    borderWidth: 1.5, borderColor: COLORS.border,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  groupEmoji:    { fontSize: 18, width: 24, textAlign: 'center' },
  groupLabel:    { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textSecondary },
  groupExamples: { fontFamily: FONTS.regular, fontSize: 10, lineHeight: 14, marginTop: 1 },
  primaryBadge:     { paddingHorizontal: 7, paddingVertical: 3, borderRadius: RADIUS.full },
  primaryBadgeText: { fontFamily: FONTS.bold, fontSize: 9, color: '#fff', letterSpacing: 0.5 },

  // Price
  priceRow:    { flexDirection: 'row', gap: 8, marginTop: 2 },
  priceChip:   { flex: 1, backgroundColor: COLORS.white, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.border, paddingVertical: 10, alignItems: 'center' },
  priceChipOn: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  priceLabel:  { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textSecondary },
  priceLabelOn:{ fontFamily: FONTS.semibold, fontSize: 12, color: COLORS.primary },

  // Buttons
  primaryBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.lg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 15, marginTop: 20, gap: 8,
    elevation: 4, shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
  },
  primaryBtnLabel:    { fontFamily: FONTS.bold, fontSize: 15, color: '#fff', letterSpacing: 0.2 },
  primaryBtnDisabled: { opacity: 0.45, elevation: 0 },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 15, paddingHorizontal: 18,
    borderRadius: RADIUS.lg, borderWidth: 1.5, borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
  },
  secondaryBtnLabel: { fontFamily: FONTS.semibold, fontSize: 14, color: COLORS.primary },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 20 },

  // Success
  successWrap: {
    flex: 1, backgroundColor: '#F2F4F7',
    alignItems: 'center', justifyContent: 'center', padding: 32, gap: 0,
  },
  successCircle: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
    marginBottom: 20, elevation: 8,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12,
  },
  successTitle:      { fontFamily: FONTS.bold, fontSize: 24, color: COLORS.textPrimary, marginBottom: 12 },
  successBody:       { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  successGroups:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 28 },
  successGroupChip:  { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 6 },
  successGroupLabel: { fontFamily: FONTS.semibold, fontSize: 12 },
});