# ============================================================
# mamaTOTO — Apply all 4 fixes
# Run from ANY directory — paths are absolute
# Usage: .\fix_mamatoto.ps1
# ============================================================

$base = "C:\Users\sozi\Desktop\2026-projects\mamaTOTO"

# ── Helper: write file with UTF-8 no BOM ────────────────────
function Write-UTF8 {
  param([string]$Path, [string]$Content)
  $dir = Split-Path $Path
  if (!(Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  [System.IO.File]::WriteAllText($Path, $Content, [System.Text.UTF8Encoding]::new($false))
  Write-Host "  UPDATED: $Path" -ForegroundColor Green
}

# ============================================================
# FIX 1 — app.json: imageWidth 100 → 250
# ============================================================
Write-Host "`n[1/4] Fixing app.json splash imageWidth..." -ForegroundColor Cyan

$appJsonPath = "$base\app.json"
$appJson = @'
{
  "expo": {
    "name": "ZuriHealth",
    "slug": "mamaTOTO",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/images/icon.png",
    "scheme": "motherandchild",
    "userInterfaceStyle": "automatic",
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/images/icon.png",
        "backgroundColor": "#E6F4FE"
      },
      "predictiveBackGestureEnabled": false,
      "package": "com.sozi.mamaTOTO"
    },
    "web": {
      "output": "static",
      "favicon": "./assets/images/icon.png"
    },
    "plugins": [
      [
        "expo-router",
        {
          "root": "src/app"
        }
      ],
      [
        "expo-splash-screen",
        {
          "backgroundColor": "#208AEF",
          "image": "./assets/images/icon.png",
          "imageWidth": 250
        }
      ],
      "expo-secure-store",
      [
        "expo-notifications",
        {
          "icon": "./assets/images/icon.png",
          "color": "#2A9D6E",
          "defaultChannel": "mamatoto-urgent",
          "enableBackgroundRemoteNotifications": false
        }
      ],
      "expo-sharing",
      "expo-font"
    ],
    "experiments": {
      "typedRoutes": false,
      "reactCompiler": true
    },
    "extra": {
      "eas": {
        "projectId": "26fd1a97-b4cb-421b-99d7-24428a1d0fe6"
      }
    }
  }
}
'@
Write-UTF8 -Path $appJsonPath -Content $appJson

# ============================================================
# FIX 2 — src/app/(tabs)/_layout.tsx: add hidden screens for
#          reviews and write-review
# ============================================================
Write-Host "`n[2/4] Fixing (tabs)/_layout.tsx — adding hidden screens..." -ForegroundColor Cyan

$tabsLayoutPath = "$base\src\app\(tabs)\_layout.tsx"
$tabsLayout = @'
import { COLORS } from '@/lib/theme';
import { Tabs } from 'expo-router';
import { Image, Platform } from 'react-native';

const tabs: {
  name: string;
  title: string;
  active: any;
  inactive: any;
}[] = [
  {
    name: 'index',
    title: 'Home',
    active:   require('@/assets/tabs/tab-home-active.png'),
    inactive: require('@/assets/tabs/tab-home-inactive.png'),
  },
  {
    name: 'children',
    title: 'Children',
    active:   require('@/assets/tabs/tab-children-active.png'),
    inactive: require('@/assets/tabs/tab-children-inactive.png'),
  },
  {
    name: 'growth',
    title: 'Growth',
    active:   require('@/assets/tabs/tab-growth-active.png'),
    inactive: require('@/assets/tabs/tab-growth-inactive.png'),
  },
  {
    name: 'vaccines',
    title: 'Vaccines',
    active:   require('@/assets/tabs/tab-vaccines-active.png'),
    inactive: require('@/assets/tabs/tab-vaccines-inactive.png'),
  },
  {
    name: 'milestones',
    title: 'Progress',
    active:   require('@/assets/tabs/tab-progress-active.png'),
    inactive: require('@/assets/tabs/tab-progress-inactive.png'),
  },
];

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: Platform.OS === 'web' ? {
          backgroundColor: COLORS.white,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          paddingBottom: 8,
          paddingTop: 6,
          height: 60,
        } : {
          backgroundColor: COLORS.white,
          borderTopColor: 'transparent',
          borderTopWidth: 0,
          paddingBottom: 10,
          paddingTop: 10,
          height: 90,
          marginBottom: 20,
          marginHorizontal: 16,
          borderRadius: 24,
          position: 'absolute',
          bottom: 0,
          elevation: 12,
          ...Platform.select({
            ios: { shadowColor: '#208AEF', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 16 },
            android: { elevation: 13 },
            default: {},
          }),
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          marginTop: 3,
          letterSpacing: 0.2,
        },
        tabBarItemStyle: {
          paddingVertical: 4,
        },
      }}
    >
      {tabs.map(t => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarIcon: ({ focused }) => (
              <Image
                source={focused ? t.active : t.inactive}
                style={{ width: 28, height: 28, resizeMode: 'contain' }}
              />
            ),
          }}
        />
      ))}

      {/* Hidden screens — routable but not shown in tab bar */}
      <Tabs.Screen name="chat"         options={{ href: null }} />
      <Tabs.Screen name="settings"     options={{ href: null }} />
      <Tabs.Screen name="nutrition"    options={{ href: null }} />
      <Tabs.Screen name="reviews"      options={{ href: null }} />
      <Tabs.Screen name="write-review" options={{ href: null }} />
    </Tabs>
  );
}
'@
Write-UTF8 -Path $tabsLayoutPath -Content $tabsLayout

