import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS } from '@/lib/theme';

export default function NutritionScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="nutrition" size={22} color={COLORS.onPrimary} />
        <Text style={styles.headerTitle}>Nutrition</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Coming Soon</Text>
          <Text style={styles.cardText}>Nutrition tracking and meal logging will be available in the next update.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.background },
  header:      { backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.onPrimary },
  scroll:      { padding: 16 },
  card:        { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 24, alignItems: 'center', gap: 12, borderWidth: 1, borderColor: COLORS.border },
  cardTitle:   { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  cardText:    { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 },
});
