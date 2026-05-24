import '@/app/global.css';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useChildStore } from '@/store/childStore';
import { Ionicons } from '@expo/vector-icons';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { COLORS } from '@/lib/theme';
import { setupNotifications, registerTapHandler } from '@/lib/notificationService';

SplashScreen.preventAutoHideAsync();

// Screens where the FAB should NOT appear
const FAB_HIDDEN_SEGMENTS = ['(auth)', '(admin)'];
const FAB_HIDDEN_SCREENS  = ['chat', 'vaccines', 'milestones', 'growth', 'index'];

function ZuriFAB() {
  const router   = useRouter();
  const segments = useSegments();
  const segs     = segments as string[];
  const currentGroup  = segs[0] ?? '';
  const currentScreen = segs[1] ?? '';

  if (FAB_HIDDEN_SEGMENTS.includes(currentGroup))  return null;
  if (FAB_HIDDEN_SCREENS.includes(currentScreen))  return null;
  if (currentGroup === '(tabs)' && currentScreen === '') return null;

  return (
    <TouchableOpacity
      style={styles.fab}
      onPress={() => router.push('/(tabs)/chat' as any)}
      activeOpacity={0.85}
    >
      <Image source={require('@/assets/features/zuri-ai-256.png')} style={{ width: 44, height: 44, borderRadius: 22 }} />
    </TouchableOpacity>
  );
}

export default function RootLayout() {
  const { session, hydrated, setSession, setHydrated } = useAuthStore();
  const { fetchChildren } = useChildStore();
  const router   = useRouter();
  const segments = useSegments();

  const [fontTimeout, setFontTimeout] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFontTimeout(true), 3000);
    return () => clearTimeout(t);
  }, []);
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontTimeout) SplashScreen.hideAsync();
  }, [fontsLoaded, fontTimeout]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setHydrated(true);
      if (session?.user?.id) fetchChildren(session.user.id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user?.id) fetchChildren(session.user.id);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const segs        = segments as string[];
    const inAuthGroup = (segs[0] ?? '') === '(auth)';
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login' as any);
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)' as any);
    }
  }, [session, hydrated, segments]);

  // ── Notifications ──────────────────────────────────────────────────────────
  useEffect(() => {
    setupNotifications();
    const sub = registerTapHandler(router);
    return () => sub.remove();
  }, []);

  if (!fontsLoaded && !fontTimeout) return null;

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(admin)" />
        <Stack.Screen name="children" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="write-review" />
      </Stack>

      {/* Floating Zuri AI button — visible on all user screens */}
      <ZuriFAB />

      {/* Full-screen loading overlay while session hydrates */}
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
    position: 'absolute',
    bottom: Platform.OS === 'web' ? 76 : 158,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    elevation: 6,

    ...Platform.select({

      ios: { shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8 },

      android: { elevation: 6 },

      default: {},

    }),
    zIndex: 999,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});