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
  submitReview: (
    userId: string,
    rating: number,
    title: string,
    body: string
  ) => Promise<{ error: string | null }>;
  deleteMyReview: (userId: string) => Promise<{ error: string | null }>;
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

  // ─── Fetch all reviews ──────────────────────────────────────────────────────
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
      console.error('[fetchReviews]', e.message);
      set({ loading: false, error: e.message });
    }
  },

  // ─── Fetch current user's review ────────────────────────────────────────────
  fetchMyReview: async (userId) => {
    try {
      const { data, error } = await supabase
        .from('app_reviews')
        .select('*')
        .eq('user_id', userId)   // ✅ fixed: was 'auth_user_id'
        .maybeSingle();

      if (error) throw error;
      set({ myReview: data as AppReview | null });
    } catch (e: any) {
      console.error('[fetchMyReview]', e.message);
    }
  },

  // ─── Fetch which reviews the user has marked helpful ────────────────────────
  fetchMyHelpfulVotes: async (userId) => {
    try {
      const { data, error } = await supabase
        .from('review_helpful_votes')
        .select('review_id')
        .eq('user_id', userId);

      if (error) throw error;
      const ids = new Set<string>((data ?? []).map((r: any) => r.review_id as string));
      set({ myHelpfulVotes: ids });
    } catch (e: any) {
      console.error('[fetchMyHelpfulVotes]', e.message);
    }
  },

  // ─── Submit (insert or update) a review ─────────────────────────────────────
  submitReview: async (userId, rating, title, body) => {
    set({ submitting: true, error: null });
    try {
      // Resolve display_name from the parents table
      const { data: profile } = await supabase
        .from('parents')
        .select('full_name')
        .eq('id', userId)        // ✅ fixed: was 'auth_user_id'
        .maybeSingle();

      const displayName: string = profile?.full_name ?? 'Anonymous';

      const existing = get().myReview;

      if (existing) {
        const { error } = await supabase
          .from('app_reviews')
          .update({
            rating,
            title: title || null,
            body: body || null,
            display_name: displayName,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .eq('user_id', userId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('app_reviews')
          .insert({
            user_id: userId,
            rating,
            title: title || null,
            body: body || null,
            display_name: displayName,
          });

        if (error) throw error;
      }

      await get().fetchReviews();
      await get().fetchMyReview(userId);

      set({ submitting: false });
      return { error: null };
    } catch (e: any) {
      console.error('[submitReview]', e.message);
      set({ submitting: false, error: e.message });
      return { error: e.message };
    }
  },

  // ─── Delete current user's review ───────────────────────────────────────────
  deleteMyReview: async (userId) => {
    const existing = get().myReview;
    if (!existing) return { error: null };

    try {
      const { error } = await supabase
        .from('app_reviews')
        .delete()
        .eq('id', existing.id)
        .eq('user_id', userId);

      if (error) throw error;

      set({ myReview: null });
      await get().fetchReviews();
      return { error: null };
    } catch (e: any) {
      console.error('[deleteMyReview]', e.message);
      return { error: e.message };
    }
  },

  // ─── Toggle helpful vote (optimistic update) ────────────────────────────────
  toggleHelpful: async (reviewId, userId) => {
    const voted = get().myHelpfulVotes.has(reviewId);

    const nextVotes = new Set(get().myHelpfulVotes);
    if (voted) {
      nextVotes.delete(reviewId);
    } else {
      nextVotes.add(reviewId);
    }
    set({
      myHelpfulVotes: nextVotes,
      reviews: get().reviews.map(r =>
        r.id === reviewId
          ? { ...r, helpful_count: voted ? Math.max(0, r.helpful_count - 1) : r.helpful_count + 1 }
          : r
      ),
    });

    try {
      if (voted) {
        const { error } = await supabase
          .from('review_helpful_votes')
          .delete()
          .eq('review_id', reviewId)
          .eq('user_id', userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('review_helpful_votes')
          .insert({ review_id: reviewId, user_id: userId });
        if (error) throw error;
      }
    } catch (e: any) {
      console.error('[toggleHelpful]', e.message);

      // Roll back optimistic update on failure
      const rollback = new Set(get().myHelpfulVotes);
      if (voted) {
        rollback.add(reviewId);
      } else {
        rollback.delete(reviewId);
      }
      set({
        myHelpfulVotes: rollback,
        reviews: get().reviews.map(r =>
          r.id === reviewId
            ? { ...r, helpful_count: voted ? r.helpful_count + 1 : Math.max(0, r.helpful_count - 1) }
            : r
        ),
      });
    }
  },

  // ─── Rating prompt helpers ───────────────────────────────────────────────────
  shouldShowPrompt: async (userId) => {
    try {
      const { data } = await supabase
        .from('rating_prompt_log')
        .select('prompted_at')
        .eq('user_id', userId)   // ✅ fixed: was 'auth_user_id'
        .maybeSingle();

      if (!data) return true;
      const days = (Date.now() - new Date(data.prompted_at).getTime()) / 86_400_000;
      return days >= 30;
    } catch {
      return false;
    }
  },

  markPromptShown: async (userId, action) => {
    try {
      await supabase
        .from('rating_prompt_log')
        .upsert(
          { user_id: userId, prompted_at: new Date().toISOString(), action },
          { onConflict: 'user_id' }
        );
    } catch (e: any) {
      console.error('[markPromptShown]', e.message);
    }
  },
}));