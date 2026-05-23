function toTitleCase(str: string): string { return str.toLowerCase().replace(/\b\w/g, (ch: string) => ch.toUpperCase()); }

/**
 * src/app/(tabs)/index.tsx
 * ZuriHealth — Premium Home Screen
 */

import { useAuthStore } from '@/store/authStore';
import { useChildStore } from '@/store/childStore';
import { COLORS, RADIUS } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Alert, Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// ── Quick actions ─────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  {
    label: 'Growth',
    image: require('@/assets/images/action-growth.png'), // growth uses trending-up style
    route: '/(tabs)/growth',
    gradient: ['#208AEF', '#0D6FD8'],
    emoji: '📈',
    desc: 'Weight & height',
  },
  {
    label: 'Vaccines',
    image: require('@/assets/images/action-vaccines.png'),
    route: '/(tabs)/vaccines',
    gradient: ['#1D9E75', '#158A62'],
    emoji: '💉',
    desc: 'Immunisations',
  },
  {
    label: 'Milestones',
    image: require('@/assets/images/action-milestones.png'),
    route: '/(tabs)/milestones',
    gradient: ['#9C27B0', '#7B1FA2'],
    emoji: '🏆',
    desc: 'Development',
  },
  {
    label: 'Nutrition',
    image: require('@/assets/images/action-nutrition.png'),
    route: '/(tabs)/nutrition',
    gradient: ['#FF9800', '#F57C00'],
    emoji: '🥗',
    desc: 'Feeding guide',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getAgeLabel(dob: string) {
  const birth = new Date(dob);
  const now = new Date();
  const months =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth());
  if (months < 1) return 'Newborn';
  if (months < 24) return `${months} months old`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem > 0 ? `${years}y ${rem}m old` : `${years} years old`;
}

