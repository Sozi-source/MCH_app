/**
 * ZuriHealth — Premium Login Screen
 * Theme: App's native blue palette (#208AEF primary)
 * Aesthetic: Clean tech-health — hero photo + blue overlay, white card, crisp typography
 *
 * KEYBOARD FIX:
 *  - Hero moved INSIDE ScrollView so it scrolls away when keyboard opens
 *  - behavior="padding" on both platforms
 *  - scrollToEnd() fired on every input focus
 *  - card has no flex:1 / minHeight so it doesn't fight keyboard avoidance
 *  - Safe-area bottom padding so nothing hides behind home bar
 */

import { supabase } from '@/lib/supabase';
import { COLORS, RADIUS } from '@/lib/theme';
import { useAuthStore } from '@/store/authStore';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: W, height: H } = Dimensions.get('window');

// --- Stagger-in hook ----------------------------------------------------------
function useStaggerIn(count: number, delay = 90) {
  const anims = useRef(
    Array.from({ length: count }, () => new Animated.Value(0))
  ).current;

  useEffect(() => {
    Animated.stagger(
      delay,
      anims.map(a =>
        Animated.timing(a, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        })
      )
    ).start();
  }, []);

  return anims.map(a => ({
    opacity: a,
    transform: [
      { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
    ],
  }));
}

// --- Input field --------------------------------------------------------------
interface PremiumInputProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  secure?: boolean;
  icon: string;
  keyboardType?: any;
  autoCapitalize?: any;
  onFocusScroll?: () => void; // ← new: lets parent scroll to this field
}

function PremiumInput({
  label,
  value,
  onChange,
  placeholder,
  secure,
  icon,
  keyboardType,
  autoCapitalize,
  onFocusScroll,
}: PremiumInputProps) {
  const [focused, setFocused] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const focusAnim = useRef(new Animated.Value(0)).current;

  const handleFocus = () => {
    setFocused(true);
    Animated.timing(focusAnim, { toValue: 1, duration: 180, useNativeDriver: false }).start();
    onFocusScroll?.(); // scroll parent so this field is visible
  };

  const handleBlur = () => {
    setFocused(false);
    Animated.timing(focusAnim, { toValue: 0, duration: 180, useNativeDriver: false }).start();
  };

  const borderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [COLORS.border, COLORS.primary],
  });
  const bgColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [COLORS.background, COLORS.primaryLight],
  });

  return (
    <View style={inp.wrap}>
      <Text style={inp.label}>{label}</Text>
      <Animated.View style={[inp.box, { borderColor, backgroundColor: bgColor }]}>
        <Ionicons
          name={icon as any}
          size={18}
          color={focused ? COLORS.primary : COLORS.textMuted}
          style={inp.icon}
        />
        <TextInput
          style={inp.field}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textMuted}
          secureTextEntry={secure && !showPwd}
          keyboardType={keyboardType ?? 'default'}
          autoCapitalize={autoCapitalize ?? 'sentences'}
          autoCorrect={false}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
        {secure && (
          <TouchableOpacity onPress={() => setShowPwd(v => !v)} style={inp.eye}>
            <Ionicons
              name={showPwd ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={COLORS.textMuted}
            />
          </TouchableOpacity>
        )}
      </Animated.View>
    </View>
  );
}

