# ─────────────────────────────────────────────────────────────────────────────
# apply-milestone-patch.ps1
# Run from: C:\Users\sozi\Desktop\2026-projects\mamaTOTO
# Usage:    .\apply-milestone-patch.ps1
# ─────────────────────────────────────────────────────────────────────────────

$root    = "C:\Users\sozi\Desktop\2026-projects\mamaTOTO"
$chatFile = "$root\src\app\(tabs)\chat.tsx"
$idFile   = "$root\src\app\children\[id].tsx"

# ── Helper: read, replace, write ─────────────────────────────────────────────
function Patch-File {
  param(
    [string]$Path,
    [string]$Find,
    [string]$Replace
  )
  $content = [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
  if (-not $content.Contains($Find)) {
    Write-Host "  [WARN] Could not find target text in: $Path" -ForegroundColor Yellow
    Write-Host "  Skipping this patch." -ForegroundColor Yellow
    return
  }
  $content = $content.Replace($Find, $Replace)
  [System.IO.File]::WriteAllText($Path, $content, [System.Text.Encoding]::UTF8)
  Write-Host "  [OK]" -ForegroundColor Green
}

# ─────────────────────────────────────────────────────────────────────────────
# PATCH 1 — chat.tsx: Add supabase import
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "`n[1/5] chat.tsx — Adding supabase import..."

Patch-File -Path $chatFile `
  -Find "import { getZScoreDisplay, getFeedingStage } from '@/lib/nutritionData';" `
  -Replace @"
import { getZScoreDisplay, getFeedingStage } from '@/lib/nutritionData';
import { supabase } from '@/lib/supabase';
"@

# ─────────────────────────────────────────────────────────────────────────────
# PATCH 2 — chat.tsx: Add milestone fields to ChildContext interface
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "`n[2/5] chat.tsx — Adding milestone fields to ChildContext..."

Patch-File -Path $chatFile `
  -Find @"
  feedingExtra: string;       // meals/day + food groups as a single formatted string

  language: string;
}"@ `
  -Replace @"
  feedingExtra: string;       // meals/day + food groups as a single formatted string

  // Milestones
  milestonesTotal: number;
  milestonesAchieved: number;
  milestonesInProgress: number;
  achievedMilestoneTitles: string[];
  inProgressMilestoneTitles: string[];

  language: string;
}"@

# ─────────────────────────────────────────────────────────────────────────────
# PATCH 3a — chat.tsx: Add milestoneSection builder inside buildSystemPrompt
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "`n[3/5] chat.tsx — Adding milestoneSection to buildSystemPrompt..."

