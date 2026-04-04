import { useEffect, useState } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View, Platform } from 'react-native';
import 'react-native-reanimated';
import '../global.css';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/useAuthStore';
import { Colors } from '@/constants/theme';
import '@/i18n';

// Stitch LIGHT theme (primary)
const StitchLight = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#006947',
    background: '#d8fff0',
    card: '#ffffff',
    text: '#00362a',
    border: 'rgba(129, 184, 165, 0.15)',
    notification: '#006947',
  },
};

// Stitch dark theme (secondary)
const StitchDark = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: '#00eea6',
    background: '#001510',
    card: '#001d16',
    text: '#d8fff0',
    border: 'rgba(47, 101, 85, 0.2)',
    notification: '#00eea6',
  },
};

// Inject Google Fonts for web
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const link = document.createElement('link');
  link.href = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Manrope:wght@400;500;600;700;800&display=swap";
  link.rel = 'stylesheet';
  document.head.appendChild(link);

  const style = document.createElement('style');
  style.textContent = `body { font-family: 'Manrope', system-ui, sans-serif; }`;
  document.head.appendChild(style);
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [ready, setReady] = useState(false);
  const setSession = useAuthStore((s) => s.setSession);
  const setHouseholdId = useAuthStore((s) => s.setHouseholdId);
  const setLoading = useAuthStore((s) => s.setLoading);

  useEffect(() => {
    async function init() {
      try {
        // Check for existing session (no auto-anonymous anymore)
        const { data: { session } } = await supabase.auth.getSession();

        if (session && !session.user.is_anonymous) {
          setSession(session);

          const { data: user } = await supabase
            .from('users')
            .select('household_id')
            .eq('id', session.user.id)
            .single();

          setHouseholdId(user?.household_id ?? null);
        } else {
          // No session or anonymous — user needs to log in
          setSession(null);
          setHouseholdId(null);
        }
      } catch (e) {
        console.error('Auth init error:', e);
      } finally {
        setLoading(false);
        setReady(true);
      }
    }
    init();

    // Listen for auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session && !session.user.is_anonymous) {
        setSession(session);
        const { data: user } = await supabase
          .from('users')
          .select('household_id')
          .eq('id', session.user.id)
          .single();
        setHouseholdId(user?.household_id ?? null);
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setHouseholdId(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [setSession, setHouseholdId, setLoading]);

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#d8fff0' }}>
        <ActivityIndicator size="large" color="#006947" />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? StitchDark : StitchLight}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
