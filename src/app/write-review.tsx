/**
 * src/app/(tabs)/write-review.tsx
 * ZuriHealth — Write / Edit Review Screen
 */
import { useReviewStore } from '@/store/reviewStore';
import { useAuthStore } from '@/store/authStore';
import { COLORS, RADIUS } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function WriteReviewScreen() {
  const router = useRouter();
  const { session } = useAuthStore();
  const { myReview, submitting, submitReview, fetchMyReview } = useReviewStore();

  const [rating, setRating] = useState(myReview?.rating ?? 0);
  const [title, setTitle] = useState(myReview?.title ?? '');
  const [body, setBody] = useState(myReview?.body ?? '');

  useEffect(() => {
    if (session?.user?.id) fetchMyReview(session.user.id);
  }, []);

  // Sync fields when myReview loads (e.g. editing an existing review)
  useEffect(() => {
    if (myReview) {
      setRating(myReview.rating);
      setTitle(myReview.title ?? '');
      setBody(myReview.body ?? '');
    }
  }, [myReview]);

  const handleSubmit = async () => {
    if (!session?.user?.id) {
      Alert.alert('Not signed in', 'Please sign in to leave a review.');
      return;
    }
    if (rating === 0) {
      Alert.alert('Rating required', 'Please select a star rating.');
      return;
    }

    const { error } = await submitReview(
      session.user.id,
      rating,
      title.trim(),
      body.trim()
    );

    if (error) {
      Alert.alert('Could not save review', error);
      return;
    }

    router.back();
  };

  const isEdit = !!myReview;

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.onPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{isEdit ? 'Edit Review' : 'Write a Review'}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={s.prompt}>How would you rate your experience with ZuriHealth?</Text>

        {/* Star picker */}
        <View style={s.starRow}>
          {[1, 2, 3, 4, 5].map(i => (
            <TouchableOpacity key={i} onPress={() => setRating(i)} activeOpacity={0.7}>
              <Ionicons
                name={i <= rating ? 'star' : 'star-outline'}
                size={44}
                color={i <= rating ? '#F59E0B' : '#D1D5DB'}
              />
            </TouchableOpacity>
          ))}
        </View>
        {rating > 0 && (
          <Text style={s.ratingLabel}>
            {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][rating]}
          </Text>
        )}

        {/* Title */}
        <Text style={s.label}>
          Title <Text style={s.optional}>(optional)</Text>
        </Text>
        <TextInput
          style={s.input}
          placeholder="Summarise your experience..."
          placeholderTextColor={COLORS.textMuted}
          value={title}
          onChangeText={setTitle}
          maxLength={80}
        />
        <Text style={s.charCount}>{title.length}/80</Text>

        {/* Body */}
        <Text style={s.label}>
          Review <Text style={s.optional}>(optional)</Text>
        </Text>
        <TextInput
          style={[s.input, s.textarea]}
          placeholder="Tell other parents what you think..."
          placeholderTextColor={COLORS.textMuted}
          value={body}
          onChangeText={setBody}
          multiline
          maxLength={500}
          textAlignVertical="top"
        />
        <Text style={s.charCount}>{body.length}/500</Text>

        {/* Submit */}
        <TouchableOpacity
          style={[s.submitBtn, (rating === 0 || submitting) && s.submitDisabled]}
          onPress={handleSubmit}
          disabled={rating === 0 || submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.submitText}>
              {isEdit ? 'Update Review' : 'Submit Review'}
            </Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 60 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: COLORS.background },
  header:         { backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16 },
  backBtn:        { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  headerTitle:    { fontSize: 18, fontWeight: '800', color: COLORS.onPrimary },
  scroll:         { padding: 20 },
  prompt:         { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary, textAlign: 'center', marginBottom: 20 },
  starRow:        { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 8 },
  ratingLabel:    { textAlign: 'center', fontSize: 14, fontWeight: '700', color: '#F59E0B', marginBottom: 24 },
  label:          { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  optional:       { fontWeight: '400', color: COLORS.textMuted },
  input:          { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: 12, fontSize: 14, color: COLORS.textPrimary, marginBottom: 4 },
  textarea:       { minHeight: 120 },
  charCount:      { fontSize: 11, color: COLORS.textMuted, textAlign: 'right', marginBottom: 16 },
  submitBtn:      { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: 16, alignItems: 'center', marginTop: 8 },
  submitDisabled: { opacity: 0.5 },
  submitText:     { color: '#fff', fontSize: 16, fontWeight: '700' },
});