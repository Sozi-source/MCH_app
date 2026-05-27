/**
 * src/app/(admin)/children.tsx
 * ZuriHealth — Admin: Children Management Screen
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

interface ChildRow {
  id: string;
  full_name: string;
  date_of_birth: string;
  sex: 'male' | 'female';
  parent_name?: string;
  parent_email?: string;
}

function ageLabel(dob: string): string {
  const diff = Date.now() - new Date(dob).getTime();
  const months = Math.floor(diff / (1000 * 60 * 60 * 24 * 30.44));
  if (months < 12) return `${months}mo`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem > 0 ? `${years}y ${rem}mo` : `${years}y`;
}

export default function AdminChildrenScreen() {
  const [children, setChildren] = useState<ChildRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchChildren();
  }, []);

  async function fetchChildren() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('children')
        .select('id, full_name, date_of_birth, sex, profiles:parent_id(full_name, email)')
        .order('full_name');
      if (error) throw error;
      const rows: ChildRow[] = (data ?? []).map((r: any) => ({
        id: r.id,
        full_name: r.full_name,
        date_of_birth: r.date_of_birth,
        sex: r.sex,
        parent_name: r.profiles?.full_name,
        parent_email: r.profiles?.email,
      }));
      setChildren(rows);
    } catch (err) {
      console.error('[AdminChildren] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }

  const filtered = children.filter(c => {
    const q = search.toLowerCase();
    return (
      c.full_name?.toLowerCase().includes(q) ||
      c.parent_name?.toLowerCase().includes(q) ||
      c.parent_email?.toLowerCase().includes(q)
    );
  });

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={COLORS.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by child or parent name..."
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
              <Ionicons name="people-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>No children found</Text>
            </View>
          ) : (
            filtered.map(c => (
              <View key={c.id} style={styles.card}>
                <View style={[styles.avatar, c.sex === 'female' ? styles.avatarFemale : styles.avatarMale]}>
                  <Text style={styles.avatarText}>{(c.full_name?.[0] ?? '?').toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name}>{c.full_name}</Text>
                    <View style={[styles.sexBadge, c.sex === 'female' ? styles.sexBadgeFemale : styles.sexBadgeMale]}>
                      <Ionicons
                        name={c.sex === 'female' ? 'female' : 'male'}
                        size={11}
                        color={c.sex === 'female' ? '#C2185B' : '#1565C0'}
                      />
                    </View>
                  </View>
                  <Text style={styles.age}>
                    {ageLabel(c.date_of_birth)} · DOB {new Date(c.date_of_birth).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                  {c.parent_name && (
                    <Text style={styles.parent}>
                      <Ionicons name="person-outline" size={11} color={COLORS.textMuted} />
                      {' '}{c.parent_name}
                      {c.parent_email ? ` · ${c.parent_email}` : ''}
                    </Text>
                  )}
                </View>
              </View>
            ))
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Stats footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {filtered.length} of {children.length} children
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
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarMale:   { backgroundColor: '#DBEAFE' },
  avatarFemale: { backgroundColor: '#FCE7F3' },
  avatarText:   { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },

  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  name:    { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },

  sexBadge: {
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  sexBadgeMale:   { backgroundColor: '#DBEAFE' },
  sexBadgeFemale: { backgroundColor: '#FCE7F3' },

  age:    { fontSize: 12, color: COLORS.textSecondary, marginBottom: 2 },
  parent: { fontSize: 12, color: COLORS.textMuted },

  footer: {
    paddingVertical: 10,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  footerText: { fontSize: 12, color: COLORS.textMuted, fontWeight: '500' },
});