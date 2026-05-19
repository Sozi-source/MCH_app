import { supabase } from '@/lib/supabase';
import { COLORS, RADIUS } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface Child {
  id: string;
  full_name: string;
  date_of_birth: string;
  sex: 'male' | 'female';
  health_facility?: string;
  created_at: string;
  parents: { full_name: string; email: string } | null;
}

function getAgeLabel(dob: string) {
  const birth = new Date(dob);
  const now = new Date();
  const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (months < 1) return 'Newborn';
  if (months < 24) return `${months} months old`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem > 0 ? `${years}y ${rem}m old` : `${years} years old`;
}

export default function AdminChildrenScreen() {
  const [children, setChildren] = useState<Child[]>([]);
  const [filtered, setFiltered] = useState<Child[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchChildren(); }, []);

  useEffect(() => {
    if (!search.trim()) { setFiltered(children); return; }
    const q = search.toLowerCase();
    setFiltered(children.filter(c =>
      c.full_name?.toLowerCase().includes(q) ||
      c.parents?.full_name?.toLowerCase().includes(q)
    ));
  }, [search, children]);

  const fetchChildren = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('children')
      .select('id, full_name, date_of_birth, sex, health_facility, created_at, parents(full_name, email)')
      .order('created_at', { ascending: false });

    if (error) { console.error(error); }
    setChildren((data as any) ?? []);
    setFiltered((data as any) ?? []);
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>All Children</Text>
        <Text style={styles.headerSub}>{children.length} registered</Text>
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={18} color={COLORS.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by child or parent name..."
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
            <Text style={styles.emptyText}>No children found</Text>
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
                      <Ionicons name={c.sex === 'female' ? 'female' : 'male'} size={11} color={c.sex === 'female' ? '#C2185B' : '#1565C0'} />
                    </View>
                  </View>
                  <Text style={styles.age}>
                    {c.date_of_birth ? getAgeLabel(c.date_of_birth) : 'Age unknown'}
                  </Text>
                  {c.parents && (
                    <Text style={styles.parent}>
                      Parent: {c.parents.full_name}
                    </Text>
                  )}
                  {c.health_facility && (
                    <Text style={styles.facility}>
                      <Ionicons name="business-outline" size={11} /> {c.health_facility}
                    </Text>
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
  searchInput:    { flex: 1, fontSize: 14, color: COLORS.textPrimary },
  list:           { paddingHorizontal: 16, gap: 10 },
  card:           { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 14, borderWidth: 1, borderColor: COLORS.border, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  avatar:         { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarFemale:   { backgroundColor: '#FCE4EC' },
  avatarMale:     { backgroundColor: '#E3F2FD' },
  avatarText:     { fontSize: 18, fontWeight: '800', color: COLORS.primary },
  nameRow:        { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name:           { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  sexBadge:       { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  sexBadgeFemale: { backgroundColor: '#FCE4EC' },
  sexBadgeMale:   { backgroundColor: '#E3F2FD' },
  age:            { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  parent:         { fontSize: 12, color: COLORS.primary, marginTop: 3, fontWeight: '600' },
  facility:       { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  emptyText:      { textAlign: 'center', color: COLORS.textMuted, marginTop: 40 },
});