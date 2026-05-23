/**
 * src/components/RatingPrompt.tsx
 * ZuriHealth — Smart in-app rating prompt
 *
 * Usage: mount once in your root layout or any tab screen.
 * Call triggerPrompt('action_name') after a meaningful user action.
 *
 * Example triggers (add to your screens):
 *   import { useTriggerRatingPrompt } from '@/components/RatingPrompt';
 *   const triggerPrompt = useTriggerRatingPrompt();
 *   // After vaccine logged:
 *   triggerPrompt('vaccine_logged');
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useReviewStore } from '@/store/reviewStore';
import { useAuthStore } from '@/store/authStore';

// ── Singleton trigger ────────────────────────────────────────────────────────
type TriggerFn = (action: string) => void;
let _globalTrigger: TriggerFn | null = null;

export function useTriggerRatingPrompt(): TriggerFn {
  return useCallback((action: string) => {
    _globalTrigger?.(action);
  }, []);
}

// ── Component ────────────────────────────────────────────────────────────────
const COLORS = {
  primary: '#1251A3',
  primaryLight: '#EEF3FB',
  accent: '#F59E0B',
  text: '#111827',
  textSecondary: '#6B7280',
  border: '#E5E7EB',
  white: '#FFFFFF',
  overlay: 'rgba(0,0,0,0.45)',
};

export default function RatingPrompt() {
  const user = useAuthStore(s => s.user);
  const shouldShowPrompt = useReviewStore(s => s.shouldShowPrompt);
  const markPromptShown = useReviewStore(s => s.markPromptShown);
  const myReview = useReviewStore(s => s.myReview);
  const fetchMyReview = useReviewStore(s => s.fetchMyReview);

  const [visible, setVisible] = useState(false);
  const [selectedRating, setSelectedRating] = useState(0);
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const currentAction = useRef('');

  // Register global trigger
  useEffect(() => {
    _globalTrigger = handleTrigger;
    return () => { _globalTrigger = null; };
  }, [user?.id, myReview]);

  useEffect(() => {
    if (user?.id) fetchMyReview(user.id);
  }, [user?.id]);

  const handleTrigger = async (action: string) => {
    if (!user?.id) return;
    if (myReview) return; // already reviewed — don't prompt again
    const should = await shouldShowPrompt(user.id);
    if (!should) return;
    currentAction.current = action;
    showModal();
  };

  const showModal = () => {
    setVisible(true);
    setSelectedRating(0);
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 8 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  const hideModal = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 0.85, useNativeDriver: true, tension: 80, friction: 8 }),
      Animated.timing(opacityAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start(() => setVisible(false));
  };

  const handleDismiss = async () => {
    if (user?.id) await markPromptShown(user.id, currentAction.current);
    hideModal();
  };

  const handleRating = async (stars: number) => {
    setSelectedRating(stars);
    if (user?.id) await markPromptShown(user.id, currentAction.current);

    setTimeout(() => {
      hideModal();
      if (stars >= 4) {
        // High rating → send to reviews screen to write full review
        router.push('/(tabs)/reviews');
      } else {
        // Low rating → send to write review screen for feedback
        router.push('/(tabs)/write-review');
      }
    }, 400);
  };

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={handleDismiss}>
      <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
        <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>

          {/* Close */}
          <TouchableOpacity style={styles.closeBtn} onPress={handleDismiss}>
            <Ionicons name="close" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>

          {/* Icon */}
          <View style={styles.iconWrap}>
            <Ionicons name="heart" size={32} color={COLORS.primary} />
          </View>

          {/* Copy */}
          <Text style={styles.title}>Enjoying ZuriHealth?</Text>
          <Text style={styles.subtitle}>
            Your feedback helps us improve care for mothers and children.
          </Text>

          {/* Stars */}
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map(star => (
              <TouchableOpacity
                key={star}
                onPress={() => handleRating(star)}
                activeOpacity={0.7}
                style={styles.starBtn}
              >
                <Ionicons
                  name={selectedRating >= star ? 'star' : 'star-outline'}
                  size={36}
                  color={selectedRating >= star ? COLORS.accent : COLORS.border}
                />
              </TouchableOpacity>
            ))}
          </View>

          {/* Not now */}
          <TouchableOpacity onPress={handleDismiss} style={styles.notNowBtn}>
            <Text style={styles.notNowText}>Not now</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.2, shadowRadius: 24 },
      android: { elevation: 16 },
      default: {},
    }),
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    padding: 6,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  starBtn: {
    padding: 4,
  },
  notNowBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  notNowText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
});

// Need Platform for card shadow
import { Platform } from 'react-native';