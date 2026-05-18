import { COLORS, RADIUS } from '@/lib/theme';
import { getFeedingStage, FOOD_GROUPS, getTipsForAge, getMDDStatus } from '@/lib/nutritionData';
import { askGroq } from '@/lib/zscore';
import { useChildStore } from '@/store/childStore';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Platform, RefreshControl,
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';

function getAgeMonths(dob: string): number {
  const d = new Date(dob);
  const now = new Date();
  return Math.max(0, (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth()));
}

// ─── Verified Feeding Stage Card ─────────────────────────────────────────────

function FeedingStageCard({ ageMonths }: { ageMonths: number }) {
  const stage = getFeedingStage(ageMonths);
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={sc.container}>
      <View style={sc.sourceTag}>
        <Ionicons name="shield-checkmark" size={11} color="#2A9D6E" />
        <Text style={sc.sourceTagText}>WHO Verified · {stage.source}</Text>
      </View>
      <Text style={sc.stageName}>{stage.stage}</Text>
      <View style={sc.grid}>
        <View style={sc.gridItem}>
          <Text style={sc.gridLabel}>Meals / day</Text>
          <Text style={sc.gridValue}>{stage.mealsPerDay}</Text>
        </View>
        <View style={sc.gridItem}>
          <Text style={sc.gridLabel}>Snacks</Text>
          <Text style={sc.gridValue}>{stage.snacksPerDay}</Text>
        </View>
        <View style={sc.gridItem}>
          <Text style={sc.gridLabel}>Amount / meal</Text>
          <Text style={sc.gridValue}>{stage.amountPerMeal}</Text>
        </View>
        <View style={sc.gridItem}>
          <Text style={sc.gridLabel}>Texture</Text>
          <Text style={sc.gridValue}>{stage.texture}</Text>
        </View>
      </View>
      <Text style={sc.bfLabel}>Breastfeeding</Text>
      <Text style={sc.bfValue}>{stage.breastfeeding}</Text>
      <TouchableOpacity style={sc.expandBtn} onPress={() => setExpanded(e => !e)}>
        <Text style={sc.expandBtnText}>
          {expanded ? 'Hide key facts' : `Show ${stage.keyFacts.length} key facts`}
        </Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={COLORS.primary} />
      </TouchableOpacity>
      {expanded && stage.keyFacts.map((fact, i) => (
        <View key={i} style={sc.factRow}>
          <Ionicons name="checkmark-circle" size={14} color="#2A9D6E" />
          <Text style={sc.factText}>{fact}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Rotating IYCF Tip Card ───────────────────────────────────────────────────

function TipCard({ ageMonths }: { ageMonths: number }) {
  const tips = useMemo(() => getTipsForAge(ageMonths), [ageMonths]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (tips.length === 0) return;
    const interval = setInterval(() => setIndex(i => (i + 1) % tips.length), 8000);
    return () => clearInterval(interval);
  }, [tips.length]);

  if (tips.length === 0) return null;
  const tip = tips[index];

  return (
    <View style={tc.card}>
      <View style={tc.iconCircle}>
        <Ionicons name="bulb" size={14} color={COLORS.onPrimary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={tc.tip}>{tip.tip}</Text>
        <View style={tc.sourceRow}>
          <Ionicons name="shield-checkmark" size={11} color="#2A9D6E" />
          <Text style={tc.source}>{tip.source}</Text>
        </View>
        {tips.length > 1 && (
          <View style={tc.dotsRow}>
            {tips.map((_, i) => (
              <View key={i} style={[tc.dot, i === index && tc.dotActive]} />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

// ─── AI Meal Suggestion Card ──────────────────────────────────────────────────

function AICard({ content, loading, onRefresh }: {
  content: string; loading: boolean; onRefresh: () => void;
}) {
  return (
    <View style={ai.card}>
      <View style={ai.headerRow}>
        <View style={ai.iconCircle}>
          <Ionicons name="fast-food" size={16} color={COLORS.onPrimary} />
        </View>
        <Text style={ai.title}>Today's Kenyan Meal Ideas</Text>
        <TouchableOpacity onPress={onRefresh} disabled={loading} style={ai.refreshBtn}>
          <Ionicons name="refresh" size={16} color={loading ? COLORS.textMuted : COLORS.primary} />
        </TouchableOpacity>
      </View>
      {loading ? (
        <View style={ai.loadingRow}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={ai.loadingText}>Generating meal ideas...</Text>
        </View>
      ) : (
        <Text style={ai.body}>{content}</Text>
      )}
      <View style={ai.aiTag}>
        <Ionicons name="sparkles" size={10} color={COLORS.primary} />
        <Text style={ai.aiTagText}>
          AI-personalised · grounded in WHO IYCF & Kenya MoH guidelines
        </Text>
      </View>
    </View>
  );
}

// ─── Food Group Checker ───────────────────────────────────────────────────────

function FoodGroupChecker({ ageMonths, checked, onToggle }: {
  ageMonths: number;
  checked: Record<string, boolean>;
  onToggle: (id: string) => void;
}) {
  const available = FOOD_GROUPS.filter(g => ageMonths >= g.minAgeMonths);
  const status = getMDDStatus(checked);

  if (ageMonths < 6) {
    return (
      <View style={fg.exclusiveBox}>
        <Ionicons name="heart" size={28} color={COLORS.primary} />
        <Text style={fg.exclusiveTitle}>Exclusive Breastfeeding Period</Text>
        <Text style={fg.exclusiveText}>
          Your baby is under 6 months. Breast milk alone provides complete
          nutrition — no other foods or drinks are needed.
        </Text>
        <Text style={fg.exclusiveSource}>WHO IYCF Guidelines, 2003</Text>
      </View>
    );
  }

  return (
    <View>
      {/* MDD Score Card */}
      <View style={[fg.scoreCard, { backgroundColor: status.bg }]}>
        <View style={fg.scoreTop}>
          <View>
            <Text style={[fg.scoreNum, { color: status.color }]}>
              {status.score}<Text style={fg.scoreOf}>/7</Text>
            </Text>
            <Text style={[fg.scoreLabel, { color: status.color }]}>Food Groups Today</Text>
          </View>
          <View style={[fg.scoreBadge, { backgroundColor: status.color }]}>
            <Text style={fg.scoreBadgeText}>{status.label}</Text>
          </View>
        </View>
        <Text style={[fg.scoreMessage, { color: status.color }]}>{status.message}</Text>
        <View style={fg.mddBar}>
          {[1, 2, 3, 4, 5, 6, 7].map(i => (
            <View
              key={i}
              style={[
                fg.mddSegment,
                { backgroundColor: i <= status.score ? status.color : COLORS.border },
              ]}
            />
          ))}
        </View>
        <Text style={fg.mddSource}>
          WHO Minimum Dietary Diversity (MDD) — target: 4 or more food groups/day
        </Text>
      </View>

      {/* Food Group Grid */}
      <View style={fg.groupsGrid}>
        {available.map(g => {
          const isChecked = checked[g.id] ?? false;
          return (
            <TouchableOpacity
              key={g.id}
              style={[fg.groupCard, isChecked && { borderColor: g.color, backgroundColor: g.bg }]}
              onPress={() => onToggle(g.id)}
              activeOpacity={0.7}
            >
              <View style={[fg.groupIconCircle, { backgroundColor: isChecked ? g.color : COLORS.surface }]}>
                <Ionicons
                  name={g.icon as any}
                  size={18}
                  color={isChecked ? COLORS.white : COLORS.textMuted}
                />
              </View>
              <Text
                style={[fg.groupName, isChecked && { color: g.color, fontWeight: '700' }]}
                numberOfLines={2}
              >
                {g.name}
              </Text>
              <Text style={fg.groupExamples} numberOfLines={2}>{g.examples}</Text>
              <Text style={fg.groupWhy} numberOfLines={2}>{g.whyImportant}</Text>
              {isChecked && (
                <View style={[fg.checkMark, { backgroundColor: g.color }]}>
                  <Ionicons name="checkmark" size={10} color={COLORS.white} />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function NutritionScreen() {
  const router = useRouter();
  const { children, selectedChildId, growthRecords, fetchGrowthRecords } = useChildStore();
  const activeChild = children.find(c => c.id === selectedChildId) ?? children[0];

  const [checkedGroups, setCheckedGroups]     = useState<Record<string, boolean>>({});
  const [mealSuggestions, setMealSuggestions] = useState('');
  const [loadingMeals, setLoadingMeals]       = useState(false);
  const [refreshing, setRefreshing]           = useState(false);

  const ageMonths = useMemo(() => {
    if (!activeChild?.date_of_birth) return 0;
    return getAgeMonths(activeChild.date_of_birth);
  }, [activeChild?.date_of_birth]);

  const stage = useMemo(() => getFeedingStage(ageMonths), [ageMonths]);
  const latestGrowth = growthRecords[0];

  const childContext = useMemo(() => {
    if (!activeChild) return '';
    const growth = latestGrowth
      ? `Weight: ${latestGrowth.weight_kg}kg, height: ${latestGrowth.height_cm ?? 'not recorded'}cm, WAZ: ${latestGrowth.waz ?? 'N/A'}, HAZ: ${latestGrowth.haz ?? 'N/A'}, WHZ: ${latestGrowth.whz ?? 'N/A'}.`
      : 'No growth records yet.';
    return `Child: ${activeChild.full_name}, ${ageMonths} months, sex: ${activeChild.sex}. ${growth}`;
  }, [activeChild, ageMonths, latestGrowth]);

  const fetchMealSuggestions = useCallback(async () => {
    if (!childContext) return;
    setLoadingMeals(true);
    const checkedNames = FOOD_GROUPS.filter(g => checkedGroups[g.id]).map(g => g.name);
    const missing = FOOD_GROUPS.filter(
      g => ageMonths >= g.minAgeMonths && !checkedGroups[g.id],
    ).map(g => g.name);
    try {
      const result = await askGroq(
        `${childContext}
Verified feeding stage: ${stage.stage}. Texture: ${stage.texture}. Amount per meal: ${stage.amountPerMeal}.
Food groups eaten today: ${checkedNames.length > 0 ? checkedNames.join(', ') : 'none yet'}.
Missing food groups: ${missing.join(', ')}.

Using ONLY locally available Kenyan foods and WHO complementary feeding guidelines, suggest 3 specific meal ideas for today that address the missing food groups. Use foods like ugali, sukuma wiki, beans, eggs, uji, githeri, liver, fish, omena, sweet potato, mango, avocado, groundnut paste. Format as 3 numbered meals with one sentence each. Do not invent nutritional claims.`,
        'You are a Kenya MCH nutrition counsellor. Only suggest meals using locally available Kenyan foods consistent with WHO IYCF and Kenya MoH guidelines. Never fabricate nutritional claims.',
        0.5,
      );
      setMealSuggestions(result);
    } catch {
      setMealSuggestions('Could not load suggestions. Tap the refresh button to try again.');
    } finally {
      setLoadingMeals(false);
    }
  }, [childContext, checkedGroups, ageMonths, stage]);

  useEffect(() => {
    if (activeChild) {
      fetchGrowthRecords(activeChild.id);
      fetchMealSuggestions();
    }
  }, [activeChild?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (activeChild) await fetchGrowthRecords(activeChild.id);
    await fetchMealSuggestions();
    setRefreshing(false);
  };

  const toggleGroup = (id: string) =>
    setCheckedGroups(prev => ({ ...prev, [id]: !prev[id] }));

  const resetChecklist = () => {
    const reset = () => setCheckedGroups({});
    Platform.OS === 'web'
      ? window.confirm("Reset today's food checklist?") && reset()
      : Alert.alert("Reset Checklist", "Clear today's food group log?", [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Reset', style: 'destructive', onPress: reset },
        ]);
  };

  if (!activeChild) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconCircle}>
          <Ionicons name="nutrition-outline" size={48} color={COLORS.primaryMid} />
        </View>
        <Text style={styles.emptyTitle}>No child selected</Text>
        <Text style={styles.emptySub}>
          Go to the Children tab to select or add a child
        </Text>
        <TouchableOpacity
          style={styles.goBtn}
          onPress={() => router.push('/(tabs)/children' as any)}
        >
          <Ionicons name="people" size={16} color={COLORS.onPrimary} />
          <Text style={styles.goBtnText}>Go to Children</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="nutrition" size={22} color={COLORS.onPrimary} />
        <Text style={styles.headerTitle}>Nutrition Guide</Text>
        <TouchableOpacity onPress={onRefresh} disabled={refreshing}>
          <Ionicons
            name="refresh"
            size={20}
            color={refreshing ? COLORS.primaryMid : COLORS.onPrimary}
          />
        </TouchableOpacity>
      </View>

      {/* Child Banner */}
      <View style={styles.childBanner}>
        <View style={styles.childAvatarCircle}>
          <Ionicons
            name={activeChild.sex === 'female' ? 'female' : 'male'}
            size={16}
            color={COLORS.primary}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.childName}>{activeChild.full_name}</Text>
          <Text style={styles.childAge}>
            {ageMonths} months · {stage.stage.split('(')[0].trim()}
          </Text>
        </View>
        {latestGrowth?.waz !== null && latestGrowth?.waz !== undefined && (
          <View style={styles.wazPill}>
            <Text style={styles.wazText}>WAZ {latestGrowth.waz.toFixed(1)}</Text>
          </View>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
          />
        }
      >
        {/* Rotating IYCF Tip */}
        <TipCard ageMonths={ageMonths} />

        {/* Verified Feeding Stage */}
        <View style={styles.sectionHeader}>
          <Ionicons name="shield-checkmark" size={16} color="#2A9D6E" />
          <Text style={styles.sectionTitle}>Current Feeding Stage</Text>
          <View style={styles.verifiedTag}>
            <Text style={styles.verifiedTagText}>WHO Verified</Text>
          </View>
        </View>
        <FeedingStageCard ageMonths={ageMonths} />

        {/* Food Group Checklist */}
        <View style={styles.sectionHeader}>
          <Ionicons name="checkmark-circle-outline" size={16} color={COLORS.primary} />
          <Text style={styles.sectionTitle}>Today's Food Group Checklist</Text>
          {Object.values(checkedGroups).some(Boolean) && (
            <TouchableOpacity style={styles.resetBtn} onPress={resetChecklist}>
              <Text style={styles.resetBtnText}>Reset</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.sectionDesc}>
          Tap each food group your child ate today. WHO recommends at least 4
          groups daily for children over 6 months.
        </Text>
        <FoodGroupChecker
          ageMonths={ageMonths}
          checked={checkedGroups}
          onToggle={toggleGroup}
        />

        {/* AI Meal Suggestions */}
        <View style={styles.sectionHeader}>
          <Ionicons name="fast-food-outline" size={16} color={COLORS.primary} />
          <Text style={styles.sectionTitle}>Meal Suggestions</Text>
        </View>
        <Text style={styles.sectionDesc}>
          Kenyan meals suggested based on what your child has eaten today and
          their growth data.
        </Text>
        <AICard
          content={mealSuggestions}
          loading={loadingMeals}
          onRefresh={fetchMealSuggestions}
        />

        {/* Referral Banner */}
        <View style={styles.referralCard}>
          <View style={styles.referralIconCircle}>
            <Ionicons name="medkit" size={20} color={COLORS.onPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.referralTitle}>Need Professional Advice?</Text>
            <Text style={styles.referralText}>
              For therapeutic feeding or growth concerns, consult a certified
              nutritionist at your nearest MCH clinic.
            </Text>
            <Text style={styles.referralNote}>
              Feeding stage data is sourced from WHO IYCF Guidelines and the
              Kenya MCH Handbook. Meal suggestions are AI-generated based on
              these verified guidelines and do not replace clinical assessment.
            </Text>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: COLORS.background },
  emptyContainer:    { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIconCircle:   { width: 88, height: 88, borderRadius: 44, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle:        { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 8 },
  emptySub:          { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  goBtn:             { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  goBtnText:         { color: COLORS.onPrimary, fontWeight: '700', fontSize: 14 },
  header:            { backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingTop: 52, paddingBottom: 16 },
  headerTitle:       { flex: 1, fontSize: 18, fontWeight: '700', color: COLORS.onPrimary },
  childBanner:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.primaryLight, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  childAvatarCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  childName:         { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  childAge:          { fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },
  wazPill:           { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border },
  wazText:           { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary },
  scroll:            { paddingHorizontal: 16, paddingTop: 16 },
  sectionHeader:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, marginTop: 20 },
  sectionTitle:      { flex: 1, fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  sectionDesc:       { fontSize: 12, color: COLORS.textMuted, marginBottom: 12, lineHeight: 18 },
  verifiedTag:       { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full, backgroundColor: '#E1F5EE', borderWidth: 1, borderColor: '#2A9D6E' },
  verifiedTagText:   { fontSize: 10, color: '#2A9D6E', fontWeight: '700' },
  resetBtn:          { paddingHorizontal: 12, paddingVertical: 4, borderRadius: RADIUS.full, backgroundColor: '#FCEBEB', borderWidth: 1, borderColor: '#E8C4C4' },
  resetBtnText:      { fontSize: 11, color: '#A32D2D', fontWeight: '600' },
  referralCard:      { flexDirection: 'row', gap: 12, backgroundColor: '#F0EFFC', borderRadius: RADIUS.lg, padding: 16, marginTop: 24, borderWidth: 1, borderColor: '#D0CEFA' },
  referralIconCircle:{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#5B6EAE', alignItems: 'center', justifyContent: 'center' },
  referralTitle:     { fontSize: 14, fontWeight: '700', color: '#3A4A8A', marginBottom: 6 },
  referralText:      { fontSize: 12, color: '#3A4A8A', lineHeight: 18, marginBottom: 6 },
  referralNote:      { fontSize: 11, color: '#7B8FA1', lineHeight: 16, fontStyle: 'italic' },
});

const sc = StyleSheet.create({
  container:    { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 16, marginBottom: 4, borderWidth: 1, borderColor: COLORS.border, borderLeftWidth: 4, borderLeftColor: '#2A9D6E' },
  sourceTag:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  sourceTagText:{ fontSize: 10, color: '#2A9D6E', fontWeight: '600', fontStyle: 'italic' },
  stageName:    { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 14 },
  grid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  gridItem:     { width: '47%', backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: 10, borderWidth: 1, borderColor: COLORS.border },
  gridLabel:    { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, marginBottom: 4 },
  gridValue:    { fontSize: 12, fontWeight: '600', color: COLORS.textPrimary, lineHeight: 16 },
  bfLabel:      { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, marginBottom: 4 },
  bfValue:      { fontSize: 12, color: COLORS.textPrimary, lineHeight: 18, marginBottom: 12 },
  expandBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6 },
  expandBtnText:{ fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  factRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 10 },
  factText:     { flex: 1, fontSize: 12, color: COLORS.textPrimary, lineHeight: 18 },
});

const ai = StyleSheet.create({
  card:        { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 16, marginBottom: 4, borderWidth: 1, borderColor: COLORS.border, borderLeftWidth: 4, borderLeftColor: COLORS.primary },
  headerRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  iconCircle:  { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  title:       { flex: 1, fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  refreshBtn:  { padding: 4 },
  loadingRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  loadingText: { fontSize: 12, color: COLORS.textMuted, fontStyle: 'italic' },
  body:        { fontSize: 13, color: COLORS.textPrimary, lineHeight: 21 },
  aiTag:       { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12 },
  aiTagText:   { fontSize: 10, color: COLORS.textMuted, fontStyle: 'italic' },
});

const fg = StyleSheet.create({
  exclusiveBox:    { backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.lg, padding: 20, alignItems: 'center', gap: 10, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  exclusiveTitle:  { fontSize: 15, fontWeight: '700', color: COLORS.primary, textAlign: 'center' },
  exclusiveText:   { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
  exclusiveSource: { fontSize: 10, color: COLORS.textMuted, fontStyle: 'italic' },
  scoreCard:       { borderRadius: RADIUS.lg, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: COLORS.border },
  scoreTop:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  scoreNum:        { fontSize: 36, fontWeight: '800' },
  scoreOf:         { fontSize: 18, fontWeight: '400' },
  scoreLabel:      { fontSize: 11, fontWeight: '600', marginTop: 2 },
  scoreBadge:      { paddingHorizontal: 14, paddingVertical: 6, borderRadius: RADIUS.full },
  scoreBadgeText:  { color: COLORS.white, fontWeight: '700', fontSize: 13 },
  scoreMessage:    { fontSize: 12, lineHeight: 18, marginBottom: 10 },
  mddBar:          { flexDirection: 'row', gap: 4, marginBottom: 6 },
  mddSegment:      { flex: 1, height: 6, borderRadius: 3 },
  mddSource:       { fontSize: 10, color: COLORS.textMuted, fontStyle: 'italic' },
  groupsGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  groupCard:       { width: '47%', backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 12, borderWidth: 1.5, borderColor: COLORS.border, position: 'relative', minHeight: 110 },
  groupIconCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  groupName:       { fontSize: 12, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 3, lineHeight: 16 },
  groupExamples:   { fontSize: 10, color: COLORS.textMuted, lineHeight: 14, marginBottom: 3 },
  groupWhy:        { fontSize: 10, color: COLORS.primary, lineHeight: 14, fontStyle: 'italic' },
  checkMark:       { position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
});

const tc = StyleSheet.create({
  card:      { flexDirection: 'row', gap: 12, backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.lg, padding: 14, marginBottom: 4, borderWidth: 1, borderColor: COLORS.border },
  iconCircle:{ width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  tip:       { fontSize: 13, color: COLORS.textPrimary, lineHeight: 19, marginBottom: 6 },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  source:    { fontSize: 10, color: '#2A9D6E', fontStyle: 'italic', fontWeight: '600' },
  dotsRow:   { flexDirection: 'row', gap: 4, marginTop: 2 },
  dot:       { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.border },
  dotActive: { backgroundColor: COLORS.primary, width: 10 },
});