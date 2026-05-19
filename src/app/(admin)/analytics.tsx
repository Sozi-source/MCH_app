/**
 * src/app/(admin)/analytics.tsx
 * Admin Analytics Screen for mamaTOTO
 */

import { supabase } from '@/lib/supabase';
import { COLORS, RADIUS } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 48;

// ── Types ─────────────────────────────────────────────────────────────────────

interface RegistrationPoint { label: string; count: number }
interface ActiveUser { full_name: string; email: string; record_count: number }
interface GrowthPoint { label: string; count: number }
interface VaccineStats { completed: number; pending: number; missed: number }

interface Analytics {
  registrations: RegistrationPoint[];
  activeUsers: ActiveUser[];
  growthWeekly: GrowthPoint[];
  aiConsultations: number;
  vaccineStats: VaccineStats;
  totalParents: number;
  totalChildren: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getLast6Months(): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.toISOString().slice(0, 7)); // "2026-01"
  }
  return months;
}

function getLast6Weeks(): { label: string; start: string; end: string }[] {
  const weeks = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const end = new Date(now);
    end.setDate(now.getDate() - i * 7);
    const start = new Date(end);
    start.setDate(end.getDate() - 6);
    weeks.push({
      label: `W${6 - i}`,
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    });
  }
  return weeks;
}

function monthLabel(iso: string): string {
  const [year, month] = iso.split('-');
  const d = new Date(Number(year), Number(month) - 1);
  return d.toLocaleString('default', { month: 'short' });
}

// ── Bar Chart ─────────────────────────────────────────────────────────────────

