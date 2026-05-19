import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { COLORS, RADIUS } from '@/lib/theme';

export default function RegisterScreen() {
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const router = useRouter();

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
      // Update full_name in parents table (trigger creates the row, but may not set full_name)
      await supabase
        .from('parents')
        .update({ full_name: name })
        .eq('auth_user_id', data.user.id);

      router.replace('/(tabs)/');
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Ionicons name="heart" size={48} color={COLORS.onPrimary} />
          <Text style={styles.heroTitle}>Mama na Mtoto</Text>
          <Text style={styles.heroSub}>Create your account</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Get started</Text>
          {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
          <Text style={styles.label}>Full name</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Jane Wanjiku" />
          <Text style={styles.label}>Email</Text>
          <TextInput style={styles.input} value={email} onChangeText={setEmail}
            placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />
          <Text style={styles.label}>Password</Text>
          <TextInput style={styles.input} value={password} onChangeText={setPassword}
            placeholder="Min. 8 characters" secureTextEntry />
          <TouchableOpacity style={styles.btn} onPress={handleRegister} disabled={loading}>
            {loading ? <ActivityIndicator color={COLORS.onPrimary} /> : <Text style={styles.btnText}>Create account</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/(auth)/login')} style={styles.link}>
            <Text style={styles.linkText}>Already have an account? <Text style={styles.linkBold}>Sign in</Text></Text>
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
  card:      { backgroundColor: COLORS.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 28, flex: 1, minHeight: 480 },
  cardTitle: { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 20 },
  label:     { fontSize: 13, fontWeight: '500', color: COLORS.textSecondary, marginBottom: 6 },
  input:     { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: 12, fontSize: 15, marginBottom: 16, color: COLORS.textPrimary, backgroundColor: COLORS.surface },
  btn:       { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: 14, alignItems: 'center', marginTop: 4 },
  btnText:   { color: COLORS.onPrimary, fontSize: 16, fontWeight: '600' },
  link:      { marginTop: 16, alignItems: 'center' },
  linkText:  { color: COLORS.textSecondary, fontSize: 14 },
  linkBold:  { color: COLORS.primary, fontWeight: '600' },
  errorBox:  { backgroundColor: '#FCEBEB', borderRadius: RADIUS.md, padding: 10, marginBottom: 12 },
  errorText: { color: '#A32D2D', fontSize: 13 },
});