/**
 * src/lib/nutritionService.ts
 *
 * Shared types and pure functions for the ZuriHealth nutrition module.
 * Consumed by nutrition.tsx and useNutrition.ts hooks.
 *
 * No Supabase calls here — all data fetching lives in nutritionStore.ts.
 * This file contains only types and pure computation functions.
 */

// ─────────────────────────────────────────────────────────────────────────────
// RE-EXPORTED TYPES (mirrors nutritionStore types for convenience)
// ─────────────────────────────────────────────────────────────────────────────

export type {
  NutritionFeedingStage,
  NutritionFoodGroup as FoodGroup,
  NutritionTip,
  CounsellingMessage,
  EBFGuidance,
  NutritionMilestone,
} from '@/store/nutritionStore';

// ─────────────────────────────────────────────────────────────────────────────
// MDD STATUS
// ─────────────────────────────────────────────────────────────────────────────

export interface MDDStatus {
  score: number;
  label: 'Excellent' | 'Adequate' | 'Low' | 'Very Low';
  color: string;
  bg: string;
  message: string;
}

/**
 * Compute the WHO Minimum Dietary Diversity score and label.
 *
 * WHO 2021 IYCF Indicators: MDD is met when a child 6–23 months
 * consumes foods from ≥5 of the 8 canonical food groups.
 * The MDD bar in the UI shows /7 (excluding breast milk group 1)
 * which is the practitioner-facing convention in most Kenya materials.
 *
 * @param checked  Record<food_group_id, boolean> — today's checklist state
 * @param groups   The food groups array from the store (used to count)
 */
export function computeMDDStatus(
  checked: Record<string, boolean>,
  groups: { id: string }[],
): MDDStatus {
  const score = groups.filter(g => checked[g.id]).length;

  if (score >= 5) {
    return {
      score,
      label: 'Excellent',
      color: '#2A9D6E',
      bg: '#F0FAF5',
      message: 'Outstanding dietary diversity — well above the WHO minimum.',
    };
  }
  if (score >= 4) {
    return {
      score,
      label: 'Adequate',
      color: '#2A9D6E',
      bg: '#F0FAF5',
      message: 'Good! WHO recommends at least 4 food groups daily for children 6–23 months.',
    };
  }
  if (score >= 2) {
    return {
      score,
      label: 'Low',
      color: '#E07A5F',
      bg: '#FEF3EF',
      message: 'Try to include more food groups today. Aim for at least 4.',
    };
  }
  return {
    score,
    label: 'Very Low',
    color: '#C0392B',
    bg: '#FDF0F0',
    message: 'Your child needs more variety. Add foods from more groups today.',
  };
}