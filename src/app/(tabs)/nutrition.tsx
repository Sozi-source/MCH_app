/**
 * src/app/(tabs)/nutrition.tsx
 * ─────────────────────────────────────────────────────────────
 * mamaTOTO — Nutrition Screen (Age-Gated)
 *
 * Reads child age and auto-renders the appropriate content:
 *   0–5 months   → Exclusive breastfeeding support only
 *   6–11 months  → Introduction: feeding stage + food groups + meals
 *   12–23 months → Full screen: MDD + all sections
 *   24+ months   → Family foods: simplified, no MDD bar
 * ─────────────────────────────────────────────────────────────
 */

import { COLORS, RADIUS } from '@/lib/theme';
import { computeMDDStatus, FoodGroup } from '@/lib/nutritionService';
import { useFeedingStage, useNutritionTips, useFoodGroups } from '@/hooks/useNutrition';
import { askGroq } from '@/lib/zscore';
import { useChildStore } from '@/store/childStore';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Platform, RefreshControl,
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';

// ─── Helpers ──────────────────────────────────────────────────

function getAgeMonths(dob: string): number {
  const d = new Date(dob);
  const now = new Date();
  return Math.max(0, (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth()));
}

type AgePhase = 'exclusive' | 'introduction' | 'full' | 'family';

function getAgePhase(ageMonths: number): AgePhase {
  if (ageMonths < 6) return 'exclusive';
  if (ageMonths < 12) return 'introduction';
  if (ageMonths < 24) return 'full';
  return 'family';
}

// ─── Phase: Exclusive Breastfeeding (0–5 months) ──────────────

