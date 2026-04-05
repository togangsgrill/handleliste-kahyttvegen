import { Platform, TouchableOpacity, View, Text } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { IconSymbol } from '@/components/ui/icon-symbol';

const C = {
  primary: '#006947',
  inactive: 'rgba(76,129,112,0.5)',
  bg: 'rgba(255,255,255,0.92)',
};

const ICONS: Record<string, { name: any; label: string }> = {
  lists:      { name: 'house.fill',     label: 'Hjem' },
  history:    { name: 'clock.fill',     label: 'Historikk' },
  statistics: { name: 'chart.bar.fill', label: 'Innsikt' },
  settings:   { name: 'gearshape.fill', label: 'Meny' },
};

export function PWATabBar({ state, navigation }: BottomTabBarProps) {
  return (
    <View
      style={{
        position: 'fixed' as any,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: C.bg,
        borderTopWidth: 1,
        borderTopColor: 'rgba(167,241,216,0.2)',
        flexDirection: 'row' as const,
        alignItems: 'flex-start' as const,
        paddingTop: 6,
        paddingBottom: 'max(4px, env(safe-area-inset-bottom, 8px))' as any,
        backdropFilter: 'blur(40px)',
        WebkitBackdropFilter: 'blur(40px)',
        boxShadow: '0 -8px 32px rgba(0,54,42,0.08)',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        zIndex: 9999,
        minHeight: 52,
      } as any}
    >
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const icon = ICONS[route.name];
        if (!icon) return null;

        return (
          <TouchableOpacity
            key={route.key}
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name as never);
              } else if (isFocused) {
                // Allerede på tabben — pop stacken tilbake til rot-skjermen
                navigation.navigate(route.name as never, { screen: 'index' } as never);
              }
            }}
            style={{ flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 2 }}
            activeOpacity={0.7}
          >
            <IconSymbol
              name={icon.name}
              size={20}
              color={isFocused ? C.primary : C.inactive}
            />
            <Text style={{
              fontSize: 10,
              fontWeight: '600' as const,
              letterSpacing: 0.2,
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
