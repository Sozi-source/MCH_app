import { supabase } from '@/lib/supabase';
import { COLORS, RADIUS } from '@/lib/theme';
import { useAuthStore } from '@/store/authStore';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Stats {
  totalParents: number;
  totalChildren: number;
  totalImmunizations: number;
  totalGrowthRecords: number;
  totalConsultations: number;
  recentParents: { id: string; full_name: string; email: string; created_at: string }[];
}

export default function AdminDashboard() {
  const { session, signOut } = useAuthStore();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const firstName = session?.user?.user_metadata?.full_name?.split(' ')[0] ?? 'Admin';

  useEffect(() => { fetchStats(); }, []);

  const fetchStats = async () => {
    setLoading(true);
    const [
      { count: totalParents },
      { count: totalChildren },
      { count: totalImmunizations },
      { count: totalGrowthRecords },
      { count: totalConsultations },
      { data: recentParents },
    ] = await Promise.all([
      supabase.from('parents').select('*', { count: 'exact', head: true }).neq('role', 'admin'),
      supabase.from('children').select('*', { count: 'exact', head: true }),
      supabase.from('immunizations').select('*', { count: 'exact', head: true }),
      supabase.from('growth_records').select('*', { count: 'exact', head: true }),
      supabase.from('ai_consultations').select('*', { count: 'exact', head: true }),
      supabase.from('parents').select('id, full_name, email, created_at').neq('role', 'admin').order('created_at', { ascending: false }).limit(5),
    ]);

    setStats({
      totalParents: totalParents ?? 0,
      totalChildren: totalChildren ?? 0,
      totalImmunizations: totalImmunizations ?? 0,
      totalGrowthRecords: totalGrowthRecords ?? 0,
      totalConsultations: totalConsultations ?? 0,
      recentParents: recentParents ?? [],
    });
    setLoading(false);
  };

  const handleSignOut = () => {
    if (Platform.OS === 'web') {
      if (!window.confirm('Sign out?')) return;
      signOut().then(() => router.replace('/(auth)/login'));
    } else {
      Alert.alert('Sign Out', 'Are you sure?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: () => signOut().then(() => router.replace('/(auth)/login')) },
      ]);
    }
  };

  const STAT_CARDS = [
    { label: 'Total Parents',      value: stats?.totalParents,       icon: 'people'       as const, color: COLORS.card1 },
    { label: 'Total Children',     value: stats?.totalChildren,      icon: 'heart'        as const, color: COLORS.card2 },
    { label: 'Immunizations',      value: stats?.totalImmunizations, icon: 'shield'       as const, color: COLORS.card3 },
    { label: 'Growth Records',     value: stats?.totalGrowthRecords, icon: 'trending-up'  as const, color: COLORS.card4 },
    { label: 'AI Consultations',   value: stats?.totalConsultations, icon: 'chatbubble'   as const, color: COLORS.card1 },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {firstName}</Text>
          <Text style={styles.subtitle}>Admin Dashboard</Text>
        </View>
        <View style={styles.headerIcons}>
          <TouchableOpacity onPress={fetchStats} style={styles.headerIconBtn}>
            <Ionicons name="refresh-outline" size={24} color={COLORS.onPrimary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSignOut} style={styles.headerIconBtn}>
            <Ionicons name="log-out-outline" size={24} color={COLORS.onPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} size="large" style={{ marginTop: 40 }} />
      ) : (
        <>
          {/* Stats Grid */}
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={styles.statsGrid}>
            {STAT_CARDS.map(s => (
              <View key={s.label} style={[styles.statCard, { backgroundColor: s.color }]}>
                <View style={styles.statIconCircle}>
                  <Ionicons name={s.icon} size={22} color={COLORS.primary} />
                </View>
                <Text style={styles.statValue}>{s.value ?? 0}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>

          {/* Recent Registrations */}
          <Text style={styles.sectionTitle}>Recent Registrations</Text>
          <View style={styles.recentCard}>
            {stats?.recentParents.length === 0 ? (
              <Text style={styles.emptyText}>No parents registered yet</Text>
            ) : (
              stats?.recentParents.map((p, i) => (
                <View key={p.id} style={[styles.recentRow, i < (stats.recentParents.length - 1) && styles.recentRowBorder]}>
                  <View style={styles.recentAvatar}>
                    <Text style={styles.recentAvatarText}>{(p.full_name?.[0] ?? '?').toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recentName}>{p.full_name}</Text>
                    <Text style={styles.recentEmail}>{p.email}</Text>
                  </View>
                  <Text style={styles.recentDate}>
                    {new Date(p.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}
                  </Text>
                </View>
              ))
            )}
          </View>

          {/* Quick Links */}
          <Text style={styles.sectionTitle}>Manage</Text>
          <View style={styles.quickLinks}>
            <TouchableOpacity style={styles.quickLink} onPress={() => router.push('/(admin)/parents')}>
              <Ionicons name="people" size={20} color={COLORS.primary} />
              <Text style={styles.quickLinkText}>View All Parents</Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickLink} onPress={() => router.push('/(admin)/children')}>
              <Ionicons name="heart" size={20} color={COLORS.primary} />
              <Text style={styles.quickLinkText}>View All Children</Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>
        </>
      )}

      <View style={{ height: 140 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: COLORS.background },
  content:          { paddingBottom: 32 },
  header:           { backgroundColor: COLORS.primary, padding: 24, paddingTop: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  greeting:         { fontSize: 22, fontWeight: '700', color: COLORS.onPrimary },
  subtitle:         { fontSize: 13, color: COLORS.primaryMid, marginTop: 2 },
  headerIcons:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerIconBtn:    { padding: 6 },
  sectionTitle:     { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginHorizontal: 16, marginTop: 20, marginBottom: 10 },
  statsGrid:        { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 12 },
  statCard:         { width: '47%', borderRadius: RADIUS.lg, padding: 16, alignItems: 'flex-start', gap: 6 },
  statIconCircle:   { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  statValue:        { fontSize: 28, fontWeight: '800', color: COLORS.textPrimary },
  statLabel:        { fontSize: 12, color: COLORS.textSecondary },
  recentCard:       { marginHorizontal: 16, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  recentRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  recentRowBorder:  { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  recentAvatar:     { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  recentAvatarText: { fontSize: 16, fontWeight: '800', color: COLORS.primary },
  recentName:       { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  recentEmail:      { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  recentDate:       { fontSize: 11, color: COLORS.textMuted },
  emptyText:        { padding: 20, textAlign: 'center', color: COLORS.textMuted },
  quickLinks:       { marginHorizontal: 16, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  quickLink:        { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  quickLinkText:    { flex: 1, fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
});
