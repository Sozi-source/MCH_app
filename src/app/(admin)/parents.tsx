import { supabase } from '@/lib/supabase';
import { COLORS, RADIUS } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface Parent {
  id: string;
  auth_user_id: string;
  full_name: string;
  email: string;
  phone?: string;
  created_at: string;
  role: string;
  childCount?: number;
}

export default function AdminParentsScreen() {
  const [parents, setParents] = useState<Parent[]>([]);
  const [filtered, setFiltered] = useState<Parent[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => { fetchParents(); }, []);

  useEffect(() => {
    if (!search.trim()) { setFiltered(parents); return; }
    const q = search.toLowerCase();
    setFiltered(parents.filter(p =>
      p.full_name?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q)
    ));
  }, [search, parents]);

  const fetchParents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('parents')
      .select('id, auth_user_id, full_name, email, phone, created_at, role')
      .neq('role', 'admin')
      .order('created_at', { ascending: false });

    if (error) { console.error(error); setLoading(false); return; }

    const withCounts = await Promise.all((data ?? []).map(async (p: Parent) => {
      const { count } = await supabase
        .from('children')
        .select('*', { count: 'exact', head: true })
        .eq('parent_id', p.id);
      return { ...p, childCount: count ?? 0 };
    }));

    setParents(withCounts);
    setFiltered(withCounts);
    setLoading(false);
  };

  const handleDelete = (p: Parent) => {
    if (p.role === 'admin') {
      Alert.alert('Cannot Delete', 'Admin accounts cannot be deleted.');
      return;
    }
    Alert.alert(
      'Delete Parent',
      `Are you sure you want to delete ${p.full_name}? This will also delete all their children and health records.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => confirmDelete(p),
        },
      ]
    );
  };

  const confirmDelete = async (p: Parent) => {
    setDeleting(p.id);
    try {
      // Delete from parents table (cascades to children and related records)
      const { error: parentErr } = await supabase
        .from('parents')
        .delete()
        .eq('id', p.id);

      if (parentErr) throw parentErr;

      // Delete from auth.users via admin API
      const { error: authErr } = await supabase.auth.admin.deleteUser(p.auth_user_id);
      if (authErr) console.warn('Auth user not deleted:', authErr.message);

      // Remove from local state
      setParents(prev => prev.filter(x => x.id !== p.id));
      setFiltered(prev => prev.filter(x => x.id !== p.id));
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to delete parent.');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>All Parents</Text>
        <Text style={styles.headerSub}>{parents.length} registered</Text>
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={18} color={COLORS.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or email..."
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
        <ScrollView contentContainerStyle={styles.list}>
          {filtered.length === 0 ? (
            <Text style={styles.emptyText}>No parents found</Text>
          ) : (
            filtered.map(p => (
              <View key={p.id} style={styles.card}>
                <View style={styles.cardLeft}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{(p.full_name?.[0] ?? '?').toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.nameRow}>
                      <Text style={styles.name}>{p.full_name}</Text>
                      {p.role === 'admin' && (
                        <View style={styles.adminBadge}>
                          <Text style={styles.adminBadgeText}>Admin</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.email}>{p.email}</Text>
                    {p.phone ? <Text style={styles.meta}>{p.phone}</Text> : null}
                    <Text style={styles.meta}>
                      Joined {new Date(p.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </Text>
                  </View>
                </View>

                <View style={styles.rightCol}>
                  <View style={styles.childBadge}>
                    <Ionicons name="heart" size={12} color={COLORS.primary} />
                    <Text style={styles.childBadgeText}>{p.childCount}</Text>
                  </View>
                  {p.role !== 'admin' && (
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleDelete(p)}
                      disabled={deleting === p.id}
                    >
                      {deleting === p.id
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Ionicons name="trash-outline" size={16} color="#fff" />
                      }
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))
          )}
          <View style={{ height: 140 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: COLORS.background },
  header:         { backgroundColor: COLORS.primary, padding: 24, paddingTop: 56 },
  headerTitle:    { fontSize: 22, fontWeight: '700', color: COLORS.onPrimary },
  headerSub:      { fontSize: 13, color: COLORS.primaryMid, marginTop: 2 },
  searchRow:      { flexDirection: 'row', alignItems: 'center', margin: 16, backgroundColor: COLORS.white, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  searchIcon:     {},
  searchInput:    { flex: 1, fontSize: 14, color: COLORS.textPrimary },
  list:           { paddingHorizontal: 16, gap: 10 },
  card:           { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 14, borderWidth: 1, borderColor: COLORS.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardLeft:       { flexDirection: 'row', alignItems: 'flex-start', gap: 12, flex: 1 },
  avatar:         { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  avatarText:     { fontSize: 18, fontWeight: '800', color: COLORS.primary },
  nameRow:        { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name:           { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  adminBadge:     { backgroundColor: COLORS.primary, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  adminBadgeText: { fontSize: 10, fontWeight: '700', color: COLORS.onPrimary },
  email:          { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  meta:           { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  rightCol:       { alignItems: 'center', gap: 8 },
  childBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.primaryLight, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  childBadgeText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  deleteBtn:      { backgroundColor: '#E53935', borderRadius: 8, padding: 6, alignItems: 'center', justifyContent: 'center' },
  emptyText:      { textAlign: 'center', color: COLORS.textMuted, marginTop: 40 },
});

