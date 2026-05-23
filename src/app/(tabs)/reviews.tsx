/**
 * src/app/(tabs)/reviews.tsx
 * mamaTOTO — App Reviews Screen
 */
import { useReviewStore } from '@/store/reviewStore';
import { useAuthStore } from '@/store/authStore';
import { COLORS, RADIUS } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

function Stars({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
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
}

export default function ReviewsScreen() {
  const router = useRouter();
  const { session } = useAuthStore();
  const {
    reviews, myReview, loading,
    averageRating, ratingBreakdown,
    fetchReviews, fetchMyReview, fetchMyHelpfulVotes,
    toggleHelpful, myHelpfulVotes, deleteMyReview,
  } = useReviewStore();

  useEffect(() => {
    fetchReviews();
    if (session?.user?.id) {
      fetchMyReview(session.user.id);
      fetchMyHelpfulVotes(session.user.id);
    }
  }, []);

  const handleDelete = () => {
    Alert.alert('Delete Review', 'Are you sure you want to delete your review?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => session?.user?.id && deleteMyReview(session.user.id),
      },
    ]);
  };

  const total = Object.values(ratingBreakdown).reduce((a, b) => a + b, 0);

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.onPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Reviews</Text>
        <TouchableOpacity
          style={s.writeBtn}
          onPress={() => router.push('/write-review' as any)}
        >
          <Ionicons name="create-outline" size={20} color={COLORS.onPrimary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {/* Rating summary */}
          <View style={s.summaryCard}>
            <View style={s.summaryLeft}>
              <Text style={s.bigRating}>{averageRating.toFixed(1)}</Text>
              <Stars rating={Math.round(averageRating)} size={20} />
              <Text style={s.totalText}>{total} review{total !== 1 ? 's' : ''}</Text>
            </View>
            <View style={s.summaryRight}>
              {([5, 4, 3, 2, 1] as const).map(star => {
                const count = ratingBreakdown[star] ?? 0;
                const pct = total > 0 ? count / total : 0;
                return (
                  <View key={star} style={s.barRow}>
                    <Text style={s.barLabel}>{star}</Text>
                    <View style={s.barBg}>
                      <View style={[s.barFill, { width: `${pct * 100}%` as any }]} />
                    </View>
                    <Text style={s.barCount}>{count}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* My review */}
          {myReview ? (
            <View style={s.myReviewCard}>
              <View style={s.myReviewHeader}>
                <Text style={s.myReviewLabel}>Your Review</Text>
                <View style={s.myReviewActions}>
                  <TouchableOpacity onPress={() => router.push('/write-review' as any)} style={s.editBtn}>
                    <Ionicons name="pencil-outline" size={16} color={COLORS.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleDelete} style={s.editBtn}>
                    <Ionicons name="trash-outline" size={16} color="#E53935" />
                  </TouchableOpacity>
                </View>
              </View>
              <Stars rating={myReview.rating} />
              {myReview.title ? <Text style={s.reviewTitle}>{myReview.title}</Text> : null}
              {myReview.body ? <Text style={s.reviewBody}>{myReview.body}</Text> : null}
            </View>
          ) : (
            <TouchableOpacity
              style={s.writePrompt}
              onPress={() => router.push('/write-review' as any)}
            >
              <Ionicons name="star-outline" size={20} color={COLORS.primary} />
              <Text style={s.writePromptText}>Share your experience with mamaTOTO</Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}

          {/* All reviews */}
          {reviews.filter(r => r.id !== myReview?.id).map(r => (
            <View key={r.id} style={s.reviewCard}>
              <View style={s.reviewTop}>
                <View style={s.avatar}>
                  <Text style={s.avatarText}>{(r.display_name?.[0] ?? '?').toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.reviewerName}>{r.display_name ?? 'Anonymous'}</Text>
                  <Stars rating={r.rating} size={13} />
                </View>
                <Text style={s.reviewDate}>
                  {new Date(r.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}
                </Text>
              </View>
              {r.title ? <Text style={s.reviewTitle}>{r.title}</Text> : null}
              {r.body ? <Text style={s.reviewBody}>{r.body}</Text> : null}
              <TouchableOpacity
                style={s.helpfulBtn}
                onPress={() => session?.user?.id && toggleHelpful(r.id, session.user.id)}
              >
                <Ionicons
                  name={myHelpfulVotes.has(r.id) ? 'thumbs-up' : 'thumbs-up-outline'}
                  size={14}
                  color={myHelpfulVotes.has(r.id) ? COLORS.primary : COLORS.textMuted}
                />
                <Text style={[s.helpfulText, myHelpfulVotes.has(r.id) && { color: COLORS.primary }]}>
                  Helpful {r.helpful_count > 0 ? `(${r.helpful_count})` : ''}
                </Text>
              </TouchableOpacity>
            </View>
          ))}

          <View style={{ height: 100 }} />
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container:       { flex: 1, backgroundColor: COLORS.background },
  header:          { backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16 },
  backBtn:         { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  headerTitle:     { fontSize: 20, fontWeight: '800', color: COLORS.onPrimary },
  writeBtn:        { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  scroll:          { padding: 16 },
  summaryCard:     { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 16, flexDirection: 'row', gap: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  summaryLeft:     { alignItems: 'center', justifyContent: 'center', gap: 6, minWidth: 70 },
  bigRating:       { fontSize: 40, fontWeight: '800', color: COLORS.textPrimary },
  totalText:       { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  summaryRight:    { flex: 1, gap: 4, justifyContent: 'center' },
  barRow:          { flexDirection: 'row', alignItems: 'center', gap: 6 },
  barLabel:        { fontSize: 11, color: COLORS.textMuted, width: 8 },
  barBg:           { flex: 1, height: 6, backgroundColor: COLORS.border, borderRadius: 3, overflow: 'hidden' },
  barFill:         { height: '100%', backgroundColor: '#F59E0B', borderRadius: 3 },
  barCount:        { fontSize: 11, color: COLORS.textMuted, width: 16, textAlign: 'right' },
  myReviewCard:    { backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.lg, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: COLORS.primary + '40' },
  myReviewHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  myReviewLabel:   { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  myReviewActions: { flexDirection: 'row', gap: 8 },
  editBtn:         { padding: 4 },
  writePrompt:     { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  writePromptText: { flex: 1, fontSize: 14, color: COLORS.textSecondary, fontWeight: '500' },
  reviewCard:      { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border },
  reviewTop:       { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  avatar:          { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  avatarText:      { fontSize: 15, fontWeight: '700', color: COLORS.primary },
  reviewerName:    { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 2 },
  reviewDate:      { fontSize: 11, color: COLORS.textMuted },
  reviewTitle:     { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginTop: 6, marginBottom: 2 },
  reviewBody:      { fontSize: 13, color: COLORS.textSecondary, lineHeight: 20 },
  helpfulBtn:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border },
  helpfulText:     { fontSize: 12, color: COLORS.textMuted },
});