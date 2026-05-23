/**
 * ZuriHealth — Premium Login Screen
 * Theme: App's native blue palette (#208AEF primary)
 * Aesthetic: Clean tech-health — hero photo + blue overlay, white card, crisp typography
 */

import { supabase } from '@/lib/supabase';
import { COLORS, RADIUS } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Image,
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

const { width: W, height: H } = Dimensions.get('window');

// ─── Stagger-in hook ──────────────────────────────────────────────────────────
function useStaggerIn(count: number, delay = 90) {
  const anims = useRef(Array.from({ length: count }, () => new Animated.Value(0))).current;
  useEffect(() => {
    Animated.stagger(
      delay,
      anims.map(a =>
        Animated.timing(a, {
          toValue: 1, duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        })
      )
    ).start();
  }, []);
  return anims.map(a => ({
    opacity: a,
    transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
  }));
}

// ─── Input field ──────────────────────────────────────────────────────────────
function PremiumInput({
  label, value, onChange, placeholder, secure, icon, keyboardType, autoCapitalize,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder: string; secure?: boolean; icon: string;
  keyboardType?: any; autoCapitalize?: any;
}) {
  const [focused, setFocused] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const focusAnim = useRef(new Animated.Value(0)).current;

  const onFocus = () => {
    setFocused(true);
    Animated.timing(focusAnim, { toValue: 1, duration: 180, useNativeDriver: false }).start();
  };
  const onBlur = () => {
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
          onFocus={onFocus}
          onBlur={onBlur}
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

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function LoginScreen() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const router = useRouter();

  const anims = useStaggerIn(6);

  const handleLogin = async () => {
    setError('');
    if (!email || !password) { setError('Please enter your email and password.'); return; }
    setLoading(true);

    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) { setError(err.message); setLoading(false); return; }

    const { data: parent } = await supabase
      .from('parents')
      .select('role')
      .eq('auth_user_id', data.user.id)
      .single();

    setLoading(false);

    if (parent?.role === 'admin') {
      router.replace('/(admin)/dashboard' as any);
    } else {
      router.replace('/(tabs)/' as any);
    }
  };

  // Button press spring
  const btnScale = useRef(new Animated.Value(1)).current;
  const onPressIn  = () => Animated.spring(btnScale, { toValue: 0.97, useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(btnScale, { toValue: 1,    useNativeDriver: true }).start();

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ── Hero Image Section ── */}
      <ImageBackground
        source={require('@/assets/images/hero.jpg')}
        style={s.heroBg}
        resizeMode="cover"
      >
        {/* Blue overlay so text stays readable */}
        <View style={s.heroOverlay} />

        {/* Logo + app name on top of photo */}
        <View style={s.hero}>
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
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={s.card}>
          {/* Top accent bar */}
          <View style={s.cardAccentRow}>
            <View style={[s.accentBar, { width: 32, opacity: 0.3 }]} />
            <View style={[s.accentBar, { width: 48 }]} />
            <View style={[s.accentBar, { width: 16, opacity: 0.5 }]} />
          </View>

          <Animated.Text style={[s.cardTitle, anims[3]]}>Welcome back</Animated.Text>
          <Animated.Text style={[s.cardSub, anims[3]]}>
            Sign in to continue caring for your child
          </Animated.Text>

          {/* Error banner */}
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
            />
            <PremiumInput
              label="Password"
              value={password}
              onChange={setPassword}
              placeholder="Your password"
              icon="lock-closed-outline"
              secure
            />
          </Animated.View>

          {/* Forgot password */}
          <TouchableOpacity
            onPress={() => router.push('/(auth)/forgot-password')}
            style={s.forgotWrap}
          >
            <Text style={s.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          {/* Sign in button */}
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

          {/* Divider */}
          <View style={s.divider}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>new here?</Text>
            <View style={s.dividerLine} />
          </View>

          {/* Register */}
          <TouchableOpacity
            style={s.registerBtn}
            onPress={() => router.push('/(auth)/register')}
            activeOpacity={0.8}
          >
            <Text style={s.registerText}>Create your account</Text>
          </TouchableOpacity>

          {/* Footer */}
          <Text style={s.footerNote}>Trusted by families across Kenya 🩵</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.primary },

  // Hero image
  heroBg: {
    width: W,
    height: H * 0.44,
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

  logoWrap: { marginBottom: 16, alignItems: 'center', justifyContent: 'center' },
  logoRing: {
    width: 72, height: 72, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  logoSquare: {
    width: 50, height: 50, borderRadius: 16,
    backgroundColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10 }, android: { elevation: 6 }, default: {} }), elevation: 8,
  },
  logoPulse: {
    position: 'absolute', width: 88, height: 88,
    borderRadius: 26, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  appName: {
    fontSize: 36, fontWeight: '800', color: COLORS.white,
    letterSpacing: -1.2, marginBottom: 8,
  },
  taglineRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  taglineDot: {
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  tagline: {
    fontSize: 13, color: 'rgba(255,255,255,0.88)',
    letterSpacing: 0.4, fontStyle: 'italic', fontWeight: '500',
  },

  scroll: { flexGrow: 1 },

  // Card — sits flush below the image
  card: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 36, borderTopRightRadius: 36,
    flex: 1, minHeight: H * 0.6,
    paddingHorizontal: 28, paddingTop: 0, paddingBottom: 36,
    marginTop: -24,
    overflow: 'hidden',
  },
  cardAccentRow: {
    flexDirection: 'row', gap: 6,
    justifyContent: 'center', alignItems: 'center',
    marginTop: 20, marginBottom: 28,
  },
  accentBar: { height: 4, borderRadius: 2, backgroundColor: COLORS.primary },
  cardTitle: {
    fontSize: 26, fontWeight: '800',
    color: COLORS.textPrimary, letterSpacing: -0.8, marginBottom: 4,
  },
  cardSub: {
    fontSize: 13, color: COLORS.textSecondary,
    marginBottom: 24, lineHeight: 19,
  },

  // Error
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FCEBEB',
    borderRadius: RADIUS.lg, padding: 12, marginBottom: 16,
    borderLeftWidth: 3, borderLeftColor: COLORS.missed,
  },
  errorText: { flex: 1, color: COLORS.missed, fontSize: 13, fontWeight: '500' },

  forgotWrap: { alignSelf: 'flex-end', marginTop: -4, marginBottom: 24 },
  forgotText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },

  btn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.xl, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({ ios: { shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 14 }, android: { elevation: 6 }, default: {} }), elevation: 8,
  },
  btnLoading:  { backgroundColor: COLORS.primaryMid },
  btnInner:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  btnText:     { fontSize: 16, fontWeight: '700', color: COLORS.white, letterSpacing: 0.2 },
  loadingDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.white, opacity: 0.7 },

  divider:     { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 24 },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { fontSize: 12, color: COLORS.textMuted, fontWeight: '500' },

  registerBtn: {
    borderWidth: 1.5, borderColor: COLORS.primary,
    borderRadius: RADIUS.xl, paddingVertical: 14,
    alignItems: 'center',
  },
  registerText: { fontSize: 15, fontWeight: '700', color: COLORS.primary },
  footerNote: {
    textAlign: 'center', marginTop: 24,
    fontSize: 12, color: COLORS.textMuted,
  },
});

// ─── Input styles ─────────────────────────────────────────────────────────────
const inp = StyleSheet.create({
  wrap:  { marginBottom: 16 },
  label: {
    fontSize: 12, fontWeight: '700',
    color: COLORS.textSecondary, letterSpacing: 0.5,
    textTransform: 'uppercase', marginBottom: 8,
  },
  box: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderRadius: RADIUS.lg,
    paddingHorizontal: 14, paddingVertical: 2, minHeight: 52,
  },
  icon:  { marginRight: 10 },
  field: { flex: 1, fontSize: 15, color: COLORS.textPrimary, paddingVertical: 10 },
  eye:   { padding: 8 },
});