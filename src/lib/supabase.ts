import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl     = process.env.EXPO_PUBLIC_SUPABASE_URL     ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

const webStorage = {
  getItem:    (key: string) => Promise.resolve(typeof window !== 'undefined' ? localStorage.getItem(key) : null),
  setItem:    (key: string, value: string) => Promise.resolve(typeof window !== 'undefined' ? localStorage.setItem(key, value) : undefined),
  removeItem: (key: string) => Promise.resolve(typeof window !== 'undefined' ? localStorage.removeItem(key) : undefined),
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken:   true,
    persistSession:     true,
    detectSessionInUrl: Platform.OS === 'web',
    storage:            Platform.OS === 'web' ? webStorage : undefined,
  },
});

// Silently sign out if the stored refresh token is invalid or expired.
// Prevents the 'Refresh Token Not Found' error on app launch.
supabase.auth.onAuthStateChange((event) => {
  if (event === 'TOKEN_REFRESHED') return;
});

supabase.auth.getSession().then(({ error }) => {
  if (error?.message?.includes('Refresh Token Not Found') ||
      error?.message?.includes('Invalid Refresh Token')) {
    supabase.auth.signOut();
  }
});