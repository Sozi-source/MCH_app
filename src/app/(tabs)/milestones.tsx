/**
 * src/app/(tabs)/milestones.tsx
 * ZuriHealth — Milestone Tracker
 * Professional design matching vaccines screen
 * Original milestone data preserved exactly
 */

import { supabase } from '@/lib/supabase';
import { COLORS, RADIUS, FONTS, HEADER } from '@/lib/theme';
import { useChildStore } from '@/store/childStore';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  RefreshControl,
} from 'react-native';

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens - ZuriHealth Theme
// ─────────────────────────────────────────────────────────────────────────────

const T = {
  primary:       COLORS.primary,
  primaryMid:    COLORS.primaryMid,
  primaryLight:  COLORS.primaryLight,
  onPrimary:     COLORS.onPrimary,
  background:    COLORS.background,
  surface:       COLORS.surface,
  white:         COLORS.white,
  border:        COLORS.border,
  textPrimary:   COLORS.textPrimary,
  textSecondary: COLORS.textSecondary,
  textMuted:     COLORS.textMuted,
  
  statusAchieved:   COLORS.given,
  statusProgress:   COLORS.due,
  statusNotYet:     COLORS.textMuted,
  
  statusAchievedLight: COLORS.givenLight,
  statusProgressLight: COLORS.dueLight,
  statusNotYetLight:   COLORS.surface,

  rCard:   RADIUS.xl,
  rPill:   RADIUS.full,
  rIcon:   RADIUS.lg,
};

// ─────────────────────────────────────────────────────────────────────────────
// Icon map
// ─────────────────────────────────────────────────────────────────────────────

const ICONS = {
  motor:       require('@/assets/milestones/cat-motor.png'),
  language:    require('@/assets/milestones/cat-language.png'),
  social:      require('@/assets/milestones/cat-social.png'),
  cognitive:   require('@/assets/milestones/cat-cognitive.png'),
  achieved:    require('@/assets/milestones/status-achieved.png'),
  in_progress: require('@/assets/milestones/status-in-progress.png'),
  not_yet:     require('@/assets/milestones/status-not-yet.png'),
};

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// ORIGINAL MILESTONE DATA - EXACTLY AS YOU PROVIDED
// ─────────────────────────────────────────────────────────────────────────────

