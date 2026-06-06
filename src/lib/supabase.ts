import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const supabaseUrl     = process.env.EXPO_PUBLIC_SUPABASE_URL      ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// SecureStore adapter — keys must be under 255 chars and URL-safe.
// Supabase uses long keys so we hash them to a safe format.
const ExpoSecureStoreAdapter = {
  getItem:    (key: string) => SecureStore.getItemAsync(sanitizeKey(key)),
  setItem:    (key: string, value: string) => SecureStore.setItemAsync(sanitizeKey(key), value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(sanitizeKey(key)),
};

// SecureStore keys must be alphanumeric + . - _ only, max 255 chars.
function sanitizeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9.\-_]/g, '_').slice(0, 255);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken:   true,
    persistSession:     true,
    detectSessionInUrl: Platform.OS === 'web',
    // Web: default localStorage. Native: SecureStore (encrypted).
    storage: Platform.OS === 'web' ? undefined : ExpoSecureStoreAdapter,
  },
});

// Silently handle token lifecycle events.
// SIGNED_OUT triggers navigation via authStore listener — no action needed here.
supabase.auth.onAuthStateChange((event) => {
  if (event === 'TOKEN_REFRESHED') return;
  if (event === 'SIGNED_OUT') return;
});