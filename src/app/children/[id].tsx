import { useT } from '@/hooks/useT';
import { COLORS, RADIUS } from '@/lib/theme';
import { useChildStore } from '@/store/childStore';
import { Child } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon as any} size={18} color={COLORS.primary} style={styles.infoIcon} />
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function getAgeString(dob: string): string {
  const birth = new Date(dob);
  const now = new Date();
  const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (months < 1) return 'Less than 1 month';
  if (months < 24) return `${months} month${months !== 1 ? 's' : ''}`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem > 0 ? `${years} yr ${rem} mo` : `${years} year${years !== 1 ? 's' : ''}`;
}

export default function ChildDetailScreen() {
  const t = useT();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { children, growthRecords, fetchGrowthRecords, selectChild, selectedChildId } = useChildStore();
  const [child, setChild] = useState<Child | null>(null);
  const [loadingGrowth, setLoadingGrowth] = useState(false);

  useEffect(() => {
    const found = children.find(c => c.id === id);
    if (found) {
      setChild(found);
      setLoadingGrowth(true);
      fetchGrowthRecords(found.id).finally(() => setLoadingGrowth(false));
    }
  }, [id, children]);

  if (!child) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator color={COLORS.primary} size="large" />
    </View>
  );

  const isActive = selectedChildId === child.id;
  const latestGrowth = growthRecords[0];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.onPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{child.full_name}</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.avatarCard}>
          <View style={[styles.avatarCircle, child.sex === 'female' ? styles.avatarFemale : styles.avatarMale]}>
            <Ionicons name={child.sex === 'female' ? 'female' : 'male'} size={36}
              color={child.sex === 'female' ? COLORS.primary : '#185FA5'} />
          </View>
          <Text style={styles.avatarName}>{child.full_name}</Text>
          <Text style={styles.avatarAge}>{getAgeString(child.date_of_birth)}</Text>
          {isActive ? (
            <View style={styles.activeBadge}>
              <Ionicons name="checkmark-circle" size={14} color={COLORS.onPrimary} />
              <Text style={styles.activeBadgeText}>Active</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.selectBtn} onPress={() => selectChild(child.id)}>
              <Text style={styles.selectBtnText}>Set as active child</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Child Details</Text>
          <InfoRow icon="calendar-outline" label="Date of Birth"
            value={new Date(child.date_of_birth).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })} />
          <InfoRow icon={child.sex === 'female' ? 'female-outline' : 'male-outline'} label="Sex"
            value={child.sex === 'female' ? 'Girl' : 'Boy'} />
          {child.birth_weight_kg && <InfoRow icon="scale-outline" label="Birth weight" value={`${child.birth_weight_kg} kg`} />}
          {child.birth_height_cm && <InfoRow icon="resize-outline" label="Birth height" value={`${child.birth_height_cm} cm`} />}
          {child.health_facility && <InfoRow icon="business-outline" label="Health facility" value={child.health_facility} />}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Growth Tracker</Text>
          {loadingGrowth ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 16 }} />
          ) : latestGrowth ? (
            <View style={styles.growthRow}>
              <View style={styles.growthStat}>
                <Text style={styles.growthValue}>{latestGrowth.weight_kg} kg</Text>
                <Text style={styles.growthLabel}>Weight</Text>
              </View>
              {latestGrowth.height_cm && (
                <View style={styles.growthStat}>
                  <Text style={styles.growthValue}>{latestGrowth.height_cm} cm</Text>
                  <Text style={styles.growthLabel}>Height</Text>
                </View>
              )}
              <View style={styles.growthStat}>
                <Text style={styles.growthValue}>{latestGrowth.age_months} mo</Text>
                <Text style={styles.growthLabel}>Age</Text>
              </View>
            </View>
          ) : (
            <Text style={styles.emptyText}>No records yet</Text>
          )}
          <TouchableOpacity style={styles.actionBtn}
            onPress={() => { selectChild(child.id); router.push('/(tabs)/growth' as any); }}>
            <Ionicons name="trending-up" size={16} color={COLORS.primary} />
            <Text style={styles.actionBtnText}>View growth records</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Quick Actions</Text>
          <TouchableOpacity style={styles.quickLink}
            onPress={() => { selectChild(child.id); router.push('/(tabs)/vaccines' as any); }}>
            <Ionicons name="shield-outline" size={20} color={COLORS.primary} />
            <Text style={styles.quickLinkText}>KEPI Schedule</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickLink}
            onPress={() => { selectChild(child.id); router.push('/(tabs)/chat' as any); }}>
            <Ionicons name="chatbubble-outline" size={20} color={COLORS.primary} />
            <Text style={styles.quickLinkText}>AI Chat</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: COLORS.background },
  loadingContainer:{ flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  header:          { backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16 },
  headerTitle:     { fontSize: 20, fontWeight: '700', color: COLORS.onPrimary, flex: 1, textAlign: 'center' },
  scroll:          { padding: 16, paddingBottom: 40 },
  avatarCard:      { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 24, alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  avatarCircle:    { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarMale:      { backgroundColor: '#E6F1FB' },
  avatarFemale:    { backgroundColor: COLORS.primaryLight },
  avatarName:      { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary },
  avatarAge:       { fontSize: 14, color: COLORS.textSecondary, marginTop: 4, marginBottom: 12 },
  activeBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full },
  activeBadgeText: { color: COLORS.onPrimary, fontSize: 13, fontWeight: '700' },
  selectBtn:       { borderWidth: 1, borderColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.full },
  selectBtnText:   { color: COLORS.primary, fontSize: 13, fontWeight: '600' },
  card:            { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  cardTitle:       { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  infoRow:         { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  infoIcon:        { marginRight: 12, marginTop: 2 },
  infoLabel:       { fontSize: 11, color: COLORS.textMuted, fontWeight: '500', marginBottom: 2 },
  infoValue:       { fontSize: 14, color: COLORS.textPrimary, fontWeight: '600' },
  growthRow:       { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12 },
  growthStat:      { alignItems: 'center' },
  growthValue:     { fontSize: 20, fontWeight: '700', color: COLORS.primary },
  growthLabel:     { fontSize: 11, color: COLORS.textMuted, marginTop: 4 },
  emptyText:       { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', paddingVertical: 12 },
  actionBtn:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  actionBtnText:   { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  quickLink:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  quickLinkText:   { flex: 1, fontSize: 14, color: COLORS.textPrimary, fontWeight: '500' },
});
