import { useEffect, useState } from 'react';
import { Platform, TouchableOpacity, View, Text } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { IconSymbol } from '@/components/ui/icon-symbol';

const C = {
  primary: '#006947',
  inactive: 'rgba(76,129,112,0.7)',
  bg: 'rgba(255,255,255,0.92)',
};

// Returns bottom safe area inset in pixels, works in iOS PWA standalone
function usePWASafeBottom(): number {
  const [bottom, setBottom] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    // Read the CSS env variable via a temporary element
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;bottom:env(safe-area-inset-bottom,0px);height:0;width:0;visibility:hidden;pointer-events:none;';
    document.body.appendChild(el);
    const rect = el.getBoundingClientRect();
    // bottom of viewport minus top of element = safe area
    const safeBottom = window.innerHeight - rect.top;
    document.body.removeChild(el);
    setBottom(Math.max(0, safeBottom));
  }, []);
  return bottom;
}

const ICONS: Record<string, { name: any; label: string }> = {
  lists:      { name: 'list.bullet',    label: 'LISTER' },
  history:    { name: 'clock.fill',     label: 'HISTORIKK' },
  statistics: { name: 'chart.bar.fill', label: 'STATISTIKK' },
  settings:   { name: 'gearshape.fill', label: 'INNSTILLINGER' },
};

export function PWATabBar({ state, navigation }: BottomTabBarProps) {
  const safeBottom = usePWASafeBottom();
  const tabHeight = 56;
  const totalHeight = tabHeight + safeBottom;

  return (
    <View
      style={{
        position: 'absolute' as const,
        left: 0,
        right: 0,
        bottom: 0,
        height: totalHeight,
        backgroundColor: C.bg,
        borderTopWidth: 1,
        borderTopColor: 'rgba(167,241,216,0.2)',
        flexDirection: 'row' as const,
        alignItems: 'flex-start' as const,
        paddingTop: 6,
        paddingBottom: safeBottom,
        ...(Platform.OS === 'web' ? {
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          boxShadow: '0 -8px 32px rgba(0,54,42,0.08)',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          zIndex: 9999,
        } as any : {}),
      }}
    >
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const icon = ICONS[route.name];
        if (!icon) return null;

        return (
          <TouchableOpacity
            key={route.key}
            onPress={() => {
              if (!isFocused) navigation.navigate(route.name);
            }}
            style={{ flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 2 }}
            activeOpacity={0.7}
          >
            <IconSymbol
              name={icon.name}
              size={22}
              color={isFocused ? C.primary : C.inactive}
            />
            <Text style={{
              fontSize: 9,
              fontWeight: '700' as const,
              letterSpacing: 0.8,
              color: isFocused ? C.primary : C.inactive,
              ...(Platform.OS === 'web' ? { fontFamily: "'Manrope', system-ui, sans-serif" } as any : {}),
            }}>
              {icon.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
