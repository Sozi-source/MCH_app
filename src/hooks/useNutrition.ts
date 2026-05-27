﻿/**
 * src/hooks/useNutrition.ts
 */

import { useEffect } from 'react';
import {
  useNutritionStore,
  NutritionFeedingStage,
  NutritionFoodGroup,
  NutritionTip,
  CounsellingMessage,
  EBFGuidance,
  NutritionMilestone,
} from '@/store/nutritionStore';

// ── hydration guard ──────────────────────────────────────────────────────────

function useEnsureHydrated() {
  const hydrated = useNutritionStore(s => s.hydrated);
  const loading  = useNutritionStore(s => s.loading);

  useEffect(() => {
    if (!hydrated && !loading) {
      useNutritionStore.getState().fetchAll();
    }
  }, [hydrated, loading]);
}

// ── public hooks ─────────────────────────────────────────────────────────────

export function useFeedingStage(ageMonths: number): {
  data: NutritionFeedingStage | null;
  isLoading: boolean;
  error: string | null;
} {
  useEnsureHydrated();
  const isLoading           = useNutritionStore(s => s.loading);
  const error               = useNutritionStore(s => s.error);
  const getFeedingStageForAge = useNutritionStore(s => s.getFeedingStageForAge);
  return { data: getFeedingStageForAge(ageMonths), isLoading, error };
}

export function useNutritionTips(ageMonths: number): {
  data: NutritionTip[];
  isLoading: boolean;
  error: string | null;
} {
  useEnsureHydrated();
  const isLoading    = useNutritionStore(s => s.loading);
  const error        = useNutritionStore(s => s.error);
  const getTipsForAge = useNutritionStore(s => s.getTipsForAge);
  return { data: getTipsForAge(ageMonths), isLoading, error };
}

export function useFoodGroups(ageMonths: number): {
  data: NutritionFoodGroup[];
  isLoading: boolean;
  error: string | null;
} {
  useEnsureHydrated();
  const isLoading  = useNutritionStore(s => s.loading);
  const error      = useNutritionStore(s => s.error);
  const foodGroups = useNutritionStore(s => s.foodGroups);
  const data = ageMonths < 6
    ? []
    : foodGroups.filter(g => g.mdd_group_number !== 1);
  return { data, isLoading, error };
}

export function useCounsellingMessages(ageMonths: number): {
  data: CounsellingMessage[];
  isLoading: boolean;
  error: string | null;
} {
  useEnsureHydrated();
  const isLoading           = useNutritionStore(s => s.loading);
  const error               = useNutritionStore(s => s.error);
  const getCounsellingForAge = useNutritionStore(s => s.getCounsellingForAge);
  return { data: getCounsellingForAge(ageMonths), isLoading, error };
}

export function useEBFGuidance(ageMonths: number): {
  data: EBFGuidance[];
  isLoading: boolean;
  error: string | null;
} {
  useEnsureHydrated();
  const isLoading           = useNutritionStore(s => s.loading);
  const error               = useNutritionStore(s => s.error);
  const getEBFGuidanceForAge = useNutritionStore(s => s.getEBFGuidanceForAge);
  return { data: getEBFGuidanceForAge(ageMonths), isLoading, error };
}

export function useNutritionMilestones(ageMonths: number): {
  data: NutritionMilestone[];
  isLoading: boolean;
  error: string | null;
} {
  useEnsureHydrated();
  const isLoading            = useNutritionStore(s => s.loading);
  const error                = useNutritionStore(s => s.error);
  const getMilestonesForAge  = useNutritionStore(s => s.getMilestonesForAge);
  return { data: getMilestonesForAge(ageMonths), isLoading, error };
}

export function useUpcomingMilestones(
  ageMonths: number,
  lookaheadMonths = 3,
): {
  data: NutritionMilestone[];
  isLoading: boolean;
  error: string | null;
} {
  useEnsureHydrated();
  const isLoading            = useNutritionStore(s => s.loading);
  const error                = useNutritionStore(s => s.error);
  const getUpcomingMilestones = useNutritionStore(s => s.getUpcomingMilestones);
  return { data: getUpcomingMilestones(ageMonths, lookaheadMonths), isLoading, error };
}