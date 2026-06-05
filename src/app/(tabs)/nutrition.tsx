import React, {
  useState, useEffect, useRef, useCallback,
  Component, type ReactNode,
} from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, StyleSheet, Dimensions,
  KeyboardAvoidingView, Platform, Animated, RefreshControl,
  Linking,
} from 'react-native';
import { SvgXml } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, RADIUS } from '@/lib/theme';
import { useChildStore } from '@/store/childStore';
import { useFeedingStage } from '@/hooks/useNutrition';
import { askGroq } from '@/lib/zscore';
import { useMealPlan, MealSlot, MealSlotType } from '@/hooks/useMealPlan';
import {
  useMealPlanStore,
  EnrichedFood,
} from '@/store/nutritionMealPlanStore';
import { useT } from '@/hooks/useT';

const { width: W } = Dimensions.get('window');
const MIN_SEND_INTERVAL_MS = 2000;
const MAX_CHAT_MESSAGES = 60;

interface ChatMsg { role: 'assistant' | 'user'; content: string }

const SLOT_KEY: Record<MealSlotType, string> = {
  'Breakfast':       'slot_breakfast',
  'Morning snack':   'slot_morning_snack',
  'Lunch':           'slot_lunch',
  'Afternoon snack': 'slot_afternoon_snack',
  'Dinner':          'slot_dinner',
};

const NUTRIENT_KEY: Record<string, string> = {
  'Iron':      'nutrient_iron',
  'Vitamin A': 'nutrient_vitamin_a',
  'Vitamin C': 'nutrient_vitamin_c',
  'Energy':    'nutrient_energy',
  'Omega-3':   'nutrient_omega3',
  'Zinc':      'nutrient_zinc',
  'Calcium':   'nutrient_calcium',
  'Protein':   'nutrient_protein',
  'B12':       'nutrient_b12',
};

class NutritionErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
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

function getAgeMonths(dob: string): number {
  const b = new Date(dob);
  const n = new Date();
  let m = (n.getFullYear() - b.getFullYear()) * 12 + (n.getMonth() - b.getMonth());
  if (n.getDate() < b.getDate()) m--;
  return Math.max(0, m);
}

function wazBadge(waz: number | null) {
  if (waz == null)
    return { label: 'No data',     bg: COLORS.surface,       color: COLORS.textMuted, icon: 'help-circle-outline' as const };
  if (waz < -3)
    return { label: 'SAM — refer', bg: COLORS.missedLight,   color: COLORS.missed,    icon: 'alert-circle' as const };
  if (waz < -2)
    return { label: 'MAM',         bg: COLORS.dueLight,      color: COLORS.due,       icon: 'warning' as const };
  if (waz < -1)
    return { label: 'Mild risk',   bg: COLORS.upcomingLight, color: COLORS.upcoming,  icon: 'information-circle' as const };
  return   { label: 'Normal',      bg: COLORS.givenLight,    color: COLORS.given,     icon: 'checkmark-circle' as const };
}

function tagStyle(tag: string): { bg: string; color: string } {
  const l = tag.toLowerCase();
  if (l.includes('iron') || l.includes('zinc') || l.includes('vitamin c'))
    return { bg: COLORS.givenLight, color: COLORS.given };
  if (l.includes('vitamin a') || l.includes('energy') || l.includes('omega'))
    return { bg: COLORS.upcomingLight, color: COLORS.upcoming };
  if (l.includes('protein') || l.includes('b12'))
    return { bg: COLORS.dueLight, color: COLORS.due };
  if (l.includes('calcium') || l.includes('fibre'))
    return { bg: COLORS.primaryLight, color: COLORS.primary };
  return { bg: COLORS.surface, color: COLORS.textSecondary };
}

function pickEmoji(foodName: string, whoGroup: string, foodId?: string): string {
  const n = foodName.toLowerCase();
  if (n.includes('liver'))                                       return '🫀';
  if (n.includes('kidney')||n.includes('tripe')||n.includes('gizzard')||n.includes('matumbo')) return '🥩';
  if (n.includes('omena')||n.includes('dagaa'))                  return '🐟';
  if (n.includes('tilapia')||n.includes('sato'))                 return '🐟';
  if (n.includes('sardine')||n.includes('tuna')||n.includes('salmon')||n.includes('mackerel')) return '🐟';
  if (n.includes('fish'))                                        return '🐟';
  if (n.includes('prawn')||n.includes('shrimp')||n.includes('kamba')) return '🦐';
  if (n.includes('crab')||n.includes('kaa'))                     return '🦀';
  if (n.includes('chicken'))                                     return '🍗';
  if (n.includes('egg'))                                         return '🥚';
  if (n.includes('beef')||n.includes('goat')||n.includes('lamb')||n.includes('meat')) return '🥩';
  if (n.includes('ugali'))                                       return '🌽';
  if (n.includes('uji')||n.includes('porridge')||n.includes('wimbi')||n.includes('millet')) return '🥣';
  if (n.includes('chapati'))                                     return '🫓';
  if (n.includes('bread'))                                       return '🍞';
  if (n.includes('rice'))                                        return '🍚';
  if (n.includes('pasta')||n.includes('noodle'))                 return '🍝';
  if (n.includes('maize')||n.includes('corn')||n.includes('posho')) return '🌽';
  if (n.includes('oat'))                                         return '🥣';
  if (n.includes('cassava')||n.includes('muhogo'))               return '🍠';
  if (n.includes('sweet potato'))                                return '🍠';
  if (n.includes('potato'))                                      return '🥔';
  if (n.includes('yam')||n.includes('arrowroot')||n.includes('nduma')) return '🍠';
  if (n.includes('plantain')||n.includes('matoke'))              return '🍌';
  if (n.includes('bean')||n.includes('lentil')||n.includes('maharagwe')||n.includes('dengu')) return '🫘';
  if (n.includes('pea')||n.includes('chickpea'))                 return '🫘';
  if (n.includes('groundnut')||n.includes('peanut')||n.includes('karanga')) return '🥜';
  if (n.includes('cashew')||n.includes('nut'))                   return '🥜';
  if (n.includes('milk')||n.includes('maziwa')||n.includes('yoghurt')||n.includes('mursik')) return '🥛';
  if (n.includes('cheese'))                                      return '🧀';
  if (n.includes('butter')||n.includes('ghee')||n.includes('margarine')) return '🧈';
  if (n.includes('oil')||n.includes('mafuta'))                   return '🫙';
  if (n.includes('avocado')||n.includes('parachichi'))           return '🥑';
  if (n.includes('tomato')||n.includes('nyanya'))                return '🍅';
  if (n.includes('carrot')||n.includes('karoti'))                return '🥕';
  if (n.includes('pumpkin')||n.includes('butternut'))            return '🎃';
  if (n.includes('spinach')||n.includes('mchicha')||n.includes('kale')||n.includes('sukuma')) return '🥬';
  if (n.includes('moringa'))                                     return '🌿';
  if (n.includes('cabbage'))                                     return '🥬';
  if (n.includes('broccoli'))                                    return '🥦';
  if (n.includes('mushroom')||n.includes('uyoga'))               return '🍄';
  if (n.includes('eggplant')||n.includes('brinjal'))             return '🍆';
  if (n.includes('pepper')||n.includes('hoho'))                  return '🫑';
  if (n.includes('onion')||n.includes('kitunguu')||n.includes('garlic')) return '🧅';
  if (n.includes('mango')||n.includes('embe'))                   return '🥭';
  if (n.includes('banana')||n.includes('ndizi'))                 return '🍌';
  if (n.includes('orange')||n.includes('chungwa'))               return '🍊';
  if (n.includes('lemon')||n.includes('lime')||n.includes('ndimu')) return '🍋';
  if (n.includes('papaya')||n.includes('pawpaw'))                return '🍈';
  if (n.includes('pineapple')||n.includes('nanasi'))             return '🍍';
  if (n.includes('coconut')||n.includes('nazi'))                 return '🥥';
  if (n.includes('watermelon')||n.includes('tikiti'))            return '🍉';
  if (n.includes('apple'))                                       return '🍎';
  if (n.includes('honey')||n.includes('asali'))                  return '🍯';
  if (n.includes('water')||n.includes('maji'))                   return '💧';
  if (n.includes('tea')||n.includes('chai'))                     return '🍵';
  if (n.includes('coffee')||n.includes('kahawa'))                return '☕';
  if (n.includes('juice'))                                       return '🥤';
  if (n.includes('salt')||n.includes('chumvi'))                  return '🧂';
  if (n.includes('infant')||n.includes('formula')||n.includes('cerelac')) return '🍼';
  if (n.includes('rutf')||n.includes('plumpy'))                  return '🏥';
  const g = whoGroup.toLowerCase();
  if (g.includes('fish')||g.includes('marine'))                  return '🐟';
  if (g.includes('poultry'))                                     return '🍗';
  if (g.includes('egg'))                                         return '🥚';
  if (g.includes('meat')||g.includes('offal'))                   return '🥩';
  if (g.includes('legume')||g.includes('bean'))                  return '🫘';
  if (g.includes('dairy')||g.includes('milk'))                   return '🥛';
  if (g.includes('grain')||g.includes('cereal'))                 return '🌾';
  if (g.includes('root')||g.includes('tuber'))                   return '🍠';
  if (g.includes('leafy')||g.includes('greens'))                 return '🥬';
  if (g.includes('vegetable'))                                   return '🥦';
  if (g.includes('fruit'))                                       return '🍎';
  if (g.includes('oil')||g.includes('fat'))                      return '🫙';
  return '🍽️';
}

