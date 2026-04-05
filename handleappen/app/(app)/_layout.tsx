import { Tabs, Redirect } from 'expo-router';
import { Platform } from 'react-native';
import { useTranslation } from 'react-i18next';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PWATabBar } from '@/components/pwa-tab-bar';
import { useAuthStore } from '@/stores/useAuthStore';
import { useRecipeEnrichmentWorker } from '@/hooks/useRecipeEnrichmentWorker';

export default function AppLayout() {
  const { t } = useTranslation();
  const session = useAuthStore((s) => s.session);
  const isLoading = useAuthStore((s) => s.isLoading);

  // Global bakgrunnsjobber som beriker oppskrifter (overlever navigering)
  useRecipeEnrichmentWorker();

  if (isLoading) return null;
  if (!session) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      tabBar={Platform.OS === 'web' ? (props) => <PWATabBar {...props} /> : undefined}
      screenOptions={{
        tabBarActiveTintColor: '#006947',
        tabBarInactiveTintColor: 'rgba(76,129,112,0.7)',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: 'rgba(255,255,255,0.85)',
          borderTopColor: 'rgba(167,241,216,0.1)',
          borderTopWidth: 1,
          paddingBottom: Platform.OS === 'ios' ? 20 : 8,
          paddingTop: 6,
          height: Platform.OS === 'ios' ? 68 : 58,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.2,
          marginTop: 1,
        },
        tabBarItemStyle: {
          paddingVertical: 2,
        },
      }}
    >
      <Tabs.Screen
        name="lists"
        options={{
          title: 'Hjem',
          tabBarIcon: ({ color }) => <IconSymbol size={20} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Historikk',
          tabBarIcon: ({ color }) => <IconSymbol size={20} name="clock.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="statistics"
        options={{
          title: 'Statistikk',
          tabBarIcon: ({ color }) => <IconSymbol size={20} name="chart.bar.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Meny',
          tabBarIcon: ({ color }) => <IconSymbol size={20} name="gearshape.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
