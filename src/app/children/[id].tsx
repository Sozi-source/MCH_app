/**
 * src/app/children/[id].tsx
 * mamaTOTO — Child Detail Screen
 */
import { supabase } from '@/lib/supabase';
import { useT } from '@/hooks/useT';
import { COLORS, RADIUS } from '@/lib/theme';
import { useChildStore } from '@/store/childStore';
import { Child } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

function toTitleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
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
        <Text style={styles.headerTitle}>{toTitleCase(child.full_name)}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.avatarCard}>
          <View style={[styles.avatarCircle, child.sex === 'female' ? styles.avatarFemale : styles.avatarMale]}>
            <Ionicons name={child.sex === 'female' ? 'female' : 'male'} size={36}
              color={child.sex === 'female' ? COLORS.primary : '#185FA5'} />
          </View>
          <Text style={styles.avatarName}>{toTitleCase(child.full_name)}</Text>
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
              <View style={styles.errorBox}><Text style={styles.errorText}>{coParentError}</Text></View>
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