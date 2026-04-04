import { useState } from 'react';
import {
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { signInWithEmail, signUpWithEmail } from '@/lib/auth';
import { useAuthStore } from '@/stores/useAuthStore';
import { supabase } from '@/lib/supabase';

const C = {
  bg: '#d8fff0',
  white: '#ffffff',
  low: '#bffee7',
  container: '#b2f6de',
  primary: '#006947',
  primaryContainer: '#00feb2',
  text: '#00362a',
  textSec: '#2f6555',
  outline: '#81b8a5',
  error: '#b31b25',
  errorBg: '#ffeaec',
  font: "'Plus Jakarta Sans', system-ui, sans-serif" as string,
  fontBody: "'Manrope', system-ui, sans-serif" as string,
};

const isWeb = Platform.OS === 'web';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const setSession = useAuthStore((s) => s.setSession);
  const setHouseholdId = useAuthStore((s) => s.setHouseholdId);

  const isWide = width >= 600;

  const handleSubmit = async () => {
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Fyll inn e-post og passord');
      return;
    }
    if (mode === 'register' && !displayName.trim()) {
      setError('Fyll inn navnet ditt');
      return;
    }
    if (password.length < 6) {
      setError('Passordet må være minst 6 tegn');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'register') {
        const { session } = await signUpWithEmail(email.trim(), password, displayName.trim());
        if (session) {
          setSession(session);
          // New user — go to household setup
          router.replace('/(auth)/household');
        } else {
          // Email confirmation required
          setError('Sjekk e-posten din for bekreftelseslenke');
          setMode('login');
        }
      } else {
        const { session } = await signInWithEmail(email.trim(), password);
        setSession(session);

        // Check if user has a household
        const { data: user } = await supabase
          .from('users')
          .select('household_id')
          .eq('id', session.user.id)
          .single();

        if (user?.household_id) {
          setHouseholdId(user.household_id);
          router.replace('/(app)/lists');
        } else {
          router.replace('/(auth)/household');
        }
      }
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      if (msg.includes('Invalid login')) {
        setError('Feil e-post eller passord');
      } else if (msg.includes('already registered')) {
        setError('Denne e-posten er allerede registrert. Prøv å logge inn.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingHorizontal: 24,
            paddingTop: insets.top + 40,
            paddingBottom: insets.bottom + 40,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={isWide ? { maxWidth: 440, alignSelf: 'center' as const, width: '100%' as any } : {}}>
            {/* Header */}
            <View style={{ alignItems: 'center', marginBottom: 40 }}>
              <Text style={{ fontSize: 56, marginBottom: 12 }}>🛒</Text>
              <Text style={{
                fontSize: 28, fontWeight: '800', color: C.text,
                letterSpacing: -0.5, textAlign: 'center',
                ...(isWeb ? { fontFamily: C.font } as any : {}),
              }}>
                Handleappen
              </Text>
              <Text style={{
                fontSize: 15, color: C.textSec, textAlign: 'center',
                marginTop: 8, lineHeight: 22,
                ...(isWeb ? { fontFamily: C.fontBody } as any : {}),
              }}>
                {mode === 'login'
                  ? 'Logg inn for å se handlelistene dine'
                  : 'Opprett konto for å komme i gang'}
              </Text>
            </View>

            {/* Segmented control */}
            <View style={{
              flexDirection: 'row', backgroundColor: C.container, borderRadius: 14, padding: 4, marginBottom: 24,
            }}>
              {(['login', 'register'] as const).map((m) => (
                <TouchableOpacity
                  key={m}
                  style={{
                    flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 11,
                    backgroundColor: mode === m ? C.white : 'transparent',
                    ...(mode === m && isWeb ? { boxShadow: '0px 2px 8px rgba(0,54,42,0.08)' } as any : {}),
                  }}
                  onPress={() => { setMode(m); setError(''); }}
                  activeOpacity={0.7}
                >
                  <Text style={{
                    fontSize: 14, fontWeight: '700',
                    color: mode === m ? C.primary : C.textSec,
                    ...(isWeb ? { fontFamily: C.fontBody } as any : {}),
                  }}>
                    {m === 'login' ? 'Logg inn' : 'Registrer'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Form card */}
            <View style={[
              {
                backgroundColor: C.white, borderRadius: 24, padding: 24, gap: 14,
                borderWidth: 1, borderColor: C.outline + '33',
              },
              isWeb ? { boxShadow: '0px 10px 30px rgba(0,54,42,0.04)' } as any : {},
            ]}>
              {mode === 'register' && (
                <View>
                  <Text style={{
                    fontSize: 12, fontWeight: '700', letterSpacing: 1.5, color: C.textSec,
                    marginBottom: 6, textTransform: 'uppercase',
                    ...(isWeb ? { fontFamily: C.fontBody } as any : {}),
                  }}>
                    Navn
                  </Text>
                  <TextInput
                    style={{
                      backgroundColor: C.low, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
                      fontSize: 17, color: C.text, borderWidth: 1, borderColor: 'rgba(129,184,165,0.2)',
                      ...(isWeb ? { fontFamily: C.fontBody, outlineStyle: 'none' } as any : {}),
                    }}
                    placeholder="Thomas"
                    placeholderTextColor={C.outline}
                    value={displayName}
                    onChangeText={setDisplayName}
                    autoCapitalize="words"
                    autoComplete="name"
                    textContentType="name"
                  />
                </View>
              )}

              <View>
                <Text style={{
                  fontSize: 12, fontWeight: '700', letterSpacing: 1.5, color: C.textSec,
                  marginBottom: 6, textTransform: 'uppercase',
                  ...(isWeb ? { fontFamily: C.fontBody } as any : {}),
                }}>
                  E-post
                </Text>
                <TextInput
                  style={{
                    backgroundColor: C.low, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
                    fontSize: 17, color: C.text, borderWidth: 1, borderColor: 'rgba(129,184,165,0.2)',
                    ...(isWeb ? { fontFamily: C.fontBody, outlineStyle: 'none' } as any : {}),
                  }}
                  placeholder="din@epost.no"
                  placeholderTextColor={C.outline}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                />
              </View>

              <View>
                <Text style={{
                  fontSize: 12, fontWeight: '700', letterSpacing: 1.5, color: C.textSec,
                  marginBottom: 6, textTransform: 'uppercase',
                  ...(isWeb ? { fontFamily: C.fontBody } as any : {}),
                }}>
                  Passord
                </Text>
                <TextInput
                  style={{
                    backgroundColor: C.low, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
                    fontSize: 17, color: C.text, borderWidth: 1, borderColor: 'rgba(129,184,165,0.2)',
                    ...(isWeb ? { fontFamily: C.fontBody, outlineStyle: 'none' } as any : {}),
                  }}
                  placeholder="Minst 6 tegn"
                  placeholderTextColor={C.outline}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  textContentType={mode === 'register' ? 'newPassword' : 'password'}
                  onSubmitEditing={handleSubmit}
                  returnKeyType="go"
                />
              </View>

              {error ? (
                <View style={{ backgroundColor: C.errorBg, borderRadius: 12, padding: 12 }}>
                  <Text style={{
                    fontSize: 13, color: C.error, textAlign: 'center',
                    ...(isWeb ? { fontFamily: C.fontBody } as any : {}),
                  }}>
                    {error}
                  </Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={{
                  backgroundColor: C.primary, borderRadius: 14, paddingVertical: 16,
                  alignItems: 'center', justifyContent: 'center', minHeight: 52,
                  opacity: loading ? 0.7 : 1,
                  ...(isWeb ? {
                    background: 'linear-gradient(135deg, #006947, #00feb2)',
                    boxShadow: '0px 10px 30px rgba(0,105,71,0.2)',
                  } as any : {}),
                }}
                onPress={handleSubmit}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={{
                    fontSize: 17, fontWeight: '700', color: '#ffffff',
                    ...(isWeb ? { fontFamily: C.fontBody } as any : {}),
                  }}>
                    {mode === 'login' ? 'Logg inn' : 'Opprett konto'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
