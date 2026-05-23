/**
 * src/store/reviewStore.ts
 * ZuriHealth — App Reviews & Ratings store
 */
import { supabase } from '@/lib/supabase';
import { create } from 'zustand';

export interface AppReview {
  id: string;
  user_id: string;
  rating: number;
  title: string | null;
  body: string | null;
  is_verified: boolean;
  helpful_count: number;
  created_at: string;
  updated_at?: string;
  display_name?: string;
}

interface ReviewStore {
  reviews: AppReview[];
  myReview: AppReview | null;
  myHelpfulVotes: Set<string>;
  loading: boolean;
  submitting: boolean;
  error: string | null;

  // Computed
  averageRating: number;
  ratingBreakdown: Record<1 | 2 | 3 | 4 | 5, number>;

  fetchReviews: () => Promise<void>;
  fetchMyReview: (userId: string) => Promise<void>;
  fetchMyHelpfulVotes: (userId: string) => Promise<void>;
  submitReview: (userId: string, rating: number, title: string, body: string) => Promise<void>;
  deleteMyReview: (userId: string) => Promise<void>;
  toggleHelpful: (reviewId: string, userId: string) => Promise<void>;
  shouldShowPrompt: (userId: string) => Promise<boolean>;
  markPromptShown: (userId: string, action: string) => Promise<void>;
}

export const useReviewStore = create<ReviewStore>((set, get) => ({
  reviews: [],
  myReview: null,
  myHelpfulVotes: new Set(),
  loading: false,
  submitting: false,
  error: null,
  averageRating: 0,
  ratingBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },

  fetchReviews: async () => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('app_reviews')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;

      const reviews = (data ?? []) as AppReview[];

      const breakdown: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      let total = 0;
      reviews.forEach(r => {
        breakdown[r.rating] = (breakdown[r.rating] ?? 0) + 1;
        total += r.rating;
      });
      const avg = reviews.length > 0 ? total / reviews.length : 0;

      set({
        reviews,
        averageRating: Math.round(avg * 10) / 10,
        ratingBreakdown: breakdown as Record<1 | 2 | 3 | 4 | 5, number>,
        loading: false,
      });
    } catch (e: any) {
      set({ loading: false, error: e.message });
    }
  },

  fetchMyReview: async (userId) => {
    const { data } = await supabase
      .from('app_reviews')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    set({ myReview: data as AppReview | null });
  },

  fetchMyHelpfulVotes: async (userId) => {
    const { data } = await supabase
      .from('review_helpful_votes')
      .select('review_id')
      .eq('user_id', userId);
    const ids = new Set<string>((data ?? []).map((r: any) => r.review_id as string));
    set({ myHelpfulVotes: ids });
  },

  submitReview: async (userId, rating, title, body) => {
    set({ submitting: true, error: null });
    try {
      const existing = get().myReview;
      if (existing) {
        const { error } = await supabase
          .from('app_reviews')
          .update({ rating, title, body, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('app_reviews')
          .insert({ user_id: userId, rating, title, body });
        if (error) throw error;
      }
      await get().fetchReviews();
      await get().fetchMyReview(userId);
      set({ submitting: false });
    } catch (e: any) {
      set({ submitting: false, error: e.message });
    }
  },

  deleteMyReview: async (userId) => {
    const existing = get().myReview;
    if (!existing) return;
    await supabase.from('app_reviews').delete().eq('id', existing.id);
    set({ myReview: null });
    await get().fetchReviews();
  },

  toggleHelpful: async (reviewId, userId) => {
    const voted = get().myHelpfulVotes.has(reviewId);
    if (voted) {
      await supabase
        .from('review_helpful_votes')
        .delete()
        .eq('review_id', reviewId)
        .eq('user_id', userId);
      const next = new Set(get().myHelpfulVotes);
      next.delete(reviewId);
      set({
        myHelpfulVotes: next,
        reviews: get().reviews.map(r =>
          r.id === reviewId ? { ...r, helpful_count: Math.max(0, r.helpful_count - 1) } : r
        ),
      });
    } else {
      await supabase
        .from('review_helpful_votes')
        .insert({ review_id: reviewId, user_id: userId });
      const next = new Set(get().myHelpfulVotes);
      next.add(reviewId);
      set({
        myHelpfulVotes: next,
        reviews: get().reviews.map(r =>
          r.id === reviewId ? { ...r, helpful_count: r.helpful_count + 1 } : r
        ),
      });
    }
  },

  shouldShowPrompt: async (userId) => {
    const { data } = await supabase
      .from('rating_prompt_log')
      .select('prompted_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (!data) return true;
    const days = (Date.now() - new Date(data.prompted_at).getTime()) / 86_400_000;
    return days >= 30;
  },

  markPromptShown: async (userId, action) => {
    await supabase
      .from('rating_prompt_log')
      .upsert(
        { user_id: userId, prompted_at: new Date().toISOString(), action },
        { onConflict: 'user_id' }
      );
  },
}));