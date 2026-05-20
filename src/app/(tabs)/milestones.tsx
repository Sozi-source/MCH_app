/**
 * src/app/(tabs)/milestones.tsx
 * ZuriHealth — Premium Milestone Tracker
 * 0–5 years · Motor, Language, Social, Cognitive
 */

import { supabase } from '@/lib/supabase';
import { COLORS, RADIUS } from '@/lib/theme';
import { useChildStore } from '@/store/childStore';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// ── Types ─────────────────────────────────────────────────────────────────────

type Category = 'motor' | 'language' | 'social' | 'cognitive';
type MilestoneStatus = 'achieved' | 'in_progress' | 'not_yet';

interface Milestone {
  id: string;
  ageMonths: number;
  ageLabel: string;
  category: Category;
  title: string;
  description: string;
  status: MilestoneStatus;
  achievedDate?: string;
}

// ── Milestone Data ─────────────────────────────────────────────────────────────

const MILESTONE_DATA: Omit<Milestone, 'status' | 'achievedDate'>[] = [
  { id: 'm_2_mot_1',  ageMonths: 2,  ageLabel: '2 months',  category: 'motor',    title: 'Holds head up briefly',      description: 'Can lift head when lying on tummy' },
  { id: 'm_2_lan_1',  ageMonths: 2,  ageLabel: '2 months',  category: 'language', title: 'Makes cooing sounds',         description: 'Produces soft vowel sounds like "ooh" and "aah"' },
  { id: 'm_2_soc_1',  ageMonths: 2,  ageLabel: '2 months',  category: 'social',   title: 'Social smile',                description: 'Smiles in response to your face or voice' },
  { id: 'm_2_cog_1',  ageMonths: 2,  ageLabel: '2 months',  category: 'cognitive',title: 'Follows object with eyes',    description: 'Tracks a moving object or face with their gaze' },
  { id: 'm_4_mot_1',  ageMonths: 4,  ageLabel: '4 months',  category: 'motor',    title: 'Holds head steady',           description: 'Head is stable when held upright' },
  { id: 'm_4_mot_2',  ageMonths: 4,  ageLabel: '4 months',  category: 'motor',    title: 'Pushes up on arms',           description: 'Lifts chest off floor during tummy time' },
  { id: 'm_4_lan_1',  ageMonths: 4,  ageLabel: '4 months',  category: 'language', title: 'Laughs and squeals',          description: 'Produces laughter and high-pitched sounds' },
  { id: 'm_4_soc_1',  ageMonths: 4,  ageLabel: '4 months',  category: 'social',   title: 'Recognises familiar faces',   description: 'Shows excitement when seeing known caregivers' },
  { id: 'm_4_cog_1',  ageMonths: 4,  ageLabel: '4 months',  category: 'cognitive',title: 'Reaches for objects',         description: 'Intentionally reaches toward dangling toys' },
  { id: 'm_6_mot_1',  ageMonths: 6,  ageLabel: '6 months',  category: 'motor',    title: 'Sits with support',           description: 'Can sit upright when propped or supported' },
  { id: 'm_6_mot_2',  ageMonths: 6,  ageLabel: '6 months',  category: 'motor',    title: 'Rolls both ways',             description: 'Rolls from back to tummy and back again' },
  { id: 'm_6_lan_1',  ageMonths: 6,  ageLabel: '6 months',  category: 'language', title: 'Babbles consonants',          description: 'Strings together sounds like "ba", "da", "ma"' },
  { id: 'm_6_soc_1',  ageMonths: 6,  ageLabel: '6 months',  category: 'social',   title: 'Knows familiar vs strangers', description: 'May show wariness toward unfamiliar people' },
  { id: 'm_6_cog_1',  ageMonths: 6,  ageLabel: '6 months',  category: 'cognitive',title: 'Explores with mouth & hands', description: 'Puts objects in mouth to explore them' },
  { id: 'm_9_mot_1',  ageMonths: 9,  ageLabel: '9 months',  category: 'motor',    title: 'Sits without support',        description: 'Sits steadily on their own for several minutes' },
  { id: 'm_9_mot_2',  ageMonths: 9,  ageLabel: '9 months',  category: 'motor',    title: 'Crawls or scoots',            description: 'Moves across the floor in any coordinated way' },
  { id: 'm_9_lan_1',  ageMonths: 9,  ageLabel: '9 months',  category: 'language', title: 'Says "mama" / "dada"',        description: 'Uses these sounds specifically for parents' },
  { id: 'm_9_soc_1',  ageMonths: 9,  ageLabel: '9 months',  category: 'social',   title: 'Plays peek-a-boo',            description: 'Enjoys and anticipates hide-and-seek games' },
  { id: 'm_9_cog_1',  ageMonths: 9,  ageLabel: '9 months',  category: 'cognitive',title: 'Object permanence',           description: 'Looks for a toy hidden under a cloth' },
  { id: 'm_12_mot_1', ageMonths: 12, ageLabel: '12 months', category: 'motor',    title: 'Pulls to stand',              description: 'Pulls themselves up using furniture' },
  { id: 'm_12_mot_2', ageMonths: 12, ageLabel: '12 months', category: 'motor',    title: 'Cruises along furniture',     description: 'Walks sideways holding onto surfaces' },
  { id: 'm_12_lan_1', ageMonths: 12, ageLabel: '12 months', category: 'language', title: 'First words',                 description: 'Says 1–3 words with meaning beyond mama/dada' },
  { id: 'm_12_soc_1', ageMonths: 12, ageLabel: '12 months', category: 'social',   title: 'Waves bye-bye',               description: 'Waves on request or spontaneously' },
  { id: 'm_12_cog_1', ageMonths: 12, ageLabel: '12 months', category: 'cognitive',title: 'Imitates actions',            description: 'Copies simple actions like clapping or stirring' },
  { id: 'm_12_cog_2', ageMonths: 12, ageLabel: '12 months', category: 'cognitive',title: 'Uses pincer grasp',           description: 'Picks up small objects with thumb and forefinger' },
  { id: 'm_18_mot_1', ageMonths: 18, ageLabel: '18 months', category: 'motor',    title: 'Walks independently',         description: 'Walks well without support' },
  { id: 'm_18_mot_2', ageMonths: 18, ageLabel: '18 months', category: 'motor',    title: 'Climbs onto furniture',       description: 'Climbs onto chairs or low surfaces' },
  { id: 'm_18_lan_1', ageMonths: 18, ageLabel: '18 months', category: 'language', title: 'Uses 10–20 words',            description: 'Has a vocabulary of at least 10 words' },
  { id: 'm_18_soc_1', ageMonths: 18, ageLabel: '18 months', category: 'social',   title: 'Parallel play',               description: 'Plays alongside (not yet with) other children' },
  { id: 'm_18_cog_1', ageMonths: 18, ageLabel: '18 months', category: 'cognitive',title: 'Points to named body parts',  description: 'Points to head, eyes, nose when asked' },
  { id: 'm_24_mot_1', ageMonths: 24, ageLabel: '2 years',   category: 'motor',    title: 'Runs steadily',               description: 'Runs with good balance and coordination' },
  { id: 'm_24_mot_2', ageMonths: 24, ageLabel: '2 years',   category: 'motor',    title: 'Kicks a ball',                description: 'Kicks a ball forward without falling' },
  { id: 'm_24_lan_1', ageMonths: 24, ageLabel: '2 years',   category: 'language', title: 'Two-word phrases',            description: 'Combines two words e.g. "more milk", "daddy go"' },
  { id: 'm_24_lan_2', ageMonths: 24, ageLabel: '2 years',   category: 'language', title: '50+ word vocabulary',         description: 'Uses at least 50 different words' },
  { id: 'm_24_soc_1', ageMonths: 24, ageLabel: '2 years',   category: 'social',   title: 'Plays with others briefly',   description: 'Engages in short cooperative play with peers' },
  { id: 'm_24_cog_1', ageMonths: 24, ageLabel: '2 years',   category: 'cognitive',title: 'Sorts shapes & colours',      description: 'Matches objects by shape or colour' },
  { id: 'm_24_cog_2', ageMonths: 24, ageLabel: '2 years',   category: 'cognitive',title: 'Simple pretend play',         description: 'Pretends to feed a doll or talk on a phone' },
  { id: 'm_36_mot_1', ageMonths: 36, ageLabel: '3 years',   category: 'motor',    title: 'Jumps with both feet',        description: 'Jumps off the ground with both feet together' },
  { id: 'm_36_mot_2', ageMonths: 36, ageLabel: '3 years',   category: 'motor',    title: 'Climbs stairs alternating',   description: 'Goes up stairs one foot per step' },
  { id: 'm_36_lan_1', ageMonths: 36, ageLabel: '3 years',   category: 'language', title: '3-word sentences',            description: 'Speaks in short sentences of 3+ words' },
  { id: 'm_36_soc_1', ageMonths: 36, ageLabel: '3 years',   category: 'social',   title: 'Takes turns in games',        description: 'Understands and follows simple turn-taking rules' },
  { id: 'm_36_cog_1', ageMonths: 36, ageLabel: '3 years',   category: 'cognitive',title: 'Knows own name & age',        description: 'Can state their full name and how old they are' },
  { id: 'm_36_cog_2', ageMonths: 36, ageLabel: '3 years',   category: 'cognitive',title: 'Draws a circle',              description: 'Can copy a circle shape when shown' },
  { id: 'm_48_mot_1', ageMonths: 48, ageLabel: '4 years',   category: 'motor',    title: 'Hops on one foot',            description: 'Can hop several times on one foot' },
  { id: 'm_48_mot_2', ageMonths: 48, ageLabel: '4 years',   category: 'motor',    title: 'Catches a bounced ball',      description: 'Catches a ball bounced to them most of the time' },
  { id: 'm_48_lan_1', ageMonths: 48, ageLabel: '4 years',   category: 'language', title: 'Tells simple stories',        description: 'Recounts events with a beginning and end' },
  { id: 'm_48_soc_1', ageMonths: 48, ageLabel: '4 years',   category: 'social',   title: 'Cooperative play',            description: 'Plans and plays games with other children' },
  { id: 'm_48_cog_1', ageMonths: 48, ageLabel: '4 years',   category: 'cognitive',title: 'Counts to 10',                description: 'Counts objects accurately up to 10' },
  { id: 'm_48_cog_2', ageMonths: 48, ageLabel: '4 years',   category: 'cognitive',title: 'Draws a person',              description: 'Draws a person with at least 4 body parts' },
  { id: 'm_60_mot_1', ageMonths: 60, ageLabel: '5 years',   category: 'motor',    title: 'Skips and hops well',         description: 'Skips alternating feet with ease' },
  { id: 'm_60_mot_2', ageMonths: 60, ageLabel: '5 years',   category: 'motor',    title: 'Writes own name',             description: 'Can print first name recognisably' },
  { id: 'm_60_lan_1', ageMonths: 60, ageLabel: '5 years',   category: 'language', title: 'Uses full sentences',         description: 'Speaks in full grammatically correct sentences' },
  { id: 'm_60_lan_2', ageMonths: 60, ageLabel: '5 years',   category: 'language', title: 'Asks "why" questions',        description: 'Asks many "why" and "how" questions' },
  { id: 'm_60_soc_1', ageMonths: 60, ageLabel: '5 years',   category: 'social',   title: 'Follows rules in games',      description: 'Understands and follows rules in group games' },
  { id: 'm_60_cog_1', ageMonths: 60, ageLabel: '5 years',   category: 'cognitive',title: 'Counts to 20+',              description: 'Counts objects reliably beyond 20' },
  { id: 'm_60_cog_2', ageMonths: 60, ageLabel: '5 years',   category: 'cognitive',title: 'Knows letters of alphabet',   description: 'Recognises most letters of the alphabet' },
];

