import { supabase } from '@/lib/supabase';
import { COLORS, RADIUS } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View
} from 'react-native';

export default function LoginScreen() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    setError('');
    if (!email || !password) { setError('Please fill in all fields.'); return; }
    setLoading(true);

    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) { setError(err.message); setLoading(false); return; }

    console.log('User ID:', data.user.id);

    const { data: parent, error: parentErr } = await supabase
      .from('parents')
      .select('role')
      .eq('auth_user_id', data.user.id)
      .single();

    console.log('Parent:', JSON.stringify(parent));
    console.log('Parent error:', JSON.stringify(parentErr));

    setLoading(false);

    if (parent?.role === 'admin') {
      router.replace('/(admin)/dashboard' as any);
    } else {
      router.replace('/(tabs)/' as any);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Ionicons name="heart" size={48} color={COLORS.onPrimary} />
          <Text style={styles.heroTitle}>Mama na Mtoto</Text>
          <Text style={styles.heroSub}>Your child health companion</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Welcome back</Text>

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

          <Text style={styles.label}>Password</Text>
          <View style={styles.pwdRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              secureTextEntry={!showPwd}
            />
            <TouchableOpacity onPress={() => setShowPwd(v => !v)} style={styles.eyeBtn}>
              <Ionicons name={showPwd ? 'eye-off' : 'eye'} size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
            {loading
              ? <ActivityIndicator color={COLORS.onPrimary} />
              : <Text style={styles.btnText}>Sign in</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/(auth)/register')} style={styles.link}>
            <Text style={styles.linkText}>
              Don't have an account? <Text style={styles.linkBold}>Register</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.primary },
  scroll:    { flexGrow: 1 },
  hero:      { alignItems: 'center', paddingTop: 80, paddingBottom: 32, gap: 8 },
  heroTitle: { fontSize: 28, fontWeight: '700', color: COLORS.onPrimary },
  heroSub:   { fontSize: 15, color: COLORS.primaryMid },
  card:      { backgroundColor: COLORS.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 28, flex: 1, minHeight: 420 },
  cardTitle: { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 20 },
  label:     { fontSize: 13, fontWeight: '500', color: COLORS.textSecondary, marginBottom: 6 },
  input:     { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: 12, fontSize: 15, marginBottom: 16, color: COLORS.textPrimary, backgroundColor: COLORS.surface },
  pwdRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  eyeBtn:    { padding: 10 },
  btn:       { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: 14, alignItems: 'center', marginTop: 4 },
  btnText:   { color: COLORS.onPrimary, fontSize: 16, fontWeight: '600' },
  link:      { marginTop: 16, alignItems: 'center' },
  linkText:  { color: COLORS.textSecondary, fontSize: 14 },
  linkBold:  { color: COLORS.primary, fontWeight: '600' },
  errorBox:  { backgroundColor: '#FCEBEB', borderRadius: RADIUS.md, padding: 10, marginBottom: 12 },
  errorText: { color: '#A32D2D', fontSize: 13 },
});
