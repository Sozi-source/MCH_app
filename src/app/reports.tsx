/**
 * ZuriHealth – Enhanced Health Report Screen
 * ─────────────────────────────────────────
 * • Fixed all UTF-8 encoding issues (±, —, ▲, ▼)
 * • Premium card-based UI with gradient accents
 * • PDF export via react-native-html-to-pdf
 * • Animated section reveals
 * • Interactive coverage ring
 *
 * Dependencies to install:
 *   npx expo install react-native-html-to-pdf expo-sharing expo-file-system
 */

import { COLORS, RADIUS } from '@/lib/theme';
import { useChildStore } from '@/store/childStore';
import { useVaccineStore, VaccineRow } from '@/store/vaccineStore';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// ─── PDF export (graceful fallback if not installed) ────────────────────────
let Print: any = null;
let Sharing: any = null;
try {
  Print = require('expo-print');
  Sharing = require('expo-sharing');
} catch (_) {}

// ─── Z-score helpers ─────────────────────────────────────────────────────────
function zLabel(z: number | null): { label: string; color: string; bg: string; icon: string } {
  if (z === null) return { label: 'N/A', color: COLORS.textMuted, bg: COLORS.surface, icon: 'help-circle-outline' };
  if (z < -3) return { label: 'Severely Low', color: '#D32F2F', bg: '#FFEBEE', icon: 'alert-circle' };
  if (z < -2) return { label: 'Low', color: COLORS.due, bg: COLORS.dueLight, icon: 'arrow-down-circle' };
  if (z > 2) return { label: 'High', color: COLORS.upcoming, bg: COLORS.upcomingLight, icon: 'arrow-up-circle' };
  return { label: 'Normal', color: COLORS.given, bg: COLORS.givenLight, icon: 'checkmark-circle' };
}

function fmt(n: number | null, unit: string) {
  return n != null ? `${n.toFixed(1)} ${unit}` : '\u2014';
}

function deltaStr(val: number) {
  return val >= 0 ? `\u25B2 ${Math.abs(val).toFixed(1)}` : `\u25BC ${Math.abs(val).toFixed(1)}`;
}

// ─── Animated section wrapper ────────────────────────────────────────────────
function FadeInSection({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 420, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 420, delay, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

// ─── Section card ─────────────────────────────────────────────────────────────
function SectionCard({
  title,
  icon,
  accent = COLORS.primary,
  children,
}: {
  title: string;
  icon: string;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.cardIconCircle, { backgroundColor: accent + '22' }]}>
          <Ionicons name={icon as any} size={17} color={accent} />
        </View>
        <Text style={[styles.cardTitle, { color: accent }]}>{title}</Text>
      </View>
      <View style={styles.cardDivider} />
      {children}
    </View>
  );
}

// ─── Stat pill ────────────────────────────────────────────────────────────────
function StatPill({
  label,
  value,
  color,
  bg,
}: {
  label: string;
  value: string;
  color: string;
  bg: string;
}) {
  return (
    <View style={[styles.statPill, { backgroundColor: bg, borderColor: color + '33' }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color }]}>{label}</Text>
    </View>
  );
}

// ─── Coverage ring (pure RN, no SVG dep needed) ──────────────────────────────
function CoverageRing({ pct }: { pct: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: pct, duration: 900, delay: 200, useNativeDriver: false }).start();
  }, [pct]);

  const color = pct >= 80 ? COLORS.given : pct >= 50 ? COLORS.due : COLORS.missed;

  return (
    <View style={styles.ringWrap}>
      <View style={[styles.ringBg, { borderColor: color + '22' }]}>
        <View style={styles.ringInner}>
          <Text style={[styles.ringPct, { color }]}>{pct}%</Text>
          <Text style={styles.ringLabel}>Coverage</Text>
        </View>
      </View>
      {/* Simple segmented arc illusion via border */}
      <View style={[styles.ringArcMask, { borderColor: color, borderTopColor: color, opacity: pct / 100 }]} />
    </View>
  );
}

