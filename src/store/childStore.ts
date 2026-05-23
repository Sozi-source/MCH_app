/**
 * src/store/childStore.ts
 *
 * NOTIFICATION UPGRADE:
 *  - addGrowthRecord now calls notifyGrowthAlerts() after saving
 *  - No other logic changed
 */

import { supabase } from '@/lib/supabase';
import { notifyGrowthAlerts } from '@/lib/notificationService';
import type { Child } from '@/types';
import { create } from 'zustand';

export interface GrowthRecord {
  id: string;
  child_id: string;
  weight_kg: number;
  height_cm: number | null;
  age_months: number;
  waz: number | null;
  haz: number | null;
  whz: number | null;
  date: string;
}

interface ChildState {
  children: Child[];
  selectedChildId: string | null;
  growthRecords: GrowthRecord[];
  fetchChildren:     (parentId: string) => Promise<void>;
  addChild:          (child: Omit<Child, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  selectChild:       (id: string) => void;
  fetchGrowthRecords:(childId: string) => Promise<void>;
  addGrowthRecord:   (record: Omit<GrowthRecord, 'id'>) => Promise<void>;
  updateGrowthRecord: (id: string, record: Partial<Omit<GrowthRecord, 'id'>>) => Promise<void>;
}

export const useChildStore = create<ChildState>((set, get) => ({
  children:        [],
  selectedChildId: null,
  growthRecords:   [],

  fetchChildren: async (parentId) => {
    if (!parentId || parentId.trim() === '') {
      console.warn('[childStore] fetchChildren called with empty parentId — skipping');
      return;
    }

    const { data: parentRow } = await supabase
      .from('parents')
      .select('id')
      .eq('auth_user_id', parentId)
      .single();
    if (!parentRow) return;

    // Fetch children where user is primary OR second parent
    const { data: primary } = await supabase
      .from('children')
      .select('*')
      .eq('parent_id', parentRow.id)
      .order('created_at', { ascending: false });

    const { data: secondary } = await supabase
      .from('children')
      .select('*')
      .eq('second_parent_id', parentRow.id)
      .order('created_at', { ascending: false });

    // Merge and deduplicate by id
    const all = [...(primary ?? []), ...(secondary ?? [])];
    const unique = all.filter((c, i, arr) => arr.findIndex(x => x.id === c.id) === i);
    set({ children: unique as Child[] });
      },

  addChild: async (child) => {
    const { data: parentRow, error: parentErr } = await supabase
      .from('parents')
      .select('id')
      .eq('auth_user_id', child.parent_id)
      .single();
    if (parentErr || !parentRow) {
      console.error('[childStore] addChild - parent lookup failed:', parentErr?.message);
      throw new Error('Parent profile not found. Please log out and log in again.');
    }
    const { data, error } = await supabase
      .from('children')
      .insert({ ...child, parent_id: parentRow.id })
      .select()
      .single();
    if (error) {
      console.error('[childStore] addChild - insert failed:', error.message);
      throw new Error(error.message);
    }
    if (data) set((state) => ({ children: [data as Child, ...state.children] }));
  },

  selectChild: (id) => set({ selectedChildId: id, growthRecords: [] }),

  fetchGrowthRecords: async (childId) => {
    const { data } = await supabase
      .from('growth_records')
      .select('*')
      .eq('child_id', childId)
      .order('created_at', { ascending: false });
    if (data) set({ growthRecords: data as GrowthRecord[] });
  },

  addGrowthRecord: async (record) => {
    const { data } = await supabase
      .from('growth_records')
      .insert(record)
      .select()
      .single();

    if (data) {
      const saved = data as GrowthRecord;
      set((state) => ({ growthRecords: [saved, ...state.growthRecords] }));

      // ── Fire growth alert notifications ──────────────────────────────────
      const { children, selectedChildId } = get();
      const child = children.find(c => c.id === record.child_id)
                 ?? children.find(c => c.id === selectedChildId);
      if (child) {
        // Non-blocking — don't await so UI is never delayed
        notifyGrowthAlerts(saved, child).catch(err =>
          console.warn('[childStore] notifyGrowthAlerts failed:', err),
        );
      }
    }
  },

  updateGrowthRecord: async (id, record) => {
    const { data } = await supabase
      .from('growth_records')
      .update(record)
      .eq('id', id)
      .select()
      .single();
    if (data) {
      const updated = data as GrowthRecord;
      set((state) => ({
        growthRecords: state.growthRecords.map(r => r.id === id ? updated : r),
      }));
    }
  },
}));
