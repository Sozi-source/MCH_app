/**
 * chat.tsx  –  Zuri AI Chat
 *
 * KEY UPGRADE: buildSystemPrompt() now receives a ChildContext object that
 * carries every piece of live data the app already holds about the active
 * child: demographics, latest growth record + z-scores, full vaccine status,
 * and feeding stage.  The AI can therefore give context-aware answers without
 * asking the mother to repeat information she has already entered.
 */

import { COLORS, RADIUS } from '@/lib/theme';
import { useChildStore } from '@/store/childStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useVaccineStore } from '@/store/vaccineStore';
import { getZScoreDisplay, getFeedingStage } from '@/lib/nutritionData';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';

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

/** All child-specific data passed into the system prompt. */
interface ChildContext {
  // Demographics
  name: string;
  ageMonths: number;
  sex: string;
  dobStr: string;
  birthWeightKg?: number | null;
  birthHeightCm?: number | null;
  healthFacility?: string | null;

  // Latest growth measurement
  latestWeight?: number | null;
  latestHeight?: number | null;
  latestAgeAtMeasure?: number | null;
  latestMeasureDate?: string | null;
  waz?: number | null;
  haz?: number | null;
  whz?: number | null;
  weightStatus?: string | null;
  heightStatus?: string | null;
  whStatus?: string | null;
  totalGrowthRecords: number;

  // Vaccine summary
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

