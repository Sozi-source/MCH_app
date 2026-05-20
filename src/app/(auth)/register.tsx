/**
 * ZuriHealth — Premium Register Screen
 * Matches login.tsx aesthetic exactly: blue hero, white card, animated inputs
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

// ─── Animated background orb ──────────────────────────────────────────────────
function BluOrb({ size, opacity, style }: { size: number; opacity: number; style?: any }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.1, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,   duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View
      style={[
        {
          width: size, height: size, borderRadius: size / 2,
          backgroundColor: COLORS.primary,
          opacity,
          transform: [{ scale: pulse }],
          position: 'absolute',
        },
        style,
      ]}
    />
  );
}

// ─── Stagger-in hook ──────────────────────────────────────────────────────────
function useStaggerIn(count: number, delay = 80) {
  const anims = useRef(Array.from({ length: count }, () => new Animated.Value(0))).current;
  useEffect(() => {
    Animated.stagger(
      delay,
      anims.map(a =>
        Animated.timing(a, {
          toValue: 1, duration: 480,
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

// ─── Animated input field ─────────────────────────────────────────────────────
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

  const borderColor = focusAnim.interpolate({ inputRange: [0, 1], outputRange: [COLORS.border, COLORS.primary] });
  const bgColor     = focusAnim.interpolate({ inputRange: [0, 1], outputRange: [COLORS.background, COLORS.primaryLight] });

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
            <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </Animated.View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function RegisterScreen() {
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const router = useRouter();

  const anims = useStaggerIn(6);

  const handleRegister = async () => {
    setError('');
    if (!name || !email || !password) { setError('Please fill in all fields.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);

    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });

    setLoading(false);
    if (err) { setError(err.message); return; }

    if (data.user) {
      await supabase
        .from('parents')
        .update({ full_name: name })
        .eq('auth_user_id', data.user.id);
      router.replace('/(tabs)/');
    }
  };

  const btnScale = useRef(new Animated.Value(1)).current;
  const onPressIn  = () => Animated.spring(btnScale, { toValue: 0.97, useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(btnScale, { toValue: 1,    useNativeDriver: true }).start();

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ── Blue depth background ── */}
      <View style={s.bg}>
        <BluOrb size={320} opacity={0.20} style={{ top: -100, right: -90 }} />
        <BluOrb size={180} opacity={0.12} style={{ top: 160, left: -70 }} />
        <BluOrb size={110} opacity={0.07} style={{ top: 70, right: 50 }} />
        <View style={s.gridLine1} />
        <View style={s.gridLine2} />
        <View style={s.gridLine3} />
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ── */}
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
            <Text style={s.tagline}>Create your account</Text>
            <View style={s.taglineDot} />
          </Animated.View>
        </View>

        {/* ── Card ── */}
        <View style={s.card}>
          <View style={s.cardAccentRow}>
            <View style={[s.accentBar, { width: 32, opacity: 0.3 }]} />
            <View style={[s.accentBar, { width: 48 }]} />
            <View style={[s.accentBar, { width: 16, opacity: 0.5 }]} />
          </View>

          <Animated.Text style={[s.cardTitle, anims[3]]}>Get started</Animated.Text>
          <Animated.Text style={[s.cardSub, anims[3]]}>
            Join thousands of families tracking their child's health
          </Animated.Text>

          {!!error && (
            <View style={s.errorBox}>
              <Ionicons name="alert-circle-outline" size={15} color={COLORS.missed} />
              <Text style={s.errorText}>{error}</Text>
            </View>
          )}

          <Animated.View style={anims[4]}>
            <PremiumInput
              label="Full name"
              value={name}
              onChange={setName}
              placeholder="Jane Wanjiku"
              icon="person-outline"
              autoCapitalize="words"
            />
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
              placeholder="Min. 8 characters"
              icon="lock-closed-outline"
              secure
            />
          </Animated.View>

          {/* Password hint */}
          <View style={s.hintRow}>
            <Ionicons name="shield-checkmark-outline" size={13} color={COLORS.given} />
            <Text style={s.hintText}>Use at least 8 characters for a secure account</Text>
          </View>

          {/* Create account button */}
          <Animated.View style={[anims[5], { transform: [{ scale: btnScale }] }]}>
            <TouchableOpacity
              style={[s.btn, loading && s.btnLoading]}
              onPress={handleRegister}
              onPressIn={onPressIn}
              onPressOut={onPressOut}
              disabled={loading}
              activeOpacity={1}
            >
              <View style={s.btnInner}>
                {loading ? (
                  <>
                    <View style={s.loadingDot} />
                    <Text style={s.btnText}>Creating account…</Text>
                  </>
                ) : (
                  <>
                    <Text style={s.btnText}>Create account</Text>
                    <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
                  </>
                )}
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* Divider */}
          <View style={s.divider}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>already a member?</Text>
            <View style={s.dividerLine} />
          </View>

          {/* Sign in link */}
          <TouchableOpacity
            style={s.loginBtn}
            onPress={() => router.push('/(auth)/login')}
            activeOpacity={0.8}
          >
            <Text style={s.loginText}>Sign in instead</Text>
          </TouchableOpacity>

          <Text style={s.footerNote}>Trusted by families across Kenya 🩵</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.primary },
  bg:   { ...StyleSheet.absoluteFillObject },

  gridLine1: { position: 'absolute', top: H * 0.10, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  gridLine2: { position: 'absolute', top: H * 0.20, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.04)' },
  gridLine3: { position: 'absolute', top: 0, bottom: 0, left: W * 0.72, width: 1, backgroundColor: 'rgba(255,255,255,0.05)' },

  scroll: { flexGrow: 1, paddingBottom: 32 },

  // Hero — slightly more compact than login since card has more fields
  hero: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 72 : 56,
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  logoWrap:   { marginBottom: 18, alignItems: 'center', justifyContent: 'center' },
  logoRing:   {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  logoSquare: {
    width: 56, height: 56, borderRadius: 18,
    backgroundColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15, shadowRadius: 14, elevation: 10,
  },
  logoPulse: {
    position: 'absolute', width: 96, height: 96,
    borderRadius: 28, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  appName: {
    fontSize: 36, fontWeight: '800', color: COLORS.white,
    letterSpacing: -1.5, marginBottom: 10,
  },
  taglineRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  taglineDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.primaryMid, opacity: 0.8 },
  tagline:    { fontSize: 13, color: COLORS.primaryMid, letterSpacing: 0.4, fontStyle: 'italic', fontWeight: '500' },

  // Card
  card: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 36, borderTopRightRadius: 36,
    flex: 1, minHeight: H * 0.68,
    paddingHorizontal: 28, paddingTop: 0, paddingBottom: 36,
    overflow: 'hidden',
  },
  cardAccentRow: {
    flexDirection: 'row', gap: 6,
    justifyContent: 'center', alignItems: 'center',
    marginTop: 20, marginBottom: 24,
  },
  accentBar:  { height: 4, borderRadius: 2, backgroundColor: COLORS.primary },
  cardTitle:  { fontSize: 24, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.8, marginBottom: 4 },
  cardSub:    { fontSize: 13, color: COLORS.textSecondary, marginBottom: 22, lineHeight: 19 },

  // Error
  errorBox:  {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FCEBEB',
    borderRadius: RADIUS.lg, padding: 12, marginBottom: 16,
    borderLeftWidth: 3, borderLeftColor: COLORS.missed,
  },
  errorText: { flex: 1, color: COLORS.missed, fontSize: 13, fontWeight: '500' },

  // Password hint
  hintRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20, marginTop: -4 },
  hintText: { fontSize: 12, color: COLORS.given, fontWeight: '500' },

  // Button
  btn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.xl, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 14, elevation: 8,
  },
  btnLoading: { backgroundColor: COLORS.primaryMid },
  btnInner:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  btnText:    { fontSize: 16, fontWeight: '700', color: COLORS.white, letterSpacing: 0.2 },
  loadingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.white, opacity: 0.7 },

  // Divider
  divider:     { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 22 },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { fontSize: 12, color: COLORS.textMuted, fontWeight: '500' },

  // Login link
  loginBtn:  {
    borderWidth: 1.5, borderColor: COLORS.primary,
    borderRadius: RADIUS.xl, paddingVertical: 14,
    alignItems: 'center',
  },
  loginText: { fontSize: 15, fontWeight: '700', color: COLORS.primary },

  footerNote: { textAlign: 'center', marginTop: 20, fontSize: 12, color: COLORS.textMuted },
});

// ─── Input styles ─────────────────────────────────────────────────────────────
const inp = StyleSheet.create({
  wrap:  { marginBottom: 14 },
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