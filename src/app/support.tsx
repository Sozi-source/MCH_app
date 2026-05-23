/**
 * src/app/support.tsx
 * ZuriHealth — Help & Support Screen
 */
import { COLORS, RADIUS } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const FAQS = [
  {
    q: 'How do I add a child?',
    a: 'Go to the Children tab and tap the + button in the top right corner. Fill in your child\'s name, date of birth, sex, and optional birth details. Tap Save to add them.',
  },
  {
    q: 'How are growth z-scores calculated?',
    a: 'ZuriHealth uses WHO Child Growth Standards (2006) to calculate Weight-for-Age (WAZ), Height-for-Age (HAZ), and Weight-for-Height (WHZ) z-scores. These are the same standards used by Kenya\'s Ministry of Health.',
  },
  {
    q: 'What does SAM/MAM mean?',
    a: 'SAM (Severe Acute Malnutrition) is indicated by a WHZ below -3. MAM (Moderate Acute Malnutrition) is WHZ between -3 and -2. Both require prompt medical attention — visit your nearest health facility.',
  },
  {
    q: 'How do I record a vaccine?',
    a: 'Go to the Vaccines tab, find the vaccine in the KEPI schedule, and tap "Mark as Given". You can record the date and facility. Missed vaccines can also be recorded for tracking purposes.',
  },
  {
    q: 'Can I share access with my partner?',
    a: 'Yes. Go to the Children tab, tap on your child\'s profile, and scroll to "Co-Parent Access". Enter your partner\'s email address — they must already have a ZuriHealth account.',
  },
  {
    q: 'How do I export a health report?',
    a: 'Go to Settings → Health Reports. The report includes growth history, vaccine coverage, and z-score summaries. Tap the PDF button to generate and share it.',
  },
  {
    q: 'Is my data stored securely?',
    a: 'Yes. All data is encrypted in transit and at rest. We use Supabase infrastructure with AES-256 encryption. See our Privacy Policy for full details.',
  },
  {
    q: 'Why does the app need to know my child\'s date of birth?',
    a: 'The date of birth is essential for calculating age-appropriate z-scores, determining the correct KEPI vaccine schedule, and tracking developmental milestones for the right age group.',
  },
  {
    q: 'Can I use ZuriHealth offline?',
    a: 'The app requires an internet connection to sync data with our servers. Some previously loaded data may be viewable offline, but adding records or chatting with Zuri requires connectivity.',
  },
  {
    q: 'What is Zuri AI?',
    a: 'Zuri is ZuriHealth\'s AI health assistant powered by Anthropic\'s Claude. She can answer questions about your child\'s growth, nutrition, vaccines, and general maternal health — always grounded in WHO and Kenya MoH guidelines.',
  },
];

const CONTACT_OPTIONS = [
  {
    icon: 'mail-outline' as const,
    iconBg: '#E6F1FB',
    iconColor: '#185FA5',
    title: 'Email Support',
    sub: 'support@zurihealth.co.ke',
    onPress: () => Linking.openURL('mailto:support@zurihealth.co.ke'),
  },
  {
    icon: 'logo-whatsapp' as const,
    iconBg: '#E1F5EE',
    iconColor: '#25D366',
    title: 'WhatsApp',
    sub: '+254 711390861',
    onPress: () => Linking.openURL('https://wa.me/254711390861'),
  },
  {
    icon: 'globe-outline' as const,
    iconBg: '#F3E5F5',
    iconColor: '#9C27B0',
    title: 'Help Centre',
    sub: 'help.zurihealth.co.ke',
    onPress: () => Linking.openURL('https://help.zurihealth.co.ke'),
  },
];

