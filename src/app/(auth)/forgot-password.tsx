// src/app/(auth)/forgot-password.tsx
// ZuriHealth — Forgot Password Screen

import { supabase } from '@/lib/supabase';
import { COLORS, FONTS, RADIUS } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// Must match app.json scheme + route in Supabase dashboard Redirect URLs
const RESET_REDIRECT = 'motherandchild://reset-password';

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function ForgotPasswordScreen() {
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [sent,    setSent]    = useState(false);
  const router = useRouter();

  const handleReset = async () => {
    setError('');
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: RESET_REDIRECT,
    });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setSent(true);
  };

  const handleResend = async () => {
    setLoading(true);
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: RESET_REDIRECT,
    });
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'android' ? 24 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <View style={styles.hero}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="lock-closed" size={30} color={COLORS.white} />
          </View>
          <Text style={styles.heroTitle}>ZuriHealth</Text>
          <Text style={styles.heroSub}>Reset your password</Text>
        </View>

        {/* ── Card ─────────────────────────────────────────────────────── */}
        <View style={styles.card}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={18} color={COLORS.primary} />
            <Text style={styles.backText}>Back to login</Text>
          </TouchableOpacity>

          {sent ? (
            /* ── Success state ─────────────────────────────────────────── */
            <View style={styles.successBox}>
              <View style={styles.successIconWrap}>
                <Ionicons name="mail" size={32} color={COLORS.primary} />
              </View>
              <Text style={styles.successTitle}>Check your email</Text>
              <Text style={styles.successText}>
                We sent a password reset link to{' '}
                <Text style={styles.successEmail}>{email}</Text>.
                {'\n\n'}
                Open the link in your email app to set a new password.
                If you don't see it, check your spam folder.
              </Text>

              <TouchableOpacity
                style={styles.resendBtn}
                onPress={handleResend}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator size="small" color={COLORS.primary} />
                  : <Text style={styles.resendText}>Resend email</Text>
                }
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.btn}
                onPress={() => router.replace('/(auth)/login')}
              >
                <Text style={styles.btnText}>Back to Login</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* ── Form state ────────────────────────────────────────────── */
            <>
              <Text style={styles.cardTitle}>Forgot password?</Text>
              <Text style={styles.cardSubtitle}>
                Enter the email address linked to your account and we'll send you a reset link.
              </Text>

              {!!error && (
                <View style={styles.errorBox}>
                  <Ionicons name="warning-outline" size={14} color="#A32D2D" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <Text style={styles.label}>Email address</Text>
              <TextInput
                style={[styles.input, !!error && styles.inputError]}
                value={email}
                onChangeText={v => { setEmail(v); setError(''); }}
                placeholder="you@example.com"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="send"
                onSubmitEditing={handleReset}
              />

              <TouchableOpacity
                style={[styles.btn, loading && styles.btnDisabled]}
                onPress={handleReset}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color={COLORS.white} />
                  : (
                    <View style={styles.btnInner}>
                      <Ionicons name="paper-plane-outline" size={16} color={COLORS.white} />
                      <Text style={styles.btnText}>Send Reset Link</Text>
                    </View>
                  )
                }
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  scroll: {
    flexGrow: 1,
  },

  // ── Hero ────────────────────────────────────────────────────────────────────
  hero: {
    alignItems: 'center',
    paddingTop: 72,
    paddingBottom: 28,
    gap: 8,
  },
  heroIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 26,
    fontFamily: FONTS.extrabold,
    color: COLORS.white,
    letterSpacing: -0.4,
  },
  heroSub: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: 'rgba(255,255,255,0.75)',
  },

  // ── Card ────────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 28,
    flex: 1,
    minHeight: 460,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 24,
    alignSelf: 'flex-start',
  },
  backText: {
    fontFamily: FONTS.semibold,
    color: COLORS.primary,
    fontSize: 14,
  },
  cardTitle: {
    fontFamily: FONTS.bold,
    fontSize: 22,
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  cardSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 24,
    lineHeight: 21,
  },

  // ── Form ────────────────────────────────────────────────────────────────────
  label: {
    fontFamily: FONTS.semibold,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: FONTS.regular,
    marginBottom: 20,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.surface,
  },
  inputError: {
    borderColor: COLORS.missed,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#FCEBEB',
    borderRadius: RADIUS.md,
    padding: 10,
    marginBottom: 14,
  },
  errorText: {
    fontFamily: FONTS.regular,
    color: '#A32D2D',
    fontSize: 13,
    flex: 1,
  },
  btn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnText: {
    fontFamily: FONTS.semibold,
    color: COLORS.white,
    fontSize: 15,
  },

  // ── Success state ────────────────────────────────────────────────────────────
  successBox: {
    alignItems: 'center',
    paddingTop: 12,
    gap: 12,
  },
  successIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  successTitle: {
    fontFamily: FONTS.bold,
    fontSize: 22,
    color: COLORS.textPrimary,
  },
  successText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  successEmail: {
    fontFamily: FONTS.semibold,
    color: COLORS.textPrimary,
  },
  resendBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.primary,
    alignItems: 'center',
    minWidth: 140,
    marginTop: 4,
  },
  resendText: {
    fontFamily: FONTS.semibold,
    color: COLORS.primary,
    fontSize: 14,
  },
});