import { useT } from '@/hooks/useT';
import { Language } from '@/lib/i18n';
import { COLORS, RADIUS } from '@/lib/theme';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function SettingsScreen() {
  const t = useT();
  const { user } = useAuthStore();
  const { language, setLanguage } = useSettingsStore();

  const handleLanguage = (lang: Language) => setLanguage(lang, user?.id);

  const initials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? '?';

  const fullName = user?.user_metadata?.full_name ?? 'My Account';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.headerName}>{fullName}</Text>
        <Text style={styles.headerEmail}>{user?.email}</Text>
      </View>

      <Text style={styles.sectionLabel}>PREFERENCES</Text>
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <View style={styles.cardIconCircle}>
            <Ionicons name="globe-outline" size={18} color={COLORS.primary} />
          </View>
          <Text style={styles.cardTitle}>{t('language') ?? 'Language'}</Text>
        </View>
        <View style={styles.langRow}>
          <TouchableOpacity
            style={[styles.langBtn, language === 'en' && styles.langBtnActive]}
            onPress={() => handleLanguage('en')}
          >
            <Text style={[styles.langLabel, language === 'en' && styles.langLabelActive]}>English</Text>
            {language === 'en' && <Ionicons name="checkmark-circle" size={16} color={COLORS.primary} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.langBtn, language === 'sw' && styles.langBtnActive]}
            onPress={() => handleLanguage('sw')}
          >
            <Text style={[styles.langLabel, language === 'sw' && styles.langLabelActive]}>Kiswahili</Text>
            {language === 'sw' && <Ionicons name="checkmark-circle" size={16} color={COLORS.primary} />}
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.sectionLabel}>ABOUT</Text>
      <View style={styles.card}>
        <View style={styles.infoRow}>
          <View style={styles.cardIconCircle}>
            <Ionicons name="information-circle-outline" size={18} color={COLORS.primary} />
          </View>
          <View>
            <Text style={styles.cardTitle}>Mother and Child</Text>
            <Text style={styles.cardSub}>Version 1.0.0 · Powered by Zuri Health</Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionLabel}>ACCOUNT</Text>
      <View style={styles.card}>
        <View style={styles.infoRow}>
          <View style={styles.cardIconCircle}>
            <Ionicons name="person-outline" size={18} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Signed in as</Text>
            <Text style={styles.cardSub}>{user?.email}</Text>
          </View>
        </View>
      </View>



      <View style={{ height: 120 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: COLORS.background },
  content:         { paddingBottom: 32 },
  header:          { backgroundColor: COLORS.primary, alignItems: 'center', paddingTop: 60, paddingBottom: 32, paddingHorizontal: 20 },
  avatarCircle:    { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText:      { fontSize: 28, fontWeight: '800', color: COLORS.onPrimary },
  headerName:      { fontSize: 20, fontWeight: '700', color: COLORS.onPrimary },
  headerEmail:     { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  sectionLabel:    { fontSize: 11, fontWeight: '700', color: COLORS.textMuted, marginHorizontal: 16, marginTop: 24, marginBottom: 8, letterSpacing: 1 },
  card:            { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, marginHorizontal: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border, gap: 14 },
  cardRow:         { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoRow:         { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIconCircle:  { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  cardTitle:       { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  cardSub:         { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  langRow:         { flexDirection: 'row', gap: 10 },
  langBtn:         { flex: 1, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.border, paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: COLORS.surface },
  langBtnActive:   { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  langLabel:       { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  langLabelActive: { color: COLORS.primary },

});