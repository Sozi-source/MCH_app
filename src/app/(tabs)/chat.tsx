/**
 * ZuriHealth — Premium Chat Screen
 *
 * AI CONTEXT AUDIT FINDINGS & FIXES:
 * ✅ Demographics: name, age, sex, DOB, birth weight/height, facility — COMPLETE
 * ✅ Growth: latest weight, height, WAZ/HAZ/WHZ z-scores — COMPLETE
 * ✅ Vaccines: given/due/missed/upcoming counts + names — COMPLETE
 * ✅ Feeding stage: label + description — COMPLETE
 * ✅ Language switching (Swahili/English) — COMPLETE
 *
 * GAPS FIXED:
 * ✅ Growth history trend (last 3 records weight delta) — ADDED
 * ✅ Feeding meals/day + food groups forwarded to AI — ADDED
 * ✅ Personalised suggestion chips based on child's actual status — ADDED
 *
 * NOTE: Milestones context omitted until milestoneStore exposes the data.
 * NOTE: Child.notes not in canonical type — omitted cleanly.
 */

import { COLORS, RADIUS } from '@/lib/theme';
import { useChildStore } from '@/store/childStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useVaccineStore } from '@/store/vaccineStore';
import { getZScoreDisplay, getFeedingStage } from '@/lib/nutritionData';
import { supabase } from '@/lib/supabase';
import type { GrowthRecord } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Image,
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const { width: W } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// API config
// ─────────────────────────────────────────────────────────────────────────────

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY ?? '';
const GROQ_MODEL   = 'llama-3.3-70b-versatile';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChildContext {
  // Demographics
  name: string;
  ageMonths: number;
  sex: string;
  dobStr: string;
  birthWeightKg: number | undefined;
  birthHeightCm: number | undefined;
  healthFacility: string | undefined;

  // Growth — latest
  latestWeight: number | null;
  latestHeight: number | null;
  latestAgeAtMeasure: number | null;
  latestMeasureDate: string | null;
  waz: number | null;
  haz: number | null;
  whz: number | null;
  weightStatus: string | null;
  heightStatus: string | null;
  whStatus: string | null;
  totalGrowthRecords: number;

  // Growth — trend
  weightTrendKg: number[];
  weightTrendDates: string[];

  // Vaccines
  vaccineGiven: number;
  vaccineDue: number;
  vaccineMissed: number;
  vaccineUpcoming: number;
  vaccineTotal: number;
  dueVaccineNames: string[];
  missedVaccineNames: string[];

  // Feeding
  feedingStageLabel: string;
  feedingStageDescription: string;
  feedingExtra: string;       // meals/day + food groups as a single formatted string

  milestonesTotal: number;
  milestonesAchieved: number;
  milestonesInProgress: number;
  achievedMilestoneTitles: string[];
  inProgressMilestoneTitles: string[];

  language: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// System prompt builder
// ─────────────────────────────────────────────────────────────────────────────

function buildSystemPrompt(ctx: ChildContext): string {
  // Growth section
  let growthSection = 'No growth measurements recorded yet.';
  if (ctx.latestWeight != null) {
    const wazLabel = ctx.waz != null ? getZScoreDisplay(ctx.waz).label : 'N/A';
    const hazLabel = ctx.haz != null ? getZScoreDisplay(ctx.haz).label : 'N/A';
    const whzLabel = ctx.whz != null ? getZScoreDisplay(ctx.whz).label : 'N/A';

    let trendNote = '';
    if (ctx.weightTrendKg.length >= 2) {
      const diff = ctx.weightTrendKg[ctx.weightTrendKg.length - 1] - ctx.weightTrendKg[0];
      const sign = diff >= 0 ? '+' : '';
      trendNote = `\n  - Weight trend (last ${ctx.weightTrendKg.length} records): ${sign}${diff.toFixed(2)} kg — ${diff >= 0 ? 'gaining' : 'losing'} weight`;
    }

    growthSection = `Latest measurement (${ctx.latestMeasureDate ?? 'unknown date'}, age ${ctx.latestAgeAtMeasure ?? ctx.ageMonths} months):
  - Weight : ${ctx.latestWeight} kg   (WAZ ${ctx.waz != null ? ctx.waz.toFixed(2) : 'N/A'} → ${wazLabel})
  - Height : ${ctx.latestHeight != null ? ctx.latestHeight + ' cm' : 'not recorded'}   (HAZ ${ctx.haz != null ? ctx.haz.toFixed(2) : 'N/A'} → ${hazLabel})
  - WHZ    : ${ctx.whz != null ? ctx.whz.toFixed(2) : 'N/A'} → ${whzLabel}
  - WHO classifications: weight=${ctx.weightStatus ?? 'N/A'}, height=${ctx.heightStatus ?? 'N/A'}, wh=${ctx.whStatus ?? 'N/A'}
  - Total records in app: ${ctx.totalGrowthRecords}${trendNote}`;
  }

  // Vaccine section
  let vaccineSection = 'No vaccine data loaded yet.';
  if (ctx.vaccineTotal > 0) {
    const dueList    = ctx.dueVaccineNames.length    ? ctx.dueVaccineNames.join(', ')    : 'none';
    const missedList = ctx.missedVaccineNames.length ? ctx.missedVaccineNames.join(', ') : 'none';
    vaccineSection = `Coverage: ${ctx.vaccineGiven}/${ctx.vaccineTotal} given (${Math.round((ctx.vaccineGiven / ctx.vaccineTotal) * 100)}%)
  - Due NOW : ${dueList}
  - Missed  : ${missedList}
  - Upcoming: ${ctx.vaccineUpcoming}`;
  }

  let milestoneSection = 'No milestone data recorded yet.';
  if (ctx.milestonesTotal > 0) {
    const pct = Math.round((ctx.milestonesAchieved / ctx.milestonesTotal) * 100);
    const achievedList   = ctx.achievedMilestoneTitles.length ? ctx.achievedMilestoneTitles.join(', ') : 'none recorded';
    const inProgressList = ctx.inProgressMilestoneTitles.length ? ctx.inProgressMilestoneTitles.join(', ') : 'none';
    milestoneSection = `Overall: ${ctx.milestonesAchieved}/${ctx.milestonesTotal} achieved (${pct}%)
  - In progress      : ${inProgressList}
  - Recently achieved: ${achievedList}`;
  }

  const birthInfo = [
    ctx.birthWeightKg  ? `birth weight ${ctx.birthWeightKg} kg`         : null,
    ctx.birthHeightCm  ? `birth length ${ctx.birthHeightCm} cm`          : null,
    ctx.healthFacility ? `registered facility: ${ctx.healthFacility}`   : null,
  ].filter(Boolean).join(', ');

  return `You are Zuri, a trusted maternal and child health assistant by ZuriHealth, built for Kenyan mothers. You are kind, clear, and culturally sensitive.

════════════════════════════════════════════
ACTIVE CHILD — FULL HEALTH PROFILE
════════════════════════════════════════════
Name  : ${ctx.name}
DOB   : ${ctx.dobStr}
Age   : ${ctx.ageMonths} months
Sex   : ${ctx.sex}
${birthInfo ? 'Extra info: ' + birthInfo : ''}

── GROWTH STATUS ──
${growthSection}

── VACCINE STATUS (Kenya KEPI) ──
${vaccineSection}

── FEEDING STAGE ──
Stage : ${ctx.feedingStageLabel}
${ctx.feedingStageDescription}
${ctx.feedingExtra}

-- DEVELOPMENTAL MILESTONES --
${milestoneSection}
════════════════════════════════════════════

LANGUAGE: Respond in ${ctx.language === 'sw' ? 'Swahili' : 'English'} unless the mother writes in the other language, then match her language.

IMPORTANT — USE THE PROFILE ABOVE:
- Reference actual z-scores and classifications when asked about growth.
- Reference exact due/missed vaccine names when asked about vaccines.
- Reference the feeding stage and food groups for the child's exact age.
- If the profile shows a concern (WAZ < -2, missed vaccine, WHZ indicating MAM/SAM), acknowledge it proactively when relevant.
- Never ask for information already present in the profile.

YOUR KNOWLEDGE IS STRICTLY LIMITED TO:
1. WHO IYCF Guidelines  2. WHO Child Growth Standards (2006)  3. WHO IMCI
4. WHO Pocket Book of Hospital Care for Children  5. WHO Caring for Newborns
6. WHO Complementary Feeding Counselling Guide  7. WHO Vitamin & Mineral Nutrition
8. UNICEF IYCF Counselling Cards  9. UNICEF Programming Guide – IYCF
10. Kenya KEPI Immunization Schedule  11. Kenya KEPH  12. Kenya MCH Handbook
13. Kenya National Nutrition Action Plan  14. Kenya KIMNCI
15. Nelson Textbook of Pediatrics (21st Ed.)  16. Krause's Food & Nutrition Care
17. Williams Obstetrics  18. Myles Textbook for Midwives
19. USAID IYCF Guidelines  20. Lancet Breastfeeding Series  21. AAP Breastfeeding Guidelines

STRICT RULES:
1. Only use the verified sources above. Never reference internet, social media, or unverified remedies.
2. Always cite the guideline or source (e.g. "According to WHO IMCI...").
3. Keep answers concise, practical, and easy for a mother to understand.
4. If a question requires physical examination or is outside these sources: say "I recommend visiting your nearest MCH clinic or hospital."
5. Never suggest traditional/herbal medicine, unverified remedies, or medication dosages.
6. For personalised nutrition plans or therapeutic feeding: say "Please consult a certified nutritionist at your nearest MCH clinic."
7. For danger signs (difficulty breathing, seizures, severe dehydration, fever in newborn under 2 months): say "This is an EMERGENCY. Go to the nearest hospital NOW or call 999."
8. End serious health responses with: "Please confirm this with your MCH nurse or doctor."
9. Be warm and encouraging — mothers are doing their best.

TOPICS YOU CAN HELP WITH:
Breastfeeding · complementary feeding · child growth & z-score concerns ·
Kenya KEPI vaccines & missed vaccines · IYCF food groups by age ·
newborn care · common childhood illnesses · nutrition for mothers · child development

TOPICS YOU MUST DECLINE:
Medication names/dosages · disease diagnosis · personalised nutrition prescriptions ·
anything not covered by the verified sources above`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Animated typing dots
// ─────────────────────────────────────────────────────────────────────────────

function TypingDots() {
  const d0 = useRef(new Animated.Value(0.3)).current;
  const d1 = useRef(new Animated.Value(0.3)).current;
  const d2 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1,   duration: 350, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
          Animated.timing(dot, { toValue: 0.3, duration: 350, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        ])
      ).start();
    anim(d0, 0);
    anim(d1, 150);
    anim(d2, 300);
  }, []);

  return (
    <View style={b.aiRow}>
      <View style={b.avatar}>
        <Image source={require('@/assets/features/zuri-ai-256.png')} style={{ width: 28, height: 28, borderRadius: 14 }} />
      </View>
      <View style={b.aiBubble}>
        <View style={{ flexDirection: 'row', gap: 5, alignItems: 'center', paddingVertical: 2 }}>
          {[d0, d1, d2].map((d, i) => (
            <Animated.View
              key={i}
              style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: COLORS.primary, opacity: d }}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Message bubble
// ─────────────────────────────────────────────────────────────────────────────

function MessageBubble({ msg, isNew }: { msg: Message; isNew: boolean }) {
  const isUser   = msg.role === 'user';
  const slideAnim = useRef(new Animated.Value(isNew ? 16 : 0)).current;
  const fadeAnim  = useRef(new Animated.Value(isNew ? 0  : 1)).current;

  useEffect(() => {
    if (!isNew) return;
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(fadeAnim,  { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
  }, []);

  const timeStr = msg.timestamp.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });

  if (isUser) {
    return (
      <Animated.View style={[b.userRow, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <View style={b.userBubble}>
          <Text style={b.userText}>{msg.content}</Text>
          <Text style={b.userTime}>{timeStr}</Text>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[b.aiRow, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <View style={b.avatar}>
        <Image source={require('@/assets/features/zuri-ai-256.png')} style={{ width: 28, height: 28, borderRadius: 14 }} />
      </View>
      <View style={b.aiBubble}>
        <Text style={b.aiText}>{msg.content}</Text>
        <Text style={b.aiTime}>{timeStr}</Text>
      </View>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Data status pill
// ─────────────────────────────────────────────────────────────────────────────

function DataPill({ icon, label, ok }: { icon: string; label: string; ok: boolean }) {
  return (
    <View style={[pill.wrap, ok ? pill.ok : pill.warn]}>
      <Ionicons name={icon as any} size={10} color={ok ? COLORS.given : COLORS.due} />
      <Text style={[pill.text, { color: ok ? COLORS.given : COLORS.due }]}>{label}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const { children, selectedChildId, growthRecords, fetchGrowthRecords } = useChildStore();
  const { vaccineRows, fetchSchedules, fetchImmunizations, computeRows, schedules } = useVaccineStore();
  const { language } = useSettingsStore();

  const activeChild = children.find(c => c.id === selectedChildId) ?? children[0];

  const getAgeMonths = (): number => {
    if (!activeChild?.date_of_birth) return 0;
    const dob = new Date(activeChild.date_of_birth);
    const now = new Date();
    return (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());
  };

  const [milestoneData, setMilestoneData] = React.useState<{
    total: number; achieved: number; inProgress: number;
    achievedTitles: string[]; inProgressTitles: string[];
  }>({ total: 0, achieved: 0, inProgress: 0, achievedTitles: [], inProgressTitles: [] });

  const MILESTONE_TITLES: Record<string, string> = {
    m_2_mot_1: 'Holds head up briefly',       m_2_lan_1: 'Makes cooing sounds',
    m_2_soc_1: 'Social smile',                m_2_cog_1: 'Follows object with eyes',
    m_4_mot_1: 'Holds head steady',           m_4_mot_2: 'Pushes up on arms',
    m_4_lan_1: 'Laughs and squeals',          m_4_soc_1: 'Recognises familiar faces',
    m_4_cog_1: 'Reaches for objects',         m_6_mot_1: 'Sits with support',
    m_6_mot_2: 'Rolls both ways',             m_6_lan_1: 'Babbles consonants',
    m_6_soc_1: 'Knows familiar vs strangers', m_6_cog_1: 'Explores with mouth and hands',
    m_9_mot_1: 'Sits without support',        m_9_mot_2: 'Crawls or scoots',
    m_9_lan_1: 'Says mama / dada',            m_9_soc_1: 'Plays peek-a-boo',
    m_9_cog_1: 'Object permanence',           m_12_mot_1: 'Pulls to stand',
    m_12_mot_2: 'Cruises along furniture',    m_12_lan_1: 'First words',
    m_12_soc_1: 'Waves bye-bye',              m_12_cog_1: 'Imitates actions',
    m_12_cog_2: 'Uses pincer grasp',          m_18_mot_1: 'Walks independently',
    m_18_mot_2: 'Climbs onto furniture',      m_18_lan_1: 'Uses 10-20 words',
    m_18_soc_1: 'Parallel play',              m_18_cog_1: 'Points to named body parts',
    m_24_mot_1: 'Runs steadily',              m_24_mot_2: 'Kicks a ball',
    m_24_lan_1: 'Two-word phrases',           m_24_lan_2: '50+ word vocabulary',
    m_24_soc_1: 'Plays with others briefly',  m_24_cog_1: 'Sorts shapes and colours',
    m_24_cog_2: 'Simple pretend play',        m_36_mot_1: 'Jumps with both feet',
    m_36_mot_2: 'Climbs stairs alternating',  m_36_lan_1: '3-word sentences',
    m_36_soc_1: 'Takes turns in games',       m_36_cog_1: 'Knows own name and age',
    m_36_cog_2: 'Draws a circle',             m_48_mot_1: 'Hops on one foot',
    m_48_mot_2: 'Catches a bounced ball',     m_48_lan_1: 'Tells simple stories',
    m_48_soc_1: 'Cooperative play',           m_48_cog_1: 'Counts to 10',
    m_48_cog_2: 'Draws a person',             m_60_mot_1: 'Skips and hops well',
    m_60_mot_2: 'Writes own name',            m_60_lan_1: 'Uses full sentences',
    m_60_lan_2: 'Asks why questions',         m_60_soc_1: 'Follows rules in games',
    m_60_cog_1: 'Counts to 20+',              m_60_cog_2: 'Knows letters of alphabet',
  };

  useEffect(() => {
    if (!activeChild?.id) return;
    fetchGrowthRecords(activeChild.id);
    (async () => {
      if (schedules.length === 0) await fetchSchedules();
      const imms = await fetchImmunizations(activeChild.id);
      computeRows(activeChild.date_of_birth, imms);
    })();
    (async () => {
      try {
        const { data } = await supabase
          .from('child_milestones')
          .select('milestone_id, status')
          .eq('child_id', activeChild.id);
        const records = data ?? [];
        const achieved   = records.filter((r: any) => r.status === 'achieved');
        const inProgress = records.filter((r: any) => r.status === 'in_progress');
        setMilestoneData({
          total: 54,
          achieved: achieved.length,
          inProgress: inProgress.length,
          achievedTitles:   achieved.slice(0, 10).map((r: any) => MILESTONE_TITLES[r.milestone_id] ?? r.milestone_id),
          inProgressTitles: inProgress.slice(0, 5).map((r: any) => MILESTONE_TITLES[r.milestone_id] ?? r.milestone_id),
        });
      } catch (e) {
        console.warn('[chat] milestone fetch failed', e);
      }
    })();
  }, [activeChild?.id]);

  // ── Build context ──────────────────────────────────────────────────────────
  const buildChildContext = (): ChildContext => {
    const ageMonths = getAgeMonths();

    // latest is first (store ordered desc); typed strictly
    const latest: GrowthRecord | null = growthRecords[0] ?? null;

    const countByStatus = (status: string) =>
      vaccineRows.filter(r => r.status === status).length;
    const namesByStatus = (status: string): string[] =>
      vaccineRows
        .filter(r => r.status === status)
        .map(r => `${r.schedule.vaccine_name}${r.schedule.dose_number > 0 ? ' dose ' + r.schedule.dose_number : ''}`)
        .slice(0, 8);

    // Weight trend — last 3 records oldest→newest
    const recentRecords = [...growthRecords].slice(0, 3).reverse() as GrowthRecord[];
    const weightTrendKg    = recentRecords.map(r => r.weight_kg);
    const weightTrendDates = recentRecords.map(r => r.date);

    // Feeding stage — getFeedingStage may return undefined; access fields safely
    const feedingStage = getFeedingStage(ageMonths) as
      | { stage?: string; breastfeeding?: string; mealsPerDay?: string; foodGroups?: string }
      | null
      | undefined;

    const feedingParts: string[] = [];
    if (feedingStage?.mealsPerDay) feedingParts.push(`Meals/day: ${feedingStage.mealsPerDay}`);
    if (feedingStage?.foodGroups)  feedingParts.push(`Food groups: ${feedingStage.foodGroups}`);

    return {
      name:           activeChild?.full_name     ?? 'your child',
      ageMonths,
      sex:            activeChild?.sex           ?? 'unknown',
      dobStr:         activeChild?.date_of_birth ?? 'unknown',
      birthWeightKg:  activeChild?.birth_weight_kg,
      birthHeightCm:  activeChild?.birth_height_cm,
      healthFacility: activeChild?.health_facility,

      latestWeight:       latest?.weight_kg       ?? null,
      latestHeight:       latest?.height_cm       ?? null,
      latestAgeAtMeasure: latest?.age_months      ?? null,
      latestMeasureDate:  latest?.date            ?? null,
      waz:                latest?.waz             ?? null,
      haz:                latest?.haz             ?? null,
      whz:                latest?.whz             ?? null,
      weightStatus:       latest?.waz != null ? getZScoreDisplay(latest.waz).label : null,
      heightStatus:       latest?.haz != null ? getZScoreDisplay(latest.haz).label : null,
      whStatus:           latest?.whz != null ? getZScoreDisplay(latest.whz).label : null,
      totalGrowthRecords: growthRecords.length,
      weightTrendKg,
      weightTrendDates,

      vaccineGiven:       countByStatus('given'),
      vaccineDue:         countByStatus('due'),
      vaccineMissed:      countByStatus('missed'),
      vaccineUpcoming:    countByStatus('upcoming'),
      vaccineTotal:       vaccineRows.length,
      dueVaccineNames:    namesByStatus('due'),
      missedVaccineNames: namesByStatus('missed'),

      feedingStageLabel:       feedingStage?.stage        ?? `${ageMonths} months`,
      feedingStageDescription: feedingStage?.breastfeeding ?? feedingStage?.mealsPerDay ?? '',
      feedingExtra:            feedingParts.join('\n'),

      milestonesTotal:           milestoneData.total,
      milestonesAchieved:        milestoneData.achieved,
      milestonesInProgress:      milestoneData.inProgress,
      achievedMilestoneTitles:   milestoneData.achievedTitles,
      inProgressMilestoneTitles: milestoneData.inProgressTitles,

      language,
    };
  };

  // ── Personalised suggestions ───────────────────────────────────────────────
  const getSuggestions = (): string[] => {
    const ageMonths = getAgeMonths();
    const base: string[] = [];

    if (vaccineRows.some(r => r.status === 'missed')) base.push('My baby missed a vaccine — what do I do?');
    if (vaccineRows.some(r => r.status === 'due'))    base.push('Which vaccines are due now?');

    const latestWaz = growthRecords[0]?.waz ?? null;
    if (latestWaz != null && latestWaz < -2) base.push('My baby\'s weight is low — what should I do?');
    else if (growthRecords.length > 0)       base.push('Is my baby growing well?');
    else                                     base.push('How do I track my baby\'s growth?');

    if (ageMonths >= 6 && ageMonths <= 9) base.push('How do I start solid foods?');
    if (ageMonths < 6)                    base.push('How often should I breastfeed?');

    base.push('What should I feed my baby?', 'My baby has a fever', 'Signs of dehydration', 'Breastfeeding tips');

    return base.slice(0, 7);
  };

  // ── Messages state ─────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: activeChild
        ? `Habari! I'm Zuri, your ZuriHealth assistant 💙\n\nI can see ${activeChild.full_name}'s health profile and I'm ready to help with feeding, growth, vaccines, and more — all based on WHO and Kenya MoH guidelines.\n\nWhat would you like to know today?`
        : `Habari! I'm Zuri, your ZuriHealth assistant 💙\n\nPlease select a child from the Children tab first, then I can give you personalised advice based on their health profile.`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [newMsgIds, setNewMsgIds] = useState<Set<string>>(new Set(['0']));
  const scrollRef = useRef<ScrollView>(null);

  const scrollToBottom = () =>
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

  const sendMessage = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;

    const id = Date.now().toString();
    const userMsg: Message = { id, role: 'user', content: msg, timestamp: new Date() };
    const updated = [...messages, userMsg];

    setMessages(updated);
    setNewMsgIds(prev => new Set([...prev, id]));
    setInput('');
    setLoading(true);
    scrollToBottom();

    try {
      const apiMessages = updated
        .filter(m => m.id !== '0')
        .map(m => ({ role: m.role, content: m.content }));

      const ctx = buildChildContext();

      const res = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + GROQ_API_KEY },
        body: JSON.stringify({
          model: GROQ_MODEL,
          max_tokens: 1024,
          messages: [
            { role: 'system', content: buildSystemPrompt(ctx) },
            ...apiMessages,
          ],
        }),
      });

      const data  = await res.json();
      const reply: string = data?.choices?.[0]?.message?.content
        ?? 'Sorry, I could not get a response. Please try again.';

      const replyId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, { id: replyId, role: 'assistant', content: reply, timestamp: new Date() }]);
      setNewMsgIds(prev => new Set([...prev, replyId]));
      scrollToBottom();
    } catch {
      const errId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, {
        id: errId, role: 'assistant',
        content: 'I\'m having trouble connecting. Please check your internet and try again.',
        timestamp: new Date(),
      }]);
      setNewMsgIds(prev => new Set([...prev, errId]));
    } finally {
      setLoading(false);
    }
  };

  const ageMonths   = getAgeMonths();
  const hasGrowth   = growthRecords.length > 0;
  const hasVaccines = vaccineRows.length > 0;
  const hasMissed   = vaccineRows.some(r => r.status === 'missed');
  const hasDue      = vaccineRows.some(r => r.status === 'due');
  const suggestions = getSuggestions();

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* ── Header ── */}
      <View style={s.header}>
        <View style={s.headerOrb1} />
        <View style={s.headerOrb2} />

        <View style={s.headerRow}>
          <View style={s.avatarWrap}>
            <View style={s.avatarOuter}>
              <View style={s.avatarInner}>
                <Image source={require('@/assets/features/zuri-ai-256.png')} style={{ width: 28, height: 28, borderRadius: 14 }} />
              </View>
            </View>
            <View style={s.onlineDot} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Zuri</Text>
            <Text style={s.headerSub}>Evidence-based · ZuriHealth</Text>
          </View>

          {(hasDue || hasMissed) && (
            <View style={s.alertBadge}>
              <Ionicons name="medical" size={12} color="#fff" />
              <Text style={s.alertBadgeText}>{hasMissed ? 'Missed vaccine' : 'Vaccine due'}</Text>
            </View>
          )}
        </View>

        {activeChild && (
          <View style={s.contextStrip}>
            <View style={s.childPill}>
              <Ionicons
                name={activeChild.sex === 'female' ? 'female' : 'male'}
                size={11}
                color={COLORS.primary}
              />
              <Text style={s.childPillText}>{activeChild.full_name} · {ageMonths}mo</Text>
            </View>
            <View style={s.dataPills}>
              <DataPill icon="barbell-outline"          label="Growth"   ok={hasGrowth} />
              <DataPill icon="shield-checkmark-outline" label="Vaccines" ok={hasVaccines && !hasMissed} />
            </View>
          </View>
        )}
      </View>

      {/* ── Messages ── */}
      <ScrollView
        ref={scrollRef}
        style={s.messageList}
        contentContainerStyle={s.messageContent}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={scrollToBottom}
      >
        {messages.map(msg => (
          <MessageBubble key={msg.id} msg={msg} isNew={newMsgIds.has(msg.id)} />
        ))}
        {loading && <TypingDots />}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* ── Suggestion chips ── */}
      <View style={s.suggestBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.suggestRow}>
          {suggestions.map(text => (
            <TouchableOpacity key={text} style={ch.chip} onPress={() => sendMessage(text)} activeOpacity={0.75}>
              <Text style={ch.text}>{text}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── Input ── */}
      <View style={s.inputBar}>
        <TextInput
          style={s.input}
          value={input}
          onChangeText={setInput}
          placeholder="Ask Zuri a health question…"
          placeholderTextColor={COLORS.textMuted}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[s.sendBtn, (!input.trim() || loading) && s.sendBtnOff]}
          onPress={() => sendMessage()}
          disabled={!input.trim() || loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator size="small" color="#fff" />
            : <Ionicons name="send" size={17} color="#fff" />}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background, paddingBottom: 104 },

  header: {
    backgroundColor: COLORS.primary,
    paddingTop: Platform.OS === 'ios' ? 56 : 44,
    paddingBottom: 12,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  headerOrb1: {
    position: 'absolute', width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.07)', top: -60, right: -40,
  },
  headerOrb2: {
    position: 'absolute', width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.05)', bottom: -40, left: 40,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },

  avatarWrap:  { position: 'relative' },
  avatarOuter: {
    width: 44, height: 44, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInner: {
    width: 32, height: 32, borderRadius: 11,
    backgroundColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center',
  },
  onlineDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: COLORS.given,
    borderWidth: 2, borderColor: COLORS.primary,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.white, letterSpacing: -0.5 },
  headerSub:   { fontSize: 11, color: COLORS.primaryMid, marginTop: 1, fontWeight: '500' },

  alertBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.missed,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  alertBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },

  contextStrip: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', gap: 8,
  },
  childPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  childPillText: { fontSize: 11, color: COLORS.white, fontWeight: '600' },
  dataPills:     { flexDirection: 'row', gap: 6 },

  messageList:    { flex: 1 },
  messageContent: { paddingHorizontal: 16, paddingTop: 20 },

  suggestBar: {
    backgroundColor: COLORS.white,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    paddingVertical: 10,
  },
  suggestRow: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: COLORS.textPrimary,
    borderWidth: 1.5, borderColor: COLORS.border,
    maxHeight: 100, marginBottom: 24,
  },
  sendBtn: {
    width: 46, height: 46, borderRadius: 15,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
    ...Platform.select({ ios: { shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10 }, android: { elevation: 6 }, default: {} }), elevation: 6,
  },
  sendBtnOff: { backgroundColor: COLORS.primaryMid, shadowOpacity: 0 },
});

