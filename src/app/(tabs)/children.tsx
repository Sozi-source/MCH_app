import { useT } from '@/hooks/useT';
import { COLORS, RADIUS } from '@/lib/theme';
import { useAuthStore } from '@/store/authStore';
import { useChildStore } from '@/store/childStore';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { Platform,
  ActivityIndicator, FlatList, StyleSheet,
  Text, TouchableOpacity, View
} from 'react-native';

export default function ChildrenScreen() {
  const t = useT();
  const router = useRouter();
  const { user, hydrated } = useAuthStore();
  const { children, fetchChildren, selectChild, selectedChildId } = useChildStore();

  useEffect(() => {
    if (hydrated && user) fetchChildren(user.id);
  }, [hydrated, user]);

  if (!hydrated) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator color={COLORS.primary} size="large" />
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="people" size={22} color={COLORS.onPrimary} />
        <Text style={styles.headerTitle}>{t('tab_children')}</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/children/add')}
        >
          <Ionicons name="add" size={24} color={COLORS.onPrimary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={children}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.childCard,
              item.id === selectedChildId && styles.childCardActive,
            ]}
            onPress={() => {
              selectChild(item.id);
              router.push(`/children/${item.id}`);
            }}
          >
            <View style={[
              styles.childIconCircle,
              item.sex === 'female' ? styles.childIconFemale : styles.childIconMale,
            ]}>
              <Ionicons
                name={item.sex === 'female' ? 'female' : 'male'}
                size={22}
                color={item.sex === 'female' ? COLORS.primary : '#185FA5'}
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.childName}>{item.full_name}</Text>
              <Text style={styles.childInfo}>
                {t('dob_label')}: {new Date(item.date_of_birth).toLocaleDateString('en-KE', {
                  day: 'numeric', month: 'long', year: 'numeric',
                })}
              </Text>
            </View>

            <View style={styles.rightCol}>
              {item.id === selectedChildId && (
                <View style={styles.activeTag}>
                  <Ionicons name="checkmark-circle" size={14} color={COLORS.onPrimary} />
                  <Text style={styles.activeTagText}>{t('active')}</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="people-outline" size={48} color={COLORS.primaryMid} />
            </View>
            <Text style={styles.emptyText}>{t('no_children')}</Text>
            <Text style={styles.emptyHint}>{t('no_children_hint')}</Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => router.push('/children/add')}
            >
              <Ionicons name="add-circle-outline" size={18} color={COLORS.onPrimary} />
              <Text style={styles.emptyBtnText}>{t('add_child_btn')}</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  listContent:      { padding: 16, paddingBottom: 32 },
  header:           { backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingTop: 52, paddingBottom: 16 },
  headerTitle:      { fontSize: 20, fontWeight: '700', color: COLORS.onPrimary, flex: 1 },
  addBtn:           { padding: 4 },
  childCard:        { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border, gap: 12, elevation: 1 },
  childCardActive:  { borderColor: COLORS.primary, borderWidth: 2, backgroundColor: COLORS.primaryLight },
  childIconCircle:  { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  childIconMale:    { backgroundColor: '#E6F1FB' },
  childIconFemale:  { backgroundColor: COLORS.primaryLight },
  childName:        { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  childInfo:        { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  rightCol:         { alignItems: 'flex-end', gap: 6 },
  activeTag:        { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.primary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.full },
  activeTagText:    { color: COLORS.onPrimary, fontSize: 11, fontWeight: '700' },
  emptyBox:         { alignItems: 'center', marginTop: 60, paddingHorizontal: 32 },
  emptyIconCircle:  { width: 88, height: 88, borderRadius: 44, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyText:        { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  emptyHint:        { fontSize: 13, color: COLORS.textMuted, marginTop: 6, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  emptyBtn:         { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  emptyBtnText:     { color: COLORS.onPrimary, fontWeight: '700', fontSize: 15 },
});