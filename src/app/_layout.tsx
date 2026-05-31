import '@/app/global.css';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useChildStore } from '@/store/childStore';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Image, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { COLORS } from '@/lib/theme';

const FAB_HIDDEN_SEGMENTS = ['(auth)', '(admin)'];
const FAB_HIDDEN_SCREENS  = ['chat', 'index', 'nutrition'];

function ZuriFAB() {
  const router = useRouter();
  const segments = useSegments();
  const currentGroup = segments[0] as string;
  const allSegments = segments as string[];
  const currentScreen = allSegments[1] ?? '';

  if (FAB_HIDDEN_SEGMENTS.includes(currentGroup)) return null;
  if (FAB_HIDDEN_SCREENS.includes(currentScreen)) return null;
  if (currentGroup === '(tabs)' && !currentScreen) return null

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
      if (event === 'PASSWORD_RECOVERY') {
        isRecovery.current = true;
        router.replace('/reset-password' as any);
        return;
      }
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