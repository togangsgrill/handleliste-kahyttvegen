import { useEffect, useRef } from 'react';
import { Animated, Text, TouchableOpacity, View, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUIStore } from '@/stores/useUIStore';

const C = {
  primary: '#006947',
  text: '#00362a',
  white: '#ffffff',
  fontBody: Platform.OS === 'web' ? "'Manrope', system-ui, sans-serif" : undefined,
};

function ToastItem({ id, message, icon }: { id: string; message: string; icon?: string }) {
  const dismiss = useUIStore((s) => s.dismissToast);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 20, duration: 250, useNativeDriver: true }),
      ]).start();
    }, 3500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <TouchableOpacity
        onPress={() => dismiss(id)}
        activeOpacity={0.9}
        style={[{
          flexDirection: 'row', alignItems: 'center', gap: 10,
          backgroundColor: C.white, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 18,
          borderWidth: 1, borderColor: 'rgba(0,105,71,0.12)',
          marginBottom: 8,
        }, Platform.OS === 'web' ? ({
          boxShadow: '0px 8px 30px rgba(0,54,42,0.12)',
        } as any) : {
          shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1, shadowRadius: 12, elevation: 6,
        }]}
      >
        {icon && <Text style={{ fontSize: 18 }}>{icon}</Text>}
        <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: C.text, fontFamily: C.fontBody } as any}>
          {message}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export function ToastOverlay() {
  const insets = useSafeAreaInsets();
  const toasts = useUIStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute', bottom: 90 + insets.bottom, left: 16, right: 16,
        zIndex: 9999,
        alignItems: 'center',
      }}
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} id={t.id} message={t.message} icon={t.icon} />
      ))}
    </View>
  );
}