const MEAL_TIMES: Record<MealSlotType, string> = {
  'Breakfast':       '7:00 AM',
  'Morning snack':   '10:00 AM',
  'Lunch':           '12:30 PM',
  'Afternoon snack': '3:00 PM',
  'Dinner':          '6:00 PM',
};

// ─────────────────────────────────────────────────────────────────────────────
// EBF slide illustrations (SVG strings for SvgXml)
// ─────────────────────────────────────────────────────────────────────────────

const EBF_ILLUSTRATIONS: string[] = [
  // 1 — Breast milk is enough
  `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg">
    <circle cx="170" cy="20" r="65" fill="#DBEEFF" opacity="0.6"/>
    <circle cx="100" cy="180" r="90" fill="#D6EDFF" opacity="0.4"/>
    <circle cx="40" cy="80" r="55" fill="#C5DCFA" opacity="0.5"/>
    <ellipse cx="40" cy="50" rx="18" ry="18" fill="#D4956A"/>
    <path d="M8 145 Q14 100 40 92 Q66 100 72 145" fill="#4A90D9"/>
    <path d="M14 130 Q6 148 16 158" fill="none" stroke="#4A90D9" stroke-width="7" stroke-linecap="round"/>
    <path d="M66 130 Q76 146 66 158" fill="none" stroke="#4A90D9" stroke-width="7" stroke-linecap="round"/>
    <ellipse cx="62" cy="112" rx="14" ry="12" fill="#F2C9A0"/>
    <circle cx="68" cy="105" r="7" fill="#E8B088"/>
    <ellipse cx="95" cy="62" rx="4" ry="6" fill="#7BBEF0" opacity="0.8"/>
    <ellipse cx="110" cy="76" rx="3" ry="5" fill="#7BBEF0" opacity="0.6"/>
    <ellipse cx="84" cy="80" rx="3" ry="4" fill="#7BBEF0" opacity="0.5"/>
    <ellipse cx="102" cy="90" rx="2.5" ry="4" fill="#7BBEF0" opacity="0.4"/>
  </svg>`,

  // 2 — Built-in immunity
  `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg">
    <path d="M100 8 L150 27 L150 92 Q150 132 100 152 Q50 132 50 92 L50 27 Z" fill="#A5D6B0" opacity="0.45"/>
    <path d="M100 20 L138 37 L138 90 Q138 120 100 138 Q62 120 62 90 L62 37 Z" fill="#6CBD7A" opacity="0.55"/>
    <path d="M100 34 L126 46 L126 88 Q126 110 100 124 Q74 110 74 88 L74 46 Z" fill="#43A047"/>
    <path d="M87 82 L97 95 L116 70" fill="none" stroke="white" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="28" cy="64" r="9" fill="#EF5350" opacity="0.65"/>
    <line x1="22" y1="64" x2="14" y2="57" stroke="#EF5350" stroke-width="2" opacity="0.65"/>
    <line x1="22" y1="64" x2="14" y2="71" stroke="#EF5350" stroke-width="2" opacity="0.65"/>
    <line x1="34" y1="64" x2="42" y2="57" stroke="#EF5350" stroke-width="2" opacity="0.65"/>
    <line x1="34" y1="64" x2="42" y2="71" stroke="#EF5350" stroke-width="2" opacity="0.65"/>
    <circle cx="34" cy="105" r="7" fill="#EF5350" opacity="0.45"/>
    <line x1="29" y1="101" x2="23" y2="96" stroke="#EF5350" stroke-width="1.5" opacity="0.45"/>
    <line x1="39" y1="101" x2="45" y2="96" stroke="#EF5350" stroke-width="1.5" opacity="0.45"/>
    <line x1="29" y1="109" x2="23" y2="114" stroke="#EF5350" stroke-width="1.5" opacity="0.45"/>
    <line x1="39" y1="109" x2="45" y2="114" stroke="#EF5350" stroke-width="1.5" opacity="0.45"/>
    <circle cx="162" cy="55" r="6" fill="#EF5350" opacity="0.35"/>
    <line x1="157" y1="51" x2="152" y2="47" stroke="#EF5350" stroke-width="1.5" opacity="0.35"/>
    <line x1="167" y1="51" x2="172" y2="47" stroke="#EF5350" stroke-width="1.5" opacity="0.35"/>
    <circle cx="168" cy="100" r="5" fill="#EF5350" opacity="0.3"/>
    <line x1="163" y1="96" x2="158" y2="92" stroke="#EF5350" stroke-width="1.5" opacity="0.3"/>
    <line x1="173" y1="96" x2="178" y2="92" stroke="#EF5350" stroke-width="1.5" opacity="0.3"/>
  </svg>`,

  // 3 — Brains love breast milk
  `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg">
    <circle cx="165" cy="140" r="80" fill="#E8DEFF" opacity="0.45"/>
    <path d="M54 108 Q43 88 54 73 Q51 47 71 42 Q79 30 97 34 Q107 22 125 27 Q141 20 153 34 Q170 30 175 48 Q191 58 185 77 Q197 95 185 114 Q187 135 169 142 Q155 158 135 150 Q119 163 101 155 Q81 166 65 152 Q45 144 54 108Z" fill="#C9A8F5" opacity="0.5"/>
    <path d="M54 108 Q43 88 54 73 Q51 47 71 42 Q79 30 97 34 Q107 22 125 27 Q141 20 153 34 Q170 30 175 48 Q191 58 185 77 Q197 95 185 114 Q187 135 169 142 Q155 158 135 150 Q119 163 101 155 Q81 166 65 152 Q45 144 54 108Z" fill="none" stroke="#8E24AA" stroke-width="2"/>
    <path d="M97 34 Q89 58 97 78" fill="none" stroke="#8E24AA" stroke-width="1.5" opacity="0.5"/>
    <path d="M125 27 Q117 54 125 74 Q131 96 119 118" fill="none" stroke="#8E24AA" stroke-width="1.5" opacity="0.5"/>
    <path d="M153 34 Q159 62 149 84" fill="none" stroke="#8E24AA" stroke-width="1.5" opacity="0.4"/>
    <path d="M185 77 Q167 84 151 77" fill="none" stroke="#8E24AA" stroke-width="1.5" opacity="0.5"/>
    <path d="M54 108 Q74 100 89 108 Q104 116 119 108" fill="none" stroke="#8E24AA" stroke-width="1.5" opacity="0.5"/>
    <circle cx="112" cy="62" r="4.5" fill="#CE93D8"/>
    <circle cx="150" cy="52" r="4" fill="#BA68C8"/>
    <circle cx="164" cy="94" r="4.5" fill="#CE93D8"/>
    <circle cx="86" cy="92" r="4" fill="#BA68C8"/>
    <circle cx="132" cy="124" r="4" fill="#CE93D8"/>
    <circle cx="160" cy="126" r="3.5" fill="#BA68C8"/>
    <line x1="112" y1="62" x2="150" y2="52" stroke="#BA68C8" stroke-width="1.2" opacity="0.65"/>
    <line x1="150" y1="52" x2="164" y2="94" stroke="#BA68C8" stroke-width="1.2" opacity="0.65"/>
    <line x1="86" y1="92" x2="132" y2="124" stroke="#BA68C8" stroke-width="1.2" opacity="0.65"/>
    <line x1="164" y1="94" x2="132" y2="124" stroke="#BA68C8" stroke-width="1.2" opacity="0.65"/>
    <line x1="132" y1="124" x2="160" y2="126" stroke="#BA68C8" stroke-width="1.2" opacity="0.5"/>
    <line x1="112" y1="62" x2="86" y2="92" stroke="#BA68C8" stroke-width="1" opacity="0.5"/>
  </svg>`,

  // 4 — Feed on demand
  `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg">
    <circle cx="22" cy="148" r="80" fill="#FFF3C4" opacity="0.55"/>
    <circle cx="18" cy="28" r="38" fill="#FFE082" opacity="0.3"/>
    <ellipse cx="100" cy="50" rx="19" ry="19" fill="#D4956A"/>
    <path d="M62 152 Q70 106 100 98 Q130 106 138 152" fill="#F9A825"/>
    <path d="M68 116 Q60 130 70 142" fill="none" stroke="#F9A825" stroke-width="8" stroke-linecap="round"/>
    <path d="M132 116 Q142 128 132 142" fill="none" stroke="#F9A825" stroke-width="8" stroke-linecap="round"/>
    <ellipse cx="100" cy="132" rx="25" ry="19" fill="#FFF3E0"/>
    <circle cx="87" cy="124" r="12" fill="#F2C9A0"/>
    <path d="M140 66 Q142 60 147 60 Q152 60 154 66 Q156 60 161 60 Q166 60 168 66 Q168 74 154 84 Q140 74 140 66Z" fill="#FF8F00" opacity="0.75"/>
    <path d="M155 46 Q157 41 161 41 Q165 41 167 46 Q169 41 173 41 Q177 41 179 46 Q179 52 167 60 Q155 52 155 46Z" fill="#FFCA28" opacity="0.65"/>
    <path d="M118 36 Q120 32 124 32 Q128 32 130 36 Q132 32 136 32 Q140 32 142 36 Q142 42 130 49 Q118 42 118 36Z" fill="#FFB300" opacity="0.55"/>
    <path d="M92 30 Q93 27 97 27 Q101 27 102 30 Q103 27 107 27 Q111 27 112 30 Q112 35 102 41 Q92 35 92 30Z" fill="#FFC107" opacity="0.45"/>
  </svg>`,

  // 5 — Night feeds matter
  `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg">
    <rect width="200" height="160" fill="#1A237E" opacity="0.06"/>
    <circle cx="94" cy="44" r="34" fill="#FFF8DC" opacity="0.7"/>
    <circle cx="94" cy="44" r="26" fill="#FFF3A0" opacity="0.85"/>
    <circle cx="108" cy="36" r="22" fill="#EEF0FB" opacity="0.75"/>
    <circle cx="38" cy="20" r="2.5" fill="#9FA8DA"/>
    <circle cx="168" cy="12" r="2" fill="#9FA8DA"/>
    <circle cx="62" cy="8" r="1.8" fill="#C5CAE9"/>
    <circle cx="155" cy="34" r="2.2" fill="#9FA8DA"/>
    <circle cx="16" cy="52" r="1.8" fill="#C5CAE9"/>
    <circle cx="184" cy="58" r="1.8" fill="#9FA8DA"/>
    <circle cx="178" cy="28" r="1.5" fill="#C5CAE9"/>
    <circle cx="22" cy="80" r="1.5" fill="#9FA8DA"/>
    <rect x="18" y="126" width="148" height="12" rx="5" fill="#7986CB"/>
    <rect x="16" y="138" width="152" height="22" rx="5" fill="#9FA8DA" opacity="0.4"/>
    <ellipse cx="52" cy="126" rx="28" ry="10" fill="#E8EAF6"/>
    <circle cx="52" cy="113" r="15" fill="#D4956A"/>
    <path d="M44 110 Q52 117 60 110" fill="none" stroke="#BF9070" stroke-width="1.5" opacity="0.5"/>
    <text x="78" y="108" font-family="sans-serif" font-size="13" font-weight="700" fill="#5C6BC0" opacity="0.8">z</text>
    <text x="95" y="92" font-family="sans-serif" font-size="17" font-weight="700" fill="#5C6BC0" opacity="0.6">z</text>
    <text x="116" y="72" font-family="sans-serif" font-size="22" font-weight="700" fill="#5C6BC0" opacity="0.4">z</text>
    <ellipse cx="130" cy="124" rx="17" ry="12" fill="#FFF3E0"/>
    <circle cx="119" cy="116" r="9" fill="#F2C9A0"/>
  </svg>`,

  // 6 — No water needed
  `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg">
    <path d="M72 16 Q72 16 40 76 Q24 108 72 148 Q120 108 104 76 Q72 16 72 16Z" fill="#B2EBF2" stroke="#26C6DA" stroke-width="1.5"/>
    <line x1="54" y1="72" x2="90" y2="112" stroke="#00838F" stroke-width="4" stroke-linecap="round" opacity="0.75"/>
    <line x1="90" y1="72" x2="54" y2="112" stroke="#00838F" stroke-width="4" stroke-linecap="round" opacity="0.75"/>
    <ellipse cx="72" cy="154" rx="26" ry="5" fill="none" stroke="#4DD0E1" stroke-width="1.5" opacity="0.5"/>
    <ellipse cx="72" cy="157" rx="40" ry="8" fill="none" stroke="#4DD0E1" stroke-width="1" opacity="0.3"/>
    <path d="M148 42 Q148 42 128 72 Q118 92 148 112 Q178 92 168 72 Q148 42 148 42Z" fill="#FFF9C4" stroke="#F9A825" stroke-width="1.5"/>
    <path d="M140 78 L145 86 L158 70" fill="none" stroke="#E65100" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="44" y="148" font-family="sans-serif" font-size="11" font-weight="700" fill="#00695C">88% H₂O</text>
    <text x="128" y="132" font-family="sans-serif" font-size="9" fill="#BF6F00">milk ✓</text>
  </svg>`,

  // 7 — Track the weight
  `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg">
    <line x1="22" y1="148" x2="185" y2="148" stroke="#BF360C" stroke-width="1.5" opacity="0.4"/>
    <line x1="22" y1="148" x2="22" y2="20" stroke="#BF360C" stroke-width="1.5" opacity="0.4"/>
    <rect x="32" y="122" width="20" height="26" rx="3" fill="#FFAB91"/>
    <rect x="60" y="100" width="20" height="48" rx="3" fill="#FF7043"/>
    <rect x="88" y="78" width="20" height="70" rx="3" fill="#F4511E"/>
    <rect x="116" y="54" width="20" height="94" rx="3" fill="#E64A19"/>
    <rect x="144" y="30" width="20" height="118" rx="3" fill="#BF360C"/>
    <path d="M42 124 L70 102 L98 80 L126 56 L154 32" fill="none" stroke="#FF5722" stroke-width="2.5" stroke-dasharray="5,3"/>
    <polygon points="154,32 146,37 156,44" fill="#FF5722"/>
    <text x="29" y="158" font-family="sans-serif" font-size="8" fill="#BF360C" font-weight="600">1m</text>
    <text x="57" y="158" font-family="sans-serif" font-size="8" fill="#BF360C" font-weight="600">2m</text>
    <text x="85" y="158" font-family="sans-serif" font-size="8" fill="#BF360C" font-weight="600">3m</text>
    <text x="113" y="158" font-family="sans-serif" font-size="8" fill="#BF360C" font-weight="600">4m</text>
    <text x="141" y="158" font-family="sans-serif" font-size="8" fill="#BF360C" font-weight="600">5m</text>
    <text x="24" y="100" font-family="sans-serif" font-size="7" fill="#BF360C" opacity="0.6">g</text>
    <line x1="22" y1="98" x2="27" y2="98" stroke="#BF360C" stroke-width="1" opacity="0.4"/>
    <line x1="22" y1="124" x2="27" y2="124" stroke="#BF360C" stroke-width="1" opacity="0.4"/>
  </svg>`,
];

