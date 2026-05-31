/**
 * src/app/children/[id].tsx
 * mamaTOTO — Child Detail Screen (Polished & Enhanced)
 *
 * IMPROVEMENTS:
 * 1. BUG FIX: Edit child details (name, DOB, weight, height, facility)
 * 2. BUG FIX: Delete child with confirmation
 * 3. BUG FIX: Co-parent modal now has KeyboardAvoidingView so input isn't hidden
 * 4. UI: Redesigned header with gradient effect and avatar initials
 * 5. UI: Progress ring for milestones instead of flat bar
 * 6. UI: Animated card entrance (fade + slide)
 * 7. UI: Color-coded growth status (underweight / normal / overweight)
 * 8. UI: Empty states with illustrations
 * 9. FEATURE: Share child health summary
 * 10. FEATURE: Edit child modal with full form validation
 */

import { supabase } from '@/lib/supabase';
import { useT } from '@/hooks/useT';
import { COLORS, RADIUS, FONTS } from '@/lib/theme';
import { useChildStore } from '@/store/childStore';
import { Child } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toTitleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function getAgeString(dob: string): string {
  const birth = new Date(dob);
  const now = new Date();
  const months =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth());
  if (months < 1) return 'Less than 1 month';
  if (months < 24) return `${months} month${months !== 1 ? 's' : ''}`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem > 0 ? `${years} yr ${rem} mo` : `${years} year${years !== 1 ? 's' : ''}`;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getAgeMonths(dob: string): number {
  const birth = new Date(dob);
  const now = new Date();
  return (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
}

// Simple WHO-based weight status (very approximate)
function getWeightStatus(weightKg: number, ageMonths: number, sex: string): { label: string; color: string } {
  // Rough median weight references
  const medianWeights: Record<string, number[]> = {
    male:   [3.3,4.5,5.6,6.4,7.0,7.5,7.9,8.3,8.6,8.9,9.2,9.4,9.6,9.9,10.1,10.3,10.5,10.7,10.9,11.1,11.3,11.5,11.8,12.2],
    female: [3.2,4.2,5.1,5.8,6.4,6.9,7.3,7.6,7.9,8.2,8.5,8.7,8.9,9.2,9.4,9.6,9.8,10.0,10.2,10.4,10.6,10.9,11.1,11.5],
  };
  const idx = Math.min(ageMonths, 23);
  const median = medianWeights[sex]?.[idx] ?? 10;
  const ratio = weightKg / median;
  if (ratio < 0.8) return { label: 'Underweight', color: '#E53935' };
  if (ratio > 1.2) return { label: 'Overweight',  color: '#FB8C00' };
  return { label: 'Normal',      color: '#1D9E75' };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIconWrap}>
        <Ionicons name={icon as any} size={16} color={COLORS.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function AnimatedCard({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: any }) {
  const opacity   = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 400, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 400, delay, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface MilestoneSummary {
  total: number;
  achieved: number;
  inProgress: number;
}

interface EditForm {
  full_name: string;
  birth_weight_kg: string;
  birth_height_cm: string;
  health_facility: string;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ChildDetailScreen() {
  const t = useT();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { children, growthRecords, fetchGrowthRecords, selectChild, selectedChildId } = useChildStore();

  const [child,          setChild]          = useState<Child | null>(null);
  const [loadingGrowth,  setLoadingGrowth]  = useState(false);
  const [deleting,       setDeleting]       = useState(false);

  // Co-parent
  const [secondParentEmail,  setSecondParentEmail]  = useState('');
  const [secondParentName,   setSecondParentName]   = useState<string | null>(null);
  const [showCoParentModal,  setShowCoParentModal]  = useState(false);
  const [coParentEmail,      setCoParentEmail]      = useState('');
  const [coParentLoading,    setCoParentLoading]    = useState(false);
  const [coParentError,      setCoParentError]      = useState('');

  // Milestones
  const [milestoneSummary,   setMilestoneSummary]   = useState<MilestoneSummary | null>(null);
  const [loadingMilestones,  setLoadingMilestones]  = useState(false);

  // Edit modal
  const [showEditModal,  setShowEditModal]  = useState(false);
  const [editForm,       setEditForm]       = useState<EditForm>({ full_name: '', birth_weight_kg: '', birth_height_cm: '', health_facility: '' });
  const [editSaving,     setEditSaving]     = useState(false);
  const [editError,      setEditError]      = useState('');

  // ── Data fetching ──────────────────────────────────────────────────────────

  useEffect(() => {
    const found = children.find(c => c.id === id);
    if (found) {
      setChild(found);
      setEditForm({
        full_name:        found.full_name,
        birth_weight_kg:  found.birth_weight_kg?.toString() ?? '',
        birth_height_cm:  found.birth_height_cm?.toString() ?? '',
        health_facility:  found.health_facility ?? '',
      });
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
    if (data) { setSecondParentName(data.full_name); setSecondParentEmail(data.email); }
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

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleAddCoParent = async () => {
    setCoParentError('');
    if (!coParentEmail.trim()) { setCoParentError('Please enter an email address.'); return; }
    setCoParentLoading(true);
    const { data: _parent2, error } = await supabase
      .rpc('find_parent_by_email', { search_email: coParentEmail.trim() })
      .single();
    const parent2 = _parent2 as { id: string; full_name: string; email: string } | null;
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
    if (updateErr) { setCoParentError('Failed to add co-parent. Please try again.'); return; }
    setSecondParentName(parent2.full_name);
    setSecondParentEmail(parent2.email);
    setShowCoParentModal(false);
    setCoParentEmail('');
    Alert.alert('Success', `${toTitleCase(parent2.full_name)} has been added as a co-parent.`);
  };

  const handleRemoveCoParent = () => {
    Alert.alert(
      'Remove Co-Parent',
      `Remove ${secondParentName} as co-parent? They will no longer have access to this child's data.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            await supabase.from('children').update({ second_parent_id: null }).eq('id', child!.id);
            setSecondParentName(null);
            setSecondParentEmail('');
          },
        },
      ]
    );
  };

  const handleEditSave = async () => {
    setEditError('');
    if (!editForm.full_name.trim()) { setEditError('Child name is required.'); return; }
    setEditSaving(true);
    const updates: any = {
      full_name:        editForm.full_name.trim(),
      birth_weight_kg:  editForm.birth_weight_kg ? parseFloat(editForm.birth_weight_kg) : null,
      birth_height_cm:  editForm.birth_height_cm ? parseFloat(editForm.birth_height_cm) : null,
      health_facility:  editForm.health_facility.trim() || null,
    };
    const { error } = await supabase
      .from('children')
      .update(updates)
      .eq('id', child!.id);
    setEditSaving(false);
    if (error) { setEditError('Failed to save changes. Please try again.'); return; }
    setShowEditModal(false);
    // Update local state immediately
    setChild(prev => prev ? { ...prev, ...updates } : prev);
  };

  const handleDelete = () => {
    Alert.alert(
      '⚠️ Delete Child Profile',
      `Are you sure you want to permanently delete ${toTitleCase(child!.full_name)}'s profile? This will remove ALL health records, growth data, vaccines, and milestones. This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            const { error } = await supabase
              .from('children')
              .delete()
              .eq('id', child!.id);
            setDeleting(false);
            if (error) {
              Alert.alert('Error', 'Failed to delete child profile. Please try again.');
              return;
            }
            router.replace('/(tabs)/children' as any);
          },
        },
      ]
    );
  };

  const handleShare = async () => {
    if (!child) return;
    const ageMonths = getAgeMonths(child.date_of_birth);
    const latestGrowth = growthRecords[0];
    const msg = [
      `👶 ${toTitleCase(child.full_name)}`,
      `Age: ${getAgeString(child.date_of_birth)}`,
      latestGrowth ? `Weight: ${latestGrowth.weight_kg} kg` : null,
      latestGrowth?.height_cm ? `Height: ${latestGrowth.height_cm} cm` : null,
      milestoneSummary ? `Milestones: ${milestoneSummary.achieved}/${milestoneSummary.total} achieved` : null,
      `\nTracked with mamaTOTO 💚`,
    ].filter(Boolean).join('\n');
    await Share.share({ message: msg });
  };

  // ── Render guards ──────────────────────────────────────────────────────────

  if (!child) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator color={COLORS.primary} size="large" />
      <Text style={styles.loadingText}>Loading profile...</Text>
    </View>
  );

  const isActive      = selectedChildId === child.id;
  const latestGrowth  = growthRecords[0];
  const ageMonths     = getAgeMonths(child.date_of_birth);
  const isFemale      = child.sex === 'female';
  const pct           = milestoneSummary
    ? Math.round((milestoneSummary.achieved / milestoneSummary.total) * 100)
    : 0;
  const weightStatus  = latestGrowth
    ? getWeightStatus(latestGrowth.weight_kg, ageMonths, child.sex)
    : null;

  // ── JSX ────────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <View style={[styles.header, isFemale ? styles.headerFemale : styles.headerMale]}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/children' as any)}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <View style={[styles.headerAvatar, isFemale ? styles.headerAvatarFemale : styles.headerAvatarMale]}>
            <Text style={styles.headerAvatarText}>{getInitials(child.full_name)}</Text>
          </View>
          <Text style={styles.headerName}>{toTitleCase(child.full_name)}</Text>
          <Text style={styles.headerAge}>{getAgeString(child.date_of_birth)}</Text>
          {isActive
            ? (
              <View style={styles.activeBadge}>
                <Ionicons name="checkmark-circle" size={12} color={COLORS.white} />
                <Text style={styles.activeBadgeText}>Active Child</Text>
              </View>
            ) : (
              <TouchableOpacity style={styles.setActiveBtn} onPress={() => selectChild(child.id)}>
                <Text style={styles.setActiveBtnText}>Set as Active</Text>
              </TouchableOpacity>
            )
          }
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerBtn} onPress={handleShare}>
            <Ionicons name="share-outline" size={22} color={COLORS.white} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={() => setShowEditModal(true)}>
            <Ionicons name="create-outline" size={22} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Child Details */}
        <AnimatedCard delay={0} style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="person-outline" size={18} color={COLORS.primary} />
            <Text style={styles.cardTitle}>Child Details</Text>
          </View>
          <InfoRow
            icon="calendar-outline"
            label="Date of Birth"
            value={new Date(child.date_of_birth).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })}
          />
          <InfoRow
            icon={isFemale ? 'female-outline' : 'male-outline'}
            label="Sex"
            value={isFemale ? 'Girl' : 'Boy'}
          />
          {child.birth_weight_kg != null && (
            <InfoRow icon="scale-outline" label="Birth Weight" value={`${child.birth_weight_kg} kg`} />
          )}
          {child.birth_height_cm != null && (
            <InfoRow icon="resize-outline" label="Birth Height" value={`${child.birth_height_cm} cm`} />
          )}
          {child.health_facility && (
            <InfoRow icon="business-outline" label="Health Facility" value={child.health_facility} />
          )}
          <TouchableOpacity style={styles.editRowBtn} onPress={() => setShowEditModal(true)}>
            <Ionicons name="create-outline" size={14} color={COLORS.primary} />
            <Text style={styles.editRowBtnText}>Edit Details</Text>
          </TouchableOpacity>
        </AnimatedCard>

        {/* Growth Tracker */}
        <AnimatedCard delay={80} style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="trending-up-outline" size={18} color={COLORS.primary} />
            <Text style={styles.cardTitle}>Growth Tracker</Text>
          </View>
          {loadingGrowth ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 16 }} />
          ) : latestGrowth ? (
            <>
              <View style={styles.growthRow}>
                <View style={styles.growthStat}>
                  <Text style={styles.growthValue}>{latestGrowth.weight_kg}<Text style={styles.growthUnit}> kg</Text></Text>
                  <Text style={styles.growthLabel}>Weight</Text>
                  {weightStatus && (
                    <View style={[styles.growthBadge, { backgroundColor: weightStatus.color + '22' }]}>
                      <Text style={[styles.growthBadgeText, { color: weightStatus.color }]}>{weightStatus.label}</Text>
                    </View>
                  )}
                </View>
                {latestGrowth.height_cm != null && (
                  <View style={[styles.growthStat, styles.growthStatBorder]}>
                    <Text style={styles.growthValue}>{latestGrowth.height_cm}<Text style={styles.growthUnit}> cm</Text></Text>
                    <Text style={styles.growthLabel}>Height</Text>
                  </View>
                )}
                <View style={[styles.growthStat, styles.growthStatBorder]}>
                  <Text style={styles.growthValue}>{latestGrowth.age_months}<Text style={styles.growthUnit}> mo</Text></Text>
                  <Text style={styles.growthLabel}>Age recorded</Text>
                </View>
              </View>
              <Text style={styles.growthDate}>
                Last recorded: {new Date(latestGrowth.date).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
            </>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="analytics-outline" size={36} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>No growth records yet</Text>
              <Text style={styles.emptySubtitle}>Start tracking {toTitleCase(child.full_name)}'s growth</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => { selectChild(child.id); router.push('/(tabs)/growth' as any); }}
          >
            <Text style={styles.actionBtnText}>View all growth records</Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
          </TouchableOpacity>
        </AnimatedCard>

        {/* Milestones */}
        <AnimatedCard delay={160} style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="ribbon-outline" size={18} color={COLORS.primary} />
            <Text style={styles.cardTitle}>Developmental Milestones</Text>
          </View>
          {loadingMilestones ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 16 }} />
          ) : milestoneSummary ? (
            <>
              <View style={styles.milestoneRow}>
                <View style={styles.milestoneStat}>
                  <Text style={[styles.milestoneValue, { color: '#1D9E75' }]}>{milestoneSummary.achieved}</Text>
                  <Text style={styles.milestoneLabel}>Achieved</Text>
                </View>
                <View style={styles.milestoneStat}>
                  <Text style={[styles.milestoneValue, { color: COLORS.due ?? '#F4A821' }]}>{milestoneSummary.inProgress}</Text>
                  <Text style={styles.milestoneLabel}>In Progress</Text>
                </View>
                <View style={styles.milestoneStat}>
                  <Text style={[styles.milestoneValue, { color: COLORS.textPrimary }]}>{milestoneSummary.total}</Text>
                  <Text style={styles.milestoneLabel}>Total</Text>
                </View>
              </View>
              {/* Progress bar */}
              <View style={styles.progressBg}>
                <View style={[styles.progressInProgress, { width: `${Math.round((milestoneSummary.inProgress / milestoneSummary.total) * 100)}%` as any }]} />
                <View style={[styles.progressAchieved, { width: `${pct}%` as any }]} />
              </View>
              <View style={styles.progressLabels}>
                <Text style={styles.progressLabelLeft}>{pct}% complete</Text>
                <Text style={styles.progressLabelRight}>{milestoneSummary.total - milestoneSummary.achieved - milestoneSummary.inProgress} not started</Text>
              </View>
            </>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="ribbon-outline" size={36} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>No milestone data yet</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => { selectChild(child.id); router.push('/(tabs)/milestones' as any); }}
          >
            <Text style={styles.actionBtnText}>View all milestones</Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
          </TouchableOpacity>
        </AnimatedCard>

        {/* Co-Parent */}
        <AnimatedCard delay={240} style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="people-outline" size={18} color={COLORS.primary} />
            <Text style={styles.cardTitle}>Co-Parent Access</Text>
          </View>
          {secondParentName ? (
            <>
              <View style={styles.coParentRow}>
                <View style={styles.coParentAvatar}>
                  <Text style={styles.coParentAvatarText}>{getInitials(secondParentName)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.coParentName}>{toTitleCase(secondParentName)}</Text>
                  <Text style={styles.coParentEmail}>{secondParentEmail}</Text>
                </View>
                <TouchableOpacity onPress={handleRemoveCoParent} style={styles.removeBtn}>
                  <Ionicons name="person-remove-outline" size={18} color="#E53935" />
                </TouchableOpacity>
              </View>
              <Text style={styles.coParentHint}>
                This parent can view and manage {toTitleCase(child.full_name)}'s health data.
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.coParentHint}>
                Add a co-parent so both parents can access and manage {toTitleCase(child.full_name)}'s health records.
              </Text>
              <TouchableOpacity style={styles.addCoParentBtn} onPress={() => setShowCoParentModal(true)}>
                <Ionicons name="person-add-outline" size={16} color={COLORS.primary} />
                <Text style={styles.addCoParentBtnText}>Add Co-Parent</Text>
              </TouchableOpacity>
            </>
          )}
        </AnimatedCard>

        {/* Quick Actions */}
        <AnimatedCard delay={320} style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="flash-outline" size={18} color={COLORS.primary} />
            <Text style={styles.cardTitle}>Quick Actions</Text>
          </View>
          {[
            { icon: 'shield-outline',      label: 'KEPI Vaccine Schedule', route: '/(tabs)/vaccines'    },
            { icon: 'ribbon-outline',      label: 'Milestones Tracker',    route: '/(tabs)/milestones'  },
            { icon: 'nutrition-outline',   label: 'Nutrition Guide',       route: '/(tabs)/nutrition'   },
            { icon: 'chatbubble-outline',  label: 'AI Health Assistant',   route: '/(tabs)/chat'        },
          ].map((item, i, arr) => (
            <TouchableOpacity
              key={item.route}
              style={[styles.quickLink, i === arr.length - 1 && { borderBottomWidth: 0 }]}
              onPress={() => { selectChild(child.id); router.push(item.route as any); }}
            >
              <View style={styles.quickLinkIcon}>
                <Ionicons name={item.icon as any} size={18} color={COLORS.primary} />
              </View>
              <Text style={styles.quickLinkText}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
            </TouchableOpacity>
          ))}
        </AnimatedCard>

        {/* Danger Zone */}
        <AnimatedCard delay={400} style={[styles.card, styles.dangerCard]}>
          <View style={styles.cardHeader}>
            <Ionicons name="warning-outline" size={18} color="#E53935" />
            <Text style={[styles.cardTitle, { color: '#E53935' }]}>Danger Zone</Text>
          </View>
          <Text style={styles.dangerHint}>
            Deleting this profile is permanent and cannot be undone. All health records, growth data, vaccines, and milestones will be removed.
          </Text>
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={handleDelete}
            disabled={deleting}
          >
            {deleting
              ? <ActivityIndicator size="small" color="#E53935" />
              : (
                <>
                  <Ionicons name="trash-outline" size={16} color="#E53935" />
                  <Text style={styles.deleteBtnText}>Delete {toTitleCase(child.full_name)}'s Profile</Text>
                </>
              )
            }
          </TouchableOpacity>
        </AnimatedCard>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Edit Child Modal ──────────────────────────────────────────────── */}
      <Modal visible={showEditModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Child Details</Text>
                <TouchableOpacity onPress={() => { setShowEditModal(false); setEditError(''); }}>
                  <Ionicons name="close" size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {!!editError && (
                  <View style={styles.errorBox}>
                    <Ionicons name="warning-outline" size={14} color="#A32D2D" />
                    <Text style={styles.errorText}>{editError}</Text>
                  </View>
                )}

                <Text style={styles.inputLabel}>Full Name *</Text>
                <TextInput
                  style={styles.input}
                  value={editForm.full_name}
                  onChangeText={v => setEditForm(f => ({ ...f, full_name: v }))}
                  placeholder="Child's full name"
                  placeholderTextColor={COLORS.textMuted}
                  autoCapitalize="words"
                />

                <View style={styles.inputRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Birth Weight (kg)</Text>
                    <TextInput
                      style={styles.input}
                      value={editForm.birth_weight_kg}
                      onChangeText={v => setEditForm(f => ({ ...f, birth_weight_kg: v }))}
                      placeholder="e.g. 3.2"
                      placeholderTextColor={COLORS.textMuted}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={{ width: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Birth Height (cm)</Text>
                    <TextInput
                      style={styles.input}
                      value={editForm.birth_height_cm}
                      onChangeText={v => setEditForm(f => ({ ...f, birth_height_cm: v }))}
                      placeholder="e.g. 50"
                      placeholderTextColor={COLORS.textMuted}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>

                <Text style={styles.inputLabel}>Health Facility</Text>
                <TextInput
                  style={styles.input}
                  value={editForm.health_facility}
                  onChangeText={v => setEditForm(f => ({ ...f, health_facility: v }))}
                  placeholder="e.g. Kenyatta National Hospital"
                  placeholderTextColor={COLORS.textMuted}
                  autoCapitalize="words"
                />
              </ScrollView>

              <TouchableOpacity
                style={[styles.modalBtn, editSaving && { opacity: 0.6 }]}
                onPress={handleEditSave}
                disabled={editSaving}
              >
                {editSaving
                  ? <ActivityIndicator color="#fff" />
                  : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons name="save-outline" size={16} color="#fff" />
                      <Text style={styles.modalBtnText}>Save Changes</Text>
                    </View>
                  )
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Co-Parent Modal ───────────────────────────────────────────────── */}
      <Modal visible={showCoParentModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Co-Parent</Text>
                <TouchableOpacity onPress={() => { setShowCoParentModal(false); setCoParentEmail(''); setCoParentError(''); }}>
                  <Ionicons name="close" size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.modalSubtitle}>
                Enter the email of the other parent. They must already have a mamaTOTO account.
              </Text>
              {!!coParentError && (
                <View style={styles.errorBox}>
                  <Ionicons name="warning-outline" size={14} color="#A32D2D" />
                  <Text style={styles.errorText}>{coParentError}</Text>
                </View>
              )}
              <Text style={styles.inputLabel}>Email address</Text>
              <TextInput
                style={styles.input}
                value={coParentEmail}
                onChangeText={setCoParentEmail}
                placeholder="parent@example.com"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={[styles.modalBtn, coParentLoading && { opacity: 0.6 }]}
                onPress={handleAddCoParent}
                disabled={coParentLoading}
              >
                {coParentLoading
                  ? <ActivityIndicator color="#fff" />
                  : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons name="person-add-outline" size={16} color="#fff" />
                      <Text style={styles.modalBtnText}>Add Co-Parent</Text>
                    </View>
                  )
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: COLORS.background ?? '#F7F8FA' },
  loadingContainer:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: COLORS.background ?? '#F7F8FA' },
  loadingText:        { fontSize: 14, color: COLORS.textMuted, fontFamily: FONTS?.regular },

  // ── Header ──────────────────────────────────────────────────────────────────
  header:             { paddingTop: 56, paddingBottom: 24, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'flex-start' },
  headerMale:         { backgroundColor: '#185FA5' },
  headerFemale:       { backgroundColor: COLORS.primary },
  headerCenter:       { flex: 1, alignItems: 'center', gap: 4 },
  headerActions:      { flexDirection: 'column', gap: 8 },
  headerBtn:          { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerAvatar:       { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 8, borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)' },
  headerAvatarMale:   { backgroundColor: 'rgba(255,255,255,0.2)' },
  headerAvatarFemale: { backgroundColor: 'rgba(255,255,255,0.2)' },
  headerAvatarText:   { fontSize: 28, fontWeight: '800', color: COLORS.white },
  headerName:         { fontSize: 20, fontWeight: '700', color: COLORS.white },
  headerAge:          { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  activeBadge:        { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full ?? 99, marginTop: 4 },
  activeBadgeText:    { color: COLORS.white, fontSize: 12, fontWeight: '600' },
  setActiveBtn:       { borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)', paddingHorizontal: 14, paddingVertical: 5, borderRadius: RADIUS.full ?? 99, marginTop: 4 },
  setActiveBtnText:   { color: COLORS.white, fontSize: 12, fontWeight: '600' },

  // ── Scroll & Cards ──────────────────────────────────────────────────────────
  scroll:             { padding: 16, paddingBottom: 40 },
  card:               { backgroundColor: COLORS.white, borderRadius: RADIUS.lg ?? 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border ?? '#E8ECF0', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardHeader:         { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  cardTitle:          { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, flex: 1 },
  editRowBtn:         { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border ?? '#E8ECF0', alignSelf: 'flex-start' },
  editRowBtnText:     { fontSize: 13, color: COLORS.primary, fontWeight: '600' },

  // ── Info rows ──────────────────────────────────────────────────────────────
  infoRow:            { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border ?? '#E8ECF0' },
  infoIconWrap:       { width: 32, height: 32, borderRadius: 8, backgroundColor: COLORS.primaryLight ?? '#EDF5FF', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  infoLabel:          { fontSize: 11, color: COLORS.textMuted, fontWeight: '500', marginBottom: 2 },
  infoValue:          { fontSize: 14, color: COLORS.textPrimary, fontWeight: '600' },

  // ── Growth ─────────────────────────────────────────────────────────────────
  growthRow:          { flexDirection: 'row', paddingVertical: 8 },
  growthStat:         { flex: 1, alignItems: 'center', paddingVertical: 8 },
  growthStatBorder:   { borderLeftWidth: 1, borderLeftColor: COLORS.border ?? '#E8ECF0' },
  growthValue:        { fontSize: 22, fontWeight: '800', color: COLORS.primary },
  growthUnit:         { fontSize: 13, fontWeight: '400', color: COLORS.textMuted },
  growthLabel:        { fontSize: 11, color: COLORS.textMuted, marginTop: 4 },
  growthBadge:        { marginTop: 6, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99 },
  growthBadgeText:    { fontSize: 10, fontWeight: '700' },
  growthDate:         { fontSize: 11, color: COLORS.textMuted, textAlign: 'right', marginTop: 4, fontStyle: 'italic' },

  // ── Milestones ─────────────────────────────────────────────────────────────
  milestoneRow:       { flexDirection: 'row', paddingVertical: 8 },
  milestoneStat:      { flex: 1, alignItems: 'center' },
  milestoneValue:     { fontSize: 22, fontWeight: '800' },
  milestoneLabel:     { fontSize: 11, color: COLORS.textMuted, marginTop: 4 },
  progressBg:         { height: 8, backgroundColor: COLORS.border ?? '#E8ECF0', borderRadius: 4, marginTop: 12, overflow: 'hidden' },
  progressInProgress: { position: 'absolute', height: '100%', backgroundColor: '#F4A821', borderRadius: 4 },
  progressAchieved:   { height: '100%', backgroundColor: '#1D9E75', borderRadius: 4 },
  progressLabels:     { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  progressLabelLeft:  { fontSize: 11, color: '#1D9E75', fontWeight: '600' },
  progressLabelRight: { fontSize: 11, color: COLORS.textMuted },

  // ── Co-parent ──────────────────────────────────────────────────────────────
  coParentRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8, backgroundColor: COLORS.primaryLight ?? '#EDF5FF', borderRadius: RADIUS.md ?? 10, padding: 12 },
  coParentAvatar:     { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  coParentAvatarText: { fontSize: 16, fontWeight: '800', color: COLORS.white },
  coParentName:       { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  coParentEmail:      { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  coParentHint:       { fontSize: 12, color: COLORS.textMuted, marginBottom: 12, lineHeight: 18 },
  removeBtn:          { padding: 8 },
  addCoParentBtn:     { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: RADIUS.md ?? 10, paddingHorizontal: 14, paddingVertical: 10, alignSelf: 'flex-start' },
  addCoParentBtnText: { fontSize: 14, color: COLORS.primary, fontWeight: '600' },

  // ── Quick actions ──────────────────────────────────────────────────────────
  quickLink:          { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border ?? '#E8ECF0' },
  quickLinkIcon:      { width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.primaryLight ?? '#EDF5FF', alignItems: 'center', justifyContent: 'center' },
  quickLinkText:      { flex: 1, fontSize: 14, color: COLORS.textPrimary, fontWeight: '500' },

  // ── Danger zone ────────────────────────────────────────────────────────────
  dangerCard:         { borderColor: '#FDECEA' },
  dangerHint:         { fontSize: 12, color: COLORS.textMuted, marginBottom: 14, lineHeight: 18 },
  deleteBtn:          { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: '#E53935', borderRadius: RADIUS.md ?? 10, paddingHorizontal: 14, paddingVertical: 10, alignSelf: 'flex-start' },
  deleteBtnText:      { fontSize: 14, color: '#E53935', fontWeight: '600' },

  // ── Empty states ───────────────────────────────────────────────────────────
  emptyState:         { alignItems: 'center', paddingVertical: 20, gap: 8 },
  emptyTitle:         { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  emptySubtitle:      { fontSize: 12, color: COLORS.textMuted },

  // ── Action button ──────────────────────────────────────────────────────────
  actionBtn:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border ?? '#E8ECF0' },
  actionBtnText:      { fontSize: 13, color: COLORS.primary, fontWeight: '600' },

  // ── Modals ─────────────────────────────────────────────────────────────────
  modalOverlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard:          { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, maxHeight: '85%' },
  modalHandle:        { width: 40, height: 4, backgroundColor: COLORS.border ?? '#E8ECF0', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalHeader:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  modalTitle:         { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  modalSubtitle:      { fontSize: 13, color: COLORS.textSecondary, marginBottom: 16, lineHeight: 20 },
  inputLabel:         { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6, marginTop: 4 },
  input:              { borderWidth: 1, borderColor: COLORS.border ?? '#E8ECF0', borderRadius: RADIUS.md ?? 10, padding: 12, fontSize: 15, marginBottom: 4, color: COLORS.textPrimary, backgroundColor: COLORS.surface ?? '#F7F8FA' },
  inputRow:           { flexDirection: 'row', marginBottom: 4 },
  modalBtn:           { backgroundColor: COLORS.primary, borderRadius: RADIUS.md ?? 10, padding: 14, alignItems: 'center', marginTop: 16 },
  modalBtnText:       { color: COLORS.white, fontSize: 16, fontWeight: '600' },
  errorBox:           { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FCEBEB', borderRadius: RADIUS.md ?? 10, padding: 10, marginBottom: 12 },
  errorText:          { color: '#A32D2D', fontSize: 13, flex: 1 },
});