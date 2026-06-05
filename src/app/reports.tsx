/**
 * src/app/reports.tsx
 * ZuriHealth — Flexible Health Report Screen
 * Select individual report sections or export a full report
 * Includes: Growth · Z-Scores · Vaccines · Milestones
 */

import { COLORS, RADIUS, FONTS, HEADER } from '@/lib/theme';
import { getAgeLabel } from '@/lib/ageUtils';
import { useChildStore } from '@/store/childStore';
import { useVaccineStore, VaccineRow } from '@/store/vaccineStore';
import { supabase } from '@/lib/supabase';
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

// ─── PDF / Sharing (graceful fallback) ───────────────────────────────────────
let Print: any = null;
let Sharing: any = null;
try { Print = require('expo-print'); } catch (_) {}
try { Sharing = require('expo-sharing'); } catch (_) {}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ReportSection = 'growth' | 'zscores' | 'vaccines' | 'milestones';

interface SectionConfig {
  key: ReportSection;
  label: string;
  icon: string;
  accent: string;
  description: string;
}

type MilestoneStatus = 'achieved' | 'in_progress' | 'not_yet';

interface MilestoneRecord {
  milestone_id: string;
  status: MilestoneStatus;
  achieved_date?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Milestone static data (matches milestones.tsx exactly)
// ─────────────────────────────────────────────────────────────────────────────

const MILESTONE_DATA: { id: string; ageLabel: string; category: string; title: string }[] = [
  { id: 'm_2_mot_1',  ageLabel: '2 Months',  category: 'Motor',     title: 'Holds head up briefly' },
  { id: 'm_2_lan_1',  ageLabel: '2 Months',  category: 'Language',  title: 'Makes cooing sounds' },
  { id: 'm_2_soc_1',  ageLabel: '2 Months',  category: 'Social',    title: 'Social smile' },
  { id: 'm_2_cog_1',  ageLabel: '2 Months',  category: 'Cognitive', title: 'Follows object with eyes' },
  { id: 'm_4_mot_1',  ageLabel: '4 Months',  category: 'Motor',     title: 'Holds head steady' },
  { id: 'm_4_mot_2',  ageLabel: '4 Months',  category: 'Motor',     title: 'Pushes up on arms' },
  { id: 'm_4_lan_1',  ageLabel: '4 Months',  category: 'Language',  title: 'Laughs and squeals' },
  { id: 'm_4_soc_1',  ageLabel: '4 Months',  category: 'Social',    title: 'Recognises familiar faces' },
  { id: 'm_4_cog_1',  ageLabel: '4 Months',  category: 'Cognitive', title: 'Reaches for objects' },
  { id: 'm_6_mot_1',  ageLabel: '6 Months',  category: 'Motor',     title: 'Sits with support' },
  { id: 'm_6_mot_2',  ageLabel: '6 Months',  category: 'Motor',     title: 'Rolls both ways' },
  { id: 'm_6_lan_1',  ageLabel: '6 Months',  category: 'Language',  title: 'Babbles consonants' },
  { id: 'm_6_soc_1',  ageLabel: '6 Months',  category: 'Social',    title: 'Knows familiar vs strangers' },
  { id: 'm_6_cog_1',  ageLabel: '6 Months',  category: 'Cognitive', title: 'Explores with mouth & hands' },
  { id: 'm_9_mot_1',  ageLabel: '9 Months',  category: 'Motor',     title: 'Sits without support' },
  { id: 'm_9_mot_2',  ageLabel: '9 Months',  category: 'Motor',     title: 'Crawls or scoots' },
  { id: 'm_9_lan_1',  ageLabel: '9 Months',  category: 'Language',  title: 'Says "mama" / "dada"' },
  { id: 'm_9_soc_1',  ageLabel: '9 Months',  category: 'Social',    title: 'Plays peek-a-boo' },
  { id: 'm_9_cog_1',  ageLabel: '9 Months',  category: 'Cognitive', title: 'Object permanence' },
  { id: 'm_12_mot_1', ageLabel: '12 Months', category: 'Motor',     title: 'Pulls to stand' },
  { id: 'm_12_mot_2', ageLabel: '12 Months', category: 'Motor',     title: 'Cruises along furniture' },
  { id: 'm_12_lan_1', ageLabel: '12 Months', category: 'Language',  title: 'First words' },
  { id: 'm_12_soc_1', ageLabel: '12 Months', category: 'Social',    title: 'Waves bye-bye' },
  { id: 'm_12_cog_1', ageLabel: '12 Months', category: 'Cognitive', title: 'Imitates actions' },
  { id: 'm_12_cog_2', ageLabel: '12 Months', category: 'Cognitive', title: 'Uses pincer grasp' },
  { id: 'm_18_mot_1', ageLabel: '18 Months', category: 'Motor',     title: 'Walks independently' },
  { id: 'm_18_mot_2', ageLabel: '18 Months', category: 'Motor',     title: 'Climbs onto furniture' },
  { id: 'm_18_lan_1', ageLabel: '18 Months', category: 'Language',  title: 'Uses 10–20 words' },
  { id: 'm_18_soc_1', ageLabel: '18 Months', category: 'Social',    title: 'Parallel play' },
  { id: 'm_18_cog_1', ageLabel: '18 Months', category: 'Cognitive', title: 'Points to named body parts' },
  { id: 'm_24_mot_1', ageLabel: '2 Years',   category: 'Motor',     title: 'Runs steadily' },
  { id: 'm_24_mot_2', ageLabel: '2 Years',   category: 'Motor',     title: 'Kicks a ball' },
  { id: 'm_24_lan_1', ageLabel: '2 Years',   category: 'Language',  title: 'Two-word phrases' },
  { id: 'm_24_lan_2', ageLabel: '2 Years',   category: 'Language',  title: '50+ word vocabulary' },
  { id: 'm_24_soc_1', ageLabel: '2 Years',   category: 'Social',    title: 'Plays with others briefly' },
  { id: 'm_24_cog_1', ageLabel: '2 Years',   category: 'Cognitive', title: 'Sorts shapes & colours' },
  { id: 'm_24_cog_2', ageLabel: '2 Years',   category: 'Cognitive', title: 'Simple pretend play' },
  { id: 'm_36_mot_1', ageLabel: '3 Years',   category: 'Motor',     title: 'Jumps with both feet' },
  { id: 'm_36_mot_2', ageLabel: '3 Years',   category: 'Motor',     title: 'Climbs stairs alternating' },
  { id: 'm_36_lan_1', ageLabel: '3 Years',   category: 'Language',  title: '3-word sentences' },
  { id: 'm_36_soc_1', ageLabel: '3 Years',   category: 'Social',    title: 'Takes turns in games' },
  { id: 'm_36_cog_1', ageLabel: '3 Years',   category: 'Cognitive', title: 'Knows own name & age' },
  { id: 'm_36_cog_2', ageLabel: '3 Years',   category: 'Cognitive', title: 'Draws a circle' },
  { id: 'm_48_mot_1', ageLabel: '4 Years',   category: 'Motor',     title: 'Hops on one foot' },
  { id: 'm_48_mot_2', ageLabel: '4 Years',   category: 'Motor',     title: 'Catches a bounced ball' },
  { id: 'm_48_lan_1', ageLabel: '4 Years',   category: 'Language',  title: 'Tells simple stories' },
  { id: 'm_48_soc_1', ageLabel: '4 Years',   category: 'Social',    title: 'Cooperative play' },
  { id: 'm_48_cog_1', ageLabel: '4 Years',   category: 'Cognitive', title: 'Counts to 10' },
  { id: 'm_48_cog_2', ageLabel: '4 Years',   category: 'Cognitive', title: 'Draws a person' },
  { id: 'm_60_mot_1', ageLabel: '5 Years',   category: 'Motor',     title: 'Skips and hops well' },
  { id: 'm_60_mot_2', ageLabel: '5 Years',   category: 'Motor',     title: 'Writes own name' },
  { id: 'm_60_lan_1', ageLabel: '5 Years',   category: 'Language',  title: 'Uses full sentences' },
  { id: 'm_60_lan_2', ageLabel: '5 Years',   category: 'Language',  title: 'Asks "why" questions' },
  { id: 'm_60_soc_1', ageLabel: '5 Years',   category: 'Social',    title: 'Follows rules in games' },
  { id: 'm_60_cog_1', ageLabel: '5 Years',   category: 'Cognitive', title: 'Counts to 20+' },
  { id: 'm_60_cog_2', ageLabel: '5 Years',   category: 'Cognitive', title: 'Knows letters of alphabet' },
];

const SECTION_CONFIG: SectionConfig[] = [
  { key: 'growth',      label: 'Growth History',      icon: 'trending-up-outline',       accent: '#0284C7', description: 'Weight, height & growth records' },
  { key: 'zscores',     label: 'Nutritional Status',  icon: 'stats-chart-outline',       accent: '#7C3AED', description: 'WHO z-scores: WAZ, HAZ, WHZ' },
  { key: 'vaccines',    label: 'Vaccine Coverage',    icon: 'shield-checkmark-outline',  accent: COLORS.given, description: 'KEPI schedule & coverage' },
  { key: 'milestones',  label: 'Milestones',          icon: 'ribbon-outline',            accent: '#EA580C', description: 'Developmental tracker 0–5 years' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, unit: string, decimals = 1) {
  return n != null ? `${n.toFixed(decimals)} ${unit}` : '—';
}

function deltaStr(val: number) {
  const abs = Math.abs(val).toFixed(2);
  return val >= 0 ? `+${abs}` : `−${abs}`;
}

function zInfo(z: number | null): { label: string; color: string; bg: string; short: string } {
  if (z === null) return { label: 'No data',       color: COLORS.textMuted, bg: COLORS.surface,     short: '—' };
  if (z < -3)    return { label: 'Severely low',   color: '#C0392B',        bg: '#FDECEA',           short: `${z.toFixed(2)}` };
  if (z < -2)    return { label: 'Below normal',   color: COLORS.due,       bg: COLORS.dueLight,     short: `${z.toFixed(2)}` };
  if (z > 3)     return { label: 'Very high',      color: '#7C3AED',        bg: '#EDE9FE',           short: `${z.toFixed(2)}` };
  if (z > 2)     return { label: 'Above normal',   color: '#0284C7',        bg: '#E0F2FE',           short: `${z.toFixed(2)}` };
  return               { label: 'Normal',          color: COLORS.given,     bg: COLORS.givenLight,   short: `${z.toFixed(2)}` };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const op = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(20)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(op, { toValue: 1, duration: 380, delay, useNativeDriver: true }),
      Animated.timing(ty, { toValue: 0, duration: 380, delay, useNativeDriver: true }),
    ]).start();
  }, []);
  return <Animated.View style={{ opacity: op, transform: [{ translateY: ty }] }}>{children}</Animated.View>;
}