const b = StyleSheet.create({
  userRow: { alignItems: 'flex-end', marginBottom: 14 },
  userBubble: {
    backgroundColor: COLORS.primary,
    borderRadius: 18, borderBottomRightRadius: 5,
    paddingHorizontal: 14, paddingVertical: 10,
    maxWidth: W * 0.78,
    ...Platform.select({ ios: { shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 8 }, android: { elevation: 6 }, default: {} }), elevation: 4,
  },
  userText: { fontSize: 14, lineHeight: 21, color: COLORS.white },
  userTime: { fontSize: 10, color: COLORS.primaryMid, marginTop: 4, textAlign: 'right' },

  aiRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 14 },
  avatar: {
    width: 30, height: 30, borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({ ios: { shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 6 }, android: { elevation: 6 }, default: {} }), elevation: 3,
  },
  aiBubble: {
    backgroundColor: COLORS.white,
    borderRadius: 18, borderBottomLeftRadius: 5,
    paddingHorizontal: 14, paddingVertical: 10,
    maxWidth: W * 0.75,
    borderWidth: 1, borderColor: COLORS.border,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 }, android: { elevation: 6 }, default: {} }), elevation: 2,
  },
  aiText: { fontSize: 14, lineHeight: 22, color: COLORS.textPrimary },
  aiTime: { fontSize: 10, color: COLORS.textMuted, marginTop: 4 },
});

const ch = StyleSheet.create({
  chip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1, borderColor: COLORS.border,
  },
  text: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
});

const pill = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: RADIUS.full, borderWidth: 1,
  },
  ok:   { backgroundColor: COLORS.givenLight, borderColor: COLORS.given },
  warn: { backgroundColor: COLORS.dueLight,   borderColor: COLORS.due  },
  text: { fontSize: 10, fontWeight: '600' },
});
