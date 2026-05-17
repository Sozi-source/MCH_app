// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl     = process.env.EXPO_PUBLIC_SUPABASE_URL     ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken:   true,
    persistSession:     true,
    detectSessionInUrl: false,
  },
});

// --- Children ---

export async function getChildren(parentId: string) {
  const { data, error } = await supabase
    .from('children').select('*')
    .eq('parent_id', parentId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function addChild(child: {
  parent_id: string; name: string; date_of_birth: string;
  sex: string; birth_weight_kg?: number; birth_length_cm?: number;
}) {
  const { data, error } = await supabase
    .from('children').insert(child).select().single();
  if (error) throw error;
  return data;
}

// --- Growth ---

export async function getGrowthMeasurements(childId: string) {
  const { data, error } = await supabase
    .from('growth_measurements').select('*')
    .eq('child_id', childId)
    .order('measured_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function addGrowthMeasurement(m: object) {
  const { data, error } = await supabase
    .from('growth_measurements').insert(m).select().single();
  if (error) throw error;
  return data;
}

// --- Immunizations ---

export async function getImmunizations(childId: string) {
  const { data, error } = await supabase
    .from('immunizations').select('*')
    .eq('child_id', childId)
    .order('scheduled_date', { ascending: true });
  if (error) throw error;
  return data;
}

export async function markVaccineGiven(
  id: string,
  givenDate: string,
  batchNumber?: string,
  facility?: string,
) {
  const { data, error } = await supabase
    .from('immunizations')
    .update({ given_date: givenDate, batch_number: batchNumber, facility, status: 'given' })
    .eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function insertImmunization(record: {
  child_id: string;
  vaccine_name: string;
  scheduled_date: string;
  given_date: string | null;
  facility: string | null;
  status: 'given' | 'missed' | 'scheduled';
}) {
  const { data, error } = await supabase
    .from('immunizations').insert(record).select().single();
  if (error) throw error;
  return data;
}

export async function markVaccineMissed(id: string) {
  const { data, error } = await supabase
    .from('immunizations')
    .update({ status: 'missed' })
    .eq('id', id).select().single();
  if (error) throw error;
  return data;
}