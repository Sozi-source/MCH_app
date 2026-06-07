// src/components/nutrition/MealCard.tsx
// ZuriHealth — Premium Meal Card component

import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, Animated, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, RADIUS } from '@/lib/theme';
import { type MealSlot, type MealSlotType } from '@/hooks/useMealPlan';
import { type EnrichedFood } from '@/store/nutritionMealPlanStore';

// ─── Slot colour palette ───────────────────────────────────────────────────────

const SLOT_PALETTE: Record<MealSlotType, {
  iconBg: string; accentBg: string; accentText: string;
}> = {
  'Breakfast':       { iconBg: '#FFF3DC', accentBg: '#FFF3DC', accentText: '#7A5200' },
  'Morning snack':   { iconBg: '#E6F9F1', accentBg: '#E6F9F1', accentText: '#005C33' },
  'Lunch':           { iconBg: '#E6F9F1', accentBg: '#E6F9F1', accentText: '#005C33' },
  'Afternoon snack': { iconBg: '#FDEEF5', accentBg: '#FDEEF5', accentText: '#8B1A54' },
  'Dinner':          { iconBg: '#EEF0FF', accentBg: '#EEF0FF', accentText: '#1E2580' },
};

const MEAL_TIMES: Record<MealSlotType, string> = {
  'Breakfast':       '7:00 AM',
  'Morning snack':   '10:00 AM',
  'Lunch':           '12:30 PM',
  'Afternoon snack': '3:00 PM',
  'Dinner':          '6:00 PM',
};

// ─── Emoji picker ─────────────────────────────────────────────────────────────

