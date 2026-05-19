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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAgeMonths(dob: string): number {
  const d = new Date(dob);
  const now = new Date();
  return Math.max(0, (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth()));
}

// ─── Feeding Stage Card ───────────────────────────────────────────────────────

function FeedingStageCard({ ageMonths }: { ageMonths: number }) {
  const stage = getFeedingStage(ageMonths);
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={sc.card}>
      {/* Decorative overlay circle */}
      <View style={sc.decorCircle} />

      <View style={sc.topRow}>
        <View style={sc.iconSquare}>
          <Ionicons name="leaf" size={16} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={sc.stageName}>{stage.stage}</Text>
          <View style={sc.sourceTag}>
            <Ionicons name="shield-checkmark" size={10} color="#2A9D6E" />
            <Text style={sc.sourceTagText}>WHO Verified · {stage.source}</Text>
          </View>
        </View>
      </View>

      {/* Stats grid */}
      <View style={sc.grid}>
        <View style={sc.gridItem}>
          <Text style={sc.gridEmoji}>🍽️</Text>
          <Text style={sc.gridValue}>{stage.mealsPerDay}</Text>
          <Text style={sc.gridLabel}>Meals / day</Text>
        </View>
        <View style={sc.gridDivider} />
        <View style={sc.gridItem}>
          <Text style={sc.gridEmoji}>🍎</Text>
          <Text style={sc.gridValue}>{stage.snacksPerDay}</Text>
          <Text style={sc.gridLabel}>Snacks</Text>
        </View>
        <View style={sc.gridDivider} />
        <View style={sc.gridItem}>
          <Text style={sc.gridEmoji}>🥄</Text>
          <Text style={sc.gridValue}>{stage.amountPerMeal}</Text>
          <Text style={sc.gridLabel}>Per meal</Text>
        </View>
        <View style={sc.gridDivider} />
        <View style={sc.gridItem}>
          <Text style={sc.gridEmoji}>✋</Text>
          <Text style={sc.gridValue}>{stage.texture}</Text>
          <Text style={sc.gridLabel}>Texture</Text>
        </View>
      </View>

      {/* Breastfeeding row */}
      <View style={sc.bfRow}>
        <View style={sc.bfIconCircle}>
          <Ionicons name="heart" size={12} color={COLORS.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={sc.bfLabel}>Breastfeeding</Text>
          <Text style={sc.bfValue}>{stage.breastfeeding}</Text>
        </View>
      </View>

      {/* Expand key facts */}
      <TouchableOpacity style={sc.expandBtn} onPress={() => setExpanded(e => !e)} activeOpacity={0.7}>
        <Text style={sc.expandBtnText}>
          {expanded ? 'Hide key facts' : `${stage.keyFacts.length} key facts for this stage`}
        </Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={COLORS.primary} />
      </TouchableOpacity>

      {expanded && (
        <View style={sc.factsContainer}>
          {stage.keyFacts.map((fact, i) => (
            <View key={i} style={sc.factRow}>
              <View style={sc.factDot}>
                <Ionicons name="checkmark" size={10} color="#FFFFFF" />
              </View>
              <Text style={sc.factText}>{fact}</Text>
            </View>
          ))}
        </View>
      )}
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
      <View style={tc.decorCircle} />
      <View style={tc.leftCol}>
        <View style={tc.iconCircle}>
          <Ionicons name="bulb" size={16} color="#FFFFFF" />
        </View>
        <Text style={tc.label}>TIP</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={tc.tip}>{tip.tip}</Text>
        <View style={tc.sourceRow}>
          <Ionicons name="shield-checkmark" size={10} color="#2A9D6E" />
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
      <View style={ai.decorCircle} />
      <View style={ai.headerRow}>
        <View style={ai.iconSquare}>
          <Ionicons name="fast-food" size={16} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={ai.title}>Today's Kenyan Meal Ideas</Text>
          <Text style={ai.subtitle}>Personalised for your child</Text>
        </View>
        <TouchableOpacity
          onPress={onRefresh}
          disabled={loading}
          style={[ai.refreshBtn, loading && { opacity: 0.4 }]}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh" size={15} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={ai.loadingRow}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={ai.loadingText}>Generating meal ideas…</Text>
        </View>
      ) : (
        <Text style={ai.body}>{content}</Text>
      )}

      <View style={ai.aiTag}>
        <Ionicons name="sparkles" size={10} color={COLORS.primary} />
        <Text style={ai.aiTagText}>
          AI-personalised · grounded in WHO IYCF &amp; Kenya MoH guidelines
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
        <View style={fg.exclusiveIconCircle}>
          <Ionicons name="heart" size={28} color={COLORS.primary} />
        </View>
        <Text style={fg.exclusiveTitle}>Exclusive Breastfeeding Period</Text>
        <Text style={fg.exclusiveText}>
          Your baby is under 6 months. Breast milk alone provides complete
          nutrition — no other foods or drinks are needed.
        </Text>
        <View style={fg.exclusiveSourceTag}>
          <Ionicons name="shield-checkmark" size={10} color="#2A9D6E" />
          <Text style={fg.exclusiveSource}>WHO IYCF Guidelines, 2003</Text>
        </View>
      </View>
    );
  }

  return (
    <View>
      {/* MDD Score Card */}
      <View style={[fg.scoreCard, { backgroundColor: status.bg, borderColor: status.color + '30' }]}>
        <View style={fg.scoreTop}>
          <View style={{ flex: 1 }}>
            <View style={fg.scoreNumRow}>
              <Text style={[fg.scoreNum, { color: status.color }]}>{status.score}</Text>
              <Text style={[fg.scoreOf, { color: status.color }]}>/7</Text>
              <View style={[fg.scoreBadge, { backgroundColor: status.color }]}>
                <Text style={fg.scoreBadgeText}>{status.label}</Text>
              </View>
            </View>
            <Text style={[fg.scoreLabel, { color: status.color }]}>Food Groups Today</Text>
          </View>
        </View>
        <Text style={[fg.scoreMessage, { color: status.color + 'DD' }]}>{status.message}</Text>
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
          WHO Minimum Dietary Diversity · Target: 4+ food groups / day
        </Text>
      </View>

      {/* Food Group Grid */}
      <View style={fg.groupsGrid}>
        {available.map(g => {
          const isChecked = checked[g.id] ?? false;
          return (
            <TouchableOpacity
              key={g.id}
              style={[
                fg.groupCard,
                isChecked && { borderColor: g.color, backgroundColor: g.bg, borderWidth: 2 },
              ]}
              onPress={() => onToggle(g.id)}
              activeOpacity={0.75}
            >
              {isChecked && (
                <View style={[fg.checkMark, { backgroundColor: g.color }]}>
                  <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                </View>
              )}
              <View style={[
                fg.groupIconCircle,
                { backgroundColor: isChecked ? g.color : COLORS.background },
              ]}>
                <Ionicons
                  name={g.icon as any}
                  size={18}
                  color={isChecked ? '#FFFFFF' : COLORS.textMuted}
                />
              </View>
              <Text
                style={[fg.groupName, isChecked && { color: g.color, fontWeight: '700' }]}
                numberOfLines={2}
              >
                {g.name}
              </Text>
              <Text style={fg.groupExamples} numberOfLines={2}>{g.examples}</Text>
              <Text style={[fg.groupWhy, isChecked && { color: g.color + 'BB' }]} numberOfLines={2}>
                {g.whyImportant}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Section Header Component ─────────────────────────────────────────────────

function SectionHeader({
  icon, iconColor = COLORS.primary, title, action, onAction,
}: {
  icon: string; iconColor?: string; title: string; action?: string; onAction?: () => void;
}) {
  return (
    <View style={sh.row}>
      <View style={[sh.iconCircle, { backgroundColor: iconColor + '18' }]}>
        <Ionicons name={icon as any} size={14} color={iconColor} />
      </View>
      <Text style={sh.title}>{title}</Text>
      {action && onAction && (
        <TouchableOpacity onPress={onAction} activeOpacity={0.7}>
          <Text style={sh.action}>{action}</Text>
        </TouchableOpacity>
      )}
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
      : Alert.alert('Reset Checklist', "Clear today's food group log?", [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Reset', style: 'destructive', onPress: reset },
        ]);
  };

  // ─── Empty state ───────────────────────────────────────────────────────────

  if (!activeChild) {
    return (
      <View style={styles.screen}>
        {/* Header still shown */}
        <View style={styles.header}>
          <View style={styles.headerTopBar}>
            <View style={styles.headerIconCircle}>
              <Ionicons name="nutrition" size={20} color={COLORS.primary} />
            </View>
            <Text style={styles.headerTitle}>Nutrition Guide</Text>
          </View>
        </View>
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Text style={styles.emptyEmoji}>🥦</Text>
          </View>
          <Text style={styles.emptyTitle}>No child selected</Text>
          <Text style={styles.emptySub}>
            Head to the Children tab to select or add a child profile to see personalised nutrition guidance.
          </Text>
          <TouchableOpacity
            style={styles.goBtn}
            onPress={() => router.push('/(tabs)/children' as any)}
            activeOpacity={0.85}
          >
            <Ionicons name="people" size={16} color={COLORS.onPrimary} />
            <Text style={styles.goBtnText}>Go to Children</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── Score summary for header ──────────────────────────────────────────────
  const mddStatus = getMDDStatus(checkedGroups);
  const checkedCount = Object.values(checkedGroups).filter(Boolean).length;

  return (
    <View style={styles.screen}>
      {/* ── Hero Header ──────────────────────────────────────────────────── */}
      <View style={styles.header}>
        {/* Decorative circles */}
        <View style={styles.headerDecorCircle1} />
        <View style={styles.headerDecorCircle2} />

        {/* Top bar */}
        <View style={styles.headerTopBar}>
          <View style={styles.headerIconCircle}>
            <Ionicons name="nutrition" size={18} color={COLORS.primary} />
          </View>
          <Text style={styles.headerTitle}>Nutrition Guide</Text>
          <TouchableOpacity
            onPress={onRefresh}
            disabled={refreshing}
            style={[styles.headerRefreshBtn, refreshing && { opacity: 0.5 }]}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh" size={18} color={COLORS.onPrimary} />
          </TouchableOpacity>
        </View>

        {/* Child info strip */}
        <View style={styles.childStrip}>
          <View style={styles.childAvatarCircle}>
            <Ionicons
              name={activeChild.sex === 'female' ? 'female' : 'male'}
              size={14}
              color={COLORS.onPrimary}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.childName}>{activeChild.full_name}</Text>
            <Text style={styles.childAge}>
              {ageMonths} months · {stage.stage.split('(')[0].trim()}
            </Text>
          </View>

          {/* MDD pill in header */}
          {ageMonths >= 6 && (
            <View style={styles.mddHeaderPill}>
              <Text style={styles.mddHeaderScore}>{mddStatus.score}</Text>
              <Text style={styles.mddHeaderOf}>/7</Text>
              <Text style={styles.mddHeaderLabel}> groups</Text>
            </View>
          )}

          {latestGrowth?.waz !== null && latestGrowth?.waz !== undefined && (
            <View style={styles.wazPill}>
              <Ionicons name="trending-up" size={10} color="rgba(255,255,255,0.8)" />
              <Text style={styles.wazText}>WAZ {latestGrowth.waz.toFixed(1)}</Text>
            </View>
          )}
        </View>
      </View>

      {/* ── Scroll Content ────────────────────────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* Rotating Tip */}
        <TipCard ageMonths={ageMonths} />

        {/* ── Feeding Stage ─────────────────────────────────────────────── */}
        <SectionHeader
          icon="shield-checkmark"
          iconColor="#2A9D6E"
          title="Current Feeding Stage"
          action="WHO Verified ✓"
        />
        <FeedingStageCard ageMonths={ageMonths} />

        {/* ── Food Group Checklist ──────────────────────────────────────── */}
        <SectionHeader
          icon="checkmark-circle"
          iconColor={COLORS.primary}
          title="Today's Food Groups"
          action={checkedCount > 0 ? 'Reset' : undefined}
          onAction={checkedCount > 0 ? resetChecklist : undefined}
        />
        <Text style={styles.sectionDesc}>
          Tap each food group your child has eaten today. WHO recommends at least 4 groups daily for children over 6 months.
        </Text>
        <FoodGroupChecker
          ageMonths={ageMonths}
          checked={checkedGroups}
          onToggle={toggleGroup}
        />

        {/* ── Meal Suggestions ─────────────────────────────────────────── */}
        <SectionHeader
          icon="fast-food"
          iconColor="#E67E22"
          title="Meal Suggestions"
        />
        <Text style={styles.sectionDesc}>
          Kenyan meals suggested based on what your child has eaten today and their growth data.
        </Text>
        <AICard
          content={mealSuggestions}
          loading={loadingMeals}
          onRefresh={fetchMealSuggestions}
        />

        {/* ── Referral Banner ───────────────────────────────────────────── */}
        <View style={styles.referralCard}>
          <View style={styles.referralDecorCircle} />
          <View style={styles.referralIconCircle}>
            <Ionicons name="medkit" size={18} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.referralTitle}>Need Professional Advice?</Text>
            <Text style={styles.referralText}>
              For therapeutic feeding or growth concerns, consult a certified nutritionist at your nearest MCH clinic.
            </Text>
            <View style={styles.referralDivider} />
            <Text style={styles.referralNote}>
              Feeding stage data is sourced from WHO IYCF Guidelines and the Kenya MCH Handbook. Meal suggestions are AI-generated based on these verified guidelines and do not replace clinical assessment.
            </Text>
          </View>
        </View>

        <View style={{ height: 140 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },

  // Header
  header: {
    backgroundColor: COLORS.primary,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingTop: 56,
    paddingBottom: 20,
    paddingHorizontal: 20,
    overflow: 'hidden',
    // Shadow
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 10,
  },
  headerDecorCircle1: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 40,
    borderColor: 'rgba(255,255,255,0.07)',
    top: -60,
    right: -60,
  },
  headerDecorCircle2: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 24,
    borderColor: 'rgba(255,255,255,0.06)',
    bottom: -40,
    left: 40,
  },
  headerTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  headerIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.onPrimary,
    letterSpacing: -0.3,
  },
  headerRefreshBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Child strip in header
  childStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: RADIUS.xl,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  childAvatarCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  childName: { fontSize: 14, fontWeight: '700', color: COLORS.onPrimary },
  childAge:  { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 1 },

  mddHeaderPill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  mddHeaderScore: { fontSize: 15, fontWeight: '800', color: COLORS.onPrimary },
  mddHeaderOf:    { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.75)' },
  mddHeaderLabel: { fontSize: 10, color: 'rgba(255,255,255,0.7)' },

  wazPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: RADIUS.full,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  wazText: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.9)' },

  // Scroll
  scroll: { paddingHorizontal: 16, paddingTop: 20 },

  sectionDesc: {
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 18,
    marginBottom: 12,
    marginTop: -4,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyEmoji:  { fontSize: 44 },
  emptyTitle:  { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 10 },
  emptySub:    { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  goBtn:       {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.xl,
    paddingHorizontal: 24,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  goBtnText: { color: COLORS.onPrimary, fontWeight: '700', fontSize: 14 },

  // Referral card
  referralCard: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: '#F0EFFC',
    borderRadius: RADIUS.xl,
    padding: 16,
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#D0CEFA',
    overflow: 'hidden',
    position: 'relative',
  },
  referralDecorCircle: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 24,
    borderColor: 'rgba(91,110,174,0.1)',
    bottom: -40,
    right: -30,
  },
  referralIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#5B6EAE',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
    shadowColor: '#5B6EAE',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  referralTitle:   { fontSize: 14, fontWeight: '800', color: '#3A4A8A', marginBottom: 6 },
  referralText:    { fontSize: 12, color: '#3A4A8A', lineHeight: 18, marginBottom: 10 },
  referralDivider: { height: 1, backgroundColor: '#D0CEFA', marginBottom: 10 },
  referralNote:    { fontSize: 11, color: '#7B8FA1', lineHeight: 16, fontStyle: 'italic' },
});

// Section header styles
const sh = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    marginTop: 28,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title:  { flex: 1, fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
  action: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
});

// Feeding stage card styles
const sc = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: 18,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    position: 'relative',
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    // Green left accent
    borderLeftWidth: 4,
    borderLeftColor: '#2A9D6E',
  },
  decorCircle: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 32,
    borderColor: 'rgba(42,157,110,0.05)',
    bottom: -50,
    right: -50,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 18,
  },
  iconSquare: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    backgroundColor: '#2A9D6E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2A9D6E',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  stageName: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 5,
    lineHeight: 20,
  },
  sourceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sourceTagText: { fontSize: 10, color: '#2A9D6E', fontWeight: '600', fontStyle: 'italic' },

  // Stats grid
  grid: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.lg,
    padding: 14,
    marginBottom: 16,
  },
  gridItem: { flex: 1, alignItems: 'center', gap: 2 },
  gridDivider: { width: 1, height: 44, backgroundColor: COLORS.border },
  gridEmoji: { fontSize: 16, marginBottom: 2 },
  gridValue: { fontSize: 12, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center', lineHeight: 16 },
  gridLabel: { fontSize: 9, fontWeight: '600', color: COLORS.textMuted, textAlign: 'center' },

  // Breastfeeding
  bfRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FFF0F5',
    borderRadius: RADIUS.md,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FFD6E7',
  },
  bfIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFD6E7',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  bfLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, marginBottom: 3 },
  bfValue: { fontSize: 12, color: COLORS.textPrimary, lineHeight: 18 },

  // Expand
  expandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: 4,
  },
  expandBtnText: { fontSize: 12, color: COLORS.primary, fontWeight: '700', flex: 1 },

  // Facts
  factsContainer: { marginTop: 10, gap: 10 },
  factRow:        { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  factDot:        {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#2A9D6E',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  factText: { flex: 1, fontSize: 12, color: COLORS.textPrimary, lineHeight: 19 },
});

