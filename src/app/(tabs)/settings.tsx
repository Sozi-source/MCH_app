// src/app/(tabs)/settings.tsx
// mamaTOTO — Settings Screen (Full Visual Redesign)
// Strictly follows all 12 mamaTOTO design rules

import { useT } from '@/hooks/useT';
import { Language } from '@/lib/i18n';
import { COLORS, RADIUS } from '@/lib/theme';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import type { NotificationPrefs } from '@/store/settingsStore';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';

// ─────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────

function SectionLabel({ label, emoji }: { label: string; emoji: string }) {
  return (
    <View style={s.sectionLabelRow}>
      <Text style={s.sectionEmoji}>{emoji}</Text>
      <Text style={s.sectionLabel}>{label}</Text>
    </View>
  );
}

function SettingsRow({
  icon,
  iconBg,
  iconColor,
  title,
  sub,
  onPress,
  right,
  isLast,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconBg: string;
  iconColor: string;
  title: string;
  sub?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  isLast?: boolean;
}) {
  const Inner = (
    <View style={[sr.row, !isLast && sr.rowBorder]}>
      {/* Rule #4 — icon always in colored circle */}
      <View style={[sr.iconCircle, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={sr.title}>{title}</Text>
        {sub ? <Text style={sr.sub}>{sub}</Text> : null}
      </View>
      {right ?? null}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {Inner}
      </TouchableOpacity>
    );
  }
  return Inner;
}

function NotifRow({
  icon,
  iconBg,
  iconColor,
  title,
  sub,
  value,
  onToggle,
  isLast,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconBg: string;
  iconColor: string;
  title: string;
  sub: string;
  value: boolean;
  onToggle: (v: boolean) => void;
  isLast?: boolean;
}) {
  return (
    <SettingsRow
      icon={icon}
      iconBg={iconBg}
      iconColor={iconColor}
      title={title}
      sub={sub}
      isLast={isLast}
      right={
        <Switch
          value={value}
          onValueChange={onToggle}
          trackColor={{ false: COLORS.border, true: COLORS.primary }}
          thumbColor={
            Platform.OS === 'android'
              ? value ? COLORS.white : COLORS.textMuted
              : undefined
          }
        />
      }
    />
  );
}

// ─────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const t = useT();
  const { user, signOut } = useAuthStore();
  const router = useRouter();
  const { language, setLanguage, notifPrefs, setNotifPref } = useSettingsStore();

  const [signingOut, setSigningOut] = useState(false);

  const handleLanguage = (lang: Language) => setLanguage(lang, user?.id);
  const handleNotifToggle = (key: keyof NotificationPrefs, value: boolean) =>
    setNotifPref(key, value, user?.id);

  const initials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? '?';

  const fullName = user?.user_metadata?.full_name ?? 'My Account';

  const handleSignOut = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Sign out of mamaTOTO?')) signOut?.();
    } else {
      Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            setSigningOut(true);
            await signOut?.();
            setSigningOut(false);
          },
        },
      ]);
    }
  };

  return (
    <View style={s.container}>
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          RULE #1 — Hero header: deep primary blue,
          rounded bottom, white text, paddingTop 56
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <View style={s.hero}>
        {/* Rule #9 — decorative overlay circles */}
        <View style={s.heroDecor1} />
        <View style={s.heroDecor2} />
        <View style={s.heroDecor3} />

        {/* Screen label row */}
        <View style={s.heroLabelRow}>
          <View style={s.heroLabelIcon}>
            <Ionicons name="settings-outline" size={17} color={COLORS.onPrimary} />
          </View>
          <Text style={s.heroScreenLabel}>Settings</Text>
          <Text style={s.heroEmoji}>⚙️</Text>
        </View>

        {/* Avatar + user info */}
        <View style={s.heroProfile}>
          <View style={s.heroAvatar}>
            <Text style={s.heroAvatarText}>{initials}</Text>
            {/* Online dot */}
            <View style={s.heroAvatarDot} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.heroName}>{fullName}</Text>
            <Text style={s.heroEmail}>{user?.email}</Text>
          </View>
          {/* Edit profile chevron */}
          <TouchableOpacity
            style={s.heroEditBtn}
            onPress={() => router.push('/profile' as any)}
          >
            <Ionicons name="pencil" size={14} color={COLORS.onPrimary} />
          </TouchableOpacity>
        </View>

        {/* Quick stats strip */}
        <View style={s.heroStatsRow}>
          <View style={s.heroStat}>
            <Ionicons name="shield-checkmark-outline" size={14} color="rgba(255,255,255,0.8)" />
            <Text style={s.heroStatText}>Account verified</Text>
          </View>
          <View style={s.heroStatDivider} />
          <View style={s.heroStat}>
            <Ionicons name="leaf-outline" size={14} color="rgba(255,255,255,0.8)" />
            <Text style={s.heroStatText}>mamaTOTO v1.0</Text>
          </View>
          <View style={s.heroStatDivider} />
          <View style={s.heroStat}>
            <Ionicons name="earth-outline" size={14} color="rgba(255,255,255,0.8)" />
            <Text style={s.heroStatText}>{language === 'sw' ? 'Kiswahili' : 'English'}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            PREFERENCES — Language
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <SectionLabel label="PREFERENCES" emoji="🌍" />
        <View style={s.card}>
          {/* Row label */}
          <View style={s.cardInnerHeader}>
            <View style={[s.cardInnerIcon, { backgroundColor: '#E6F1FB' }]}>
              <Ionicons name="globe-outline" size={16} color="#185FA5" />
            </View>
            <Text style={s.cardInnerTitle}>{t('language') ?? 'Language'}</Text>
          </View>

          {/* Rule #11 — scrollable filter chips (language picker) */}
          <View style={s.langRow}>
            {(
              [
                { code: 'en', label: 'English', flag: '🇬🇧' },
                { code: 'sw', label: 'Kiswahili', flag: '🇰🇪' },
              ] as { code: Language; label: string; flag: string }[]
            ).map((lang) => {
              const active = language === lang.code;
              return (
                <TouchableOpacity
                  key={lang.code}
                  style={[s.langChip, active && s.langChipActive]}
                  onPress={() => handleLanguage(lang.code)}
                  activeOpacity={0.8}
                >
                  <Text style={s.langFlag}>{lang.flag}</Text>
                  <Text style={[s.langLabel, active && s.langLabelActive]}>
                    {lang.label}
                  </Text>
                  {active && (
                    <View style={s.langCheckCircle}>
                      <Ionicons name="checkmark" size={11} color={COLORS.onPrimary} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            NOTIFICATIONS
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <SectionLabel label="NOTIFICATIONS" emoji="🔔" />
        <View style={s.card}>
          <NotifRow
            icon="medkit-outline"
            iconBg="#E1F5EE"
            iconColor={COLORS.given}
            title="Vaccine Reminders"
            sub="3-day alerts before upcoming vaccines"
            value={notifPrefs.vaccineReminders}
            onToggle={(v) => handleNotifToggle('vaccineReminders', v)}
          />
          <NotifRow
            icon="stats-chart-outline"
            iconBg="#E6F1FB"
            iconColor="#185FA5"
            title="Growth Alerts"
            sub="Immediate alerts for z-score concerns"
            value={notifPrefs.growthAlerts}
            onToggle={(v) => handleNotifToggle('growthAlerts', v)}
          />
          <NotifRow
            icon="sunny-outline"
            iconBg="#FFF8E6"
            iconColor={COLORS.due}
            title="Daily Health Tips"
            sub="Morning tip at 8am every day"
            value={notifPrefs.dailyTips}
            onToggle={(v) => handleNotifToggle('dailyTips', v)}
            isLast
          />
        </View>

        {/* Rule #9 — tip card with borderLeft accent */}
        <View style={s.tipCard}>
          <View style={s.tipAccent} />
          <View style={{ flex: 1, paddingLeft: 12, paddingVertical: 12, paddingRight: 12 }}>
            <Text style={s.tipTitle}>💡 Why notifications matter</Text>
            <Text style={s.tipBody}>
              Timely vaccine reminders can prevent up to 2–3 million child deaths
              annually. Stay on schedule with mamaTOTO alerts.
            </Text>
          </View>
        </View>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            DATA
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <SectionLabel label="DATA & REPORTS" emoji="📊" />
        <View style={s.card}>
          <SettingsRow
            icon="bar-chart-outline"
            iconBg="#E1F5EE"
            iconColor={COLORS.given}
            title="Health Reports"
            sub="Growth, nutrition and vaccine summary"
            onPress={() => router.push('/reports' as any)}
            right={
              <View style={s.chevronCircle}>
                <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
              </View>
            }
          />
          <SettingsRow
            icon="download-outline"
            iconBg="#EEEDFB"
            iconColor={COLORS.upcoming}
            title="Export Data"
            sub="Download your child's health records"
            onPress={() => router.push('/export' as any)}
            isLast
            right={
              <View style={s.chevronCircle}>
                <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
              </View>
            }
          />
        </View>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            ABOUT
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <SectionLabel label="ABOUT" emoji="ℹ️" />

        {/* Rule #3 — action card with solid bg, decor circle, emoji */}
        <View style={s.aboutActionCard}>
          <View style={s.aboutDecorCircle} />
          <Text style={s.aboutActionEmoji}>🌿</Text>
          <View style={[s.aboutActionIcon, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <Ionicons name="heart" size={20} color={COLORS.onPrimary} />
          </View>
          <Text style={s.aboutActionTitle}>mamaTOTO</Text>
          <Text style={s.aboutActionSub}>
            Maternal & child health tracking{'\n'}powered by Zuri Health · v1.0.0
          </Text>
          <View style={s.aboutBadgeRow}>
            <View style={s.aboutBadge}>
              <Ionicons name="shield-checkmark" size={11} color="#0F6E56" />
              <Text style={s.aboutBadgeText}>WHO Standards</Text>
            </View>
            <View style={[s.aboutBadge, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
              <Ionicons name="flag" size={11} color={COLORS.onPrimary} />
              <Text style={[s.aboutBadgeText, { color: COLORS.onPrimary }]}>Kenya IMAM</Text>
            </View>
          </View>
        </View>

        <View style={s.card}>
          <SettingsRow
            icon="document-text-outline"
            iconBg={COLORS.primaryLight}
            iconColor={COLORS.primary}
            title="Privacy Policy"
            sub="How we protect your health data"
            onPress={() => router.push('/privacy' as any)}
            right={
              <View style={s.chevronCircle}>
                <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
              </View>
            }
          />
          <SettingsRow
            icon="help-circle-outline"
            iconBg="#FFF8E6"
            iconColor={COLORS.due}
            title="Help & Support"
            sub="FAQs, contact us, feedback"
            onPress={() => router.push('/support' as any)}
            isLast
            right={
              <View style={s.chevronCircle}>
                <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
              </View>
            }
          />
        </View>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            ACCOUNT
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <SectionLabel label="ACCOUNT" emoji="👤" />
        <View style={s.card}>
          <SettingsRow
            icon="person-outline"
            iconBg={COLORS.primaryLight}
            iconColor={COLORS.primary}
            title="Signed in as"
            sub={user?.email ?? '—'}
            isLast
          />
        </View>

        {/* Sign out button */}
        <TouchableOpacity
          style={s.signOutBtn}
          onPress={handleSignOut}
          activeOpacity={0.85}
          disabled={signingOut}
        >
          <View style={s.signOutIconCircle}>
            <Ionicons name="log-out-outline" size={18} color={COLORS.missed} />
          </View>
          <Text style={s.signOutText}>
            {signingOut ? 'Signing out…' : 'Sign Out'}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 140 }} />
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll:    { paddingHorizontal: 16, paddingTop: 16 },

  // ── Hero (Rule #1) ──
  hero: {
    backgroundColor: COLORS.primary,
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  heroDecor1: {
    position: 'absolute',
    width: 240, height: 240, borderRadius: 120,
    borderWidth: 48, borderColor: 'rgba(255,255,255,0.06)',
    bottom: -80, right: -60,
  },
  heroDecor2: {
    position: 'absolute',
    width: 120, height: 120, borderRadius: 60,
    borderWidth: 26, borderColor: 'rgba(255,255,255,0.05)',
    top: 10, left: -30,
  },
  heroDecor3: {
    position: 'absolute',
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.04)',
    top: 60, right: 40,
  },

  heroLabelRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20,
  },
  heroLabelIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroScreenLabel: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.85)', flex: 1 },
  heroEmoji: { fontSize: 18 },

  heroProfile: {
    flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18,
  },
  heroAvatar: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.4)',
  },
  heroAvatarText: { fontSize: 24, fontWeight: '800', color: COLORS.onPrimary },
  heroAvatarDot: {
    position: 'absolute', bottom: 2, right: 2,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: COLORS.given,
    borderWidth: 2, borderColor: COLORS.primary,
  },
  heroName:  { fontSize: 20, fontWeight: '800', color: COLORS.onPrimary },
  heroEmail: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 3, fontWeight: '500' },
  heroEditBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },

  heroStatsRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: RADIUS.lg,
    paddingVertical: 10, paddingHorizontal: 14,
  },
  heroStat: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5, justifyContent: 'center' },
  heroStatText: { fontSize: 11, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  heroStatDivider: { width: 1, height: 18, backgroundColor: 'rgba(255,255,255,0.2)' },

  // ── Section labels (Rule #7) ──
  sectionLabelRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 22, marginBottom: 8,
  },
  sectionEmoji: { fontSize: 14 },
  sectionLabel: {
    fontSize: 11, fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 1.2,
  },

  // ── Cards (Rule #2) ──
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8,
    elevation: 3,
  },

  cardInnerHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    marginBottom: 4,
  },
  cardInnerIcon: {
    width: 30, height: 30, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  cardInnerTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },

  // ── Language chips (Rule #11 filter chips) ──
  langRow: {
    flexDirection: 'row', gap: 10,
    paddingVertical: 10,
  },
  langChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7,
    paddingVertical: 12, paddingHorizontal: 14,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.background,
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  langChipActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  langFlag:  { fontSize: 18 },
  langLabel: { fontSize: 14, fontWeight: '700', color: COLORS.textSecondary },
  langLabelActive: { color: COLORS.primary },
  langCheckCircle: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Tip card (Rule #9 — borderLeft accent) ──
  tipCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    marginTop: 10, marginBottom: 2,
    overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6,
    elevation: 2,
  },
  tipAccent: { width: 4, backgroundColor: COLORS.primary },
  tipTitle:  { fontSize: 13, fontWeight: '800', color: COLORS.primary, marginBottom: 5 },
  tipBody:   { fontSize: 12, color: COLORS.textSecondary, lineHeight: 18 },

  // ── About action card (Rule #3) ──
  aboutActionCard: {
    backgroundColor: COLORS.given,
    borderRadius: RADIUS.xl,
    padding: 20, marginBottom: 10,
    overflow: 'hidden',
    shadowColor: COLORS.given,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 10,
    elevation: 5,
  },
  aboutDecorCircle: {
    position: 'absolute', right: -30, bottom: -30,
    width: 120, height: 120, borderRadius: 60,
    borderWidth: 28, borderColor: 'rgba(255,255,255,0.12)',
  },
  aboutActionEmoji: {
    position: 'absolute', top: 14, right: 18, fontSize: 24,
  },
  aboutActionIcon: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  aboutActionTitle: { fontSize: 22, fontWeight: '800', color: COLORS.onPrimary, marginBottom: 4 },
  aboutActionSub:   { fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 19, marginBottom: 14 },
  aboutBadgeRow: { flexDirection: 'row', gap: 8 },
  aboutBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#E1F5EE',
    borderRadius: RADIUS.full,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  aboutBadgeText: { fontSize: 11, fontWeight: '700', color: '#0F6E56' },

  // ── Chevron circle ──
  chevronCircle: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Sign out ──
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: 16, marginTop: 8,
    borderWidth: 1.5, borderColor: '#F5C2C0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6,
    elevation: 2,
  },
  signOutIconCircle: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#FDECEA',
    alignItems: 'center', justifyContent: 'center',
  },
  signOutText: { fontSize: 15, fontWeight: '700', color: COLORS.missed, flex: 1 },
});

// ─── Settings row styles ──────────────────────────────────────────

const sr = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14,
  },
  rowBorder: {
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  // Rule #4 — icon always in colored circle
  iconCircle: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  sub:   { fontSize: 12, color: COLORS.textMuted, marginTop: 2, fontWeight: '500' },
});