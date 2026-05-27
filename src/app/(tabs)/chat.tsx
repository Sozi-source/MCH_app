/**
 * ZuriHealth — Premium Chat Screen
 * With rich message rendering (parsed sections, styled bullets, source badge)
 * OPTIMIZED: Added proper spacing, input pushed down, better scroll behavior
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
import {
  Image,
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
  Keyboard,
} from 'react-native';

const { width: W, height: H } = Dimensions.get('window');

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
  name: string;
  ageMonths: number;
  sex: string;
  dobStr: string;
  birthWeightKg: number | undefined;
  birthHeightCm: number | undefined;
  healthFacility: string | undefined;
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
  weightTrendKg: number[];
  weightTrendDates: string[];
  vaccineGiven: number;
  vaccineDue: number;
  vaccineMissed: number;
  vaccineUpcoming: number;
  vaccineTotal: number;
  dueVaccineNames: string[];
  missedVaccineNames: string[];
  feedingStageLabel: string;
  feedingStageDescription: string;
  feedingExtra: string;
  milestonesTotal: number;
  milestonesAchieved: number;
  milestonesInProgress: number;
  achievedMilestoneTitles: string[];
  inProgressMilestoneTitles: string[];
  language: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Message parser — splits AI text into answer / bullets / source
// ─────────────────────────────────────────────────────────────────────────────

interface ParsedMessage {
  answer: string;
  bullets: string[];
  source: string | null;
  emergency: boolean;
}

function parseAIMessage(raw: string): ParsedMessage {
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  const bullets: string[] = [];
  const answerLines: string[] = [];
  let source: string | null = null;
  let emergency = false;

  for (const line of lines) {
    if (/EMERGENCY|999|go to the nearest hospital/i.test(line)) emergency = true;

    if (/^(Source:|📚|_Source)/i.test(line)) {
      source = line.replace(/^(Source:|📚|_Source:?)\s*/i, '').replace(/_/g, '').trim();
      continue;
    }
    if (/^[-*•]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      bullets.push(line.replace(/^[-*•\d.]\s+/, '').trim());
      continue;
    }
    answerLines.push(line);
  }

  return {
    answer: answerLines.join(' ').trim(),
    bullets,
    source,
    emergency,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Rich AI bubble renderer
// ─────────────────────────────────────────────────────────────────────────────

function RichAIBubble({ content, timeStr }: { content: string; timeStr: string }) {
  const parsed = parseAIMessage(content);

  return (
    <View style={rb.card}>
      {parsed.emergency && (
        <View style={rb.emergencyBanner}>
          <Ionicons name="warning" size={14} color="#fff" />
          <Text style={rb.emergencyText}>EMERGENCY — Go to hospital NOW or call 999</Text>
        </View>
      )}

      {parsed.answer.length > 0 && (
        <Text style={rb.answerText}>{parsed.answer}</Text>
      )}

      {parsed.bullets.length > 0 && (
        <View style={rb.bulletsSection}>
          <Text style={rb.bulletsSectionLabel}>What to do</Text>
          {parsed.bullets.map((b, i) => (
            <View key={i} style={rb.bulletRow}>
              <View style={rb.bulletDot}>
                <Text style={rb.bulletDotText}>{i + 1}</Text>
              </View>
              <Text style={rb.bulletText}>{b}</Text>
            </View>
          ))}
        </View>
      )}

      {parsed.source && (
        <View style={rb.sourceBadge}>
          <Ionicons name="book-outline" size={11} color={COLORS.primary} />
          <Text style={rb.sourceText}>{parsed.source}</Text>
        </View>
      )}

      <Text style={rb.timeText}>{timeStr}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// System prompt builder
// ─────────────────────────────────────────────────────────────────────────────

function buildSystemPrompt(ctx: ChildContext): string {
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
    growthSection = `Latest (${ctx.latestMeasureDate ?? 'unknown'}, age ${ctx.latestAgeAtMeasure ?? ctx.ageMonths}mo):
  - Weight: ${ctx.latestWeight}kg (WAZ ${ctx.waz?.toFixed(2) ?? 'N/A'} = ${wazLabel})
  - Height: ${ctx.latestHeight != null ? ctx.latestHeight + 'cm' : 'not recorded'} (HAZ ${ctx.haz?.toFixed(2) ?? 'N/A'} = ${hazLabel})
  - WHZ: ${ctx.whz?.toFixed(2) ?? 'N/A'} = ${whzLabel}${trendNote}`;
  }

  let vaccineSection = 'No vaccine data loaded yet.';
  if (ctx.vaccineTotal > 0) {
    vaccineSection = `${ctx.vaccineGiven}/${ctx.vaccineTotal} given | Due: ${ctx.dueVaccineNames.join(', ') || 'none'} | Missed: ${ctx.missedVaccineNames.join(', ') || 'none'}`;
  }

  let milestoneSection = 'No milestone data yet.';
  if (ctx.milestonesTotal > 0) {
    milestoneSection = `${ctx.milestonesAchieved}/${ctx.milestonesTotal} achieved`;
  }

  const birthInfo = [
    ctx.birthWeightKg  ? `birth weight ${ctx.birthWeightKg}kg`        : null,
    ctx.birthHeightCm  ? `birth length ${ctx.birthHeightCm}cm`         : null,
    ctx.healthFacility ? `facility: ${ctx.healthFacility}`            : null,
  ].filter(Boolean).join(', ');

  return `You are Zuri, a trusted maternal and child health assistant by ZuriHealth, built for Kenyan mothers.

CHILD PROFILE:
Name: ${ctx.name} | Age: ${ctx.ageMonths}mo | Sex: ${ctx.sex} | DOB: ${ctx.dobStr}
${birthInfo ? birthInfo : ''}
Growth: ${growthSection}
Vaccines: ${vaccineSection}
Feeding: ${ctx.feedingStageLabel} — ${ctx.feedingStageDescription} ${ctx.feedingExtra}
Milestones: ${milestoneSection}

LANGUAGE: ${ctx.language === 'sw' ? 'Respond in Swahili' : 'Respond in English'}. Match the mother's language if she switches.

RESPONSE FORMAT — always follow this exact structure:
[1-3 sentence direct answer in plain language]

- [practical step 1]
- [practical step 2]
- [practical step 3 if needed]

Source: [specific guideline name and year]

RULES:
- Under 150 words total. Direct, warm, no jargon.
- Use the child's actual name and real data from the profile above.
- If WAZ < -2, missed vaccines, or WHZ shows MAM/SAM — acknowledge it proactively.
- Never ask for info already in the profile.
- Only use: WHO IYCF Guidelines, WHO Child Growth Standards 2006, WHO IMCI, Kenya KEPI Schedule, Kenya MCH Handbook, Kenya KIMNCI, Nelson Pediatrics 21st Ed, UNICEF IYCF Cards.
- No medication dosages, no diagnosis, no herbal remedies.
- For danger signs (difficulty breathing, seizures, severe dehydration, newborn fever): start with "EMERGENCY — Go to the nearest hospital NOW or call 999."
- End serious symptom responses with: "Please confirm this with your MCH nurse or doctor."
- Refer nutrition prescriptions to MCH nutritionist.
- Physical exam needed: "I recommend visiting your nearest MCH clinic."`;
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
    anim(d0, 0); anim(d1, 150); anim(d2, 300);
  }, []);
  return (
    <View style={b.aiRow}>
      <View style={b.avatar}>
        <Image source={require('@/assets/features/zuri-ai-256.png')} style={{ width: 28, height: 28, borderRadius: 14 }} />
      </View>
      <View style={b.aiBubble}>
        <View style={{ flexDirection: 'row', gap: 5, alignItems: 'center', paddingVertical: 2 }}>
          {[d0, d1, d2].map((d, i) => (
            <Animated.View key={i} style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: COLORS.primary, opacity: d }} />
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
      <RichAIBubble content={msg.content} timeStr={timeStr} />
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
        const { data } = await supabase.from('child_milestones').select('milestone_id, status').eq('child_id', activeChild.id);
        const records = data ?? [];
        const achieved   = records.filter((r: any) => r.status === 'achieved');
        const inProgress = records.filter((r: any) => r.status === 'in_progress');
        setMilestoneData({
          total: 54, achieved: achieved.length, inProgress: inProgress.length,
          achievedTitles:   achieved.slice(0, 10).map((r: any) => MILESTONE_TITLES[r.milestone_id] ?? r.milestone_id),
          inProgressTitles: inProgress.slice(0, 5).map((r: any) => MILESTONE_TITLES[r.milestone_id] ?? r.milestone_id),
        });
      } catch (e) { console.warn('[chat] milestone fetch failed', e); }
    })();
  }, [activeChild?.id]);

  const buildChildContext = (): ChildContext => {
    const ageMonths = getAgeMonths();
    const latest: GrowthRecord | null = growthRecords[0] ?? null;
    const countByStatus = (status: string) => vaccineRows.filter(r => r.status === status).length;
    const namesByStatus = (status: string): string[] =>
      vaccineRows.filter(r => r.status === status)
        .map(r => `${r.schedule.vaccine_name}${r.schedule.dose_number > 0 ? ' dose ' + r.schedule.dose_number : ''}`)
        .slice(0, 8);
    const recentRecords = [...growthRecords].slice(0, 3).reverse() as GrowthRecord[];
    const feedingStage = getFeedingStage(ageMonths) as
      | { stage?: string; breastfeeding?: string; mealsPerDay?: string; foodGroups?: string }
      | null | undefined;
    const feedingParts: string[] = [];
    if (feedingStage?.mealsPerDay) feedingParts.push(`Meals/day: ${feedingStage.mealsPerDay}`);
    if (feedingStage?.foodGroups)  feedingParts.push(`Food groups: ${feedingStage.foodGroups}`);
    return {
      name: activeChild?.full_name ?? 'your child', ageMonths,
      sex: activeChild?.sex ?? 'unknown', dobStr: activeChild?.date_of_birth ?? 'unknown',
      birthWeightKg: activeChild?.birth_weight_kg, birthHeightCm: activeChild?.birth_height_cm,
      healthFacility: activeChild?.health_facility,
      latestWeight: latest?.weight_kg ?? null, latestHeight: latest?.height_cm ?? null,
      latestAgeAtMeasure: latest?.age_months ?? null, latestMeasureDate: latest?.date ?? null,
      waz: latest?.waz ?? null, haz: latest?.haz ?? null, whz: latest?.whz ?? null,
      weightStatus: latest?.waz != null ? getZScoreDisplay(latest.waz).label : null,
      heightStatus: latest?.haz != null ? getZScoreDisplay(latest.haz).label : null,
      whStatus:     latest?.whz != null ? getZScoreDisplay(latest.whz).label : null,
      totalGrowthRecords: growthRecords.length,
      weightTrendKg:    recentRecords.map(r => r.weight_kg),
      weightTrendDates: recentRecords.map(r => r.date),
      vaccineGiven: countByStatus('given'), vaccineDue: countByStatus('due'),
      vaccineMissed: countByStatus('missed'), vaccineUpcoming: countByStatus('upcoming'),
      vaccineTotal: vaccineRows.length,
      dueVaccineNames: namesByStatus('due'), missedVaccineNames: namesByStatus('missed'),
      feedingStageLabel:       feedingStage?.stage        ?? `${ageMonths} months`,
      feedingStageDescription: feedingStage?.breastfeeding ?? feedingStage?.mealsPerDay ?? '',
      feedingExtra: feedingParts.join('\n'),
      milestonesTotal: milestoneData.total, milestonesAchieved: milestoneData.achieved,
      milestonesInProgress: milestoneData.inProgress,
      achievedMilestoneTitles: milestoneData.achievedTitles,
      inProgressMilestoneTitles: milestoneData.inProgressTitles,
      language,
    };
  };

  const [messages, setMessages] = useState<Message[]>([{
    id: '0', role: 'assistant',
    content: activeChild
      ? `Habari! I'm Zuri, your ZuriHealth assistant 💙\n\nI can see ${activeChild.full_name}'s health profile and I'm ready to help with feeding, growth, vaccines, and more — all based on WHO and Kenya MoH guidelines.\n\nWhat would you like to know today?`
      : `Habari! I'm Zuri, your ZuriHealth assistant 💙\n\nPlease select a child from the Children tab first, then I can give you personalised advice based on their health profile.`,
    timestamp: new Date(),
  }]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [newMsgIds, setNewMsgIds] = useState<Set<string>>(new Set(['0']));
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  
  const scrollToBottom = () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

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
    Keyboard.dismiss();
    
    try {
      const apiMessages = updated.filter(m => m.id !== '0').map(m => ({ role: m.role, content: m.content }));
      const ctx = buildChildContext();
      const res = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + GROQ_API_KEY },
        body: JSON.stringify({
          model: GROQ_MODEL, max_tokens: 512,
          messages: [{ role: 'system', content: buildSystemPrompt(ctx) }, ...apiMessages],
        }),
      });
      const data  = await res.json();
      const reply: string = data?.choices?.[0]?.message?.content ?? 'Sorry, I could not get a response. Please try again.';
      const replyId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, { id: replyId, role: 'assistant', content: reply, timestamp: new Date() }]);
      setNewMsgIds(prev => new Set([...prev, replyId]));
      scrollToBottom();
    } catch {
      const errId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, { id: errId, role: 'assistant', content: "I'm having trouble connecting. Please check your internet and try again.", timestamp: new Date() }]);
      setNewMsgIds(prev => new Set([...prev, errId]));
    } finally { setLoading(false); }
  };

  const ageMonths   = getAgeMonths();
  const hasGrowth   = growthRecords.length > 0;
  const hasVaccines = vaccineRows.length > 0;
  const hasMissed   = vaccineRows.some(r => r.status === 'missed');
  const hasDue      = vaccineRows.some(r => r.status === 'due');

  return (
    <KeyboardAvoidingView 
      style={s.root} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
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
              <Ionicons name={activeChild.sex === 'female' ? 'female' : 'male'} size={11} color={COLORS.primary} />
              <Text style={s.childPillText}>{activeChild.full_name} · {ageMonths}mo</Text>
            </View>
            <View style={s.dataPills}>
              <DataPill icon="barbell-outline"          label="Growth"   ok={hasGrowth} />
              <DataPill icon="shield-checkmark-outline" label="Vaccines" ok={hasVaccines && !hasMissed} />
            </View>
          </View>
        )}
      </View>

      <ScrollView 
        ref={scrollRef} 
        style={s.messageList} 
        contentContainerStyle={s.messageContent} 
        showsVerticalScrollIndicator={false} 
        onContentSizeChange={scrollToBottom}
      >
        {messages.map(msg => <MessageBubble key={msg.id} msg={msg} isNew={newMsgIds.has(msg.id)} />)}
        {loading && <TypingDots />}
        {/* Extra space at bottom for better readability */}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Input Bar - Fixed at bottom with proper spacing */}
      <View style={s.inputWrapper}>
        <View style={s.inputBar}>
          <TextInput
            ref={inputRef}
            style={s.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask Zuri a health question..."
            placeholderTextColor={COLORS.textMuted}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={() => sendMessage()}
          />
          <TouchableOpacity
            style={[s.sendBtn, (!input.trim() || loading) && s.sendBtnOff]}
            onPress={() => sendMessage()} 
            disabled={!input.trim() || loading} 
            activeOpacity={0.85}
          >
            {loading ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={17} color="#fff" />}
          </TouchableOpacity>
        </View>
        {/* Extra safe area padding for bottom */}
        <View style={s.bottomSafeArea} />
      </View>
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles - Optimized with proper spacing
// ─────────────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { 
    flex: 1, 
    backgroundColor: COLORS.background,
  },
  header: { 
    backgroundColor: COLORS.primary, 
    paddingTop: Platform.OS === 'ios' ? 56 : 44, 
    paddingBottom: 12, 
    paddingHorizontal: 16, 
    overflow: 'hidden' 
  },
  headerOrb1: { 
    position: 'absolute', 
    width: 180, 
    height: 180, 
    borderRadius: 90, 
    backgroundColor: 'rgba(255,255,255,0.07)', 
    top: -60, 
    right: -40 
  },
  headerOrb2: { 
    position: 'absolute', 
    width: 100, 
    height: 100, 
    borderRadius: 50, 
    backgroundColor: 'rgba(255,255,255,0.05)', 
    bottom: -40, 
    left: 40 
  },
  headerRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12, 
    marginBottom: 12 
  },
  avatarWrap:  { 
    position: 'relative' 
  },
  avatarOuter: { 
    width: 44, 
    height: 44, 
    borderRadius: 16, 
    backgroundColor: 'rgba(255,255,255,0.15)', 
    borderWidth: 1.5, 
    borderColor: 'rgba(255,255,255,0.25)', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  avatarInner: { 
    width: 32, 
    height: 32, 
    borderRadius: 11, 
    overflow: 'hidden', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  onlineDot: { 
    position: 'absolute', 
    bottom: 1, 
    right: 1, 
    width: 10, 
    height: 10, 
    borderRadius: 5, 
    backgroundColor: COLORS.given, 
    borderWidth: 2, 
    borderColor: COLORS.primary 
  },
  headerTitle: { 
    fontSize: 18, 
    fontWeight: '800', 
    color: COLORS.white, 
    letterSpacing: -0.5 
  },
  headerSub: {   
    fontSize: 11, 
    color: COLORS.primaryMid, 
    marginTop: 1, 
    fontWeight: '500' 
  },
  alertBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 4, 
    backgroundColor: COLORS.missed, 
    paddingHorizontal: 10, 
    paddingVertical: 5, 
    borderRadius: RADIUS.full 
  },
  alertBadgeText: { 
    fontSize: 10, 
    fontWeight: '700', 
    color: '#fff' 
  },
  contextStrip: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    gap: 8 
  },
  childPill: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 5, 
    backgroundColor: 'rgba(255,255,255,0.15)', 
    paddingHorizontal: 10, 
    paddingVertical: 5, 
    borderRadius: RADIUS.full 
  },
  childPillText: { 
    fontSize: 11, 
    color: COLORS.white, 
    fontWeight: '600' 
  },
  dataPills: { 
    flexDirection: 'row', 
    gap: 6 
  },
  messageList: { 
    flex: 1 
  },
  messageContent: { 
    paddingHorizontal: 16, 
    paddingTop: 20,
    paddingBottom: 8,
  },
  
  // Input section - Pushed down with proper spacing
  inputWrapper: {
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 6,
  },
  inputBar: { 
    flexDirection: 'row', 
    alignItems: 'flex-end', 
    gap: 10, 
    paddingHorizontal: 16,
  },
  input: { 
    flex: 1, 
    backgroundColor: COLORS.background, 
    borderRadius: RADIUS.lg, 
    paddingHorizontal: 14, 
    paddingVertical: 12, 
    fontSize: 14, 
    color: COLORS.textPrimary, 
    borderWidth: 1.5, 
    borderColor: COLORS.border, 
    maxHeight: 100,
    minHeight: 44,
  },
  sendBtn: { 
    width: 46, 
    height: 46, 
    borderRadius: 15, 
    backgroundColor: COLORS.primary, 
    alignItems: 'center', 
    justifyContent: 'center', 
    elevation: 6,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  sendBtnOff: { 
    backgroundColor: COLORS.primaryMid,
    elevation: 0,
    shadowOpacity: 0,
  },
  bottomSafeArea: {
    height: Platform.OS === 'ios' ? 34 : 24,
  },
});

