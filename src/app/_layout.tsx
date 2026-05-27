import '@/app/global.css';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useChildStore } from '@/store/childStore';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { COLORS } from '@/lib/theme';

const FAB_HIDDEN_SEGMENTS = ['(auth)', '(admin)'];

function ZuriFAB() {
  const router = useRouter();
  const segments = useSegments();
  const isRecovery = useRef(false);
  const currentGroup = segments[0] as string;
  if (FAB_HIDDEN_SEGMENTS.includes(currentGroup)) return null;

  return (
    <TouchableOpacity
      style={styles.fab}
      onPress={() => router.push('/(tabs)/chat' as any)}
      activeOpacity={0.85}
    >
      <Ionicons name="chatbubble-ellipses" size={26} color="#fff" />
    </TouchableOpacity>
  );
}

export default function RootLayout() {
  const { session, hydrated, setSession, setHydrated } = useAuthStore();
  const { fetchChildren } = useChildStore();
  const router = useRouter();
  const segments = useSegments();
  const isRecovery = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setHydrated(true);
      if (session?.user?.id) {
        fetchChildren(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] event:', event);
      if (event === 'PASSWORD_RECOVERY') {
        // Mark recovery in progress so the auth guard does not redirect to tabs.
        // Do NOT call setSession here — that would trigger the guard.
        isRecovery.current = true;
        router.replace('/reset-password' as any);
        return;
      }
      // Once the user updates their password, reset-password.tsx calls signOut.
      // That fires SIGNED_OUT — clear the recovery flag so normal auth resumes.
      if (event === 'SIGNED_OUT') {
        isRecovery.current = false;
      }
      setSession(session);
      if (session?.user?.id) {
        fetchChildren(session.user.id);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const inAuthGroup     = (segments[0] as string) === '(auth)';
    const onResetPassword = (segments[0] as string) === 'reset-password';
    if (onResetPassword) return;
    if (isRecovery.current) return;
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login' as any);
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)' as any);
    }
  }, [session, hydrated, segments]);

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(admin)" />
        <Stack.Screen name="children" />
        <Stack.Screen name="reports" />
        <Stack.Screen name="reset-password" />
      </Stack>
      <ZuriFAB />

      {!hydrated && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position:        'absolute',
    bottom:          Platform.OS === 'ios' ? 100 : 80,
    right:           20,
    width:           56,
    height:          56,
    borderRadius:    28,
    backgroundColor: COLORS.primary,
    alignItems:      'center',
    justifyContent:  'center',
    elevation:       6,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 3 },
    shadowOpacity:   0.2,
    shadowRadius:    4,
    zIndex:          999,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.white,
    alignItems:      'center',
    justifyContent:  'center',
    zIndex:          9999,
  },
});