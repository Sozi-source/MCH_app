import { supabase } from '@/lib/supabase';
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
  recorded_at: string;
}

interface ChildState {
  children: Child[];
  selectedChildId: string | null;
  growthRecords: GrowthRecord[];
  fetchChildren: (parentId: string) => Promise<void>;
  addChild: (child: Omit<Child, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  selectChild: (id: string) => void;
  fetchGrowthRecords: (childId: string) => Promise<void>;
  addGrowthRecord: (record: Omit<GrowthRecord, 'id'>) => Promise<void>;
}

export const useChildStore = create<ChildState>((set) => ({
  children: [],
  selectedChildId: null,
  growthRecords: [],

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

    const { data } = await supabase
      .from('children')
      .select('*')
      .eq('parent_id', parentRow.id)
      .order('created_at', { ascending: false });
    if (data) set({ children: data as Child[] });
  },

  addChild: async (child) => {
    const { data } = await supabase
      .from('children')
      .insert(child)
      .select()
      .single();
    if (data) set((state) => ({ children: [data as Child, ...state.children] }));
  },

  selectChild: (id) => set({ selectedChildId: id, growthRecords: [] }),

  fetchGrowthRecords: async (childId) => {
    if (!childId || childId.trim() === '') return;
    const { data } = await supabase
      .from('growth_records')
      .select('*')
      .eq('child_id', childId)
      .order('recorded_at', { ascending: false });
    if (data) set({ growthRecords: data as GrowthRecord[] });
  },

  addGrowthRecord: async (record) => {
    const { data } = await supabase
      .from('growth_records')
      .insert(record)
      .select()
      .single();
    if (data) set((state) => ({ growthRecords: [data as GrowthRecord, ...state.growthRecords] }));
  },
}));