// ── Category config ───────────────────────────────────────────────────────────

const CATEGORIES: {
  key: Category; label: string; icon: string;
  color: string; bg: string; emoji: string;
}[] = [
  { key: 'motor',    label: 'Motor',    icon: 'body',          color: '#FF6B35', bg: '#FFF0EB', emoji: '🏃' },
  { key: 'language', label: 'Language', icon: 'chatbubble',    color: '#1D9E75', bg: '#E6F7F2', emoji: '💬' },
  { key: 'social',   label: 'Social',   icon: 'people',        color: '#9C27B0', bg: '#F3E5F5', emoji: '🤝' },
  { key: 'cognitive',label: 'Cognitive',icon: 'bulb',          color: '#FF9800', bg: '#FFF8E1', emoji: '🧠' },
];

const STATUS_CONFIG: Record<MilestoneStatus, {
  label: string; color: string; bg: string; icon: string; emoji: string;
}> = {
  achieved:    { label: 'Achieved',    color: '#1D9E75', bg: '#E6F7F2', icon: 'checkmark-circle', emoji: '🎉' },
  in_progress: { label: 'In Progress', color: '#FF9800', bg: '#FFF8E1', icon: 'time',             emoji: '⏳' },
  not_yet:     { label: 'Not Yet',     color: '#A0AEC0', bg: '#F7FAFC', icon: 'ellipse-outline',  emoji: '' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getAgeMonths(dob: string): number {
  const birth = new Date(dob);
  const now = new Date();
  return Math.floor((now.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
}

function groupByAge(milestones: Milestone[]) {
  const groups: Record<string, Milestone[]> = {};
  milestones.forEach(m => {
    if (!groups[m.ageLabel]) groups[m.ageLabel] = [];
    groups[m.ageLabel].push(m);
  });
  return groups;
}

// ── Category Summary Cards ────────────────────────────────────────────────────

function CategoryCard({
  cat, milestones, active, onPress,
}: {
  cat: typeof CATEGORIES[0];
  milestones: Milestone[];
  active: boolean;
  onPress: () => void;
}) {
  const total    = milestones.filter(m => m.category === cat.key).length;
  const achieved = milestones.filter(m => m.category === cat.key && m.status === 'achieved').length;
  const pct      = total > 0 ? Math.round((achieved / total) * 100) : 0;

  return (
    <TouchableOpacity
      style={[
        styles.catCard,
        active
          ? { backgroundColor: cat.color, borderColor: cat.color }
          : { backgroundColor: '#fff', borderColor: '#E2E8F0' },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[
        styles.catCardIcon,
        { backgroundColor: active ? 'rgba(255,255,255,0.25)' : cat.bg },
      ]}>
        <Text style={styles.catEmoji}>{cat.emoji}</Text>
      </View>
      <Text style={[styles.catCardLabel, active && { color: '#fff' }]}>{cat.label}</Text>
      <Text style={[styles.catCardPct, active && { color: 'rgba(255,255,255,0.9)' }]}>
        {achieved}/{total}
      </Text>
      {/* Mini progress bar */}
      <View style={[styles.catBar, { backgroundColor: active ? 'rgba(255,255,255,0.25)' : '#F0F4F8' }]}>
        <View style={[
          styles.catBarFill,
          {
            width: `${pct}%` as any,
            backgroundColor: active ? '#fff' : cat.color,
          },
        ]} />
      </View>
    </TouchableOpacity>
  );
}

// ── Milestone Card ────────────────────────────────────────────────────────────

function MilestoneCard({
  m, catCfg, saving, onPress,
}: {
  m: Milestone;
  catCfg: typeof CATEGORIES[0];
  saving: boolean;
  onPress: () => void;
}) {
  const cfg = STATUS_CONFIG[m.status];
  const isAchieved = m.status === 'achieved';

  return (
    <TouchableOpacity
      style={[
        styles.card,
        isAchieved && styles.cardAchieved,
        { borderLeftColor: catCfg.color },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
      disabled={saving}
    >
      {/* Category icon */}
      <View style={[styles.cardIconWrap, { backgroundColor: catCfg.bg }]}>
        <Ionicons name={catCfg.icon as any} size={18} color={catCfg.color} />
      </View>

      {/* Text */}
      <View style={styles.cardBody}>
        <View style={styles.cardTitleRow}>
          <Text style={[styles.cardTitle, isAchieved && styles.cardTitleAchieved]}>
            {m.title}
          </Text>
          {isAchieved && <Text style={styles.achievedEmoji}>🎉</Text>}
        </View>
        <Text style={styles.cardDesc}>{m.description}</Text>
        {isAchieved && m.achievedDate && (
          <View style={styles.achievedDateRow}>
            <Ionicons name="checkmark-circle" size={11} color="#1D9E75" />
            <Text style={styles.achievedDateText}>Achieved {m.achievedDate}</Text>
          </View>
        )}
      </View>

      {/* Status button */}
      <View style={styles.cardRight}>
        {saving ? (
          <ActivityIndicator size="small" color={catCfg.color} />
        ) : (
          <View style={[styles.statusBtn, { backgroundColor: cfg.bg, borderColor: cfg.color + '40' }]}>
            <Ionicons name={cfg.icon as any} size={18} color={cfg.color} />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function MilestonesScreen() {
  const { children, selectedChildId } = useChildStore();
  const child = children.find(c => c.id === selectedChildId) ?? children[0];

  const [milestones, setMilestones]       = useState<Milestone[]>([]);
  const [loading, setLoading]             = useState(true);
  const [activeCategory, setActiveCategory] = useState<Category | 'all'>('all');
  const [saving, setSaving]               = useState<string | null>(null);

  const childAgeMonths = child?.date_of_birth ? getAgeMonths(child.date_of_birth) : null;

  useEffect(() => {
    if (child?.id) loadMilestones(child.id);
  }, [child?.id]);

  const loadMilestones = async (childId: string) => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('child_milestones')
        .select('*')
        .eq('child_id', childId);

      const saved = data ?? [];
      const merged: Milestone[] = MILESTONE_DATA.map(m => {
        const record = saved.find((s: any) => s.milestone_id === m.id);
        return {
          ...m,
          status:       record?.status ?? 'not_yet',
          achievedDate: record?.achieved_date ?? undefined,
        };
      });
      setMilestones(merged);
    } catch (e) {
      console.error('loadMilestones error', e);
    } finally {
      setLoading(false);
    }
  };

  const cycleStatus = async (milestone: Milestone) => {
    if (!child?.id) return;
    const order: MilestoneStatus[] = ['not_yet', 'in_progress', 'achieved'];
    const nextIdx    = (order.indexOf(milestone.status) + 1) % order.length;
    const nextStatus = order[nextIdx];
    const achievedDate = nextStatus === 'achieved'
      ? new Date().toISOString().slice(0, 10)
      : null;

    setSaving(milestone.id);
    try {
      await supabase.from('child_milestones').upsert(
        { child_id: child.id, milestone_id: milestone.id, status: nextStatus, achieved_date: achievedDate },
        { onConflict: 'child_id,milestone_id' },
      );
      setMilestones(prev => prev.map(m =>
        m.id === milestone.id
          ? { ...m, status: nextStatus, achievedDate: achievedDate ?? undefined }
          : m,
      ));
      if (nextStatus === 'achieved') {
        Alert.alert('🎉 Milestone achieved!', `${milestone.title} — amazing progress!`);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not save');
    } finally {
      setSaving(null);
    }
  };

  // Stats
  const total      = milestones.length;
  const achieved   = milestones.filter(m => m.status === 'achieved').length;
  const inProgress = milestones.filter(m => m.status === 'in_progress').length;
  const pct        = total > 0 ? Math.round((achieved / total) * 100) : 0;

  // Filtered + grouped
  const filtered = milestones.filter(m =>
    activeCategory === 'all' || m.category === activeCategory,
  );
  const groups = groupByAge(filtered);

  // ── Empty state ────────────────────────────────────────────────────────────

  if (!child) return (
    <View style={styles.screen}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Milestones</Text>
        <Text style={styles.heroSub}>Developmental tracker · 0–5 years</Text>
      </View>
      <View style={styles.emptyState}>
        <Text style={styles.emptyEmoji}>🏆</Text>
        <Text style={styles.emptyTitle}>No child selected</Text>
        <Text style={styles.emptySub}>
          Go to the Children tab to select or add a child first.
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>

      {/* ── Hero Header ──────────────────────────────────────────────── */}
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.heroTitle}>Milestones 🏆</Text>
            <Text style={styles.heroSub}>
              {child.full_name}
              {childAgeMonths !== null ? ` · ${childAgeMonths} months old` : ''}
            </Text>
          </View>
          {/* Progress ring */}
          <View style={styles.ringWrap}>
            <View style={styles.ring}>
              <Text style={styles.ringPct}>{pct}%</Text>
              <Text style={styles.ringLabel}>done</Text>
            </View>
          </View>
        </View>

        {/* Overall progress bar */}
        <View style={styles.heroBar}>
          <View style={[styles.heroBarFill, { width: `${pct}%` as any }]} />
        </View>
        <View style={styles.heroStats}>
          <Text style={styles.heroStatText}>
            <Text style={styles.heroStatNum}>{achieved}</Text> achieved
          </Text>
          <Text style={styles.heroStatText}>
            <Text style={styles.heroStatNum}>{inProgress}</Text> in progress
          </Text>
          <Text style={styles.heroStatText}>
            <Text style={styles.heroStatNum}>{total - achieved - inProgress}</Text> not yet
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Category Cards ──────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Categories</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catRow}
        >
          <TouchableOpacity
            style={[
              styles.catCard,
              activeCategory === 'all'
                ? { backgroundColor: COLORS.primary, borderColor: COLORS.primary }
                : { backgroundColor: '#fff', borderColor: '#E2E8F0' },
            ]}
            onPress={() => setActiveCategory('all')}
            activeOpacity={0.8}
          >
            <View style={[styles.catCardIcon, {
              backgroundColor: activeCategory === 'all' ? 'rgba(255,255,255,0.25)' : COLORS.primaryLight,
            }]}>
              <Text style={styles.catEmoji}>✨</Text>
            </View>
            <Text style={[styles.catCardLabel, activeCategory === 'all' && { color: '#fff' }]}>All</Text>
            <Text style={[styles.catCardPct, activeCategory === 'all' && { color: 'rgba(255,255,255,0.9)' }]}>
              {achieved}/{total}
            </Text>
            <View style={[styles.catBar, {
              backgroundColor: activeCategory === 'all' ? 'rgba(255,255,255,0.25)' : '#F0F4F8',
            }]}>
              <View style={[styles.catBarFill, {
                width: `${pct}%` as any,
                backgroundColor: activeCategory === 'all' ? '#fff' : COLORS.primary,
              }]} />
            </View>
          </TouchableOpacity>

          {CATEGORIES.map(cat => (
            <CategoryCard
              key={cat.key}
              cat={cat}
              milestones={milestones}
              active={activeCategory === cat.key}
              onPress={() => setActiveCategory(
                activeCategory === cat.key ? 'all' : cat.key
              )}
            />
          ))}
        </ScrollView>

        {/* ── Milestone List ──────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>
          {activeCategory === 'all' ? 'All Milestones' : CATEGORIES.find(c => c.key === activeCategory)?.label + ' Milestones'}
        </Text>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading milestones…</Text>
          </View>
        ) : (
          Object.entries(groups).map(([ageLabel, items]) => {
            const ageMonths = items[0].ageMonths;
            const isCurrentAge = childAgeMonths !== null &&
              childAgeMonths >= ageMonths - 2 &&
              childAgeMonths <= ageMonths + 2;

            return (
              <View key={ageLabel} style={styles.ageGroup}>
                {/* Age group header */}
                <View style={styles.ageHeader}>
                  <View style={[
                    styles.agePill,
                    isCurrentAge && { backgroundColor: COLORS.primary },
                  ]}>
                    <Ionicons
                      name="time-outline"
                      size={11}
                      color={isCurrentAge ? '#fff' : '#5C6BC0'}
                    />
                    <Text style={[styles.ageText, isCurrentAge && { color: '#fff' }]}>
                      {ageLabel}
                    </Text>
                    {isCurrentAge && (
                      <View style={styles.nowBadge}>
                        <Text style={styles.nowText}>NOW</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.ageLine} />
                  <Text style={styles.ageCount}>
                    {items.filter(m => m.status === 'achieved').length}/{items.length}
                  </Text>
                </View>

                {/* Cards */}
                {items.map(m => {
                  const catCfg = CATEGORIES.find(c => c.key === m.category)!;
                  return (
                    <MilestoneCard
                      key={m.id}
                      m={m}
                      catCfg={catCfg}
                      saving={saving === m.id}
                      onPress={() => cycleStatus(m)}
                    />
                  );
                })}
              </View>
            );
          })
        )}

        {/* Tap hint */}
        <View style={styles.hintCard}>
          <Ionicons name="finger-print-outline" size={16} color={COLORS.textMuted} />
          <Text style={styles.hintText}>
            Tap any milestone to cycle through: Not Yet → In Progress → Achieved
          </Text>
        </View>

        <View style={{ height: 140 }} />
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0F4F8' },

  // Hero
  hero: {
    backgroundColor: COLORS.primary,
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  heroTitle: { fontSize: 24, fontWeight: '800', color: '#fff' },
  heroSub:   { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 3 },

  ringWrap: { alignItems: 'center', justifyContent: 'center' },
  ring: {
    width: 62, height: 62,
    borderRadius: 31,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.4)',
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringPct:   { fontSize: 16, fontWeight: '800', color: '#fff' },
  ringLabel: { fontSize: 9,  color: 'rgba(255,255,255,0.8)' },

  heroBar: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 3,
    marginBottom: 10,
    overflow: 'hidden',
  },
  heroBarFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 3,
  },
  heroStats: { flexDirection: 'row', justifyContent: 'space-between' },
  heroStatText: { fontSize: 11, color: 'rgba(255,255,255,0.75)' },
  heroStatNum:  { fontWeight: '800', color: '#fff' },

  // Scroll
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20 },
  sectionTitle:  { fontSize: 16, fontWeight: '800', color: '#1A202C', marginBottom: 12 },

  // Category cards
  catRow: { flexDirection: 'row', gap: 10, paddingBottom: 4, marginBottom: 20 },
  catCard: {
    width: 110,
    borderRadius: 18,
    padding: 12,
    borderWidth: 1.5,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  catCardIcon: {
    width: 38, height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catEmoji:     { fontSize: 20 },
  catCardLabel: { fontSize: 12, fontWeight: '800', color: '#1A202C' },
  catCardPct:   { fontSize: 11, color: '#888', fontWeight: '600' },
  catBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  catBarFill: {
    height: '100%',
    borderRadius: 2,
  },

  // Age groups
  ageGroup:  { marginBottom: 24 },
  ageHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  agePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#E8EAF6',
  },
  ageText:  { fontSize: 12, fontWeight: '700', color: '#5C6BC0' },
  nowBadge: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    marginLeft: 2,
  },
  nowText:   { fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  ageLine:   { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
  ageCount:  { fontSize: 11, fontWeight: '700', color: COLORS.textMuted },

  // Milestone cards
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    borderLeftWidth: 4,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardAchieved: {
    backgroundColor: '#F6FFFC',
  },
  cardIconWrap: {
    width: 40, height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardBody:       { flex: 1 },
  cardTitleRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  cardTitle:      { fontSize: 14, fontWeight: '700', color: '#1A202C', flex: 1 },
  cardTitleAchieved: { color: '#1D9E75' },
  achievedEmoji:  { fontSize: 14 },
  cardDesc:       { fontSize: 12, color: '#718096', lineHeight: 17 },
  achievedDateRow:{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  achievedDateText:{ fontSize: 11, color: '#1D9E75', fontWeight: '600' },
  cardRight:      { flexShrink: 0 },
  statusBtn: {
    width: 36, height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },

  // Loading
  loadingWrap: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  loadingText: { color: COLORS.textMuted, fontSize: 13 },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 10,
  },
  emptyEmoji: { fontSize: 56 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#1A202C' },
  emptySub:   { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },

  // Hint
  hintCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  hintText: { flex: 1, fontSize: 12, color: COLORS.textMuted, lineHeight: 17 },
});