// Rich bubble styles - Increased spacing
const rb = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    borderBottomLeftRadius: 5,
    paddingHorizontal: 16,
    paddingVertical: 14,
    maxWidth: W * 0.8,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 2,
    gap: 12,
    marginBottom: 4,
  },
  emergencyBanner: {
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8,
    backgroundColor: '#DC2626',
    borderRadius: 10, 
    paddingHorizontal: 12, 
    paddingVertical: 8,
  },
  emergencyText: { 
    fontSize: 12, 
    fontWeight: '700', 
    color: '#fff', 
    flex: 1 
  },
  answerText: { 
    fontSize: 14, 
    lineHeight: 22, 
    color: COLORS.textPrimary, 
    fontWeight: '500' 
  },
  bulletsSection: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  bulletsSectionLabel: {
    fontSize: 11, 
    fontWeight: '800', 
    color: COLORS.primary,
    textTransform: 'uppercase', 
    letterSpacing: 0.6, 
    marginBottom: 4,
  },
  bulletRow: { 
    flexDirection: 'row', 
    alignItems: 'flex-start', 
    gap: 10 
  },
  bulletDot: {
    width: 22, 
    height: 22, 
    borderRadius: 11,
    backgroundColor: COLORS.primary,
    alignItems: 'center', 
    justifyContent: 'center',
    flexShrink: 0, 
    marginTop: 1,
  },
  bulletDotText: { 
    fontSize: 10, 
    fontWeight: '800', 
    color: '#fff' 
  },
  bulletText: { 
    fontSize: 13, 
    lineHeight: 20, 
    color: COLORS.textPrimary, 
    flex: 1 
  },
  sourceBadge: {
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6,
    backgroundColor: '#F0F9FF',
    borderRadius: 10, 
    paddingHorizontal: 12, 
    paddingVertical: 8,
    borderWidth: 1, 
    borderColor: '#BAE6FD',
  },
  sourceText: { 
    fontSize: 11, 
    color: COLORS.primary, 
    fontWeight: '600', 
    flex: 1 
  },
  timeText: { 
    fontSize: 10, 
    color: COLORS.textMuted, 
    textAlign: 'right', 
    marginTop: 4 
  },
});

