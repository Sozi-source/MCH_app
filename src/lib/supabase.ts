import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl     = process.env.EXPO_PUBLIC_SUPABASE_URL     ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken:   true,
    persistSession:     true,
    detectSessionInUrl: Platform.OS === 'web',
    // On web: use localStorage via the default browser storage (no custom adapter needed).
    // On native: use AsyncStorage so sessions survive app restarts.
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
  },
});

// Handle invalid/expired refresh tokens silently — sign out so the app
// redirects to login instead of getting stuck in a broken auth state.
supabase.auth.onAuthStateChange((event) => {
  if (event === 'TOKEN_REFRESHED') return;
  if (event === 'SIGNED_OUT') return;
});