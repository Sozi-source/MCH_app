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