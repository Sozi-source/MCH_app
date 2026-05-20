import { supabase } from '@/lib/supabase';
import { COLORS, RADIUS } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View
} from 'react-native';

export default function ForgotPasswordScreen() {
  const [email, setEmail]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [sent, setSent]         = useState(false);
  const router = useRouter();

  const handleReset = async () => {
    setError('');
    if (!email.trim()) { setError('Please enter your email address.'); return; }
    setLoading(true);

    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: 'motherandchild://reset-password',
    });

    setLoading(false);
    if (err) { setError(err.message); return; }
    setSent(true);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Ionicons name="lock-closed" size={48} color={COLORS.onPrimary} />
          <Text style={styles.heroTitle}>ZuriHealth</Text>
          <Text style={styles.heroSub}>Reset your password</Text>
        </View>

        <View style={styles.card}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={COLORS.primary} />
            <Text style={styles.backText}>Back to login</Text>
          </TouchableOpacity>

          {sent ? (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle" size={48} color="#2A9D6E" style={{ marginBottom: 12 }} />
              <Text style={styles.successTitle}>Check your email</Text>
              <Text style={styles.successText}>
                We sent a password reset link to{' '}
                <Text style={styles.successEmail}>{email}</Text>.
                {'\n\n'}Open the link in your email to set a new password.
              </Text>
              <TouchableOpacity style={styles.btn} onPress={() => router.replace('/(auth)/login')}>
                <Text style={styles.btnText}>Back to Login</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.cardTitle}>Forgot password?</Text>
              <Text style={styles.cardSubtitle}>
                Enter the email address linked to your account and we'll send you a reset link.
              </Text>

              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <TouchableOpacity style={styles.btn} onPress={handleReset} disabled={loading}>
                {loading
                  ? <ActivityIndicator color={COLORS.onPrimary} />
                  : <Text style={styles.btnText}>Send Reset Link</Text>
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
  container:     { flex: 1, backgroundColor: COLORS.primary },
  scroll:        { flexGrow: 1 },
  hero:          { alignItems: 'center', paddingTop: 80, paddingBottom: 32, gap: 8 },
  heroTitle:     { fontSize: 28, fontWeight: '700', color: COLORS.onPrimary },
  heroSub:       { fontSize: 15, color: COLORS.primaryMid },
  card:          { backgroundColor: COLORS.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 28, flex: 1, minHeight: 420 },
  backBtn:       { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 },
  backText:      { color: COLORS.primary, fontSize: 14, fontWeight: '600' },
  cardTitle:     { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 8 },
  cardSubtitle:  { fontSize: 14, color: COLORS.textSecondary, marginBottom: 20, lineHeight: 20 },
  label:         { fontSize: 13, fontWeight: '500', color: COLORS.textSecondary, marginBottom: 6 },
  input:         { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: 12, fontSize: 15, marginBottom: 16, color: COLORS.textPrimary, backgroundColor: COLORS.surface },
  btn:           { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: 14, alignItems: 'center', marginTop: 4 },
  btnText:       { color: COLORS.onPrimary, fontSize: 16, fontWeight: '600' },
  errorBox:      { backgroundColor: '#FCEBEB', borderRadius: RADIUS.md, padding: 10, marginBottom: 12 },
  errorText:     { color: '#A32D2D', fontSize: 13 },
  successBox:    { alignItems: 'center', paddingTop: 20 },
  successTitle:  { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  successText:   { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  successEmail:  { fontWeight: '700', color: COLORS.textPrimary },
});

