/**
 * src/app/(tabs)/index.tsx
 * ZuriHealth — Improved Home Screen
 * Changes: stats strip in hero, vaccine due alert, bell icon, cleaner layout
 */

import { useAuthStore } from '@/store/authStore';
import { useChildStore } from '@/store/childStore';
import { useVaccineStore } from '@/store/vaccineStore';
import { COLORS, RADIUS } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import {
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function toTitleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, (ch: string) => ch.toUpperCase());
}

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

// ─────────────────────────────────────────────────────────────────────────────
// Quick actions config
// ─────────────────────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  {
    label: 'Growth',
    image: require('@/assets/images/action-growth.png'),
    route: '/(tabs)/growth',
    color: '#208AEF',
    emoji: '📈',
    desc: 'Weight & height',
  },
  {
    label: 'Vaccines',
    image: require('@/assets/images/action-vaccines.png'),
    route: '/(tabs)/vaccines',
    color: '#1D9E75',
    emoji: '💉',
    desc: 'Immunisations',
  },
  {
    label: 'Milestones',
    image: require('@/assets/images/action-milestones.png'),
    route: '/(tabs)/milestones',
    color: '#534AB7',
    emoji: '🏆',
    desc: 'Development',
  },
  {
    label: 'Nutrition',
    image: require('@/assets/images/action-nutrition.png'),
    route: '/(tabs)/nutrition',
    color: '#FF9800',
    emoji: '🥗',
    desc: 'Feeding guide',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Daily tips — rotates by day of year
// ─────────────────────────────────────────────────────────────────────────────

const DAILY_TIPS = [
  'Keep your child\'s vaccine card handy and bring it to every clinic visit. Early immunisation prevents serious illness.',
  'Exclusive breastfeeding for the first 6 months gives your baby the best start in life.',
  'Weigh your child every month and track growth at your MCH clinic.',
  'Wash hands with soap before feeding your child to prevent diarrhoea.',
  'If your child has a fever above 38°C, visit the nearest health facility.',
  'Start complementary foods at exactly 6 months while continuing breastfeeding.',
  'Vitamin A supplements every 6 months protect your child\'s eyesight and immunity.',
];

function getDailyTip(): string {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  return DAILY_TIPS[dayOfYear % DAILY_TIPS.length];
}

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { session, signOut } = useAuthStore();
  const { children, selectedChildId, selectChild, growthRecords, fetchGrowthRecords } = useChildStore();
  const { vaccineRows, fetchSchedules, fetchImmunizations, computeRows, schedules } = useVaccineStore();
  const router = useRouter();

  const firstName = session?.user?.user_metadata?.full_name?.split(' ')[0] ?? 'Mama';
  const activeChild = children.find(c => c.id === selectedChildId) ?? children[0];
  const ageMonths = activeChild?.date_of_birth ? getAgeMonths(activeChild.date_of_birth) : 0;

  // Load data for stats strip
  useEffect(() => {
    if (!activeChild?.id) return;
    fetchGrowthRecords(activeChild.id);
    (async () => {
      if (schedules.length === 0) await fetchSchedules();
      const imms = await fetchImmunizations(activeChild.id);
      computeRows(activeChild.date_of_birth, imms);
    })();
  }, [activeChild?.id]);

  // Stats
  const latestGrowth = growthRecords[0] ?? null;
  const vaccineGiven = vaccineRows.filter(r => r.status === 'given').length;
  const vaccineTotal = vaccineRows.length;
  const dueVaccines = vaccineRows.filter(r => r.status === 'due');
  const missedVaccines = vaccineRows.filter(r => r.status === 'missed');
  const alertVaccine = dueVaccines[0] ?? missedVaccines[0] ?? null;
  const alertIsMissed = !!missedVaccines[0] && !dueVaccines[0];

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
      {/* ── Hero ──────────────────────────────────────────────────────── */}
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
              <Ionicons name="notifications-outline" size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => router.push('/(tabs)/settings' as any)}
            >
              <Ionicons name="settings-outline" size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconBtn, styles.logoutBtn]}
              onPress={handleSignOut}
            >
              <Ionicons name="log-out-outline" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Child card */}
        {activeChild ? (
          <View style={styles.heroCard}>
            <View style={[
              styles.heroAvatar,
              { backgroundColor: activeChild.sex === 'female' ? '#FCE4EC' : '#E3F2FD' },
            ]}>
              <Text style={styles.heroAvatarText}>
                {(activeChild.full_name?.[0] ?? '?').toUpperCase()}
              </Text>
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
              <Text style={styles.addChildSub}>Track growth, vaccines and milestones</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        )}

        {/* NEW: Stats strip */}
        {activeChild && (
          <View style={styles.statsStrip}>
            <View style={styles.statPill}>
              <Text style={styles.statLabel}>Weight</Text>
              <Text style={styles.statValue}>
                {latestGrowth ? `${latestGrowth.weight_kg} kg` : '—'}
              </Text>
              <Text style={styles.statSub}>
                {latestGrowth?.waz != null
                  ? latestGrowth.waz >= -2 ? 'Normal' : 'Low'
                  : 'Not recorded'}
              </Text>
            </View>
            <View style={styles.statPill}>
              <Text style={styles.statLabel}>Vaccines</Text>
              <Text style={styles.statValue}>
                {vaccineTotal > 0 ? `${vaccineGiven}/${vaccineTotal}` : '—'}
              </Text>
              <Text style={styles.statSub}>
                {dueVaccines.length > 0
                  ? `${dueVaccines.length} due`
                  : missedVaccines.length > 0
                  ? `${missedVaccines.length} missed`
                  : 'Up to date'}
              </Text>
            </View>
            <View style={styles.statPill}>
              <Text style={styles.statLabel}>Age</Text>
              <Text style={styles.statValue}>{ageMonths}mo</Text>
              <Text style={styles.statSub}>
                {ageMonths < 6 ? 'Infant' : ageMonths < 24 ? 'Baby' : 'Toddler'}
              </Text>
            </View>
          </View>
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

      {/* ── Vaccine Alert ─────────────────────────────────────────────── */}
      {activeChild && alertVaccine && (
        <TouchableOpacity
          style={[
            styles.alertCard,
            { borderLeftColor: alertIsMissed ? COLORS.missed : COLORS.due },
          ]}
          onPress={() => router.push('/(tabs)/vaccines')}
          activeOpacity={0.85}
        >
          <View style={[
            styles.alertIconWrap,
            { backgroundColor: alertIsMissed ? COLORS.missedLight : COLORS.dueLight },
          ]}>
            <Ionicons
              name="medical"
              size={20}
              color={alertIsMissed ? COLORS.missed : COLORS.due}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.alertTitle}>
              {alertVaccine.schedule.vaccine_name}
              {alertVaccine.schedule.dose_number > 0 ? ` Dose ${alertVaccine.schedule.dose_number}` : ''}
            </Text>
            <Text style={styles.alertSub}>
              {alertIsMissed ? 'Missed — visit your MCH clinic' : 'Due soon — schedule a visit'}
            </Text>
          </View>
          <View style={[
            styles.alertBadge,
            { backgroundColor: alertIsMissed ? COLORS.missedLight : COLORS.dueLight },
          ]}>
            <Text style={[
              styles.alertBadgeText,
              { color: alertIsMissed ? COLORS.missed : COLORS.due },
            ]}>
              {alertIsMissed ? 'Missed' : 'Due'}
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {/* ── Quick Actions ─────────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Access</Text>
        <View style={styles.actionsGrid}>
          {QUICK_ACTIONS.map(a => (
            <TouchableOpacity
              key={a.label}
              style={[styles.actionCard, { backgroundColor: a.color }]}
              onPress={() => router.push(a.route as any)}
              activeOpacity={0.82}
            >
              <View style={styles.actionContent}>
                <View style={styles.actionTop}>
                  <View style={styles.actionIconWrap}>
                    <Image
                      source={a.image}
                      style={{ width: 22, height: 22, resizeMode: 'contain', tintColor: '#fff' }}
                    />
                  </View>
                  <Text style={styles.actionEmoji}>{a.emoji}</Text>
                </View>
                <Text style={styles.actionLabel}>{a.label}</Text>
                <Text style={styles.actionDesc}>{a.desc}</Text>
              </View>
              <View style={styles.actionDecor} />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Zuri AI CTA ───────────────────────────────────────────────── */}
      <TouchableOpacity
        style={styles.zuriCard}
        onPress={() => router.push('/(tabs)/chat' as any)}
        activeOpacity={0.85}
      >
        <View style={styles.zuriLeft}>
          <View style={styles.zuriAvatar}>
            <Image
              source={require('@/assets/features/zuri-ai-512.png')}
              style={{ width: 44, height: 44, resizeMode: 'cover' }}
            />
          </View>
          <View>
            <Text style={styles.zuriTitle}>Ask Zuri AI</Text>
            <Text style={styles.zuriSub}>Evidence-based health answers</Text>
          </View>
        </View>
        <View style={styles.zuriBtn}>
          <Text style={styles.zuriBtnText}>Chat</Text>
          <Ionicons name="arrow-forward" size={14} color={COLORS.primary} />
        </View>
      </TouchableOpacity>

      {/* ── Daily Tip ─────────────────────────────────────────────────── */}
      <View style={styles.tipCard}>
        <View style={styles.tipIconWrap}>
          <Ionicons name="bulb" size={20} color="#E65100" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.tipHeading}>Daily Tip</Text>
          <Text style={styles.tipText}>{getDailyTip()}</Text>
        </View>
      </View>

      <View style={{ height: 140 }} />
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: '#F0F4F8' },
  content: { paddingBottom: 32 },

  // Hero
  hero: {
    backgroundColor: COLORS.primary,
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  topBarRight:  { flexDirection: 'row', gap: 4, alignItems: 'center' },
  logoutBtn:    {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  iconBtn:      { padding: 7 },
  greeting:     { fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
  heroName:     { fontSize: 22, fontWeight: '800', color: '#fff', marginTop: 2 },

  heroCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    marginBottom: 12,
  },
  heroAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroAvatarText: { fontSize: 22, fontWeight: '800', color: COLORS.primary },
  genderBadge: {
    position: 'absolute',
    bottom: 0, right: 0,
    width: 18, height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  heroInfo:      { flex: 1 },
  heroChildName: { fontSize: 15, fontWeight: '800', color: '#1A202C', marginBottom: 3 },
  ageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primaryLight,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    marginBottom: 3,
  },
  ageBadgeText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  heroDob:       { fontSize: 10, color: COLORS.textMuted },
  heroArrow: {
    width: 34, height: 34,
    borderRadius: 17,
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
    marginBottom: 12,
  },
  addChildIconWrap: {
    width: 46, height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addChildTitle: { fontSize: 14, fontWeight: '700', color: '#fff' },
  addChildSub:   { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2 },

  // Stats strip
  statsStrip: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  statPill: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  statLabel: { fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  statValue: { fontSize: 15, fontWeight: '800', color: '#fff', marginTop: 2 },
  statSub:   { fontSize: 9, color: 'rgba(255,255,255,0.6)', marginTop: 1 },

  pillsRow: { flexDirection: 'row', gap: 8 },
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

  // Alert card
  alertCard: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderLeftWidth: 4,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  alertIconWrap: {
    width: 40, height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  alertSub:   { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  alertBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  alertBadgeText: { fontSize: 11, fontWeight: '700' },

  // Sections
  section:      { paddingHorizontal: 16, marginTop: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#1A202C', marginBottom: 12 },

  // Action cards
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionCard: {
    width: '47.5%',
    borderRadius: 20,
    overflow: 'hidden',
    height: 120,
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
    width: 38, height: 38,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionEmoji:  { fontSize: 20 },
  actionLabel:  { fontSize: 14, fontWeight: '800', color: '#fff' },
  actionDesc:   { fontSize: 10, color: 'rgba(255,255,255,0.82)' },
  actionDecor: {
    position: 'absolute',
    bottom: -18, right: -18,
    width: 70, height: 70,
    borderRadius: 35,
    borderWidth: 18,
    borderColor: 'rgba(255,255,255,0.1)',
  },

  // Zuri card
  zuriCard: {
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 20,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
  },
  zuriLeft:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  zuriAvatar: {
    width: 44, height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: COLORS.primaryLight,
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

  // Tip card
  tipCard: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#FFF8E1',
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    borderLeftWidth: 3,
    borderLeftColor: '#FF9800',
  },
  tipIconWrap: {
    width: 36, height: 36,
    borderRadius: 18,
    backgroundColor: '#FFE0B2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipHeading: { fontSize: 12, fontWeight: '800', color: '#E65100', marginBottom: 4 },
  tipText:    { fontSize: 12, color: '#795548', lineHeight: 18 },
});