export default function SupportScreen() {
  const router = useRouter();
  const [expanded, setExpanded] = useState<number | null>(null);

  const handleFeedback = () => {
    if (Platform.OS === 'web') {
      window.alert('Thank you! Please email us at feedback@zurihealth.co.ke');
    } else {
      Alert.alert(
        'Send Feedback',
        'We\'d love to hear from you! Email us at feedback@zurihealth.co.ke',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Email', onPress: () => Linking.openURL('mailto:feedback@zurihealth.co.ke?subject=ZuriHealth Feedback') },
        ]
      );
    }
  };

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.hero}>
        <View style={s.heroDecor} />
        <TouchableOpacity style={s.backBtn} onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace('/(tabs)/settings' as any); } }}>
          <Ionicons name="arrow-back" size={20} color={COLORS.onPrimary} />
        </TouchableOpacity>
        <View style={s.heroContent}>
          <View style={s.heroIconCircle}>
            <Ionicons name="help-buoy" size={24} color={COLORS.onPrimary} />
          </View>
          <Text style={s.heroTitle}>Help & Support</Text>
          <Text style={s.heroSub}>FAQs, contact us, and feedback</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Contact options */}
        <Text style={s.sectionLabel}>GET IN TOUCH</Text>
        <View style={s.card}>
          {CONTACT_OPTIONS.map((opt, i) => (
            <TouchableOpacity
              key={i}
              style={[s.contactRow, i < CONTACT_OPTIONS.length - 1 && s.contactRowBorder]}
              onPress={opt.onPress}
              activeOpacity={0.7}
            >
              <View style={[s.contactIcon, { backgroundColor: opt.iconBg }]}>
                <Ionicons name={opt.icon} size={18} color={opt.iconColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.contactTitle}>{opt.title}</Text>
                <Text style={s.contactSub}>{opt.sub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        {/* FAQs */}
        <Text style={s.sectionLabel}>FREQUENTLY ASKED QUESTIONS</Text>
        {FAQS.map((faq, i) => {
          const isOpen = expanded === i;
          return (
            <View key={i} style={s.faqItem}>
              <TouchableOpacity
                style={s.faqHeader}
                onPress={() => setExpanded(isOpen ? null : i)}
                activeOpacity={0.75}
              >
                <View style={s.faqNumCircle}>
                  <Text style={s.faqNum}>{i + 1}</Text>
                </View>
                <Text style={s.faqQ}>{faq.q}</Text>
                <Ionicons
                  name={isOpen ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={COLORS.textMuted}
                />
              </TouchableOpacity>
              {isOpen && (
                <View style={s.faqBody}>
                  <Text style={s.faqA}>{faq.a}</Text>
                </View>
              )}
            </View>
          );
        })}

        {/* Feedback card */}
        <View style={s.feedbackCard}>
          <View style={s.feedbackDecor} />
          <Ionicons name="chatbubble-ellipses" size={28} color={COLORS.onPrimary} style={{ marginBottom: 10 }} />
          <Text style={s.feedbackTitle}>Have a suggestion?</Text>
          <Text style={s.feedbackSub}>
            Help us improve ZuriHealth for mothers across Kenya.
          </Text>
          <TouchableOpacity style={s.feedbackBtn} onPress={handleFeedback} activeOpacity={0.85}>
            <Ionicons name="send-outline" size={15} color={COLORS.primary} />
            <Text style={s.feedbackBtnText}>Send Feedback</Text>
          </TouchableOpacity>
        </View>

        {/* Version */}
        <Text style={s.version}>ZuriHealth v1.0.0 · Built for Kenya 🇰🇪</Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  hero: {
    backgroundColor: COLORS.primary,
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  heroDecor: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    borderWidth: 40, borderColor: 'rgba(255,255,255,0.07)',
    bottom: -60, right: -40,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  heroContent: { alignItems: 'center' },
  heroIconCircle: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  heroTitle: { fontSize: 24, fontWeight: '800', color: COLORS.onPrimary, marginBottom: 4 },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)', textAlign: 'center' },

  scroll: { padding: 16 },

  sectionLabel: {
    fontSize: 11, fontWeight: '800', color: COLORS.textMuted,
    letterSpacing: 1.2, marginTop: 20, marginBottom: 10,
  },

  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 16, paddingVertical: 4,
    borderWidth: 1, borderColor: COLORS.border,
    marginBottom: 4,
  },
  contactRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14,
  },
  contactRowBorder: {
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  contactIcon: {
    width: 38, height: 38, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  contactTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  contactSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },

  faqItem: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    marginBottom: 8,
    borderWidth: 1, borderColor: COLORS.border,
    overflow: 'hidden',
  },
  faqHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14,
  },
  faqNumCircle: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  faqNum: { fontSize: 11, fontWeight: '800', color: COLORS.primary },
  faqQ: { flex: 1, fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  faqBody: {
    paddingHorizontal: 14, paddingBottom: 14, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  faqA: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 21 },

  feedbackCard: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.xl,
    padding: 20, marginTop: 8,
    alignItems: 'center',
    overflow: 'hidden',
  },
  feedbackDecor: {
    position: 'absolute', width: 150, height: 150, borderRadius: 75,
    borderWidth: 30, borderColor: 'rgba(255,255,255,0.08)',
    bottom: -40, right: -30,
  },
  feedbackTitle: { fontSize: 18, fontWeight: '800', color: COLORS.onPrimary, marginBottom: 6 },
  feedbackSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)', textAlign: 'center', marginBottom: 16, lineHeight: 19 },
  feedbackBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.full,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  feedbackBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.primary },

  version: {
    textAlign: 'center', fontSize: 12,
    color: COLORS.textMuted, marginTop: 20,
  },
});