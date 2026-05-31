// src/components/Toast.tsx
// Rewritten to use React Native built-in Animated (no react-native-reanimated)
import { COLORS, FONTS, RADIUS } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

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
  const translateY = useRef(new Animated.Value(-20)).current;
  const opacity    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, damping: 18, stiffness: 200, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();

      const t = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity,    { toValue: 0,   duration: 200, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: -20, duration: 200, useNativeDriver: true }),
        ]).start(() => onHide());
      }, duration);

      return () => clearTimeout(t);
    }
  }, [visible]);

  if (!visible) return null;

  const cfg = TOAST_CONFIG[type];

  return (
    <Animated.View style={[
      styles.container,
      { backgroundColor: cfg.bg, borderColor: cfg.border },
      { opacity, transform: [{ translateY }] },
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