function BarChart({ data, color }: { data: { label: string; count: number }[]; color: string }) {
  const max = Math.max(...data.map(d => d.count), 1);
  const barWidth = (CHART_WIDTH - (data.length - 1) * 8) / data.length;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 8 }}>
      {data.map((d, i) => {
        const h = Math.max((d.count / max) * 100, d.count > 0 ? 6 : 2);
        return (
          <View key={i} style={{ alignItems: 'center', width: barWidth }}>
            <Text style={styles.barValue}>{d.count > 0 ? d.count : ''}</Text>
            <View style={[styles.bar, { height: h, backgroundColor: color, width: barWidth }]} />
            <Text style={styles.barLabel}>{d.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

// ── Donut ─────────────────────────────────────────────────────────────────────

function VaccineDonut({ stats }: { stats: VaccineStats }) {
  const total = stats.completed + stats.pending + stats.missed || 1;
  const pctComplete = Math.round((stats.completed / total) * 100);
  const pctPending = Math.round((stats.pending / total) * 100);
  const pctMissed = Math.round((stats.missed / total) * 100);

  return (
    <View style={styles.donutRow}>
      <View style={styles.donutCenter}>
        <Text style={styles.donutPct}>{pctComplete}%</Text>
        <Text style={styles.donutSub}>Complete</Text>
      </View>
      <View style={styles.legendCol}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#4CAF50' }]} />
          <Text style={styles.legendText}>Completed: {stats.completed} ({pctComplete}%)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#FF9800' }]} />
          <Text style={styles.legendText}>Pending: {stats.pending} ({pctPending}%)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#F44336' }]} />
          <Text style={styles.legendText}>Missed: {stats.missed} ({pctMissed}%)</Text>
        </View>
      </View>
    </View>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function AnalyticsScreen() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { fetchAnalytics(); }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError('');
    try {
      const months = getLast6Months();
      const weeks = getLast6Weeks();

      // 1. Registrations per month
      const { data: allParents } = await supabase
        .from('parents')
        .select('created_at, role')
        .neq('role', 'admin');

      const registrations: RegistrationPoint[] = months.map(m => ({
        label: monthLabel(m),
        count: (allParents ?? []).filter(p =>
          p.created_at?.slice(0, 7) === m
        ).length,
      }));

      const totalParents = (allParents ?? []).length;

      // 2. Total children
      const { count: totalChildren } = await supabase
        .from('children')
        .select('*', { count: 'exact', head: true });

      // 3. Most active users (by growth records)
      const { data: growthRaw } = await supabase
        .from('growth_records')
        .select('child_id');

      // Count per child, then join children→parents
      const childCounts: Record<string, number> = {};
      (growthRaw ?? []).forEach(g => {
        childCounts[g.child_id] = (childCounts[g.child_id] ?? 0) + 1;
      });

      const topChildIds = Object.entries(childCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id]) => id);

      let activeUsers: ActiveUser[] = [];
      if (topChildIds.length > 0) {
        const { data: childRows } = await supabase
          .from('children')
          .select('id, parent_id')
          .in('id', topChildIds);

        const parentIds = [...new Set((childRows ?? []).map(c => c.parent_id))];
        const { data: parentRows } = await supabase
          .from('parents')
          .select('id, full_name, email')
          .in('id', parentIds);

        activeUsers = (parentRows ?? []).map(p => {
          const childrenOfParent = (childRows ?? [])
            .filter(c => c.parent_id === p.id)
            .map(c => c.id);
          const count = childrenOfParent.reduce((sum, cid) => sum + (childCounts[cid] ?? 0), 0);
          return { full_name: p.full_name, email: p.email, record_count: count };
        }).sort((a, b) => b.record_count - a.record_count);
      }

      // 4. Growth records per week
      const { data: growthAll } = await supabase
        .from('growth_records')
        .select('created_at');

      const growthWeekly: GrowthPoint[] = weeks.map(w => ({
        label: w.label,
        count: (growthAll ?? []).filter(g => {
          const d = g.created_at?.slice(0, 10) ?? '';
          return d >= w.start && d <= w.end;
        }).length,
      }));

      // 5. AI consultations
      const { count: aiCount } = await supabase
        .from('ai_consultations')
        .select('*', { count: 'exact', head: true });

      // 6. Vaccine stats
      const { data: vaccines } = await supabase
        .from('immunizations')
        .select('status');

      const vaccineStats: VaccineStats = {
        completed: (vaccines ?? []).filter(v => v.status === 'given').length,
        pending:   (vaccines ?? []).filter(v => v.status === 'pending' || v.status === 'due').length,
        missed:    (vaccines ?? []).filter(v => v.status === 'missed' || v.status === 'overdue').length,
      };

      setData({
        registrations,
        activeUsers,
        growthWeekly,
        aiConsultations: aiCount ?? 0,
        vaccineStats,
        totalParents,
        totalChildren: totalChildren ?? 0,
      });
    } catch (e: any) {
      setError(e.message ?? 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.loadingText}>Loading analytics…</Text>
    </View>
  );

  if (error) return (
    <View style={styles.center}>
      <Ionicons name="alert-circle-outline" size={40} color="#F44336" />
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity style={styles.retryBtn} onPress={fetchAnalytics}>
        <Text style={styles.retryText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );

  if (!data) return null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Analytics</Text>
        <TouchableOpacity onPress={fetchAnalytics} style={styles.refreshBtn}>
          <Ionicons name="refresh-outline" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { backgroundColor: COLORS.primary + '15' }]}>
          <Ionicons name="people-outline" size={22} color={COLORS.primary} />
          <Text style={styles.summaryValue}>{data.totalParents}</Text>
          <Text style={styles.summaryLabel}>Parents</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: '#4CAF5015' }]}>
          <Ionicons name="happy-outline" size={22} color="#4CAF50" />
          <Text style={[styles.summaryValue, { color: '#4CAF50' }]}>{data.totalChildren}</Text>
          <Text style={styles.summaryLabel}>Children</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: '#9C27B015' }]}>
          <Ionicons name="chatbubble-ellipses-outline" size={22} color="#9C27B0" />
          <Text style={[styles.summaryValue, { color: '#9C27B0' }]}>{data.aiConsultations}</Text>
          <Text style={styles.summaryLabel}>AI Chats</Text>
        </View>
      </View>

      {/* Registrations Chart */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="person-add-outline" size={18} color={COLORS.primary} />
          <Text style={styles.cardTitle}>Registrations (Last 6 Months)</Text>
        </View>
        <BarChart data={data.registrations} color={COLORS.primary} />
      </View>

      {/* Growth Records Chart */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="trending-up-outline" size={18} color="#FF9800" />
          <Text style={styles.cardTitle}>Growth Records (Last 6 Weeks)</Text>
        </View>
        <BarChart data={data.growthWeekly} color="#FF9800" />
      </View>

      {/* Vaccine Completion */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="shield-checkmark-outline" size={18} color="#4CAF50" />
          <Text style={styles.cardTitle}>Vaccine Completion Rate</Text>
        </View>
        <VaccineDonut stats={data.vaccineStats} />
      </View>

      {/* Most Active Users */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="star-outline" size={18} color="#FF5722" />
          <Text style={styles.cardTitle}>Most Active Users</Text>
        </View>
        {data.activeUsers.length === 0 ? (
          <Text style={styles.emptyText}>No growth records yet</Text>
        ) : (
          data.activeUsers.map((u, i) => (
            <View key={i} style={styles.userRow}>
              <View style={styles.rankBadge}>
                <Text style={styles.rankText}>{i + 1}</Text>
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{u.full_name || 'Unknown'}</Text>
                <Text style={styles.userEmail}>{u.email}</Text>
              </View>
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{u.record_count}</Text>
                <Text style={styles.countLabel}>records</Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* AI Consultations summary */}
      <View style={[styles.card, { backgroundColor: '#9C27B008' }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="chatbubble-ellipses-outline" size={18} color="#9C27B0" />
          <Text style={styles.cardTitle}>AI Consultations</Text>
        </View>
        <View style={styles.aiSummaryRow}>
          <Text style={styles.aiCount}>{data.aiConsultations}</Text>
          <Text style={styles.aiDesc}>Total consultations with Zuri, the AI health assistant</Text>
        </View>
      </View>

    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8F9FA' },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: '#888', fontSize: 14 },
  errorText: { color: '#F44336', fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
  retryBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: RADIUS.md },
  retryText: { color: '#fff', fontWeight: '600' },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#1A1A1A' },
  refreshBtn: {
    padding: 8,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primary + '15',
  },

  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  summaryCard: {
    flex: 1,
    borderRadius: RADIUS.md,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  summaryValue: { fontSize: 22, fontWeight: '800', color: COLORS.primary },
  summaryLabel: { fontSize: 11, color: '#666', textAlign: 'center' },

  card: {
    backgroundColor: '#fff',
    borderRadius: RADIUS.md,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#333' },

  bar: { borderRadius: 4, minHeight: 2 },
  barValue: { fontSize: 10, color: '#888', marginBottom: 2 },
  barLabel: { fontSize: 10, color: '#888', marginTop: 4 },

  donutRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  donutCenter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 10,
    borderColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  donutPct: { fontSize: 16, fontWeight: '800', color: '#333' },
  donutSub: { fontSize: 9, color: '#888' },
  legendCol: { flex: 1, gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: '#555' },

  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  userInfo: { flex: 1 },
  userName: { fontSize: 14, fontWeight: '600', color: '#222' },
  userEmail: { fontSize: 12, color: '#888' },
  countBadge: { alignItems: 'center' },
  countText: { fontSize: 18, fontWeight: '800', color: '#FF5722' },
  countLabel: { fontSize: 10, color: '#888' },

  emptyText: { color: '#aaa', fontSize: 13, textAlign: 'center', paddingVertical: 16 },

  aiSummaryRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  aiCount: { fontSize: 48, fontWeight: '900', color: '#9C27B0' },
  aiDesc: { flex: 1, fontSize: 13, color: '#666', lineHeight: 18 },
});
