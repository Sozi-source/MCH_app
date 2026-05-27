import '@/app/global.css';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useChildStore } from '@/store/childStore';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { COLORS } from '@/lib/theme';

// Screens where the FAB should NOT appear
const FAB_HIDDEN_SEGMENTS = ['(auth)', '(admin)'];

function ZuriFAB() {
  const router = useRouter();
  const segments = useSegments();
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

  useEffect(() => {
    // On web, the Supabase client needs to restore the session from storage
    // before auth.uid() works in RLS. We call getSession() which forces the
    // client to load and apply the stored token, then fetch children.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setHydrated(true);
      if (session?.user?.id) {
        fetchChildren(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session?.user?.id) {
        fetchChildren(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const inAuthGroup = (segments[0] as string) === '(auth)';
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
      </Stack>
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