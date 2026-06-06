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
// getSession() auto-refreshes an expired access token if the refresh
// token is still valid — so only sign out on a real auth failure.
supabase.auth.getSession().then(({ data, error }) => {
  if (error) {
    // Real auth error (e.g. refresh token revoked) — force login
    const code = (error as any)?.status ?? (error as any)?.code ?? '';
    const isAuthError = code === 400 || code === 401 ||
      error.message?.toLowerCase().includes('refresh_token') ||
      error.message?.toLowerCase().includes('invalid');
    if (isAuthError) {
      supabase.auth.signOut();
      useAuthStore.getState().setSession(null);
    }
  } else {
    // Could be null (never signed in) or a valid session
    useAuthStore.getState().setSession(data.session);
  }
}).catch(() => {
  // Network failure on startup — don't sign out, just hydrate
  // so the app doesn't hang; onAuthStateChange will sync later
}).finally(() => {
  useAuthStore.getState().setHydrated(true);
});

// Keep session in sync for the lifetime of the app
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

  if (!useAuthStore.getState().hydrated) {
    useAuthStore.getState().setHydrated(true);
  }
});