# ============================================================
# FIX 3 — src/store/reviewStore.ts: fix auth_user_id column
# ============================================================
Write-Host "`n[3/4] Fixing reviewStore.ts — auth_user_id column..." -ForegroundColor Cyan

$reviewStorePath = "$base\src\store\reviewStore.ts"
$reviewStore = @'
/**
 * src/store/reviewStore.ts
 * mamaTOTO — App Reviews & Ratings store
 */
import { supabase } from '@/lib/supabase';
import { create } from 'zustand';

export interface AppReview {
  id: string;
  user_id: string;
  rating: number;
  title: string | null;
  body: string | null;
  is_verified: boolean;
  helpful_count: number;
  created_at: string;
  updated_at?: string;
  display_name?: string;
}

interface ReviewStore {
  reviews: AppReview[];
  myReview: AppReview | null;
  myHelpfulVotes: Set<string>;
  loading: boolean;
  submitting: boolean;
  error: string | null;

  // Computed
  averageRating: number;
  ratingBreakdown: Record<1 | 2 | 3 | 4 | 5, number>;

  fetchReviews: () => Promise<void>;
  fetchMyReview: (userId: string) => Promise<void>;
  fetchMyHelpfulVotes: (userId: string) => Promise<void>;
  submitReview: (
    userId: string,
    rating: number,
    title: string,
    body: string
  ) => Promise<{ error: string | null }>;
  deleteMyReview: (userId: string) => Promise<{ error: string | null }>;
  toggleHelpful: (reviewId: string, userId: string) => Promise<void>;
  shouldShowPrompt: (userId: string) => Promise<boolean>;
  markPromptShown: (userId: string, action: string) => Promise<void>;
}

