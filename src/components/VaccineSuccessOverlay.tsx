// src/components/VaccineSuccessOverlay.tsx
import { COLORS, FONTS } from '@/lib/theme';
import LottieView from 'lottie-react-native';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';

interface VaccineSuccessOverlayProps {
  visible: boolean;
  vaccineName: string;
}

export function VaccineSuccessOverlay({ visible, vaccineName }: VaccineSuccessOverlayProps) {
  const scale   = useSharedValue(0.85);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      scale.value   = withSpring(1, { damping: 16, stiffness: 180 });
      opacity.value = withTiming(1, { duration: 200 });
    } else {
      scale.value   = withSpring(0.85);
      opacity.value = withTiming(0, { duration: 150 });
    }
  }, [visible]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const cardStyle    = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  if (!visible) return null;

  return (
    <Animated.View style={[styles.overlay, overlayStyle]}>
      <Animated.View style={[styles.card, cardStyle]}>
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
