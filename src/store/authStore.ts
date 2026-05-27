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

// Bootstrap: restore session on app start, then keep it in sync.
// This runs once when the store module is first imported.
supabase.auth.getSession().then(({ data, error }) => {
  if (error || !data.session) {
    // Invalid/expired token — clear everything so the user goes to login
    supabase.auth.signOut();
    useAuthStore.getState().setSession(null);
  } else {
    useAuthStore.getState().setSession(data.session);
  }
  useAuthStore.getState().setHydrated(true);
});

supabase.auth.onAuthStateChange((event, session) => {
  switch (event) {
    case 'SIGNED_IN':
    case 'TOKEN_REFRESHED':
    case 'USER_UPDATED':
      useAuthStore.getState().setSession(session);
      break;

    case 'SIGNED_OUT':
      useAuthStore.getState().setSession(null);
      break;

    default:
      break;
  }

  // Mark hydrated after the first event regardless of type
  if (!useAuthStore.getState().hydrated) {
    useAuthStore.getState().setHydrated(true);
  }
});