// Tip card styles
const tc = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: '#1A6BB5',
    borderRadius: RADIUS.xl,
    padding: 16,
    marginBottom: 4,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#208AEF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  decorCircle: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 28,
    borderColor: 'rgba(255,255,255,0.08)',
    bottom: -40,
    right: -30,
  },
  leftCol: { alignItems: 'center', gap: 6 },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 8, fontWeight: '800', color: 'rgba(255,255,255,0.6)', letterSpacing: 1 },
  tip: { fontSize: 13, color: '#FFFFFF', lineHeight: 20, marginBottom: 8, fontWeight: '500' },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  source:    { fontSize: 10, color: 'rgba(255,255,255,0.75)', fontStyle: 'italic', fontWeight: '600' },
  dotsRow:   { flexDirection: 'row', gap: 4 },
  dot:       { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotActive: { backgroundColor: 'rgba(255,255,255,0.9)', width: 12 },
});

// AI meal card styles
const ai = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: 18,
    marginBottom: 4,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 4,
    borderLeftColor: '#E67E22',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  decorCircle: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 28,
    borderColor: 'rgba(230,126,34,0.05)',
    bottom: -40,
    right: -30,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  iconSquare: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: '#E67E22',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#E67E22',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  title:    { fontSize: 14, fontWeight: '800', color: COLORS.textPrimary },
  subtitle: { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  refreshBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  loadingText: { fontSize: 12, color: COLORS.textMuted, fontStyle: 'italic' },
  body:        { fontSize: 13, color: COLORS.textPrimary, lineHeight: 22 },
  aiTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  aiTagText: { fontSize: 10, color: COLORS.textMuted, fontStyle: 'italic', flex: 1 },
});

