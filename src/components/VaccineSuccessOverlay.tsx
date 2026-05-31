// src/components/VaccineSuccessOverlay.tsx
// Rewritten to use React Native built-in Animated (no react-native-reanimated)
import { COLORS, FONTS } from '@/lib/theme';
import LottieView from 'lottie-react-native';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

interface VaccineSuccessOverlayProps {
  visible: boolean;
  vaccineName: string;
}

export function VaccineSuccessOverlay({ visible, vaccineName }: VaccineSuccessOverlayProps) {
  const scale   = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale,   { toValue: 1, damping: 16, stiffness: 180, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(scale,   { toValue: 0.85, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.overlay, { opacity }]}>
      <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
        <LottieView
          source={require('@/assets/animations/vaccine_success.json')}
          autoPlay
          loop={false}
          style={styles.lottie}
        />
        <Text style={styles.title}>Vaccine Recorded!</Text>
        <Text style={styles.subtitle} numberOfLines={2}>{vaccineName}</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9998,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 40,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 12,
  },
  lottie: {
    width: 120,
    height: 120,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.given,
    marginTop: 4,
  },
  subtitle: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
});