function pickEmoji(name: string, group: string): string {
  const n = name.toLowerCase();
  if (n.includes('liver'))   return '🫀';
  if (n.includes('omena') || n.includes('dagaa')) return '🐟';
  if (n.includes('tilapia') || n.includes('sato') || n.includes('fish')) return '🐟';
  if (n.includes('chicken')) return '🍗';
  if (n.includes('egg'))     return '🥚';
  if (n.includes('beef') || n.includes('goat') || n.includes('meat')) return '🥩';
  if (n.includes('ugali'))   return '🌽';
  if (n.includes('uji') || n.includes('porridge') || n.includes('wimbi') || n.includes('millet')) return '🥣';
  if (n.includes('chapati')) return '🫓';
  if (n.includes('rice') || n.includes('wali')) return '🍚';
  if (n.includes('bean') || n.includes('lentil') || n.includes('maharagwe') || n.includes('dengu')) return '🫘';
  if (n.includes('groundnut') || n.includes('peanut') || n.includes('karanga')) return '🥜';
  if (n.includes('milk') || n.includes('maziwa') || n.includes('yoghurt')) return '🥛';
  if (n.includes('avocado') || n.includes('parachichi')) return '🥑';
  if (n.includes('carrot') || n.includes('karoti'))   return '🥕';
  if (n.includes('pumpkin') || n.includes('butternut') || n.includes('boga')) return '🎃';
  if (n.includes('spinach') || n.includes('mchicha') || n.includes('kale') || n.includes('sukuma')) return '🥬';
  if (n.includes('tomato') || n.includes('nyanya'))   return '🍅';
  if (n.includes('mango') || n.includes('embe'))      return '🥭';
  if (n.includes('banana') || n.includes('ndizi'))    return '🍌';
  if (n.includes('orange') || n.includes('chungwa'))  return '🍊';
  if (n.includes('sweet potato') || n.includes('cassava') || n.includes('muhogo')) return '🍠';
  const g = group.toLowerCase();
  if (g.includes('fish') || g.includes('marine'))  return '🐟';
  if (g.includes('egg'))   return '🥚';
  if (g.includes('meat') || g.includes('offal') || g.includes('poultry')) return '🥩';
  if (g.includes('legume') || g.includes('bean'))  return '🫘';
  if (g.includes('dairy') || g.includes('milk'))   return '🥛';
  if (g.includes('grain') || g.includes('cereal')) return '🌾';
  if (g.includes('leafy') || g.includes('greens')) return '🥬';
  if (g.includes('fruit'))  return '🍎';
  if (g.includes('oil') || g.includes('fat'))      return '🫙';
  return '🍽️';
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface MealCardProps {
  slot: MealSlot;
  index: number;
  onSwap: (slot: MealSlot) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const MealCard = React.memo(({ slot, index, onSwap }: MealCardProps) => {
  const fade    = useRef(new Animated.Value(0)).current;
  const slideY  = useRef(new Animated.Value(16)).current;
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,   { toValue: 1, duration: 300, delay: index * 65, useNativeDriver: true }),
      Animated.timing(slideY, { toValue: 0, duration: 300, delay: index * 65, useNativeDriver: true }),
    ]).start();
  }, []);

  const palette  = SLOT_PALETTE[slot.type];
  const emoji    = pickEmoji(slot.primaryFood.food_name, slot.primaryFood.who_group);
  const foods    = [slot.primaryFood, slot.secondFood, slot.thirdFood].filter(Boolean) as EnrichedFood[];
  const isSnack  = slot.isSnack;

  return (
    <Animated.View style={{ opacity: fade, transform: [{ translateY: slideY }] }}>
      <View style={s.card}>

        {/* ── Header ── */}
        <TouchableOpacity
          style={s.header}
          onPress={() => setExpanded(e => !e)}
          activeOpacity={0.8}
        >
          {/* Icon box */}
          <View style={[s.iconBox, { backgroundColor: palette.iconBg }]}>
            <Text style={s.iconEmoji}>{emoji}</Text>
          </View>

          {/* Title block */}
          <View style={s.titleBlock}>
            <Text style={s.slotLabel}>
              {slot.type} · {MEAL_TIMES[slot.type]}
            </Text>
            <Text style={s.mealName} numberOfLines={2}>{slot.mealName}</Text>
          </View>

          {/* Right: badge + chevron */}
          <View style={s.rightCol}>
            <View style={[s.badge, { backgroundColor: palette.accentBg }]}>
              <Text style={[s.badgeText, { color: palette.accentText }]}>
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
        <View style={s.divider} />

        {/* ── Footer ── */}
        <View style={s.footer}>

          {/* Food pills — always visible */}
          <View style={s.pillRow}>
            {foods.map(f => (
              <View key={f.food_id} style={s.foodPill}>
                <Text style={s.foodPillText}>
                  {f.local_name ?? f.food_name}
                </Text>
              </View>
            ))}
          </View>

          {/* Expanded content */}
          {expanded && (
            <>
              {slot.nutrients.length > 0 && (
                <View style={s.pillRow}>
                  {slot.nutrients.map(tag => (
                    <View key={tag} style={[s.nutrientPill, { backgroundColor: palette.accentBg }]}>
                      <Text style={[s.nutrientPillText, { color: palette.accentText }]}>
                        {tag}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {!!slot.synergyNote && (
                <View style={s.synergyBox}>
                  <Ionicons name="flash" size={12} color={COLORS.primary} />
                  <Text style={s.synergyText}>
                    <Text style={{ fontFamily: FONTS.semibold }}>Synergy: </Text>
                    {slot.synergyNote}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={s.swapBtn}
                onPress={() => onSwap(slot)}
                activeOpacity={0.7}
              >
                <Ionicons name="shuffle-outline" size={13} color={COLORS.textSecondary} />
                <Text style={s.swapText}>Try different foods</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Animated.View>
  );
});

MealCard.displayName = 'MealCard';

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginBottom: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 13,
    paddingBottom: 12,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconEmoji: {
    fontSize: 24,
    lineHeight: 30,
  },
  titleBlock: {
    flex: 1,
    gap: 2,
  },
  slotLabel: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mealName: {
    fontFamily: FONTS.semibold,
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 19,
  },
  rightCol: {
    alignItems: 'flex-end',
    gap: 2,
    flexShrink: 0,
  },
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 99,
  },
  badgeText: {
    fontFamily: FONTS.semibold,
    fontSize: 10,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginHorizontal: 14,
  },
  footer: {
    padding: 10,
    paddingHorizontal: 14,
    paddingBottom: 13,
    gap: 8,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  foodPill: {
    backgroundColor: '#F4F4F4',
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  foodPillText: {
    fontFamily: FONTS.semibold,
    fontSize: 11,
    color: '#444444',
  },
  nutrientPill: {
    borderRadius: 99,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  nutrientPillText: {
    fontFamily: FONTS.semibold,
    fontSize: 10,
  },
  synergyBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.md,
    padding: 10,
  },
  synergyText: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.primary,
    flex: 1,
    lineHeight: 16,
  },
  swapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F4F4F4',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  swapText: {
    fontFamily: FONTS.semibold,
    fontSize: 11,
    color: COLORS.textSecondary,
  },
});