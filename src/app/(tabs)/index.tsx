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

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { session, signOut } = useAuthStore();
  const { children, selectedChildId, selectChild, growthRecords, fetchGrowthRecords } = useChildStore();
  const { vaccineRows, fetchSchedules, fetchImmunizations, computeRows, schedules } = useVaccineStore();
  const router = useRouter();

  const firstName   = session?.user?.user_metadata?.full_name?.split(' ')[0] ?? 'Mama';
  const activeChild = children.find(c => c.id === selectedChildId) ?? children[0];
  const ageMonths   = activeChild?.date_of_birth ? getAgeMonths(activeChild.date_of_birth) : 0;

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
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{getGreeting()}, {firstName} 👋</Text>
            {activeChild ? (
              <View style={styles.childNameRow}>
                <Text style={styles.childName}>{toTitleCase(activeChild.full_name)}</Text>
                <View style={styles.agePill}>
                  <Text style={styles.agePillText}>{getAgeLabel(activeChild.date_of_birth)}</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.childName}>No child selected</Text>
            )}
          </View>
          <View style={styles.headerRight}>
            {(dueVaccines.length > 0 || missedVaccines.length > 0) && (
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
      </View>

      {/* ── SCROLLABLE CONTENT ───────────────────────────────────────── */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── UNIFIED CHILD CARD ─────────────────────────────────────── */}
        {activeChild ? (
          <View style={styles.unifiedCard}>

            {/* Top section: white — avatar + name/dob + arrow */}
            <View style={styles.cardTopSection}>
              <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
                <Text style={styles.avatarText}>
                  {(activeChild.full_name?.[0] ?? '?').toUpperCase()}
                </Text>
                <View style={[styles.genderDot, { backgroundColor: genderColor }]}>
                  <Ionicons name={isFemale ? 'female' : 'male'} size={9} color="#fff" />
                </View>
              </View>

              <View style={styles.cardMeta}>
                <Text style={styles.cardChildName} numberOfLines={1}>
                  {toTitleCase(activeChild.full_name)}
                </Text>
                <Text style={styles.cardDob} numberOfLines={1}>
                  Born{' '}
                  {new Date(activeChild.date_of_birth).toLocaleDateString('en-KE', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </Text>
                <View style={[styles.genderTag, { backgroundColor: avatarBg }]}>
                  <Ionicons name={isFemale ? 'female' : 'male'} size={10} color={genderColor} />
                  <Text style={[styles.genderTagText, { color: genderColor }]}>
                    {isFemale ? 'Girl' : 'Boy'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.cardArrow}
                onPress={() => router.push('/(tabs)/children')}
              >
                <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
              </TouchableOpacity>
            </View>

            {/* Child switcher — only if multiple children */}
            {children.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.switcherScroll}
                contentContainerStyle={styles.switcherContent}
              >
                {children.map(c => {
                  const active  = c.id === activeChild.id;
                  const cFemale = c.sex === 'female';
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.switchPill, active && styles.switchPillActive]}
                      onPress={() => selectChild(c.id)}
                    >
                      <Ionicons name={cFemale ? 'female' : 'male'} size={10} color={active ? '#fff' : COLORS.primary} />
                      <Text style={[styles.switchText, active && styles.switchTextActive]}>
                        {c.full_name.split(' ')[0]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {/* ── Tinted stats panel (Option A) ── */}
            <View style={styles.statsPanel}>
              {/* Weight */}
              <View style={styles.statCol}>
                <View style={[styles.statIconCircle, { backgroundColor: '#D6ECFF' }]}>
                  <Ionicons name="barbell-outline" size={14} color="#208AEF" />
                </View>
                <Text style={styles.statVal}>
                  {latestGrowth ? `${latestGrowth.weight_kg} kg` : '—'}
                </Text>
                <Text style={styles.statLbl}>Weight</Text>
                <Text style={[styles.statSub, {
                  color: latestGrowth?.waz != null && latestGrowth.waz < -2 ? COLORS.missed : COLORS.given,
                }]}>
                  {latestGrowth?.waz != null ? (latestGrowth.waz >= -2 ? 'Normal' : 'Low') : 'No data'}
                </Text>
              </View>

              <View style={styles.statDivider} />

              {/* Vaccines */}
              <View style={styles.statCol}>
                <View style={[styles.statIconCircle, { backgroundColor: '#D6ECFF' }]}>
                  <Ionicons name="shield-checkmark-outline" size={14} color="#208AEF" />
                </View>
                <Text style={styles.statVal}>
                  {vaccineTotal > 0 ? `${vaccineGiven}/${vaccineTotal}` : '—'}
                </Text>
                <Text style={styles.statLbl}>Vaccines</Text>
                <Text style={[styles.statSub, {
                  color: missedVaccines.length > 0 ? COLORS.missed : dueVaccines.length > 0 ? COLORS.due : COLORS.given,
                }]}>
                  {missedVaccines.length > 0
                    ? `${missedVaccines.length} missed`
                    : dueVaccines.length > 0
                    ? `${dueVaccines.length} due`
                    : 'Up to date'}
                </Text>
              </View>

              <View style={styles.statDivider} />

              {/* Age */}
              <View style={styles.statCol}>
                <View style={[styles.statIconCircle, { backgroundColor: '#D6ECFF' }]}>
                  <Ionicons name="calendar-outline" size={14} color="#208AEF" />
                </View>
                <Text style={styles.statVal}>{getAgeLabel(activeChild.date_of_birth)}</Text>
                <Text style={styles.statLbl}>Age</Text>
                <Text style={[styles.statSub, { color: COLORS.textMuted }]}>
                  {ageMonths < 6 ? 'Infant' : ageMonths < 24 ? 'Baby' : 'Toddler'}
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.addChildCard} onPress={() => router.push('/(tabs)/children')}>
            <View style={styles.addIcon}><Ionicons name="add" size={24} color="#fff" /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.addTitle}>Add your first child</Text>
              <Text style={styles.addSub}>Track growth, vaccines and milestones</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
          </TouchableOpacity>
        )}

        {/* Quick Actions */}
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0F4F8' },

  // Header
  fixedHeader: {
    backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingBottom: 16,
    overflow: 'hidden', elevation: 8, shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12, zIndex: 10,
  },
  headerOrb1:    { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.07)', top: -50, right: -30 },
  headerOrb2:    { position: 'absolute', width: 90,  height: 90,  borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.05)', bottom: -30, left: 50 },
  headerRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  greeting:      { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '500', marginBottom: 3 },
  childNameRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  childName:     { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  agePill:       { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  agePillText:   { fontSize: 11, fontWeight: '700', color: '#fff' },
  headerRight:   { flexDirection: 'row', alignItems: 'center', gap: 2 },
  alertPill:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 12, marginRight: 4 },
  alertPillText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  iconBtn:       { padding: 6 },

  // Scroll
  scroll:   { flex: 1 },
  content:  { paddingTop: 16, paddingHorizontal: 16 },

  // ── Unified child card ──
  unifiedCard: {
    backgroundColor: '#fff', borderRadius: 20,
    marginBottom: 12, overflow: 'hidden',       // clip tinted panel to card corners
    elevation: 3, shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8,
  },

  // White top section
  cardTopSection: {
    flexDirection: 'row', alignItems: 'center',
    gap: 12, padding: 16, paddingBottom: 14,
  },
  avatar: {
    width: 54, height: 54, borderRadius: 27,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  avatarText: { fontSize: 22, fontWeight: '800', color: COLORS.primary },
  genderDot:  {
    position: 'absolute', bottom: 0, right: 0,
    width: 17, height: 17, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  cardMeta:      { flex: 1, gap: 3 },
  cardChildName: { fontSize: 16, fontWeight: '800', color: '#1A202C', letterSpacing: -0.3 },
  cardDob:       { fontSize: 12, color: COLORS.textMuted, fontWeight: '500' },
  genderTag:     {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 20, marginTop: 1,
  },
  genderTagText: { fontSize: 10, fontWeight: '700' },
  cardArrow: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },

  // Child switcher
  switcherScroll:   { paddingHorizontal: 16, marginBottom: 12 },
  switcherContent:  { gap: 6, paddingRight: 4 },
  switchPill:       { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: COLORS.primaryLight, borderWidth: 1, borderColor: COLORS.primary + '30' },
  switchPillActive: { backgroundColor: COLORS.primary },
  switchText:       { fontSize: 11, fontWeight: '600', color: COLORS.primary },
  switchTextActive: { color: '#fff' },

  // ── Tinted stats panel ──
  statsPanel: {
    flexDirection: 'row',
    backgroundColor: '#F0F7FF',               // the Option A tint
    borderTopWidth: 1,
    borderTopColor: '#DDEEFF',
    paddingVertical: 14,
  },
  statCol: { flex: 1, alignItems: 'center', gap: 4 },
  statDivider: { width: 1, backgroundColor: '#DDEEFF', marginVertical: 6 },
  statIconCircle: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', marginBottom: 2,
  },
  statVal: { fontSize: 14, fontWeight: '800', color: '#1A202C' },
  statLbl: { fontSize: 10, color: COLORS.textMuted, fontWeight: '500' },
  statSub: { fontSize: 9, fontWeight: '700' },

  // Add child placeholder
  addChildCard: { backgroundColor: '#fff', borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12, borderWidth: 1.5, borderColor: COLORS.border, borderStyle: 'dashed' },
  addIcon:      { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  addTitle:     { fontSize: 14, fontWeight: '700', color: '#1A202C' },
  addSub:       { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },

  // Quick Actions
  section:       { marginBottom: 12 },
  sectionTitle:  { fontSize: 15, fontWeight: '800', color: '#1A202C', marginBottom: 10 },
  actionsGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionCard:    { width: '47.5%', borderRadius: 16, overflow: 'hidden', height: 84 },
  actionContent: { flex: 1, padding: 10, justifyContent: 'space-between' },
  actionTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  actionIconWrap: { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  actionEmoji:   { fontSize: 16 },
  actionLabel:   { fontSize: 13, fontWeight: '800', color: '#fff' },
  actionDesc:    { fontSize: 10, color: 'rgba(255,255,255,0.8)' },
  actionDecor:   { position: 'absolute', bottom: -14, right: -14, width: 50, height: 50, borderRadius: 25, borderWidth: 14, borderColor: 'rgba(255,255,255,0.1)' },

  // Zuri
  zuriCard:    { backgroundColor: COLORS.primaryLight, borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: COLORS.primary + '25', marginBottom: 0 },
  zuriLeft:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  zuriAvatar:  { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', backgroundColor: COLORS.primaryLight },
  zuriTitle:   { fontSize: 14, fontWeight: '800', color: '#1A202C' },
  zuriSub:     { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  zuriBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, borderWidth: 1, borderColor: COLORS.primary + '35' },
  zuriBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
});