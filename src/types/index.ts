export type Sex      = 'male' | 'female';
export type Language = 'en' | 'sw';

export type GrowthStatus =
  | 'normal' | 'overweight' | 'obese' | 'mam' | 'sam'
  | 'stunted' | 'severely_stunted' | 'underweight' | 'tall';

export interface Child {
  id: string;
  parent_id: string;
  full_name: string;
  date_of_birth: string;
  sex: Sex;
  birth_weight_kg?: number;
  birth_height_cm?: number;
  health_facility?: string;
  child_number?: number;
  is_active?: boolean;
  created_at: string;
  updated_at?: string;
}

/**
 * Canonical growth record — matches the `growth_records` Supabase table.
 * Used by childStore (as GrowthRecord) and notificationService.
 *
 * NOTE: childStore re-exports this as GrowthRecord for backwards compat:
 *   export type { GrowthRecord } from '@/types';
 */
export interface GrowthRecord {
  id: string;
  child_id: string;
  date: string;           // ISO date string (recorded_at in older drafts)
  age_months: number;
  weight_kg: number;
  height_cm: number | null;
  head_circ_cm?: number | null;
  waz: number | null;
  haz: number | null;
  whz: number | null;
  weight_status?: GrowthStatus;
  height_status?: GrowthStatus;
  wh_status?: GrowthStatus;
  notes?: string | null;
}

/**
 * Canonical immunization record — matches the `immunizations` Supabase table.
 * "deferred" removed to match vaccineStore and DB constraint.
 * `notes` added to match vaccineStore's Immunization interface.
 */
export interface Immunization {
  id: string;
  child_id: string;
  vaccine_name: string;
  scheduled_date: string;
  given_date: string | null;
  batch_number: string | null;
  facility: string | null;
  status: 'scheduled' | 'given' | 'missed';
  notes: string | null;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}