const MILESTONE_DATA: Omit<Milestone, 'status' | 'achievedDate'>[] = [
  { id: 'm_2_mot_1',  ageMonths: 2,  ageLabel: '2 Months',  category: 'motor',     title: 'Holds head up briefly',      description: 'Can lift head when lying on tummy' },
  { id: 'm_2_lan_1',  ageMonths: 2,  ageLabel: '2 Months',  category: 'language',  title: 'Makes cooing sounds',         description: 'Produces soft vowel sounds like "ooh" and "aah"' },
  { id: 'm_2_soc_1',  ageMonths: 2,  ageLabel: '2 Months',  category: 'social',    title: 'Social smile',                description: 'Smiles in response to your face or voice' },
  { id: 'm_2_cog_1',  ageMonths: 2,  ageLabel: '2 Months',  category: 'cognitive', title: 'Follows object with eyes',    description: 'Tracks a moving object or face with their gaze' },
  { id: 'm_4_mot_1',  ageMonths: 4,  ageLabel: '4 Months',  category: 'motor',     title: 'Holds head steady',           description: 'Head is stable when held upright' },
  { id: 'm_4_mot_2',  ageMonths: 4,  ageLabel: '4 Months',  category: 'motor',     title: 'Pushes up on arms',           description: 'Lifts chest off floor during tummy time' },
  { id: 'm_4_lan_1',  ageMonths: 4,  ageLabel: '4 Months',  category: 'language',  title: 'Laughs and squeals',          description: 'Produces laughter and high-pitched sounds' },
  { id: 'm_4_soc_1',  ageMonths: 4,  ageLabel: '4 Months',  category: 'social',    title: 'Recognises familiar faces',   description: 'Shows excitement when seeing known caregivers' },
  { id: 'm_4_cog_1',  ageMonths: 4,  ageLabel: '4 Months',  category: 'cognitive', title: 'Reaches for objects',         description: 'Intentionally reaches toward dangling toys' },
  { id: 'm_6_mot_1',  ageMonths: 6,  ageLabel: '6 Months',  category: 'motor',     title: 'Sits with support',           description: 'Can sit upright when propped or supported' },
  { id: 'm_6_mot_2',  ageMonths: 6,  ageLabel: '6 Months',  category: 'motor',     title: 'Rolls both ways',             description: 'Rolls from back to tummy and back again' },
  { id: 'm_6_lan_1',  ageMonths: 6,  ageLabel: '6 Months',  category: 'language',  title: 'Babbles consonants',          description: 'Strings together sounds like "ba", "da", "ma"' },
  { id: 'm_6_soc_1',  ageMonths: 6,  ageLabel: '6 Months',  category: 'social',    title: 'Knows familiar vs strangers', description: 'May show wariness toward unfamiliar people' },
  { id: 'm_6_cog_1',  ageMonths: 6,  ageLabel: '6 Months',  category: 'cognitive', title: 'Explores with mouth & hands', description: 'Puts objects in mouth to explore them' },
  { id: 'm_9_mot_1',  ageMonths: 9,  ageLabel: '9 Months',  category: 'motor',     title: 'Sits without support',        description: 'Sits steadily on their own for several minutes' },
  { id: 'm_9_mot_2',  ageMonths: 9,  ageLabel: '9 Months',  category: 'motor',     title: 'Crawls or scoots',            description: 'Moves across the floor in any coordinated way' },
  { id: 'm_9_lan_1',  ageMonths: 9,  ageLabel: '9 Months',  category: 'language',  title: 'Says "mama" / "dada"',        description: 'Uses these sounds specifically for parents' },
  { id: 'm_9_soc_1',  ageMonths: 9,  ageLabel: '9 Months',  category: 'social',    title: 'Plays peek-a-boo',            description: 'Enjoys and anticipates hide-and-seek games' },
  { id: 'm_9_cog_1',  ageMonths: 9,  ageLabel: '9 Months',  category: 'cognitive', title: 'Object permanence',           description: 'Looks for a toy hidden under a cloth' },
  { id: 'm_12_mot_1', ageMonths: 12, ageLabel: '12 Months', category: 'motor',     title: 'Pulls to stand',              description: 'Pulls themselves up using furniture' },
  { id: 'm_12_mot_2', ageMonths: 12, ageLabel: '12 Months', category: 'motor',     title: 'Cruises along furniture',     description: 'Walks sideways holding onto surfaces' },
  { id: 'm_12_lan_1', ageMonths: 12, ageLabel: '12 Months', category: 'language',  title: 'First words',                 description: 'Says 1–3 words with meaning beyond mama/dada' },
  { id: 'm_12_soc_1', ageMonths: 12, ageLabel: '12 Months', category: 'social',    title: 'Waves bye-bye',               description: 'Waves on request or spontaneously' },
  { id: 'm_12_cog_1', ageMonths: 12, ageLabel: '12 Months', category: 'cognitive', title: 'Imitates actions',            description: 'Copies simple actions like clapping or stirring' },
  { id: 'm_12_cog_2', ageMonths: 12, ageLabel: '12 Months', category: 'cognitive', title: 'Uses pincer grasp',           description: 'Picks up small objects with thumb and forefinger' },
  { id: 'm_18_mot_1', ageMonths: 18, ageLabel: '18 Months', category: 'motor',     title: 'Walks independently',         description: 'Walks well without support' },
  { id: 'm_18_mot_2', ageMonths: 18, ageLabel: '18 Months', category: 'motor',     title: 'Climbs onto furniture',       description: 'Climbs onto chairs or low surfaces' },
  { id: 'm_18_lan_1', ageMonths: 18, ageLabel: '18 Months', category: 'language',  title: 'Uses 10–20 words',            description: 'Has a vocabulary of at least 10 words' },
  { id: 'm_18_soc_1', ageMonths: 18, ageLabel: '18 Months', category: 'social',    title: 'Parallel play',               description: 'Plays alongside (not yet with) other children' },
  { id: 'm_18_cog_1', ageMonths: 18, ageLabel: '18 Months', category: 'cognitive', title: 'Points to named body parts',  description: 'Points to head, eyes, nose when asked' },
  { id: 'm_24_mot_1', ageMonths: 24, ageLabel: '2 Years',   category: 'motor',     title: 'Runs steadily',               description: 'Runs with good balance and coordination' },
  { id: 'm_24_mot_2', ageMonths: 24, ageLabel: '2 Years',   category: 'motor',     title: 'Kicks a ball',                description: 'Kicks a ball forward without falling' },
  { id: 'm_24_lan_1', ageMonths: 24, ageLabel: '2 Years',   category: 'language',  title: 'Two-word phrases',            description: 'Combines two words e.g. "more milk", "daddy go"' },
  { id: 'm_24_lan_2', ageMonths: 24, ageLabel: '2 Years',   category: 'language',  title: '50+ word vocabulary',         description: 'Uses at least 50 different words' },
  { id: 'm_24_soc_1', ageMonths: 24, ageLabel: '2 Years',   category: 'social',    title: 'Plays with others briefly',   description: 'Engages in short cooperative play with peers' },
  { id: 'm_24_cog_1', ageMonths: 24, ageLabel: '2 Years',   category: 'cognitive', title: 'Sorts shapes & colours',      description: 'Matches objects by shape or colour' },
  { id: 'm_24_cog_2', ageMonths: 24, ageLabel: '2 Years',   category: 'cognitive', title: 'Simple pretend play',         description: 'Pretends to feed a doll or talk on a phone' },
  { id: 'm_36_mot_1', ageMonths: 36, ageLabel: '3 Years',   category: 'motor',     title: 'Jumps with both feet',        description: 'Jumps off the ground with both feet together' },
  { id: 'm_36_mot_2', ageMonths: 36, ageLabel: '3 Years',   category: 'motor',     title: 'Climbs stairs alternating',   description: 'Goes up stairs one foot per step' },
  { id: 'm_36_lan_1', ageMonths: 36, ageLabel: '3 Years',   category: 'language',  title: '3-word sentences',            description: 'Speaks in short sentences of 3+ words' },
  { id: 'm_36_soc_1', ageMonths: 36, ageLabel: '3 Years',   category: 'social',    title: 'Takes turns in games',        description: 'Understands and follows simple turn-taking rules' },
  { id: 'm_36_cog_1', ageMonths: 36, ageLabel: '3 Years',   category: 'cognitive', title: 'Knows own name & age',        description: 'Can state their full name and how old they are' },
  { id: 'm_36_cog_2', ageMonths: 36, ageLabel: '3 Years',   category: 'cognitive', title: 'Draws a circle',              description: 'Can copy a circle shape when shown' },
  { id: 'm_48_mot_1', ageMonths: 48, ageLabel: '4 Years',   category: 'motor',     title: 'Hops on one foot',            description: 'Can hop several times on one foot' },
  { id: 'm_48_mot_2', ageMonths: 48, ageLabel: '4 Years',   category: 'motor',     title: 'Catches a bounced ball',      description: 'Catches a ball bounced to them most of the time' },
  { id: 'm_48_lan_1', ageMonths: 48, ageLabel: '4 Years',   category: 'language',  title: 'Tells simple stories',        description: 'Recounts events with a beginning and end' },
  { id: 'm_48_soc_1', ageMonths: 48, ageLabel: '4 Years',   category: 'social',    title: 'Cooperative play',            description: 'Plans and plays games with other children' },
  { id: 'm_48_cog_1', ageMonths: 48, ageLabel: '4 Years',   category: 'cognitive', title: 'Counts to 10',                description: 'Counts objects accurately up to 10' },
  { id: 'm_48_cog_2', ageMonths: 48, ageLabel: '4 Years',   category: 'cognitive', title: 'Draws a person',              description: 'Draws a person with at least 4 body parts' },
  { id: 'm_60_mot_1', ageMonths: 60, ageLabel: '5 Years',   category: 'motor',     title: 'Skips and hops well',         description: 'Skips alternating feet with ease' },
  { id: 'm_60_mot_2', ageMonths: 60, ageLabel: '5 Years',   category: 'motor',     title: 'Writes own name',             description: 'Can print first name recognisably' },
  { id: 'm_60_lan_1', ageMonths: 60, ageLabel: '5 Years',   category: 'language',  title: 'Uses full sentences',         description: 'Speaks in full grammatically correct sentences' },
  { id: 'm_60_lan_2', ageMonths: 60, ageLabel: '5 Years',   category: 'language',  title: 'Asks "why" questions',        description: 'Asks many "why" and "how" questions' },
  { id: 'm_60_soc_1', ageMonths: 60, ageLabel: '5 Years',   category: 'social',    title: 'Follows rules in games',      description: 'Understands and follows rules in group games' },
  { id: 'm_60_cog_1', ageMonths: 60, ageLabel: '5 Years',   category: 'cognitive', title: 'Counts to 20+',               description: 'Counts objects reliably beyond 20' },
  { id: 'm_60_cog_2', ageMonths: 60, ageLabel: '5 Years',   category: 'cognitive', title: 'Knows letters of alphabet',   description: 'Recognises most letters of the alphabet' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Category config for filters
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORIES: { key: Category; label: string }[] = [
  { key: 'motor',    label: 'Motor'    },
  { key: 'language', label: 'Language' },
  { key: 'social',   label: 'Social'   },
  { key: 'cognitive',label: 'Cognitive'},
];

const FILTER_TABS: { key: 'all' | Category; label: string }[] = [
  { key: 'all',      label: 'All' },
  { key: 'motor',    label: 'Motor' },
  { key: 'language', label: 'Language' },
  { key: 'social',   label: 'Social' },
  { key: 'cognitive',label: 'Cognitive' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Status config
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<MilestoneStatus, {
  label: string;
  color: string;
  bg: string;
}> = {
  achieved:    { label: 'Achieved',    color: T.statusAchieved, bg: T.statusAchievedLight },
  in_progress: { label: 'In Progress', color: T.statusProgress, bg: T.statusProgressLight },
  not_yet:     { label: 'Not Yet',     color: T.statusNotYet,   bg: T.statusNotYetLight },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function toTitleCase(str: string): string {
  if (!str) return '';
  return str.toLowerCase().replace(/\b\w/g, ch => ch.toUpperCase());
}

function getAgeMonths(dob: string): number {
  const birth = new Date(dob);
  const now = new Date();
  return Math.floor((now.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
}

function groupByAge(milestones: Milestone[]): Record<string, Milestone[]> {
  const groups: Record<string, Milestone[]> = {};
  milestones.forEach(m => {
    if (!groups[m.ageLabel]) groups[m.ageLabel] = [];
    groups[m.ageLabel].push(m);
  });
  // Sort age groups by months
  const sorted: Record<string, Milestone[]> = {};
  Object.keys(groups).sort((a, b) => {
    const aMonths = groups[a][0]?.ageMonths ?? 0;
    const bMonths = groups[b][0]?.ageMonths ?? 0;
    return aMonths - bMonths;
  }).forEach(key => { sorted[key] = groups[key]; });
  return sorted;
}

// ─────────────────────────────────────────────────────────────────────────────
// ProgressBar
// ─────────────────────────────────────────────────────────────────────────────

function ProgressBar({ pct, height = 6, color = T.primary, bg = T.border }: {
  pct: number; height?: number; color?: string; bg?: string;
}) {
  const safe = Math.min(100, Math.max(0, pct));
  return (
    <View style={{ flexDirection: 'row', height, borderRadius: height / 2, backgroundColor: bg, overflow: 'hidden' }}>
      {safe > 0 && <View style={{ flex: safe, height, backgroundColor: color }} />}
      {safe < 100 && <View style={{ flex: 100 - safe, height, backgroundColor: 'transparent' }} />}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StatPill
// ─────────────────────────────────────────────────────────────────────────────

function StatPill({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  return (
    <View style={[styles.statPill, accent && { backgroundColor: T.primaryLight }]}>
      <Text style={[styles.statValue, accent && { color: T.primary }]}>{value}</Text>
      <Text style={[styles.statLabel, accent && { color: T.primary }]}>{label}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MilestoneCard
// ─────────────────────────────────────────────────────────────────────────────

function MilestoneCard({
  m, saving, onPress,
}: {
  m: Milestone; saving: boolean; onPress: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const cfg = STATUS_CONFIG[m.status];

  const handlePress = () => {
    if (saving) return;
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.98, duration: 70, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 130, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  return (
    <Animated.View style={[styles.cardWrap, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        style={styles.card}
        onPress={handlePress}
        activeOpacity={0.95}
        disabled={saving}
      >
        <View style={[styles.cardAccent, { backgroundColor: cfg.color }]} />

        <View style={styles.cardIconWrap}>
          <Image
            source={ICONS[m.category]}
            style={[styles.cardIcon, m.status !== 'achieved' && { opacity: 0.45 }]}
            resizeMode="contain"
          />
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={1}>{m.title}</Text>
          <Text style={styles.cardDesc} numberOfLines={2}>{m.description}</Text>

          <View style={[styles.statusChip, { backgroundColor: cfg.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: cfg.color }]} />
            <Text style={[styles.statusChipText, { color: cfg.color }]}>
              {cfg.label}
            </Text>
          </View>

          {m.status === 'achieved' && m.achievedDate ? (
            <Text style={styles.achievedDate}>✓ Achieved {formatDate(m.achievedDate)}</Text>
          ) : (
            <Text style={styles.tapHint}>Tap to update</Text>
          )}
        </View>

        <View style={styles.cardAction}>
          {saving ? (
            <ActivityIndicator size="small" color={T.primary} />
          ) : (
            <View style={[styles.actionCircle, m.status === 'achieved' && styles.actionCircleActive]}>
              <Image source={ICONS[m.status]} style={styles.actionIcon} resizeMode="contain" />
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Age Group Header
// ─────────────────────────────────────────────────────────────────────────────

function AgeGroupHeader({
  label, achieved, total, isCurrent,
}: {
  label: string; achieved: number; total: number; isCurrent: boolean;
}) {
  const percent = total > 0 ? (achieved / total) * 100 : 0;
  
  return (
    <View style={styles.ageGroupHeader}>
      <View style={styles.ageGroupTitleRow}>
        <View style={[styles.ageBadge, isCurrent && styles.ageBadgeCurrent]}>
          <Text style={[styles.ageLabel, isCurrent && styles.ageLabelCurrent]}>{label}</Text>
          {isCurrent && <Text style={styles.nowBadge}>NOW</Text>}
        </View>
        <Text style={styles.ageProgress}>{achieved}/{total}</Text>
      </View>
      <View style={styles.ageProgressBar}>
        <ProgressBar pct={percent} height={3} color={T.primary} bg={T.border} />
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────

export default function MilestonesScreen() {
  const { children, selectedChildId } = useChildStore();
  const child = children.find(c => c.id === selectedChildId) ?? children[0];

  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | Category>('all');
  const [saving, setSaving] = useState<string | null>(null);

  const childAgeMonths = child?.date_of_birth ? getAgeMonths(child.date_of_birth) : null;

  useEffect(() => {
    if (child?.id) loadMilestones(child.id);
    else setLoading(false);
  }, [child?.id]);

  const loadMilestones = async (childId: string, showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    
    try {
      const { data } = await supabase
        .from('child_milestones')
        .select('*')
        .eq('child_id', childId);

      const saved = data ?? [];
      const merged: Milestone[] = MILESTONE_DATA.map(m => {
        const record = saved.find((r: any) => r.milestone_id === m.id);
        return {
          ...m,
          status: record?.status ?? 'not_yet',
          achievedDate: record?.achieved_date ?? undefined,
        };
      });
      setMilestones(merged);
    } catch (e) {
      console.error('loadMilestones', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    if (child?.id) loadMilestones(child.id, true);
  };

  const cycleStatus = async (milestone: Milestone) => {
    if (!child?.id || saving) return;
    
    const ORDER: MilestoneStatus[] = ['not_yet', 'in_progress', 'achieved'];
    const nextStatus = ORDER[(ORDER.indexOf(milestone.status) + 1) % ORDER.length];
    const achievedDate = nextStatus === 'achieved'
      ? new Date().toISOString().slice(0, 10)
      : null;

    setMilestones(prev => prev.map(m =>
      m.id === milestone.id
        ? { ...m, status: nextStatus, achievedDate: achievedDate ?? undefined }
        : m,
    ));
    setSaving(milestone.id);

    try {
      await supabase.from('child_milestones').upsert(
        {
          child_id: child.id,
          milestone_id: milestone.id,
          status: nextStatus,
          achieved_date: achievedDate,
        },
        { onConflict: 'child_id,milestone_id' },
      );
      if (nextStatus === 'achieved') {
        Alert.alert('🎉 Milestone Achieved', `"${milestone.title}" — wonderful progress!`);
      }
    } catch (e: any) {
      setMilestones(prev => prev.map(m =>
        m.id === milestone.id
          ? { ...m, status: milestone.status, achievedDate: milestone.achievedDate }
          : m,
      ));
      Alert.alert('Could not save', e?.message ?? 'Please try again.');
    } finally {
      setSaving(null);
    }
  };

  const total = milestones.length;
  const achieved = milestones.filter(m => m.status === 'achieved').length;
  const inProgress = milestones.filter(m => m.status === 'in_progress').length;
  const notYet = total - achieved - inProgress;
  const pct = total > 0 ? Math.round((achieved / total) * 100) : 0;

  const filtered = useMemo(() => 
    milestones.filter(m => filter === 'all' || m.category === filter),
    [milestones, filter]
  );
  const groups = groupByAge(filtered);

  if (!child) {
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <View style={HEADER.decorCircle1} />
          <View style={HEADER.decorCircle2} />
          <View style={styles.headerTop}>
            <View style={styles.headerTitleBlock}>
              <Text style={styles.headerTitle}>Milestones</Text>
              <Text style={styles.headerSub}>Developmental tracker · 0–5 years</Text>
            </View>
          </View>
        </View>
        <View style={styles.emptyFull}>
          <View style={styles.emptyIconWrap}>
            <Image source={ICONS.achieved} style={styles.emptyIcon} resizeMode="contain" />
          </View>
          <Text style={styles.emptyTitle}>No child selected</Text>
          <Text style={styles.emptySubtitle}>Select or add a child to track their milestones.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <View style={HEADER.decorCircle1} />
        <View style={HEADER.decorCircle2} />

        <View style={styles.headerTop}>
          <View style={styles.headerTitleBlock}>
            <View style={styles.eyebrowRow}>
              <Text style={styles.eyebrowText}>DEVELOPMENTAL TRACKER</Text>
            </View>
            <Text style={styles.headerTitle}>{toTitleCase(child.full_name)}</Text>
            <View style={styles.childPill}>
              <Text style={styles.headerSub}>{childAgeMonths} months old</Text>
            </View>
          </View>

          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgePct}>{pct}%</Text>
            <Text style={styles.heroBadgeLabel}>Complete</Text>
          </View>
        </View>

        <View style={styles.headerDivider} />

        <View style={styles.summaryRow}>
          <StatPill value={achieved} label="Achieved" accent />
          <StatPill value={inProgress} label="In Progress" />
          <StatPill value={notYet} label="Not Yet" />
        </View>

        <View style={styles.progressContainer}>
          <ProgressBar pct={pct} height={4} color={T.white} bg="rgba(255,255,255,0.25)" />
        </View>
      </View>

      {/* Filter Tabs - Horizontal scrolling for Android */}
      <View style={styles.filterBarWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterBarContent}
        >
          {FILTER_TABS.map(tab => {
            const active = filter === tab.key;
            const count = tab.key === 'all' 
              ? achieved 
              : milestones.filter(m => m.category === tab.key && m.status === 'achieved').length;
            const totalCount = tab.key === 'all' 
              ? total 
              : milestones.filter(m => m.category === tab.key).length;
            
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.filterTab, active && styles.filterTabActive]}
                onPress={() => setFilter(tab.key)}
              >
                <Text style={[styles.filterTabText, active && styles.filterTabTextActive]}>
                  {tab.label}
                </Text>
                {totalCount > 0 && (
                  <View style={[styles.filterCount, active && styles.filterCountActive]}>
                    <Text style={[styles.filterCountText, active && styles.filterCountTextActive]}>
                      {count}/{totalCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Milestones List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={T.primary}
            colors={[T.primary]}
          />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={T.primary} />
            <Text style={styles.loadingText}>Loading milestones…</Text>
          </View>
        ) : Object.keys(groups).length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Image source={ICONS.not_yet} style={styles.emptyIcon} resizeMode="contain" />
            </View>
            <Text style={styles.emptyTitle}>No milestones found</Text>
            <Text style={styles.emptySubtitle}>
              {filter !== 'all' 
                ? `No ${filter} milestones available`
                : 'No milestones match this filter'}
            </Text>
          </View>
        ) : (
          Object.entries(groups).map(([ageLabel, items]) => {
            const ageMonths = items[0].ageMonths;
            const isCurrent = childAgeMonths !== null &&
              childAgeMonths >= ageMonths - 2 &&
              childAgeMonths <= ageMonths + 2;
            const grpAchieved = items.filter(m => m.status === 'achieved').length;

            return (
              <View key={ageLabel} style={styles.ageGroupSection}>
                <AgeGroupHeader
                  label={ageLabel}
                  achieved={grpAchieved}
                  total={items.length}
                  isCurrent={isCurrent}
                />
                {items.map(m => (
                  <MilestoneCard
                    key={m.id}
                    m={m}
                    saving={saving === m.id}
                    onPress={() => cycleStatus(m)}
                  />
                ))}
              </View>
            );
          })
        )}
        
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  header: {
    backgroundColor: COLORS.primary,
    paddingTop: HEADER.paddingTop,
    paddingHorizontal: HEADER.paddingHorizontal,
    paddingBottom: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
    zIndex: 2,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  headerTitleBlock: {
    gap: 4,
    flex: 1,
    paddingRight: 12,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  eyebrowText: {
    fontFamily: FONTS.semibold,
    fontSize: 10,
    color: 'rgba(255,255,255,0.70)',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontFamily: FONTS.extrabold,
    fontSize: 28,
    color: COLORS.white,
    letterSpacing: -0.6,
    lineHeight: 34,
  },
  childPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginTop: 4,
  },
  headerSub: {
    fontFamily: FONTS.semibold,
    fontSize: 12,
    color: 'rgba(255,255,255,0.88)',
    letterSpacing: 0.2,
  },
  headerDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginBottom: 14,
  },
  progressContainer: {
    marginTop: 8,
  },

  heroBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderRadius: RADIUS.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 72,
  },
  heroBadgePct: {
    fontFamily: FONTS.extrabold,
    fontSize: 28,
    color: COLORS.white,
    lineHeight: 32,
  },
  heroBadgeLabel: {
    fontFamily: FONTS.semibold,
    fontSize: 9,
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 2,
  },

  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: RADIUS.lg,
    marginRight: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.white,
    fontFamily: FONTS.extrabold,
  },
  statLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 2,
    letterSpacing: 0.4,
  },

  filterBarWrapper: {
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    zIndex: 1,
  },
  filterBarContent: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  filterTabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterTabText: {
    fontFamily: FONTS.semibold,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  filterTabTextActive: {
    color: COLORS.white,
  },
  filterCount: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surface,
  },
  filterCountActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  filterCountText: {
    fontFamily: FONTS.semibold,
    fontSize: 9,
    color: COLORS.textMuted,
  },
  filterCountTextActive: {
    color: COLORS.white,
  },

  scrollView: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 40 },

  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  loadingText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textMuted,
  },

  ageGroupSection: { marginBottom: 24 },
  ageGroupHeader: { marginBottom: 12 },
  ageGroupTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  ageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
  },
  ageBadgeCurrent: {
    backgroundColor: COLORS.primaryLight,
  },
  ageLabel: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  ageLabelCurrent: {
    color: COLORS.primary,
  },
  nowBadge: {
    fontFamily: FONTS.bold,
    fontSize: 8,
    color: COLORS.white,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    letterSpacing: 0.5,
  },
  ageProgress: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  ageProgressBar: { marginTop: 4 },

  cardWrap: { marginBottom: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    paddingVertical: 12,
  },
  cardAccent: {
    width: 4,
    height: '100%',
    alignSelf: 'stretch',
  },
  cardIconWrap: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    marginLeft: 12,
    marginRight: 10,
  },
  cardIcon: { width: 24, height: 24, opacity: 0.7 },
  cardBody: { flex: 1, paddingRight: 8 },
  cardTitle: {
    fontFamily: FONTS.semibold,
    fontSize: 14,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  cardDesc: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 17,
    marginBottom: 4,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    marginTop: 2,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusChipText: { fontFamily: FONTS.semibold, fontSize: 10 },
  achievedDate: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: COLORS.given,
    marginTop: 4,
  },
  tapHint: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  cardAction: {
    width: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionCircleActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  actionIcon: { width: 20, height: 20 },

  emptyFull: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 40,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
    gap: 10,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyIcon: {
    width: 32,
    height: 32,
    opacity: 0.5,
  },
  emptyTitle: {
    fontFamily: FONTS.semibold,
    fontSize: 16,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});