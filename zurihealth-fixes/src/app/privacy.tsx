// src/app/privacy.tsx
// ZuriHealth Privacy Policy Screen
// Linked from Settings → Privacy Policy
// Also host this content at a public URL for the Play Store listing.

import { COLORS, RADIUS, FONTS } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Section {
  title: string;
  body: string;
}

const SECTIONS: Section[] = [
  {
    title: '1. Information we collect',
    body: 'ZuriHealth collects information you provide directly: your name, email address, and the health data of children you register — including date of birth, sex, weight, height, head circumference, vaccine records, developmental milestones, and feeding notes.\n\nWe also collect usage data such as app activity logs and AI chat transcripts to improve the service.',
  },
  {
    title: '2. How we use your information',
    body: 'We use your data to:\n• Provide personalised child health tracking and growth monitoring\n• Generate WHO-grounded AI guidance via the Zuri assistant\n• Send vaccine due-date reminders and health alerts\n• Improve app features and accuracy of health content\n\nWe do not sell your personal data to third parties.',
  },
  {
    title: '3. AI services and third-party providers',
    body: 'ZuriHealth uses the following third-party AI services to power health features:\n\n• Groq (LLaMA 3.3): processes child health data to generate meal suggestions and z-score calculations. Messages are sent to Groq\'s servers for processing.\n\nAll AI queries are routed through our secure backend. Your API credentials are never stored on your device.',
  },
  {
    title: '4. Data about children',
    body: 'ZuriHealth is designed for use by parents and community health workers (adults 18+). We collect health data about children on behalf of their parent or legal guardian.\n\nWe do not knowingly collect data directly from children. If you believe a child has registered without parental consent, please contact us immediately at privacy@zurihealth.co.ke.',
  },
  {
    title: '5. Data storage and security',
    body: 'All data is stored securely on Supabase (PostgreSQL) with Row Level Security enforced — users can only access their own records. Session tokens are stored in encrypted device storage (SecureStore on iOS and Android).\n\nWe use industry-standard TLS encryption for all data in transit.',
  },
  {
    title: '6. Data retention',
    body: 'Your account data is retained as long as your account is active. You may request deletion of your account and all associated health records by contacting privacy@zurihealth.co.ke. We will process deletion requests within 30 days.',
  },
  {
    title: '7. Your rights',
    body: 'You have the right to:\n• Access the personal data we hold about you\n• Correct inaccurate data\n• Request deletion of your data\n• Withdraw consent for data processing\n• Lodge a complaint with the relevant data protection authority\n\nTo exercise any of these rights, contact us at privacy@zurihealth.co.ke.',
  },
  {
    title: '8. Notifications',
    body: 'ZuriHealth sends push notifications for vaccine reminders, growth alerts, and health tips. You can disable these at any time in the Settings screen or in your device\'s system notification settings.',
  },
  {
    title: '9. Changes to this policy',
    body: 'We may update this privacy policy from time to time. We will notify you of significant changes via the app or by email. Continued use of the app after changes constitutes acceptance of the updated policy.',
  },
  {
    title: '10. Contact us',
    body: 'Zuri Health Technologies\nJuja, Kiambu County, Kenya\nEmail: privacy@zurihealth.co.ke\n\nFor general support: support@zurihealth.co.ke',
  },
];

export default function PrivacyScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();

  return (
    <View style={s.screen}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Intro */}
        <View style={s.introBanner}>
          <Ionicons name="shield-checkmark" size={28} color={COLORS.primary} />
          <View style={{ flex: 1 }}>
            <Text style={s.introTitle}>Your data is protected</Text>
            <Text style={s.introSub}>Last updated: June 2026 · Zuri Health Technologies</Text>
          </View>
        </View>

        <Text style={s.introBody}>
          ZuriHealth is committed to protecting the privacy of the families who use our platform.
          This policy explains what data we collect, how we use it, and your rights.
        </Text>

        {/* Disclaimer */}
        <View style={s.disclaimer}>
          <Ionicons name="information-circle-outline" size={16} color="#185FA5" />
          <Text style={s.disclaimerText}>
            Zuri is an AI assistant. The health guidance it provides is for informational purposes only and does not constitute medical advice. Always consult a qualified healthcare provider for clinical decisions.
          </Text>
        </View>

        {/* Sections */}
        {SECTIONS.map((sec) => (
          <View key={sec.title} style={s.section}>
            <Text style={s.sectionTitle}>{sec.title}</Text>
            <Text style={s.sectionBody}>{sec.body}</Text>
          </View>
        ))}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },

  header: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17, fontWeight: '700', color: '#fff',
  },

  scroll:   { flex: 1 },
  content:  { padding: 16 },

  introBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.xl, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: '#BAD9F7',
  },
  introTitle: {
    fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 2,
  },
  introSub: {
    fontSize: 11, color: COLORS.textMuted, fontWeight: '500',
  },
  introBody: {
    fontSize: 13, color: COLORS.textSecondary, lineHeight: 20,
    marginBottom: 14,
  },

  disclaimer: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#E6F1FB',
    borderRadius: RADIUS.lg, padding: 12, marginBottom: 20,
    borderLeftWidth: 3, borderLeftColor: '#185FA5',
  },
  disclaimerText: {
    flex: 1, fontSize: 12, color: '#0C447C', lineHeight: 18, fontWeight: '500',
  },

  section: {
    backgroundColor: '#fff',
    borderRadius: RADIUS.lg, padding: 16,
    marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: COLORS.textPrimary,
    marginBottom: 8,
  },
  sectionBody: {
    fontSize: 13, color: COLORS.textSecondary, lineHeight: 20,
  },
});