// Food group checker styles
const fg = StyleSheet.create({
  exclusiveBox: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.xl,
    padding: 24,
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  exclusiveIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  exclusiveTitle:  { fontSize: 15, fontWeight: '800', color: COLORS.primary, textAlign: 'center' },
  exclusiveText:   { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
  exclusiveSourceTag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  exclusiveSource: { fontSize: 10, color: '#2A9D6E', fontStyle: 'italic', fontWeight: '600' },

  // Score card
  scoreCard: {
    borderRadius: RADIUS.xl,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  scoreTop: { marginBottom: 8 },
  scoreNumRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginBottom: 3,
  },
  scoreNum:      { fontSize: 42, fontWeight: '800', lineHeight: 48 },
  scoreOf:       { fontSize: 20, fontWeight: '500', marginBottom: 2 },
  scoreBadge:    {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    marginLeft: 8,
    alignSelf: 'center',
  },
  scoreBadgeText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  scoreLabel:     { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  scoreMessage:   { fontSize: 12, lineHeight: 18, marginBottom: 12 },
  mddBar:         { flexDirection: 'row', gap: 5, marginBottom: 8 },
  mddSegment:     { flex: 1, height: 7, borderRadius: 4 },
  mddSource:      { fontSize: 10, color: COLORS.textMuted, fontStyle: 'italic' },

  // Food group grid
  groupsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  groupCard: {
    width: '47%',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    position: 'relative',
    minHeight: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  groupIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  groupName:     { fontSize: 12, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4, lineHeight: 16 },
  groupExamples: { fontSize: 10, color: COLORS.textMuted, lineHeight: 14, marginBottom: 4 },
  groupWhy:      { fontSize: 10, color: COLORS.primary, lineHeight: 14, fontStyle: 'italic' },
  checkMark: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
});