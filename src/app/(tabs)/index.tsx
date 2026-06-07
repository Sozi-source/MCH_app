/** src/app/(tabs)/index.tsx — ZuriHealth Home Screen */

import { useAuthStore } from '@/store/authStore';
import { getAgeLabel } from '@/lib/ageUtils';
import { useChildStore } from '@/store/childStore';
import { useVaccineStore } from '@/store/vaccineStore';
import { COLORS, RADIUS } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import {
  Alert,
  Animated,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function toTitleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, (ch: string) => ch.toUpperCase());
}

function getAgeMonths(dob: string) {
  const birth = new Date(dob);
  const now = new Date();
  let months =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months -= 1;
  return Math.max(0, months);
}

/** Precise age: "3 mo 2 wk" for <12 months, otherwise getAgeLabel */
function getPreciseAge(dob: string): string {
  const birth = new Date(dob);
  const now = new Date();
  const totalDays = Math.floor((now.getTime() - birth.getTime()) / 86400000);
  if (totalDays < 0) return '0 days';
  const months = getAgeMonths(dob);
  if (months < 12) {
    const remainingDays = totalDays - months * 30; // approximate
    const weeks = Math.floor(Math.max(0, remainingDays) / 7);
    if (months === 0) {
      const wks = Math.floor(totalDays / 7);
      return wks > 0 ? `${wks} wk` : `${totalDays}d`;
    }
    return weeks > 0 ? `${months} mo ${weeks} wk` : `${months} mo`;
  }
  return getAgeLabel(dob);
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const QUICK_ACTIONS = [
  { label: 'Growth',     image: require('@/assets/images/action-growth.png'),     route: '/(tabs)/growth',     color: '#208AEF', emoji: '📈', desc: 'Weight & height' },
  { label: 'Vaccines',   image: require('@/assets/images/action-vaccines.png'),   route: '/(tabs)/vaccines',   color: '#1D9E75', emoji: '💉', desc: 'Immunisations' },
  { label: 'Milestones', image: require('@/assets/images/action-milestones.png'), route: '/(tabs)/milestones', color: '#534AB7', emoji: '🏆', desc: 'Development' },
  { label: 'Nutrition',  image: require('@/assets/images/action-nutrition.png'),  route: '/(tabs)/nutrition',  color: '#FF9800', emoji: '🥗', desc: 'Feeding guide' },
];

type MessageUrgency = 'urgent' | 'warning' | 'info' | 'tip';
interface SmartMessage {
  icon: string; iconColor: string; bgColor: string;
  heading: string; text: string; urgency: MessageUrgency;
  badge?: string; route?: string;
}

function getSmartMessage(ageMonths: number, latestGrowth: any, dueVaccines: any[], missedVaccines: any[]): SmartMessage {
  if (latestGrowth?.whz != null && latestGrowth.whz < -3)
    return { icon: 'warning', iconColor: '#fff', bgColor: '#C0392B', heading: 'Urgent: Severe acute malnutrition', text: "Weight-for-height critically low (SAM). Visit the nearest MCH clinic TODAY — your child qualifies for RUTF. Do not delay.", urgency: 'urgent', badge: 'SAM', route: '/(tabs)/growth' };
  if (latestGrowth?.whz != null && latestGrowth.whz < -2)
    return { icon: 'alert-circle', iconColor: '#fff', bgColor: '#E67E22', heading: 'Action needed: Moderate malnutrition', text: "Weight-for-height indicates MAM. Enrol at the MCH Supplementary Feeding Programme and increase meal frequency.", urgency: 'urgent', badge: 'MAM', route: '/(tabs)/growth' };
  if (latestGrowth?.waz != null && latestGrowth.waz < -3)
    return { icon: 'trending-down', iconColor: '#fff', bgColor: '#D35400', heading: 'Weight alert: Severely underweight', text: "Weight-for-age critically low. Offer 4 energy-dense meals daily — eggs, groundnut paste, mashed liver, beans with oil. Visit MCH urgently.", urgency: 'urgent', badge: 'Urgent', route: '/(tabs)/growth' };
  if (missedVaccines.length > 0) {
    const names = missedVaccines.map((v: any) => `${v.schedule.vaccine_name}${v.schedule.dose_number > 0 ? ` Dose ${v.schedule.dose_number}` : ''}`).join(', ');
    const count = missedVaccines.length;
    return { icon: 'medical', iconColor: '#fff', bgColor: '#C0392B', heading: count > 1 ? `${count} missed vaccines` : 'Missed vaccine', text: `${names} ${count > 1 ? 'were' : 'was'} missed. Visit your nearest MCH clinic to catch up — delayed vaccines leave your child unprotected.`, urgency: 'urgent', badge: count > 1 ? `${count} Missed` : 'Missed', route: '/(tabs)/vaccines' };
  }
  const soonDue = dueVaccines.find((v: any) => v.daysUntilDue != null && v.daysUntilDue <= 7);
  if (soonDue) {
    const name = `${soonDue.schedule.vaccine_name}${soonDue.schedule.dose_number > 0 ? ` Dose ${soonDue.schedule.dose_number}` : ''}`;
    const days = soonDue.daysUntilDue;
    return { icon: 'calendar', iconColor: '#fff', bgColor: '#0F6E56', heading: 'Vaccine due soon', text: `${name} is due ${days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`}. Book your MCH clinic visit now.`, urgency: 'warning', badge: days === 0 ? 'Due today' : days === 1 ? 'Due tomorrow' : `Due in ${days}d`, route: '/(tabs)/vaccines' };
  }
  if (dueVaccines.length > 0) {
    const v = dueVaccines[0];
    const name = `${v.schedule.vaccine_name}${v.schedule.dose_number > 0 ? ` Dose ${v.schedule.dose_number}` : ''}`;
    return { icon: 'medical-outline', iconColor: '#fff', bgColor: '#1D9E75', heading: 'Vaccination reminder', text: `${name} is due. Visit your MCH clinic to keep your child protected. Always bring the immunisation card.`, urgency: 'warning', badge: 'Due', route: '/(tabs)/vaccines' };
  }
  if (!latestGrowth)
    return { icon: 'analytics-outline', iconColor: '#fff', bgColor: '#534AB7', heading: "Record your child's first weight", text: 'No growth records yet. Add weight and height to start tracking against WHO standards and catch concerns early.', urgency: 'warning', badge: 'Not recorded', route: '/(tabs)/growth' };
  const daysSince = Math.floor((Date.now() - new Date(latestGrowth.date).getTime()) / 86400000);
  if (daysSince > 30)
    return { icon: 'bar-chart-outline', iconColor: '#fff', bgColor: '#534AB7', heading: 'Time to weigh your child', text: `Last weight recorded ${daysSince} days ago. Monthly growth monitoring at your MCH clinic helps catch problems early.`, urgency: 'warning', badge: `${daysSince}d ago`, route: '/(tabs)/growth' };
  const FEEDING_DEFAULTS = [
    { minAge: 0,  maxAge: 6,  heading: 'Exclusive breastfeeding',   text: 'Breast milk only for the first 6 months — no water, porridge, or formula. Breastfeed on demand at least 8–12× daily including at night.' },
    { minAge: 6,  maxAge: 9,  heading: 'Feeding tip: 6–8 months',   text: 'Offer 2–3 meals of thick smooth porridge daily alongside breastfeeding. Add mashed orange vegetables, eggs, and a few drops of oil.' },
    { minAge: 9,  maxAge: 12, heading: 'Feeding tip: 9–11 months',  text: 'Offer 3–4 mashed or finely chopped meals daily. Include iron-rich foods: mashed liver, eggs, beans, and omena. Continue breastfeeding.' },
    { minAge: 12, maxAge: 24, heading: 'Feeding tip: 12–23 months', text: 'Offer 3 meals and 1–2 nutritious snacks daily. Breast milk still provides up to 50% of energy — continue breastfeeding up to 2 years.' },
    { minAge: 24, maxAge: 60, heading: 'Feeding tip: Toddlers',     text: '3 meals and 2 healthy snacks daily across all food groups. Limit sugar and processed foods. Ensure daily dark green leafy vegetables.' },
  ];
  const fm = FEEDING_DEFAULTS.find(f => ageMonths >= f.minAge && ageMonths < f.maxAge);
  if (fm)
    return { icon: 'restaurant-outline', iconColor: '#fff', bgColor: '#E67E22', heading: fm.heading, text: fm.text, urgency: 'tip', badge: 'Nutrition tip', route: '/(tabs)/nutrition' };
  return { icon: 'bulb-outline', iconColor: '#fff', bgColor: '#1D9E75', heading: 'Health reminder', text: 'Visit your MCH clinic regularly for growth monitoring, vaccines, and nutritional support — free for all children under 5 in Kenya.', urgency: 'tip' };
}

function SmartMessageCard({ msg, onPress }: { msg: SmartMessage; onPress?: () => void }) {
  const isUrgent  = msg.urgency === 'urgent';
  const isWarning = msg.urgency === 'warning';
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(10)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 70, friction: 9, useNativeDriver: true }),
    ]).start();
    if (isUrgent || isWarning) {
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 900, useNativeDriver: true }),
      ])).start();
    }
  }, [isUrgent, isWarning]);

  const inner = (
    <Animated.View style={[sc.card, { backgroundColor: msg.bgColor, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <View style={sc.decor} />
      <View style={sc.row}>
        <Animated.View style={[sc.iconCircle, { transform: [{ scale: pulseAnim }] }]}>
          <Ionicons name={msg.icon as any} size={20} color="#fff" />
        </Animated.View>
        <View style={sc.textBlock}>
          <Text style={sc.heading} numberOfLines={1}>{msg.heading}</Text>
          <Text style={sc.body} numberOfLines={2}>{msg.text}</Text>
        </View>
        {msg.badge && (
          <View style={sc.badge}>
            <Text style={sc.badgeText}>{msg.badge}</Text>
          </View>
        )}
      </View>
      {onPress && (
        <View style={sc.footer}>
          <Text style={sc.ctaText}>Tap to view details</Text>
          <View style={sc.ctaArrow}>
            <Ionicons name="arrow-forward" size={11} color={msg.bgColor} />
          </View>
        </View>
      )}
    </Animated.View>
  );

  return onPress
    ? <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={sc.wrapper}>{inner}</TouchableOpacity>
    : <View style={sc.wrapper}>{inner}</View>;
}

const sc = StyleSheet.create({
  wrapper:    { marginHorizontal: 0, marginTop: 12 },
  card:       { borderRadius: 18, padding: 14, overflow: 'hidden', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 8 },
  decor:      { position: 'absolute', width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.07)', top: -30, right: -20 },
  row:        { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  textBlock:  { flex: 1 },
  heading:    { fontSize: 13, fontWeight: '800', color: '#fff', marginBottom: 2, letterSpacing: -0.2 },
  body:       { fontSize: 11, color: 'rgba(255,255,255,0.85)', lineHeight: 15 },
  badge:      { backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', flexShrink: 0 },
  badgeText:  { fontSize: 10, fontWeight: '700', color: '#fff' },
  footer:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)' },
  ctaText:    { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.8)', flex: 1 },
  ctaArrow:   { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
});

// ─── Welcome / Empty State ────────────────────────────────────────────────────
function WelcomeEmptyState({ firstName, onAddChild }: { firstName: string; onAddChild: () => void }) {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const heartAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 10, useNativeDriver: true }),
    ]).start();
    Animated.loop(Animated.sequence([
      Animated.timing(heartAnim, { toValue: 1.2, duration: 800, useNativeDriver: true }),
      Animated.timing(heartAnim, { toValue: 1,   duration: 800, useNativeDriver: true }),
    ])).start();
  }, []);

  const TILES = [
    { icon: 'trending-up',         color: '#208AEF', bg: '#EBF5FF', label: 'Growth'    },
    { icon: 'shield-checkmark',    color: '#1D9E75', bg: '#EDFAF4', label: 'Vaccines'  },
    { icon: 'restaurant',          color: '#FF9800', bg: '#FFF4E5', label: 'Nutrition' },
    { icon: 'chatbubble-ellipses', color: COLORS.primary, bg: COLORS.primary + '15', label: 'Zuri AI' },
  ];

  return (
    <Animated.View style={[we.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

      {/* Hero card — same style as child card */}
      <View style={we.heroCard}>
        <View style={we.heroAccentBar} />
        <View style={we.heroBody}>
          <View style={we.avatarStack}>
            <View style={we.momRing}>
              <View style={we.momCircle}>
                <Text style={we.momEmoji}>👩🏾</Text>
              </View>
            </View>
            <Animated.View style={[we.babyBubble, { transform: [{ scale: heartAnim }] }]}>
              <Text style={we.babyEmoji}>👶🏾</Text>
            </Animated.View>
          </View>
          <View style={we.heroText}>
            <Text style={we.heroTitle}>Karibu, {firstName}! 🌸</Text>
            <Text style={we.heroSub}>Add your child to get started</Text>
          </View>
          <TouchableOpacity style={we.heroArrow} onPress={onAddChild} activeOpacity={0.8}>
            <Ionicons name="chevron-forward-circle-outline" size={28} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        <View style={we.tilesRow}>
          {TILES.map((t, i) => (
            <View key={i} style={[we.tile, { backgroundColor: t.bg }]}>
              <Ionicons name={t.icon as any} size={18} color={t.color} />
              <Text style={[we.tileLabel, { color: t.color }]}>{t.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <TouchableOpacity style={we.ctaBtn} onPress={onAddChild} activeOpacity={0.88}>
        <Ionicons name="add-circle-outline" size={20} color="#fff" />
        <Text style={we.ctaBtnText}>Add your child</Text>
        <Ionicons name="arrow-forward" size={16} color="rgba(255,255,255,0.7)" />
      </TouchableOpacity>

    </Animated.View>
  );
}

const we = StyleSheet.create({
  container: { marginBottom: 14 },

  heroCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.09,
    shadowRadius: 10,
  },
  heroAccentBar: { height: 4, backgroundColor: '#F06292' },
  heroBody: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },

  avatarStack: { position: 'relative', width: 62, height: 62, flexShrink: 0 },
  momRing: {
    width: 62, height: 62, borderRadius: 31,
    borderWidth: 2.5, borderColor: '#F48FB1',
    alignItems: 'center', justifyContent: 'center',
  },
  momCircle: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#FCE4EC',
    alignItems: 'center', justifyContent: 'center',
  },
  momEmoji: { fontSize: 26 },
  babyBubble: {
    position: 'absolute', bottom: -4, right: -8,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 2, borderColor: '#FFD6E0',
    alignItems: 'center', justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3,
  },
  babyEmoji: { fontSize: 14 },

  heroText: { flex: 1 },
  heroTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A', letterSpacing: -0.4, marginBottom: 3 },
  heroSub:   { fontSize: 12, color: '#64748B', fontWeight: '500' },
  heroArrow: { flexShrink: 0, opacity: 0.75 },

  tilesRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FAFCFF',
  },
  tile: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, gap: 5,
  },
  tileLabel: { fontSize: 10, fontWeight: '700' },

  ctaBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    elevation: 6,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  ctaBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
});

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { session, signOut } = useAuthStore();
  const { children, selectedChildId, selectChild, growthRecords, fetchGrowthRecords } = useChildStore();
  const { vaccineRows, fetchSchedules, fetchImmunizations, computeRows, schedules } = useVaccineStore();
  const router = useRouter();

  const firstName   = session?.user?.user_metadata?.full_name?.split(' ')[0] ?? 'Mama';
  const activeChild = children.find(c => c.id === selectedChildId) ?? children[0];
  const ageMonths   = activeChild?.date_of_birth ? getAgeMonths(activeChild.date_of_birth) : 0;
  const hasChildren = children.length > 0;

  useFocusEffect(useCallback(() => {
    if (!activeChild?.id) return;
    fetchGrowthRecords(activeChild.id);
    (async () => {
      if (schedules.length === 0) await fetchSchedules();
      const imms = await fetchImmunizations(activeChild.id);
      computeRows(activeChild.date_of_birth, imms);
    })();
  }, [activeChild?.id]));

  const latestGrowth   = growthRecords[0] ?? null;
  const vaccineGiven   = vaccineRows.filter(r => r.status === 'given').length;
  const vaccineTotal   = vaccineRows.length;
  const dueVaccines    = vaccineRows.filter(r => r.status === 'due');
  const missedVaccines = vaccineRows.filter(r => r.status === 'missed');
  const smartMsg       = activeChild ? getSmartMessage(ageMonths, latestGrowth, dueVaccines, missedVaccines) : null;

  const handleSignOut = () => {
    const doSignOut = () => signOut().then(() => router.replace('/(auth)/login' as any));
    if (Platform.OS === 'web') {
      if (window.confirm('Sign out of your account?')) doSignOut();
    } else {
      Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: doSignOut },
      ]);
    }
  };

  const isFemale    = activeChild?.sex === 'female';
  const avatarBg    = isFemale ? '#FCE4EC' : '#E3F2FD';
  const genderColor = isFemale ? '#E91E63' : '#1565C0';

  return (
    <View style={styles.screen}>

      {/* ── FIXED HEADER ─────────────────────────────────────────────── */}
      <View style={[styles.fixedHeader, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerOrb1} />
        <View style={styles.headerOrb2} />
        <View style={styles.headerOrb3} />

        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <View style={styles.greetingRow}>
              <Text style={styles.greeting}>{getGreeting()}</Text>
              {!hasChildren && (
                <View style={styles.newBadge}>
                  <Text style={styles.newBadgeText}>New</Text>
                </View>
              )}
            </View>
            {hasChildren && activeChild ? (
              <View style={styles.childNameRow}>
                <Text style={styles.headerChildName} numberOfLines={1}>
                  {toTitleCase(activeChild.full_name)}
                </Text>
                <View style={styles.agePill}>
                  <Text style={styles.agePillText}>{getPreciseAge(activeChild.date_of_birth)}</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.headerWelcomeName}>{firstName} 🌸</Text>
            )}
            {!hasChildren && (
              <Text style={styles.headerTagline}>Your baby's health companion</Text>
            )}
          </View>

          <View style={styles.headerRight}>
            {hasChildren && (dueVaccines.length > 0 || missedVaccines.length > 0) && (
              <TouchableOpacity
                style={[styles.alertPill, { backgroundColor: missedVaccines.length > 0 ? COLORS.missed : COLORS.due }]}
                onPress={() => router.push('/(tabs)/vaccines')}
              >
                <Ionicons name="medical" size={11} color="#fff" />
                <Text style={styles.alertPillText}>
                  {missedVaccines.length > 0 ? `${missedVaccines.length} Missed` : `${dueVaccines.length} Due`}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/(tabs)/settings' as any)}>
              <Ionicons name="settings-outline" size={20} color="rgba(255,255,255,0.9)" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={handleSignOut}>
              <Ionicons name="log-out-outline" size={20} color="rgba(255,255,255,0.9)" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Header stats strip — only when child exists, now with precise age */}
        {hasChildren && activeChild && (
          <View style={styles.headerStatsStrip}>
            <View style={styles.headerStat}>
              <Text style={styles.headerStatVal}>
                {latestGrowth ? `${latestGrowth.weight_kg} kg` : '—'}
              </Text>
              <Text style={styles.headerStatLbl}>Weight</Text>
            </View>
            <View style={styles.headerStatDiv} />
            <View style={styles.headerStat}>
              <Text style={styles.headerStatVal}>
                {vaccineTotal > 0 ? `${vaccineGiven}/${vaccineTotal}` : '—'}
              </Text>
              <Text style={styles.headerStatLbl}>Vaccines</Text>
            </View>
            <View style={styles.headerStatDiv} />
            <View style={styles.headerStat}>
              <Text style={styles.headerStatVal}>{getPreciseAge(activeChild.date_of_birth)}</Text>
              <Text style={styles.headerStatLbl}>Age</Text>
            </View>
            <View style={styles.headerStatDiv} />
            <TouchableOpacity
              style={styles.headerStatAction}
              onPress={() => router.push('/(tabs)/children')}
            >
              <Ionicons name="people-outline" size={13} color="rgba(255,255,255,0.8)" />
              <Text style={styles.headerStatLbl}>{children.length} {children.length === 1 ? 'Child' : 'Children'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ── SCROLLABLE CONTENT ───────────────────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >

        {/* ── NEW USER: Welcome empty state ──────────────────────────── */}
        {!hasChildren && (
          <WelcomeEmptyState
            firstName={firstName}
            onAddChild={() => router.push('/(tabs)/children')}
          />
        )}

        {/* ── RETURNING USER: Redesigned Child Card ──────────────────── */}
        {hasChildren && activeChild && (
          <View style={cc.card}>
            {/* Soft gradient top accent bar */}
            <View style={[cc.accentBar, { backgroundColor: isFemale ? '#F06292' : '#42A5F5' }]} />

            {/* Top section: avatar + info + arrow */}
            <View style={cc.topRow}>
              {/* Avatar with glow ring */}
              <View style={[cc.avatarRing, { borderColor: isFemale ? '#F48FB1' : '#90CAF9' }]}>
                <View style={[cc.avatar, { backgroundColor: avatarBg }]}>
                  <Text style={[cc.avatarInitial, { color: genderColor }]}>
                    {(activeChild.full_name?.[0] ?? '?').toUpperCase()}
                  </Text>
                </View>
                {/* Gender dot */}
                <View style={[cc.genderDot, { backgroundColor: genderColor }]}>
                  <Ionicons name={isFemale ? 'female' : 'male'} size={8} color="#fff" />
                </View>
              </View>

              {/* Name + DOB + gender pill */}
              <View style={cc.nameMeta}>
                <Text style={cc.childName} numberOfLines={1}>
                  {toTitleCase(activeChild.full_name)}
                </Text>
                <Text style={cc.dob}>
                  Born {new Date(activeChild.date_of_birth).toLocaleDateString('en-KE', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </Text>
                <View style={[cc.genderPill, { backgroundColor: avatarBg }]}>
                  <Ionicons name={isFemale ? 'female' : 'male'} size={9} color={genderColor} />
                  <Text style={[cc.genderPillText, { color: genderColor }]}>
                    {isFemale ? 'Girl' : 'Boy'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={cc.editBtn}
                onPress={() => router.push('/(tabs)/children')}
              >
                <Ionicons name="chevron-forward-circle-outline" size={28} color={COLORS.primary} />
              </TouchableOpacity>
            </View>

            {/* Child switcher — only if multiple children */}
            {children.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={cc.switcherScroll}
                contentContainerStyle={cc.switcherContent}
              >
                {children.map(c => {
                  const active  = c.id === activeChild.id;
                  const cFemale = c.sex === 'female';
                  const cColor  = cFemale ? '#E91E63' : '#1565C0';
                  const cBg     = cFemale ? '#FCE4EC' : '#E3F2FD';
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[cc.switchPill, active && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}
                      onPress={() => selectChild(c.id)}
                    >
                      <View style={[cc.switchDot, { backgroundColor: active ? 'rgba(255,255,255,0.4)' : cBg }]}>
                        <Ionicons name={cFemale ? 'female' : 'male'} size={8} color={active ? '#fff' : cColor} />
                      </View>
                      <Text style={[cc.switchText, active && cc.switchTextActive]}>
                        {c.full_name.split(' ')[0]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

          </View>
        )}

        {/* Quick Actions — always visible */}
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
                      <Image source={a.image} style={{ width: 16, height: 16, resizeMode: 'contain', tintColor: '#fff' }} />
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

        {/* Zuri AI CTA */}
        <TouchableOpacity style={styles.zuriCard} onPress={() => router.push('/(tabs)/chat' as any)} activeOpacity={0.85}>
          <View style={styles.zuriLeft}>
            <View style={styles.zuriAvatar}>
              <Image source={require('@/assets/features/zuri-ai-512.png')} style={{ width: 44, height: 44, resizeMode: 'cover' }} />
            </View>
            <View>
              <Text style={styles.zuriTitle}>Ask Zuri AI</Text>
              <Text style={styles.zuriSub}>Evidence-based health answers</Text>
            </View>
          </View>
          <View style={styles.zuriBtn}>
            <Text style={styles.zuriBtnText}>Chat</Text>
            <Ionicons name="arrow-forward" size={13} color={COLORS.primary} />
          </View>
        </TouchableOpacity>

        {/* Smart message */}
        {smartMsg && (
          <SmartMessageCard
            msg={smartMsg}
            onPress={smartMsg.route ? () => router.push(smartMsg.route as any) : undefined}
          />
        )}

        <View style={{ height: 160 }} />
      </ScrollView>
    </View>
  );
}

// ─── Child Card styles ────────────────────────────────────────────────────────
const cc = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    marginBottom: 14,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.09,
    shadowRadius: 10,
  },
  accentBar: {
    height: 4,
    width: '100%',
  },

  // Avatar
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
  },
  avatarRing: {
    width: 62, height: 62,
    borderRadius: 31,
    borderWidth: 2.5,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
    position: 'relative',
  },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  genderDot: {
    position: 'absolute',
    bottom: 0, right: 0,
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },

  // Name meta
  nameMeta: { flex: 1, gap: 3 },
  childName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  dob: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  genderPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 20,
    marginTop: 2,
  },
  genderPillText: { fontSize: 10, fontWeight: '700' },

  editBtn: {
    flexShrink: 0,
    opacity: 0.75,
  },

  // Switcher
  switcherScroll: { paddingHorizontal: 16, marginBottom: 12 },
  switcherContent: { gap: 6, paddingRight: 4 },
  switchPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  switchDot: {
    width: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  switchText: { fontSize: 11, fontWeight: '700', color: '#475569' },
  switchTextActive: { color: '#fff' },

});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0F4F8' },

  // Header
  fixedHeader: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingBottom: 14,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    zIndex: 10,
  },
  headerOrb1: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.07)', top: -70, right: -50 },
  headerOrb2: { position: 'absolute', width: 100, height: 100, borderRadius: 50,  backgroundColor: 'rgba(255,255,255,0.05)', bottom: -35, left: 40 },
  headerOrb3: { position: 'absolute', width: 60,  height: 60,  borderRadius: 30,  backgroundColor: 'rgba(255,255,255,0.04)', top: 10, left: -20 },

  headerRow:         { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 12 },
  greetingRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  greeting:          { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  newBadge:          { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  newBadgeText:      { fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  childNameRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  headerChildName:   { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  headerWelcomeName: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.5, marginBottom: 2 },
  headerTagline:     { fontSize: 11, color: 'rgba(255,255,255,0.65)', fontWeight: '500' },
  agePill:           { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  agePillText:       { fontSize: 11, fontWeight: '700', color: '#fff' },
  headerRight:       { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  alertPill:         { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 12, marginRight: 4 },
  alertPillText:     { fontSize: 10, fontWeight: '700', color: '#fff' },
  iconBtn:           { padding: 6 },

  headerStatsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  headerStat:       { flex: 1, alignItems: 'center', gap: 2 },
  headerStatAction: { flex: 1, alignItems: 'center', gap: 2 },
  headerStatVal:    { fontSize: 14, fontWeight: '800', color: '#fff' },
  headerStatLbl:    { fontSize: 10, color: 'rgba(255,255,255,0.65)', fontWeight: '500' },
  headerStatDiv:    { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.2)' },

  scroll:  { flex: 1 },
  content: { paddingTop: 16, paddingHorizontal: 16 },

  // Quick Actions
  section:       { marginBottom: 12 },
  sectionTitle:  { fontSize: 15, fontWeight: '800', color: '#1A202C', marginBottom: 10 },
  actionsGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionCard:    { width: '47.5%', borderRadius: 16, overflow: 'hidden', height: 84 },
  actionContent: { flex: 1, padding: 10, justifyContent: 'space-between' },
  actionTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  actionIconWrap:{ width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  actionEmoji:   { fontSize: 16 },
  actionLabel:   { fontSize: 13, fontWeight: '800', color: '#fff' },
  actionDesc:    { fontSize: 10, color: 'rgba(255,255,255,0.8)' },
  actionDecor:   { position: 'absolute', bottom: -14, right: -14, width: 50, height: 50, borderRadius: 25, borderWidth: 14, borderColor: 'rgba(255,255,255,0.1)' },

  // Zuri
  zuriCard:   { backgroundColor: COLORS.primaryLight, borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: COLORS.primary + '25', marginBottom: 0 },
  zuriLeft:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  zuriAvatar: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', backgroundColor: COLORS.primaryLight },
  zuriTitle:  { fontSize: 14, fontWeight: '800', color: '#1A202C' },
  zuriSub:    { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  zuriBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, borderWidth: 1, borderColor: COLORS.primary + '35' },
  zuriBtnText:{ fontSize: 13, fontWeight: '700', color: COLORS.primary },
});