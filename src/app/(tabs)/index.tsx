import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { useChildStore } from '@/store/childStore';
import { COLORS, RADIUS } from '@/lib/theme';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const QUICK_ACTIONS: { label: string; icon: IoniconsName; route: string; color: string }[] = [
  { label: 'Growth',    icon: 'trending-up', route: '/(tabs)/growth',    color: COLORS.card2 },
  { label: 'Vaccines',  icon: 'shield',      route: '/(tabs)/vaccines',  color: COLORS.card1 },
  { label: 'Nutrition', icon: 'nutrition',   route: '/(tabs)/nutrition', color: COLORS.card3 },
  { label: 'AI Chat',   icon: 'chatbubble',  route: '/(tabs)/chat',      color: COLORS.card4 },
];

export default function HomeScreen() {
  const { session } = useAuthStore();
  const { children, selectedChildId } = useChildStore();
  const router = useRouter();

  const firstName = session?.user?.user_metadata?.full_name?.split(' ')[0] ?? 'Mama';
  const child = children.find(c => c.id === selectedChildId) ?? children[0];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {firstName}</Text>
          <Text style={styles.subtitle}>
            {child ? `Tracking ${child.full_name}` : 'Add your first child to begin'}
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/(tabs)/settings')}>
          <Ionicons name="person-circle" size={40} color={COLORS.onPrimary} />
        </TouchableOpacity>
      </View>

      {child ? (
        <TouchableOpacity style={styles.childCard} onPress={() => router.push('/(tabs)/children')}>
          <View style={styles.childAvatar}>
            <Text style={styles.childAvatarText}>{(child.full_name?.[0] ?? '?').toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.childName}>{child.full_name}</Text>
            <Text style={styles.childAge}>
              {child.date_of_birth
                ? `Born ${new Date(child.date_of_birth).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })}`
                : 'Tap to add details'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.primaryStrong} />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.addChildBanner} onPress={() => router.push('/(tabs)/children')}>
          <Ionicons name="add-circle" size={24} color={COLORS.primary} />
          <Text style={styles.addChildText}>Add your child to get started</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.sectionTitle}>Quick Access</Text>
      <View style={styles.actionsGrid}>
        {QUICK_ACTIONS.map(a => (
          <TouchableOpacity
            key={a.label}
            style={[styles.actionCard, { backgroundColor: a.color }]}
            onPress={() => router.push(a.route as any)}
          >
            <Ionicons name={a.icon} size={28} color={COLORS.primary} />
            <Text style={styles.actionLabel}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.tipCard}>
        <Ionicons name="bulb" size={20} color={COLORS.primary} />
        <Text style={styles.tipText}>
          Keep your child's vaccine card handy and bring it to every clinic visit.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: COLORS.background },
  content:         { paddingBottom: 32 },
  header:          { backgroundColor: COLORS.primary, padding: 24, paddingTop: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  greeting:        { fontSize: 22, fontWeight: '700', color: COLORS.onPrimary },
  subtitle:        { fontSize: 13, color: COLORS.primaryMid, marginTop: 2 },
  childCard:       { margin: 16, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: COLORS.border, elevation: 2 },
  childAvatar:     { width: 48, height: 48, borderRadius: RADIUS.full, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  childAvatarText: { fontSize: 20, fontWeight: '700', color: COLORS.primary },
  childName:       { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary },
  childAge:        { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  addChildBanner:  { margin: 16, backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.lg, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: COLORS.border },
  addChildText:    { fontSize: 15, color: COLORS.primary, fontWeight: '500' },
  sectionTitle:    { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary, marginHorizontal: 16, marginTop: 8, marginBottom: 10 },
  actionsGrid:     { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 12 },
  actionCard:      { width: '47%', borderRadius: RADIUS.lg, padding: 18, alignItems: 'center', gap: 8 },
  actionLabel:     { fontSize: 13, fontWeight: '600', color: COLORS.onPrimaryLight },
  tipCard:         { margin: 16, backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.lg, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderWidth: 1, borderColor: COLORS.border },
  tipText:         { flex: 1, fontSize: 13, color: COLORS.onPrimaryLight, lineHeight: 20 },
});