const b = StyleSheet.create({
  userRow: { 
    alignItems: 'flex-end', 
    marginBottom: 16 
  },
  userBubble: { 
    backgroundColor: COLORS.primary, 
    borderRadius: 18, 
    borderBottomRightRadius: 5, 
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    maxWidth: W * 0.8, 
    elevation: 4 
  },
  userText: { 
    fontSize: 14, 
    lineHeight: 21, 
    color: COLORS.white 
  },
  userTime: { 
    fontSize: 10, 
    color: COLORS.primaryMid, 
    marginTop: 6, 
    textAlign: 'right' 
  },
  aiRow: { 
    flexDirection: 'row', 
    alignItems: 'flex-end', 
    gap: 10, 
    marginBottom: 16 
  },
  avatar: { 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    overflow: 'hidden', 
    elevation: 3 
  },
  aiBubble: { 
    backgroundColor: COLORS.white, 
    borderRadius: 18, 
    borderBottomLeftRadius: 5, 
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    maxWidth: W * 0.75, 
    borderWidth: 1, 
    borderColor: COLORS.border, 
    elevation: 2 
  },
  aiText: { 
    fontSize: 14, 
    lineHeight: 22, 
    color: COLORS.textPrimary 
  },
  aiTime: { 
    fontSize: 10, 
    color: COLORS.textMuted, 
    marginTop: 6 
  },
});

const pill = StyleSheet.create({
  wrap: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 4, 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: RADIUS.full, 
    borderWidth: 1 
  },
  ok:   { 
    backgroundColor: COLORS.givenLight, 
    borderColor: COLORS.given 
  },
  warn: { 
    backgroundColor: COLORS.dueLight,   
    borderColor: COLORS.due  
  },
  text: { 
    fontSize: 10, 
    fontWeight: '600' 
  },
});