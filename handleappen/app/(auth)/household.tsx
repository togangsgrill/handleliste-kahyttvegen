import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { createHousehold, joinHousehold } from '@/lib/household';
import { useAuthStore } from '@/stores/useAuthStore';
import { Spacing, Radius, contentMaxWidth } from '@/constants/theme';

export default function HouseholdScreen() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const setHouseholdId = useAuthStore((s) => s.setHouseholdId);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const tint = useThemeColor({}, 'tint');
  const textColor = useThemeColor({}, 'text');
  const textSecondary = useThemeColor({}, 'textSecondary');
  const cardBg = useThemeColor({}, 'card');
  const inputBg = useThemeColor({}, 'inputBackground');
  const separator = useThemeColor({}, 'separator');
  const onPrimary = useThemeColor({}, 'onPrimary');

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const household = await createHousehold(name.trim());
      setHouseholdId(household.id);
      router.replace('/(app)/lists');
    } catch (e) {
      console.error('Create household error:', e);
      Alert.alert('Feil', String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!code.trim()) return;
    setLoading(true);
    try {
      const household = await joinHousehold(code.trim());
      setHouseholdId(household.id);
      router.replace('/(app)/lists');
    } catch (e) {
      console.error('Join household error:', e);
      Alert.alert('Feil', t('household.invalid_code'));
    } finally {
      setLoading(false);
    }
  };

  const isWide = width >= 600;

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.inner, { paddingTop: insets.top + Spacing.xxl }]}
      >
        <View style={[styles.content, isWide && { maxWidth: contentMaxWidth, alignSelf: 'center' as const }]}>
          {/* Header */}
          <View style={styles.header}>
            <ThemedText style={styles.emoji}>🛒</ThemedText>
            <ThemedText type="title" style={styles.title}>
              {t('household.title')}
            </ThemedText>
            <ThemedText style={[styles.subtitle, { color: textSecondary }]}>
              {t('household.subtitle')}
            </ThemedText>
          </View>

          {/* Segmented control */}
          <View style={[styles.segmented, { backgroundColor: inputBg }]}>
            <TouchableOpacity
              style={[styles.segment, mode === 'create' && [styles.segmentActive, { backgroundColor: cardBg }]]}
              onPress={() => setMode('create')}
              activeOpacity={0.7}
            >
              <Text style={[styles.segmentText, { color: mode === 'create' ? textColor : textSecondary }]}>
                {t('household.create')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segment, mode === 'join' && [styles.segmentActive, { backgroundColor: cardBg }]]}
              onPress={() => setMode('join')}
              activeOpacity={0.7}
            >
              <Text style={[styles.segmentText, { color: mode === 'join' ? textColor : textSecondary }]}>
                {t('household.join')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form card */}
          <View style={[styles.card, { backgroundColor: cardBg }]}>
            {mode === 'create' ? (
              <>
                <TextInput
                  style={[styles.input, { backgroundColor: inputBg, color: textColor }]}
                  placeholder={t('household.name_placeholder')}
                  placeholderTextColor={textSecondary}
                  value={name}
                  onChangeText={setName}
                  onSubmitEditing={handleCreate}
                  returnKeyType="done"
                  autoFocus
                />
                <TouchableOpacity
                  style={[styles.button, { backgroundColor: tint, opacity: loading || !name.trim() ? 0.5 : 1 }]}
                  onPress={handleCreate}
                  disabled={loading || !name.trim()}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.buttonText, { color: onPrimary }]}>
                    {loading ? '...' : t('household.create_button')}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TextInput
                  style={[styles.input, { backgroundColor: inputBg, color: textColor }]}
                  placeholder={t('household.code_placeholder')}
                  placeholderTextColor={textSecondary}
                  value={code}
                  onChangeText={setCode}
                  onSubmitEditing={handleJoin}
                  autoCapitalize="characters"
                  returnKeyType="done"
                  autoFocus
                />
                <TouchableOpacity
                  style={[styles.button, { backgroundColor: tint, opacity: loading || !code.trim() ? 0.5 : 1 }]}
                  onPress={handleJoin}
                  disabled={loading || !code.trim()}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.buttonText, { color: onPrimary }]}>
                    {loading ? '...' : t('household.join_button')}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, paddingHorizontal: Spacing.md },
  content: { flex: 1, width: '100%' },
  header: { alignItems: 'center', marginBottom: Spacing.xl },
  emoji: { fontSize: 56, marginBottom: Spacing.md },
  title: { textAlign: 'center', fontSize: 28, marginBottom: Spacing.sm },
  subtitle: { textAlign: 'center', fontSize: 15, lineHeight: 20 },
  segmented: {
    flexDirection: 'row',
    borderRadius: Radius.sm,
    padding: 2,
    marginBottom: Spacing.lg,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radius.sm - 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
  },
  segmentActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: { fontSize: 13, fontWeight: '600' },
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  input: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontSize: 17,
    minHeight: 48,
  },
  button: {
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '600',
  },
});
