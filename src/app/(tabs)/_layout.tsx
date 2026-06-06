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
          // Enough internal padding so icons+labels aren't clipped
          paddingBottom: 14,
          paddingTop: 10,
          height: 70,
          // Sits just above the Android nav bar
          marginBottom: 40,
          marginHorizontal: 16,
          borderRadius: 24,
          position: 'absolute',
          bottom: 0,
          elevation: 12,
          ...Platform.select({
            ios:     { shadowColor: '#208AEF', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 16 },
            android: { elevation: 13 },
            default: {},
          }),
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          marginTop: 2,
          letterSpacing: 0.2,
        },
        tabBarItemStyle: {
          paddingVertical: 2,
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
                style={{ width: 26, height: 26, resizeMode: 'contain' }}
              />
            ),
          }}
        />
      ))}
      {/* Hidden screens — still routable but not shown in tab bar */}
      <Tabs.Screen name="chat"      options={{ href: null }} />
      <Tabs.Screen name="settings"  options={{ href: null }} />
      <Tabs.Screen name="reviews"   options={{ href: null }} />
      <Tabs.Screen name="nutrition" options={{ href: null }} />
    </Tabs>
  );
}