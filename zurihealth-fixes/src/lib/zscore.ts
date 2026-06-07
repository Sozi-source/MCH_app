// src/lib/zscore.ts
// FIXED: No longer calls Groq API directly from client.
// All AI calls now go through Supabase Edge Functions (no API key in bundle).

import { supabase } from '@/lib/supabase';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

export interface ZScores {
  waz: number | null;
  haz: number | null;
  whz: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Z-score calculation via Edge Function
// ─────────────────────────────────────────────────────────────────────────────

export async function calculateZScores(
  weightKg: number,
  heightCm: number | null,
  ageMonths: number,
  sex: 'male' | 'female'
): Promise<ZScores> {
  try {
    const { data, error } = await supabase.functions.invoke('zuri-zscore', {
      body: { weightKg, heightCm, ageMonths, sex },
    });

    if (error || !data) {
      console.error('zuri-zscore error:', error);
      return { waz: null, haz: null, whz: null };
    }

    return {
      waz: typeof data.waz === 'number' ? data.waz : null,
      haz: typeof data.haz === 'number' ? data.haz : null,
      whz: typeof data.whz === 'number' ? data.whz : null,
    };
  } catch (e) {
    console.error('calculateZScores failed:', e);
    return { waz: null, haz: null, whz: null };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Generic meal/nutrition AI call via Edge Function
// (replaces the old askGroq() used in nutrition.tsx)
// ─────────────────────────────────────────────────────────────────────────────

export async function askGroq(
  userMessage: string,
  systemPrompt: string = 'You are a helpful maternal and child health assistant in Kenya.',
  temperature: number = 0.7
): Promise<string> {
  try {
    const { data, error } = await supabase.functions.invoke('zuri-meal', {
      body: { userMessage, systemPrompt, temperature },
    });

    if (error || !data) {
      console.error('zuri-meal error:', error);
      return '';
    }

    return data.reply ?? '';
  } catch (e) {
    console.error('askGroq (via edge function) failed:', e);
    return '';
  }
}