  // Language
  language: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// System prompt builder
// ─────────────────────────────────────────────────────────────────────────────

function buildSystemPrompt(ctx: ChildContext): string {
  // ── Growth section ────────────────────────────────────────────────────────
  let growthSection = 'No growth measurements recorded yet.';
  if (ctx.latestWeight != null) {
    const wazLabel  = ctx.waz  != null ? getZScoreDisplay(ctx.waz).label  : 'N/A';
    const hazLabel  = ctx.haz  != null ? getZScoreDisplay(ctx.haz).label  : 'N/A';
    const whzLabel  = ctx.whz  != null ? getZScoreDisplay(ctx.whz).label  : 'N/A';

    growthSection = `Latest measurement (${ctx.latestMeasureDate ?? 'unknown date'}, age ${ctx.latestAgeAtMeasure ?? ctx.ageMonths} months):
  - Weight: ${ctx.latestWeight} kg   (WAZ ${ctx.waz != null ? ctx.waz.toFixed(2) : 'N/A'} → ${wazLabel})
  - Height: ${ctx.latestHeight != null ? ctx.latestHeight + ' cm' : 'not recorded'}   (HAZ ${ctx.haz != null ? ctx.haz.toFixed(2) : 'N/A'} → ${hazLabel})
  - Weight-for-Height: WHZ ${ctx.whz != null ? ctx.whz.toFixed(2) : 'N/A'} → ${whzLabel}
  - WHO classifications: weight=${ctx.weightStatus ?? 'N/A'}, height=${ctx.heightStatus ?? 'N/A'}, wh=${ctx.whStatus ?? 'N/A'}
  - Total records in app: ${ctx.totalGrowthRecords}`;
  }

  // ── Vaccine section ────────────────────────────────────────────────────────
  let vaccineSection = 'No vaccine data loaded yet.';
  if (ctx.vaccineTotal > 0) {
    const dueList    = ctx.dueVaccineNames.length    ? ctx.dueVaccineNames.join(', ')    : 'none';
    const missedList = ctx.missedVaccineNames.length ? ctx.missedVaccineNames.join(', ') : 'none';
    vaccineSection = `Coverage: ${ctx.vaccineGiven}/${ctx.vaccineTotal} given (${Math.round((ctx.vaccineGiven / ctx.vaccineTotal) * 100)}%)
  - Due NOW:  ${dueList}
  - Missed:   ${missedList}
  - Upcoming: ${ctx.vaccineUpcoming}`;
  }

  // ── Birth info ─────────────────────────────────────────────────────────────
  const birthInfo = [
    ctx.birthWeightKg  ? `birth weight ${ctx.birthWeightKg} kg`   : null,
    ctx.birthHeightCm  ? `birth length ${ctx.birthHeightCm} cm`   : null,
    ctx.healthFacility ? `registered facility: ${ctx.healthFacility}` : null,
  ].filter(Boolean).join(', ');

  return `You are Zuri, a trusted maternal and child health assistant by Zuri Health, built for Kenyan mothers. You are kind, clear, and culturally sensitive.

════════════════════════════════════════════
ACTIVE CHILD — FULL HEALTH PROFILE
════════════════════════════════════════════
Name  : ${ctx.name}
DOB   : ${ctx.dobStr}
Age   : ${ctx.ageMonths} months
Sex   : ${ctx.sex}
${birthInfo ? 'Birth info: ' + birthInfo : ''}

── GROWTH STATUS ──
${growthSection}

── VACCINE STATUS (Kenya KEPI) ──
${vaccineSection}

── FEEDING STAGE ──
Stage: ${ctx.feedingStageLabel}
${ctx.feedingStageDescription}
════════════════════════════════════════════

LANGUAGE: Respond in ${ctx.language === 'sw' ? 'Swahili' : 'English'} unless the mother writes in the other language, then match her language.

IMPORTANT INSTRUCTION — USE THE PROFILE ABOVE:
Before answering ANY question, read the child's profile above carefully.
- If asked about growth, reference the actual z-scores and classifications above — do not give generic answers.
- If asked about vaccines, reference the exact due/missed vaccines above by name.
- If asked about feeding, reference the feeding stage above and the child's actual age.
- If the profile shows a concern (e.g. WAZ < -2, a missed vaccine, WHZ indicating MAM/SAM), acknowledge it proactively when relevant.
- Never ask the mother for information already present in the profile above.

YOUR KNOWLEDGE IS STRICTLY LIMITED TO THESE VERIFIED SOURCES:
1. WHO Infant and Young Child Feeding (IYCF) Guidelines
2. WHO Child Growth Standards (2006)
3. WHO Integrated Management of Childhood Illness (IMCI)
4. WHO Pocket Book of Hospital Care for Children
5. WHO Caring for Newborns and Children in the Community
6. WHO Complementary Feeding Counselling Guide (2004)
7. WHO Vitamin and Mineral Nutrition Guidelines
8. UNICEF IYCF Counselling Cards
9. UNICEF Programming Guide – Infant and Young Child Feeding
10. Kenya KEPI Immunization Schedule (Kenya MoH)
11. Kenya Essential Package for Health (KEPH)
12. Kenya MCH (Mother and Child Health) Handbook
13. Kenya National Nutrition Action Plan
14. Kenya Integrated Management of Neonatal and Childhood Illness (KIMNCI)
15. Nelson Textbook of Pediatrics (21st Edition) – Kliegman et al.
16. Krause's Food and the Nutrition Care Process
17. Williams Obstetrics
18. Myles Textbook for Midwives
19. USAID Infant and Young Child Nutrition Guidelines
20. Lancet Breastfeeding Series
21. American Academy of Pediatrics (AAP) Breastfeeding Guidelines

STRICT RULES:
1. ONLY answer using knowledge from the sources listed above. Never use internet sources, social media, or unverified remedies.
2. Always mention which guideline or book your answer is based on (e.g. "According to WHO IMCI guidelines...").
3. Keep answers concise, practical, and easy for a mother to understand.
4. If a question falls outside these sources or requires physical examination, say: "I recommend visiting your nearest MCH clinic or hospital for this. This is beyond what I can safely advise."
5. NEVER suggest traditional/herbal medicine, unverified home remedies, or medication dosages.
6. For specific nutrition planning, dietary assessments, therapeutic feeding, or malnutrition treatment: say "For personalised nutrition advice, please consult a certified nutritionist or registered dietitian at your nearest hospital or MCH clinic."
7. For any danger signs (difficulty breathing, seizures, loss of consciousness, severe dehydration, high fever in a newborn under 2 months): say "This is an EMERGENCY. Go to the nearest hospital NOW or call 999."
8. Always end serious health responses with: "Please confirm this with your MCH nurse or doctor."
9. Be warm and encouraging – mothers are doing their best.

TOPICS YOU CAN HELP WITH:
- Breastfeeding and complementary feeding
- Child growth and weight concerns
- Kenya KEPI vaccine schedule and missed vaccines
- IYCF food groups by age
- Newborn care
- Common childhood illnesses (cough, diarrhoea, fever) – recognition and when to seek care
- Nutrition for mothers
- Child development milestones

TOPICS YOU MUST DECLINE:
- Medication names or dosages
- Diagnosis of specific diseases
- Personalised nutrition plans or therapeutic dietary prescriptions
- Anything not covered by the verified sources above`;
}

// ─────────────────────────────────────────────────────────────────────────────
// UI sub-components (unchanged from original)
// ─────────────────────────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <View style={[bubble.wrapper, bubble.aiBubbleWrapper]}>
      <View style={bubble.avatar}>
        <Ionicons name="heart" size={14} color={COLORS.onPrimary} />
      </View>
      <View style={[bubble.bubble, bubble.aiBubble]}>
        <View style={bubble.dotRow}>
          <View style={[bubble.dot, { opacity: 0.3 }]} />
          <View style={[bubble.dot, { opacity: 0.6 }]} />
          <View style={bubble.dot} />
        </View>
      </View>
    </View>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  return (
    <View style={[bubble.wrapper, isUser ? bubble.userWrapper : bubble.aiBubbleWrapper]}>
      {!isUser ? (
        <View style={bubble.avatar}>
          <Ionicons name="heart" size={14} color={COLORS.onPrimary} />
        </View>
      ) : null}
      <View style={[bubble.bubble, isUser ? bubble.userBubble : bubble.aiBubble]}>
        <Text style={[bubble.text, isUser ? bubble.userText : bubble.aiText]}>{msg.content}</Text>
        <Text style={[bubble.time, isUser ? bubble.userTime : bubble.aiTime]}>
          {msg.timestamp.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </View>
  );
}

const SUGGESTIONS = [
  'When is the next vaccine?',
  'What should I feed my baby?',
  'My baby has a fever',
  'Is my baby growing well?',
  'Breastfeeding tips',
  'Signs of dehydration',
  'Find a nutritionist near me',
];

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const { children, selectedChildId, growthRecords, fetchGrowthRecords } = useChildStore();
  const { vaccineRows, fetchSchedules, fetchImmunizations, computeRows, schedules } = useVaccineStore();
  const { language } = useSettingsStore();