Patch-File -Path $chatFile `
  -Find "  const birthInfo = [" `
  -Replace @"
  // Milestone section
  let milestoneSection = 'No milestone data recorded yet.';
  if (ctx.milestonesTotal > 0) {
    const pct = Math.round((ctx.milestonesAchieved / ctx.milestonesTotal) * 100);
    const achievedList   = ctx.achievedMilestoneTitles.length
      ? ctx.achievedMilestoneTitles.join(', ')
      : 'none recorded';
    const inProgressList = ctx.inProgressMilestoneTitles.length
      ? ctx.inProgressMilestoneTitles.join(', ')
      : 'none';
    milestoneSection = `Overall: ${ctx.milestonesAchieved}/${ctx.milestonesTotal} achieved (${pct}%)
  - In progress      : ${inProgressList}
  - Recently achieved: ${achievedList}`;
  }

  const birthInfo = [
"@

# ─────────────────────────────────────────────────────────────────────────────
# PATCH 3b — chat.tsx: Inject milestone section into system prompt string
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "`n[3b/5] chat.tsx — Injecting milestone section into system prompt..."

Patch-File -Path $chatFile `
  -Find @"
-- FEEDING STAGE --
Stage : `${ctx.feedingStageLabel}
`${ctx.feedingStageDescription}
`${ctx.feedingExtra}
"@ `
  -Replace @"
-- FEEDING STAGE --
Stage : `${ctx.feedingStageLabel}
`${ctx.feedingStageDescription}
`${ctx.feedingExtra}

-- DEVELOPMENTAL MILESTONES --
`${milestoneSection}
"@

# ─────────────────────────────────────────────────────────────────────────────
# PATCH 4 — chat.tsx: Replace useEffect with milestone fetch + update
#            buildChildContext return object
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "`n[4/5] chat.tsx — Expanding useEffect and buildChildContext..."

Patch-File -Path $chatFile `
  -Find @"
  useEffect(() => {
    if (!activeChild?.id) return;
    fetchGrowthRecords(activeChild.id);
    (async () => {
      if (schedules.length === 0) await fetchSchedules();
      const imms = await fetchImmunizations(activeChild.id);
      computeRows(activeChild.date_of_birth, imms);
    })();
  }, [activeChild?.id]);"@ `
  -Replace @"
  // -- Milestone state --
  const [milestoneData, setMilestoneData] = React.useState<{
    total: number;
    achieved: number;
    inProgress: number;
    achievedTitles: string[];
    inProgressTitles: string[];
  }>({ total: 0, achieved: 0, inProgress: 0, achievedTitles: [], inProgressTitles: [] });

  const MILESTONE_TITLES: Record<string, string> = {
    m_2_mot_1: 'Holds head up briefly',      m_2_lan_1: 'Makes cooing sounds',
    m_2_soc_1: 'Social smile',               m_2_cog_1: 'Follows object with eyes',
    m_4_mot_1: 'Holds head steady',          m_4_mot_2: 'Pushes up on arms',
    m_4_lan_1: 'Laughs and squeals',         m_4_soc_1: 'Recognises familiar faces',
    m_4_cog_1: 'Reaches for objects',        m_6_mot_1: 'Sits with support',
    m_6_mot_2: 'Rolls both ways',            m_6_lan_1: 'Babbles consonants',
    m_6_soc_1: 'Knows familiar vs strangers',m_6_cog_1: 'Explores with mouth & hands',
    m_9_mot_1: 'Sits without support',       m_9_mot_2: 'Crawls or scoots',
    m_9_lan_1: 'Says mama / dada',           m_9_soc_1: 'Plays peek-a-boo',
    m_9_cog_1: 'Object permanence',          m_12_mot_1: 'Pulls to stand',
    m_12_mot_2: 'Cruises along furniture',   m_12_lan_1: 'First words',
    m_12_soc_1: 'Waves bye-bye',             m_12_cog_1: 'Imitates actions',
    m_12_cog_2: 'Uses pincer grasp',         m_18_mot_1: 'Walks independently',
    m_18_mot_2: 'Climbs onto furniture',     m_18_lan_1: 'Uses 10-20 words',
    m_18_soc_1: 'Parallel play',             m_18_cog_1: 'Points to named body parts',
    m_24_mot_1: 'Runs steadily',             m_24_mot_2: 'Kicks a ball',
    m_24_lan_1: 'Two-word phrases',          m_24_lan_2: '50+ word vocabulary',
    m_24_soc_1: 'Plays with others briefly', m_24_cog_1: 'Sorts shapes and colours',
    m_24_cog_2: 'Simple pretend play',       m_36_mot_1: 'Jumps with both feet',
    m_36_mot_2: 'Climbs stairs alternating', m_36_lan_1: '3-word sentences',
    m_36_soc_1: 'Takes turns in games',      m_36_cog_1: 'Knows own name and age',
    m_36_cog_2: 'Draws a circle',            m_48_mot_1: 'Hops on one foot',
    m_48_mot_2: 'Catches a bounced ball',    m_48_lan_1: 'Tells simple stories',
    m_48_soc_1: 'Cooperative play',          m_48_cog_1: 'Counts to 10',
    m_48_cog_2: 'Draws a person',            m_60_mot_1: 'Skips and hops well',
    m_60_mot_2: 'Writes own name',           m_60_lan_1: 'Uses full sentences',
    m_60_lan_2: 'Asks why questions',        m_60_soc_1: 'Follows rules in games',
    m_60_cog_1: 'Counts to 20+',             m_60_cog_2: 'Knows letters of alphabet',
  };
  const TOTAL_MILESTONES = 54;

  useEffect(() => {
    if (!activeChild?.id) return;
    fetchGrowthRecords(activeChild.id);
    (async () => {
      if (schedules.length === 0) await fetchSchedules();
      const imms = await fetchImmunizations(activeChild.id);
      computeRows(activeChild.date_of_birth, imms);
    })();
    (async () => {
      try {
        const { data } = await supabase
          .from('child_milestones')
          .select('milestone_id, status')
          .eq('child_id', activeChild.id);
        const records = data ?? [];
        const achieved   = records.filter((r: any) => r.status === 'achieved');
        const inProgress = records.filter((r: any) => r.status === 'in_progress');
        setMilestoneData({
          total:            TOTAL_MILESTONES,
          achieved:         achieved.length,
          inProgress:       inProgress.length,
          achievedTitles:   achieved.slice(0, 10).map((r: any) => MILESTONE_TITLES[r.milestone_id] ?? r.milestone_id),
          inProgressTitles: inProgress.slice(0, 5).map((r: any)  => MILESTONE_TITLES[r.milestone_id] ?? r.milestone_id),
        });
      } catch (e) {
        console.warn('[chat] milestone fetch failed', e);
      }
    })();
  }, [activeChild?.id]);"@

# Update buildChildContext return object
Patch-File -Path $chatFile `
  -Find @"
      feedingExtra:            feedingParts.join('\n'),

      language,
    };
  };"@ `
  -Replace @"
      feedingExtra:            feedingParts.join('\n'),

      milestonesTotal:           milestoneData.total,
      milestonesAchieved:        milestoneData.achieved,
      milestonesInProgress:      milestoneData.inProgress,
      achievedMilestoneTitles:   milestoneData.achievedTitles,
      inProgressMilestoneTitles: milestoneData.inProgressTitles,

      language,
    };
  };"@

