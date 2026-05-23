function toTitleCase(str: string): string { return str.toLowerCase().replace(/\b\w/g, (ch: string) => ch.toUpperCase()); }

// src/app/(tabs)/children.tsx
import { useT } from '@/hooks/useT';
import { COLORS, RADIUS } from '@/lib/theme';
import { useAuthStore } from '@/store/authStore';
import { useChildStore } from '@/store/childStore';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// ─── Types ────────────────────────────────────────────────────────────────────
type Child = {
  id: string;
  full_name: string;
  date_of_birth: string;
  sex: 'male' | 'female';
  // Optional enriched fields from store / joined query
  next_vaccine?: string | null;
  next_visit_date?: string | null;
  growth_status?: 'normal' | 'monitor' | 'alert' | null;
  vaccines_given?: number;
  vaccines_total?: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getAgeLabel(dob: string): string {
  const birth = new Date(dob);
  const now = new Date();
  const totalMonths =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth());
  if (totalMonths < 1) return 'Newborn';
  if (totalMonths < 24) return `${totalMonths} mo`;
  const years = Math.floor(totalMonths / 12);
  const rem = totalMonths % 12;
  return rem > 0 ? `${years}y ${rem}m` : `${years} yr${years !== 1 ? 's' : ''}`;
}

function getGrowthBadge(status?: Child['growth_status']) {
  if (!status) return null;
  const map = {
    normal:  { label: 'On Track',   bg: '#E8F5E9', color: '#2E7D32', icon: 'checkmark-circle' as const },
    monitor: { label: 'Monitor',    bg: '#FFF8E1', color: '#BA7517', icon: 'alert-circle'     as const },
    alert:   { label: 'See Doctor', bg: '#FFEBEE', color: '#C62828', icon: 'warning'           as const },
  };
  return map[status];
}

