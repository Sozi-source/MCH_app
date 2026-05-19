import { Platform, Alert, View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { useChildStore } from '@/store/childStore';
import { COLORS, RADIUS } from '@/lib/theme';

const QUICK_ACTIONS = [
  { label: 'Growth',    icon: 'trending-up' as const, route: '/(tabs)/growth',    color: COLORS.card2, desc: 'Track weight & height' },
  { label: 'Vaccines',  icon: 'shield' as const,      route: '/(tabs)/vaccines',  color: COLORS.card1, desc: 'Immunisation schedule' },
  { label: 'Nutrition', icon: 'nutrition' as const,   route: '/(tabs)/nutrition', color: COLORS.card3, desc: 'Feeding guidance' },
  { label: 'AI Chat',   icon: 'chatbubble' as const,  route: '/(tabs)/chat',      color: COLORS.card4, desc: 'Ask Zuri anything' },
];

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

export default function HomeScreen() {
  const { session, signOut } = useAuthStore();
  const { children, selectedChildId, selectChild } = useChildStore();
  const router = useRouter();

  const firstName = session?.user?.user_metadata?.full_name?.split(' ')[0] ?? 'Mama';

  const handleSignOut = () => {
    if (Platform.OS === 'web') {
      if (!window.confirm('Sign out of your account?')) return;
      signOut().then(() => router.replace('/(auth)/login' as any));
    } else {
      Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: () => signOut().then(() => router.replace('/(auth)/login' as any)) },
      ]);
    }
  };

  const activeChild = children.find(c => c.id === selectedChildId) ?? children[0];

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, Platform.OS === 'web' && { paddingBottom: 80 }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {firstName}</Text>
          <Text style={styles.subtitle}>
            {children.length > 0
              ? `${children.length} child${children.length > 1 ? 'ren' : ''} registered`
              : 'Add your first child to begin'}
          </Text>
        </View>
        <View style={styles.headerIcons}>
          <TouchableOpacity onPress={() => router.push('/(tabs)/settings')} style={styles.headerIconBtn}>
            <Ionicons name="person-circle-outline" size={28} color={COLORS.onPrimary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSignOut} style={styles.headerIconBtn}>
            <Ionicons name="log-out-outline" size={26} color={COLORS.onPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {children.length === 0 ? (
        <TouchableOpacity style={styles.addChildBanner} onPress={() => router.push('/(tabs)/children')}>
          <View style={styles.addChildIconCircle}>
            <Ionicons name="add" size={22} color={COLORS.onPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.addChildTitle}>Add your first child</Text>
            <Text style={styles.addChildSub}>Start tracking growth, vaccines and nutrition</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
        </TouchableOpacity>
      ) : (
        <View style={styles.selectorSection}>
          <View style={styles.selectorHeader}>
            <Text style={styles.selectorLabel}>
              {children.length > 1 ? 'Select Child' : 'Active Child'}
            </Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/children')}>
              <Text style={styles.manageLink}>Manage</Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsRow}>
            {children.map(c => {
              const isActive = c.id === activeChild?.id;
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.childPill, isActive && styles.childPillActive]}
                  onPress={() => selectChild(c.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.pillAvatar, isActive && styles.pillAvatarActive]}>
                    <Ionicons name={c.sex === 'female' ? 'female' : 'male'} size={14} color={isActive ? COLORS.onPrimary : COLORS.primary} />
                  </View>
                  <View>
                    <Text style={[styles.pillName, isActive && styles.pillNameActive]}>{c.full_name.split(' ')[0]}</Text>
                    {c.date_of_birth ? <Text style={[styles.pillAge, isActive && styles.pillAgeActive]}>{getAgeLabel(c.date_of_birth)}</Text> : null}
                  </View>
                  {isActive && <Ionicons name="checkmark-circle" size={14} color={COLORS.onPrimary} />}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={styles.addPill} onPress={() => router.push('/(tabs)/children')}>
              <Ionicons name="add-circle-outline" size={18} color={COLORS.primary} />
              <Text style={styles.addPillText}>Add child</Text>
            </TouchableOpacity>
          </ScrollView>

          {activeChild && (
            <View style={styles.activeChildCard}>
              <View style={[styles.activeChildAvatar, activeChild.sex === 'female' ? styles.avatarFemale : styles.avatarMale]}>
                <Text style={styles.activeChildAvatarText}>{(activeChild.full_name?.[0] ?? '?').toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.activeChildName}>{activeChild.full_name}</Text>
                <Text style={styles.activeChildMeta}>
                  {activeChild.date_of_birth
                    ? `Born ${new Date(activeChild.date_of_birth).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })} · ${getAgeLabel(activeChild.date_of_birth)}`
                    : 'Date of birth not set'}
                </Text>
              </View>
              <View style={[styles.sexBadge, activeChild.sex === 'female' ? styles.sexBadgeFemale : styles.sexBadgeMale]}>
                <Ionicons name={activeChild.sex === 'female' ? 'female' : 'male'} size={12} color={activeChild.sex === 'female' ? '#C2185B' : '#1565C0'} />
              </View>
            </View>
          )}
        </View>
      )}

      <Text style={styles.sectionTitle}>Quick Access</Text>
      <View style={styles.actionsGrid}>
        {QUICK_ACTIONS.map(a => (
          <TouchableOpacity key={a.label} style={[styles.actionCard, { backgroundColor: a.color }]} onPress={() => router.push(a.route as any)} activeOpacity={0.75}>
            <View style={styles.actionIconCircle}>
              <Ionicons name={a.icon} size={24} color={COLORS.primary} />
            </View>
            <Text style={styles.actionLabel}>{a.label}</Text>
            <Text style={styles.actionDesc}>{a.desc}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.tipCard}>
        <Ionicons name="bulb" size={20} color={COLORS.primary} />
        <Text style={styles.tipText}>Keep your child's vaccine card handy and bring it to every clinic visit.</Text>
      </View>

      <View style={{ height: 120 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:             { flex: 1, backgroundColor: COLORS.background },
  headerIcons:           { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerIconBtn:         { padding: 6 },
  content:               { paddingBottom: 32 },
  header:                { backgroundColor: COLORS.primary, padding: 24, paddingTop: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  greeting:              { fontSize: 22, fontWeight: '700', color: COLORS.onPrimary },
  subtitle:              { fontSize: 13, color: COLORS.primaryMid, marginTop: 2 },
  addChildBanner:        { margin: 16, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderColor: COLORS.border },
  addChildIconCircle:    { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  addChildTitle:         { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  addChildSub:           { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  selectorSection:       { margin: 16, marginBottom: 8 },
  selectorHeader:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  selectorLabel:         { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  manageLink:            { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  pillsRow:              { flexDirection: 'row', gap: 8, paddingBottom: 4 },
  childPill:             { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 24, backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border },
  childPillActive:       { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pillAvatar:            { width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  pillAvatarActive:      { backgroundColor: 'rgba(255,255,255,0.25)' },
  pillName:              { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  pillNameActive:        { color: COLORS.onPrimary },
  pillAge:               { fontSize: 10, color: COLORS.textMuted, marginTop: 1 },
  pillAgeActive:         { color: 'rgba(255,255,255,0.8)' },
  addPill:               { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 24, backgroundColor: COLORS.primaryLight, borderWidth: 1.5, borderColor: COLORS.border },
  addPillText:           { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  activeChildCard:       { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 14, marginTop: 10, borderWidth: 1, borderColor: COLORS.border, elevation: 1 },
  activeChildAvatar:     { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarFemale:          { backgroundColor: '#FCE4EC' },
  avatarMale:            { backgroundColor: '#E3F2FD' },
  activeChildAvatarText: { fontSize: 18, fontWeight: '800', color: COLORS.primary },
  activeChildName:       { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  activeChildMeta:       { fontSize: 11, color: COLORS.textMuted, marginTop: 3, lineHeight: 16 },
  sexBadge:              { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  sexBadgeFemale:        { backgroundColor: '#FCE4EC' },
  sexBadgeMale:          { backgroundColor: '#E3F2FD' },
  sectionTitle:          { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginHorizontal: 16, marginTop: 16, marginBottom: 10 },
  actionsGrid:           { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 12 },
  actionCard:            { width: '47%', borderRadius: RADIUS.lg, padding: 16, alignItems: 'flex-start', gap: 6 },
  actionIconCircle:      { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  actionLabel:           { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  actionDesc:            { fontSize: 11, color: COLORS.textSecondary, lineHeight: 15 },
  tipCard:               { margin: 16, marginTop: 20, backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.lg, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderWidth: 1, borderColor: COLORS.border },
  tipText:               { flex: 1, fontSize: 13, color: COLORS.textSecondary, lineHeight: 20 },
});