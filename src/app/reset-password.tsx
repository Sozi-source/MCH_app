// src/app/reset-password.tsx
// ZuriHealth — New Password Screen (opened via deep link from email)

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

export default function ResetPasswordScreen() {
  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [done,      setDone]      = useState(false);
  const [showPass,  setShowPass]  = useState(false);
  const [showConf,  setShowConf]  = useState(false);
  const router = useRouter();

  const handleUpdate = async () => {
    setError('');
    if (!password) { setError('Please enter a new password.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }

    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (err) { setError(err.message); return; }
    // Sign out the temporary recovery session so the user lands on a
    // clean login screen and authenticates with their new password.
    await supabase.auth.signOut();
    setDone(true);
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
        <View style={styles.hero}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="shield-checkmark" size={30} color={COLORS.white} />
          </View>
          <Text style={styles.heroTitle}>ZuriHealth</Text>
          <Text style={styles.heroSub}>Set a new password</Text>
        </View>

        <View style={styles.card}>
          {done ? (
            <View style={styles.successBox}>
              <View style={styles.successIconWrap}>
                <Ionicons name="checkmark-circle" size={36} color={COLORS.given} />
              </View>
              <Text style={styles.successTitle}>Password updated!</Text>
              <Text style={styles.successText}>
                Your password has been changed successfully. You can now log in with your new password.
              </Text>
              <TouchableOpacity
                style={styles.btn}
                onPress={() => router.replace('/(auth)/login')}
              >
                <Text style={styles.btnText}>Go to Login</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.cardTitle}>New password</Text>
              <Text style={styles.cardSubtitle}>
                Choose a strong password that's at least 8 characters long.
              </Text>

              {!!error && (
                <View style={styles.errorBox}>
                  <Ionicons name="warning-outline" size={14} color="#A32D2D" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <Text style={styles.label}>New password</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.inputInner}
                  value={password}
                  onChangeText={v => { setPassword(v); setError(''); }}
                  placeholder="Min. 8 characters"
                  placeholderTextColor={COLORS.textMuted}
                  secureTextEntry={!showPass}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowPass(p => !p)} style={styles.eyeBtn}>
                  <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.label, { marginTop: 14 }]}>Confirm password</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.inputInner}
                  value={confirm}
                  onChangeText={v => { setConfirm(v); setError(''); }}
                  placeholder="Repeat new password"
                  placeholderTextColor={COLORS.textMuted}
                  secureTextEntry={!showConf}
                  autoCapitalize="none"
                  returnKeyType="done"
                  onSubmitEditing={handleUpdate}
                />
                <TouchableOpacity onPress={() => setShowConf(p => !p)} style={styles.eyeBtn}>
                  <Ionicons name={showConf ? 'eye-off-outline' : 'eye-outline'} size={18} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.btn, loading && styles.btnDisabled]}
                onPress={handleUpdate}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color={COLORS.white} />
                  : (
                    <View style={styles.btnInner}>
                      <Ionicons name="lock-closed-outline" size={16} color={COLORS.white} />
                      <Text style={styles.btnText}>Update Password</Text>
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
  container:      { flex: 1, backgroundColor: COLORS.primary },
  scroll:         { flexGrow: 1 },
  hero:           { alignItems: 'center', paddingTop: 72, paddingBottom: 28, gap: 8 },
  heroIconWrap:   { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  heroTitle:      { fontSize: 26, fontFamily: FONTS.extrabold, color: COLORS.white, letterSpacing: -0.4 },
  heroSub:        { fontSize: 14, fontFamily: FONTS.regular, color: 'rgba(255,255,255,0.75)' },
  card:           { backgroundColor: COLORS.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 28, flex: 1, minHeight: 460 },
  cardTitle:      { fontFamily: FONTS.bold, fontSize: 22, color: COLORS.textPrimary, marginBottom: 8 },
  cardSubtitle:   { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textSecondary, marginBottom: 24, lineHeight: 21 },
  label:          { fontFamily: FONTS.semibold, fontSize: 13, color: COLORS.textSecondary, marginBottom: 6 },
  inputWrap:      { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, backgroundColor: COLORS.surface, marginBottom: 4 },
  inputInner:     { flex: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: FONTS.regular, color: COLORS.textPrimary },
  eyeBtn:         { paddingHorizontal: 12 },
  errorBox:       { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#FCEBEB', borderRadius: RADIUS.md, padding: 10, marginBottom: 14 },
  errorText:      { fontFamily: FONTS.regular, color: '#A32D2D', fontSize: 13, flex: 1 },
  btn:            { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  btnDisabled:    { opacity: 0.6 },
  btnInner:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText:        { fontFamily: FONTS.semibold, color: COLORS.white, fontSize: 15 },
  successBox:     { alignItems: 'center', paddingTop: 12, gap: 12 },
  successIconWrap:{ width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.givenLight, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  successTitle:   { fontFamily: FONTS.bold, fontSize: 22, color: COLORS.textPrimary },
  successText:    { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 },
});