function getGenderStyle(sex: 'male' | 'female') {
  return sex === 'female'
    ? { iconBg: '#FCE4EC', iconColor: '#C2185B', avatarBg: '#F48FB1' }
    : { iconBg: '#E3F2FD', iconColor: '#1565C0', avatarBg: '#64B5F6' };
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function formatDOB(dob: string): string {
  return new Date(dob).toLocaleDateString('en-KE', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ChildAvatar({ child }: { child: Child }) {
  const gs = getGenderStyle(child.sex);
  return (
    <View style={[styles.avatar, { backgroundColor: gs.avatarBg }]}>
      <Text style={styles.avatarInitials}>{getInitials(child.full_name)}</Text>
      <View style={[styles.avatarDot, { backgroundColor: gs.iconColor }]} />
    </View>
  );
}

function VaccineProgress({ given = 0, total = 0 }: { given?: number; total?: number }) {
  if (total === 0) return null;
  const pct = Math.min(given / total, 1);
  return (
    <View style={styles.vaccineRow}>
      <Ionicons name="shield-checkmark-outline" size={11} color={COLORS.given} />
      <View style={styles.vaccineBarBg}>
        <View style={[styles.vaccineBarFill, { width: `${Math.round(pct * 100)}%` as any }]} />
      </View>
      <Text style={styles.vaccineLabel}>{given}/{total}</Text>
    </View>
  );
}

function GrowthBadge({ status }: { status?: Child['growth_status'] }) {
  const badge = getGrowthBadge(status);
  if (!badge) return null;
  return (
    <View style={[styles.growthBadge, { backgroundColor: badge.bg }]}>
      <Ionicons name={badge.icon} size={11} color={badge.color} />
      <Text style={[styles.growthBadgeText, { color: badge.color }]}>{badge.label}</Text>
    </View>
  );
}

function ActivePill() {
  return (
    <View style={styles.activePill}>
      <Ionicons name="radio-button-on" size={10} color={COLORS.onPrimary} />
      <Text style={styles.activePillText}>Active</Text>
    </View>
  );
}

function ChildCard({
  item,
  isSelected,
  onPress,
}: {
  item: Child;
  isSelected: boolean;
  onPress: () => void;
}) {
  const gs = getGenderStyle(item.sex);

  return (
    <TouchableOpacity
      style={[styles.card, isSelected && styles.cardActive]}
      onPress={onPress}
      activeOpacity={0.82}
    >
      {/* Active left accent bar */}
      {isSelected && <View style={styles.activeAccentBar} />}

      {/* Avatar */}
      <ChildAvatar child={item} />

      {/* Body */}
      <View style={styles.cardBody}>
        {/* Name + active pill */}
        <View style={styles.cardNameRow}>
          <Text style={styles.cardName} numberOfLines={1}>{toTitleCase(item.full_name)}</Text>
          {isSelected && <ActivePill />}
        </View>

        {/* Age chip + DOB */}
        <View style={styles.cardMetaRow}>
          <View style={[styles.agePill, { backgroundColor: gs.iconBg }]}>
            <Ionicons name="calendar-outline" size={11} color={gs.iconColor} />
            <Text style={[styles.agePillText, { color: gs.iconColor }]}>
              {getAgeLabel(item.date_of_birth)}
            </Text>
          </View>
          <Text style={styles.dobText}>{formatDOB(item.date_of_birth)}</Text>
        </View>

        {/* Vaccine bar */}
        <VaccineProgress given={item.vaccines_given} total={item.vaccines_total} />

        {/* Next visit */}
        {item.next_visit_date && (
          <View style={styles.nextVisitRow}>
            <Ionicons name="time-outline" size={11} color={COLORS.due} />
            <Text style={styles.nextVisitText}>
              Next visit:{' '}
              {new Date(item.next_visit_date).toLocaleDateString('en-KE', {
                day: 'numeric', month: 'short',
              })}
            </Text>
          </View>
        )}
      </View>

      {/* Right col: growth badge + chevron */}
      <View style={styles.cardRight}>
        <GrowthBadge status={item.growth_status} />
        <View style={[styles.chevronCircle, isSelected && styles.chevronCircleActive]}>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={isSelected ? COLORS.onPrimary : COLORS.textMuted}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  const t = useT();
  return (
    <View style={styles.emptyContainer}>
      {/* Triple-ring decorative icon */}
      <View style={styles.emptyRingOuter}>
        <View style={styles.emptyRingInner}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="people-outline" size={48} color={COLORS.primary} />
          </View>
        </View>
      </View>

      <Text style={styles.emptyTitle}>{t('no_children')}</Text>
      <Text style={styles.emptySubtitle}>{t('no_children_hint')}</Text>

      {/* Feature preview cards */}
      <View style={styles.emptyHints}>
        {[
          { icon: 'shield-checkmark-outline', text: 'Track vaccinations',  color: COLORS.given    },
          { icon: 'trending-up-outline',      text: 'Monitor growth',      color: COLORS.primary  },
          { icon: 'star-outline',             text: 'Record milestones',   color: COLORS.upcoming },
        ].map((h) => (
          <View key={h.text} style={styles.emptyHintRow}>
            <View style={[styles.emptyHintIcon, { backgroundColor: `${h.color}18` }]}>
              <Ionicons name={h.icon as any} size={16} color={h.color} />
            </View>
            <Text style={styles.emptyHintText}>{h.text}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.emptyBtn} onPress={onAdd} activeOpacity={0.85}>
        <Ionicons name="add-circle-outline" size={20} color={COLORS.onPrimary} />
        <Text style={styles.emptyBtnText}>{t('add_child_btn')}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function ChildrenScreen() {
  const t = useT();
  const router = useRouter();
  const { user, hydrated } = useAuthStore();
  const { children, fetchChildren, selectChild, selectedChildId } = useChildStore();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (hydrated && user) fetchChildren(user.id);
  }, [hydrated, user]);

  const handleRefresh = async () => {
    if (!user) return;
    setRefreshing(true);
    await fetchChildren(user.id);
    setRefreshing(false);
  };

  if (!hydrated) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={COLORS.primary} size="large" />
        <Text style={styles.loadingText}>Loading children…</Text>
      </View>
    );
  }

  // Stats for hero bar
  const onTrack  = (children as Child[]).filter((c) => c.growth_status === 'normal').length;
  const upcoming = (children as Child[]).filter((c) => c.next_visit_date).length;

  return (
    <View style={styles.container}>

      {/* ── Hero Header ── */}
      <View style={styles.header}>
        <View style={styles.headerDecorCircle} />
        <View style={styles.headerDecorCircle2} />

        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIconWrap}>
              <Ionicons name="people" size={20} color={COLORS.primary} />
            </View>
            <View>
              <Text style={styles.headerLabel}>ZuriHealth</Text>
              <Text style={styles.headerTitle}>{t('tab_children')}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => router.push('/children/add')}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={22} color={COLORS.onPrimary} />
          </TouchableOpacity>
        </View>

        {/* Stats bar — only when children exist */}
        {children.length > 0 && (
          <View style={styles.statsBar}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{children.length}</Text>
              <Text style={styles.statLabel}>{children.length === 1 ? 'Child' : 'Children'}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{onTrack}</Text>
              <Text style={styles.statLabel}>On Track</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{upcoming}</Text>
              <Text style={styles.statLabel}>Upcoming Visit</Text>
            </View>
          </View>
        )}
      </View>

      {/* ── List ── */}
      <FlatList
        data={children as Child[]}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          children.length === 0 && styles.listContentEmpty,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => (
          <ChildCard
            item={item}
            isSelected={item.id === selectedChildId}
            onPress={() => {
              selectChild(item.id);
              router.push(`/children/${item.id}`);
            }}
          />
        )}
        ListHeaderComponent={
          children.length > 0 ? (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {children.length === 1 ? '1 Child' : `${children.length} Children`}
              </Text>
              <TouchableOpacity onPress={() => router.push('/children/add')}>
                <Text style={styles.sectionAction}>+ Add child</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
        ListEmptyComponent={<EmptyState onAdd={() => router.push('/children/add')} />}
        ListFooterComponent={<>
          <View style={styles.tipCard}>
            <View style={styles.tipAccent} />
            <View style={{ flex: 1, padding: 12 }}>
              <Text style={styles.tipTitle}>💡 Did you know?</Text>
              <Text style={styles.tipBody}>
                Regular growth monitoring helps detect malnutrition early. WHO recommends monthly check-ups for children under 2 years.
              </Text>
            </View>
          </View>
          <View style={{ height: 140 }} />
        </>}
      />

      {/* ── FAB ── */}
      {children.length > 0 && (
        <TouchableOpacity
          style={[styles.fab, Platform.OS === 'web' ? styles.fabWeb : styles.fabNative]}
          onPress={() => router.push('/children/add')}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={28} color={COLORS.onPrimary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: COLORS.background },
  loadingContainer:  { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText:       { fontSize: 14, color: COLORS.textMuted, fontWeight: '500' },

  // Header
  header: {
    backgroundColor: COLORS.primary,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingTop: 56,
    paddingBottom: 20,
    paddingHorizontal: 20,
    overflow: 'hidden',

    ...Platform.select({

      ios: { shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16 },

      android: { elevation: 13 },

      default: {},

    }),
    elevation: 8,
  },
  headerDecorCircle: {
    position: 'absolute', width: 180, height: 180, borderRadius: 90,
    borderWidth: 30, borderColor: 'rgba(255,255,255,0.07)', top: -40, right: -30,
  },
  headerDecorCircle2: {
    position: 'absolute', width: 100, height: 100, borderRadius: 50,
    borderWidth: 20, borderColor: 'rgba(255,255,255,0.05)', bottom: 10, left: -20,
  },
  headerContent:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIconWrap: { width: 38, height: 38, borderRadius: RADIUS.md, backgroundColor: 'rgba(255,255,255,0.95)', alignItems: 'center', justifyContent: 'center' },
  headerLabel:    { fontSize: 11, color: 'rgba(255,255,255,0.70)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  headerTitle:    { fontSize: 22, fontWeight: '800', color: COLORS.onPrimary, marginTop: 1 },
  addBtn:         { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },

  // Stats bar
  statsBar:    { flexDirection: 'row', marginTop: 18, backgroundColor: 'rgba(255,255,255,0.13)', borderRadius: RADIUS.xl, paddingVertical: 12, paddingHorizontal: 8 },
  statItem:    { flex: 1, alignItems: 'center' },
  statValue:   { fontSize: 20, fontWeight: '800', color: COLORS.onPrimary },
  statLabel:   { fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: '600', marginTop: 2 },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.20)', marginVertical: 4 },

  // List
  listContent:      { paddingHorizontal: 16, paddingTop: 16 },
  listContentEmpty: { flexGrow: 1 },
  sectionHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle:     { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
  sectionAction:    { fontSize: 13, fontWeight: '700', color: COLORS.primary },

  // Card
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 18,
    padding: 14, borderWidth: 1.5, borderColor: COLORS.border, gap: 12,
    overflow: 'hidden',
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8 }, android: { elevation: 6 }, default: {} }), elevation: 3,
  },
  cardActive: {
    borderColor: COLORS.primary, borderWidth: 2,
    backgroundColor: '#F5FAFF',
    shadowColor: COLORS.primary, shadowOpacity: 0.12, elevation: 5,
  },
  activeAccentBar: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
    backgroundColor: COLORS.primary,
    borderTopLeftRadius: 18, borderBottomLeftRadius: 18,
  },

  // Avatar
  avatar:         { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontSize: 18, fontWeight: '800', color: COLORS.white, letterSpacing: -0.5 },
  avatarDot:      { position: 'absolute', bottom: 1, right: 1, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: COLORS.white },

  // Card body
  cardBody:    { flex: 1, gap: 5 },
  cardNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  cardName:    { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, flexShrink: 1 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  agePill:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: RADIUS.full },
  agePillText: { fontSize: 11, fontWeight: '700' },
  dobText:     { fontSize: 11, color: COLORS.textMuted, fontWeight: '500' },

  // Vaccine
  vaccineRow:     { flexDirection: 'row', alignItems: 'center', gap: 5 },
  vaccineBarBg:   { flex: 1, height: 4, backgroundColor: '#E2E8F0', borderRadius: RADIUS.full, overflow: 'hidden' },
  vaccineBarFill: { height: 4, backgroundColor: COLORS.given, borderRadius: RADIUS.full },
  vaccineLabel:   { fontSize: 10, color: COLORS.textMuted, fontWeight: '600', minWidth: 28 },

  // Next visit
  nextVisitRow:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  nextVisitText: { fontSize: 11, color: COLORS.due, fontWeight: '600' },

  // Card right
  cardRight:           { alignItems: 'flex-end', gap: 8 },
  growthBadge:         { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: RADIUS.full },
  growthBadgeText:     { fontSize: 10, fontWeight: '700' },
  chevronCircle:       { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  chevronCircleActive: { backgroundColor: COLORS.primary },

  // Active pill
  activePill:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.primary, paddingHorizontal: 7, paddingVertical: 3, borderRadius: RADIUS.full },
  activePillText: { color: COLORS.onPrimary, fontSize: 10, fontWeight: '700' },

  // Empty state
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingTop: 40 },
  emptyRingOuter: { width: 136, height: 136, borderRadius: 68, backgroundColor: `${COLORS.primary}0D`, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  emptyRingInner: { width: 108, height: 108, borderRadius: 54, backgroundColor: `${COLORS.primary}18`, alignItems: 'center', justifyContent: 'center' },
  emptyIconCircle:{ width: 84, height: 84, borderRadius: 42, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  emptyTitle:     { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary, textAlign: 'center' },
  emptySubtitle:  { fontSize: 13, color: COLORS.textMuted, marginTop: 8, textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  emptyHints:     { width: '100%', gap: 10, marginBottom: 32 },
  emptyHintRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 12, borderWidth: 1, borderColor: COLORS.border, elevation: 1 },
  emptyHintIcon:  { width: 34, height: 34, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  emptyHintText:  { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  emptyBtn:       { backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, paddingVertical: 15, paddingHorizontal: 28, flexDirection: 'row', alignItems: 'center', gap: 8, ...Platform.select({ ios: { shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.30, shadowRadius: 8 }, android: { elevation: 6 }, default: {} }), elevation: 6 },
  emptyBtnText:   { color: COLORS.onPrimary, fontWeight: '700', fontSize: 15 },

  // FAB
  fab:       { position: 'absolute', width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', right: 20, ...Platform.select({ ios: { shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10 }, android: { elevation: 6 }, default: {} }), elevation: 8 },
  fabNative: { bottom: 158 },
  fabWeb:    { bottom: 76 },

  tipCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tipAccent: { width: 4, backgroundColor: '#208AEF' },
  tipTitle: { fontSize: 13, fontWeight: '800', color: '#208AEF', marginBottom: 4 },
  tipBody: { fontSize: 12, color: '#64748B', lineHeight: 18 },
});