// --- Main screen --------------------------------------------------------------
export default function LoginScreen() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const router   = useRouter();
  const session  = useAuthStore(s => s.session);
  const hydrated = useAuthStore(s => s.hydrated);
  const insets   = useSafeAreaInsets();

  // ScrollView ref — used to scroll inputs into view on focus
  const scrollRef = useRef<ScrollView>(null);

  // All hooks before early return
  const anims    = useStaggerIn(6);
  const btnScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (hydrated && session) {
      router.replace('/(tabs)/' as any);
    }
  }, [hydrated, session]);

  const onPressIn  = () =>
    Animated.spring(btnScale, { toValue: 0.97, useNativeDriver: true }).start();
  const onPressOut = () =>
    Animated.spring(btnScale, { toValue: 1, useNativeDriver: true }).start();

  const handleLogin = async () => {
    setError('');
    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);

    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    const { data: parent } = await supabase
      .from('parents')
      .select('role')
      .eq('id', data.user.id)
      .single();

    setLoading(false);

    if (parent?.role === 'admin') {
      router.replace('/(admin)/dashboard' as any);
    } else {
      router.replace('/(tabs)/' as any);
    }
  };

  // Scroll helper — scrolls partway so fields sit comfortably above keyboard
  const scrollToBottom = () => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: 80, animated: true });
    }, 100);
  };

  if (!hydrated) return null;

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior="padding" // works correctly on both iOS and Android
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 16 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        bounces={false}
      >
        {/* ── Hero — now INSIDE ScrollView so it scrolls away with keyboard ── */}
        <ImageBackground
          source={require('@/assets/images/hero.jpg')}
          style={s.heroBg}
          resizeMode="cover"
        >
          <View style={s.heroOverlay} />

          <View style={[s.hero, { paddingTop: insets.top + 12 }]}>
            <Animated.View style={[s.logoWrap, anims[0]]}>
              <View style={s.logoRing}>
                <View style={s.logoSquare}>
                  <Ionicons name="heart" size={26} color={COLORS.primary} />
                </View>
              </View>
              <View style={s.logoPulse} />
            </Animated.View>

            <Animated.Text style={[s.appName, anims[1]]}>ZuriHealth</Animated.Text>
            <Animated.View style={[s.taglineRow, anims[2]]}>
              <View style={s.taglineDot} />
              <Text style={s.tagline}>Smart care for every child</Text>
              <View style={s.taglineDot} />
            </Animated.View>
          </View>
        </ImageBackground>

        {/* ── White card ── */}
        <View style={s.card}>
          <View style={s.cardAccentRow}>
            <View style={[s.accentBar, { width: 32, opacity: 0.3 }]} />
            <View style={[s.accentBar, { width: 48 }]} />
            <View style={[s.accentBar, { width: 16, opacity: 0.5 }]} />
          </View>

          <Animated.Text style={[s.cardTitle, anims[3]]}>Welcome back</Animated.Text>
          <Animated.Text style={[s.cardSub, anims[3]]}>
            Sign in to continue caring for your child
          </Animated.Text>

          {!!error && (
            <View style={s.errorBox}>
              <Ionicons name="alert-circle-outline" size={15} color={COLORS.missed} />
              <Text style={s.errorText}>{error}</Text>
            </View>
          )}

          <Animated.View style={anims[4]}>
            <PremiumInput
              label="Email address"
              value={email}
              onChange={setEmail}
              placeholder="you@example.com"
              icon="mail-outline"
              keyboardType="email-address"
              autoCapitalize="none"
              onFocusScroll={scrollToBottom}
            />
            <PremiumInput
              label="Password"
              value={password}
              onChange={setPassword}
              placeholder="Your password"
              icon="lock-closed-outline"
              secure
              onFocusScroll={scrollToBottom}
            />
          </Animated.View>

          <TouchableOpacity
            onPress={() => router.push('/(auth)/forgot-password')}
            style={s.forgotWrap}
          >
            <Text style={s.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          <Animated.View style={[anims[5], { transform: [{ scale: btnScale }] }]}>
            <TouchableOpacity
              style={[s.btn, loading && s.btnLoading]}
              onPress={handleLogin}
              onPressIn={onPressIn}
              onPressOut={onPressOut}
              disabled={loading}
              activeOpacity={1}
            >
              <View style={s.btnInner}>
                {loading ? (
                  <>
                    <View style={s.loadingDot} />
                    <Text style={s.btnText}>Signing in…</Text>
                  </>
                ) : (
                  <>
                    <Text style={s.btnText}>Sign in</Text>
                    <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
                  </>
                )}
              </View>
            </TouchableOpacity>
          </Animated.View>

          <View style={s.signUpRow}>
            <Text style={s.signUpText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')} activeOpacity={0.7}>
              <Text style={s.signUpLink}>Sign up</Text>
            </TouchableOpacity>
          </View>

          <Text style={s.footerNote}>Trusted by families across Kenya 🇰🇪</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// --- Styles -------------------------------------------------------------------
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },

  // ScrollView content — no justifyContent so it doesn't fight scrolling
  scroll: {
    flexGrow: 1,
  },

  // Hero sits inside ScrollView — scrolls away when keyboard opens
  heroBg: {
    width: W,
    height: H * 0.40, // slightly shorter to give card more room
    justifyContent: 'flex-end',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(18, 81, 163, 0.52)',
  },
  hero: {
    alignItems: 'center',
    paddingBottom: 36,
    paddingHorizontal: 24,
  },
  logoWrap: {
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoRing: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoSquare: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10 },
      android: { elevation: 6 },
      default: {},
    }),
  },
  logoPulse: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  appName: {
    fontSize: 36,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: -1.2,
    marginBottom: 8,
  },
  taglineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  taglineDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  tagline: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.88)',
    letterSpacing: 0.4,
    fontStyle: 'italic',
    fontWeight: '500',
  },

  // Card — NO flex:1 or minHeight; let content determine height naturally
  card: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingHorizontal: 28,
    paddingTop: 0,
    paddingBottom: 36,
    marginTop: -24,
    overflow: 'hidden',
  },
  cardAccentRow: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 28,
  },
  accentBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.primary,
  },
  cardTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.8,
    marginBottom: 4,
  },
  cardSub: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 24,
    lineHeight: 19,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FCEBEB',
    borderRadius: RADIUS.lg,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.missed,
  },
  errorText: {
    flex: 1,
    color: COLORS.missed,
    fontSize: 13,
    fontWeight: '500',
  },
  forgotWrap: {
    alignSelf: 'flex-end',
    marginTop: -4,
    marginBottom: 24,
  },
  forgotText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
  },
  btn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.xl,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios:     { shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 14 },
      android: { elevation: 6 },
      default: {},
    }),
  },
  btnLoading: {
    backgroundColor: COLORS.primaryMid,
  },
  btnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  btnText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
    letterSpacing: 0.2,
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.white,
    opacity: 0.7,
  },
  signUpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 8,
  },
  signUpText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  signUpLink: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  footerNote: {
    textAlign: 'center',
    marginTop: 24,
    fontSize: 12,
    color: COLORS.textMuted,
  },
});

const inp = StyleSheet.create({
  wrap: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 14,
    paddingVertical: 2,
    minHeight: 52,
  },
  icon: {
    marginRight: 10,
  },
  field: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textPrimary,
    paddingVertical: 10,
  },
  eye: {
    padding: 8,
  },
});