// src/app/(tabs)/nutrition.tsx
// ZuriHealth — Nutrition Screen
// WHO Counselling Cards for EBF (0-6 months) | Meal Plan for CF (6+ months)

import React, {
  useState, useEffect, useRef, useCallback,
  Component, type ReactNode,
} from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, StyleSheet, Dimensions,
  KeyboardAvoidingView, Platform, Animated, Easing,
  RefreshControl, Linking,
} from 'react-native';
import { SvgXml } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, RADIUS } from '@/lib/theme';
import { useChildStore } from '@/store/childStore';
import { askGroq } from '@/lib/zscore';
import { useMealPlan, MealSlot, MealSlotType } from '@/hooks/useMealPlan';
import { useMealPlanStore, EnrichedFood } from '@/store/nutritionMealPlanStore';
import { AddFoodModal } from '@/components/nutrition/AddFoodModal';
import { useT } from '@/hooks/useT';

const { width: W } = Dimensions.get('window');
const MIN_SEND_MS = 2000;
const MAX_MSGS    = 60;
const TAB_OFFSET  = 90;

interface ChatMsg { role: 'assistant' | 'user'; content: string }

const SLOT_KEY: Record<MealSlotType, string> = {
  'Breakfast':       'slot_breakfast',
  'Morning snack':   'slot_morning_snack',
  'Lunch':           'slot_lunch',
  'Afternoon snack': 'slot_afternoon_snack',
  'Dinner':          'slot_dinner',
};

const MEAL_TIMES: Record<MealSlotType, string> = {
  'Breakfast':       '7:00 AM',
  'Morning snack':   '10:00 AM',
  'Lunch':           '12:30 PM',
  'Afternoon snack': '3:00 PM',
  'Dinner':          '6:00 PM',
};

const NUTRIENT_KEY: Record<string, string> = {
  'Iron': 'nutrient_iron', 'Vitamin A': 'nutrient_vitamin_a',
  'Vitamin C': 'nutrient_vitamin_c', 'Energy': 'nutrient_energy',
  'Omega-3': 'nutrient_omega3', 'Zinc': 'nutrient_zinc',
  'Calcium': 'nutrient_calcium', 'Protein': 'nutrient_protein', 'B12': 'nutrient_b12',
};

// ─── Slot colour palette ──────────────────────────────────────────────────────

const SLOT_PALETTE: Record<MealSlotType, {
  iconBg: string; accentBg: string; accentText: string;
}> = {
  'Breakfast':       { iconBg: '#FFF3DC', accentBg: '#FFF3DC', accentText: '#7A5200' },
  'Morning snack':   { iconBg: '#E6F9F1', accentBg: '#E6F9F1', accentText: '#005C33' },
  'Lunch':           { iconBg: '#E6F9F1', accentBg: '#E6F9F1', accentText: '#005C33' },
  'Afternoon snack': { iconBg: '#FDEEF5', accentBg: '#FDEEF5', accentText: '#8B1A54' },
  'Dinner':          { iconBg: '#EEF0FF', accentBg: '#EEF0FF', accentText: '#1E2580' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAgeMonths(dob: string): number {
  const b = new Date(dob); const n = new Date();
  let m = (n.getFullYear() - b.getFullYear()) * 12 + (n.getMonth() - b.getMonth());
  if (n.getDate() < b.getDate()) m--;
  return Math.max(0, m);
}

function wazBadge(waz: number | null) {
  if (waz == null) return { label: 'No data',    bg: COLORS.surface,       color: COLORS.textMuted, icon: 'help-circle-outline' as const };
  if (waz < -3)   return { label: 'SAM — refer', bg: COLORS.missedLight,   color: COLORS.missed,    icon: 'alert-circle'        as const };
  if (waz < -2)   return { label: 'MAM',          bg: COLORS.dueLight,     color: COLORS.due,       icon: 'warning'             as const };
  if (waz < -1)   return { label: 'Mild risk',    bg: COLORS.upcomingLight, color: COLORS.upcoming, icon: 'information-circle'  as const };
  return           { label: 'Normal',             bg: COLORS.givenLight,    color: COLORS.given,     icon: 'checkmark-circle'    as const };
}

function pickEmoji(name: string, group: string): string {
  const n = name.toLowerCase();
  if (n.includes('liver'))  return '\u{1FAC0}';
  if (n.includes('omena') || n.includes('dagaa')) return '\u{1F41F}';
  if (n.includes('tilapia') || n.includes('sato') || n.includes('fish')) return '\u{1F41F}';
  if (n.includes('chicken')) return '\u{1F357}';
  if (n.includes('egg'))     return '\u{1F95A}';
  if (n.includes('beef') || n.includes('goat') || n.includes('meat')) return '\u{1F969}';
  if (n.includes('ugali'))   return '\u{1F33D}';
  if (n.includes('uji') || n.includes('porridge') || n.includes('wimbi') || n.includes('millet')) return '\u{1F963}';
  if (n.includes('chapati')) return '\u{1FAD3}';
  if (n.includes('rice') || n.includes('wali')) return '\u{1F35A}';
  if (n.includes('bean') || n.includes('lentil') || n.includes('maharagwe') || n.includes('dengu')) return '\u{1FAD8}';
  if (n.includes('groundnut') || n.includes('peanut') || n.includes('karanga')) return '\u{1F95C}';
  if (n.includes('milk') || n.includes('maziwa') || n.includes('yoghurt')) return '\u{1F95B}';
  if (n.includes('avocado') || n.includes('parachichi')) return '\u{1F951}';
  if (n.includes('carrot') || n.includes('karoti'))   return '\u{1F955}';
  if (n.includes('pumpkin') || n.includes('butternut') || n.includes('boga')) return '\u{1F383}';
  if (n.includes('spinach') || n.includes('mchicha') || n.includes('kale') || n.includes('sukuma')) return '\u{1F96C}';
  if (n.includes('tomato') || n.includes('nyanya'))   return '\u{1F345}';
  if (n.includes('mango') || n.includes('embe'))      return '\u{1F96D}';
  if (n.includes('banana') || n.includes('ndizi'))    return '\u{1F34C}';
  if (n.includes('orange') || n.includes('chungwa'))  return '\u{1F34A}';
  if (n.includes('sweet potato') || n.includes('cassava') || n.includes('muhogo')) return '\u{1F360}';
  const g = group.toLowerCase();
  if (g.includes('fish') || g.includes('marine'))  return '\u{1F41F}';
  if (g.includes('egg'))   return '\u{1F95A}';
  if (g.includes('meat') || g.includes('offal') || g.includes('poultry')) return '\u{1F969}';
  if (g.includes('legume') || g.includes('bean'))  return '\u{1FAD8}';
  if (g.includes('dairy') || g.includes('milk'))   return '\u{1F95B}';
  if (g.includes('grain') || g.includes('cereal')) return '\u{1F33E}';
  if (g.includes('leafy') || g.includes('greens')) return '\u{1F96C}';
  if (g.includes('fruit'))  return '\u{1F34E}';
  if (g.includes('oil') || g.includes('fat'))      return '\u{1FAD9}';
  return '\u{1F37D}';
}

// ─── Error boundary ───────────────────────────────────────────────────────────

class NutritionErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) return (
      <View style={eb.container}>
        <Ionicons name="warning-outline" size={36} color={COLORS.missed} />
        <Text style={eb.title}>Something went wrong</Text>
        <Text style={eb.body}>Please close and reopen this screen.</Text>
        <TouchableOpacity style={eb.btn} onPress={() => this.setState({ hasError: false })}>
          <Text style={eb.btnText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
    return this.props.children;
  }
}
const eb = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  title:     { fontFamily: FONTS.bold, fontSize: 18, color: COLORS.textPrimary, textAlign: 'center' },
  body:      { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },
  btn:       { marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: RADIUS.full, backgroundColor: COLORS.primary },
  btnText:   { fontFamily: FONTS.semibold, fontSize: 14, color: COLORS.white },
});