// ─────────────────────────────────────────────────────────────────────────────
// EBF Carousel — with SVG illustrations
// ─────────────────────────────────────────────────────────────────────────────

interface EbfSlide {
  title: string;
  body: string;
  color: string;
  accent: string;
  tipLabel: string;
}

const EBF_SLIDES: EbfSlide[] = [
  { title: 'Breast milk is enough',  body: 'For the first 6 months, breast milk alone gives your baby everything — water, nutrients, and protection. No water, juice, or food needed.', color: '#EEF6FF', accent: '#1976D2', tipLabel: 'TIP 1 OF 7' },
  { title: 'Built-in immunity',       body: 'Every feed passes antibodies to your baby, shielding them from diarrhoea, pneumonia, and infections in their most vulnerable months.', color: '#F0FBF4', accent: '#2E7D32', tipLabel: 'TIP 2 OF 7' },
  { title: 'Brains love breast milk', body: 'The fats in breast milk fuel rapid brain growth. Babies who breastfeed exclusively show stronger cognitive development in early childhood.', color: '#F5F0FF', accent: '#6A1B9A', tipLabel: 'TIP 3 OF 7' },
  { title: 'Feed on demand',          body: 'Offer the breast whenever your baby cries, roots, or sucks their fist. Frequent feeding builds your supply and keeps baby growing well.', color: '#FFFBEA', accent: '#F57F17', tipLabel: 'TIP 4 OF 7' },
  { title: 'Night feeds matter',      body: 'Prolactin — the milk-making hormone — peaks at night. Night feeds are not a problem; they are what keeps your supply strong.', color: '#EEF0FB', accent: '#283593', tipLabel: 'TIP 5 OF 7' },
  { title: 'No water needed',         body: "Breast milk is 88% water. Even in hot weather, extra water can upset your baby's stomach and reduce milk intake. Trust the milk.", color: '#E8F9F9', accent: '#00695C', tipLabel: 'TIP 6 OF 7' },
  { title: 'Track the weight',        body: 'Your baby should regain birth weight by 2 weeks, then gain ~150–200g per week. Visit your MCH clinic monthly to confirm growth is on track.', color: '#FEF0ED', accent: '#BF360C', tipLabel: 'TIP 7 OF 7' },
];

