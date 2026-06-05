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

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function toTitleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, (ch: string) => ch.toUpperCase());
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
// Smart message type + priority engine
// ─────────────────────────────────────────────────────────────────────────────

type MessageUrgency = 'urgent' | 'warning' | 'info' | 'tip';

interface SmartMessage {
  icon: string;
  iconColor: string;
  accentColor: string;   // border + icon bg base
  bgColor: string;
  heading: string;
  text: string;
  urgency: MessageUrgency;
  badge?: string;        // optional pill label e.g. "Missed" / "Due today"
  route?: string;
}

function getSmartMessage(
  ageMonths: number,
  latestGrowth: any,
  dueVaccines: any[],
  missedVaccines: any[],
): SmartMessage {

  // 1. SAM / severe acute malnutrition
  if (latestGrowth?.whz != null && latestGrowth.whz < -3) {
    return {
      icon: 'warning',
      iconColor: '#fff',
      accentColor: '#C0392B',
      bgColor: '#C0392B',
      heading: 'Urgent: Severe acute malnutrition',
      text: "Weight-for-height is critically low (SAM). Visit the nearest MCH clinic or hospital TODAY — your child qualifies for Ready-to-Use Therapeutic Food (RUTF). Do not delay.",
      urgency: 'urgent',
      badge: 'SAM',
      route: '/(tabs)/growth',
    };
  }

  // 2. MAM / moderate acute malnutrition
  if (latestGrowth?.whz != null && latestGrowth.whz < -2) {
    return {
      icon: 'alert-circle',
      iconColor: '#fff',
      accentColor: '#E67E22',
      bgColor: '#E67E22',
      heading: 'Action needed: Moderate malnutrition',
      text: "Weight-for-height indicates moderate acute malnutrition (MAM). Enrol at the MCH clinic's Supplementary Feeding Programme and increase meal frequency immediately.",
      urgency: 'urgent',
      badge: 'MAM',
      route: '/(tabs)/growth',
    };
  }

  // 3. Severely underweight (WAZ)
  if (latestGrowth?.waz != null && latestGrowth.waz < -3) {
    return {
      icon: 'trending-down',
      iconColor: '#fff',
      accentColor: '#D35400',
      bgColor: '#D35400',
      heading: 'Weight alert: Severely underweight',
      text: "Weight-for-age is critically low. Offer 4 energy-dense meals daily — eggs, groundnut paste, mashed liver, beans with oil. Visit the MCH clinic urgently.",
      urgency: 'urgent',
      badge: 'Urgent',
      route: '/(tabs)/growth',
    };
  }

  // 4. Missed vaccine
  if (missedVaccines.length > 0) {
  const names = missedVaccines.map(v =>
    `${v.schedule.vaccine_name}${v.schedule.dose_number > 0 ? ` Dose ${v.schedule.dose_number}` : ''}`
  ).join(', ');
  const count = missedVaccines.length;
  return {
    icon: 'medical',
    iconColor: '#fff',
    accentColor: '#C0392B',
    bgColor: '#C0392B',
    heading: count > 1 ? `${count} missed vaccines` : 'Missed vaccine',
    text: `${names} ${count > 1 ? 'were' : 'was'} missed. Visit your nearest MCH clinic as soon as possible to catch up — delayed vaccines leave your child unprotected.`,
    urgency: 'urgent',
    badge: count > 1 ? `${count} Missed` : 'Missed',
    route: '/(tabs)/vaccines',
  };
}

  // 5. Vaccine due within 7 days
  const soonDue = dueVaccines.find(v => v.daysUntilDue != null && v.daysUntilDue <= 7);
  if (soonDue) {
    const name = `${soonDue.schedule.vaccine_name}${soonDue.schedule.dose_number > 0 ? ` Dose ${soonDue.schedule.dose_number}` : ''}`;
    const days = soonDue.daysUntilDue;
    const dueLabel = days === 0 ? 'Due today' : days === 1 ? 'Due tomorrow' : `Due in ${days}d`;
    return {
      icon: 'calendar',
      iconColor: '#fff',
      accentColor: '#0F6E56',
      bgColor: '#0F6E56',
      heading: 'Vaccine due soon',
      text: `${name} is due ${days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`}. Book your MCH clinic visit now to keep immunisations on schedule.`,
      urgency: 'warning',
      badge: dueLabel,
      route: '/(tabs)/vaccines',
    };
  }

  // 6. Any due vaccine
  if (dueVaccines.length > 0) {
    const v = dueVaccines[0];
    const name = `${v.schedule.vaccine_name}${v.schedule.dose_number > 0 ? ` Dose ${v.schedule.dose_number}` : ''}`;
    return {
      icon: 'medical-outline',
      iconColor: '#fff',
      accentColor: '#1D9E75',
      bgColor: '#1D9E75',
      heading: 'Vaccination reminder',
      text: `${name} is due. Visit your MCH clinic to keep your child protected. Always bring the immunisation card.`,
      urgency: 'warning',
      badge: 'Due',
      route: '/(tabs)/vaccines',
    };
  }

  // 7. Complementary feeding transitions
  const CF_TRANSITIONS = [
    { age: 6,  heading: 'Time to start solid foods',       text: 'Your baby is 6 months — start complementary foods alongside breastfeeding. Begin with thick smooth porridge, mashed vegetables or fruits. Continue breastfeeding on demand.' },
    { age: 8,  heading: 'Expand food texture and variety', text: 'At 8 months offer mashed and finely chopped family foods 3 times daily. Introduce eggs, mashed liver, and beans for iron and protein.' },
    { age: 12, heading: 'Transition to family foods',      text: 'Your child is 1 year old. Offer chopped family foods 3–4 times daily. Continue breastfeeding — it still provides up to 50% of energy. Avoid salt, sugar, and processed snacks.' },
    { age: 24, heading: 'Toddler diet transition',         text: 'Your child is 2 years old. Offer family foods 3 times daily with 2 healthy snacks. Ensure variety across all food groups: grains, proteins, vegetables, fruits, and dairy.' },
  ];
  const transition = CF_TRANSITIONS.find(t => ageMonths >= t.age && ageMonths < t.age + 2);
  if (transition) {
    return {
      icon: 'nutrition-outline',
      iconColor: '#fff',
      accentColor: '#E67E22',
      bgColor: '#E67E22',
      heading: transition.heading,
      text: transition.text,
      urgency: 'info',
      badge: 'Feeding milestone',
      route: '/(tabs)/nutrition',
    };
  }

  // 8. Vitamin A due
  if (ageMonths >= 6 && ageMonths <= 60 && ageMonths % 6 === 0) {
    return {
      icon: 'sunny-outline',
      iconColor: '#fff',
      accentColor: '#1D9E75',
      bgColor: '#1D9E75',
      heading: 'Vitamin A supplement due',
      text: `At ${ageMonths} months your child is due for their Vitamin A supplement — given free at all Kenya MCH clinics. It protects against blindness and serious infections.`,
      urgency: 'info',
      badge: 'Free at MCH',
      route: '/(tabs)/vaccines',
    };
  }

  // 9. Deworming due
  if (ageMonths >= 12 && ageMonths % 6 === 0) {
    return {
      icon: 'shield-checkmark-outline',
      iconColor: '#fff',
      accentColor: '#2471A3',
      bgColor: '#2471A3',
      heading: 'Deworming due',
      text: `Your child is due for deworming at ${ageMonths} months. Mebendazole is given free at MCH clinics — worms cause anaemia and stunted growth.`,
      urgency: 'info',
      badge: 'Free at MCH',
    };
  }

  // 10. Growth overdue or missing
  if (latestGrowth) {
    const daysSince = Math.floor((Date.now() - new Date(latestGrowth.date).getTime()) / 86400000);
    if (daysSince > 30) {
      return {
        icon: 'bar-chart-outline',
        iconColor: '#fff',
        accentColor: '#534AB7',
        bgColor: '#534AB7',
        heading: 'Time to weigh your child',
        text: `Last weight recorded ${daysSince} days ago. Monthly growth monitoring at your MCH clinic helps catch problems early.`,
        urgency: 'warning',
        badge: `${daysSince}d ago`,
        route: '/(tabs)/growth',
      };
    }
  } else {
    return {
      icon: 'analytics-outline',
      iconColor: '#fff',
      accentColor: '#534AB7',
      bgColor: '#534AB7',
      heading: "Record your child's first weight",
      text: 'No growth records yet. Add weight and height to start tracking against WHO standards and catch concerns early.',
      urgency: 'warning',
      badge: 'Not recorded',
      route: '/(tabs)/growth',
    };
  }

  // 11. Stunting
  if (latestGrowth?.haz != null && latestGrowth.haz < -2) {
    return {
      icon: 'trending-down-outline',
      iconColor: '#fff',
      accentColor: '#D35400',
      bgColor: '#D35400',
      heading: latestGrowth.haz < -3 ? 'Severe stunting detected' : 'Stunting — monitor closely',
      text: "Height-for-age is below normal, indicating chronic undernutrition. Improve dietary diversity, ensure all 7 food groups daily, and visit the MCH clinic for a nutritional assessment.",
      urgency: 'warning',
      badge: latestGrowth.haz < -3 ? 'Severe' : 'Monitor',
      route: '/(tabs)/growth',
    };
  }

  // 12. Overweight / obese
  if (latestGrowth?.whz != null && latestGrowth.whz > 2) {
    return {
      icon: 'fitness-outline',
      iconColor: '#fff',
      accentColor: '#2471A3',
      bgColor: '#2471A3',
      heading: latestGrowth.whz > 3 ? 'Weight concern: Obese' : 'Weight concern: Overweight',
      text: 'Review feeding practices with an MCH nurse. Avoid high-sugar foods, sweetened drinks, and excessive snacking. Monitor weight monthly.',
      urgency: 'warning',
      badge: 'Monitor',
      route: '/(tabs)/growth',
    };
  }

  // 13. Age-appropriate feeding default
  const FEEDING_DEFAULTS = [
    { minAge: 0,  maxAge: 6,  heading: 'Exclusive breastfeeding',        text: 'Your baby under 6 months needs breast milk only — no water, no porridge, no formula. Breastfeed on demand at least 8–12 times per day including at night.' },
    { minAge: 6,  maxAge: 9,  heading: 'Feeding tip for 6–8 months',     text: 'Offer 2–3 meals of thick smooth porridge daily alongside breastfeeding. Add mashed orange vegetables, eggs, and a few drops of oil for extra energy.' },
    { minAge: 9,  maxAge: 12, heading: 'Feeding tip for 9–11 months',    text: 'Offer 3–4 mashed or finely chopped meals daily. Include iron-rich foods: mashed liver once a week, eggs, beans, and omena. Continue breastfeeding.' },
    { minAge: 12, maxAge: 24, heading: 'Feeding tip for 12–23 months',   text: 'Offer 3 meals and 1–2 nutritious snacks daily from family foods. Breast milk still provides up to 50% of energy — continue breastfeeding up to 2 years.' },
    { minAge: 24, maxAge: 60, heading: 'Feeding tip for toddlers',       text: 'Your toddler needs 3 meals and 2 healthy snacks daily with foods from all food groups. Limit sugar and processed foods. Ensure daily dark green leafy vegetables.' },
  ];
  const fm = FEEDING_DEFAULTS.find(f => ageMonths >= f.minAge && ageMonths < f.maxAge);
  if (fm) {
    return {
      icon: 'restaurant-outline',
      iconColor: '#fff',
      accentColor: '#E67E22',
      bgColor: '#E67E22',
      heading: fm.heading,
      text: fm.text,
      urgency: 'tip',
      badge: 'Nutrition tip',
      route: '/(tabs)/nutrition',
    };
  }

  return {
    icon: 'bulb-outline',
    iconColor: '#fff',
    accentColor: '#1D9E75',
    bgColor: '#1D9E75',
    heading: 'Health reminder',
    text: 'Visit your MCH clinic regularly for growth monitoring, vaccines, and nutritional support — free for all children under 5 in Kenya.',
    urgency: 'tip',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Premium Smart Message Card component
// ─────────────────────────────────────────────────────────────────────────────

function SmartMessageCard({
  msg,
  onPress,
}: {
  msg: SmartMessage;
  onPress?: () => void;
}) {
  const isUrgent  = msg.urgency === 'urgent';
  const isWarning = msg.urgency === 'warning';

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(12)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim  = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    // Slide + fade in on mount
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 8, useNativeDriver: true }),
    ]).start();

    // Pulse icon for urgent/warning
    if (isUrgent || isWarning) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,   duration: 800, useNativeDriver: true }),
        ])
      ).start();
    }

    // Glow / shimmer on the badge for urgent
    if (isUrgent) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1,   duration: 600, useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0.6, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [isUrgent, isWarning]);

  const inner = (
    <Animated.View
      style={[
        sc.card,
        { backgroundColor: msg.bgColor, opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      {/* Decorative circles */}
      <View style={[sc.decor1, { backgroundColor: 'rgba(255,255,255,0.08)' }]} />
      <View style={[sc.decor2, { backgroundColor: 'rgba(255,255,255,0.05)' }]} />

      {/* Top row: icon + badge */}
      <View style={sc.topRow}>
        <Animated.View style={[sc.iconWrap, { transform: [{ scale: pulseAnim }] }]}>
          <View style={[sc.iconCircle, { backgroundColor: 'rgba(255,255,255,0.22)' }]}>
            <Ionicons name={msg.icon as any} size={22} color={msg.iconColor} />
          </View>
        </Animated.View>

        {msg.badge && (
          <Animated.View style={[sc.badge, { opacity: isUrgent ? glowAnim : 1 }]}>
            <Text style={sc.badgeText}>{msg.badge}</Text>
          </Animated.View>
        )}
      </View>

      {/* Heading + body */}
      <Text style={sc.heading}>{msg.heading}</Text>
      <Text style={sc.body}>{msg.text}</Text>

      {/* Footer CTA */}
      {onPress && (
        <View style={sc.footer}>
          <Text style={sc.ctaText}>Tap to view details</Text>
          <View style={sc.ctaArrow}>
            <Ionicons name="arrow-forward" size={12} color={msg.bgColor} />
          </View>
        </View>
      )}
    </Animated.View>
  );

  return onPress ? (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      style={sc.wrapper}
    >
      {inner}
    </TouchableOpacity>
  ) : (
    <View style={sc.wrapper}>{inner}</View>
  );
}

// Smart card styles
const sc = StyleSheet.create({
  wrapper: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  card: {
    borderRadius: 22,
    padding: 18,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  decor1: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    top: -40,
    right: -30,
  },
  decor2: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    bottom: -20,
    right: 60,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  iconWrap: {
    alignSelf: 'flex-start',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },
  heading: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  body: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.88)',
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.18)',
  },
  ctaText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    flex: 1,
  },
  ctaArrow: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

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

  // Refresh every time screen is focused so smart message always reflects latest data
  useFocusEffect(
    useCallback(() => {
      if (!activeChild?.id) return;
      fetchGrowthRecords(activeChild.id);
      (async () => {
        if (schedules.length === 0) await fetchSchedules();
        const imms = await fetchImmunizations(activeChild.id);
        computeRows(activeChild.date_of_birth, imms);
      })();
    }, [activeChild?.id]),
  );

  // Derived stats
  const latestGrowth    = growthRecords[0] ?? null;
  const vaccineGiven    = vaccineRows.filter(r => r.status === 'given').length;
  const vaccineTotal    = vaccineRows.length;
  const dueVaccines     = vaccineRows.filter(r => r.status === 'due');
  const missedVaccines  = vaccineRows.filter(r => r.status === 'missed');
  const alertVaccine    = dueVaccines[0] ?? missedVaccines[0] ?? null;
  const alertIsMissed   = !!missedVaccines[0] && !dueVaccines[0];

  const smartMsg = activeChild
    ? getSmartMessage(ageMonths, latestGrowth, dueVaccines, missedVaccines)
    : null;

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

        {/* Stats strip */}
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
              <Text style={styles.statValue}>{activeChild?.date_of_birth ? getAgeLabel(activeChild.date_of_birth) : "—"}</Text>
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
            {alertIsMissed
              ? `${missedVaccines.length > 1 ? `${missedVaccines.length} vaccines` : 'Vaccine'} missed — visit your MCH clinic`
              : 'Due soon — schedule a visit'}
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

      {/* ── Smart contextual message ──────────────────────────────────── */}
      {smartMsg && (
        <SmartMessageCard
          msg={smartMsg}
          onPress={smartMsg.route ? () => router.push(smartMsg.route as any) : undefined}
        />
      )}

      <View style={{ height: 32 }} />
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
});




