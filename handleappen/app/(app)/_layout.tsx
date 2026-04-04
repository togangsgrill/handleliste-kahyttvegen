import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { useTranslation } from 'react-i18next';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function AppLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#006947',
        tabBarInactiveTintColor: 'rgba(76,129,112,0.7)',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: 'rgba(255,255,255,0.8)',
          borderTopColor: 'rgba(167,241,216,0.1)',
          borderTopWidth: 1,
          paddingBottom: Platform.OS === 'ios' ? 24 : 12,
          paddingTop: 10,
          height: Platform.OS === 'ios' ? 84 : 68,
          ...(Platform.OS === 'web' ? {
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
            boxShadow: '0 -10px 40px rgba(0,54,42,0.08)',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
            height: 'calc(68px + env(safe-area-inset-bottom))',
          } as any : {}),
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 1,
          textTransform: 'uppercase',
          marginTop: 2,
          ...(Platform.OS === 'web' ? {
            fontFamily: "'Manrope', system-ui, sans-serif",
          } as any : {}),
        },
        tabBarItemStyle: {
          paddingVertical: 4,
        },
      }}
    >
      <Tabs.Screen
        name="lists"
        options={{
          title: t('tabs.lists'),
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="list.bullet" color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: t('tabs.history'),
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="clock.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="statistics"
        options={{
          title: t('tabs.statistics'),
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="chart.bar.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="gearshape.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