const EbfCarousel: React.FC<{ childName: string; ageMonths: number }> = ({ childName, ageMonths }) => {
  const [active, setActive] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopTimer  = () => { if (timerRef.current) clearInterval(timerRef.current); };
  const startTimer = () => {
    stopTimer();
    timerRef.current = setInterval(() => {
      setActive(prev => {
        const next = (prev + 1) % EBF_SLIDES.length;
        scrollRef.current?.scrollTo({ x: next * (W - 32), animated: true });
        return next;
      });
    }, 6000);
  };
  useEffect(() => { startTimer(); return () => stopTimer(); }, []);

  const weeksToSolids = Math.max(0, Math.round((6 - ageMonths) * 4.3));
  const progressPct   = Math.min(100, Math.round((ageMonths / 6) * 100));

  return (
    <View>
      {/* Milestone progress card */}
      <View style={ebf.milestoneCard}>
        <View style={ebf.milestoneTop}>
          <View style={ebf.milestoneLeft}>
            <Text style={ebf.milestoneLabel}>EBF JOURNEY</Text>
            <Text style={ebf.milestoneTitle}>{ageMonths} of 6 months</Text>
            <Text style={ebf.milestoneSub}>
              {ageMonths < 6
                ? `~${weeksToSolids} weeks until solid foods`
                : 'Ready to start complementary foods!'}
            </Text>
          </View>
          <View style={ebf.progressRing}>
            <Text style={ebf.progressPct}>{progressPct}%</Text>
            <Text style={ebf.progressLabel}>complete</Text>
          </View>
        </View>
        <View style={ebf.progressTrack}>
          <View style={[ebf.progressFill, { width: `${progressPct}%` as any }]} />
        </View>
        <View style={ebf.milestoneDots}>
          {[0,1,2,3,4,5].map(m => (
            <View key={m} style={[ebf.milestoneDot, ageMonths > m && ebf.milestoneDotDone]}>
              <Text style={[ebf.milestoneDotText, ageMonths > m && ebf.milestoneDotTextDone]}>{m+1}</Text>
            </View>
          ))}
          <View style={[ebf.milestoneDot, ageMonths >= 6 ? ebf.milestoneDotDone : ebf.milestoneDotEnd]}>
            <Ionicons name="restaurant-outline" size={10} color={ageMonths >= 6 ? '#fff' : COLORS.textMuted} />
          </View>
        </View>
      </View>

      {/* Section divider */}
      <View style={ebf.sectionHeader}>
        <View style={ebf.sectionLine} />
        <Text style={ebf.sectionLabel}>BREASTFEEDING TIPS</Text>
        <View style={ebf.sectionLine} />
      </View>

      {/* Tip cards carousel */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={stopTimer}
        onMomentumScrollEnd={e => {
          const i = Math.round(e.nativeEvent.contentOffset.x / (W - 32));
          setActive(i);
          startTimer();
        }}
        decelerationRate="fast"
        snapToInterval={W - 32}
        snapToAlignment="start"
        style={{ marginHorizontal: -16 }}
        contentContainerStyle={{ paddingHorizontal: 16 }}
      >
        {EBF_SLIDES.map((slide, i) => (
          <View
            key={i}
            style={[
              ebf.slide,
              { width: W - 32, backgroundColor: slide.color, marginRight: i < EBF_SLIDES.length - 1 ? 12 : 0 },
            ]}
          >
            {/* Illustration row: SVG art on the left, tip pill + title on right */}
            <View style={ebf.slideTop}>
              <View style={ebf.slideIllustrationWrap}>
                <SvgXml
                  xml={EBF_ILLUSTRATIONS[i]}
                  width={130}
                  height={104}
                />
              </View>
              <View style={ebf.slideMeta}>
                <View style={[ebf.slidePill, { backgroundColor: slide.accent + '1A' }]}>
                  <Text style={[ebf.slidePillText, { color: slide.accent }]}>{slide.tipLabel}</Text>
                </View>
                <Text style={[ebf.slideTitle, { color: slide.accent }]}>{slide.title}</Text>
              </View>
            </View>
            {/* Body text below */}
            <Text style={ebf.slideBody}>{slide.body}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Dot indicators */}
      <View style={ebf.dots}>
        {EBF_SLIDES.map((slide, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => {
              stopTimer();
              scrollRef.current?.scrollTo({ x: i * (W - 32), animated: true });
              setActive(i);
              startTimer();
            }}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          >
            <View style={[
              ebf.dot,
              i === active
                ? { backgroundColor: EBF_SLIDES[active].accent, width: 20 }
                : { backgroundColor: COLORS.border, width: 6 },
            ]} />
          </TouchableOpacity>
        ))}
      </View>

      {/* Source */}
      <View style={ebf.sourceRow}>
        <Ionicons name="book-outline" size={11} color={COLORS.textMuted} />
        <Text style={ebf.sourceText}>WHO IYCF Guidelines 2023 · Kenya MoH MCH Handbook</Text>
      </View>
    </View>
  );
};

const ebf = StyleSheet.create({
  milestoneCard:        { backgroundColor: COLORS.white, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, padding: 18, marginBottom: 20, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
  milestoneTop:         { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  milestoneLeft:        { flex: 1 },
  milestoneLabel:       { fontFamily: FONTS.semibold, fontSize: 10, color: COLORS.primary, letterSpacing: 1.2, marginBottom: 4 },
  milestoneTitle:       { fontFamily: FONTS.bold, fontSize: 22, color: COLORS.textPrimary, marginBottom: 4 },
  milestoneSub:         { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textSecondary },
  progressRing:         { width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: COLORS.primary },
  progressPct:          { fontFamily: FONTS.bold, fontSize: 16, color: COLORS.primary },
  progressLabel:        { fontFamily: FONTS.regular, fontSize: 9, color: COLORS.primary },
  progressTrack:        { height: 6, backgroundColor: COLORS.border, borderRadius: 3, marginBottom: 14, overflow: 'hidden' },
  progressFill:         { height: 6, backgroundColor: COLORS.primary, borderRadius: 3 },
  milestoneDots:        { flexDirection: 'row', alignItems: 'center', gap: 6 },
  milestoneDot:         { width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  milestoneDotDone:     { backgroundColor: COLORS.primary },
  milestoneDotEnd:      { backgroundColor: COLORS.border },
  milestoneDotText:     { fontFamily: FONTS.bold, fontSize: 10, color: COLORS.textMuted },
  milestoneDotTextDone: { color: '#fff' },
  sectionHeader:        { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  sectionLine:          { flex: 1, height: 1, backgroundColor: COLORS.border },
  sectionLabel:         { fontFamily: FONTS.semibold, fontSize: 10, color: COLORS.textMuted, letterSpacing: 1.2 },
  // Card
  slide:                { borderRadius: 20, padding: 18, minHeight: 240, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  slideTop:             { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 14 },
  slideIllustrationWrap:{ width: 130, height: 104, borderRadius: 14, overflow: 'hidden', flexShrink: 0 },
  slideMeta:            { flex: 1, paddingTop: 4, gap: 8 },
  slidePill:            { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, alignSelf: 'flex-start' },
  slidePillText:        { fontFamily: FONTS.semibold, fontSize: 10, letterSpacing: 0.8 },
  slideTitle:           { fontFamily: FONTS.bold, fontSize: 17, lineHeight: 23 },
  slideBody:            { fontFamily: FONTS.regular, fontSize: 13, lineHeight: 21, color: COLORS.textSecondary },
  // Dots / source
  dots:                 { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 16, marginBottom: 6 },
  dot:                  { height: 6, borderRadius: 3 },
  sourceRow:            { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16, justifyContent: 'center' },
  sourceText:           { fontFamily: FONTS.regular, fontSize: 11, color: COLORS.textMuted },
});

// ─────────────────────────────────────────────────────────────────────────────
// Referral card
// ─────────────────────────────────────────────────────────────────────────────

interface ReferralCardProps { severity: string; reason: string; childName: string; waz: number | null; haz: number | null; whz: number | null; }

const ReferralCard: React.FC<ReferralCardProps> = ({ severity, reason, childName, waz, haz, whz }) => {
  const t = useT();
  const isCritical = severity === 'critical';
  const bg = isCritical ? COLORS.missedLight : COLORS.dueLight;
  const border = isCritical ? COLORS.missed : COLORS.due;
  return (
    <View style={[rc.card, { backgroundColor: bg, borderColor: border + '55' }]}>
      <View style={rc.header}>
        <Ionicons name={isCritical ? 'alert-circle' : 'warning'} size={20} color={border} />
        <Text style={[rc.title, { color: border }]}>{isCritical ? '🚨  ' : '⚠️  '}{t('referral_title')}</Text>
      </View>
      <Text style={[rc.reason, { color: border }]}>{reason}</Text>
      <View style={rc.scores}>
        {waz != null && <View style={[rc.chip, { borderColor: border + '44' }]}><Text style={[rc.chipLabel, { color: border }]}>WAZ</Text><Text style={[rc.chipVal, { color: border }]}>{waz.toFixed(1)}</Text></View>}
        {haz != null && <View style={[rc.chip, { borderColor: border + '44' }]}><Text style={[rc.chipLabel, { color: border }]}>HAZ</Text><Text style={[rc.chipVal, { color: border }]}>{haz.toFixed(1)}</Text></View>}
        {whz != null && <View style={[rc.chip, { borderColor: border + '44' }]}><Text style={[rc.chipLabel, { color: border }]}>WHZ</Text><Text style={[rc.chipVal, { color: border }]}>{whz.toFixed(1)}</Text></View>}
      </View>
      {isCritical && (
        <View style={rc.rutfBox}>
          <Ionicons name="medkit-outline" size={14} color={border} />
          <Text style={[rc.rutfText, { color: border }]}>{childName} may be eligible for RUTF. Visit your nearest MCH clinic immediately for SAM assessment.</Text>
        </View>
      )}
      <TouchableOpacity style={[rc.btn, { backgroundColor: border }]} onPress={() => Linking.openURL('tel:0800723253')} activeOpacity={0.8}>
        <Ionicons name="call-outline" size={14} color={COLORS.white} />
        <Text style={rc.btnText}>{isCritical ? 'Call Kenya Health Hotline' : 'Book MCH Appointment'}</Text>
      </TouchableOpacity>
      <Text style={[rc.source, { color: border + 'AA' }]}>WHO/UNICEF SAM Protocol 2023 · Kenya MoH IMAM Guidelines</Text>
    </View>
  );
};

const rc = StyleSheet.create({
  card:      { borderRadius: RADIUS.lg, borderWidth: 1.5, padding: 16, marginBottom: 14, gap: 10 },
  header:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title:     { fontFamily: FONTS.bold, fontSize: 14, flex: 1 },
  reason:    { fontFamily: FONTS.regular, fontSize: 13, lineHeight: 19 },
  scores:    { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip:      { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, alignItems: 'center', gap: 1 },
  chipLabel: { fontFamily: FONTS.regular, fontSize: 9, letterSpacing: 0.5 },
  chipVal:   { fontFamily: FONTS.bold, fontSize: 16 },
  rutfBox:   { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: RADIUS.md, padding: 10 },
  rutfText:  { fontFamily: FONTS.regular, fontSize: 12, flex: 1, lineHeight: 17 },
  btn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: RADIUS.lg },
  btnText:   { fontFamily: FONTS.semibold, fontSize: 13, color: COLORS.white },
  source:    { fontFamily: FONTS.regular, fontSize: 10, textAlign: 'center' },
});

// ─────────────────────────────────────────────────────────────────────────────
// Meal card
// ─────────────────────────────────────────────────────────────────────────────

interface MealCardProps { slot: MealSlot; index: number; onSwap: (slot: MealSlot) => void; }

const MealCard = React.memo(({ slot, index, onSwap }: MealCardProps) => {
  const t = useT();
  const fade  = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(16)).current;
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,  { toValue: 1, duration: 300, delay: index * 60, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 300, delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, []);
  const emoji       = pickEmoji(slot.primaryFood.food_name, slot.primaryFood.who_group, slot.primaryFood.food_id);
  const accentColor = slot.isSnack ? COLORS.primary      : COLORS.given;
  const badgeBg     = slot.isSnack ? COLORS.upcomingLight : COLORS.givenLight;
  const badgeColor  = slot.isSnack ? COLORS.upcoming     : COLORS.given;
  return (
    <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>
      <View style={mc.card}>
        <View style={[mc.accent, { backgroundColor: accentColor }]} />
        <View style={mc.body}>
          <TouchableOpacity style={mc.header} onPress={() => setExpanded(e => !e)} activeOpacity={0.75}>
            <Text style={mc.emoji}>{emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={mc.mealType}>{t(SLOT_KEY[slot.type])}</Text>
              <Text style={mc.mealName}>{slot.mealName}</Text>
              {!expanded && (
                <Text style={mc.foodSummary} numberOfLines={1}>
                  {[slot.primaryFood, slot.secondFood, slot.thirdFood].filter(Boolean).map(f => f!.local_name ?? f!.food_name).join(' · ')}
                </Text>
              )}
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <View style={[mc.badge, { backgroundColor: badgeBg }]}>
                <Ionicons name={slot.isSnack ? 'cafe-outline' : 'restaurant-outline'} size={11} color={badgeColor} />
                <Text style={[mc.badgeText, { color: badgeColor }]}>{slot.isSnack ? t('snack_label') : t('meal_label')}</Text>
              </View>
              <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textMuted} />
            </View>
          </TouchableOpacity>
          {expanded && (
            <View style={mc.expandedContent}>
              <View style={mc.metaRow}>
                <Ionicons name="time-outline" size={12} color={COLORS.textMuted} />
                <Text style={mc.metaText}>{MEAL_TIMES[slot.type]}</Text>
                {slot.primaryFood.max_serving_g != null && (
                  <><View style={mc.dot} /><Ionicons name="scale-outline" size={12} color={COLORS.due} /><Text style={[mc.metaText, { color: COLORS.due }]}>Max {slot.primaryFood.max_serving_g}g</Text></>
                )}
              </View>
              <View style={mc.tags}>
                {slot.nutrients.map(tag => { const ts = tagStyle(tag); return (
                  <View key={tag} style={[mc.tag, { backgroundColor: ts.bg }]}><Text style={[mc.tagText, { color: ts.color }]}>{t(NUTRIENT_KEY[tag] ?? tag)}</Text></View>
                ); })}
              </View>
              <View style={mc.foodsRow}>
                {[slot.primaryFood, slot.secondFood, slot.thirdFood].filter(Boolean).map(food => (
                  <View key={food!.food_id} style={mc.foodChip}>
                    <Text style={mc.foodEmoji}>{pickEmoji(food!.food_name, food!.who_group, food!.food_id)}</Text>
                    <Text style={mc.foodName}>{food!.local_name ?? food!.food_name}</Text>
                    {food!.energy_kcal != null && <Text style={mc.foodKcal}>{Math.round(food!.energy_kcal)} kcal</Text>}
                  </View>
                ))}
              </View>
              {!!slot.synergyNote && (
                <View style={mc.synergyBox}>
                  <Ionicons name="flash-outline" size={11} color={COLORS.primary} />
                  <Text style={mc.synergyText}><Text style={{ fontFamily: FONTS.semibold }}>{t('synergy_note_label')}: </Text>{slot.synergyNote}</Text>
                </View>
              )}
              <View style={mc.divider} />
              <TouchableOpacity style={mc.swapBtn} onPress={() => onSwap(slot)} activeOpacity={0.7}>
                <Ionicons name="shuffle-outline" size={14} color={COLORS.primary} />
                <Text style={mc.swapText}>Try different foods</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Animated.View>
  );
});
MealCard.displayName = 'MealCard';

const mc = StyleSheet.create({
  card:            { flexDirection: 'row', backgroundColor: COLORS.white, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, marginBottom: 10, overflow: 'hidden' },
  accent:          { width: 4 },
  body:            { flex: 1, paddingHorizontal: 14, paddingTop: 13, paddingBottom: 11 },
  header:          { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  emoji:           { fontSize: 28, lineHeight: 32, marginTop: 2 },
  mealType:        { fontFamily: FONTS.regular, fontSize: 10, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 1 },
  mealName:        { fontFamily: FONTS.semibold, fontSize: 14, color: COLORS.textPrimary, lineHeight: 19 },
  foodSummary:     { fontFamily: FONTS.regular, fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  badge:           { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full, flexShrink: 0 },
  badgeText:       { fontFamily: FONTS.semibold, fontSize: 11 },
  expandedContent: { marginTop: 12 },
  metaRow:         { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  metaText:        { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textMuted },
  dot:             { width: 3, height: 3, borderRadius: 2, backgroundColor: COLORS.border },
  tags:            { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 8 },
  tag:             { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  tagText:         { fontFamily: FONTS.semibold, fontSize: 11 },
  foodsRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  foodChip:        { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.surface, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 8, paddingVertical: 4 },
  foodEmoji:       { fontSize: 13 },
  foodName:        { fontFamily: FONTS.semibold, fontSize: 11, color: COLORS.textSecondary, flex: 1 },
  foodKcal:        { fontFamily: FONTS.regular, fontSize: 10, color: COLORS.textMuted },
  synergyBox:      { flexDirection: 'row', alignItems: 'flex-start', gap: 5, backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md, paddingHorizontal: 9, paddingVertical: 5, marginBottom: 10 },
  synergyText:     { fontFamily: FONTS.regular, fontSize: 11, color: COLORS.primary, flex: 1, lineHeight: 15 },
  divider:         { height: 1, backgroundColor: COLORS.border, marginBottom: 10 },
  swapBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border },
  swapText:        { fontFamily: FONTS.semibold, fontSize: 12, color: COLORS.primary, paddingHorizontal: 5 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Chat bubble
// ─────────────────────────────────────────────────────────────────────────────

function parseZuriMessage(content: string): { text: string; foods: string[] } {
  const foodsMatch = content.match(/Foods:\s*(.+)$/i);
  if (!foodsMatch) return { text: content.trim(), foods: [] };
  const text  = content.slice(0, foodsMatch.index).trim();
  const foods = foodsMatch[1].split(',').map(f => f.trim()).filter(Boolean);
  return { text, foods };
}

const ChatBubble = ({ msg }: { msg: ChatMsg }) => {
  if (msg.role === 'user') {
    return (
      <View style={cb.userWrap}>
        <View style={cb.userBubble}><Text style={cb.userText}>{msg.content}</Text></View>
      </View>
    );
  }
  const { text, foods } = parseZuriMessage(msg.content);
  return (
    <View style={cb.zuriWrap}>
      <View style={cb.avatarRow}>
        <View style={cb.avatar}><Text style={cb.avatarText}>Z</Text></View>
        <Text style={cb.zuriName}>Zuri</Text>
      </View>
      <View style={cb.zuriBubble}>
        <Text style={cb.zuriText}>{text}</Text>
        {foods.length > 0 && (
          <View style={cb.pillsRow}>
            {foods.map(food => <View key={food} style={cb.pill}><Text style={cb.pillText}>{food}</Text></View>)}
          </View>
        )}
      </View>
    </View>
  );
};

const cb = StyleSheet.create({
  userWrap:   { alignItems: 'flex-end', marginBottom: 4 },
  userBubble: { maxWidth: '78%', backgroundColor: COLORS.primary, borderRadius: 16, borderBottomRightRadius: 4, paddingHorizontal: 14, paddingVertical: 10 },
  userText:   { fontFamily: FONTS.regular, fontSize: 13, lineHeight: 19, color: COLORS.white },
  zuriWrap:   { alignItems: 'flex-start', marginBottom: 4 },
  avatarRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  avatar:     { width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: FONTS.bold, fontSize: 11, color: COLORS.white },
  zuriName:   { fontFamily: FONTS.semibold, fontSize: 11, color: COLORS.primary },
  zuriBubble: { maxWidth: '92%', backgroundColor: COLORS.white, borderRadius: 16, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10 },
  zuriText:   { fontFamily: FONTS.regular, fontSize: 13, lineHeight: 19, color: COLORS.textPrimary },
  pillsRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 8 },
  pill:       { backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 3 },
  pillText:   { fontFamily: FONTS.semibold, fontSize: 11, color: COLORS.primary },
});

// ─────────────────────────────────────────────────────────────────────────────
// Plan summary banner
// ─────────────────────────────────────────────────────────────────────────────

interface PlanSummaryProps { plan: import('@/hooks/useMealPlan').GeneratedMealPlan; }

const PlanSummaryBanner: React.FC<PlanSummaryProps> = ({ plan }) => {
  const t = useT();
  const totalKcal = plan.slots.flatMap(s => [s.primaryFood, s.secondFood, s.thirdFood]).filter(Boolean).reduce((sum, f) => sum + (f!.energy_kcal ?? 0), 0);
  const uniqueGroups = new Set(plan.slots.flatMap(s => [s.primaryFood, s.secondFood, s.thirdFood]).filter(Boolean).map(f => f!.who_group)).size;
  return (
    <View style={ps.card}>
      <View style={ps.row}>
        <View style={ps.stat}><Text style={ps.val}>{totalKcal > 0 ? `~${Math.round(totalKcal)}` : '—'}</Text><Text style={ps.label}>kcal total</Text></View>
        <View style={ps.sep} />
        <View style={ps.stat}><Text style={ps.val}>{uniqueGroups}/8</Text><Text style={ps.label}>food groups</Text></View>
        <View style={ps.sep} />
        <View style={ps.stat}><Text style={ps.val}>{plan.textureLabel.split(' ')[0]}</Text><Text style={ps.label}>{t('texture')}</Text></View>
      </View>
      <Text style={ps.target}>{t('energy_target')}: {plan.energyTarget}</Text>
    </View>
  );
};

const ps = StyleSheet.create({
  card:   { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, padding: 14, marginBottom: 14 },
  row:    { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  stat:   { flex: 1, alignItems: 'center' },
  val:    { fontFamily: FONTS.bold, fontSize: 20, color: COLORS.textPrimary },
  label:  { fontFamily: FONTS.regular, fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  sep:    { width: 1, height: 32, backgroundColor: COLORS.border, marginHorizontal: 8 },
  target: { fontFamily: FONTS.semibold, fontSize: 12, color: COLORS.primary, textAlign: 'center' },
});

// ─────────────────────────────────────────────────────────────────────────────
// Screen header
// ─────────────────────────────────────────────────────────────────────────────

interface ScreenHeaderProps {
  childName: string; ageMonths: number; waz: number | null; isEbf: boolean; insets: any;
  onRefresh?: () => void; loading?: boolean;
  tabs: { key: string; label: string }[]; activeTab: string; onTabChange: (t: string) => void;
}

const ScreenHeader: React.FC<ScreenHeaderProps> = ({ childName, ageMonths, waz, isEbf, insets, onRefresh, loading, tabs, activeTab, onTabChange }) => {
  const t     = useT();
  const badge = wazBadge(waz);
  const stats = isEbf
    ? [
        { icon: 'heart-outline' as const,      value: '8–12×',          label: 'FEEDS/DAY' },
        { icon: 'calendar-outline' as const,   value: `${ageMonths}mo`, label: 'AGE' },
        { icon: 'time-outline' as const,       value: '6mo',            label: 'START CF' },
        { icon: 'water-outline' as const,      value: 'EBF',            label: 'FEEDING' },
      ]
    : [
        { icon: 'restaurant-outline' as const,  value: '3+2',            label: 'MEALS/DAY' },
        { icon: 'stats-chart-outline' as const, value: waz != null ? waz.toFixed(1) : '—', label: 'WAZ' },
        { icon: 'calendar-outline' as const,    value: `${ageMonths}mo`, label: 'AGE' },
        { icon: 'leaf-outline' as const,        value: ageMonths < 9 ? 'Mash' : ageMonths < 12 ? 'Mince' : 'Family', label: 'TEXTURE' },
      ];
  return (
    <>
      <View style={[sh.header, { paddingTop: insets.top + 14 }]}>
        <View style={sh.circle1} /><View style={sh.circle2} />
        <View style={sh.top}>
          <View style={{ flex: 1 }}>
            <Text style={sh.eyebrow}>{isEbf ? 'BREASTFEEDING GUIDE' : 'FEEDING GUIDE'}</Text>
            <Text style={sh.title}>{t('meal_plan_title')}</Text>
            <View style={sh.childPill}>
              <Ionicons name="person-circle-outline" size={13} color="rgba(255,255,255,0.85)" />
              <Text style={sh.childPillText}>{childName.toUpperCase()}</Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 8 }}>
            <View style={[sh.badge, { backgroundColor: badge.bg }]}>
              <Ionicons name={badge.icon} size={13} color={badge.color} />
              <Text style={[sh.badgeText, { color: badge.color }]}>{badge.label}</Text>
            </View>
            {onRefresh && (
              <TouchableOpacity style={sh.refreshBtn} onPress={onRefresh} disabled={loading}>
                <Ionicons name="refresh" size={15} color={COLORS.white} style={loading ? { opacity: 0.4 } : undefined} />
              </TouchableOpacity>
            )}
          </View>
        </View>
        <View style={sh.divider} />
        <View style={sh.statRow}>
          {stats.map((st, i) => (
            <View key={i} style={sh.statChip}>
              <Ionicons name={st.icon} size={15} color={COLORS.textMuted} style={{ marginBottom: 2 }} />
              <Text style={sh.statVal}>{st.value}</Text>
              <Text style={sh.statLabel}>{st.label}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={sh.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={sh.tabInner}>
          {tabs.map(tab => (
            <TouchableOpacity key={tab.key} style={[sh.tab, activeTab === tab.key && sh.tabActive]} onPress={() => onTabChange(tab.key)}>
              <Text style={[sh.tabText, activeTab === tab.key && sh.tabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </>
  );
};

const sh = StyleSheet.create({
  header:        { backgroundColor: COLORS.primary, paddingHorizontal: 18, paddingBottom: 20, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden', shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 8, zIndex: 2 },
  circle1:       { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.07)', top: -60, right: -40 },
  circle2:       { position: 'absolute', width: 140, height: 140, borderRadius: 70,  backgroundColor: 'rgba(255,255,255,0.05)', bottom: -30, right: 60 },
  top:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  eyebrow:       { fontFamily: FONTS.semibold, fontSize: 10, color: 'rgba(255,255,255,0.65)', letterSpacing: 1.5, marginBottom: 4 },
  title:         { fontFamily: FONTS.extrabold, fontSize: 32, color: COLORS.white, letterSpacing: -0.5, lineHeight: 36, marginBottom: 8 },
  childPill:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, alignSelf: 'flex-start' },
  childPillText: { fontFamily: FONTS.semibold, fontSize: 12, color: 'rgba(255,255,255,0.92)', letterSpacing: 0.3 },
  badge:         { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  badgeText:     { fontFamily: FONTS.semibold, fontSize: 11 },
  refreshBtn:    { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  divider:       { height: 1, backgroundColor: 'rgba(255,255,255,0.18)', marginBottom: 14 },
  statRow:       { flexDirection: 'row', gap: 8 },
  statChip:      { flex: 1, backgroundColor: COLORS.white, borderRadius: 16, paddingVertical: 12, alignItems: 'center', gap: 1 },
  statVal:       { fontFamily: FONTS.bold, fontSize: 18, color: COLORS.textPrimary, lineHeight: 22 },
  statLabel:     { fontFamily: FONTS.regular, fontSize: 8, color: COLORS.textMuted, letterSpacing: 0.5 },
  tabBar:        { backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tabInner:      { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  tab:           { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border },
  tabActive:     { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabText:       { fontFamily: FONTS.semibold, fontSize: 13, color: COLORS.textSecondary },
  tabTextActive: { color: COLORS.white },
});

// ─────────────────────────────────────────────────────────────────────────────
// Responsive feeding tips
// ─────────────────────────────────────────────────────────────────────────────

const RF_TIPS = [
  { emoji: '👁️', title: 'Watch for hunger cues',         body: 'Feed when your child opens their mouth, reaches for food, or gets excited at mealtimes. Stop when they turn away or close their mouth.', accent: '#2196F3', bg: '#E8F4FD' },
  { emoji: '😊', title: 'Make mealtimes positive',       body: 'Sit together, minimise distractions, and talk to your child during meals. Avoid force-feeding — it reduces appetite over time.', accent: '#43A047', bg: '#E8F5E9' },
  { emoji: '🕐', title: 'Consistent meal schedule',      body: 'Aim for regular meal times each day. Predictable routines help children build appetite rhythms and eat better overall.', accent: '#8E24AA', bg: '#F3E5F5' },
  { emoji: '🍽️', title: 'Offer variety, accept refusal', body: 'Offer new foods 8–10 times before concluding a child dislikes them. Rejection is normal — keep offering alongside familiar foods.', accent: '#F9A825', bg: '#FFFDE7' },
  { emoji: '👨‍👩‍👧', title: 'Eat together as a family',    body: 'Children learn to eat by watching others. Eating the same foods as the family encourages acceptance and reduces fussiness.', accent: '#3949AB', bg: '#E8EAF6' },
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
  card:       { flexDirection: 'row', alignItems: 'flex-start', gap: 14, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, borderLeftWidth: 4, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  iconCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  iconEmoji:  { fontSize: 22 },
  titleRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 },
  dot:        { width: 6, height: 6, borderRadius: 3 },
  title:      { fontFamily: FONTS.bold, fontSize: 14, color: COLORS.textPrimary, flex: 1 },
  body:       { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textSecondary, lineHeight: 20 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────

export default function NutritionScreen() {
  const t            = useT();
  const insets       = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

  const activeChild        = useChildStore(s => s.activeChild);
  const growthRecords      = useChildStore(s => s.growthRecords);
  const fetchGrowthRecords = useChildStore(s => s.fetchGrowthRecords);
  const latestGrowth       = growthRecords[0] ?? null;

  const childName = activeChild?.full_name ?? 'Child';
  const dob       = activeChild?.date_of_birth ?? '';
  const sex       = (activeChild?.sex ?? 'female') as 'male' | 'female';
  const sexLabel  = sex === 'male' ? 'boy' : 'girl';

  const ageMonths = dob ? getAgeMonths(dob) : 9;
  const waz       = latestGrowth?.waz ?? null;
  const haz       = latestGrowth?.haz ?? null;
  const whz       = latestGrowth?.whz ?? null;
  const zscores   = React.useMemo(() => ({ waz, haz, whz }), [waz, haz, whz]);

  useEffect(() => {
    if (activeChild?.id && growthRecords.length === 0) fetchGrowthRecords(activeChild.id);
  }, [activeChild?.id]);

  const { data: feedingStage } = useFeedingStage(ageMonths);
  const isEbf = ageMonths < 6;

  const { plan, isLoading: planLoading, error: planError, isUsingFallback, refresh: refreshPlan } =
    useMealPlan({ childName, sex, ageMonths, zscores, enabled: !isEbf });

  const storeFoods    = useMealPlanStore(s => s.foods);
  const buildFoodPool = useMealPlanStore(s => s.buildFoodPool);
  const poolFoods: EnrichedFood[] = React.useMemo(() => {
    if (storeFoods.length === 0) return [];
    return buildFoodPool(ageMonths, zscores).all;
  }, [storeFoods, ageMonths, zscores]);

  const [swappedSlots, setSwappedSlots] = useState<Record<string, EnrichedFood>>({});

  const handleSwap = useCallback((slot: MealSlot) => {
    const sameGroup = poolFoods.filter(f =>
      f.who_group === slot.primaryFood.who_group &&
      f.food_id   !== slot.primaryFood.food_id &&
      f.food_id   !== (swappedSlots[slot.type]?.food_id ?? ''),
    );
    if (sameGroup.length === 0) return;
    const pick = sameGroup[Math.floor(Math.random() * sameGroup.length)];
    setSwappedSlots(prev => ({ ...prev, [slot.type]: pick }));
  }, [poolFoods, swappedSlots]);

  const effectivePlan = React.useMemo(() => {
    if (!plan) return null;
    if (Object.keys(swappedSlots).length === 0) return plan;
    return {
      ...plan,
      slots: plan.slots.map(slot => {
        const override = swappedSlots[slot.type];
        if (!override) return slot;
        const parts = [override, slot.secondFood, slot.thirdFood].filter(Boolean).map(f => f!.local_name ?? f!.food_name);
        return { ...slot, primaryFood: override, mealName: parts.length > 1 ? `${parts[0]} with ${parts.slice(1).join(' with ')}` : parts[0] };
      }),
    };
  }, [plan, swappedSlots]);

  const toTitle = (str: string) => str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

  const makeGreeting = useCallback((ebf: boolean, name: string, age: number) => {
    const n = toTitle(name);
    return ebf
      ? `Habari! I'm Zuri 🌿 ${n} is ${age} month${age !== 1 ? 's' : ''} old — breast milk alone is perfect now. Ask me anything about breastfeeding.`
      : `Habari! I'm Zuri 🌿 Ask me anything about ${n}'s feeding. The meal plan above uses only foods confirmed in your database — no invented ingredients.`;
  }, []);

  const [messages, setMessages]       = useState<ChatMsg[]>([{ role: 'assistant', content: makeGreeting(isEbf, childName, ageMonths) }]);
  const [chatInput, setChatInput]     = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const lastSendRef = useRef<number>(0);
  const chatRef     = useRef<ScrollView>(null);

  const cfTabs  = [
    { key: 'plan', label: t('meal_plan_title') },
    { key: 'rf',   label: t('nutrition_desc') },
    { key: 'ask',  label: t('tab_chat') },
  ];
  const ebfTabs = [
    { key: 'ebf', label: 'Breastfeeding' },
    { key: 'ask', label: t('tab_chat') },
  ];
  const [activeTab, setActiveTab] = useState(isEbf ? 'ebf' : 'plan');

  useEffect(() => {
    setMessages([{ role: 'assistant', content: makeGreeting(isEbf, childName, ageMonths) }]);
    setSwappedSlots({});
    setActiveTab(isEbf ? 'ebf' : 'plan');
    if (!isEbf) refreshPlan();
  }, [activeChild?.id]);

  const buildChatSysPrompt = useCallback(() => {
    const conds     = plan?.conditions.join(', ') ?? '';
    const planFoods = effectivePlan?.slots
      .flatMap(s => [s.primaryFood, s.secondFood, s.thirdFood]).filter(Boolean)
      .map(f => f!.local_name ?? f!.food_name).filter((v, i, a) => a.indexOf(v) === i).join(', ') ?? '';
    return `You are Zuri, Kenya MCH nutrition counsellor. Child: ${childName}, ${ageMonths}mo, ${sexLabel}, WAZ ${waz?.toFixed(1) ?? '—'}.${haz != null ? ` HAZ ${haz.toFixed(1)}.` : ''}${whz != null ? ` WHZ ${whz.toFixed(1)}.` : ''}
Active conditions: ${conds || 'none'}.
Today's meal plan foods (from Kenya food database): ${planFoods || 'see meal plan tab'}.
Only reference foods confirmed in the database. Never invent foods.${plan?.requiresReferral ? `\nIMPORTANT: ${plan.referralReason}` : ''}
WAZ interpretation: ≥-1 = normal, -1 to -2 = mild, -2 to -3 = MAM, <-3 = SAM (urgent RUTF referral).
Current WAZ ${waz?.toFixed(1) ?? '—'} = ${waz == null ? 'unknown' : waz >= -1 ? 'NORMAL — no malnutrition' : waz >= -2 ? 'MILD underweight' : waz >= -3 ? 'MAM — moderate acute malnutrition' : 'SAM — severe acute malnutrition, urgent referral'}. Never contradict this classification.
Answer in 2 sentences max. Be direct, no preamble.`;
  }, [childName, ageMonths, sexLabel, waz, haz, whz, plan, effectivePlan]);

  const scrollToEnd = useCallback(() => {
    setTimeout(() => chatRef.current?.scrollToEnd({ animated: true }), 80);
  }, []);

  const sendChat = useCallback(async (text?: string) => {
    const q = (text ?? chatInput).trim();
    if (!q || q.length < 3) return;
    const now = Date.now();
    if (now - lastSendRef.current < MIN_SEND_INTERVAL_MS) return;
    lastSendRef.current = now;
    setChatInput('');
    setMessages(prev => {
      const next = [...prev, { role: 'user' as const, content: q }];
      return next.length > MAX_CHAT_MESSAGES ? next.slice(-MAX_CHAT_MESSAGES) : next;
    });
    setChatLoading(true);
    const hist = messages.slice(-4).map(m => `${m.role === 'user' ? 'Parent' : 'Zuri'}: ${m.content}`).join('\n');
    try {
      const reply = await askGroq(hist ? `${hist}\n\nNew question: ${q}` : q, buildChatSysPrompt(), 0.4);
      setMessages(prev => {
        const next = [...prev, { role: 'assistant' as const, content: reply }];
        return next.length > MAX_CHAT_MESSAGES ? next.slice(-MAX_CHAT_MESSAGES) : next;
      });
    } catch {
      setMessages(prev => [...prev, { role: 'assistant' as const, content: 'Sorry, could not connect. Please try again.' }]);
    }
    setChatLoading(false);
    scrollToEnd();
  }, [chatInput, messages, buildChatSysPrompt, scrollToEnd]);

  if (!activeChild) return (
    <View style={s.screen}>
      <View style={[s.simpleHeader, { paddingTop: insets.top + 14 }]}>
        <Text style={s.simpleHeaderTitle}>{t('meal_plan_title')}</Text>
      </View>
      <View style={s.empty}>
        <View style={s.emptyIcon}><Ionicons name="person-add-outline" size={32} color={COLORS.primary} /></View>
        <Text style={s.emptyTitle}>No child selected</Text>
        <Text style={s.emptySub}>{t('no_children_hint')}</Text>
      </View>
    </View>
  );

  const isChatTab = activeTab === 'ask';
  const chatPlaceholder = isEbf ? 'Ask about breastfeeding…' : "Ask about feeding, textures, foods in today's plan…";
  const listPaddingBottom = { paddingBottom: tabBarHeight + 32 };

  return (
    <NutritionErrorBoundary>
      <KeyboardAvoidingView
        style={s.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScreenHeader
          childName={childName} ageMonths={ageMonths} waz={waz} isEbf={isEbf} insets={insets}
          onRefresh={!isEbf ? refreshPlan : undefined} loading={planLoading}
          tabs={isEbf ? ebfTabs : cfTabs} activeTab={activeTab} onTabChange={setActiveTab}
        />

        {/* ── EBF tab ── */}
        {isEbf && activeTab === 'ebf' && (
          <ScrollView
            style={s.flex}
            contentContainerStyle={[s.listContent, listPaddingBottom]}
            showsVerticalScrollIndicator={false}
          >
            <EbfCarousel childName={childName} ageMonths={ageMonths} />
          </ScrollView>
        )}

        {/* ── Meal Plan tab ── */}
        {!isEbf && activeTab === 'plan' && (
          <ScrollView
            style={s.flex}
            contentContainerStyle={[s.listContent, listPaddingBottom]}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={planLoading} onRefresh={refreshPlan} />}
          >
            {planError && !isUsingFallback && (
              <View style={s.softError}>
                <Ionicons name="warning-outline" size={16} color={COLORS.upcoming} />
                <Text style={s.softErrorText}>Could not load meal plan. Showing a basic plan.</Text>
                <TouchableOpacity style={s.retryBtn} onPress={refreshPlan}><Text style={s.retryText}>Retry</Text></TouchableOpacity>
              </View>
            )}
            {planLoading && !effectivePlan && (
              <View style={s.loadingWrap}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={s.loadingText}>Building today's meal plan from your food database…</Text>
              </View>
            )}
            {effectivePlan && (
              <>
                {effectivePlan.requiresReferral && (
                  <ReferralCard
                    severity={effectivePlan.conditions.includes('malnutrition_sam') ? 'critical' : 'moderate'}
                    reason={effectivePlan.referralReason ?? ''} childName={childName} waz={waz} haz={haz} whz={whz}
                  />
                )}
                <PlanSummaryBanner plan={effectivePlan} />
                {effectivePlan.slots.map((slot, i) => <MealCard key={slot.type} slot={slot} index={i} onSwap={handleSwap} />)}
                <View style={s.sourceCard}>
                  <Ionicons name="book-outline" size={12} color={COLORS.textMuted} />
                  <Text style={s.sourceText}>WHO IYCF 2023 · Kenya MoH MIYCN 2023–2028 · Kenya Food Composition Tables</Text>
                </View>
              </>
            )}
          </ScrollView>
        )}

        {/* ── Responsive Feeding tab ── */}
        {!isEbf && activeTab === 'rf' && (
          <ScrollView
            style={s.flex}
            contentContainerStyle={[s.listContent, listPaddingBottom]}
            showsVerticalScrollIndicator={false}
          >
            <View style={s.rfHero}>
              <View style={s.rfHeroInner}>
                <Text style={s.rfHeroEmoji}>🍴</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.rfHeroTitle}>Responsive Feeding</Text>
                  <Text style={s.rfHeroSub}>6 evidence-based practices for healthy eating habits</Text>
                </View>
              </View>
            </View>
            {RF_TIPS.map((tip, i) => <RfTipCard key={i} tip={tip} index={i} />)}
            <View style={s.sourceCard}>
              <Ionicons name="book-outline" size={12} color={COLORS.textMuted} />
              <Text style={s.sourceText}>WHO Responsive Feeding Guidelines 2023 · Kenya MoH MIYCN 2023–2028</Text>
            </View>
          </ScrollView>
        )}

        {/* ── Chat tab ── */}
        {isChatTab && (
          <View style={s.flex}>
            <ScrollView
              ref={chatRef}
              style={s.flex}
              contentContainerStyle={s.chatContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={scrollToEnd}
            >
              {messages.map((msg, i) => <ChatBubble key={i} msg={msg} />)}
              {chatLoading && (
                <View style={s.thinking}>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                  <Text style={s.thinkingText}>Zuri is thinking…</Text>
                </View>
              )}
            </ScrollView>

            <View style={[s.inputWrapper, { paddingBottom: tabBarHeight + 8 }]}>
              <View style={s.inputBar}>
                <TextInput
                  style={s.input}
                  value={chatInput}
                  onChangeText={setChatInput}
                  placeholder={chatPlaceholder}
                  placeholderTextColor={COLORS.textMuted}
                  multiline
                  maxLength={400}
                  returnKeyType="send"
                  onSubmitEditing={() => sendChat()}
                  blurOnSubmit={false}
                />
                <TouchableOpacity
                  style={[s.sendBtn, (!chatInput.trim() || chatInput.trim().length < 3) && s.sendBtnOff]}
                  onPress={() => sendChat()}
                  disabled={!chatInput.trim() || chatInput.trim().length < 3 || chatLoading}
                  activeOpacity={0.8}
                >
                  <Ionicons name="send" size={16} color={COLORS.white} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

      </KeyboardAvoidingView>
    </NutritionErrorBoundary>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main styles
// ─────────────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen:            { flex: 1, backgroundColor: '#F2F4F7' },
  flex:              { flex: 1 },
  simpleHeader:      { backgroundColor: COLORS.primary, paddingHorizontal: 18, paddingBottom: 20 },
  simpleHeaderTitle: { fontFamily: FONTS.extrabold, fontSize: 32, color: COLORS.white },
  listContent:       { padding: 16 },
  loadingWrap:       { alignItems: 'center', paddingVertical: 60, gap: 12 },
  loadingText:       { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },
  softError:         { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.upcomingLight, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.upcoming + '44', padding: 12, marginBottom: 12 },
  softErrorText:     { flex: 1, fontFamily: FONTS.regular, fontSize: 12, color: COLORS.upcoming },
  retryBtn:          { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.upcoming },
  retryText:         { fontFamily: FONTS.semibold, fontSize: 12, color: COLORS.upcoming },
  sourceCard:        { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, padding: 12, marginTop: 8 },
  sourceText:        { fontFamily: FONTS.regular, fontSize: 11, color: COLORS.textMuted, flex: 1, lineHeight: 16 },
  empty:             { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 },
  emptyIcon:         { width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle:        { fontFamily: FONTS.semibold, fontSize: 17, color: COLORS.textPrimary, textAlign: 'center' },
  emptySub:          { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },
  chatContent:       { padding: 16, gap: 8, paddingBottom: 8 },
  thinking:          { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  thinkingText:      { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textMuted, fontStyle: 'italic' },
inputWrapper: {
  backgroundColor: COLORS.white,
  borderTopWidth: 1,
  borderTopColor: COLORS.border,
  paddingTop: 10,
  elevation: 10,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: -2 },
  shadowOpacity: 0.06,
  shadowRadius: 4,
},
  inputBar:          { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 16, paddingTop: 10, marginBottom: 4 },
  input:             { flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 14, paddingVertical: 10, fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textPrimary, maxHeight: 100, minHeight: 44 },
  sendBtn:           { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginBottom: 2, elevation: 6, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.28, shadowRadius: 4 },
  sendBtnOff:        { backgroundColor: COLORS.border, elevation: 0, shadowOpacity: 0 },
  rfHero:            { backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, padding: 18, marginBottom: 16, overflow: 'hidden' },
  rfHeroInner:       { flexDirection: 'row', alignItems: 'center', gap: 14 },
  rfHeroEmoji:       { fontSize: 40 },
  rfHeroTitle:       { fontFamily: FONTS.bold, fontSize: 18, color: COLORS.white, marginBottom: 3 },
  rfHeroSub:         { fontFamily: FONTS.regular, fontSize: 12, color: 'rgba(255,255,255,0.75)', lineHeight: 17 },
});