// ─────────────────────────────────────────────────────────────────────────────
// EBF ILLUSTRATIONS (SVG)
// ─────────────────────────────────────────────────────────────────────────────

const EBF_SVG: string[] = [
  `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg">
    <circle cx="160" cy="20" r="90" fill="#DBEEFF" opacity="0.45"/>
    <circle cx="20" cy="130" r="80" fill="#C5DCFA" opacity="0.3"/>
    <ellipse cx="68" cy="56" rx="26" ry="26" fill="#D4956A"/>
    <path d="M20 148 Q32 92 68 80 Q104 92 116 148" fill="#208AEF"/>
    <path d="M28 122 Q16 140 28 156" fill="none" stroke="#208AEF" stroke-width="10" stroke-linecap="round"/>
    <path d="M108 122 Q122 138 108 156" fill="none" stroke="#208AEF" stroke-width="10" stroke-linecap="round"/>
    <ellipse cx="106" cy="100" rx="20" ry="17" fill="#F2C9A0"/>
    <circle cx="115" cy="90" r="11" fill="#E8B088"/>
  </svg>`,
  `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg">
    <circle cx="100" cy="78" r="64" fill="#E1F5EE" opacity="0.5"/>
    <path d="M100 34 L122 58 L122 96 Q122 116 100 130 Q78 116 78 96 L78 58 Z" fill="#1D9E75"/>
    <path d="M88 90 L97 102 L116 78" fill="none" stroke="white" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="30" cy="60" r="10" fill="#E24B4A" opacity="0.35"/>
    <circle cx="170" cy="44" r="8" fill="#E24B4A" opacity="0.25"/>
  </svg>`,
  `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg">
    <circle cx="140" cy="120" r="80" fill="#EDE7F6" opacity="0.4"/>
    <ellipse cx="100" cy="74" rx="64" ry="56" fill="#CE93D8" opacity="0.2"/>
    <ellipse cx="100" cy="74" rx="64" ry="56" fill="none" stroke="#9C27B0" stroke-width="2"/>
    <circle cx="108" cy="42" r="8" fill="#CE93D8"/>
    <circle cx="148" cy="60" r="7" fill="#BA68C8"/>
    <circle cx="152" cy="96" r="8" fill="#CE93D8"/>
    <circle cx="80" cy="118" r="8" fill="#CE93D8"/>
    <circle cx="46" cy="94" r="7" fill="#BA68C8"/>
    <text x="100" y="82" font-family="sans-serif" font-size="28" text-anchor="middle" fill="#9C27B0" opacity="0.8">&#129504;</text>
  </svg>`,
  `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg">
    <circle cx="22" cy="148" r="80" fill="#FFF3C4" opacity="0.55"/>
    <ellipse cx="100" cy="50" rx="22" ry="22" fill="#D4956A"/>
    <path d="M60 152 Q70 106 100 96 Q130 106 140 152" fill="#F9A825"/>
    <path d="M66 118 Q56 132 68 146" fill="none" stroke="#F9A825" stroke-width="10" stroke-linecap="round"/>
    <path d="M134 118 Q146 130 134 146" fill="none" stroke="#F9A825" stroke-width="10" stroke-linecap="round"/>
    <ellipse cx="100" cy="134" rx="28" ry="20" fill="#FFF3E0"/>
    <circle cx="86" cy="125" r="14" fill="#F2C9A0"/>
  </svg>`,
  `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg">
    <circle cx="100" cy="48" r="36" fill="#FFF8DC" opacity="0.7"/>
    <circle cx="100" cy="48" r="28" fill="#FFF3A0" opacity="0.85"/>
    <rect x="20" y="128" width="148" height="12" rx="6" fill="#7986CB"/>
    <rect x="18" y="140" width="154" height="24" rx="6" fill="#9FA8DA" opacity="0.4"/>
    <ellipse cx="54" cy="128" rx="30" ry="12" fill="#E8EAF6"/>
    <circle cx="54" cy="114" r="16" fill="#D4956A"/>
    <text x="82" y="112" font-family="sans-serif" font-size="13" font-weight="700" fill="#5C6BC0" opacity="0.8">z</text>
    <text x="102" y="94" font-family="sans-serif" font-size="18" font-weight="700" fill="#5C6BC0" opacity="0.6">z</text>
    <text x="126" y="72" font-family="sans-serif" font-size="24" font-weight="700" fill="#5C6BC0" opacity="0.35">z</text>
  </svg>`,
  `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg">
    <path d="M72 16 Q72 16 40 78 Q22 110 72 150 Q122 110 104 78 Q72 16 72 16Z" fill="#B2EBF2" stroke="#26C6DA" stroke-width="2"/>
    <line x1="54" y1="74" x2="90" y2="114" stroke="#00838F" stroke-width="4.5" stroke-linecap="round" opacity="0.75"/>
    <line x1="90" y1="74" x2="54" y2="114" stroke="#00838F" stroke-width="4.5" stroke-linecap="round" opacity="0.75"/>
    <path d="M138 38 Q138 38 114 76 Q102 98 138 118 Q174 98 162 76 Q138 38 138 38Z" fill="#FFF9C4" stroke="#F9A825" stroke-width="1.5"/>
    <path d="M128 78 L135 88 L152 68" fill="none" stroke="#E65100" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="42" y="150" font-family="sans-serif" font-size="12" font-weight="700" fill="#00695C">88% H2O</text>
  </svg>`,
  `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg">
    <line x1="22" y1="148" x2="188" y2="148" stroke="#BF360C" stroke-width="1.5" opacity="0.4"/>
    <line x1="22" y1="148" x2="22" y2="18" stroke="#BF360C" stroke-width="1.5" opacity="0.4"/>
    <rect x="30" y="118" width="22" height="30" rx="4" fill="#FFAB91"/>
    <rect x="60" y="96" width="22" height="52" rx="4" fill="#FF7043"/>
    <rect x="90" y="72" width="22" height="76" rx="4" fill="#F4511E"/>
    <rect x="120" y="48" width="22" height="100" rx="4" fill="#E64A19"/>
    <rect x="150" y="24" width="22" height="124" rx="4" fill="#BF360C"/>
    <path d="M41 120 L71 98 L101 74 L131 50 L161 26" fill="none" stroke="#FF5722" stroke-width="2.5" stroke-dasharray="5,3"/>
  </svg>`,
];

// ─────────────────────────────────────────────────────────────────────────────
// WHO COUNSELLING CARDS DATA
// ─────────────────────────────────────────────────────────────────────────────