function ExclusiveBreastfeedingScreen({ ageMonths }: { ageMonths: number }) {
  const { data: tips = [], isLoading } = useNutritionTips(ageMonths);
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    if (tips.length === 0) return;
    const t = setInterval(() => setTipIndex(i => (i + 1) % tips.length), 9000);
    return () => clearInterval(t);
  }, [tips.length]);

  return (
    <View style={excl.container}>
      {/* Hero card */}
      <View style={excl.heroCard}>
        <View style={excl.heroIconWrap}>
          <Ionicons name="heart" size={36} color={COLORS.primary} />
        </View>
        <Text style={excl.heroTitle}>Exclusive Breastfeeding</Text>
        <Text style={excl.heroAge}>{ageMonths} month{ageMonths !== 1 ? 's' : ''} old</Text>
        <Text style={excl.heroBody}>
          Breast milk alone provides everything your baby needs right now — the perfect
          balance of nutrients, antibodies, and hydration. No water, formula, or other
          foods are needed.
        </Text>
        <View style={excl.heroBadge}>
          <Ionicons name="shield-checkmark-outline" size={11} color="#2A9D6E" />
          <Text style={excl.heroBadgeText}>WHO IYCF Guidelines, 2003 · Kenya MCH Handbook, 2022</Text>
        </View>
      </View>

      {/* Key guidance cards */}
      <View style={excl.guidanceGrid}>
        {[
          {
            icon: 'time-outline' as const,
            title: 'Feed on demand',
            body: 'Breastfeed whenever your baby shows hunger cues — at least 8–12 times in 24 hours.',
            color: '#1A6BB5',
          },
          {
            icon: 'water-outline' as const,
            title: 'No other liquids',
            body: 'Water, juice, tea, and formula are not needed and can reduce milk supply.',
            color: '#E67E22',
          },
          {
            icon: 'sunny-outline' as const,
            title: 'Vitamin D',
            body: 'A daily Vitamin D supplement (400 IU) is recommended, especially for indoor babies.',
            color: '#2A9D6E',
          },
          {
            icon: 'calendar-outline' as const,
            title: 'Continue until 6 months',
            body: 'Solid foods should only begin at exactly 6 months of age (180 days), not before.',
            color: '#7B5EA7',
          },
        ].map(card => (
          <View key={card.title} style={excl.guidanceCard}>
            <View style={[excl.guidanceIcon, { backgroundColor: card.color + '18' }]}>
              <Ionicons name={card.icon} size={18} color={card.color} />
            </View>
            <Text style={excl.guidanceTitle}>{card.title}</Text>
            <Text style={excl.guidanceBody}>{card.body}</Text>
          </View>
        ))}
      </View>

      {/* Rotating tips */}
      {!isLoading && tips.length > 0 && (
        <View style={excl.tipCard}>
          <View style={excl.tipPill}>
            <Ionicons name="bulb-outline" size={12} color="#FFFFFF" />
            <Text style={excl.tipPillText}>BREASTFEEDING TIP</Text>
          </View>
          <Text style={excl.tipText}>{tips[tipIndex].tip}</Text>
          <View style={excl.tipFooter}>
            <Ionicons name="shield-checkmark-outline" size={11} color="rgba(255,255,255,0.6)" />
            <Text style={excl.tipSource}>{tips[tipIndex].source} · {tips[tipIndex].source}</Text>
            {tips.length > 1 && (
              <View style={excl.tipDots}>
                {tips.map((_, i) => (
                  <View key={i} style={[excl.tipDot, i === tipIndex && excl.tipDotActive]} />
                ))}
              </View>
            )}
          </View>
        </View>
      )}

      {/* Next milestone */}
      <View style={excl.milestoneCard}>
        <Ionicons name="flag-outline" size={16} color="#7B5EA7" />
        <View style={{ flex: 1 }}>
          <Text style={excl.milestoneTitle}>Next milestone: {6 - ageMonths} month{(6 - ageMonths) !== 1 ? 's' : ''} away</Text>
          <Text style={excl.milestoneBody}>
            At 6 months you'll start complementary feeding — soft, mashed foods alongside
            continued breastfeeding. We'll guide you through every step.
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Rotating Tip Banner (6+ months) ──────────────────────────

function TipBanner({ ageMonths }: { ageMonths: number }) {
  const { data: tips = [], isLoading } = useNutritionTips(ageMonths);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (tips.length === 0) return;
    const t = setInterval(() => setIndex(i => (i + 1) % tips.length), 9000);
    return () => clearInterval(t);
  }, [tips.length]);

  if (isLoading) return (
    <View style={tb.skeleton}>
      <ActivityIndicator size="small" color="rgba(255,255,255,0.6)" />
    </View>
  );
  if (tips.length === 0) return null;

  const tip = tips[index];

  return (
    <View style={tb.card}>
      <View style={tb.pill}>
        <Ionicons name="bulb-outline" size={12} color="#FFFFFF" />
        <Text style={tb.pillText}>IYCF TIP</Text>
      </View>
      <Text style={tb.text}>{tip.tip}</Text>
      <View style={tb.footer}>
        <Ionicons name="shield-checkmark-outline" size={11} color="rgba(255,255,255,0.6)" />
        <Text style={tb.source}>{tip.source} · {tip.source}</Text>
        {tips.length > 1 && (
          <View style={tb.dots}>
            {tips.map((_, i) => (
              <View key={i} style={[tb.dot, i === index && tb.dotActive]} />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Feeding Stage Card ────────────────────────────────────────

function FeedingStageCard({ ageMonths }: { ageMonths: number }) {
  const { data: stage, isLoading } = useFeedingStage(ageMonths);
  const [expanded, setExpanded] = useState(false);

  if (isLoading) return <SkeletonCard height={160} />;
  if (!stage) return null;

  const stats = [
    { label: 'Meals/day', value: stage.meals_per_day },
    { label: 'Snacks', value: stage.snacks_per_day },
    { label: 'Per meal', value: stage.amount_per_meal },
    { label: 'Texture', value: stage.texture },
  ];

  return (
    <View style={fsc.card}>
      <View style={fsc.header}>
        <View style={fsc.iconWrap}>
          <Ionicons name="leaf-outline" size={18} color="#2A9D6E" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={fsc.stageName}>{stage.stage_name}</Text>
          <View style={fsc.badge}>
            <Ionicons name="checkmark-circle-outline" size={11} color="#2A9D6E" />
            <Text style={fsc.badgeText}>WHO Verified · {stage.guideline_version}</Text>
          </View>
        </View>
      </View>

      <View style={fsc.statRow}>
        {stats.map((s, i) => (
          <React.Fragment key={s.label}>
            <View style={fsc.stat}>
              <Text style={fsc.statValue} numberOfLines={2}>{s.value}</Text>
              <Text style={fsc.statLabel}>{s.label}</Text>
            </View>
            {i < stats.length - 1 && <View style={fsc.divider} />}
          </React.Fragment>
        ))}
      </View>

      <View style={fsc.bfRow}>
        <Ionicons name="heart-outline" size={14} color={COLORS.primary} />
        <View style={{ flex: 1 }}>
          <Text style={fsc.bfLabel}>Breastfeeding</Text>
          <Text style={fsc.bfValue}>{stage.breastfeeding_guidance}</Text>
        </View>
      </View>

      {stage.key_facts.length > 0 && (
        <>
          <TouchableOpacity style={fsc.expandBtn} onPress={() => setExpanded(e => !e)} activeOpacity={0.7}>
            <Text style={fsc.expandText}>
              {expanded ? 'Hide key facts' : `${stage.key_facts.length} key facts for this stage`}
            </Text>
            <Ionicons name={expanded ? 'chevron-up-outline' : 'chevron-down-outline'} size={16} color={COLORS.primary} />
          </TouchableOpacity>
          {expanded && (
            <View style={fsc.factsList}>
              {stage.key_facts.map((fact, i) => (
                <View key={i} style={fsc.factRow}>
                  <View style={fsc.factDot} />
                  <Text style={fsc.factText}>{fact}</Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </View>
  );
}

// ─── Food Group Checker (6–23 months) ─────────────────────────

function FoodGroupChecker({
  ageMonths,
  showMDD,
  checked,
  onToggle,
}: {
  ageMonths: number;
  showMDD: boolean;
  checked: Record<string, boolean>;
  onToggle: (id: string) => void;
}) {
  const { data: groups = [], isLoading } = useFoodGroups(ageMonths);
  const status = computeMDDStatus(checked, groups);

  if (isLoading) return <SkeletonCard height={200} />;

  return (
    <View>
      {showMDD && (
        <View style={[fgc.scoreStrip, { backgroundColor: status.bg, borderColor: status.color + '30' }]}>
          <View style={fgc.scoreLeft}>
            <Text style={[fgc.scoreNum, { color: status.color }]}>{status.score}</Text>
            <Text style={[fgc.scoreOf, { color: status.color }]}>/7</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={[fgc.scoreBadge, { backgroundColor: status.color }]}>
              <Text style={fgc.scoreBadgeText}>{status.label}</Text>
            </View>
            <Text style={[fgc.scoreMsg, { color: status.color + 'CC' }]}>{status.message}</Text>
            <View style={fgc.bar}>
              {Array.from({ length: 7 }, (_, i) => (
                <View
                  key={i}
                  style={[fgc.barSeg, { backgroundColor: i < status.score ? status.color : COLORS.border }]}
                />
              ))}
            </View>
            <Text style={fgc.barLabel}>WHO Minimum Dietary Diversity · target 4+ groups/day</Text>
          </View>
        </View>
      )}

      <View style={fgc.grid}>
        {groups.map(g => {
          const isOn = checked[g.id] ?? false;
          return (
            <FoodGroupCard
              key={g.id}
              group={g}
              checked={isOn}
              onToggle={() => onToggle(g.id)}
            />
          );
        })}
      </View>
    </View>
  );
}

function FoodGroupCard({
  group, checked, onToggle,
}: {
  group: FoodGroup; checked: boolean; onToggle: () => void;
}) {
  return (
    <TouchableOpacity
      style={[
        fgc.groupCard,
        checked && { borderColor: group.color_hex, borderWidth: 2, backgroundColor: group.color_hex + '0D' },
      ]}
      onPress={onToggle}
      activeOpacity={0.75}
    >
      {checked && (
        <View style={[fgc.check, { backgroundColor: group.color_hex }]}>
          <Ionicons name="checkmark" size={10} color="#FFFFFF" />
        </View>
      )}
      <View style={[fgc.dot, { backgroundColor: checked ? group.color_hex : COLORS.border }]} />
      <Text style={[fgc.groupName, checked && { color: group.color_hex }]} numberOfLines={2}>
        {group.name}
      </Text>
      <Text style={fgc.examples} numberOfLines={3}>{group.examples_local}</Text>
      <Text style={[fgc.why, checked && { color: group.color_hex + 'AA' }]} numberOfLines={2}>
        {group.why_important}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Phase: Family Foods (24+ months) ─────────────────────────

function FamilyFoodsSection({ ageMonths }: { ageMonths: number }) {
  const { data: stage, isLoading } = useFeedingStage(ageMonths);

  if (isLoading) return <SkeletonCard height={140} />;
  if (!stage) return null;

  return (
    <View style={ff.card}>
      <View style={ff.header}>
        <View style={ff.iconWrap}>
          <Ionicons name="people-outline" size={18} color="#7B5EA7" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={ff.title}>Family Foods Stage</Text>
          <Text style={ff.subtitle}>{stage.stage_name}</Text>
        </View>
      </View>

      <View style={ff.row}>
        <View style={ff.stat}>
          <Text style={ff.statVal}>{stage.meals_per_day}</Text>
          <Text style={ff.statLbl}>meals / day</Text>
        </View>
        <View style={ff.divider} />
        <View style={ff.stat}>
          <Text style={ff.statVal}>{stage.snacks_per_day}</Text>
          <Text style={ff.statLbl}>snacks</Text>
        </View>
        <View style={ff.divider} />
        <View style={ff.stat}>
          <Text style={ff.statVal}>{stage.texture}</Text>
          <Text style={ff.statLbl}>texture</Text>
        </View>
      </View>

      <View style={ff.bfRow}>
        <Ionicons name="heart-outline" size={14} color={COLORS.primary} />
        <Text style={ff.bfText}>{stage.breastfeeding_guidance}</Text>
      </View>

      {stage.key_facts.length > 0 && (
        <View style={ff.facts}>
          {stage.key_facts.map((fact, i) => (
            <View key={i} style={ff.factRow}>
              <View style={ff.factDot} />
              <Text style={ff.factText}>{fact}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Meal Suggestion Card ──────────────────────────────────────

function MealSuggestionCard({
  content, loading, onRefresh,
}: {
  content: string; loading: boolean; onRefresh: () => void;
}) {
  return (
    <View style={mc.card}>
      <View style={mc.header}>
        <View style={mc.iconWrap}>
          <Ionicons name="restaurant-outline" size={18} color="#E67E22" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={mc.title}>Today's Kenyan Meal Ideas</Text>
          <Text style={mc.subtitle}>Personalised · WHO IYCF &amp; Kenya MoH grounded</Text>
        </View>
        <TouchableOpacity
          onPress={onRefresh}
          disabled={loading}
          style={[mc.refreshBtn, loading && { opacity: 0.4 }]}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh-outline" size={16} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={mc.loadingRow}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={mc.loadingText}>Generating Kenyan meal ideas…</Text>
        </View>
      ) : (
        <Text style={mc.body}>{content}</Text>
      )}

      <View style={mc.footer}>
        <Ionicons name="sparkles-outline" size={11} color={COLORS.textMuted} />
        <Text style={mc.footerText}>AI-generated — does not replace clinical nutrition assessment</Text>
      </View>
    </View>
  );
}

// ─── Referral Card ─────────────────────────────────────────────

function ReferralCard() {
  return (
    <View style={rc.card}>
      <View style={rc.iconWrap}>
        <Ionicons name="medkit-outline" size={20} color="#5B6EAE" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={rc.title}>Need Professional Advice?</Text>
        <Text style={rc.body}>
          For therapeutic feeding, growth faltering, or clinical nutrition concerns, visit your
          nearest MCH clinic or consult a certified nutritionist.
        </Text>
        <View style={rc.divider} />
        <Text style={rc.disclaimer}>
          Feeding guidance is sourced from WHO IYCF Guidelines and the Kenya MCH Handbook.
          Meal suggestions are AI-generated and do not replace clinical assessment.
        </Text>
      </View>
    </View>
  );
}

// ─── Skeleton ──────────────────────────────────────────────────

function SkeletonCard({ height }: { height: number }) {
  return <View style={[sk.box, { height }]} />;
}

// ─── Section Header ────────────────────────────────────────────

function SectionHeader({
  title, action, onAction,
}: {
  title: string; action?: string; onAction?: () => void;
}) {
  return (
    <View style={sh.row}>
      <Text style={sh.title}>{title}</Text>
      {action && onAction && (
        <TouchableOpacity onPress={onAction} activeOpacity={0.7}>
          <Text style={sh.action}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Main Screen ───────────────────────────────────────────────

export default function NutritionScreen() {
  const router = useRouter();
  const { children, selectedChildId, growthRecords, fetchGrowthRecords } = useChildStore();
  const activeChild = children.find(c => c.id === selectedChildId) ?? children[0];

  const [checkedGroups, setCheckedGroups] = useState<Record<string, boolean>>({});
  const [mealContent, setMealContent]     = useState('');
  const [mealLoading, setMealLoading]     = useState(false);
  const [refreshing, setRefreshing]       = useState(false);

  const ageMonths = useMemo(() => {
    if (!activeChild?.date_of_birth) return 0;
    return getAgeMonths(activeChild.date_of_birth);
  }, [activeChild?.date_of_birth]);

  const phase = getAgePhase(ageMonths);

  const { data: stage }       = useFeedingStage(ageMonths);
  const { data: groups = [] } = useFoodGroups(ageMonths);
  const latestGrowth          = growthRecords[0];

  const mddStatus    = computeMDDStatus(checkedGroups, groups);
  const checkedCount = Object.values(checkedGroups).filter(Boolean).length;

  const childContext = useMemo(() => {
    if (!activeChild) return '';
    const g = latestGrowth
      ? `Weight: ${latestGrowth.weight_kg}kg, height: ${latestGrowth.height_cm ?? 'not recorded'}cm, WAZ: ${latestGrowth.waz ?? 'N/A'}.`
      : 'No growth records yet.';
    return `Child: ${activeChild.full_name}, ${ageMonths} months, sex: ${activeChild.sex}. ${g}`;
  }, [activeChild, ageMonths, latestGrowth]);

  const fetchMeals = useCallback(async () => {
    if (!childContext || !stage || phase === 'exclusive') return;
    setMealLoading(true);
    const eaten   = groups.filter(g => checkedGroups[g.id]).map(g => g.name);
    const missing = groups.filter(g => !checkedGroups[g.id]).map(g => g.name);
    try {
      const result = await askGroq(
        `${childContext}
Stage: ${stage.stage_name}. Texture: ${stage.texture}. Amount: ${stage.amount_per_meal}.
Eaten today: ${eaten.length > 0 ? eaten.join(', ') : 'none yet'}.
Missing food groups: ${missing.join(', ')}.

Using ONLY Kenyan foods and WHO complementary feeding guidelines, suggest 3 specific meal ideas.
Use: ugali, sukuma wiki, beans, eggs, uji, githeri, liver, fish, omena, sweet potato, mango, avocado, groundnut paste.
Format: 3 numbered meals, one sentence each. Do not invent nutritional claims.`,
        'You are a Kenya MCH nutrition counsellor. Only suggest meals using locally available Kenyan foods consistent with WHO IYCF and Kenya MoH guidelines. Never fabricate nutritional claims.',
        0.5,
      );
      setMealContent(result);
    } catch {
      setMealContent('Could not load suggestions. Tap refresh to try again.');
    } finally {
      setMealLoading(false);
    }
  }, [childContext, checkedGroups, stage, groups, phase]);

  useEffect(() => {
    if (activeChild) {
      fetchGrowthRecords(activeChild.id);
      if (phase !== 'exclusive') fetchMeals();
    }
  }, [activeChild?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (activeChild) await fetchGrowthRecords(activeChild.id);
    if (phase !== 'exclusive') await fetchMeals();
    setRefreshing(false);
  };

  const toggleGroup = (id: string) =>
    setCheckedGroups(prev => ({ ...prev, [id]: !prev[id] }));

  const resetChecklist = () => {
    const doReset = () => setCheckedGroups({});
    Platform.OS === 'web'
      ? window.confirm("Reset today's food checklist?") && doReset()
      : Alert.alert(
          'Reset Checklist',
          "Clear today's food group log?",
          [{ text: 'Cancel', style: 'cancel' }, { text: 'Reset', style: 'destructive', onPress: doReset }],
        );
  };

  // ── Empty state ──────────────────────────────────────────────

  if (!activeChild) {
    return (
      <View style={s.screen}>
        <View style={s.header}>
          <View style={s.headerTopBar}>
            <Ionicons name="nutrition-outline" size={20} color={COLORS.onPrimary} />
            <Text style={s.headerTitle}>Nutrition Guide</Text>
          </View>
        </View>
        <View style={s.empty}>
          <Text style={s.emptyEmoji}>🥦</Text>
          <Text style={s.emptyTitle}>No child selected</Text>
          <Text style={s.emptySub}>
            Go to the Children tab to select or add a child profile.
          </Text>
          <TouchableOpacity
            style={s.emptyBtn}
            onPress={() => router.push('/(tabs)/children' as any)}
            activeOpacity={0.85}
          >
            <Ionicons name="people-outline" size={16} color={COLORS.onPrimary} />
            <Text style={s.emptyBtnText}>Go to Children</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Phase label for header subtitle ─────────────────────────

  const phaseLabel: Record<AgePhase, string> = {
    exclusive:    'Exclusive breastfeeding',
    introduction: 'Complementary feeding',
    full:         'Complementary feeding',
    family:       'Family foods',
  };

  return (
    <View style={s.screen}>
      {/* ── Header ───────────────────────────────────────────── */}
      <View style={s.header}>
        <View style={s.headerTopBar}>
          <View style={s.headerIconCircle}>
            <Ionicons name="nutrition-outline" size={18} color={COLORS.primary} />
          </View>
          <Text style={s.headerTitle}>Nutrition Guide</Text>
          <TouchableOpacity
            onPress={onRefresh}
            disabled={refreshing}
            style={[s.headerRefresh, refreshing && { opacity: 0.5 }]}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh-outline" size={18} color={COLORS.onPrimary} />
          </TouchableOpacity>
        </View>

        {/* Child strip */}
        <View style={s.childStrip}>
          <View style={s.childAvatar}>
            <Ionicons
              name={activeChild.sex === 'female' ? 'female-outline' : 'male-outline'}
              size={14}
              color={COLORS.onPrimary}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.childName}>{activeChild.full_name}</Text>
            <Text style={s.childAge}>
              {ageMonths} months · {phaseLabel[phase]}
            </Text>
          </View>

          {/* MDD pill — only for full phase */}
          {phase === 'full' && (
            <View style={s.mddPill}>
              <Text style={s.mddPillScore}>{mddStatus.score}</Text>
              <Text style={s.mddPillOf}>/7 groups</Text>
            </View>
          )}

          {/* WAZ pill */}
          {latestGrowth?.waz != null && (
            <View style={s.wazPill}>
              <Text style={s.wazText}>WAZ {latestGrowth.waz.toFixed(1)}</Text>
            </View>
          )}
        </View>
      </View>

      {/* ── Content by phase ─────────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >

        {/* ══ 0–5 months ══════════════════════════════════════ */}
        {phase === 'exclusive' && (
          <ExclusiveBreastfeedingScreen ageMonths={ageMonths} />
        )}

        {/* ══ 6–11 months ═════════════════════════════════════ */}
        {phase === 'introduction' && (
          <>
            <TipBanner ageMonths={ageMonths} />

            <SectionHeader title="Current Feeding Stage" />
            <FeedingStageCard ageMonths={ageMonths} />

            <SectionHeader
              title="Today's Food Groups"
              action={checkedCount > 0 ? 'Reset' : undefined}
              onAction={checkedCount > 0 ? resetChecklist : undefined}
            />
            <Text style={s.sectionDesc}>
              Tap each food group your child has eaten today. Aim for variety — the more
              groups, the better the nutrition at this introduction stage.
            </Text>
            <FoodGroupChecker
              ageMonths={ageMonths}
              showMDD={false}
              checked={checkedGroups}
              onToggle={toggleGroup}
            />

            <SectionHeader title="Meal Suggestions" />
            <Text style={s.sectionDesc}>
              Kenyan meals suited to your baby's age and today's food intake.
            </Text>
            <MealSuggestionCard
              content={mealContent}
              loading={mealLoading}
              onRefresh={fetchMeals}
            />
          </>
        )}

        {/* ══ 12–23 months ════════════════════════════════════ */}
        {phase === 'full' && (
          <>
            <TipBanner ageMonths={ageMonths} />

            <SectionHeader title="Current Feeding Stage" />
            <FeedingStageCard ageMonths={ageMonths} />

            <SectionHeader
              title="Today's Food Groups"
              action={checkedCount > 0 ? 'Reset' : undefined}
              onAction={checkedCount > 0 ? resetChecklist : undefined}
            />
            <Text style={s.sectionDesc}>
              WHO recommends at least 4 food groups daily for children 6–23 months.
              Tap each group your child has eaten today.
            </Text>
            <FoodGroupChecker
              ageMonths={ageMonths}
              showMDD={true}
              checked={checkedGroups}
              onToggle={toggleGroup}
            />

            <SectionHeader title="Meal Suggestions" />
            <Text style={s.sectionDesc}>
              Kenyan meals based on what your child has eaten today and their growth data.
            </Text>
            <MealSuggestionCard
              content={mealContent}
              loading={mealLoading}
              onRefresh={fetchMeals}
            />
          </>
        )}

        {/* ══ 24+ months ══════════════════════════════════════ */}
        {phase === 'family' && (
          <>
            <TipBanner ageMonths={ageMonths} />

            <SectionHeader title="Feeding at This Stage" />
            <FamilyFoodsSection ageMonths={ageMonths} />

            <SectionHeader
              title="Today's Food Groups"
              action={checkedCount > 0 ? 'Reset' : undefined}
              onAction={checkedCount > 0 ? resetChecklist : undefined}
            />
            <Text style={s.sectionDesc}>
              Keep aiming for variety. Tap each group your child has eaten today.
            </Text>
            <FoodGroupChecker
              ageMonths={ageMonths}
              showMDD={false}
              checked={checkedGroups}
              onToggle={toggleGroup}
            />

            <SectionHeader title="Meal Suggestions" />
            <MealSuggestionCard
              content={mealContent}
              loading={mealLoading}
              onRefresh={fetchMeals}
            />
          </>
        )}

        <ReferralCard />
        <View style={{ height: 140 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },

  header: {
    backgroundColor: COLORS.primary,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingTop: 56,
    paddingBottom: 18,
    paddingHorizontal: 20,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  headerTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  headerIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.onPrimary,
    letterSpacing: -0.3,
  },
  headerRefresh: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  childStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: RADIUS.xl,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  childAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  childName: { fontSize: 14, fontWeight: '700', color: COLORS.onPrimary },
  childAge:  { fontSize: 11, color: 'rgba(255,255,255,0.72)', marginTop: 1 },

  mddPill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 2,
  },
  mddPillScore: { fontSize: 14, fontWeight: '800', color: COLORS.onPrimary },
  mddPillOf:    { fontSize: 10, color: 'rgba(255,255,255,0.7)' },

  wazPill: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: RADIUS.full,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  wazText: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },

  scroll: { paddingHorizontal: 16, paddingTop: 20 },
  sectionDesc: {
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 18,
    marginBottom: 12,
    marginTop: -4,
  },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 8 },
  emptySub:   { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  emptyBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.xl,
    paddingHorizontal: 24,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emptyBtnText: { color: COLORS.onPrimary, fontWeight: '700', fontSize: 14 },
});

const sh = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 28,
    marginBottom: 10,
  },
  title:  { flex: 1, fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
  action: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
});

// Exclusive breastfeeding screen
const excl = StyleSheet.create({
  container: { gap: 16 },

  heroCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderTopWidth: 4,
    borderTopColor: COLORS.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  heroIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },
  heroAge: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '700',
    marginBottom: 12,
  },
  heroBody: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 14,
  },
  heroBadge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  heroBadgeText: { fontSize: 10, color: '#2A9D6E', fontStyle: 'italic', fontWeight: '600' },

  guidanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  guidanceCard: {
    width: '47.5%',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
    minHeight: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  guidanceIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guidanceTitle: { fontSize: 12, fontWeight: '800', color: COLORS.textPrimary },
  guidanceBody:  { fontSize: 11, color: COLORS.textMuted, lineHeight: 17 },

  tipCard: {
    backgroundColor: '#1A6BB5',
    borderRadius: RADIUS.xl,
    padding: 16,
  },
  tipPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tipPillText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.8 },
  tipText:     { fontSize: 13, color: '#FFFFFF', lineHeight: 20, fontWeight: '500', marginBottom: 10 },
  tipFooter:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tipSource:   { fontSize: 10, color: 'rgba(255,255,255,0.65)', fontStyle: 'italic', flex: 1 },
  tipDots:     { flexDirection: 'row', gap: 4 },
  tipDot:      { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' },
  tipDotActive:{ backgroundColor: 'rgba(255,255,255,0.9)', width: 10 },

  milestoneCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#F3EFFC',
    borderRadius: RADIUS.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: '#D8D0F5',
    alignItems: 'flex-start',
  },
  milestoneTitle: { fontSize: 13, fontWeight: '800', color: '#7B5EA7', marginBottom: 5 },
  milestoneBody:  { fontSize: 12, color: '#7B5EA7CC', lineHeight: 19 },
});

// Tip banner (6+ months)
const tb = StyleSheet.create({
  skeleton: {
    height: 80,
    backgroundColor: '#1A6BB5',
    borderRadius: RADIUS.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  card: {
    backgroundColor: '#1A6BB5',
    borderRadius: RADIUS.xl,
    padding: 16,
    marginBottom: 4,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.8 },
  text:     { fontSize: 13, color: '#FFFFFF', lineHeight: 20, fontWeight: '500', marginBottom: 10 },
  footer:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  source:   { fontSize: 10, color: 'rgba(255,255,255,0.65)', fontStyle: 'italic', flex: 1 },
  dots:     { flexDirection: 'row', gap: 4 },
  dot:      { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotActive:{ backgroundColor: 'rgba(255,255,255,0.9)', width: 10 },
});

// Feeding stage card
const fsc = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: 16,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 4,
    borderLeftColor: '#2A9D6E',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: '#E8F8F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageName: { fontSize: 14, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 4 },
  badge:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  badgeText: { fontSize: 10, color: '#2A9D6E', fontWeight: '600', fontStyle: 'italic' },

  statRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.lg,
    paddingVertical: 12,
    marginBottom: 14,
  },
  stat:      { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  divider:   { width: 1, backgroundColor: COLORS.border, marginVertical: 4 },
  statValue: { fontSize: 11, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center', lineHeight: 15, marginBottom: 3 },
  statLabel: { fontSize: 9, fontWeight: '600', color: COLORS.textMuted, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.3 },

  bfRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FFF5F8',
    borderRadius: RADIUS.md,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#FFD6E7',
  },
  bfLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, marginBottom: 2 },
  bfValue: { fontSize: 12, color: COLORS.textPrimary, lineHeight: 18 },

  expandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: 2,
  },
  expandText: { flex: 1, fontSize: 12, color: COLORS.primary, fontWeight: '700' },

  factsList: { marginTop: 10, gap: 10 },
  factRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  factDot:   { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#2A9D6E', marginTop: 5, flexShrink: 0 },
  factText:  { flex: 1, fontSize: 12, color: COLORS.textPrimary, lineHeight: 19 },
});

// Food group checker
const fgc = StyleSheet.create({
  scoreStrip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    borderRadius: RADIUS.xl,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
  },
  scoreLeft:      { alignItems: 'flex-end', paddingTop: 2 },
  scoreNum:       { fontSize: 38, fontWeight: '800', lineHeight: 40 },
  scoreOf:        { fontSize: 13, fontWeight: '500', color: COLORS.textMuted },
  scoreBadge:     { alignSelf: 'flex-start', borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 6 },
  scoreBadgeText: { color: '#FFFFFF', fontWeight: '800', fontSize: 11 },
  scoreMsg:       { fontSize: 11, lineHeight: 17, marginBottom: 10 },
  bar:            { flexDirection: 'row', gap: 4, marginBottom: 6 },
  barSeg:         { flex: 1, height: 6, borderRadius: 3 },
  barLabel:       { fontSize: 9, color: COLORS.textMuted, fontStyle: 'italic' },

  grid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  groupCard: {
    width: '47.5%',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    position: 'relative',
    minHeight: 110,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  check: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot:       { width: 10, height: 10, borderRadius: 5, marginBottom: 8 },
  groupName: { fontSize: 11, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4, lineHeight: 15 },
  examples:  { fontSize: 10, color: COLORS.textMuted, lineHeight: 14, marginBottom: 4 },
  why:       { fontSize: 10, color: COLORS.primary, lineHeight: 14, fontStyle: 'italic' },
});

// Family foods section
const ff = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: 16,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 4,
    borderLeftColor: '#7B5EA7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: '#F3EFFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title:    { fontSize: 14, fontWeight: '800', color: COLORS.textPrimary },
  subtitle: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },

  row:     { flexDirection: 'row', backgroundColor: COLORS.background, borderRadius: RADIUS.lg, paddingVertical: 12, marginBottom: 14 },
  stat:    { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  divider: { width: 1, backgroundColor: COLORS.border, marginVertical: 4 },
  statVal: { fontSize: 11, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center', marginBottom: 3 },
  statLbl: { fontSize: 9, fontWeight: '600', color: COLORS.textMuted, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.3 },

  bfRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  bfText: { fontSize: 12, color: COLORS.textPrimary, flex: 1, lineHeight: 18 },

  facts:   { gap: 10, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 12 },
  factRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  factDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#7B5EA7', marginTop: 5, flexShrink: 0 },
  factText:{ flex: 1, fontSize: 12, color: COLORS.textPrimary, lineHeight: 19 },
});

// Meal suggestion card
const mc = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: 16,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 4,
    borderLeftColor: '#E67E22',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  header:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  iconWrap:   { width: 34, height: 34, borderRadius: RADIUS.md, backgroundColor: '#FEF5EB', alignItems: 'center', justifyContent: 'center' },
  title:      { fontSize: 13, fontWeight: '800', color: COLORS.textPrimary },
  subtitle:   { fontSize: 10, color: COLORS.textMuted, marginTop: 1 },
  refreshBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  loadingText:{ fontSize: 12, color: COLORS.textMuted, fontStyle: 'italic' },
  body:       { fontSize: 13, color: COLORS.textPrimary, lineHeight: 22 },
  footer:     { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border },
  footerText: { fontSize: 10, color: COLORS.textMuted, fontStyle: 'italic', flex: 1 },
});

// Referral card
const rc = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: '#F0EFFC',
    borderRadius: RADIUS.xl,
    padding: 16,
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#D0CEFA',
  },
  iconWrap:   { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E8EAF6', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 },
  title:      { fontSize: 13, fontWeight: '800', color: '#3A4A8A', marginBottom: 6 },
  body:       { fontSize: 12, color: '#3A4A8A', lineHeight: 18, marginBottom: 10 },
  divider:    { height: 1, backgroundColor: '#D0CEFA', marginBottom: 8 },
  disclaimer: { fontSize: 11, color: '#7B8FA1', lineHeight: 16, fontStyle: 'italic' },
});

// Skeleton
const sk = StyleSheet.create({
  box: { backgroundColor: COLORS.border, borderRadius: RADIUS.xl, marginBottom: 4, opacity: 0.5 },
});