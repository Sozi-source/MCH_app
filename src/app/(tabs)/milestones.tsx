function toTitleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, (ch: string) => ch.toUpperCase());
}

/**
 * src/app/(tabs)/milestones.tsx
 * ZuriHealth — Milestone Tracker (Revamped)
 * Professional PNG icons · no inline Ionicons
 */

import { supabase } from '@/lib/supabase';
import { COLORS, FONTS, RADIUS } from '@/lib/theme';
import { useChildStore } from '@/store/childStore';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// ── Icon map ──────────────────────────────────────────────────────────────────

const ICONS = {
  // Category
  motor:     require('@/assets/milestones/cat-motor.png'),
  language:  require('@/assets/milestones/cat-language.png'),
  social:    require('@/assets/milestones/cat-social.png'),
  cognitive: require('@/assets/milestones/cat-cognitive.png'),
  // Status
  achieved:    require('@/assets/milestones/status-achieved.png'),
  in_progress: require('@/assets/milestones/status-in-progress.png'),
  not_yet:     require('@/assets/milestones/status-not-yet.png'),
};

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
  { id: 'm_60_cog_1', ageMonths: 60, ageLabel: '5 years',   category: 'cognitive',title: 'Counts to 20+',               description: 'Counts objects reliably beyond 20' },
  { id: 'm_60_cog_2', ageMonths: 60, ageLabel: '5 years',   category: 'cognitive',title: 'Knows letters of alphabet',   description: 'Recognises most letters of the alphabet' },
];

// ── Category config ───────────────────────────────────────────────────────────

const CATEGORIES: {
  key: Category; label: string; color: string; bg: string; iconBg: string;
}[] = [
  { key: 'motor',    label: 'Motor',     color: '#FF6B35', bg: '#FFF0EB', iconBg: '#FFE4D6' },
  { key: 'language', label: 'Language',  color: '#1D9E75', bg: '#E6F7F2', iconBg: '#C8EEE3' },
  { key: 'social',   label: 'Social',    color: '#9C27B0', bg: '#F3E5F5', iconBg: '#E4C8F0' },
  { key: 'cognitive',label: 'Cognitive', color: '#E65100', bg: '#FFF3E0', iconBg: '#FFE0B2' },
];

