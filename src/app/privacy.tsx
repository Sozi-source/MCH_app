/**
 * src/app/privacy.tsx
 * ZuriHealth — Privacy Policy Screen
 */
import { COLORS, RADIUS } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const SECTIONS = [
  {
    icon: 'shield-checkmark-outline' as const,
    iconBg: '#E1F5EE',
    iconColor: '#0F6E56',
    title: 'Data We Collect',
    body: `ZuriHealth collects only the information necessary to provide maternal and child health tracking services:\n\n• Account information: name, email address\n• Child health data: growth measurements, vaccine records, developmental milestones\n• Usage data: app interactions to improve the service\n\nWe never collect location data, financial information, or device contacts.`,
  },
  {
    icon: 'lock-closed-outline' as const,
    iconBg: '#E6F1FB',
    iconColor: '#185FA5',
    title: 'How We Protect Your Data',
    body: `Your health data is protected with industry-standard security:\n\n• All data is encrypted in transit (TLS 1.3) and at rest (AES-256)\n• Stored on secure Supabase servers with row-level security\n• Access is restricted to your account only\n• We never sell or share your personal data with third parties\n• Regular security audits and vulnerability assessments`,
  },
  {
    icon: 'people-outline' as const,
    iconBg: '#FFF8E6',
    iconColor: '#B45309',
    title: 'Data Sharing',
    body: `ZuriHealth does not sell your data. We may share anonymised, aggregated data with:\n\n• Kenya Ministry of Health for public health reporting (no personal identifiers)\n• WHO for maternal and child health research (anonymised only)\n\nWe will never share identifiable health data without your explicit consent.`,
  },
  {
    icon: 'phone-portrait-outline' as const,
    iconBg: '#F3EFFC',
    iconColor: '#7B5EA7',
    title: 'Your Rights',
    body: `You have full control over your data:\n\n• Access: View all data we hold about you at any time\n• Correction: Update or correct any inaccurate information\n• Deletion: Request complete deletion of your account and all associated data\n• Export: Download a copy of your health data in CSV format\n• Opt-out: Disable analytics and non-essential data collection\n\nTo exercise any of these rights, contact us at privacy@zurihealth.com`,
  },
  {
    icon: 'time-outline' as const,
    iconBg: '#FEF3C7',
    iconColor: '#D97706',
    title: 'Data Retention',
    body: `We retain your data for as long as your account is active:\n\n• Active accounts: Data retained indefinitely to provide continuity of care\n• Deleted accounts: All personal data permanently deleted within 30 days\n• Anonymised health records may be retained for up to 7 years for public health research, with all identifiers removed\n\nYou can delete your account and all data at any time from Settings.`,
  },
  {
    icon: 'globe-outline' as const,
    iconBg: '#E1F5EE',
    iconColor: '#0F6E56',
    title: 'Cookies & Analytics',
    body: `ZuriHealth uses minimal analytics to improve the app:\n\n• No third-party advertising cookies\n• Anonymous usage analytics to understand feature adoption\n• Crash reporting to fix bugs quickly\n\nYou can opt out of analytics in Settings → Preferences. This will not affect core app functionality.`,
  },
  {
    icon: 'document-text-outline' as const,
    iconBg: '#E6F1FB',
    iconColor: '#185FA5',
    title: 'Policy Updates',
    body: `We may update this Privacy Policy from time to time. When we do:\n\n• We will notify you via email and in-app notification\n• The updated policy will be posted with a new effective date\n• Continued use of the app after notification constitutes acceptance\n\nWe encourage you to review this policy periodically. Last updated: January 2026.`,
  },
];

export default function PrivacyScreen() {
  const router = useRouter();
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const toggle = (i: number) =>
    setExpanded(prev => ({ ...prev, [i]: !prev[i] }));

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Privacy Policy</Text>
          <Text style={s.headerSub}>How ZuriHealth protects your data</Text>
        </View>
        <View style={s.headerIcon}>
          <Ionicons name="shield-checkmark" size={22} color="#FFFFFF" />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Intro card */}
        <View style={s.introCard}>
          <View style={s.introBadge}>
            <Ionicons name="shield-checkmark-outline" size={13} color="#0F6E56" />
            <Text style={s.introBadgeText}>GDPR & Kenya Data Protection Act Compliant</Text>
          </View>
          <Text style={s.introText}>
            Your health data belongs to you. ZuriHealth is built on the principle of
            minimal data collection, maximum security, and full transparency about how
            we use the information you trust us with.
          </Text>
          <Text style={s.introDate}>Effective: January 2026 · Version 1.0</Text>
        </View>

        {/* Sections */}
        {SECTIONS.map((sec, i) => {
          const isOpen = expanded[i] ?? false;
          return (
            <TouchableOpacity
              key={i}
              style={s.section}
              onPress={() => toggle(i)}
              activeOpacity={0.75}
            >
              <View style={s.sectionHeader}>
                <View style={[s.sectionIcon, { backgroundColor: sec.iconBg }]}>
                  <Ionicons name={sec.icon} size={18} color={sec.iconColor} />
                </View>
                <Text style={s.sectionTitle}>{sec.title}</Text>
                <Ionicons
                  name={isOpen ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={COLORS.textMuted}
                />
              </View>
              {isOpen && (
                <Text style={s.sectionBody}>{sec.body}</Text>
              )}
            </TouchableOpacity>
          );
        })}

        {/* Contact card */}
        <View style={s.contactCard}>
          <View style={s.contactHeader}>
            <View style={s.contactIconWrap}>
              <Ionicons name="mail-outline" size={20} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.contactTitle}>Privacy Questions?</Text>
              <Text style={s.contactBody}>
                Our Data Protection Officer is available to answer any questions
                about how we handle your health data.
              </Text>
              <Text style={s.contactEmail}>privacy@zurihealth.com</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  header: {
    backgroundColor: COLORS.primary,
    paddingTop: 56,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  headerSub:   { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  scroll: { padding: 16 },

  introCard: {
    backgroundColor: '#E1F5EE',
    borderRadius: RADIUS.xl,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#A7E3C8',
  },
  introBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  introBadgeText: { fontSize: 11, fontWeight: '700', color: '#0F6E56' },
  introText: {
    fontSize: 13,
    color: '#1A5C42',
    lineHeight: 20,
    marginBottom: 10,
  },
  introDate: {
    fontSize: 11,
    color: '#2A9D6E',
    fontStyle: 'italic',
    fontWeight: '600',
  },

  section: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  sectionBody: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 21,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },

  contactCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: 16,
    marginTop: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  contactHeader: { flexDirection: 'row', gap: 12 },
  contactIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  contactTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 6 },
  contactBody:  { fontSize: 13, color: COLORS.textSecondary, lineHeight: 20 },
  contactEmail: { color: COLORS.primary, fontWeight: '700', marginTop: 6, fontSize: 13 },
});