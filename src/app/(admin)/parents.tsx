/**
 * src/app/(admin)/parents.tsx
 * mamaTOTO - Admin: Parents Management Screen
 */
import { supabase } from '@/lib/supabase';
import { COLORS, RADIUS } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

interface ParentRow {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  child_count: number;
  created_at: string;
}

export default function AdminParentsScreen() {
  const [parents, setParents] = useState<ParentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchParents();
  }, []);

  async function fetchParents() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, created_at, children(count)')
        .eq('role', 'parent')
        .order('full_name');
      if (error) throw error;
      const rows: ParentRow[] = (data ?? []).map((r: any) => ({
        id: r.id,
        full_name: r.full_name ?? '-',
        email: r.email ?? '-',
        phone: r.phone,
        child_count: r.children?.[0]?.count ?? 0,
        created_at: r.created_at,
      }));
      setParents(rows);
    } catch (err) {
      console.error('[AdminParents] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }

  const filtered = parents.filter(p => {
    const q = search.toLowerCase();
    return (
      p.full_name.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q) ||
      (p.phone ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={COLORS.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or email..."
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} size="large" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="person-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>No parents found</Text>
            </View>
          ) : (
            filtered.map(p => (
              <View key={p.id} style={styles.card}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{(p.full_name?.[0] ?? '?').toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name}>{p.full_name}</Text>
                    <View style={styles.childBadge}>
                      <Ionicons name="people-outline" size={11} color={COLORS.primary} />
                      <Text style={styles.childBadgeText}>{p.child_count}</Text>
                    </View>
                  </View>
                  <Text style={styles.email}>{p.email}</Text>
                  {p.phone ? (
                    <Text style={styles.meta}>{p.phone}</Text>
                  ) : null}
                  <Text style={styles.meta}>
                    Joined {new Date(p.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                </View>
              </View>
            ))
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {filtered.length} of {parents.length} parents
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.white,
    margin: 16,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
  },

  list: { paddingHorizontal: 16 },

  emptyState: {
    alignItems: 'center',
    marginTop: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: COLORS.textMuted,
    fontWeight: '500',
  },

  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: COLORS.primary },

  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  name:    { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },

  childBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  childBadgeText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },

  email: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 2 },
  meta:  { fontSize: 12, color: COLORS.textMuted },

  footer: {
    paddingVertical: 10,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  footerText: { fontSize: 12, color: COLORS.textMuted, fontWeight: '500' },
});