const WHO_CARDS = [
  {
    accent: '#208AEF', bg: '#EEF6FF', cardLabel: 'CARD 1 OF 7',
    title: 'Breast milk is enough',
    keyMessage: 'For the first 6 months, give only breast milk — no water, juice, or other foods.',
    actions: [
      'Put baby to breast within 1 hour of birth',
      'Breastfeed on demand — at least 8–12 times daily',
      'Give no water, porridge, or formula during this period',
      'Continue even during illness or hot weather',
    ],
    source: 'WHO IYCF Guidelines 2023', illustIndex: 0,
  },
  {
    accent: '#1D9E75', bg: '#F0FBF4', cardLabel: 'CARD 2 OF 7',
    title: 'Breast milk protects your baby',
    keyMessage: 'Every feed passes antibodies that protect against diarrhoea, pneumonia, and infections.',
    actions: [
      'Give colostrum (first yellow milk) — never discard it',
      'Continue breastfeeding when baby is sick',
      'Breastfed babies need no extra vitamins in first 6 months',
      'Seek help immediately if baby refuses the breast',
    ],
    source: 'WHO/UNICEF IYCF Counselling Cards', illustIndex: 1,
  },
  {
    accent: '#7C3AED', bg: '#F3EEFF', cardLabel: 'CARD 3 OF 7',
    title: 'Breast milk builds the brain',
    keyMessage: 'The unique fats in breast milk fuel rapid brain and eye development in the first months.',
    actions: [
      'Breastfeed frequently to maintain milk supply',
      'Skin-to-skin contact supports brain development',
      'Talk and sing to your baby during feeds',
      'Avoid screens and distractions during feeding time',
    ],
    source: 'WHO Child Growth Standards 2006', illustIndex: 2,
  },
  {
    accent: '#E07B00', bg: '#FFF8ED', cardLabel: 'CARD 4 OF 7',
    title: 'Feed on demand — day and night',
    keyMessage: 'Feed whenever baby shows hunger cues — do not watch the clock.',
    actions: [
      'Watch for hunger cues: rooting, fists to mouth, fussing',
      'Offer both breasts at each feed',
      'Night feeds are essential — prolactin peaks at night',
      'Stop when baby releases the nipple or falls asleep',
    ],
    source: 'Kenya MoH MCH Handbook 2022', illustIndex: 3,
  },
  {
    accent: '#3949AB', bg: '#EEF0FB', cardLabel: 'CARD 5 OF 7',
    title: 'Night feeds build your supply',
    keyMessage: 'Prolactin — the milk-making hormone — peaks between midnight and 6 AM.',
    actions: [
      'Never skip night feeds in the first 6 months',
      'Room-sharing (not bed-sharing) makes night feeds easier',
      'Express milk if you must be separated at night',
      'Seek support if night feeding feels exhausting',
    ],
    source: 'WHO IYCF Guidelines 2023', illustIndex: 4,
  },
  {
    accent: '#00838F', bg: '#E0F7FA', cardLabel: 'CARD 6 OF 7',
    title: 'No water needed before 6 months',
    keyMessage: 'Breast milk is 88% water. Extra water can cause illness and reduce milk intake.',
    actions: [
      'Give NO water — even in hot weather or during fever',
      'Give NO herbal teas, gripe water, or thin porridge',
      'Extra feeds = extra water for baby',
      'Water before 6 months increases risk of diarrhoea',
    ],
    source: 'WHO/UNICEF IYCF Counselling Cards', illustIndex: 5,
  },
  {
    accent: '#BF360C', bg: '#FEF0ED', cardLabel: 'CARD 7 OF 7',
    title: "Monitor your baby's growth",
    keyMessage: 'A well-fed baby gains ~150–200g per week and has 6+ wet nappies daily.',
    actions: [
      'Visit MCH clinic monthly for weight monitoring',
      'Bring the Child Health Card to every visit',
      'Baby should regain birth weight by 2 weeks',
      'Seek help if weight is not increasing week on week',
    ],
    source: 'Kenya KEPI Schedule · WHO Growth Standards 2006', illustIndex: 6,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// WHO COUNSELLING CAROUSEL
// ─────────────────────────────────────────────────────────────────────────────

const EbfCarousel: React.FC<{ ageMonths: number }> = ({ ageMonths }) => {
  const [active, setActive] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopTimer  = () => { if (timerRef.current) clearInterval(timerRef.current); };
  const startTimer = useCallback(() => {
    stopTimer();
    timerRef.current = setInterval(() => {
      setActive(prev => {
        const next = (prev + 1) % WHO_CARDS.length;
        scrollRef.current?.scrollTo({ x: next * (W - 32), animated: true });
        return next;
      });
    }, 6000);
  }, []);
  useEffect(() => { startTimer(); return () => stopTimer(); }, []);

  const card = WHO_CARDS[active];

  return (
    <View>
      <View style={ec.headerRow}>
        <View style={ec.headerLeft}>
          <Text style={ec.headerTitle}>WHO Counselling Cards</Text>
          <Text style={ec.headerSub}>Exclusive Breastfeeding · 0–6 months</Text>
        </View>
        <View style={[ec.cardCounter, { backgroundColor: card.accent + '22' }]}>
          <Text style={[ec.cardCounterText, { color: card.accent }]}>{active + 1}/{WHO_CARDS.length}</Text>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled={false}
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={W - 32}
        snapToAlignment="start"
        onScrollBeginDrag={stopTimer}
        onMomentumScrollEnd={e => {
          const i = Math.round(e.nativeEvent.contentOffset.x / (W - 32));
          setActive(i); startTimer();
        }}
        contentContainerStyle={{ gap: 12, paddingRight: 16 }}
      >
        {WHO_CARDS.map((wc, i) => (
          <View key={i} style={[ec.card, { width: W - 32, backgroundColor: wc.bg, borderColor: wc.accent + '33' }]}>
            <View style={[ec.cardLabelPill, { backgroundColor: wc.accent + '18' }]}>
              <View style={[ec.cardLabelDot, { backgroundColor: wc.accent }]} />
              <Text style={[ec.cardLabelText, { color: wc.accent }]}>{wc.cardLabel}</Text>
            </View>
            <View style={ec.topRow}>
              <View style={[ec.illustBox, { backgroundColor: wc.accent + '12' }]}>
                <SvgXml xml={EBF_SVG[wc.illustIndex]} width={110} height={88} />
              </View>
              <View style={ec.titleBlock}>
                <Text style={[ec.cardTitle, { color: wc.accent }]}>{wc.title}</Text>
                <Text style={ec.keyMessage}>{wc.keyMessage}</Text>
              </View>
            </View>
            <View style={[ec.divider, { backgroundColor: wc.accent + '22' }]} />
            <Text style={[ec.actionLabel, { color: wc.accent }]}>WHAT TO DO</Text>
            {wc.actions.map((action, ai) => (
              <View key={ai} style={ec.actionRow}>
                <View style={[ec.actionNum, { backgroundColor: wc.accent }]}>
                  <Text style={ec.actionNumText}>{ai + 1}</Text>
                </View>
                <Text style={ec.actionText}>{action}</Text>
              </View>
            ))}
            <View style={[ec.sourceBadge, { borderColor: wc.accent + '33' }]}>
              <Ionicons name="book-outline" size={10} color={wc.accent} />
              <Text style={[ec.sourceBadgeText, { color: wc.accent }]}>{wc.source}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={ec.dots}>
        {WHO_CARDS.map((wc, i) => (
          <TouchableOpacity
            key={i}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            onPress={() => {
              stopTimer();
              scrollRef.current?.scrollTo({ x: i * (W - 32), animated: true });
              setActive(i); startTimer();
            }}
          >
            <View style={[ec.dot, i === active
              ? { width: 24, backgroundColor: card.accent }
              : { width: 6, backgroundColor: COLORS.border }
            ]} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const ec = StyleSheet.create({
  headerRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  headerLeft:      { flex: 1 },
  headerTitle:     { fontFamily: FONTS.bold, fontSize: 15, color: COLORS.textPrimary, marginBottom: 2 },
  headerSub:       { fontFamily: FONTS.regular, fontSize: 11, color: COLORS.textMuted },
  cardCounter:     { paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.full },
  cardCounterText: { fontFamily: FONTS.bold, fontSize: 11 },
  card:            { borderRadius: 20, borderWidth: 1.5, padding: 18, overflow: 'hidden', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8 },
  cardLabelPill:   { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.full, marginBottom: 14 },
  cardLabelDot:    { width: 6, height: 6, borderRadius: 3 },
  cardLabelText:   { fontFamily: FONTS.semibold, fontSize: 9, letterSpacing: 0.9 },
  topRow:          { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 16 },
  illustBox:       { width: 110, height: 88, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  titleBlock:      { flex: 1, gap: 6 },
  cardTitle:       { fontFamily: FONTS.bold, fontSize: 16, lineHeight: 22 },
  keyMessage:      { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textSecondary, lineHeight: 18 },
  divider:         { height: 1, marginBottom: 12 },
  actionLabel:     { fontFamily: FONTS.semibold, fontSize: 9, letterSpacing: 1, marginBottom: 10 },
  actionRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  actionNum:       { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  actionNumText:   { fontFamily: FONTS.bold, fontSize: 10, color: '#fff' },
  actionText:      { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textPrimary, lineHeight: 18, flex: 1 },
  sourceBadge:     { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: 10, paddingVertical: 6, marginTop: 10 },
  sourceBadgeText: { fontFamily: FONTS.semibold, fontSize: 9, flex: 1 },
  dots:            { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 16, marginBottom: 8 },
  dot:             { height: 6, borderRadius: 3 },
});

// ─────────────────────────────────────────────────────────────────────────────
// RESPONSIVE FEEDING TIPS
// ─────────────────────────────────────────────────────────────────────────────

const RF_TIPS = [
  { emoji: '👁️', title: 'Watch for hunger cues',         body: 'Feed when your child opens their mouth, reaches for food, or gets excited at mealtimes. Stop when they turn away or close their mouth.', accent: '#2196F3', bg: '#E8F4FD' },
  { emoji: '😊', title: 'Make mealtimes positive',       body: 'Sit together, minimise distractions, and talk to your child during meals. Avoid force-feeding — it reduces appetite over time.', accent: '#43A047', bg: '#E8F5E9' },
  { emoji: '🕐', title: 'Consistent meal schedule',      body: 'Aim for regular meal times each day. Predictable routines help children build appetite rhythms and eat better overall.', accent: '#8E24AA', bg: '#F3E5F5' },
  { emoji: '🍽️', title: 'Offer variety, accept refusal', body: 'Offer new foods 8–10 times before concluding a child dislikes them. Rejection is normal — keep offering alongside familiar foods.', accent: '#F9A825', bg: '#FFFDE7' },
  { emoji: '👨‍👩‍👧', title: 'Eat together as a family',  body: 'Children learn to eat by watching others. Eating the same foods as the family encourages acceptance and reduces fussiness.', accent: '#3949AB', bg: '#E8EAF6' },
  { emoji: '✋', title: 'Let the child self-feed',        body: 'From 9 months, encourage finger foods and self-feeding. Messy eating is normal and builds independence and motor skills.', accent: '#00838F', bg: '#E0F7FA' },
];

const RfTipCard: React.FC<{ tip: typeof RF_TIPS[0]; index: number }> = ({ tip, index }) => {
  const fade  = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(20)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,  { toValue: 1, duration: 350, delay: index * 80, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 350, delay: index * 80, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>
      <View style={[rfc.card, { borderLeftColor: tip.accent }]}>
        <View style={[rfc.iconCircle, { backgroundColor: tip.bg }]}>
          <Text style={rfc.iconEmoji}>{tip.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={rfc.titleRow}>
            <View style={[rfc.dot, { backgroundColor: tip.accent }]} />
            <Text style={rfc.title}>{tip.title}</Text>
          </View>
          <Text style={rfc.body}>{tip.body}</Text>
        </View>
      </View>
    </Animated.View>
  );
};

const rfc = StyleSheet.create({
  card:       { flexDirection: 'row', alignItems: 'flex-start', gap: 14, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, borderLeftWidth: 4, padding: 16, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
  iconCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  iconEmoji:  { fontSize: 22 },
  titleRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 },
  dot:        { width: 6, height: 6, borderRadius: 3 },
  title:      { fontFamily: FONTS.bold, fontSize: 14, color: COLORS.textPrimary, flex: 1 },
  body:       { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textSecondary, lineHeight: 20 },
});

// ─────────────────────────────────────────────────────────────────────────────
// MEAL PLAN COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

// ── Plan Summary Banner ───────────────────────────────────────────────────────

const PlanSummaryBanner: React.FC<{ plan: import('@/hooks/useMealPlan').GeneratedMealPlan }> = ({ plan }) => {
  const t = useT();
  const totalKcal = plan.slots
    .flatMap(s => [s.primaryFood, s.secondFood, s.thirdFood])
    .filter(Boolean)
    .reduce((sum, f) => sum + (f!.energy_kcal ?? 0), 0);
  const uniqueGroups = new Set(
    plan.slots.flatMap(s => [s.primaryFood, s.secondFood, s.thirdFood])
      .filter(Boolean).map(f => f!.who_group)
  ).size;
  return (
    <View style={mb.summaryCard}>
      <View style={mb.summaryRow}>
        {[
          { val: totalKcal > 0 ? `~${Math.round(totalKcal)}` : '—', label: 'kcal total' },
          { val: `${uniqueGroups}/8`, label: 'food groups' },
          { val: plan.textureLabel?.split(' ')[0] ?? '—', label: t('texture') },
        ].map((stat, i, arr) => (
          <React.Fragment key={i}>
            <View style={mb.statCol}>
              <Text style={mb.statVal}>{stat.val}</Text>
              <Text style={mb.statLabel}>{stat.label}</Text>
            </View>
            {i < arr.length - 1 && <View style={mb.statSep} />}
          </React.Fragment>
        ))}
      </View>
      <View style={mb.energyRow}>
        <Ionicons name="flash" size={12} color={COLORS.primary} />
        <Text style={mb.energyText}>{t('energy_target')}: {plan.energyTarget}</Text>
      </View>
    </View>
  );
};

const mb = StyleSheet.create({
  summaryCard: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, padding: 14, marginBottom: 12, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
  summaryRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginBottom: 10 },
  statCol:     { alignItems: 'center', flex: 1 },
  statVal:     { fontFamily: FONTS.bold, fontSize: 20, color: COLORS.textPrimary },
  statLabel:   { fontFamily: FONTS.regular, fontSize: 10, color: COLORS.textMuted, marginTop: 2 },
  statSep:     { width: 1, height: 32, backgroundColor: COLORS.border },
  energyRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md, paddingHorizontal: 10, paddingVertical: 7 },
  energyText:  { fontFamily: FONTS.semibold, fontSize: 11, color: COLORS.primary, flex: 1 },
});

// ── Meal Card ─────────────────────────────────────────────────────────────────

interface MealCardProps {
  slot: MealSlot;
  index: number;
  onSwap: (slot: MealSlot) => void;
}

const MealCard = React.memo(({ slot, index, onSwap }: MealCardProps) => {
  const t      = useT();
  const fade   = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(16)).current;
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,   { toValue: 1, duration: 300, delay: index * 65, useNativeDriver: true }),
      Animated.timing(slideY, { toValue: 0, duration: 300, delay: index * 65, useNativeDriver: true }),
    ]).start();
  }, []);

  const palette = SLOT_PALETTE[slot.type];
  const emoji   = pickEmoji(slot.primaryFood.food_name, slot.primaryFood.who_group);
  const foods   = [slot.primaryFood, slot.secondFood, slot.thirdFood].filter(Boolean) as EnrichedFood[];
  const isSnack = slot.isSnack;

  return (
    <Animated.View style={{ opacity: fade, transform: [{ translateY: slideY }] }}>
      <View style={mc.card}>

        {/* ── Header ── */}
        <TouchableOpacity
          style={mc.header}
          onPress={() => setExpanded(e => !e)}
          activeOpacity={0.8}
        >
          <View style={[mc.iconBox, { backgroundColor: palette.iconBg }]}>
            <Text style={mc.iconEmoji}>{emoji}</Text>
          </View>

          <View style={mc.titleBlock}>
            <Text style={mc.slotLabel}>
              {t(SLOT_KEY[slot.type])} · {MEAL_TIMES[slot.type]}
            </Text>
            <Text style={mc.mealName} numberOfLines={2}>{slot.mealName}</Text>
          </View>

          <View style={mc.rightCol}>
            <View style={[mc.badge, { backgroundColor: palette.accentBg }]}>
              <Text style={[mc.badgeText, { color: palette.accentText }]}>
                {isSnack ? 'Snack' : 'Meal'}
              </Text>
            </View>
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={15}
              color={COLORS.textMuted}
              style={{ marginTop: 4 }}
            />
          </View>
        </TouchableOpacity>

        {/* ── Divider ── */}
        <View style={mc.divider} />

        {/* ── Footer ── */}
        <View style={mc.footer}>
          <View style={mc.pillRow}>
            {foods.map(f => (
              <View key={f.food_id} style={mc.foodPill}>
                <Text style={mc.foodPillText}>{f.local_name ?? f.food_name}</Text>
              </View>
            ))}
          </View>

          {expanded && (
            <>
              {slot.nutrients.length > 0 && (
                <View style={mc.pillRow}>
                  {slot.nutrients.map(tag => (
                    <View key={tag} style={[mc.nutrientPill, { backgroundColor: palette.accentBg }]}>
                      <Text style={[mc.nutrientPillText, { color: palette.accentText }]}>
                        {t(NUTRIENT_KEY[tag] ?? tag)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {!!slot.synergyNote && (
                <View style={mc.synergyBox}>
                  <Ionicons name="flash" size={12} color={COLORS.primary} />
                  <Text style={mc.synergyText}>
                    <Text style={{ fontFamily: FONTS.semibold }}>Synergy: </Text>
                    {slot.synergyNote}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={mc.swapBtn}
                onPress={() => onSwap(slot)}
                activeOpacity={0.7}
              >
                <Ionicons name="shuffle-outline" size={13} color={COLORS.textSecondary} />
                <Text style={mc.swapText}>Try different foods</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Animated.View>
  );
});

MealCard.displayName = 'MealCard';

const mc = StyleSheet.create({
  card:            { backgroundColor: '#FFFFFF', borderRadius: 20, marginBottom: 10, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  header:          { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, paddingBottom: 12 },
  iconBox:         { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  iconEmoji:       { fontSize: 24, lineHeight: 30 },
  titleBlock:      { flex: 1, gap: 2 },
  slotLabel:       { fontFamily: FONTS.regular, fontSize: 10, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  mealName:        { fontFamily: FONTS.semibold, fontSize: 14, color: COLORS.textPrimary, lineHeight: 19 },
  rightCol:        { alignItems: 'flex-end', gap: 2, flexShrink: 0 },
  badge:           { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 99 },
  badgeText:       { fontFamily: FONTS.semibold, fontSize: 10 },
  divider:         { height: 1, backgroundColor: '#F0F0F0', marginHorizontal: 14 },
  footer:          { padding: 10, paddingHorizontal: 14, paddingBottom: 13, gap: 8 },
  pillRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  foodPill:        { backgroundColor: '#F4F4F4', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5 },
  foodPillText:    { fontFamily: FONTS.semibold, fontSize: 11, color: '#444444' },
  nutrientPill:    { borderRadius: 99, paddingHorizontal: 9, paddingVertical: 4 },
  nutrientPillText:{ fontFamily: FONTS.semibold, fontSize: 10 },
  synergyBox:      { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md, padding: 10 },
  synergyText:     { fontFamily: FONTS.regular, fontSize: 11, color: COLORS.primary, flex: 1, lineHeight: 16 },
  swapBtn:         { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F4F4F4', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, alignSelf: 'flex-start' },
  swapText:        { fontFamily: FONTS.semibold, fontSize: 11, color: COLORS.textSecondary },
});

// ─────────────────────────────────────────────────────────────────────────────
// REFERRAL CARD
// ─────────────────────────────────────────────────────────────────────────────

const ReferralCard: React.FC<{
  severity: string; reason: string; childName: string;
  waz: number | null; haz: number | null; whz: number | null;
}> = ({ severity, reason, childName, waz, haz, whz }) => {
  const isCritical = severity === 'critical';
  const bg     = isCritical ? COLORS.missedLight : COLORS.dueLight;
  const accent = isCritical ? COLORS.missed      : COLORS.due;
  return (
    <View style={[rc.card, { backgroundColor: bg, borderColor: accent + '55' }]}>
      <View style={rc.header}>
        <View style={[rc.iconWrap, { backgroundColor: accent + '22' }]}>
          <Ionicons name={isCritical ? 'alert-circle' : 'warning'} size={18} color={accent} />
        </View>
        <Text style={[rc.title, { color: accent }]}>
          {isCritical ? '🚨 Urgent Referral Required' : '⚠️ Referral Recommended'}
        </Text>
      </View>
      <Text style={[rc.reason, { color: accent }]}>{reason}</Text>
      <View style={rc.chips}>
        {waz != null && <View style={[rc.chip, { borderColor: accent + '44' }]}><Text style={[rc.chipLabel, { color: accent }]}>WAZ</Text><Text style={[rc.chipVal, { color: accent }]}>{waz.toFixed(1)}</Text></View>}
        {haz != null && <View style={[rc.chip, { borderColor: accent + '44' }]}><Text style={[rc.chipLabel, { color: accent }]}>HAZ</Text><Text style={[rc.chipVal, { color: accent }]}>{haz.toFixed(1)}</Text></View>}
        {whz != null && <View style={[rc.chip, { borderColor: accent + '44' }]}><Text style={[rc.chipLabel, { color: accent }]}>WHZ</Text><Text style={[rc.chipVal, { color: accent }]}>{whz.toFixed(1)}</Text></View>}
      </View>
      <TouchableOpacity style={[rc.btn, { backgroundColor: accent }]} onPress={() => Linking.openURL('tel:0800723253')} activeOpacity={0.8}>
        <Ionicons name="call-outline" size={14} color="#fff" />
        <Text style={rc.btnText}>{isCritical ? 'Call Kenya Health Hotline' : 'Book MCH Appointment'}</Text>
      </TouchableOpacity>
      <Text style={[rc.source, { color: accent + 'AA' }]}>WHO/UNICEF SAM Protocol 2023 · Kenya MoH IMAM Guidelines</Text>
    </View>
  );
};

const rc = StyleSheet.create({
  card:     { borderRadius: RADIUS.lg, borderWidth: 1.5, padding: 16, marginBottom: 14, gap: 10 },
  header:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title:    { fontFamily: FONTS.bold, fontSize: 14, flex: 1, lineHeight: 19 },
  reason:   { fontFamily: FONTS.regular, fontSize: 13, lineHeight: 19 },
  chips:    { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip:     { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center', minWidth: 52 },
  chipLabel:{ fontFamily: FONTS.regular, fontSize: 9, letterSpacing: 0.5 },
  chipVal:  { fontFamily: FONTS.bold, fontSize: 17 },
  btn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: RADIUS.lg },
  btnText:  { fontFamily: FONTS.semibold, fontSize: 13, color: '#fff' },
  source:   { fontFamily: FONTS.regular, fontSize: 10, textAlign: 'center' },
});

// ─────────────────────────────────────────────────────────────────────────────
// CHAT — Typing dots + Bubble
// ─────────────────────────────────────────────────────────────────────────────

function TypingDots() {
  const d0 = useRef(new Animated.Value(0.3)).current;
  const d1 = useRef(new Animated.Value(0.3)).current;
  const d2 = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const anim = (dot: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.timing(dot, { toValue: 1,   duration: 350, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(dot, { toValue: 0.3, duration: 350, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])).start();
    anim(d0, 0); anim(d1, 150); anim(d2, 300);
  }, []);
  return (
    <View style={ch.aiRow}>
      <View style={ch.avatarCircle}><Text style={ch.avatarText}>Z</Text></View>
      <View style={ch.aiCard}>
        <View style={{ flexDirection: 'row', gap: 5, alignItems: 'center', paddingVertical: 2 }}>
          {[d0, d1, d2].map((d, i) => (
            <Animated.View key={i} style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: COLORS.primary, opacity: d }} />
          ))}
        </View>
      </View>
    </View>
  );
}

function parseZuriMsg(content: string) {
  const lines = content.split('\n').map((l: string) => l.trim()).filter(Boolean);
  const bullets: string[] = [];
  const answerLines: string[] = [];
  let source: string | null = null;
  for (const line of lines) {
    if (/^(Source:|📚)/i.test(line)) { source = line.replace(/^(Source:|📚)\s*/i, '').trim(); continue; }
    if (/^[-*•]\s+/.test(line) || /^\d+\.\s+/.test(line)) { bullets.push(line.replace(/^[-*•\d.]\s+/, '').trim()); continue; }
    answerLines.push(line);
  }
  return { text: answerLines.join(' ').trim(), bullets, source };
}

function ChatBubble({ msg }: { msg: ChatMsg }) {
  if (msg.role === 'user') return (
    <View style={ch.userRow}>
      <View style={ch.userBubble}><Text style={ch.userText}>{msg.content}</Text></View>
    </View>
  );
  const { text, bullets, source } = parseZuriMsg(msg.content);
  return (
    <View style={ch.aiRow}>
      <View style={ch.avatarCircle}><Text style={ch.avatarText}>Z</Text></View>
      <View style={ch.aiCard}>
        <Text style={ch.aiName}>Zuri · ZuriHealth</Text>
        {!!text && <Text style={ch.aiText}>{text}</Text>}
        {bullets.length > 0 && (
          <View style={ch.bulletsBox}>
            <Text style={ch.bulletsLabel}>WHAT TO DO</Text>
            {bullets.map((b: string, i: number) => (
              <View key={i} style={ch.bulletRow}>
                <View style={ch.bulletNum}><Text style={ch.bulletNumText}>{i + 1}</Text></View>
                <Text style={ch.bulletText}>{b}</Text>
              </View>
            ))}
          </View>
        )}
        {!!source && (
          <View style={ch.sourceBadge}>
            <Ionicons name="book-outline" size={10} color={COLORS.primary} />
            <Text style={ch.sourceText}>{source}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const ch = StyleSheet.create({
  userRow:       { alignItems: 'flex-end', marginBottom: 14 },
  userBubble:    { maxWidth: '78%', backgroundColor: COLORS.primary, borderRadius: 18, borderBottomRightRadius: 5, paddingHorizontal: 16, paddingVertical: 12, elevation: 3, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.22, shadowRadius: 5 },
  userText:      { fontFamily: FONTS.regular, fontSize: 14, lineHeight: 21, color: COLORS.white },
  aiRow:         { flexDirection: 'row', alignItems: 'flex-end', gap: 9, marginBottom: 14 },
  avatarCircle:  { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', flexShrink: 0, elevation: 2 },
  avatarText:    { fontFamily: FONTS.bold, fontSize: 13, color: COLORS.white },
  aiCard:        { maxWidth: '80%', backgroundColor: COLORS.white, borderRadius: 18, borderBottomLeftRadius: 5, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: COLORS.border, elevation: 1, gap: 7 },
  aiName:        { fontFamily: FONTS.semibold, fontSize: 9, color: COLORS.primary, letterSpacing: 0.5, marginBottom: 1 },
  aiText:        { fontFamily: FONTS.regular, fontSize: 13, lineHeight: 20, color: COLORS.textPrimary },
  bulletsBox:    { backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md, padding: 10, gap: 6 },
  bulletsLabel:  { fontFamily: FONTS.semibold, fontSize: 8, color: COLORS.primary, letterSpacing: 0.9, marginBottom: 3 },
  bulletRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  bulletNum:     { width: 19, height: 19, borderRadius: 9.5, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  bulletNumText: { fontFamily: FONTS.bold, fontSize: 9, color: COLORS.white },
  bulletText:    { fontFamily: FONTS.regular, fontSize: 12, lineHeight: 18, color: COLORS.textPrimary, flex: 1 },
  sourceBadge:   { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md, paddingHorizontal: 9, paddingVertical: 5, borderWidth: 1, borderColor: COLORS.border },
  sourceText:    { fontFamily: FONTS.semibold, fontSize: 9, color: COLORS.primary, flex: 1 },
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────

export default function NutritionScreen() {
  const t      = useT();
  const insets = useSafeAreaInsets();

  const activeChild        = useChildStore(s => s.activeChild);
  const growthRecords      = useChildStore(s => s.growthRecords);
  const fetchGrowthRecords = useChildStore(s => s.fetchGrowthRecords);
  const latestGrowth       = growthRecords[0] ?? null;

  const childName = activeChild?.full_name ?? 'Child';
  const dob       = activeChild?.date_of_birth ?? '';
  const sex       = (activeChild?.sex ?? 'female') as 'male' | 'female';
  const sexLabel  = sex === 'male' ? 'boy' : 'girl';
  const ageMonths = dob ? getAgeMonths(dob) : 0;
  const waz       = latestGrowth?.waz ?? null;
  const haz       = latestGrowth?.haz ?? null;
  const whz       = latestGrowth?.whz ?? null;
  const zscores   = React.useMemo(() => ({ waz, haz, whz }), [waz, haz, whz]);
  const badge     = wazBadge(waz);
  const isEbf     = ageMonths < 6;

  useEffect(() => {
    if (activeChild?.id && growthRecords.length === 0) fetchGrowthRecords(activeChild.id);
  }, [activeChild?.id]);

  const { plan, isLoading: planLoading, error: planError, isUsingFallback, refresh: refreshPlan } =
    useMealPlan({ childName, sex, ageMonths, zscores, enabled: !isEbf });

  const storeFoods    = useMealPlanStore(s => s.foods);
  const buildFoodPool = useMealPlanStore(s => s.buildFoodPool);
  const poolFoods     = React.useMemo(() => {
    if (!storeFoods.length) return [] as EnrichedFood[];
    return buildFoodPool(ageMonths, zscores).all;
  }, [storeFoods, ageMonths, zscores]);

  const [swappedSlots, setSwappedSlots] = useState<Record<string, EnrichedFood>>({});
  const [showAddFood,  setShowAddFood]  = useState(false);

  const handleSwap = useCallback((slot: MealSlot) => {
    const same = poolFoods.filter(f =>
      f.who_group === slot.primaryFood.who_group &&
      f.food_id   !== slot.primaryFood.food_id &&
      f.food_id   !== (swappedSlots[slot.type]?.food_id ?? '')
    );
    if (!same.length) return;
    const pick = same[Math.floor(Math.random() * same.length)];
    setSwappedSlots(prev => ({ ...prev, [slot.type]: pick }));
  }, [poolFoods, swappedSlots]);

  const effectivePlan = React.useMemo(() => {
    if (!plan) return null;
    if (!Object.keys(swappedSlots).length) return plan;
    return {
      ...plan,
      slots: plan.slots.map(slot => {
        const override = swappedSlots[slot.type];
        if (!override) return slot;
        const parts = [override, slot.secondFood, slot.thirdFood].filter(Boolean).map(f => f!.local_name ?? f!.food_name);
        return { ...slot, primaryFood: override, mealName: parts.join(' with ') };
      }),
    };
  }, [plan, swappedSlots]);

  // ── Chat ────────────────────────────────────────────────────────────────────
  const makeGreeting = (ebf: boolean, name: string, age: number) =>
    ebf
      ? `Habari! I'm Zuri 🌿\n\n${name} is ${age} month${age !== 1 ? 's' : ''} old — breast milk alone is perfect right now. Ask me anything about breastfeeding.`
      : `Habari! I'm Zuri 🌿\n\nAsk me anything about ${name}'s feeding. I'll give advice grounded in WHO and Kenya MoH guidelines.`;

  const [messages,    setMessages]    = useState<ChatMsg[]>([{ role: 'assistant', content: makeGreeting(isEbf, childName, ageMonths) }]);
  const [chatInput,   setChatInput]   = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const lastSendRef   = useRef<number>(0);
  const chatScrollRef = useRef<ScrollView>(null);

  const TABS = isEbf
    ? [{ key: 'ebf', label: '🤱 Breastfeeding' }, { key: 'ask', label: '✦ Ask Zuri' }]
    : [{ key: 'plan', label: '🍽️ Meal Plan' }, { key: 'rf', label: '🌿 Feeding Tips' }, { key: 'ask', label: '✦ Ask Zuri' }];

  const [activeTab, setActiveTab] = useState(isEbf ? 'ebf' : 'plan');

  useEffect(() => {
    setMessages([{ role: 'assistant', content: makeGreeting(isEbf, childName, ageMonths) }]);
    setSwappedSlots({});
    setActiveTab(isEbf ? 'ebf' : 'plan');
    if (!isEbf) refreshPlan();
  }, [activeChild?.id]);

  const buildSysPrompt = useCallback(() => {
    const planFoods = effectivePlan?.slots
      .flatMap(s => [s.primaryFood, s.secondFood, s.thirdFood]).filter(Boolean)
      .map(f => f!.local_name ?? f!.food_name)
      .filter((v, i, a) => a.indexOf(v) === i).join(', ') ?? '';
    return `You are Zuri, Kenya MCH nutrition counsellor. Child: ${childName}, ${ageMonths}mo, ${sexLabel}, WAZ ${waz?.toFixed(1) ?? '-'}.${haz != null ? ` HAZ ${haz.toFixed(1)}.` : ''}
${plan ? `Today's meal plan foods: ${planFoods}.` : ''}
Answer in 2-3 sentences. Be direct, cite sources. Format: text, then bullet points if needed, then "Source: [name]".`;
  }, [childName, ageMonths, sexLabel, waz, haz, plan, effectivePlan]);

  const scrollToEnd = useCallback(() =>
    setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 80), []);

  const sendChat = useCallback(async (text?: string) => {
    const q = (text ?? chatInput).trim();
    if (!q || q.length < 2) return;
    const now = Date.now();
    if (now - lastSendRef.current < MIN_SEND_MS) return;
    lastSendRef.current = now;
    setChatInput('');
    setMessages(prev => {
      const next = [...prev, { role: 'user' as const, content: q }];
      return next.length > MAX_MSGS ? next.slice(-MAX_MSGS) : next;
    });
    setChatLoading(true);
    try {
      const hist = messages.slice(-4).map(m => `${m.role === 'user' ? 'Parent' : 'Zuri'}: ${m.content}`).join('\n');
      const reply = await askGroq(hist ? `${hist}\n\nNew question: ${q}` : q, buildSysPrompt(), 0.4);
      setMessages(prev => {
        const next = [...prev, { role: 'assistant' as const, content: reply }];
        return next.length > MAX_MSGS ? next.slice(-MAX_MSGS) : next;
      });
    } catch {
      setMessages(prev => [...prev, { role: 'assistant' as const, content: 'Sorry, could not connect. Please try again.' }]);
    }
    setChatLoading(false);
    scrollToEnd();
  }, [chatInput, messages, buildSysPrompt, scrollToEnd]);

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (!activeChild) return (
    <View style={scr.screen}>
      <View style={[scr.header, { paddingTop: insets.top + 16 }]}>
        <Text style={scr.headerTitle}>{t('meal_plan_title')}</Text>
      </View>
      <View style={scr.emptyState}>
        <View style={scr.emptyIconWrap}><Text style={{ fontSize: 36 }}>👶</Text></View>
        <Text style={scr.emptyTitle}>No child selected</Text>
        <Text style={scr.emptySub}>{t('no_children_hint')}</Text>
      </View>
    </View>
  );

  const isChatTab = activeTab === 'ask';

  return (
    <NutritionErrorBoundary>
      <KeyboardAvoidingView
        style={scr.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* ── HERO HEADER ── */}
        <View style={[scr.header, { paddingTop: insets.top + 16 }]}>
          <View style={scr.circle1} />
          <View style={scr.circle2} />
          <View style={scr.headerTopRow}>
            <View style={scr.headerIconCircle}>
              <Ionicons name="nutrition-outline" size={15} color={COLORS.white} />
            </View>
            <Text style={scr.headerTitle}>{t('meal_plan_title')}</Text>
            {!isEbf && (
              <TouchableOpacity style={scr.headerRefreshBtn} onPress={refreshPlan} disabled={planLoading}>
                <Ionicons name="refresh" size={15} color={planLoading ? 'rgba(255,255,255,0.4)' : COLORS.white} />
              </TouchableOpacity>
            )}
          </View>
          <View style={scr.childStrip}>
            <View style={scr.childAvatar}>
              <Ionicons name={sex === 'female' ? 'female' : 'male'} size={13} color={COLORS.primary} />
            </View>
            <Text style={scr.childStripName}>{childName} · {ageMonths}mo</Text>
            <View style={[scr.wazBadge, { backgroundColor: badge.bg }]}>
              <Ionicons name={badge.icon} size={11} color={badge.color} />
              <Text style={[scr.wazBadgeText, { color: badge.color }]}>{badge.label}</Text>
            </View>
          </View>
        </View>

        {/* ── TAB BAR ── */}
        <View style={scr.tabBar}>
          {TABS.map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[scr.tab, activeTab === tab.key && scr.tabActive]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.8}
            >
              <Text style={[scr.tabText, activeTab === tab.key && scr.tabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── EBF TAB — WHO Counselling Cards ── */}
        {isEbf && activeTab === 'ebf' && (
          <ScrollView
            style={scr.flex}
            contentContainerStyle={[scr.listContent, { paddingBottom: TAB_OFFSET + 24 }]}
            showsVerticalScrollIndicator={false}
          >
            <EbfCarousel ageMonths={ageMonths} />
          </ScrollView>
        )}

        {/* ── MEAL PLAN TAB ── */}
        {!isEbf && activeTab === 'plan' && (
          <View style={scr.flex}>
            <ScrollView
              style={scr.flex}
              contentContainerStyle={[scr.listContent, { paddingBottom: TAB_OFFSET + 80 }]}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={planLoading} onRefresh={refreshPlan} tintColor={COLORS.primary} />}
            >
              {planError && !isUsingFallback && (
                <View style={scr.softError}>
                  <Ionicons name="warning-outline" size={14} color={COLORS.due} />
                  <Text style={scr.softErrorText}>Could not load meal plan.</Text>
                  <TouchableOpacity onPress={refreshPlan}><Text style={scr.retryText}>Retry</Text></TouchableOpacity>
                </View>
              )}
              {planLoading && !effectivePlan && (
                <View style={scr.loadingWrap}>
                  <ActivityIndicator size="large" color={COLORS.primary} />
                  <Text style={scr.loadingTitle}>Building meal plan...</Text>
                  <Text style={scr.loadingText}>Selecting from your Kenya food database</Text>
                </View>
              )}
              {effectivePlan && (
                <>
                  {effectivePlan.requiresReferral && (
                    <ReferralCard
                      severity={effectivePlan.conditions.includes('malnutrition_sam') ? 'critical' : 'moderate'}
                      reason={effectivePlan.referralReason ?? ''}
                      childName={childName}
                      waz={waz} haz={haz} whz={whz}
                    />
                  )}
                  <PlanSummaryBanner plan={effectivePlan} />
                  {effectivePlan.slots.map((slot, i) => (
                    <MealCard key={slot.type} slot={slot} index={i} onSwap={handleSwap} />
                  ))}
                  <View style={scr.sourceCard}>
                    <Ionicons name="book-outline" size={11} color={COLORS.textMuted} />
                    <Text style={scr.sourceText}>WHO IYCF 2023 · Kenya MoH MIYCN 2023–2028 · Kenya Food Composition Tables</Text>
                  </View>
                </>
              )}
            </ScrollView>

            {/* ── Add local food FAB ── */}
            <TouchableOpacity
              style={scr.addFoodFab}
              onPress={() => setShowAddFood(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={18} color={COLORS.white} />
              <Text style={scr.addFoodFabLabel}>Add local food</Text>
            </TouchableOpacity>

            <AddFoodModal
              visible={showAddFood}
              onClose={() => setShowAddFood(false)}
              onSuccess={() => {
                useMealPlanStore.getState().refetchUserFoods();
                setShowAddFood(false);
              }}
            />
          </View>
        )}

        {/* ── RESPONSIVE FEEDING TIPS TAB ── */}
        {!isEbf && activeTab === 'rf' && (
          <ScrollView
            style={scr.flex}
            contentContainerStyle={[scr.listContent, { paddingBottom: TAB_OFFSET + 24 }]}
            showsVerticalScrollIndicator={false}
          >
            <View style={scr.rfHero}>
              <View style={scr.rfHeroInner}>
                <Text style={scr.rfHeroEmoji}>🍴</Text>
                <View style={{ flex: 1 }}>
                  <Text style={scr.rfHeroTitle}>Responsive Feeding</Text>
                  <Text style={scr.rfHeroSub}>6 evidence-based practices for healthy eating habits</Text>
                </View>
              </View>
            </View>
            {RF_TIPS.map((tip, i) => <RfTipCard key={i} tip={tip} index={i} />)}
            <View style={scr.sourceCard}>
              <Ionicons name="book-outline" size={11} color={COLORS.textMuted} />
              <Text style={scr.sourceText}>WHO Responsive Feeding Guidelines 2023 · Kenya MoH MIYCN 2023–2028</Text>
            </View>
          </ScrollView>
        )}

        {/* ── ASK ZURI CHAT TAB ── */}
        {isChatTab && (
          <View style={scr.flex}>
            <ScrollView
              ref={chatScrollRef}
              style={scr.flex}
              contentContainerStyle={scr.chatContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={scrollToEnd}
            >
              {messages.map((msg, i) => <ChatBubble key={i} msg={msg} />)}
              {chatLoading && <TypingDots />}
              <View style={{ height: 16 }} />
            </ScrollView>

            <View style={[scr.inputWrapper, { paddingBottom: TAB_OFFSET + 8 }]}>
              <View style={scr.inputBar}>
                <TextInput
                  style={scr.input}
                  value={chatInput}
                  onChangeText={setChatInput}
                  placeholder={isEbf ? 'Ask about breastfeeding...' : "Ask about feeding or today's plan..."}
                  placeholderTextColor={COLORS.textMuted}
                  multiline
                  maxLength={400}
                  returnKeyType="send"
                  onSubmitEditing={() => sendChat()}
                  blurOnSubmit={false}
                />
                <TouchableOpacity
                  style={[scr.sendBtn, (!chatInput.trim() || chatInput.trim().length < 2) && scr.sendBtnOff]}
                  onPress={() => sendChat()}
                  disabled={!chatInput.trim() || chatInput.trim().length < 2 || chatLoading}
                  activeOpacity={0.85}
                >
                  {chatLoading
                    ? <ActivityIndicator size="small" color={COLORS.white} />
                    : <Ionicons name="send" size={17} color={COLORS.white} />
                  }
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </NutritionErrorBoundary>
  );
}

// ─── Main screen styles ───────────────────────────────────────────────────────
const scr = StyleSheet.create({
  screen:           { flex: 1, backgroundColor: '#F2F4F7' },
  flex:             { flex: 1 },
  header:           { backgroundColor: COLORS.primary, paddingHorizontal: 18, paddingBottom: 20, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden', elevation: 8, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12, zIndex: 2 },
  circle1:          { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.07)', top: -60, right: -40 },
  circle2:          { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.05)', bottom: -30, right: 60 },
  headerTopRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  headerIconCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  headerTitle:      { fontFamily: FONTS.bold, fontSize: 22, color: COLORS.white, flex: 1 },
  headerRefreshBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  childStrip:       { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 7, alignSelf: 'flex-start' },
  childAvatar:      { width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
  childStripName:   { fontFamily: FONTS.semibold, fontSize: 12, color: COLORS.white },
  wazBadge:         { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  wazBadgeText:     { fontFamily: FONTS.semibold, fontSize: 10 },
  tabBar:           { flexDirection: 'row', backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingHorizontal: 16, paddingTop: 10, gap: 4 },
  tab:              { flex: 1, alignItems: 'center', paddingVertical: 10, borderBottomWidth: 2.5, borderBottomColor: 'transparent' },
  tabActive:        { borderBottomColor: COLORS.primary },
  tabText:          { fontFamily: FONTS.semibold, fontSize: 12, color: COLORS.textMuted },
  tabTextActive:    { color: COLORS.primary },
  listContent:      { padding: 16 },
  chatContent:      { padding: 16, gap: 2 },
  loadingWrap:      { alignItems: 'center', paddingVertical: 60, gap: 14 },
  loadingTitle:     { fontFamily: FONTS.bold, fontSize: 15, color: COLORS.textPrimary },
  loadingText:      { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textMuted, textAlign: 'center', lineHeight: 19 },
  softError:        { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.dueLight, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.due + '55', padding: 12, marginBottom: 12 },
  softErrorText:    { flex: 1, fontFamily: FONTS.regular, fontSize: 12, color: COLORS.due },
  retryText:        { fontFamily: FONTS.semibold, fontSize: 12, color: COLORS.due },
  sourceCard:       { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, padding: 11, marginTop: 4 },
  sourceText:       { fontFamily: FONTS.regular, fontSize: 10, color: COLORS.textMuted, flex: 1, lineHeight: 15 },
  emptyState:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 },
  emptyIconWrap:    { width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyTitle:       { fontFamily: FONTS.semibold, fontSize: 17, color: COLORS.textPrimary, textAlign: 'center' },
  emptySub:         { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },
  inputWrapper:     { backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 10, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.06, shadowRadius: 4 },
  inputBar:         { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 16, paddingBottom: 8 },
  input:            { flex: 1, backgroundColor: '#F2F4F7', borderRadius: RADIUS.lg, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: FONTS.regular, color: COLORS.textPrimary, borderWidth: 1.5, borderColor: COLORS.border, maxHeight: 100, minHeight: 44 },
  sendBtn:          { width: 46, height: 46, borderRadius: 15, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 },
  sendBtnOff:       { backgroundColor: COLORS.border, elevation: 0, shadowOpacity: 0 },
  addFoodFab:       { position: 'absolute', bottom: TAB_OFFSET + 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: COLORS.primary, borderRadius: RADIUS.full, paddingVertical: 11, paddingHorizontal: 18, elevation: 6, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 8, zIndex: 10 },
  addFoodFabLabel:  { fontFamily: FONTS.semibold, fontSize: 13, color: COLORS.white },
  rfHero:           { backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, padding: 18, marginBottom: 16, overflow: 'hidden' },
  rfHeroInner:      { flexDirection: 'row', alignItems: 'center', gap: 14 },
  rfHeroEmoji:      { fontSize: 40 },
  rfHeroTitle:      { fontFamily: FONTS.bold, fontSize: 18, color: COLORS.white, marginBottom: 3 },
  rfHeroSub:        { fontFamily: FONTS.regular, fontSize: 12, color: 'rgba(255,255,255,0.75)', lineHeight: 17 },
});