const STATUS_CONFIG: Record<MilestoneStatus, {
  label: string; color: string; bg: string; borderColor: string;
}> = {
  achieved:    { label: 'Achieved',    color: '#1D9E75', bg: '#E6F7F2', borderColor: '#9FE1CB' },
  in_progress: { label: 'In Progress', color: '#E65100', bg: '#FFF3E0', borderColor: '#FFCC80' },
  not_yet:     { label: 'Not Yet',     color: '#94A3B8', bg: '#F8FAFC', borderColor: '#E2E8F0' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getAgeMonths(dob: string): number {
  const birth = new Date(dob);
  const now   = new Date();
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

// ── AnimatedMilestoneCard ─────────────────────────────────────────────────────

function MilestoneCard({
  m, catCfg, saving, onPress,
}: {
  m: Milestone;
  catCfg: typeof CATEGORIES[0];
  saving: boolean;
  onPress: () => void;
}) {
  const cfg        = STATUS_CONFIG[m.status];
  const isAchieved = m.status === 'achieved';
  const scaleAnim  = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.97, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1,    duration: 120, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[
          styles.card,
          { borderLeftColor: catCfg.color },
          isAchieved && styles.cardAchieved,
        ]}
        onPress={handlePress}
        activeOpacity={1}
        disabled={saving}
      >
        {/* Category icon */}
        <View style={[styles.cardIconWrap, { backgroundColor: catCfg.iconBg }]}>
          <Image
            source={ICONS[m.category]}
            style={styles.cardIcon}
            resizeMode="contain"
          />
        </View>

        {/* Content */}
        <View style={styles.cardBody}>
          <Text style={[styles.cardTitle, isAchieved && { color: '#1D9E75' }]} numberOfLines={1}>
            {m.title}
          </Text>
          <Text style={styles.cardDesc} numberOfLines={2}>{m.description}</Text>

          {isAchieved && m.achievedDate && (
            <View style={styles.achievedRow}>
              <Image source={ICONS.achieved} style={styles.tinyIcon} resizeMode="contain" />
              <Text style={styles.achievedText}>Achieved {m.achievedDate}</Text>
            </View>
          )}
        </View>

        {/* Status toggle */}
        <View style={styles.cardRight}>
          {saving ? (
            <ActivityIndicator size="small" color={catCfg.color} />
          ) : (
            <View style={[styles.statusBtn, {
              backgroundColor: cfg.bg,
              borderColor: cfg.borderColor,
            }]}>
              <Image
                source={ICONS[m.status]}
                style={styles.statusIcon}
                resizeMode="contain"
              />
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Category Filter Card ──────────────────────────────────────────────────────

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
          : { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' },
      ]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {/* Icon */}
      <View style={[
        styles.catIconWrap,
        { backgroundColor: active ? 'rgba(255,255,255,0.22)' : cat.iconBg },
      ]}>
        <Image
          source={ICONS[cat.key]}
          style={styles.catIcon}
          resizeMode="contain"
        />
      </View>

      <Text style={[styles.catLabel, active && { color: '#fff' }]}>{cat.label}</Text>

      <Text style={[styles.catFraction, active && { color: 'rgba(255,255,255,0.85)' }]}>
        {achieved}/{total}
      </Text>

      {/* Progress bar */}
      <View style={[styles.catBar, { backgroundColor: active ? 'rgba(255,255,255,0.22)' : '#EEF2F7' }]}>
        <View style={[
          styles.catBarFill,
          { width: `${pct}%` as any, backgroundColor: active ? '#fff' : cat.color },
        ]} />
      </View>
    </TouchableOpacity>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function MilestonesScreen() {
  const { children, selectedChildId } = useChildStore();
  const child = children.find(c => c.id === selectedChildId) ?? children[0];

  const [milestones, setMilestones]         = useState<Milestone[]>([]);
  const [loading, setLoading]               = useState(true);
  const [activeCategory, setActiveCategory] = useState<Category | 'all'>('all');
  const [saving, setSaving]                 = useState<string | null>(null);

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

      const saved  = data ?? [];
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
        Alert.alert('Milestone achieved!', `${milestone.title} — amazing progress!`);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not save');
    } finally {
      setSaving(null);
    }
  };

  // ── Computed ───────────────────────────────────────────────────────────────
  const total      = milestones.length;
  const achieved   = milestones.filter(m => m.status === 'achieved').length;
  const inProgress = milestones.filter(m => m.status === 'in_progress').length;
  const pct        = total > 0 ? Math.round((achieved / total) * 100) : 0;

  const filtered = milestones.filter(m =>
    activeCategory === 'all' || m.category === activeCategory,
  );
  const groups = groupByAge(filtered);

  // ── No child state ─────────────────────────────────────────────────────────
  if (!child) return (
    <View style={styles.screen}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Milestones</Text>
        <Text style={styles.heroSub}>Developmental tracker · 0–5 years</Text>
      </View>
      <View style={styles.emptyState}>
        <Image source={ICONS.achieved} style={{ width: 72, height: 72, opacity: 0.35 }} resizeMode="contain" />
        <Text style={styles.emptyTitle}>No child selected</Text>
        <Text style={styles.emptySub}>Go to the Children tab to select or add a child first.</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>

      {/* ── Hero Header ──────────────────────────────────────────────── */}
      <View style={styles.hero}>
        {/* Decorative circles */}
        <View style={styles.decorCircle1} />
        <View style={styles.decorCircle2} />

        <View style={styles.heroTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Milestones</Text>
            <Text style={styles.heroSub}>
              {toTitleCase(child.full_name)}
              {childAgeMonths !== null ? ` · ${childAgeMonths} mo` : ''}
            </Text>
          </View>

          {/* Circular progress ring */}
          <View style={styles.ringOuter}>
            <View style={styles.ringInner}>
              <Text style={styles.ringPct}>{pct}%</Text>
              <Text style={styles.ringLabel}>done</Text>
            </View>
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.heroBar}>
          <View style={[styles.heroBarFill, { width: `${pct}%` as any }]} />
        </View>

        {/* Stat pills */}
        <View style={styles.statRow}>
          {[
            { icon: ICONS.achieved,    label: 'Achieved',    value: achieved,                      bg: 'rgba(29,158,117,0.25)' },
            { icon: ICONS.in_progress, label: 'In Progress', value: inProgress,                    bg: 'rgba(230,81,0,0.22)' },
            { icon: ICONS.not_yet,     label: 'Not Yet',     value: total - achieved - inProgress,  bg: 'rgba(255,255,255,0.14)' },
          ].map(s => (
            <View key={s.label} style={[styles.statPill, { backgroundColor: s.bg }]}>
              <Image source={s.icon} style={styles.statIcon} resizeMode="contain" />
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Category Filter ─────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Categories</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catRow}
        >
          {/* All pill */}
          <TouchableOpacity
            style={[
              styles.catCard,
              activeCategory === 'all'
                ? { backgroundColor: COLORS.primary, borderColor: COLORS.primary }
                : { backgroundColor: '#fff', borderColor: '#E2E8F0' },
            ]}
            onPress={() => setActiveCategory('all')}
            activeOpacity={0.85}
          >
            <View style={[styles.catIconWrap, {
              backgroundColor: activeCategory === 'all' ? 'rgba(255,255,255,0.22)' : COLORS.primaryLight,
            }]}>
              <View style={styles.allDots}>
                {[ICONS.motor, ICONS.language, ICONS.social, ICONS.cognitive].map((src, i) => (
                  <Image key={i} source={src} style={styles.allDotIcon} resizeMode="contain" />
                ))}
              </View>
            </View>
            <Text style={[styles.catLabel, activeCategory === 'all' && { color: '#fff' }]}>All</Text>
            <Text style={[styles.catFraction, activeCategory === 'all' && { color: 'rgba(255,255,255,0.85)' }]}>
              {achieved}/{total}
            </Text>
            <View style={[styles.catBar, {
              backgroundColor: activeCategory === 'all' ? 'rgba(255,255,255,0.22)' : '#EEF2F7',
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

        {/* ── Milestone list ──────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>
          {activeCategory === 'all'
            ? 'All Milestones'
            : `${CATEGORIES.find(c => c.key === activeCategory)?.label} Milestones`}
        </Text>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading milestones…</Text>
          </View>
        ) : (
          Object.entries(groups).map(([ageLabel, items]) => {
            const ageMonths    = items[0].ageMonths;
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
                    <Text style={[styles.ageText, isCurrentAge && { color: '#fff' }]}>
                      {ageLabel}
                    </Text>
                    {isCurrentAge && (
                      <View style={styles.nowBadge}>
                        <Text style={styles.nowText}>NOW</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.ageDivider} />
                  <Text style={styles.ageCount}>
                    {items.filter(m => m.status === 'achieved').length}/{items.length}
                  </Text>
                </View>

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
          <View style={styles.hintIconRow}>
            {[ICONS.not_yet, ICONS.in_progress, ICONS.achieved].map((src, i) => (
              <Image key={i} source={src} style={styles.hintIcon} resizeMode="contain" />
            ))}
          </View>
          <Text style={styles.hintText}>
            Tap any milestone to cycle: Not Yet → In Progress → Achieved
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

  // ── Hero ───────────────────────────────────────────────────────────────────
  hero: {
    backgroundColor: COLORS.primary,
    paddingTop:       Platform.OS === 'ios' ? 58 : 44,
    paddingHorizontal: 20,
    paddingBottom:    24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
    ...Platform.select({ ios: {

      ...Platform.select({

        ios: { shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16 },

        android: { elevation: 13 },

        default: {},

      }),
    }, android: { elevation: 10 }}),
  },
  decorCircle1: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    borderWidth: 40, borderColor: 'rgba(255,255,255,0.07)', top: -60, right: -60,
  },
  decorCircle2: {
    position: 'absolute', width: 120, height: 120, borderRadius: 60,
    borderWidth: 24, borderColor: 'rgba(255,255,255,0.05)', bottom: -40, left: 30,
  },

  heroTop: {
    flexDirection: 'row', alignItems: 'flex-start',
    marginBottom: 18,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    fontFamily: FONTS?.extrabold,
    letterSpacing: -0.5,
  },
  heroSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.78)',
    marginTop: 3,
    fontFamily: FONTS?.regular,
  },

  ringOuter: {
    width: 70, height: 70, borderRadius: 35,
    borderWidth: 5, borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  ringInner: { alignItems: 'center' },
  ringPct:   { fontSize: 18, fontWeight: '800', color: '#fff', lineHeight: 22 },
  ringLabel: { fontSize: 9, color: 'rgba(255,255,255,0.75)', letterSpacing: 0.3 },

  heroBar: {
    height: 6, backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 3, overflow: 'hidden', marginBottom: 14,
  },
  heroBarFill: {
    height: '100%', backgroundColor: '#fff', borderRadius: 3,
  },

  statRow: { flexDirection: 'row', gap: 8 },
  statPill: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    gap: 5, paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 12,
  },
  statIcon:  { width: 16, height: 16 },
  statValue: { fontSize: 14, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 10, color: 'rgba(255,255,255,0.7)', flex: 1 },

  // ── Scroll ─────────────────────────────────────────────────────────────────
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 22 },

  sectionTitle: {
    fontSize: 15, fontWeight: '800', color: '#1A202C',
    marginBottom: 12, fontFamily: FONTS?.extrabold,
    letterSpacing: -0.2,
  },

  // ── Category cards ─────────────────────────────────────────────────────────
  catRow:    { gap: 10, paddingBottom: 6, marginBottom: 20 },
  catCard: {
    width: 112, borderRadius: 20, padding: 12,
    borderWidth: 1.5, gap: 6,
    ...Platform.select({ ios: {
      ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8 }, android: { elevation: 6 }, default: {} }),
    }, android: { elevation: 2 } }),
  },
  catIconWrap: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  catIcon:     { width: 30, height: 30 },
  catLabel:    { fontSize: 12, fontWeight: '800', color: '#1A202C' },
  catFraction: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
  catBar:      { height: 4, borderRadius: 2, overflow: 'hidden' },
  catBarFill:  { height: '100%', borderRadius: 2 },

  allDots: { flexDirection: 'row', flexWrap: 'wrap', width: 28, gap: 2 },
  allDotIcon: { width: 11, height: 11 },

  // ── Age groups ─────────────────────────────────────────────────────────────
  ageGroup:  { marginBottom: 22 },
  ageHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  agePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 20, backgroundColor: '#E8EAF6',
  },
  ageText:  { fontSize: 12, fontWeight: '700', color: '#5C6BC0' },
  nowBadge: {
    backgroundColor: 'rgba(255,255,255,0.28)',
    paddingHorizontal: 6, paddingVertical: 1,
    borderRadius: 8,
  },
  nowText:   { fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  ageDivider:{ flex: 1, height: 1, backgroundColor: '#E2E8F0' },
  ageCount:  { fontSize: 11, fontWeight: '700', color: '#94A3B8' },

  // ── Milestone card ─────────────────────────────────────────────────────────
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 18,
    padding: 14, marginBottom: 10,
    borderLeftWidth: 4, gap: 12,
    ...Platform.select({ ios: {
      ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 }, android: { elevation: 6 }, default: {} }),
    }, android: { elevation: 2 } }),
  },
  cardAchieved: { backgroundColor: '#F6FFFC' },

  cardIconWrap: {
    width: 46, height: 46, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  cardIcon: { width: 30, height: 30 },

  cardBody: { flex: 1, gap: 3 },
  cardTitle: {
    fontSize: 14, fontWeight: '700', color: '#1A202C',
    fontFamily: FONTS?.bold,
  },
  cardDesc: { fontSize: 12, color: '#718096', lineHeight: 17 },

  achievedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  tinyIcon:    { width: 12, height: 12 },
  achievedText:{ fontSize: 11, color: '#1D9E75', fontWeight: '600' },

  cardRight:  { flexShrink: 0 },
  statusBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
  },
  statusIcon: { width: 24, height: 24 },

  // ── Loading ────────────────────────────────────────────────────────────────
  loadingWrap: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  loadingText: { color: '#A0AEC0', fontSize: 13 },

  // ── Empty state ────────────────────────────────────────────────────────────
  emptyState: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 36, gap: 10,
  },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#1A202C' },
  emptySub:   { fontSize: 14, color: '#A0AEC0', textAlign: 'center', lineHeight: 20 },

  // ── Hint card ──────────────────────────────────────────────────────────────
  hintCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 16,
    padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  hintIconRow: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  hintIcon:    { width: 18, height: 18 },
  hintText:    { flex: 1, fontSize: 12, color: '#A0AEC0', lineHeight: 17 },
});