function SectionCard({
  title, icon, accentColor = COLORS.primary, children,
}: { title: string; icon: string; accentColor?: string; children: React.ReactNode }) {
  return (
    <View style={[styles.card, { borderTopColor: accentColor }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.cardIconCircle, { backgroundColor: accentColor + '18' }]}>
          <Ionicons name={icon as any} size={16} color={accentColor} />
        </View>
        <Text style={[styles.cardTitle, { color: accentColor }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function ZBadge({ label, value, desc }: { label: string; value: number | null | undefined; desc: string }) {
  const info = zInfo(value ?? null);
  return (
    <View style={[styles.zBadge, { backgroundColor: info.bg }]}>
      <Text style={[styles.zBadgeScore, { color: info.color }]}>{info.short}</Text>
      <Text style={[styles.zBadgeName,  { color: info.color }]}>{label}</Text>
      <Text style={[styles.zBadgeStatus,{ color: info.color }]}>{info.label}</Text>
      <Text style={[styles.zBadgeDesc,  { color: info.color + 'BB' }]}>{desc}</Text>
    </View>
  );
}

function AlertBanner({ icon, text, color, bg }: { icon: string; text: string; color: string; bg: string }) {
  return (
    <View style={[styles.alertBanner, { backgroundColor: bg, borderLeftColor: color }]}>
      <Ionicons name={icon as any} size={14} color={color} />
      <Text style={[styles.alertText, { color }]}>{text}</Text>
    </View>
  );
}

function VacStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.vacRow}>
      <View style={[styles.vacDot, { backgroundColor: color }]} />
      <Text style={styles.vacLabel}>{label}</Text>
      <Text style={[styles.vacValue, { color }]}>{value}</Text>
    </View>
  );
}

function CoverageRing({ pct }: { pct: number }) {
  const color = pct >= 80 ? COLORS.given : pct >= 50 ? COLORS.due : COLORS.missed;
  return (
    <View style={[styles.ringTrack, { borderColor: color + '30' }]}>
      <View style={styles.ringCenter}>
        <Text style={[styles.ringPct, { color }]}>{pct}%</Text>
        <Text style={styles.ringLbl}>covered</Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Report section renderers
// ─────────────────────────────────────────────────────────────────────────────

function GrowthSection({ sorted }: { sorted: any[] }) {
  const latest = sorted[sorted.length - 1] ?? null;
  const prev   = sorted[sorted.length - 2] ?? null;
  const wDelta = latest && prev && latest.weight_kg != null && prev.weight_kg != null ? latest.weight_kg - prev.weight_kg : null;
  const hDelta = latest && prev && latest.height_cm != null && prev.height_cm != null ? latest.height_cm - prev.height_cm : null;

  return (
    <SectionCard title="Growth History" icon="trending-up-outline" accentColor="#0284C7">
      {latest ? (
        <>
          <Text style={styles.recordDate}>
            Latest: {new Date(latest.date).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })}
          </Text>
          <View style={styles.measureRow}>
            <View style={styles.measureCard}>
              <View style={[styles.measureIcon, { backgroundColor: COLORS.primaryLight }]}>
                <Ionicons name="scale-outline" size={18} color={COLORS.primary} />
              </View>
              <Text style={styles.measureVal}>{fmt(latest.weight_kg, 'kg')}</Text>
              <Text style={styles.measureLbl}>Weight</Text>
              {wDelta !== null && (
                <View style={[styles.deltaBadge, { backgroundColor: wDelta >= 0 ? COLORS.givenLight : COLORS.missedLight }]}>
                  <Text style={[styles.deltaText, { color: wDelta >= 0 ? COLORS.given : COLORS.missed }]}>{deltaStr(wDelta)} kg</Text>
                </View>
              )}
            </View>
            <View style={styles.measureCard}>
              <View style={[styles.measureIcon, { backgroundColor: '#E0F2FE' }]}>
                <Ionicons name="resize-outline" size={18} color="#0284C7" />
              </View>
              <Text style={styles.measureVal}>{fmt(latest.height_cm, 'cm')}</Text>
              <Text style={styles.measureLbl}>Height</Text>
              {hDelta !== null && (
                <View style={[styles.deltaBadge, { backgroundColor: hDelta >= 0 ? COLORS.givenLight : COLORS.missedLight }]}>
                  <Text style={[styles.deltaText, { color: hDelta >= 0 ? COLORS.given : COLORS.missed }]}>{deltaStr(hDelta)} cm</Text>
                </View>
              )}
            </View>
            <View style={styles.measureCard}>
              <View style={[styles.measureIcon, { backgroundColor: '#F3E8FF' }]}>
                <Ionicons name="calendar-outline" size={18} color="#7C3AED" />
              </View>
              <Text style={styles.measureVal}>{latest.age_months ?? '—'}</Text>
              <Text style={styles.measureLbl}>Months old</Text>
            </View>
          </View>

          {sorted.length > 1 && (
            <>
              <View style={styles.tableHeaderRow}>
                {['Date', 'Weight', 'Height', 'WAZ'].map(h => (
                  <Text key={h} style={[styles.tableCell, styles.tableHeadText, h === 'Date' && { flex: 2 }]}>{h}</Text>
                ))}
              </View>
              {sorted.slice(-6).reverse().map((r, i) => (
                <View key={r.id} style={[styles.tableRow, i % 2 === 0 && styles.tableRowAlt]}>
                  <Text style={[styles.tableCell, { flex: 2 }]}>
                    {new Date(r.date).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </Text>
                  <Text style={styles.tableCell}>{r.weight_kg != null ? `${r.weight_kg}kg` : '—'}</Text>
                  <Text style={styles.tableCell}>{r.height_cm != null ? `${r.height_cm}cm` : '—'}</Text>
                  <Text style={[styles.tableCell, { color: zInfo(r.waz ?? null).color, fontFamily: FONTS.bold }]}>
                    {r.waz != null ? r.waz.toFixed(1) : '—'}
                  </Text>
                </View>
              ))}
              {sorted.length > 6 && (
                <Text style={styles.moreNote}>Showing 6 of {sorted.length} records. Export PDF for full history.</Text>
              )}
            </>
          )}
        </>
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="scale-outline" size={26} color={COLORS.textMuted} />
          <Text style={styles.emptyStateText}>No measurements recorded yet</Text>
        </View>
      )}
    </SectionCard>
  );
}

function ZScoresSection({ latest }: { latest: any }) {
  return (
    <SectionCard title="WHO Nutritional Status (Z-Scores)" icon="stats-chart-outline" accentColor="#7C3AED">
      {latest ? (
        <>
          <View style={styles.zRow}>
            <ZBadge label="WAZ" value={latest.waz} desc="Weight-for-Age" />
            <ZBadge label="HAZ" value={latest.haz} desc="Height-for-Age" />
            <ZBadge label="WHZ" value={latest.whz} desc="Wt-for-Height" />
          </View>
          <View style={styles.zLegend}>
            <Ionicons name="information-circle-outline" size={13} color={COLORS.textMuted} />
            <Text style={styles.zLegendText}>WHO 2006 Child Growth Standards · Normal range: −2 to +2</Text>
          </View>
          {(latest.waz ?? 0) < -2 && (
            <AlertBanner icon="warning-outline" color={COLORS.missed} bg={COLORS.missedLight}
              text="WAZ below −2: visit the MCH clinic for nutritional assessment." />
          )}
          {(latest.whz ?? 0) < -2 && (
            <AlertBanner icon="alert-circle-outline" color="#C0392B" bg="#FDECEA"
              text={`WHZ ${(latest.whz ?? 0) < -3 ? 'below −3 (SAM)' : 'below −2 (MAM)'}: enrol in MCH supplementary feeding programme.`} />
          )}
        </>
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="stats-chart-outline" size={26} color={COLORS.textMuted} />
          <Text style={styles.emptyStateText}>No z-score data available</Text>
        </View>
      )}
    </SectionCard>
  );
}

function VaccinesSection({ vaccineRows }: { vaccineRows: VaccineRow[] }) {
  const given    = vaccineRows.filter(r => r.status === 'given').length;
  const missed   = vaccineRows.filter(r => r.status === 'missed').length;
  const due      = vaccineRows.filter(r => r.status === 'due').length;
  const upcoming = vaccineRows.filter(r => r.status === 'upcoming').length;
  const total    = vaccineRows.length;
  const coverage = total > 0 ? Math.round((given / total) * 100) : 0;

  return (
    <SectionCard title="KEPI Vaccine Coverage" icon="shield-checkmark-outline" accentColor={COLORS.given}>
      {total > 0 ? (
        <>
          <View style={styles.coverageLayout}>
            <CoverageRing pct={coverage} />
            <View style={styles.vacStats}>
              <VacStat label="Given"    value={given}    color={COLORS.given} />
              <VacStat label="Due now"  value={due}      color={COLORS.due} />
              <VacStat label="Missed"   value={missed}   color={COLORS.missed} />
              <VacStat label="Upcoming" value={upcoming} color={COLORS.upcoming} />
            </View>
          </View>
          {missed > 0 && (
            <AlertBanner icon="warning-outline" color={COLORS.missed} bg={COLORS.missedLight}
              text={`${missed} vaccine${missed > 1 ? 's' : ''} missed — visit your MCH clinic immediately.`} />
          )}
          {due > 0 && (
            <AlertBanner icon="time-outline" color={COLORS.due} bg={COLORS.dueLight}
              text={`${due} vaccine${due > 1 ? 's' : ''} due now — schedule your next MCH visit.`} />
          )}
          {coverage === 100 && (
            <AlertBanner icon="checkmark-circle-outline" color={COLORS.given} bg={COLORS.givenLight}
              text="All vaccines up to date. Excellent coverage!" />
          )}
        </>
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="shield-outline" size={26} color={COLORS.textMuted} />
          <Text style={styles.emptyStateText}>No vaccine data available</Text>
        </View>
      )}
    </SectionCard>
  );
}

function MilestonesSection({ records }: { records: MilestoneRecord[] }) {
  const achieved   = records.filter(r => r.status === 'achieved').length;
  const inProgress = records.filter(r => r.status === 'in_progress').length;
  const total      = MILESTONE_DATA.length;
  const pct        = total > 0 ? Math.round((achieved / total) * 100) : 0;

  // Group achieved milestones by age label for a compact summary
  const achievedIds = new Set(records.filter(r => r.status === 'achieved').map(r => r.milestone_id));
  const inProgressIds = new Set(records.filter(r => r.status === 'in_progress').map(r => r.milestone_id));

  const byAge: Record<string, { achieved: string[]; inProgress: string[] }> = {};
  MILESTONE_DATA.forEach(m => {
    if (!byAge[m.ageLabel]) byAge[m.ageLabel] = { achieved: [], inProgress: [] };
    if (achievedIds.has(m.id))   byAge[m.ageLabel].achieved.push(m.title);
    if (inProgressIds.has(m.id)) byAge[m.ageLabel].inProgress.push(m.title);
  });

  // Only show age groups that have at least one achieved or in-progress
  const activeGroups = Object.entries(byAge).filter(([, g]) => g.achieved.length > 0 || g.inProgress.length > 0);

  return (
    <SectionCard title="Developmental Milestones" icon="ribbon-outline" accentColor="#EA580C">
      {/* Summary bar */}
      <View style={styles.msSummaryRow}>
        <View style={[styles.msStatPill, { backgroundColor: COLORS.givenLight }]}>
          <Text style={[styles.msStatVal, { color: COLORS.given }]}>{achieved}</Text>
          <Text style={[styles.msStatLbl, { color: COLORS.given }]}>Achieved</Text>
        </View>
        <View style={[styles.msStatPill, { backgroundColor: COLORS.dueLight }]}>
          <Text style={[styles.msStatVal, { color: COLORS.due }]}>{inProgress}</Text>
          <Text style={[styles.msStatLbl, { color: COLORS.due }]}>In Progress</Text>
        </View>
        <View style={[styles.msStatPill, { backgroundColor: COLORS.surface }]}>
          <Text style={[styles.msStatVal, { color: COLORS.textMuted }]}>{total - achieved - inProgress}</Text>
          <Text style={[styles.msStatLbl, { color: COLORS.textMuted }]}>Not Yet</Text>
        </View>
        <View style={[styles.msStatPill, { backgroundColor: '#FFF7ED' }]}>
          <Text style={[styles.msStatVal, { color: '#EA580C' }]}>{pct}%</Text>
          <Text style={[styles.msStatLbl, { color: '#EA580C' }]}>Complete</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.msProgressTrack}>
        <View style={[styles.msProgressFill, { width: `${pct}%` as any }]} />
      </View>

      {activeGroups.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="ribbon-outline" size={26} color={COLORS.textMuted} />
          <Text style={styles.emptyStateText}>No milestones recorded yet</Text>
        </View>
      ) : (
        activeGroups.map(([ageLabel, group]) => (
          <View key={ageLabel} style={styles.msAgeGroup}>
            <View style={styles.msAgeHeader}>
              <View style={styles.msAgeBadge}>
                <Text style={styles.msAgeLabel}>{ageLabel}</Text>
              </View>
              <Text style={styles.msAgeCount}>
                {group.achieved.length} achieved{group.inProgress.length > 0 ? ` · ${group.inProgress.length} in progress` : ''}
              </Text>
            </View>
            {group.achieved.map(title => (
              <View key={title} style={styles.msItem}>
                <View style={[styles.msDot, { backgroundColor: COLORS.given }]} />
                <Text style={[styles.msItemText, { color: COLORS.textPrimary }]}>{title}</Text>
                <View style={[styles.msChip, { backgroundColor: COLORS.givenLight }]}>
                  <Text style={[styles.msChipText, { color: COLORS.given }]}>Achieved</Text>
                </View>
              </View>
            ))}
            {group.inProgress.map(title => (
              <View key={title} style={styles.msItem}>
                <View style={[styles.msDot, { backgroundColor: COLORS.due }]} />
                <Text style={[styles.msItemText, { color: COLORS.textSecondary }]}>{title}</Text>
                <View style={[styles.msChip, { backgroundColor: COLORS.dueLight }]}>
                  <Text style={[styles.msChipText, { color: COLORS.due }]}>In Progress</Text>
                </View>
              </View>
            ))}
          </View>
        ))
      )}

      <View style={styles.zLegend}>
        <Ionicons name="information-circle-outline" size={13} color={COLORS.textMuted} />
        <Text style={styles.zLegendText}>WHO Developmental Milestones · 0–5 years</Text>
      </View>
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF generator
// ─────────────────────────────────────────────────────────────────────────────

async function exportPDF(
  child: any,
  sections: ReportSection[],
  sorted: any[],
  vaccineRows: VaccineRow[],
  milestoneRecords: MilestoneRecord[],
) {
  if (!Print) {
    Alert.alert('PDF unavailable', 'Run: npx expo install expo-print expo-sharing');
    return;
  }
  const today    = new Date().toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' });
  const latest   = sorted[sorted.length - 1] ?? null;
  const given    = vaccineRows.filter(r => r.status === 'given').length;
  const missed   = vaccineRows.filter(r => r.status === 'missed').length;
  const due      = vaccineRows.filter(r => r.status === 'due').length;
  const upcoming = vaccineRows.filter(r => r.status === 'upcoming').length;
  const total    = vaccineRows.length;
  const coverage = total > 0 ? Math.round((given / total) * 100) : 0;

  const achieved   = milestoneRecords.filter(r => r.status === 'achieved').length;
  const inProgress = milestoneRecords.filter(r => r.status === 'in_progress').length;
  const mTotal     = MILESTONE_DATA.length;
  const mPct       = mTotal > 0 ? Math.round((achieved / mTotal) * 100) : 0;

  const waz = zInfo(latest?.waz ?? null);
  const haz = zInfo(latest?.haz ?? null);
  const whz = zInfo(latest?.whz ?? null);

  const growthRows = [...sorted].slice(-10).reverse().map(r => `
    <tr>
      <td>${new Date(r.date).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
      <td>${r.weight_kg != null ? r.weight_kg + ' kg' : '—'}</td>
      <td>${r.height_cm != null ? r.height_cm + ' cm' : '—'}</td>
      <td style="color:${zInfo(r.waz ?? null).color};font-weight:700">${r.waz != null ? r.waz.toFixed(2) : '—'}</td>
      <td style="color:${zInfo(r.haz ?? null).color};font-weight:700">${r.haz != null ? r.haz.toFixed(2) : '—'}</td>
    </tr>`).join('');

  const achievedIds    = new Set(milestoneRecords.filter(r => r.status === 'achieved').map(r => r.milestone_id));
  const inProgressIds  = new Set(milestoneRecords.filter(r => r.status === 'in_progress').map(r => r.milestone_id));
  const milestoneRows  = MILESTONE_DATA
    .filter(m => achievedIds.has(m.id) || inProgressIds.has(m.id))
    .map(m => {
      const isAch = achievedIds.has(m.id);
      return `<tr>
        <td>${m.ageLabel}</td>
        <td>${m.category}</td>
        <td>${m.title}</td>
        <td style="color:${isAch ? '#1D9E75' : '#BA7517'};font-weight:700">${isAch ? 'Achieved' : 'In Progress'}</td>
      </tr>`;
    }).join('');

  const sectionHtml = (key: ReportSection): string => {
    if (key === 'growth') return `
      <div class="section" style="border-top-color:#0284C7">
        <div class="section-title" style="color:#0284C7">&#128202; Growth history</div>
        ${latest
          ? `<div class="meta" style="margin-bottom:16px">
              <div class="meta-pill"><div class="val">${latest.weight_kg ?? '—'} kg</div><div class="lbl">Weight</div></div>
              <div class="meta-pill"><div class="val">${latest.height_cm ?? '—'} cm</div><div class="lbl">Height</div></div>
              <div class="meta-pill"><div class="val">${latest.age_months ?? '—'} mo</div><div class="lbl">Age at measure</div></div>
            </div>
            ${sorted.length > 0 ? `<table><tr><th>Date</th><th>Weight</th><th>Height</th><th>WAZ</th><th>HAZ</th></tr>${growthRows}</table>` : ''}
            ${sorted.length > 10 ? `<p style="font-size:10px;color:#718096;margin-top:8px">Showing 10 of ${sorted.length} records.</p>` : ''}`
          : '<p style="color:#718096">No growth records yet.</p>'}
      </div>`;

    if (key === 'zscores') return `
      <div class="section" style="border-top-color:#7C3AED">
        <div class="section-title" style="color:#7C3AED">&#128200; Nutritional status (WHO z-scores)</div>
        ${latest
          ? `<div class="z-grid">
              <div class="z-card" style="background:${waz.bg}"><div class="z-score" style="color:${waz.color}">${waz.short}</div><div class="z-name" style="color:${waz.color}">WAZ</div><div class="z-status" style="color:${waz.color}">${waz.label}</div><div class="z-desc" style="color:${waz.color}">Weight-for-Age</div></div>
              <div class="z-card" style="background:${haz.bg}"><div class="z-score" style="color:${haz.color}">${haz.short}</div><div class="z-name" style="color:${haz.color}">HAZ</div><div class="z-status" style="color:${haz.color}">${haz.label}</div><div class="z-desc" style="color:${haz.color}">Height-for-Age</div></div>
              <div class="z-card" style="background:${whz.bg}"><div class="z-score" style="color:${whz.color}">${whz.short}</div><div class="z-name" style="color:${whz.color}">WHZ</div><div class="z-status" style="color:${whz.color}">${whz.label}</div><div class="z-desc" style="color:${whz.color}">Wt-for-Height</div></div>
            </div>`
          : '<p style="color:#718096">No z-score data available.</p>'}
      </div>`;

    if (key === 'vaccines') return `
      <div class="section" style="border-top-color:#1D9E75">
        <div class="section-title" style="color:#1D9E75">&#128737; KEPI vaccine coverage</div>
        ${total > 0
          ? `<div class="cov">
              <div class="cov-ring" style="border-color:${coverage>=80?'#1D9E75':coverage>=50?'#BA7517':'#E24B4A'}2A">
                <div><div class="cov-pct" style="color:${coverage>=80?'#1D9E75':coverage>=50?'#BA7517':'#E24B4A'}">${coverage}%</div><div class="cov-label">covered</div></div>
              </div>
              <div style="flex:1">
                <div style="display:flex;justify-content:space-between;font-size:12px;margin:4px 0"><span style="color:#718096">Given</span><strong style="color:#1D9E75">${given}</strong></div>
                <div style="display:flex;justify-content:space-between;font-size:12px;margin:4px 0"><span style="color:#718096">Due now</span><strong style="color:#BA7517">${due}</strong></div>
                <div style="display:flex;justify-content:space-between;font-size:12px;margin:4px 0"><span style="color:#718096">Missed</span><strong style="color:#E24B4A">${missed}</strong></div>
                <div style="display:flex;justify-content:space-between;font-size:12px;margin:4px 0"><span style="color:#718096">Upcoming</span><strong style="color:#534AB7">${upcoming}</strong></div>
              </div>
            </div>
            ${missed > 0 ? `<div class="alert" style="background:#FCEBEB;color:#E24B4A;border-left-color:#E24B4A">&#9888; ${missed} vaccine${missed > 1 ? 's' : ''} missed.</div>` : ''}
            ${coverage === 100 ? `<div class="alert" style="background:#E1F5EE;color:#1D9E75;border-left-color:#1D9E75">&#10003; All vaccines up to date.</div>` : ''}`
          : '<p style="color:#718096">No vaccine data loaded.</p>'}
      </div>`;

    if (key === 'milestones') return `
      <div class="section" style="border-top-color:#EA580C">
        <div class="section-title" style="color:#EA580C">&#127881; Developmental milestones</div>
        <div class="meta" style="margin-bottom:16px">
          <div class="meta-pill"><div class="val" style="color:#1D9E75">${achieved}</div><div class="lbl">Achieved</div></div>
          <div class="meta-pill"><div class="val" style="color:#BA7517">${inProgress}</div><div class="lbl">In Progress</div></div>
          <div class="meta-pill"><div class="val" style="color:#EA580C">${mPct}%</div><div class="lbl">Complete</div></div>
          <div class="meta-pill"><div class="val">${mTotal - achieved - inProgress}</div><div class="lbl">Not Yet</div></div>
        </div>
        ${milestoneRows.length > 0
          ? `<table><tr><th>Age</th><th>Category</th><th>Milestone</th><th>Status</th></tr>${milestoneRows}</table>`
          : '<p style="color:#718096">No milestones recorded yet.</p>'}
      </div>`;

    return '';
  };

  const sectionLabel = sections.length === SECTION_CONFIG.length
    ? 'Full Report'
    : sections.map(s => SECTION_CONFIG.find(c => c.key === s)?.label).join(', ');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Helvetica Neue',Arial,sans-serif;background:#F7F9FC;color:#1A202C;font-size:13px}
.page{max-width:800px;margin:0 auto;padding:32px}
.header{background:#208AEF;color:#fff;padding:32px;border-radius:16px;margin-bottom:24px;position:relative;overflow:hidden}
.header::after{content:'';position:absolute;width:200px;height:200px;border-radius:50%;border:40px solid rgba(255,255,255,0.08);top:-60px;right:-60px}
.header h1{font-size:24px;font-weight:800;letter-spacing:-0.5px}
.header .sub{font-size:13px;opacity:0.8;margin-top:6px}
.header .badge{display:inline-block;background:rgba(255,255,255,0.2);border-radius:20px;padding:4px 14px;font-size:11px;margin-top:12px;border:1px solid rgba(255,255,255,0.3)}
.meta{display:flex;gap:12px;margin-bottom:24px}
.meta-pill{flex:1;background:#fff;border-radius:12px;padding:14px;text-align:center;border:1px solid #E2E8F0}
.meta-pill .val{font-size:20px;font-weight:800;color:#208AEF}
.meta-pill .lbl{font-size:10px;color:#718096;margin-top:3px;text-transform:uppercase;letter-spacing:0.5px}
.section{background:#fff;border-radius:14px;padding:20px;margin-bottom:18px;border:1px solid #E2E8F0;border-top:3px solid #208AEF}
.section-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid #EEF2FF}
.z-grid{display:flex;gap:10px}
.z-card{flex:1;border-radius:10px;padding:14px;text-align:center}
.z-score{font-size:22px;font-weight:800}
.z-name{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px}
.z-status{font-size:10px;font-weight:600;margin-top:2px}
.z-desc{font-size:9px;opacity:0.7;margin-top:2px}
table{width:100%;border-collapse:collapse;margin-top:8px}
th{background:#F7F9FC;color:#4A5568;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;padding:8px 10px;text-align:left;border-bottom:2px solid #E2E8F0}
td{padding:8px 10px;font-size:12px;border-bottom:1px solid #F7F9FC}
.cov{display:flex;align-items:center;gap:20px;margin-bottom:16px}
.cov-ring{width:80px;height:80px;border-radius:50%;border:10px solid;display:flex;align-items:center;justify-content:center}
.cov-pct{font-size:18px;font-weight:800;text-align:center}
.cov-label{font-size:9px;color:#718096;text-align:center}
.alert{display:flex;align-items:center;gap:8px;border-radius:10px;padding:10px 14px;margin-top:10px;font-size:12px;font-weight:600;border-left:3px solid}
.footer{text-align:center;padding:20px;font-size:10px;color:#A0AEC0;border-top:1px solid #E2E8F0;margin-top:8px}
</style></head><body><div class="page">
<div class="header">
  <h1>ZuriHealth Report</h1>
  <div class="sub">${child.full_name} &bull; ${today}</div>
  <span class="badge">${sectionLabel}</span>
</div>
${sections.map(sectionHtml).join('')}
<div class="footer">Generated by ZuriHealth &bull; Maternal &amp; Child Health &bull; ${today}</div>
</div></body></html>`;

  try {
    const result = await Print.printToFileAsync({ html, base64: false });
    if (result?.uri && Sharing) {
      const ok = await Sharing.isAvailableAsync();
      if (ok) await Sharing.shareAsync(result.uri, { mimeType: 'application/pdf', dialogTitle: `${child.full_name} – ${sectionLabel}` });
      else Alert.alert('PDF saved', result.uri);
    }
  } catch (e: any) {
    Alert.alert('Export failed', e?.message ?? 'Could not generate PDF.');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────

export default function ReportsScreen() {
  const router = useRouter();
  const { children, selectedChildId, growthRecords, fetchGrowthRecords } = useChildStore();
  const { vaccineRows, fetchSchedules, fetchImmunizations, computeRows }  = useVaccineStore();

  const child = children.find(c => c.id === selectedChildId) ?? children[0];

  const [selectedSections, setSelectedSections] = useState<Set<ReportSection>>(
    new Set(['growth', 'zscores', 'vaccines', 'milestones']),
  );
  const [milestoneRecords, setMilestoneRecords] = useState<MilestoneRecord[]>([]);
  const [milestonesLoading, setMilestonesLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!child?.id) return;
    fetchGrowthRecords(child.id);
    fetchSchedules().then(async () => {
      const imm = await fetchImmunizations(child.id);
      computeRows(child.date_of_birth, imm);
    });
    loadMilestones(child.id);
  }, [child?.id]);

  const loadMilestones = async (childId: string) => {
    setMilestonesLoading(true);
    try {
      const { data } = await supabase
        .from('child_milestones')
        .select('milestone_id, status, achieved_date')
        .eq('child_id', childId);
      setMilestoneRecords(data ?? []);
    } catch (e) {
      console.error('loadMilestones', e);
    } finally {
      setMilestonesLoading(false);
    }
  };

  const sorted = useMemo(
    () => [...growthRecords].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [growthRecords],
  );
  const latest = sorted[sorted.length - 1] ?? null;

  const toggleSection = (key: ReportSection) => {
    setSelectedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) { if (next.size > 1) next.delete(key); }
      else next.add(key);
      return next;
    });
  };

  const selectAll  = () => setSelectedSections(new Set(SECTION_CONFIG.map(s => s.key) as ReportSection[]));
  const isAllSelected = selectedSections.size === SECTION_CONFIG.length;

  // Ordered sections matching SECTION_CONFIG order
  const activeSections = SECTION_CONFIG.map(s => s.key).filter(k => selectedSections.has(k));

  const handleExport = async () => {
    setExporting(true);
    await exportPDF(child, activeSections, sorted, vaccineRows, milestoneRecords);
    setExporting(false);
  };

  if (!child) {
    return (
      <View style={styles.empty}>
        <View style={styles.emptyIcon}>
          <Ionicons name="document-text-outline" size={36} color={COLORS.textMuted} />
        </View>
        <Text style={styles.emptyTitle}>No child selected</Text>
        <Text style={styles.emptySub}>Select a child profile to view their health report.</Text>
      </View>
    );
  }

  const dobDate = child.date_of_birth ? new Date(child.date_of_birth) : null;

  return (
    <View style={styles.screen}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerDecor1} />
        <View style={styles.headerDecor2} />
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Health Report</Text>
            <Text style={styles.headerSub}>{child.full_name}</Text>
          </View>
          <TouchableOpacity
            onPress={handleExport}
            style={[styles.exportBtn, exporting && { opacity: 0.6 }]}
            disabled={exporting}
            activeOpacity={0.8}
          >
            {exporting
              ? <ActivityIndicator size="small" color="#fff" />
              : <><Ionicons name="share-outline" size={15} color="#fff" /><Text style={styles.exportBtnText}>PDF</Text></>}
          </TouchableOpacity>
        </View>

        <View style={styles.childStrip}>
          <View style={styles.childAvatar}>
            <Text style={styles.childAvatarText}>{(child.full_name?.[0] ?? '?').toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.childName}>{child.full_name}</Text>
            <Text style={styles.childAge}>
              {child.date_of_birth ? getAgeLabel(child.date_of_birth) + ' old' : 'Age unknown'}
              {dobDate ? `  ·  Born ${dobDate.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
            </Text>
          </View>
          <View style={styles.recordsBadge}>
            <Text style={styles.recordsNum}>{sorted.length}</Text>
            <Text style={styles.recordsLbl}>records</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Report type selector ── */}
        <Reveal delay={0}>
          <View style={styles.selectorCard}>
            <View style={styles.selectorHeader}>
              <View>
                <Text style={styles.selectorTitle}>Report type</Text>
                <Text style={styles.selectorSub}>
                  {isAllSelected ? 'Full report — all sections' : `${selectedSections.size} of ${SECTION_CONFIG.length} sections selected`}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.allBtn, isAllSelected && styles.allBtnActive]}
                onPress={selectAll}
              >
                <Text style={[styles.allBtnText, isAllSelected && styles.allBtnTextActive]}>
                  {isAllSelected ? 'Full report ✓' : 'Select all'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.sectionGrid}>
              {SECTION_CONFIG.map(sec => {
                const active = selectedSections.has(sec.key);
                return (
                  <TouchableOpacity
                    key={sec.key}
                    style={[
                      styles.sectionTile,
                      active && { borderColor: sec.accent, backgroundColor: sec.accent + '0D' },
                    ]}
                    onPress={() => toggleSection(sec.key)}
                    activeOpacity={0.8}
                  >
                    <View style={[
                      styles.sectionTileIcon,
                      { backgroundColor: active ? sec.accent + '20' : COLORS.surface },
                    ]}>
                      <Ionicons name={sec.icon as any} size={20} color={active ? sec.accent : COLORS.textMuted} />
                    </View>
                    <Text style={[styles.sectionTileLabel, active && { color: sec.accent }]}>
                      {sec.label}
                    </Text>
                    <Text style={styles.sectionTileDesc} numberOfLines={1}>{sec.description}</Text>
                    <View style={[
                      styles.sectionCheck,
                      active ? { backgroundColor: sec.accent, borderColor: sec.accent } : {},
                    ]}>
                      {active && <Ionicons name="checkmark" size={11} color="#fff" />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </Reveal>

        {/* ── Active sections ── */}
        {activeSections.includes('growth') && (
          <Reveal delay={60}>
            <GrowthSection sorted={sorted} />
          </Reveal>
        )}

        {activeSections.includes('zscores') && (
          <Reveal delay={120}>
            <ZScoresSection latest={latest} />
          </Reveal>
        )}

        {activeSections.includes('vaccines') && (
          <Reveal delay={180}>
            <VaccinesSection vaccineRows={vaccineRows} />
          </Reveal>
        )}

        {activeSections.includes('milestones') && (
          <Reveal delay={240}>
            {milestonesLoading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator color={COLORS.primary} />
                <Text style={styles.loadingText}>Loading milestones…</Text>
              </View>
            ) : (
              <MilestonesSection records={milestoneRecords} />
            )}
          </Reveal>
        )}

        {/* ── Export CTA ── */}
        <Reveal delay={300}>
          <TouchableOpacity
            style={[styles.exportCta, exporting && { opacity: 0.6 }]}
            onPress={handleExport}
            activeOpacity={0.82}
            disabled={exporting}
          >
            {exporting
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="document-text-outline" size={18} color="#fff" />}
            <Text style={styles.exportCtaText}>
              {exporting
                ? 'Generating PDF…'
                : isAllSelected
                  ? 'Export Full Report as PDF'
                  : `Export ${selectedSections.size} Section${selectedSections.size > 1 ? 's' : ''} as PDF`}
            </Text>
          </TouchableOpacity>
          <Text style={styles.footerNote}>
            ZuriHealth Report · WHO Growth Standards · Kenya KEPI Schedule
          </Text>
        </Reveal>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0F4FA' },

  // Header
  header: {
    backgroundColor: COLORS.primary,
    paddingTop: Platform.OS === 'ios' ? 56 : 44,
    paddingBottom: 20,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
    ...HEADER.shadow,
  },
  headerDecor1: { ...HEADER.decorCircle1 },
  headerDecor2: { ...HEADER.decorCircle2 },
  headerRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  headerBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontFamily: FONTS.extrabold, fontSize: 17, fontWeight: '800', color: '#fff' },
  headerSub:   { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  exportBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  childStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16, padding: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  childAvatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
  },
  childAvatarText: { fontFamily: FONTS.extrabold, fontSize: 18, fontWeight: '800', color: '#fff' },
  childName:  { fontFamily: FONTS.bold, fontSize: 14, fontWeight: '700', color: '#fff' },
  childAge:   { fontSize: 11, color: 'rgba(255,255,255,0.78)', marginTop: 2 },
  recordsBadge: {
    alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
  },
  recordsNum: { fontFamily: FONTS.extrabold, fontSize: 15, fontWeight: '800', color: '#fff' },
  recordsLbl: { fontSize: 9, color: 'rgba(255,255,255,0.75)', fontWeight: '600' },

  scroll: { padding: 16, paddingTop: 20, gap: 12 },

  // ── Selector card ──
  selectorCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  selectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  selectorTitle: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  selectorSub: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  allBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  allBtnActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  allBtnText: {
    fontFamily: FONTS.semibold,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  allBtnTextActive: {
    color: COLORS.primary,
  },
  sectionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sectionTile: {
    width: '47%',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    padding: 12,
    gap: 6,
    position: 'relative',
    backgroundColor: COLORS.white,
  },
  sectionTileIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  sectionTileLabel: {
    fontFamily: FONTS.semibold,
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  sectionTileDesc: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textMuted,
    lineHeight: 15,
  },
  sectionCheck: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },

  // ── Section card ──
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderTopWidth: 3,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  cardIconCircle: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  cardTitle: {
    fontFamily: FONTS.extrabold,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },

  // Measurements
  recordDate: { fontFamily: FONTS.regular, fontSize: 11, color: COLORS.textMuted, marginBottom: 12, fontStyle: 'italic' },
  measureRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  measureCard: {
    flex: 1, backgroundColor: COLORS.surface, borderRadius: 14,
    padding: 12, alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: COLORS.border,
  },
  measureIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  measureVal:  { fontFamily: FONTS.extrabold, fontSize: 15, fontWeight: '800', color: COLORS.textPrimary },
  measureLbl:  { fontSize: 9, color: COLORS.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  deltaBadge:  { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, marginTop: 2 },
  deltaText:   { fontSize: 10, fontWeight: '700' },

  // Table
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#EEF2FF',
    borderBottomWidth: 2,
    borderBottomColor: COLORS.border,
  },
  tableRow:     { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tableRowAlt:  { backgroundColor: COLORS.surface },
  tableCell:    { flex: 1, fontSize: 11, paddingHorizontal: 8, paddingVertical: 8, color: COLORS.textSecondary },
  tableHeadText:{ fontFamily: FONTS.bold, color: '#3730A3', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.3 },
  moreNote:     { fontSize: 10, color: COLORS.textMuted, textAlign: 'center', marginTop: 8, fontStyle: 'italic' },

  // Z-scores
  zRow:         { flexDirection: 'row', gap: 8 },
  zBadge:       { flex: 1, borderRadius: 14, padding: 12, alignItems: 'center', gap: 2 },
  zBadgeScore:  { fontFamily: FONTS.extrabold, fontSize: 18, fontWeight: '800' },
  zBadgeName:   { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  zBadgeStatus: { fontSize: 10, fontWeight: '600' },
  zBadgeDesc:   { fontSize: 8, textAlign: 'center', marginTop: 1 },
  zLegend: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginTop: 10, padding: 8,
    backgroundColor: COLORS.surface, borderRadius: 8,
  },
  zLegendText:  { fontFamily: FONTS.regular, fontSize: 10, color: COLORS.textMuted, flex: 1 },

  // Vaccines
  coverageLayout: { flexDirection: 'row', alignItems: 'center', gap: 20, marginBottom: 10 },
  ringTrack: {
    width: 86, height: 86, borderRadius: 43,
    borderWidth: 9, alignItems: 'center', justifyContent: 'center',
  },
  ringCenter:   { alignItems: 'center' },
  ringPct:      { fontFamily: FONTS.extrabold, fontSize: 17, fontWeight: '900' },
  ringLbl:      { fontSize: 8, color: COLORS.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  vacStats:     { flex: 1, gap: 8 },
  vacRow:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  vacDot:       { width: 8, height: 8, borderRadius: 4 },
  vacLabel:     { fontFamily: FONTS.regular, flex: 1, fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },
  vacValue:     { fontFamily: FONTS.extrabold, fontSize: 14, fontWeight: '800' },

  // Alert banner
  alertBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    borderRadius: 10, padding: 10, marginTop: 8, borderLeftWidth: 3,
  },
  alertText: { fontFamily: FONTS.semibold, fontSize: 12, fontWeight: '600', flex: 1, lineHeight: 18 },

  // Milestones
  msSummaryRow:    { flexDirection: 'row', gap: 8, marginBottom: 12 },
  msStatPill:      { flex: 1, borderRadius: 12, padding: 10, alignItems: 'center' },
  msStatVal:       { fontFamily: FONTS.extrabold, fontSize: 18, fontWeight: '800' },
  msStatLbl:       { fontFamily: FONTS.regular, fontSize: 9, marginTop: 2 },
  msProgressTrack: {
    height: 6, backgroundColor: COLORS.border,
    borderRadius: 3, overflow: 'hidden', marginBottom: 14,
  },
  msProgressFill:  { height: 6, backgroundColor: '#EA580C', borderRadius: 3 },
  msAgeGroup:      { marginBottom: 12 },
  msAgeHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  msAgeBadge:      {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  msAgeLabel:      { fontFamily: FONTS.bold, fontSize: 11, color: COLORS.textSecondary },
  msAgeCount:      { fontFamily: FONTS.regular, fontSize: 11, color: COLORS.textMuted },
  msItem:          {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 7, paddingHorizontal: 10,
    backgroundColor: COLORS.surface, borderRadius: 10,
    marginBottom: 5, borderWidth: 1, borderColor: COLORS.border,
  },
  msDot:           { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  msItemText:      { fontFamily: FONTS.regular, fontSize: 12, flex: 1, lineHeight: 17 },
  msChip:          {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  msChipText:      { fontFamily: FONTS.semibold, fontSize: 10 },

  // Export
  exportCta: {
    backgroundColor: COLORS.primary, borderRadius: 16,
    paddingVertical: 15, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 10,
    elevation: 6, shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8,
  },
  exportCtaText: { fontFamily: FONTS.extrabold, fontSize: 14, fontWeight: '800', color: '#fff' },
  footerNote: {
    textAlign: 'center', fontFamily: FONTS.regular,
    fontSize: 10, color: COLORS.textMuted, marginTop: 14, lineHeight: 16,
  },

  // Loading
  loadingWrap: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 24,
    backgroundColor: COLORS.white, borderRadius: 18,
    borderWidth: 1, borderColor: COLORS.border,
  },
  loadingText: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textMuted },

  // Empty
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32, backgroundColor: '#F0F4FA' },
  emptyIcon: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { fontFamily: FONTS.semibold, fontSize: 17, color: COLORS.textPrimary },
  emptySub:   { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },
  emptyState: { alignItems: 'center', gap: 8, paddingVertical: 14 },
  emptyStateText: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textMuted },
});