  const activeChild = children.find(c => c.id === selectedChildId) ?? children[0];

  // ── Age helper ──────────────────────────────────────────────────────────────
  const getAgeMonths = (): number => {
    if (!activeChild?.date_of_birth) return 0;
    const dob = new Date(activeChild.date_of_birth);
    const now = new Date();
    return (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());
  };

  // ── Load child data when active child changes ──────────────────────────────
  useEffect(() => {
    if (!activeChild?.id) return;
    fetchGrowthRecords(activeChild.id);
    // Ensure vaccine schedules are loaded then compute rows
    (async () => {
      if (schedules.length === 0) await fetchSchedules();
      const imms = await fetchImmunizations(activeChild.id);
      computeRows(activeChild.date_of_birth, imms);
    })();
  }, [activeChild?.id]);

  // ── Build rich context object ───────────────────────────────────────────────
  const buildChildContext = (): ChildContext => {
    const ageMonths = getAgeMonths();
    const latest    = growthRecords[0] ?? null; // store is ordered desc

    // Vaccine summary
    const countByStatus = (status: string) =>
      vaccineRows.filter(r => r.status === status).length;
    const namesByStatus = (status: string): string[] =>
      vaccineRows
        .filter(r => r.status === status)
        .map(r => `${r.schedule.vaccine_name}${r.schedule.dose_number > 0 ? ' dose ' + r.schedule.dose_number : ''}`)
        .slice(0, 8); // cap list length in prompt

    const feedingStage = getFeedingStage(ageMonths);

    return {
      name:             activeChild?.full_name    ?? 'your child',
      ageMonths,
      sex:              activeChild?.sex          ?? 'unknown',
      dobStr:           activeChild?.date_of_birth ?? 'unknown',
      birthWeightKg:    activeChild?.birth_weight_kg,
      birthHeightCm:    activeChild?.birth_height_cm,
      healthFacility:   activeChild?.health_facility,

      latestWeight:        latest?.weight_kg       ?? null,
      latestHeight:        latest?.height_cm       ?? null,
      latestAgeAtMeasure:  latest?.age_months   ?? null,
      latestMeasureDate:   latest?.date         ?? null,
      waz:                 latest?.waz             ?? null,
      haz:                 latest?.haz             ?? null,
      whz:                 latest?.whz             ?? null,
      weightStatus:        latest?.waz != null ? getZScoreDisplay(latest.waz).label  : null,
      heightStatus:        latest?.haz != null ? getZScoreDisplay(latest.haz).label  : null,
      whStatus:            latest?.whz != null ? getZScoreDisplay(latest.whz).label  : null,
      totalGrowthRecords:  growthRecords.length,

      vaccineGiven:        countByStatus('given'),
      vaccineDue:          countByStatus('due'),
      vaccineMissed:       countByStatus('missed'),
      vaccineUpcoming:     countByStatus('upcoming'),
      vaccineTotal:        vaccineRows.length,
      dueVaccineNames:     namesByStatus('due'),
      missedVaccineNames:  namesByStatus('missed'),

      feedingStageLabel:       feedingStage?.stage        ?? `${ageMonths} months`,
      feedingStageDescription: feedingStage?.breastfeeding ?? feedingStage?.mealsPerDay ?? '',
      language,
    };
  };

  // ── Messages state ──────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: activeChild
        ? `Hello! I am Zuri, your child health assistant from Zuri Health.\n\nI am here to help you with questions about ${activeChild.full_name}'s health, feeding, vaccines, and growth – based on WHO and Kenya MoH guidelines.\n\nWhat would you like to know today?`
        : 'Hello! I am Zuri, your child health assistant from Zuri Health.\n\nPlease select a child first from the Children tab, then ask me anything about their health, feeding, vaccines, or growth.',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const scrollToBottom = () =>
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

