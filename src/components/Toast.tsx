// src/components/Toast.tsx
import { COLORS, FONTS, RADIUS } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  visible: boolean;
  message: string;
  type?: ToastType;
  onHide: () => void;
  duration?: number;
}

const TOAST_CONFIG: Record<ToastType, {
  bg: string; border: string; icon: keyof typeof Ionicons.glyphMap; color: string;
}> = {
  success: { bg: COLORS.givenLight,  border: COLORS.given,  icon: 'checkmark-circle', color: COLORS.given  },
  error:   { bg: COLORS.missedLight, border: COLORS.missed, icon: 'close-circle',     color: COLORS.missed },
  info:    { bg: COLORS.dueLight,    border: COLORS.due,    icon: 'information-circle',color: COLORS.due    },
};

export function Toast({ visible, message, type = 'success', onHide, duration = 3000 }: ToastProps) {
  const translateY = useSharedValue(-20);
  const opacity    = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, { damping: 18, stiffness: 200 });
      opacity.value    = withTiming(1, { duration: 200 });
      const t = setTimeout(() => {
        opacity.value    = withTiming(0, { duration: 200 });
        translateY.value = withTiming(-20, { duration: 200 }, () => runOnJS(onHide)());
      }, duration);
      return () => clearTimeout(t);
    }
  }, [visible]);

  const animStyle = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!visible) return null;

  const cfg = TOAST_CONFIG[type];

  return (
    <Animated.View style={[
      styles.container,
      { backgroundColor: cfg.bg, borderColor: cfg.border },
      animStyle,
    ]}>
      <Ionicons name={cfg.icon} size={18} color={cfg.color} />
      <Text style={[styles.message, { color: cfg.color }]} numberOfLines={2}>
        {message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 8,
  },
  message: {
    flex: 1,
    fontFamily: FONTS.semibold,
    fontSize: 13,
    lineHeight: 18,
  },
});
