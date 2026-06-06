import '@/app/global.css';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useChildStore } from '@/store/childStore';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Image, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { COLORS } from '@/lib/theme';

// Screens where the FAB must never appear
const FAB_HIDDEN_SCREENS = ['chat', 'index', 'nutrition'];

function ZuriFAB() {
  const router   = useRouter();
  const segments = useSegments() as string[];

  // Hide in auth and admin groups entirely
  if (segments[0] === '(auth)' || segments[0] === '(admin)') return null;

  // Hide on the tab bar home screen (no second segment)
  if (segments[0] === '(tabs)' && !segments[1]) return null;

  // Hide on any screen whose name appears in the list — check ALL segments
  const isHiddenScreen = segments.some(seg => FAB_HIDDEN_SCREENS.includes(seg));
  if (isHiddenScreen) return null;

  return (
    <TouchableOpacity
      style={styles.fab}
      onPress={() => router.push('/(tabs)/chat' as any)}
      activeOpacity={0.85}
    >
      <Image
        source={require('@/assets/features/zuri-ai-256.png')}
        style={styles.fabImage}
      />
    </TouchableOpacity>
  );
}

export default function RootLayout() {
  const { session, hydrated, setSession, setHydrated } = useAuthStore();
  const { fetchChildren } = useChildStore();
  const router   = useRouter();
  const segments = useSegments();
  const isRecovery = useRef(false);

  useEffect(() => {
    // 1. Hydrate existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setHydrated(true);
      if (session?.user?.id) fetchChildren(session.user.id);
    });

    // 2. Auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        isRecovery.current = true;
        setSession(session);
        router.replace('/reset-password' as any);
        return;
      }
      if (event === 'SIGNED_OUT') {
        isRecovery.current = false;
      }
      setSession(session);
      if (session?.user?.id) fetchChildren(session.user.id);
    });

    // 3. Parse token from deep link URL manually (Android cold start)
    const handleDeepLink = async (url: string) => {
      const fragment = url.split('#')[1] ?? '';
      const params   = Object.fromEntries(new URLSearchParams(fragment));
      if (params.type === 'recovery' && params.access_token && params.refresh_token) {
        isRecovery.current = true;
        const { error } = await supabase.auth.setSession({
          access_token:  params.access_token,
          refresh_token: params.refresh_token,
        });
        if (!error) router.replace('/reset-password' as any);
      }
    };

    Linking.getInitialURL().then(url => { if (url) handleDeepLink(url); });
    const linkSub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));

    return () => {
      subscription.unsubscribe();
      linkSub.remove();
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
    position:      'absolute',
    bottom:        Platform.OS === 'ios' ? 115 : 95,
    right:         20,
    width:         56,
    height:        56,
    borderRadius:  28,
    overflow:      'hidden',
    elevation:     6,
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius:  4,
    zIndex:        999,
  },
  fabImage: {
    width:        56,
    height:       56,
    borderRadius: 28,
    resizeMode:   'cover',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.white,
    alignItems:      'center',
    justifyContent:  'center',
    zIndex:          9999,
  },
});