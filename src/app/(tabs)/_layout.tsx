import { COLORS } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const tabs: { name: string; title: string; icon: IoniconsName; iconActive: IoniconsName }[] = [
  { name: 'index',    title: 'Home',     icon: 'home-outline',        iconActive: 'home' },
  { name: 'children', title: 'Children', icon: 'people-outline',      iconActive: 'people' },
  { name: 'growth',   title: 'Growth',   icon: 'trending-up-outline', iconActive: 'trending-up' },
  { name: 'vaccines', title: 'Vaccines', icon: 'shield-outline',      iconActive: 'shield' },
  { name: 'chat',     title: 'AI Chat',  icon: 'chatbubble-outline',  iconActive: 'chatbubble' },
  { name: 'settings', title: 'Profile',   icon: 'person-circle-outline', iconActive: 'person-circle' },
];

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: Platform.OS === 'web' ? {
          backgroundColor: COLORS.white,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          paddingBottom: 8,
          paddingTop: 6,
          height: 60,
        } : {
          backgroundColor: COLORS.white,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          paddingBottom: 20,
          paddingTop: 6,
          height: 80,
          marginBottom: 48,
          marginHorizontal: 16,
          borderRadius: 20,
          position: 'absolute',
          bottom: 4,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 12,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginTop: 2,
        },
      }}
    >
      {tabs.map(t => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarIcon: ({ focused, color }) => (
              <Ionicons name={focused ? t.iconActive : t.icon} size={24} color={color} />
            ),
          }}
        />
      ))}
      <Tabs.Screen name="nutrition" options={{ href: null }} />

    </Tabs>
  );
}