# ─────────────────────────────────────────────────────────────────────────────
# PATCH 5 — [id].tsx: Full file replacement
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "`n[5/5] children/[id].tsx — Writing full replacement file..."

$idContent = @'
import { supabase } from '@/lib/supabase';
import { useT } from '@/hooks/useT';
import { COLORS, RADIUS } from '@/lib/theme';
import { useChildStore } from '@/store/childStore';
import { Child } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon as any} size={18} color={COLORS.primary} style={styles.infoIcon} />
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function getAgeString(dob: string): string {
  const birth = new Date(dob);
  const now = new Date();
  const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (months < 1) return 'Less than 1 month';
  if (months < 24) return `${months} month${months !== 1 ? 's' : ''}`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem > 0 ? `${years} yr ${rem} mo` : `${years} year${years !== 1 ? 's' : ''}`;
}

interface MilestoneSummary {
  total: number;
  achieved: number;
  inProgress: number;
}

export default function ChildDetailScreen() {
  const t = useT();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { children, growthRecords, fetchGrowthRecords, selectChild, selectedChildId } = useChildStore();
  const [child, setChild] = useState<Child | null>(null);
  const [loadingGrowth, setLoadingGrowth] = useState(false);

  const [secondParentEmail, setSecondParentEmail] = useState('');
  const [secondParentName, setSecondParentName] = useState<string | null>(null);
  const [showCoParentModal, setShowCoParentModal] = useState(false);
  const [coParentEmail, setCoParentEmail] = useState('');
  const [coParentLoading, setCoParentLoading] = useState(false);
  const [coParentError, setCoParentError] = useState('');

  const [milestoneSummary, setMilestoneSummary] = useState<MilestoneSummary | null>(null);
  const [loadingMilestones, setLoadingMilestones] = useState(false);

  useEffect(() => {
    const found = children.find(c => c.id === id);
    if (found) {
      setChild(found);
      setLoadingGrowth(true);
      fetchGrowthRecords(found.id).finally(() => setLoadingGrowth(false));
      fetchSecondParent(found);
      fetchMilestoneSummary(found.id);
    }
  }, [id, children]);

  const fetchSecondParent = async (c: Child) => {
    const secondParentId = (c as any).second_parent_id;
    if (!secondParentId) return;
    const { data } = await supabase
      .from('parents')
      .select('full_name, email')
      .eq('id', secondParentId)
      .single();
    if (data) {
      setSecondParentName(data.full_name);
      setSecondParentEmail(data.email);
    }
  };

  const fetchMilestoneSummary = async (childId: string) => {
    setLoadingMilestones(true);
    try {
      const { data } = await supabase
        .from('child_milestones')
        .select('status')
        .eq('child_id', childId);
      const records = data ?? [];
      const TOTAL_MILESTONES = 54;
      const achieved   = records.filter((r: any) => r.status === 'achieved').length;
      const inProgress = records.filter((r: any) => r.status === 'in_progress').length;
      setMilestoneSummary({ total: TOTAL_MILESTONES, achieved, inProgress });
    } catch (e) {
      console.error('fetchMilestoneSummary error', e);
    } finally {
      setLoadingMilestones(false);
    }
  };

  const handleAddCoParent = async () => {
    setCoParentError('');
    if (!coParentEmail.trim()) { setCoParentError('Please enter an email address.'); return; }
    setCoParentLoading(true);
    const { data: parent2, error } = await supabase
      .rpc('find_parent_by_email', { search_email: coParentEmail.trim() })
      .single();
    if (error || !parent2) {
      setCoParentError('No account found with that email. They need to register first.');
      setCoParentLoading(false);
      return;
    }
    const { error: updateErr } = await supabase
      .from('children')
      .update({ second_parent_id: parent2.id })
      .eq('id', child!.id);
    setCoParentLoading(false);
    if (updateErr) {
      setCoParentError('Failed to add co-parent. Please try again.');
      return;
    }
    setSecondParentName(parent2.full_name);
    setSecondParentEmail(parent2.email);
    setShowCoParentModal(false);
    setCoParentEmail('');
    Alert.alert('Success', `${parent2.full_name} has been added as a co-parent.`);
  };

  const handleRemoveCoParent = () => {
    Alert.alert(
      'Remove Co-Parent',
      `Remove ${secondParentName} as co-parent? They will no longer have access to this child's data.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await supabase
              .from('children')
              .update({ second_parent_id: null })
              .eq('id', child!.id);
            setSecondParentName(null);
            setSecondParentEmail('');
          },
        },
      ]
    );
  };

  if (!child) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator color={COLORS.primary} size="large" />
    </View>
  );

  const isActive = selectedChildId === child.id;
  const latestGrowth = growthRecords[0];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace('/(tabs)/children' as any); } }}>
          <Ionicons name="arrow-back" size={24} color={COLORS.onPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{child.full_name}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.avatarCard}>
          <View style={[styles.avatarCircle, child.sex === 'female' ? styles.avatarFemale : styles.avatarMale]}>
            <Ionicons name={child.sex === 'female' ? 'female' : 'male'} size={36}
              color={child.sex === 'female' ? COLORS.primary : '#185FA5'} />
          </View>
          <Text style={styles.avatarName}>{child.full_name}</Text>
          <Text style={styles.avatarAge}>{getAgeString(child.date_of_birth)}</Text>
          {isActive ? (
            <View style={styles.activeBadge}>
              <Ionicons name="checkmark-circle" size={14} color={COLORS.onPrimary} />
              <Text style={styles.activeBadgeText}>Active</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.selectBtn} onPress={() => selectChild(child.id)}>
              <Text style={styles.selectBtnText}>Set as active child</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Child Details</Text>
          <InfoRow icon="calendar-outline" label="Date of Birth"
            value={new Date(child.date_of_birth).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })} />
          <InfoRow icon={child.sex === 'female' ? 'female-outline' : 'male-outline'} label="Sex"
            value={child.sex === 'female' ? 'Girl' : 'Boy'} />
          {child.birth_weight_kg && <InfoRow icon="scale-outline" label="Birth weight" value={`${child.birth_weight_kg} kg`} />}
          {child.birth_height_cm && <InfoRow icon="resize-outline" label="Birth height" value={`${child.birth_height_cm} cm`} />}
          {child.health_facility && <InfoRow icon="business-outline" label="Health facility" value={child.health_facility} />}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Co-Parent Access</Text>
          {secondParentName ? (
            <View>
              <View style={styles.coParentRow}>
                <View style={styles.coParentAvatar}>
                  <Text style={styles.coParentAvatarText}>{secondParentName[0].toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.coParentName}>{secondParentName}</Text>
                  <Text style={styles.coParentEmail}>{secondParentEmail}</Text>
                </View>
                <TouchableOpacity onPress={handleRemoveCoParent} style={styles.removeBtn}>
                  <Ionicons name="person-remove-outline" size={18} color="#E53935" />
                </TouchableOpacity>
              </View>
              <Text style={styles.coParentHint}>This parent can view and manage this child's health data.</Text>
            </View>
          ) : (
            <View>
              <Text style={styles.coParentHint}>Add a co-parent so both parents can access this child's health records.</Text>
              <TouchableOpacity style={styles.addCoParentBtn} onPress={() => setShowCoParentModal(true)}>
                <Ionicons name="person-add-outline" size={18} color={COLORS.primary} />
                <Text style={styles.addCoParentBtnText}>Add Co-Parent</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Growth Tracker</Text>
          {loadingGrowth ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 16 }} />
          ) : latestGrowth ? (
            <View style={styles.growthRow}>
              <View style={styles.growthStat}>
                <Text style={styles.growthValue}>{latestGrowth.weight_kg} kg</Text>
                <Text style={styles.growthLabel}>Weight</Text>
              </View>
              {latestGrowth.height_cm && (
                <View style={styles.growthStat}>
                  <Text style={styles.growthValue}>{latestGrowth.height_cm} cm</Text>
                  <Text style={styles.growthLabel}>Height</Text>
                </View>
              )}
              <View style={styles.growthStat}>
                <Text style={styles.growthValue}>{latestGrowth.age_months} mo</Text>
                <Text style={styles.growthLabel}>Age</Text>
              </View>
            </View>
          ) : (
            <Text style={styles.emptyText}>No records yet</Text>
          )}
          <TouchableOpacity style={styles.actionBtn}
            onPress={() => { selectChild(child.id); router.push('/(tabs)/growth' as any); }}>
            <Ionicons name="trending-up" size={16} color={COLORS.primary} />
            <Text style={styles.actionBtnText}>View growth records</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Developmental Milestones</Text>
          {loadingMilestones ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 16 }} />
          ) : milestoneSummary ? (
            <View>
              <View style={styles.milestoneRow}>
                <View style={styles.milestoneStat}>
                  <Text style={[styles.milestoneValue, { color: '#1D9E75' }]}>{milestoneSummary.achieved}</Text>
                  <Text style={styles.milestoneLabel}>Achieved</Text>
                </View>
                <View style={styles.milestoneStat}>
                  <Text style={[styles.milestoneValue, { color: COLORS.due }]}>{milestoneSummary.inProgress}</Text>
                  <Text style={styles.milestoneLabel}>In Progress</Text>
                </View>
                <View style={styles.milestoneStat}>
                  <Text style={[styles.milestoneValue, { color: COLORS.textPrimary }]}>{milestoneSummary.total}</Text>
                  <Text style={styles.milestoneLabel}>Total</Text>
                </View>
              </View>
              <View style={styles.milestoneBarBg}>
                <View style={[styles.milestoneBarFill, { width: `${Math.round((milestoneSummary.achieved / milestoneSummary.total) * 100)}%` as any }]} />
              </View>
              <Text style={styles.milestonePct}>{Math.round((milestoneSummary.achieved / milestoneSummary.total) * 100)}% complete</Text>
            </View>
          ) : (
            <Text style={styles.emptyText}>No milestone data yet</Text>
          )}
          <TouchableOpacity style={styles.actionBtn}
            onPress={() => { selectChild(child.id); router.push('/(tabs)/milestones' as any); }}>
            <Ionicons name="ribbon-outline" size={16} color={COLORS.primary} />
            <Text style={styles.actionBtnText}>View all milestones</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Quick Actions</Text>
          <TouchableOpacity style={styles.quickLink}
            onPress={() => { selectChild(child.id); router.push('/(tabs)/vaccines' as any); }}>
            <Ionicons name="shield-outline" size={20} color={COLORS.primary} />
            <Text style={styles.quickLinkText}>KEPI Schedule</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickLink}
            onPress={() => { selectChild(child.id); router.push('/(tabs)/milestones' as any); }}>
            <Ionicons name="ribbon-outline" size={20} color={COLORS.primary} />
            <Text style={styles.quickLinkText}>Milestones</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.quickLink, { borderBottomWidth: 0 }]}
            onPress={() => { selectChild(child.id); router.push('/(tabs)/chat' as any); }}>
            <Ionicons name="chatbubble-outline" size={20} color={COLORS.primary} />
            <Text style={styles.quickLinkText}>AI Chat</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={showCoParentModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Co-Parent</Text>
              <TouchableOpacity onPress={() => { setShowCoParentModal(false); setCoParentEmail(''); setCoParentError(''); }}>
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>
              Enter the email address of the other parent. They must already have an account.
            </Text>
            {coParentError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{coParentError}</Text>
              </View>
            ) : null}
            <Text style={styles.inputLabel}>Email address</Text>
            <TextInput
              style={styles.input}
              value={coParentEmail}
              onChangeText={setCoParentEmail}
              placeholder="parent@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity style={styles.modalBtn} onPress={handleAddCoParent} disabled={coParentLoading}>
              {coParentLoading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.modalBtnText}>Add Co-Parent</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: COLORS.background },
  loadingContainer:   { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  header:             { backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16 },
  headerTitle:        { fontSize: 20, fontWeight: '700', color: COLORS.onPrimary, flex: 1, textAlign: 'center' },
  scroll:             { padding: 16, paddingBottom: 40 },
  avatarCard:         { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 24, alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  avatarCircle:       { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarMale:         { backgroundColor: '#E6F1FB' },
  avatarFemale:       { backgroundColor: COLORS.primaryLight },
  avatarName:         { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary },
  avatarAge:          { fontSize: 14, color: COLORS.textSecondary, marginTop: 4, marginBottom: 12 },
  activeBadge:        { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full },
  activeBadgeText:    { color: COLORS.onPrimary, fontSize: 13, fontWeight: '700' },
  selectBtn:          { borderWidth: 1, borderColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.full },
  selectBtnText:      { color: COLORS.primary, fontSize: 13, fontWeight: '600' },
  card:               { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  cardTitle:          { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  infoRow:            { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  infoIcon:           { marginRight: 12, marginTop: 2 },
  infoLabel:          { fontSize: 11, color: COLORS.textMuted, fontWeight: '500', marginBottom: 2 },
  infoValue:          { fontSize: 14, color: COLORS.textPrimary, fontWeight: '600' },
  coParentRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  coParentAvatar:     { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  coParentAvatarText: { fontSize: 18, fontWeight: '800', color: COLORS.primary },
  coParentName:       { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  coParentEmail:      { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  coParentHint:       { fontSize: 12, color: COLORS.textMuted, marginBottom: 12 },
  removeBtn:          { padding: 8 },
  addCoParentBtn:     { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: COLORS.primary, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 10, alignSelf: 'flex-start' },
  addCoParentBtnText: { fontSize: 14, color: COLORS.primary, fontWeight: '600' },
  growthRow:          { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12 },
  growthStat:         { alignItems: 'center' },
  growthValue:        { fontSize: 20, fontWeight: '700', color: COLORS.primary },
  growthLabel:        { fontSize: 11, color: COLORS.textMuted, marginTop: 4 },
  milestoneRow:       { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12 },
  milestoneStat:      { alignItems: 'center' },
  milestoneValue:     { fontSize: 20, fontWeight: '700' },
  milestoneLabel:     { fontSize: 11, color: COLORS.textMuted, marginTop: 4 },
  milestoneBarBg:     { height: 6, backgroundColor: COLORS.border, borderRadius: 3, marginTop: 8, overflow: 'hidden' },
  milestoneBarFill:   { height: '100%', backgroundColor: '#1D9E75', borderRadius: 3 },
  milestonePct:       { fontSize: 11, color: COLORS.textMuted, marginTop: 6, textAlign: 'right' },
  emptyText:          { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', paddingVertical: 12 },
  actionBtn:          { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  actionBtnText:      { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  quickLink:          { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  quickLinkText:      { flex: 1, fontSize: 14, color: COLORS.textPrimary, fontWeight: '500' },
  modalOverlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard:          { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHeader:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  modalTitle:         { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  modalSubtitle:      { fontSize: 13, color: COLORS.textSecondary, marginBottom: 16 },
  inputLabel:         { fontSize: 13, fontWeight: '500', color: COLORS.textSecondary, marginBottom: 6 },
  input:              { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: 12, fontSize: 15, marginBottom: 16, color: COLORS.textPrimary, backgroundColor: COLORS.surface },
  modalBtn:           { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: 14, alignItems: 'center' },
  modalBtnText:       { color: COLORS.onPrimary, fontSize: 16, fontWeight: '600' },
  errorBox:           { backgroundColor: '#FCEBEB', borderRadius: RADIUS.md, padding: 10, marginBottom: 12 },
  errorText:          { color: '#A32D2D', fontSize: 13 },
});
'@

[System.IO.File]::WriteAllText($idFile, $idContent, [System.Text.Encoding]::UTF8)
Write-Host "  [OK]" -ForegroundColor Green

# ─────────────────────────────────────────────────────────────────────────────
Write-Host "`n✅ All patches applied successfully!" -ForegroundColor Cyan
Write-Host "   Run 'npx expo start' to test." -ForegroundColor Cyan