  // ── Send message ────────────────────────────────────────────────────────────
  const sendMessage = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: msg,
      timestamp: new Date(),
    };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    setLoading(true);
    scrollToBottom();

    try {
      const apiMessages = updated
        .filter(m => m.id !== '0')
        .map(m => ({ role: m.role, content: m.content }));

      // Rebuild context on every send so the AI always has the freshest data
      const ctx = buildChildContext();

      const res = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': 'Bearer ' + GROQ_API_KEY,
        },
        body: JSON.stringify({
          model:      GROQ_MODEL,
          max_tokens: 1024,
          messages: [
            { role: 'system', content: buildSystemPrompt(ctx) },
            ...apiMessages,
          ],
        }),
      });

      const data  = await res.json();
      const reply = data?.choices?.[0]?.message?.content
        ?? 'Sorry, I could not get a response. Please try again.';

      setMessages(prev => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'assistant', content: reply, timestamp: new Date() },
      ]);
      scrollToBottom();
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'I am having trouble connecting. Please check your internet and try again.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingBottom: 104 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerAvatar}>
          <Ionicons name="heart" size={18} color={COLORS.onPrimary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Zuri Health</Text>
          <Text style={styles.headerSub}>Evidence-based health assistant</Text>
        </View>
        <View style={styles.onlineDot} />
      </View>

      {/* Active child banner */}
      {activeChild ? (
        <View style={styles.contextBanner}>
          <Ionicons
            name={activeChild.sex === 'female' ? 'female' : 'male'}
            size={13}
            color={COLORS.primary}
          />
          <Text style={styles.contextText}>
            {activeChild.full_name + ' · ' + getAgeMonths() + ' months'}
          </Text>
          {/* Show a subtle data-loaded indicator */}
          {growthRecords.length > 0 && (
            <Text style={styles.dataTag}>
              {'  ✓ growth · '}
            </Text>
          )}
          {vaccineRows.length > 0 && (
            <Text style={styles.dataTag}>
              {'vaccines loaded'}
            </Text>
          )}
        </View>
      ) : null}

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={styles.messageList}
        contentContainerStyle={styles.messageContent}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={scrollToBottom}
      >
        {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
        {loading ? <TypingIndicator /> : null}
        <View style={{ height: 16 }} />
      </ScrollView>

      {/* Quick-suggestion chips */}
      <View style={styles.suggestionsBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.suggestionsRow}
        >
          {SUGGESTIONS.map(s => (
            <TouchableOpacity key={s} style={styles.chip} onPress={() => sendMessage(s)}>
              <Text style={styles.chipText}>{s}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Input row */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Ask a health question..."
          placeholderTextColor={COLORS.textMuted}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
          onPress={() => sendMessage()}
          disabled={!input.trim() || loading}
        >
          {loading
            ? <ActivityIndicator size="small" color={COLORS.onPrimary} />
            : <Ionicons name="send" size={18} color={COLORS.onPrimary} />}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: COLORS.background },
  header:          { backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14 },
  headerAvatar:    { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  headerTitle:     { fontSize: 16, fontWeight: '700', color: COLORS.onPrimary },
  headerSub:       { fontSize: 11, color: COLORS.primaryMid, marginTop: 1 },
  onlineDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.given },
  contextBanner:   { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: COLORS.primaryLight, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  contextText:     { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  dataTag:         { fontSize: 11, color: COLORS.given, fontWeight: '500' },
  messageList:     { flex: 1 },
  messageContent:  { paddingHorizontal: 16, paddingTop: 16 },
  suggestionsBar:  { backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border, paddingVertical: 8 },
  suggestionsRow:  { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  chip:            { paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.full, backgroundColor: COLORS.primaryLight, borderWidth: 1, borderColor: COLORS.border },
  chipText:        { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  inputRow:        { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border },
  input:           { flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.border, maxHeight: 100 },
  sendBtn:         { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: COLORS.primaryMid },
});

const bubble = StyleSheet.create({
  wrapper:         { marginBottom: 12 },
  userWrapper:     { alignItems: 'flex-end' },
  aiBubbleWrapper: { alignItems: 'flex-start', flexDirection: 'row', gap: 8 },
  avatar:          { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  bubble:          { maxWidth: '80%', borderRadius: RADIUS.lg, padding: 12 },
  userBubble:      { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  aiBubble:        { backgroundColor: COLORS.white, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: COLORS.border },
  text:            { fontSize: 14, lineHeight: 21 },
  userText:        { color: COLORS.onPrimary },
  aiText:          { color: COLORS.textPrimary },
  time:            { fontSize: 10, marginTop: 4 },
  userTime:        { color: COLORS.primaryMid, textAlign: 'right' },
  aiTime:          { color: COLORS.textMuted },
  dotRow:          { flexDirection: 'row', gap: 4, alignItems: 'center', paddingVertical: 4 },
  dot:             { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
});