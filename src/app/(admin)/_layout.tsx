import { COLORS } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const tabs: { name: string; title: string; icon: IoniconsName; iconActive: IoniconsName }[] = [
  { name: 'dashboard', title: 'Dashboard', icon: 'grid-outline',   iconActive: 'grid' },
  { name: 'parents',   title: 'Parents',   icon: 'people-outline', iconActive: 'people' },
  { name: 'children',  title: 'Children',  icon: 'heart-outline',  iconActive: 'heart' },
  { name: 'analytics', title: 'Analytics', icon: 'bar-chart-outline', iconActive: 'bar-chart' },
];

export default function AdminLayout() {
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
          bottom: 0,
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
    </Tabs>
  );
}