// ─── PDF generation ───────────────────────────────────────────────────────────
async function generatePDF(child: any, latest: any, sorted: any[], vaccineStats: any) {
  if (!Print) {
    Alert.alert(
      'PDF Export',
      'Install expo-print and expo-sharing to enable PDF export.\n\nnpx expo install react-native-html-to-pdf expo-sharing',
    );
    return;
  }

  const today = new Date().toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' });
  const { given, missed, due, upcoming, total, coverage } = vaccineStats;

  const wazInfo = zLabel(latest?.waz ?? null);
  const hazInfo = zLabel(latest?.haz ?? null);
  const whzInfo = zLabel(latest?.whz ?? null);

  const historyRows = [...sorted]
    .slice(-10)
    .reverse()
    .map(
      (r) => `
    <tr>
      <td>${new Date(r.date).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
      <td>${r.weight_kg != null ? r.weight_kg + ' kg' : '\u2014'}</td>
      <td>${r.height_cm != null ? r.height_cm + ' cm' : '\u2014'}</td>
      <td style="color:${zLabel(r.waz ?? null).color};font-weight:600">${r.waz != null ? r.waz.toFixed(2) : '\u2014'}</td>
      <td style="color:${zLabel(r.haz ?? null).color};font-weight:600">${r.haz != null ? r.haz.toFixed(2) : '\u2014'}</td>
    </tr>`,
    )
    .join('');

  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; background:#F7F9FC; color:#1A1A2E; }
  .header { background:linear-gradient(135deg,#5B6AF0,#7C3AED); color:#fff; padding:32px 28px 24px; }
  .header h1 { font-size:26px; font-weight:800; letter-spacing:-0.5px; }
  .header p { font-size:13px; opacity:0.8; margin-top:4px; }
  .badge { display:inline-block; background:rgba(255,255,255,0.2); border-radius:20px; padding:4px 14px; font-size:12px; margin-top:12px; }
  .content { padding:24px 28px; }
  .section { background:#fff; border-radius:14px; padding:20px; margin-bottom:18px; box-shadow:0 2px 8px rgba(0,0,0,0.07); }
  .section-title { font-size:13px; font-weight:700; color:#5B6AF0; text-transform:uppercase; letter-spacing:0.8px; margin-bottom:16px; padding-bottom:10px; border-bottom:2px solid #EEF0FF; }
  .grid3 { display:flex; gap:12px; }
  .metric-card { flex:1; background:#F7F9FC; border-radius:10px; padding:14px; text-align:center; border:1px solid #E8EBFF; }
  .metric-val { font-size:22px; font-weight:800; color:#1A1A2E; }
  .metric-lbl { font-size:11px; color:#6B7280; margin-top:3px; }
  .metric-delta { font-size:11px; font-weight:600; margin-top:4px; }
  .z-card { flex:1; border-radius:10px; padding:14px; text-align:center; }
  .z-score { font-size:24px; font-weight:800; }
  .z-name { font-size:11px; font-weight:700; margin-top:2px; }
  .z-status { font-size:10px; font-weight:600; margin-top:2px; }
  .z-desc { font-size:9px; opacity:0.75; margin-top:2px; }
  table { width:100%; border-collapse:collapse; margin-top:4px; }
  th { background:#EEF0FF; color:#5B6AF0; font-size:11px; font-weight:700; padding:8px 10px; text-align:left; }
  td { font-size:12px; padding:7px 10px; color:#374151; border-bottom:1px solid #F3F4F6; }
  tr:last-child td { border-bottom:none; }
  .cov-bar-bg { background:#F3F4F6; border-radius:8px; height:14px; margin:12px 0 8px; overflow:hidden; }
  .cov-bar-fill { height:100%; border-radius:8px; background:#22C55E; }
  .pills { display:flex; gap:8px; flex-wrap:wrap; margin-top:12px; }
  .pill { border-radius:20px; padding:6px 14px; font-size:12px; font-weight:700; }
  .alert { display:flex; align-items:center; gap:8px; border-radius:10px; padding:10px 14px; margin-top:10px; font-size:12px; font-weight:600; }
  .footer { text-align:center; padding:20px; font-size:11px; color:#9CA3AF; }
</style>
</head>
<body>
<div class="header">
  <h1>ZuriHealth Health Report</h1>
  <p>${child.full_name} &bull; Generated ${today}</p>
  <span class="badge">Confidential Medical Record</span>
</div>
<div class="content">

  <!-- Latest Measurements -->
  <div class="section">
    <div class="section-title">&#128200; Latest Measurements</div>
    ${latest ? `
    <p style="font-size:11px;color:#6B7280;margin-bottom:14px">Recorded ${new Date(latest.date).toLocaleDateString('en-KE', { day:'numeric', month:'long', year:'numeric' })}</p>
    <div class="grid3">
      <div class="metric-card">
        <div class="metric-val">${fmt(latest.weight_kg, 'kg')}</div>
        <div class="metric-lbl">Weight</div>
      </div>
      <div class="metric-card">
        <div class="metric-val">${fmt(latest.height_cm, 'cm')}</div>
        <div class="metric-lbl">Height</div>
      </div>
      <div class="metric-card">
        <div class="metric-val">${latest.age_months ?? '\u2014'}</div>
        <div class="metric-lbl">Age (months)</div>
      </div>
    </div>` : '<p style="color:#6B7280;font-size:13px">No measurements recorded yet.</p>'}
  </div>

  <!-- Nutritional Z-Scores -->
  <div class="section">
    <div class="section-title">&#127381; Nutritional Status (Z-Scores)</div>
    ${latest ? `
    <div class="grid3">
      <div class="z-card" style="background:${wazInfo.bg}">
        <div class="z-score" style="color:${wazInfo.color}">${latest.waz != null ? latest.waz.toFixed(2) : '\u2014'}</div>
        <div class="z-name" style="color:${wazInfo.color}">WAZ</div>
        <div class="z-status" style="color:${wazInfo.color}">${wazInfo.label}</div>
        <div class="z-desc" style="color:${wazInfo.color}">Weight-for-Age</div>
      </div>
      <div class="z-card" style="background:${hazInfo.bg}">
        <div class="z-score" style="color:${hazInfo.color}">${latest.haz != null ? latest.haz.toFixed(2) : '\u2014'}</div>
        <div class="z-name" style="color:${hazInfo.color}">HAZ</div>
        <div class="z-status" style="color:${hazInfo.color}">${hazInfo.label}</div>
        <div class="z-desc" style="color:${hazInfo.color}">Height-for-Age</div>
      </div>
      <div class="z-card" style="background:${whzInfo.bg}">
        <div class="z-score" style="color:${whzInfo.color}">${latest.whz != null ? latest.whz.toFixed(2) : '\u2014'}</div>
        <div class="z-name" style="color:${whzInfo.color}">WHZ</div>
        <div class="z-status" style="color:${whzInfo.color}">${whzInfo.label}</div>
        <div class="z-desc" style="color:${whzInfo.color}">Weight-for-Height</div>
      </div>
    </div>` : '<p style="color:#6B7280;font-size:13px">No z-score data available.</p>'}
  </div>

  <!-- Growth History -->
  <div class="section">
    <div class="section-title">&#128200; Growth History (Last 10 Records)</div>
    ${sorted.length > 0 ? `
    <table>
      <tr>
        <th>Date</th><th>Weight</th><th>Height</th><th>WAZ</th><th>HAZ</th>
      </tr>
      ${historyRows}
    </table>
    ${sorted.length > 10 ? `<p style="font-size:11px;color:#6B7280;margin-top:8px;text-align:center">Showing 10 of ${sorted.length} records</p>` : ''}
    ` : '<p style="color:#6B7280;font-size:13px">No growth history available.</p>'}
  </div>

  <!-- Vaccine Coverage -->
  <div class="section">
    <div class="section-title">&#128737; Vaccine Coverage</div>
    ${total > 0 ? `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:4px">
      <div style="flex:1">
        <div class="cov-bar-bg">
          <div class="cov-bar-fill" style="width:${coverage}%;background:${coverage >= 80 ? '#22C55E' : coverage >= 50 ? '#F59E0B' : '#EF4444'}"></div>
        </div>
      </div>
      <span style="font-size:18px;font-weight:800;color:${coverage >= 80 ? '#22C55E' : coverage >= 50 ? '#F59E0B' : '#EF4444'}">${coverage}%</span>
    </div>
    <div class="pills">
      <span class="pill" style="background:${COLORS.givenLight};color:${COLORS.given}">${given} Given</span>
      <span class="pill" style="background:${COLORS.dueLight};color:${COLORS.due}">${due} Due</span>
      <span class="pill" style="background:${COLORS.missedLight};color:${COLORS.missed}">${missed} Missed</span>
      <span class="pill" style="background:${COLORS.upcomingLight};color:${COLORS.upcoming}">${upcoming} Upcoming</span>
    </div>
    ${missed > 0 ? `<div class="alert" style="background:${COLORS.missedLight};color:${COLORS.missed}">&#9888; ${missed} vaccine${missed > 1 ? 's' : ''} missed \u2014 visit your clinic soon.</div>` : ''}
    ${due > 0 ? `<div class="alert" style="background:${COLORS.dueLight};color:${COLORS.due}">&#8987; ${due} vaccine${due > 1 ? 's' : ''} due now.</div>` : ''}
    ` : '<p style="color:#6B7280;font-size:13px">No vaccine data available.</p>'}
  </div>

</div>
<div class="footer">Generated by ZuriHealth &bull; Maternal &amp; Child Health Tracker &bull; ${today}</div>
</body>
</html>`;

  try {
    const result = await Print.printToFileAsync({ html, base64: false });

    if (result?.uri && Sharing) {
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(result.uri, {
          mimeType: 'application/pdf',
          dialogTitle: `${child.full_name} – Health Report`,
        });
      } else {
        Alert.alert('PDF Saved', `Report saved to:\n${result.filePath}`);
      }
    }
  } catch (err: any) {
    Alert.alert('Export Failed', err?.message ?? 'Could not generate PDF.');
  }
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function ReportsScreen() {
  const router = useRouter();
  const { children, selectedChildId, growthRecords, fetchGrowthRecords } = useChildStore();
  const { vaccineRows, fetchSchedules, fetchImmunizations, computeRows } = useVaccineStore();
  const [exporting, setExporting] = useState(false);

  const child = children.find((c) => c.id === selectedChildId) ?? children[0];

  useEffect(() => {
    if (child?.id) {
      fetchGrowthRecords(child.id);
      fetchSchedules().then(async () => {
        const imm = await fetchImmunizations(child.id);
        computeRows(child.date_of_birth, imm);
      });
    }
  }, [child?.id]);

  const sorted = useMemo(
    () => [...growthRecords].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [growthRecords],
  );
  const latest = sorted[sorted.length - 1] ?? null;
  const prev = sorted[sorted.length - 2] ?? null;

  const weightDelta =
    latest && prev && latest.weight_kg != null && prev.weight_kg != null
      ? latest.weight_kg - prev.weight_kg
      : null;
  const heightDelta =
    latest && prev && latest.height_cm != null && prev.height_cm != null
      ? latest.height_cm - prev.height_cm
      : null;

  const given = vaccineRows.filter((r: VaccineRow) => r.status === 'given').length;
  const missed = vaccineRows.filter((r: VaccineRow) => r.status === 'missed').length;
  const due = vaccineRows.filter((r: VaccineRow) => r.status === 'due').length;
  const upcoming = vaccineRows.filter((r: VaccineRow) => r.status === 'upcoming').length;
  const total = vaccineRows.length;
  const coverage = total > 0 ? Math.round((given / total) * 100) : 0;

  const vaccineStats = { given, missed, due, upcoming, total, coverage };

  const wazInfo = zLabel(latest?.waz ?? null);
  const hazInfo = zLabel(latest?.haz ?? null);
  const whzInfo = zLabel(latest?.whz ?? null);

  const handleExport = async () => {
    setExporting(true);
    await generatePDF(child, latest, sorted, vaccineStats);
    setExporting(false);
  };

  if (!child) {
    return (
      <View style={styles.empty}>
        <View style={styles.emptyIconWrap}>
          <Ionicons name="person-outline" size={40} color={COLORS.textMuted} />
        </View>
        <Text style={styles.emptyTitle}>No child selected</Text>
        <Text style={styles.emptySubtitle}>Select a child profile to view their health report.</Text>
      </View>
    );
  }

  // Child's age string
  const dobDate = child.date_of_birth ? new Date(child.date_of_birth) : null;
  const ageMonths = dobDate
    ? Math.floor((Date.now() - dobDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44))
    : null;

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Health Report</Text>
          <Text style={styles.headerSub}>{child.full_name}</Text>
        </View>

        <TouchableOpacity
          onPress={handleExport}
          style={[styles.exportBtn, exporting && { opacity: 0.6 }]}
          activeOpacity={0.7}
          disabled={exporting}
        >
          {exporting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="share-outline" size={15} color="#fff" />
              <Text style={styles.exportBtnText}>PDF</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Child summary banner ── */}
      <View style={styles.childBanner}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{child.full_name?.charAt(0)?.toUpperCase() ?? '?'}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.bannerName}>{child.full_name}</Text>
          {ageMonths != null && (
            <Text style={styles.bannerSub}>
              {ageMonths} months old{dobDate ? ` \u2022 Born ${dobDate.toLocaleDateString('en-KE', { month: 'short', year: 'numeric' })}` : ''}
            </Text>
          )}
        </View>
        <View style={styles.recordsBadge}>
          <Text style={styles.recordsBadgeNum}>{sorted.length}</Text>
          <Text style={styles.recordsBadgeLbl}>records</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Latest Measurements ── */}
        <FadeInSection delay={0}>
          <SectionCard title="Latest Measurements" icon="body-outline" accent={COLORS.primary}>
            {latest ? (
              <>
                <Text style={styles.recordDate}>
                  Recorded{' '}
                  {new Date(latest.date).toLocaleDateString('en-KE', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </Text>
                <View style={styles.measureRow}>
                  {/* Weight */}
                  <View style={styles.measureCard}>
                    <View style={[styles.measureIconWrap, { backgroundColor: COLORS.primaryLight }]}>
                      <Ionicons name="scale-outline" size={18} color={COLORS.primary} />
                    </View>
                    <Text style={styles.measureValue}>{fmt(latest.weight_kg, 'kg')}</Text>
                    <Text style={styles.measureLabel}>Weight</Text>
                    {weightDelta !== null && (
                      <Text style={[styles.delta, { color: weightDelta >= 0 ? COLORS.given : COLORS.missed }]}>
                        {deltaStr(weightDelta)} kg
                      </Text>
                    )}
                  </View>

                  {/* Height */}
                  <View style={styles.measureCard}>
                    <View style={[styles.measureIconWrap, { backgroundColor: '#E8F4FD' }]}>
                      <Ionicons name="resize-outline" size={18} color="#1976D2" />
                    </View>
                    <Text style={styles.measureValue}>{fmt(latest.height_cm, 'cm')}</Text>
                    <Text style={styles.measureLabel}>Height</Text>
                    {heightDelta !== null && (
                      <Text style={[styles.delta, { color: heightDelta >= 0 ? COLORS.given : COLORS.missed }]}>
                        {deltaStr(heightDelta)} cm
                      </Text>
                    )}
                  </View>

                  {/* Age */}
                  <View style={styles.measureCard}>
                    <View style={[styles.measureIconWrap, { backgroundColor: '#F3E8FF' }]}>
                      <Ionicons name="calendar-outline" size={18} color="#7C3AED" />
                    </View>
                    <Text style={styles.measureValue}>{latest.age_months ?? '\u2014'}</Text>
                    <Text style={styles.measureLabel}>Months</Text>
                  </View>
                </View>
              </>
            ) : (
              <EmptyState icon="scale-outline" message="No measurements recorded yet" />
            )}
          </SectionCard>
        </FadeInSection>

        {/* ── Nutritional Z-Scores ── */}
        <FadeInSection delay={80}>
          <SectionCard title="Nutritional Status (Z-Scores)" icon="stats-chart-outline" accent="#7C3AED">
            {latest ? (
              <View style={styles.zRow}>
                <ZCard label="WAZ" desc="Weight-for-Age" value={latest.waz} info={wazInfo} />
                <ZCard label="HAZ" desc="Height-for-Age" value={latest.haz} info={hazInfo} />
                <ZCard label="WHZ" desc="Wt-for-Height" value={latest.whz} info={whzInfo} />
              </View>
            ) : (
              <EmptyState icon="stats-chart-outline" message="No z-score data available" />
            )}
          </SectionCard>
        </FadeInSection>

        {/* ── Growth History ── */}
        <FadeInSection delay={160}>
          <SectionCard title="Growth History" icon="trending-up-outline" accent="#0284C7">
            {sorted.length > 0 ? (
              <>
                <View style={styles.historyMeta}>
                  <StatPill
                    label="Total Records"
                    value={`${sorted.length}`}
                    color={COLORS.primary}
                    bg={COLORS.primaryLight}
                  />
                  <StatPill
                    label="First Record"
                    value={new Date(sorted[0].date).toLocaleDateString('en-KE', {
                      month: 'short',
                      year: 'numeric',
                    })}
                    color={COLORS.textSecondary}
                    bg={COLORS.surface}
                  />
                  <StatPill
                    label="Latest"
                    value={new Date(sorted[sorted.length - 1].date).toLocaleDateString('en-KE', {
                      month: 'short',
                      year: 'numeric',
                    })}
                    color={COLORS.textSecondary}
                    bg={COLORS.surface}
                  />
                </View>

                <View style={styles.table}>
                  <View style={[styles.tableRow, styles.tableHead]}>
                    <Text style={[styles.tableCell, styles.tableHeadText]}>Date</Text>
                    <Text style={[styles.tableCell, styles.tableHeadText]}>Weight</Text>
                    <Text style={[styles.tableCell, styles.tableHeadText]}>Height</Text>
                    <Text style={[styles.tableCell, styles.tableHeadText]}>WAZ</Text>
                  </View>
                  {sorted
                    .slice(-5)
                    .reverse()
                    .map((r, i) => (
                      <View key={r.id} style={[styles.tableRow, i % 2 === 0 && styles.tableRowAlt]}>
                        <Text style={styles.tableCell}>
                          {new Date(r.date).toLocaleDateString('en-KE', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </Text>
                        <Text style={styles.tableCell}>
                          {r.weight_kg != null ? `${r.weight_kg}kg` : '\u2014'}
                        </Text>
                        <Text style={styles.tableCell}>
                          {r.height_cm != null ? `${r.height_cm}cm` : '\u2014'}
                        </Text>
                        <Text
                          style={[
                            styles.tableCell,
                            { color: zLabel(r.waz ?? null).color, fontWeight: '700' },
                          ]}
                        >
                          {r.waz != null ? r.waz.toFixed(1) : '\u2014'}
                        </Text>
                      </View>
                    ))}
                </View>

                {sorted.length > 5 && (
                  <Text style={styles.moreNote}>
                    Showing last 5 of {sorted.length} records. Export PDF for full history.
                  </Text>
                )}
              </>
            ) : (
              <EmptyState icon="trending-up-outline" message="No growth history available" />
            )}
          </SectionCard>
        </FadeInSection>

        {/* ── Vaccine Coverage ── */}
        <FadeInSection delay={240}>
          <SectionCard title="Vaccine Coverage" icon="shield-checkmark-outline" accent="#059669">
            {total > 0 ? (
              <>
                <View style={styles.coverageLayout}>
                  <CoverageRing pct={coverage} />
                  <View style={{ flex: 1, gap: 8 }}>
                    <View style={styles.vaccineStatRow}>
                      <View style={[styles.vaccineDot, { backgroundColor: COLORS.given }]} />
                      <Text style={styles.vaccineStatLabel}>Given</Text>
                      <Text style={[styles.vaccineStatVal, { color: COLORS.given }]}>{given}</Text>
                    </View>
                    <View style={styles.vaccineStatRow}>
                      <View style={[styles.vaccineDot, { backgroundColor: COLORS.due }]} />
                      <Text style={styles.vaccineStatLabel}>Due Now</Text>
                      <Text style={[styles.vaccineStatVal, { color: COLORS.due }]}>{due}</Text>
                    </View>
                    <View style={styles.vaccineStatRow}>
                      <View style={[styles.vaccineDot, { backgroundColor: COLORS.missed }]} />
                      <Text style={styles.vaccineStatLabel}>Missed</Text>
                      <Text style={[styles.vaccineStatVal, { color: COLORS.missed }]}>{missed}</Text>
                    </View>
                    <View style={styles.vaccineStatRow}>
                      <View style={[styles.vaccineDot, { backgroundColor: COLORS.upcoming }]} />
                      <Text style={styles.vaccineStatLabel}>Upcoming</Text>
                      <Text style={[styles.vaccineStatVal, { color: COLORS.upcoming }]}>{upcoming}</Text>
                    </View>
                  </View>
                </View>

                {missed > 0 && (
                  <AlertBanner
                    icon="warning-outline"
                    color={COLORS.missed}
                    bg={COLORS.missedLight}
                    text={`${missed} vaccine${missed > 1 ? 's' : ''} missed \u2014 visit your clinic soon.`}
                  />
                )}
                {due > 0 && (
                  <AlertBanner
                    icon="time-outline"
                    color={COLORS.due}
                    bg={COLORS.dueLight}
                    text={`${due} vaccine${due > 1 ? 's' : ''} due now.`}
                  />
                )}
                {coverage === 100 && (
                  <AlertBanner
                    icon="checkmark-circle-outline"
                    color={COLORS.given}
                    bg={COLORS.givenLight}
                    text="All vaccines given. Excellent coverage!"
                  />
                )}
              </>
            ) : (
              <EmptyState icon="shield-outline" message="No vaccine data available" />
            )}
          </SectionCard>
        </FadeInSection>

        {/* ── Export CTA ── */}
        <FadeInSection delay={320}>
          <TouchableOpacity
            style={[styles.exportCta, exporting && { opacity: 0.6 }]}
            onPress={handleExport}
            activeOpacity={0.8}
            disabled={exporting}
          >
            {exporting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="document-text-outline" size={20} color="#fff" />
            )}
            <Text style={styles.exportCtaText}>
              {exporting ? 'Generating PDF\u2026' : 'Export Full Report as PDF'}
            </Text>
          </TouchableOpacity>
        </FadeInSection>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function ZCard({
  label,
  desc,
  value,
  info,
}: {
  label: string;
  desc: string;
  value: number | null | undefined;
  info: ReturnType<typeof zLabel>;
}) {
  return (
    <View style={[styles.zCard, { backgroundColor: info.bg }]}>
      <Ionicons name={info.icon as any} size={16} color={info.color} style={{ marginBottom: 4 }} />
      <Text style={[styles.zScore, { color: info.color }]}>
        {value != null ? value.toFixed(2) : '\u2014'}
      </Text>
      <Text style={[styles.zName, { color: info.color }]}>{label}</Text>
      <Text style={[styles.zStatus, { color: info.color }]}>{info.label}</Text>
      <Text style={[styles.zDesc, { color: info.color }]}>{desc}</Text>
    </View>
  );
}

function AlertBanner({
  icon,
  color,
  bg,
  text,
}: {
  icon: string;
  color: string;
  bg: string;
  text: string;
}) {
  return (
    <View style={[styles.alertBanner, { backgroundColor: bg, borderLeftColor: color }]}>
      <Ionicons name={icon as any} size={15} color={color} />
      <Text style={[styles.alertText, { color }]}>{text}</Text>
    </View>
  );
}

function EmptyState({ icon, message }: { icon: string; message: string }) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name={icon as any} size={28} color={COLORS.textMuted} />
      <Text style={styles.emptyStateText}>{message}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4FF' },

  // Header
  header: {
    backgroundColor: COLORS.primary,
    paddingTop: Platform.OS === 'ios' ? 56 : 42,
    paddingBottom: 20,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.72)', marginTop: 2 },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  exportBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  // Child banner
  childBanner: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E8EBFF',
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 20, fontWeight: '800', color: '#fff' },
  bannerName: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  bannerSub: { fontSize: 11, color: COLORS.textMuted },
  recordsBadge: {
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  recordsBadgeNum: { fontSize: 16, fontWeight: '800', color: COLORS.primary },
  recordsBadgeLbl: { fontSize: 9, fontWeight: '600', color: COLORS.primary, opacity: 0.8 },

  scroll: { padding: 16, gap: 14 },

  // Cards
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,

    ...Platform.select({

      ios: { shadowColor: '#5B6AF0', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 10 },

      android: { elevation: 8 },

      default: {},

    }),
    elevation: 3,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  cardIconCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 13, fontWeight: '800', letterSpacing: 0.2 },
  cardDivider: { height: 1, backgroundColor: '#F0F4FF', marginBottom: 14 },

  // Measurements
  recordDate: { fontSize: 11, color: COLORS.textMuted, marginBottom: 12 },
  measureRow: { flexDirection: 'row', gap: 10 },
  measureCard: {
    flex: 1,
    backgroundColor: '#F7F9FC',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: '#EEF0FF',
  },
  measureIconWrap: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  measureValue: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary },
  measureLabel: { fontSize: 10, color: COLORS.textMuted, fontWeight: '600' },
  delta: { fontSize: 11, fontWeight: '700' },

  // Z-scores
  zRow: { flexDirection: 'row', gap: 8 },
  zCard: { flex: 1, borderRadius: 14, padding: 12, alignItems: 'center', gap: 2 },
  zScore: { fontSize: 18, fontWeight: '800' },
  zName: { fontSize: 11, fontWeight: '800' },
  zStatus: { fontSize: 10, fontWeight: '700' },
  zDesc: { fontSize: 8.5, opacity: 0.75, textAlign: 'center', marginTop: 1 },

  // History
  historyMeta: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 14 },
  statPill: {
    borderRadius: RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    minWidth: 64,
    borderWidth: 1,
  },
  statValue: { fontSize: 14, fontWeight: '800' },
  statLabel: { fontSize: 9, fontWeight: '600', opacity: 0.8 },
  table: { borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#EEF0FF' },
  tableRow: { flexDirection: 'row' },
  tableRowAlt: { backgroundColor: '#F7F9FF' },
  tableHead: { backgroundColor: '#EEF0FF' },
  tableCell: { flex: 1, fontSize: 11, paddingHorizontal: 10, paddingVertical: 8, color: COLORS.textSecondary },
  tableHeadText: { fontWeight: '800', color: COLORS.primary },
  moreNote: { fontSize: 11, color: COLORS.textMuted, textAlign: 'center', marginTop: 8 },

  // Coverage
  coverageLayout: { flexDirection: 'row', alignItems: 'center', gap: 18, marginBottom: 14 },
  ringWrap: { width: 90, height: 90, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  ringBg: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringArcMask: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 10,
    borderColor: 'transparent',
  },
  ringInner: { alignItems: 'center' },
  ringPct: { fontSize: 18, fontWeight: '900' },
  ringLabel: { fontSize: 9, color: COLORS.textMuted, fontWeight: '600' },
  vaccineStatRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  vaccineDot: { width: 9, height: 9, borderRadius: 5 },
  vaccineStatLabel: { flex: 1, fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  vaccineStatVal: { fontSize: 14, fontWeight: '800' },

  // Alerts
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    padding: 11,
    marginTop: 8,
    borderLeftWidth: 3,
  },
  alertText: { fontSize: 12, fontWeight: '600', flex: 1 },

  // Export CTA
  exportCta: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,

    ...Platform.select({

      ios: { shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },

      android: { elevation: 8 },

      default: {},

    }),
    elevation: 6,
  },
  exportCtaText: { fontSize: 15, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },

  // Empty states
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32 },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: COLORS.textPrimary },
  emptySubtitle: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },
  emptyState: { alignItems: 'center', gap: 8, paddingVertical: 12 },
  emptyStateText: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center' },
});