export const useReviewStore = create<ReviewStore>((set, get) => ({
  reviews: [],
  myReview: null,
  myHelpfulVotes: new Set(),
  loading: false,
  submitting: false,
  error: null,
  averageRating: 0,
  ratingBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },

  // ─── Fetch all reviews ──────────────────────────────────────────────────────
  fetchReviews: async () => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('app_reviews')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const reviews = (data ?? []) as AppReview[];

      const breakdown: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      let total = 0;
      reviews.forEach(r => {
        breakdown[r.rating] = (breakdown[r.rating] ?? 0) + 1;
        total += r.rating;
      });
      const avg = reviews.length > 0 ? total / reviews.length : 0;

      set({
        reviews,
        averageRating: Math.round(avg * 10) / 10,
        ratingBreakdown: breakdown as Record<1 | 2 | 3 | 4 | 5, number>,
        loading: false,
      });
    } catch (e: any) {
      console.error('[fetchReviews]', e.message);
      set({ loading: false, error: e.message });
    }
  },

  // ─── Fetch current user's review ────────────────────────────────────────────
  fetchMyReview: async (userId) => {
    try {
      const { data, error } = await supabase
        .from('app_reviews')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      set({ myReview: data as AppReview | null });
    } catch (e: any) {
      console.error('[fetchMyReview]', e.message);
    }
  },

  // ─── Fetch which reviews the user has marked helpful ────────────────────────
  fetchMyHelpfulVotes: async (userId) => {
    try {
      const { data, error } = await supabase
        .from('review_helpful_votes')
        .select('review_id')
        .eq('user_id', userId);

      if (error) throw error;
      const ids = new Set<string>((data ?? []).map((r: any) => r.review_id as string));
      set({ myHelpfulVotes: ids });
    } catch (e: any) {
      console.error('[fetchMyHelpfulVotes]', e.message);
    }
  },

  // ─── Submit (insert or update) a review ─────────────────────────────────────
  submitReview: async (userId, rating, title, body) => {
    set({ submitting: true, error: null });
    try {
      // FIX: parents table uses auth_user_id, not user_id
      const { data: profile } = await supabase
        .from('parents')
        .select('full_name')
        .eq('auth_user_id', userId)
        .maybeSingle();

      const displayName: string = profile?.full_name ?? 'Anonymous';

      const existing = get().myReview;

      if (existing) {
        // UPDATE existing review
        const { error } = await supabase
          .from('app_reviews')
          .update({
            rating,
            title: title || null,
            body: body || null,
            display_name: displayName,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .eq('user_id', userId);

        if (error) throw error;
      } else {
        // INSERT new review
        const { error } = await supabase
          .from('app_reviews')
          .insert({
            user_id: userId,
            rating,
            title: title || null,
            body: body || null,
            display_name: displayName,
          });

        if (error) throw error;
      }

      await get().fetchReviews();
      await get().fetchMyReview(userId);

      set({ submitting: false });
      return { error: null };
    } catch (e: any) {
      console.error('[submitReview]', e.message);
      set({ submitting: false, error: e.message });
      return { error: e.message };
    }
  },

  // ─── Delete current user's review ───────────────────────────────────────────
  deleteMyReview: async (userId) => {
    const existing = get().myReview;
    if (!existing) return { error: null };

    try {
      const { error } = await supabase
        .from('app_reviews')
        .delete()
        .eq('id', existing.id)
        .eq('user_id', userId);

      if (error) throw error;

      set({ myReview: null });
      await get().fetchReviews();
      return { error: null };
    } catch (e: any) {
      console.error('[deleteMyReview]', e.message);
      return { error: e.message };
    }
  },

  // ─── Toggle helpful vote (optimistic update + rollback) ─────────────────────
  toggleHelpful: async (reviewId, userId) => {
    const voted = get().myHelpfulVotes.has(reviewId);

    // Optimistic update
    const nextVotes = new Set(get().myHelpfulVotes);
    if (voted) {
      nextVotes.delete(reviewId);
    } else {
      nextVotes.add(reviewId);
    }
    set({
      myHelpfulVotes: nextVotes,
      reviews: get().reviews.map(r =>
        r.id === reviewId
          ? { ...r, helpful_count: voted ? Math.max(0, r.helpful_count - 1) : r.helpful_count + 1 }
          : r
      ),
    });

    try {
      if (voted) {
        const { error } = await supabase
          .from('review_helpful_votes')
          .delete()
          .eq('review_id', reviewId)
          .eq('user_id', userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('review_helpful_votes')
          .insert({ review_id: reviewId, user_id: userId });
        if (error) throw error;
      }
    } catch (e: any) {
      console.error('[toggleHelpful]', e.message);
      // Rollback optimistic update
      const rollback = new Set(get().myHelpfulVotes);
      if (voted) {
        rollback.add(reviewId);
      } else {
        rollback.delete(reviewId);
      }
      set({
        myHelpfulVotes: rollback,
        reviews: get().reviews.map(r =>
          r.id === reviewId
            ? { ...r, helpful_count: voted ? r.helpful_count + 1 : Math.max(0, r.helpful_count - 1) }
            : r
        ),
      });
    }
  },

  // ─── Rating prompt helpers ───────────────────────────────────────────────────
  shouldShowPrompt: async (userId) => {
    try {
      const { data } = await supabase
        .from('rating_prompt_log')
        .select('prompted_at')
        .eq('user_id', userId)
        .maybeSingle();

      if (!data) return true;
      const days = (Date.now() - new Date(data.prompted_at).getTime()) / 86_400_000;
      return days >= 30;
    } catch {
      return false;
    }
  },

  markPromptShown: async (userId, action) => {
    try {
      await supabase
        .from('rating_prompt_log')
        .upsert(
          { user_id: userId, prompted_at: new Date().toISOString(), action },
          { onConflict: 'user_id' }
        );
    } catch (e: any) {
      console.error('[markPromptShown]', e.message);
    }
  },
}));
'@
Write-UTF8 -Path $reviewStorePath -Content $reviewStore

# ============================================================
# FIX 4 — src/app/_layout.tsx: mount RatingPrompt
# ============================================================
Write-Host "`n[4/4] Fixing root _layout.tsx — mounting RatingPrompt..." -ForegroundColor Cyan

$rootLayoutPath = "$base\src\app\_layout.tsx"
$rootLayout = @'
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
import RatingPrompt from '@/components/RatingPrompt';

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
        <Stack.Screen name="reviews" />
        <Stack.Screen name="support" />
        <Stack.Screen name="privacy" />
        <Stack.Screen name="reports" />
      </Stack>

      {/* Floating Zuri AI button — visible on all user screens */}
      <ZuriFAB />

      {/* Smart in-app rating prompt — mounts once, triggers on meaningful actions */}
      <RatingPrompt />
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 110,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#208AEF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    zIndex: 999,
  },
});
'@
Write-UTF8 -Path $rootLayoutPath -Content $rootLayout

# ============================================================
# Done
# ============================================================
Write-Host "`n============================================" -ForegroundColor Yellow
Write-Host "  All 4 fixes applied successfully!" -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Yellow
Write-Host @"

Summary of changes:
  [1] app.json          — splash imageWidth: 100 → 250
  [2] (tabs)/_layout    — added hidden: reviews, write-review
  [3] reviewStore.ts    — fixed auth_user_id column name
  [4] _layout.tsx       — mounted <RatingPrompt /> + added missing Stack.Screens

Next steps:
  1. Restart your Expo dev server:  npx expo start --clear
  2. Rebuild APK if needed:         eas build --profile preview --platform android
"@ -ForegroundColor White