function getAgeMonths(dob: string) {
  const birth = new Date(dob);
  const now = new Date();
  return (
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth())
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// Age progress ring (SVG-like using View borders)
function AgeRing({ ageMonths, maxMonths = 60 }: { ageMonths: number; maxMonths?: number }) {
  const pct = Math.min(ageMonths / maxMonths, 1);
  const size = 80;
  const strokeWidth = 6;

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{
        position: 'absolute',
        width: size, height: size,
        borderRadius: size / 2,
        borderWidth: strokeWidth,
        borderColor: 'rgba(255,255,255,0.2)',
      }} />
      <View style={{
        position: 'absolute',
        width: size, height: size,
        borderRadius: size / 2,
        borderWidth: strokeWidth,
        borderColor: 'transparent',
        borderTopColor: pct > 0 ? '#fff' : 'transparent',
        borderRightColor: pct > 0.25 ? '#fff' : 'transparent',
        borderBottomColor: pct > 0.5 ? '#fff' : 'transparent',
        borderLeftColor: pct > 0.75 ? '#fff' : 'transparent',
        transform: [{ rotate: '-45deg' }],
      }} />
    </View>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { session, signOut } = useAuthStore();
  const { children, selectedChildId, selectChild } = useChildStore();
  const router = useRouter();

  const firstName =
    session?.user?.user_metadata?.full_name?.split(' ')[0] ?? 'Mama';
  const activeChild =
    children.find(c => c.id === selectedChildId) ?? children[0];
  const ageMonths = activeChild?.date_of_birth
    ? getAgeMonths(activeChild.date_of_birth)
    : 0;

  const handleSignOut = () => {
    const doSignOut = () =>
      signOut().then(() => router.replace('/(auth)/login' as any));
    if (Platform.OS === 'web') {
      if (window.confirm('Sign out of your account?')) doSignOut();
    } else {
      Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: doSignOut },
      ]);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Hero Header ─────────────────────────────────────────────── */}
      <View style={styles.hero}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <View>
            <Text style={styles.greeting}>{getGreeting()} 👋</Text>
            <Text style={styles.heroName}>{firstName}</Text>
          </View>
          <View style={styles.topBarRight}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => router.push('/(tabs)/settings' as any)}
            >
              <Ionicons name="settings-outline" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Active child hero card */}
        {activeChild ? (
          <View style={styles.heroCard}>
            {/* Avatar */}
            <View style={[
              styles.heroAvatar,
              { backgroundColor: activeChild.sex === 'female' ? '#FCE4EC' : '#E3F2FD' },
            ]}>
              <Text style={styles.heroAvatarText}>
                {(activeChild.full_name?.[0] ?? '?').toUpperCase()}
              </Text>
              {/* Gender badge */}
              <View style={[
                styles.genderBadge,
                { backgroundColor: activeChild.sex === 'female' ? '#E91E63' : '#1565C0' },
              ]}>
                <Ionicons
                  name={activeChild.sex === 'female' ? 'female' : 'male'}
                  size={10}
                  color="#fff"
                />
              </View>
            </View>

            {/* Info */}
            <View style={styles.heroInfo}>
              <Text style={styles.heroChildName}>{toTitleCase(activeChild.full_name)}</Text>
              {activeChild.date_of_birth ? (
                <>
                  <View style={styles.ageBadge}>
                    <Ionicons name="time-outline" size={12} color={COLORS.primary} />
                    <Text style={styles.ageBadgeText}>
                      {getAgeLabel(activeChild.date_of_birth)}
                    </Text>
                  </View>
                  <Text style={styles.heroDob}>
                    Born{' '}
                    {new Date(activeChild.date_of_birth).toLocaleDateString('en-KE', {
                      day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </Text>
                </>
              ) : (
                <Text style={styles.heroDob}>Date of birth not set</Text>
              )}
            </View>

            {/* View profile */}
            <TouchableOpacity
              style={styles.heroArrow}
              onPress={() => router.push('/(tabs)/children')}
            >
              <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.addChildHero}
            onPress={() => router.push('/(tabs)/children')}
          >
            <View style={styles.addChildIconWrap}>
              <Ionicons name="add" size={26} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.addChildTitle}>Add your first child</Text>
              <Text style={styles.addChildSub}>
                Track growth, vaccines and milestones
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        )}

        {/* Child switcher pills */}
        {children.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillsRow}
          >
            {children.map(c => {
              const active = c.id === activeChild?.id;
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.pill, active && styles.pillActive]}
                  onPress={() => selectChild(c.id)}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name={c.sex === 'female' ? 'female' : 'male'}
                    size={12}
                    color={active ? '#fff' : 'rgba(255,255,255,0.7)'}
                  />
                  <Text style={[styles.pillText, active && styles.pillTextActive]}>
                    {c.full_name.split(' ')[0]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* ── Quick Actions ────────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Access</Text>
        <View style={styles.actionsGrid}>
          {QUICK_ACTIONS.map(a => (
            <TouchableOpacity
              key={a.label}
              style={styles.actionCard}
              onPress={() => router.push(a.route as any)}
              activeOpacity={0.82}
            >
              <View style={[styles.actionBg, { backgroundColor: a.gradient[0] }]} />
              <View style={styles.actionContent}>
                <View style={styles.actionTop}>
                  <View style={styles.actionIconWrap}>
                    <Image
                      source={a.image}
                      style={{ width: 24, height: 24, resizeMode: 'contain', tintColor: '#fff' }}
                    />
                  </View>
                  <Text style={styles.actionEmoji}>{a.emoji}</Text>
                </View>
                <Text style={styles.actionLabel}>{a.label}</Text>
                <Text style={styles.actionDesc}>{a.desc}</Text>
              </View>
              <View style={[styles.actionDecor, { borderColor: a.gradient[1] }]} />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Health Snapshot ──────────────────────────────────────────── */}
      {activeChild && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Health Snapshot</Text>
          <View style={styles.snapshotRow}>
            <TouchableOpacity
              style={styles.snapshotCard}
              onPress={() => router.push('/(tabs)/growth')}
            >
              <View style={[styles.snapshotIcon, { backgroundColor: '#E3F2FD' }]}>
                <Image
                  source={require('@/assets/tabs/tab-growth-active.png')}
                  style={{ width: 24, height: 24, resizeMode: 'contain' }}
                />
              </View>
              <Text style={styles.snapshotLabel}>Growth</Text>
              <Text style={styles.snapshotValue}>Track</Text>
              <Ionicons name="chevron-forward" size={14} color={COLORS.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.snapshotCard}
              onPress={() => router.push('/(tabs)/vaccines')}
            >
              <View style={[styles.snapshotIcon, { backgroundColor: '#E8F5E9' }]}>
                <Image
                  source={require('@/assets/tabs/tab-vaccines-active.png')}
                  style={{ width: 24, height: 24, resizeMode: 'contain' }}
                />
              </View>
              <Text style={styles.snapshotLabel}>Vaccines</Text>
              <Text style={styles.snapshotValue}>View</Text>
              <Ionicons name="chevron-forward" size={14} color={COLORS.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.snapshotCard}
              onPress={() => router.push('/(tabs)/milestones')}
            >
              <View style={[styles.snapshotIcon, { backgroundColor: '#F3E5F5' }]}>
                <Image
                  source={require('@/assets/tabs/tab-progress-active.png')}
                  style={{ width: 24, height: 24, resizeMode: 'contain' }}
                />
              </View>
              <Text style={styles.snapshotLabel}>Milestones</Text>
              <Text style={styles.snapshotValue}>Check</Text>
              <Ionicons name="chevron-forward" size={14} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Daily Tip ────────────────────────────────────────────────── */}
      <View style={styles.tipCard}>
        <View style={styles.tipIconWrap}>
          <Ionicons name="bulb" size={22} color="#FF9800" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.tipHeading}>Daily Tip 💡</Text>
          <Text style={styles.tipText}>
            Keep your child's vaccine card handy and bring it to every clinic visit. Early immunisation prevents serious illness.
          </Text>
        </View>
      </View>

      {/* ── Zuri CTA ─────────────────────────────────────────────────── */}
      <TouchableOpacity
        style={styles.zuriCard}
        onPress={() => router.push('/(tabs)/chat' as any)}
        activeOpacity={0.85}
      >
        <View style={styles.zuriLeft}>
          <View style={styles.zuriAvatar}>
            <Image
              source={require('@/assets/features/feature-zuri-ai.png')}
              style={{ width: 26, height: 26, resizeMode: 'contain', tintColor: '#fff' }}
            />
          </View>
          <View>
            <Text style={styles.zuriTitle}>Ask Zuri AI</Text>
            <Text style={styles.zuriSub}>Your child health assistant</Text>
          </View>
        </View>
        <View style={styles.zuriBtn}>
          <Text style={styles.zuriBtnText}>Chat</Text>
          <Ionicons name="arrow-forward" size={14} color={COLORS.primary} />
        </View>
      </TouchableOpacity>

      <View style={{ height: 140 }} />
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: '#F0F4F8' },
  content: { paddingBottom: 32 },

  // Hero
  hero: {
    backgroundColor: COLORS.primary,
    paddingTop: 28,
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  topBarRight:  { flexDirection: 'row', gap: 4, alignItems: 'center' },
  iconBtn:      { padding: 6 },
  greeting:     { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
  heroName:     { fontSize: 24, fontWeight: '800', color: '#fff', marginTop: 2 },

  heroCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,

    ...Platform.select({

      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12 },

      android: { elevation: 10 },

      default: {},

    }),
    elevation: 5,
  },
  heroAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroAvatarText: { fontSize: 24, fontWeight: '800', color: COLORS.primary },
  genderBadge: {
    position: 'absolute',
    bottom: 0, right: 0,
    width: 20, height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  heroInfo:      { flex: 1 },
  heroChildName: { fontSize: 16, fontWeight: '800', color: '#1A202C', marginBottom: 4 },
  ageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primaryLight,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    marginBottom: 4,
  },
  ageBadgeText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  heroDob:       { fontSize: 11, color: COLORS.textMuted },
  heroArrow: {
    width: 36, height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  addChildHero: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    borderStyle: 'dashed',
  },
  addChildIconWrap: {
    width: 48, height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addChildTitle: { fontSize: 15, fontWeight: '700', color: '#fff' },
  addChildSub:   { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },

  pillsRow: { flexDirection: 'row', gap: 8, paddingTop: 14 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  pillActive:     { backgroundColor: 'rgba(255,255,255,0.3)', borderColor: '#fff' },
  pillText:       { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.75)' },
  pillTextActive: { color: '#fff' },

  // Sections
  section:      { paddingHorizontal: 16, marginTop: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#1A202C', marginBottom: 12 },

  // Action cards
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  actionCard: {
    width: '47%',
    borderRadius: 20,
    overflow: 'hidden',
    height: 130,
  },
  actionBg: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.95,
  },
  actionContent: {
    flex: 1,
    padding: 14,
    justifyContent: 'space-between',
  },
  actionTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  actionIconWrap: {
    width: 40, height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionEmoji:  { fontSize: 22 },
  actionLabel:  { fontSize: 14, fontWeight: '800', color: '#fff', marginTop: 2 },
  actionDesc:   { fontSize: 11, color: 'rgba(255,255,255,0.82)', marginTop: 1 },
  actionDecor: {
    position: 'absolute',
    bottom: -20, right: -20,
    width: 80, height: 80,
    borderRadius: 40,
    borderWidth: 20,
    borderColor: 'rgba(255,255,255,0.1)',
  },

  // Snapshot
  snapshotRow: { flexDirection: 'row', gap: 10 },
  snapshotCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    gap: 6,

    ...Platform.select({

      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6 },

      android: { elevation: 5 },

      default: {},

    }),
    elevation: 2,
  },
  snapshotIcon: {
    width: 42, height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  snapshotLabel: { fontSize: 11, fontWeight: '700', color: '#1A202C' },
  snapshotValue: { fontSize: 10, color: COLORS.primary, fontWeight: '600' },

  // Tip
  tipCard: {
    margin: 16,
    marginTop: 24,
    backgroundColor: '#FFF8E1',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  tipIconWrap: {
    width: 40, height: 40,
    borderRadius: 20,
    backgroundColor: '#FFE0B2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipHeading: { fontSize: 13, fontWeight: '800', color: '#E65100', marginBottom: 4 },
  tipText:    { fontSize: 12, color: '#795548', lineHeight: 18 },

  // Zuri CTA
  zuriCard: {
    marginHorizontal: 16,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: COLORS.primary + '30',
  },
  zuriLeft:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  zuriAvatar: {
    width: 44, height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zuriTitle: { fontSize: 14, fontWeight: '800', color: '#1A202C' },
  zuriSub:   { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  zuriBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.primary + '40',
  },
  zuriBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
});