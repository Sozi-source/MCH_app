import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';

interface AuthState {
  session:     Session | null;
  user:        User | null;
  hydrated:    boolean;
  setSession:  (session: Session | null) => void;
  setHydrated: (v: boolean) => void;
  signOut:     () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  session:     null,
  user:        null,
  hydrated:    false,
  setSession:  (session) => set({ session, user: session?.user ?? null }),
  setHydrated: (v) => set({ hydrated: v }),
  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null });
  },
}));