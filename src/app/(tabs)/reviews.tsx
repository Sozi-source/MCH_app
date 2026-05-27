/**
 * src/app/(tabs)/reviews.tsx
 * ZuriHealth — App Reviews Screen
 * Fully optimized with proper delete functionality
 */

import { useReviewStore } from '@/store/reviewStore';
import { useAuthStore } from '@/store/authStore';
import { COLORS, RADIUS, FONTS } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// ─────────────────────────────────────────────────────────────────────────────
// Stars Component - Memoized for performance
// ─────────────────────────────────────────────────────────────────────────────

const Stars = ({ rating, size = 16 }: { rating: number; size?: number }) => (
  <View style={styles.starsRow}>
    {[1, 2, 3, 4, 5].map(i => (
      <Ionicons
        key={i}
        name={i <= rating ? 'star' : 'star-outline'}
        size={size}
        color={i <= rating ? '#F59E0B' : '#D1D5DB'}
      />
    ))}
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// Review Card Component - Extracted for performance
// ─────────────────────────────────────────────────────────────────────────────

interface ReviewCardProps {
  review: any;
  myHelpfulVotes: Set<string>;
  onHelpfulPress: (reviewId: string) => void;
  showHelpful?: boolean;
}

const ReviewCard = ({ review, myHelpfulVotes, onHelpfulPress, showHelpful = true }: ReviewCardProps) => (
  <View style={styles.reviewCard}>
    <View style={styles.reviewTop}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {(review.display_name?.[0] ?? '?').toUpperCase()}
        </Text>
      </View>
      <View style={styles.reviewerInfo}>
        <Text style={styles.reviewerName}>
          {review.display_name ?? 'Anonymous'}
        </Text>
        <Stars rating={review.rating} size={13} />
      </View>
      <Text style={styles.reviewDate}>
        {new Date(review.created_at).toLocaleDateString('en-KE', {
          day: 'numeric',
          month: 'short',
        })}
      </Text>
    </View>
    
    {review.title ? (
      <Text style={styles.reviewTitle}>{review.title}</Text>
    ) : null}
    
    {review.body ? (
      <Text style={styles.reviewBody}>{review.body}</Text>
    ) : null}
    
    {showHelpful && (
      <TouchableOpacity
        style={styles.helpfulBtn}
        onPress={() => onHelpfulPress(review.id)}
        activeOpacity={0.7}
      >
        <Ionicons
          name={myHelpfulVotes.has(review.id) ? 'thumbs-up' : 'thumbs-up-outline'}
          size={14}
          color={myHelpfulVotes.has(review.id) ? COLORS.primary : COLORS.textMuted}
        />
        <Text
          style={[
            styles.helpfulText,
            myHelpfulVotes.has(review.id) && { color: COLORS.primary },
          ]}
        >
          Helpful {review.helpful_count > 0 ? `(${review.helpful_count})` : ''}
        </Text>
      </TouchableOpacity>
    )}
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function ReviewsScreen() {
  const router = useRouter();
  const { session } = useAuthStore();
  const {
    reviews,
    myReview,
    loading,
    averageRating,
    ratingBreakdown,
    fetchReviews,
    fetchMyReview,
    fetchMyHelpfulVotes,
    toggleHelpful,
    myHelpfulVotes,
    deleteMyReview,
  } = useReviewStore();

  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Load initial data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = useCallback(async () => {
    try {
      await fetchReviews();
      if (session?.user?.id) {
        await Promise.all([
          fetchMyReview(session.user.id),
          fetchMyHelpfulVotes(session.user.id),
        ]);
      }
    } catch (error) {
      console.error('Error loading reviews:', error);
    }
  }, [session?.user?.id, fetchReviews, fetchMyReview, fetchMyHelpfulVotes]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // Delete review handler with proper error handling and feedback
  const handleDelete = useCallback(() => {
    if (!session?.user?.id) {
      Alert.alert('Error', 'You must be logged in to delete a review');
      return;
    }

    Alert.alert(
      'Delete Review',
      'Are you sure you want to delete your review? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              const { error } = await deleteMyReview(session.user.id);
              if (error) {
                Alert.alert('Error', error);
              } else {
                Alert.alert('Success', 'Your review has been deleted');
                // Refresh the data after successful deletion
                await loadData();
              }
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Could not delete review');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  }, [session?.user?.id, deleteMyReview, loadData]);

  // Handle helpful votes
  const handleHelpfulPress = useCallback(async (reviewId: string) => {
    if (!session?.user?.id) {
      Alert.alert('Sign In', 'Please sign in to mark reviews as helpful');
      return;
    }
    try {
      await toggleHelpful(reviewId, session.user.id);
    } catch (error) {
      console.error('Error toggling helpful:', error);
    }
  }, [session?.user?.id, toggleHelpful]);

  // Memoized filtered reviews (exclude user's own review)
  const otherReviews = useMemo(() => 
    reviews.filter(r => r.id !== myReview?.id),
    [reviews, myReview]
  );

  // Calculate total reviews
  const totalReviews = useMemo(() => 
    Object.values(ratingBreakdown).reduce((a, b) => a + b, 0),
    [ratingBreakdown]
  );

  // Navigate to write review
  const handleWriteReview = useCallback(() => {
    router.push('/write-review' as any);
  }, [router]);

  // Go back
  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  // Loading state
  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading reviews...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={handleBack} 
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.onPrimary} />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Reviews</Text>
        
        <TouchableOpacity
          style={styles.writeBtn}
          onPress={handleWriteReview}
          activeOpacity={0.7}
        >
          <Ionicons name="create-outline" size={20} color={COLORS.onPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
      >
        {/* Rating Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryLeft}>
            <Text style={styles.bigRating}>{averageRating.toFixed(1)}</Text>
            <Stars rating={Math.round(averageRating)} size={20} />
            <Text style={styles.totalText}>
              {totalReviews} review{totalReviews !== 1 ? 's' : ''}
            </Text>
          </View>
          
          <View style={styles.summaryRight}>
            {([5, 4, 3, 2, 1] as const).map(star => {
              const count = ratingBreakdown[star] ?? 0;
              const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
              return (
                <View key={star} style={styles.barRow}>
                  <Text style={styles.barLabel}>{star}</Text>
                  <View style={styles.barBg}>
                    <View style={[styles.barFill, { width: `${percentage}%` }]} />
                  </View>
                  <Text style={styles.barCount}>{count}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* My Review Section */}
        {myReview ? (
          <View style={styles.myReviewCard}>
            <View style={styles.myReviewHeader}>
              <Text style={styles.myReviewLabel}>Your Review</Text>
              <View style={styles.myReviewActions}>
                <TouchableOpacity
                  onPress={handleWriteReview}
                  style={styles.actionBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons name="pencil-outline" size={16} color={COLORS.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleDelete}
                  style={styles.actionBtn}
                  activeOpacity={0.7}
                  disabled={deleting}
                >
                  {deleting ? (
                    <ActivityIndicator size="small" color="#E53935" />
                  ) : (
                    <Ionicons name="trash-outline" size={16} color="#E53935" />
                  )}
                </TouchableOpacity>
              </View>
            </View>
            <Stars rating={myReview.rating} />
            {myReview.title ? (
              <Text style={styles.reviewTitle}>{myReview.title}</Text>
            ) : null}
            {myReview.body ? (
              <Text style={styles.reviewBody}>{myReview.body}</Text>
            ) : null}
          </View>
        ) : (
          <TouchableOpacity
            style={styles.writePrompt}
            onPress={handleWriteReview}
            activeOpacity={0.7}
          >
            <Ionicons name="star-outline" size={20} color={COLORS.primary} />
            <Text style={styles.writePromptText}>
              Share your experience with ZuriHealth
            </Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}

        {/* Other Users' Reviews */}
        {otherReviews.length > 0 ? (
          otherReviews.map(review => (
            <ReviewCard
              key={review.id}
              review={review}
              myHelpfulVotes={myHelpfulVotes}
              onHelpfulPress={handleHelpfulPress}
              showHelpful={true}
            />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>No reviews yet</Text>
            <Text style={styles.emptySubtitle}>
              Be the first to share your experience
            </Text>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles - Fully optimized and consistent
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Header
  header: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.onPrimary,
    fontFamily: FONTS?.extrabold,
  },
  writeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Scroll Content
  scrollContent: {
    padding: 16,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontFamily: FONTS?.regular,
  },

  // Summary Card
  summaryCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: 16,
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryLeft: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minWidth: 70,
  },
  bigRating: {
    fontSize: 40,
    fontWeight: '800',
    color: COLORS.textPrimary,
    fontFamily: FONTS?.extrabold,
  },
  totalText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontFamily: FONTS?.regular,
  },
  summaryRight: {
    flex: 1,
    gap: 4,
    justifyContent: 'center',
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  barLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    width: 8,
    fontFamily: FONTS?.semibold,
  },
  barBg: {
    flex: 1,
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: 3,
  },
  barCount: {
    fontSize: 11,
    color: COLORS.textMuted,
    width: 16,
    textAlign: 'right',
    fontFamily: FONTS?.semibold,
  },

  // My Review
  myReviewCard: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.lg,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.primary + '40',
  },
  myReviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  myReviewLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    fontFamily: FONTS?.bold,
  },
  myReviewActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    padding: 4,
  },

  // Write Prompt
  writePrompt: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  writePromptText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
    fontFamily: FONTS?.semibold,
  },

  // Review Card
  reviewCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  reviewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
    fontFamily: FONTS?.bold,
  },
  reviewerInfo: {
    flex: 1,
  },
  reviewerName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 2,
    fontFamily: FONTS?.bold,
  },
  reviewDate: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontFamily: FONTS?.regular,
  },
  reviewTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 6,
    marginBottom: 2,
    fontFamily: FONTS?.bold,
  },
  reviewBody: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 20,
    fontFamily: FONTS?.regular,
  },

  // Helpful Button
  helpfulBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  helpfulText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontFamily: FONTS?.regular,
  },

  // Stars
  starsRow: {
    flexDirection: 'row',
    gap: 2,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textSecondary,
    fontFamily: FONTS?.semibold,
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    fontFamily: FONTS?.regular,
  },

  bottomSpacer: {
    height: 100,
  },
});