export type Sex = "male" | "female";
export type Language = "en" | "sw";

export type GrowthStatus =
  | "normal" | "overweight" | "obese" | "mam" | "sam"
  | "stunted" | "severely_stunted" | "underweight" | "tall";

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

export interface GrowthMeasurement {
  id: string;
  child_id: string;
  recorded_at: string;
  age_months: number;
  weight_kg: number;
  height_cm?: number;
  head_circ_cm?: number;
  waz?: number;
  haz?: number;
  whz?: number;
  weight_status?: GrowthStatus;
  height_status?: GrowthStatus;
  wh_status?: GrowthStatus;
  notes?: string;
}

export interface Immunization {
  id: string;
  child_id: string;
  vaccine_name: string;
  scheduled_date: string;
  given_date?: string;
  batch_number?: string;
  facility?: string;
  status: "scheduled" | "given" | "missed" | "deferred";
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}
