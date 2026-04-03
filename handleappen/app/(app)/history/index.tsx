import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuthStore } from '@/stores/useAuthStore';
import { supabase } from '@/lib/supabase';
import { Spacing, Radius, contentMaxWidth } from '@/constants/theme';

interface SearchResult {
  item_name: string;
  action: string;
  created_at: string;
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const householdId = useAuthStore((s) => s.householdId);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [topItems, setTopItems] = useState<{ name: string; count: number }[]>([]);

  const c = {
    text: useThemeColor({}, 'text'),
    textSecondary: useThemeColor({}, 'textSecondary'),
    textTertiary: useThemeColor({}, 'textTertiary'),
    tint: useThemeColor({}, 'tint'),
    card: useThemeColor({}, 'card'),
    bgGrouped: useThemeColor({}, 'backgroundGrouped'),
    outlineVariant: useThemeColor({}, 'outlineVariant'),
    surfaceContainer: useThemeColor({}, 'surfaceContainer'),
    surfaceHigh: useThemeColor({}, 'surfaceContainerHigh'),
    surfaceLowest: useThemeColor({}, 'backgroundElevated'),
    onPrimary: useThemeColor({}, 'onPrimary'),
    primaryContainer: useThemeColor({}, 'primaryContainer'),
    separator: useThemeColor({}, 'separator'),
    success: useThemeColor({}, 'success'),
    tertiary: useThemeColor({}, 'tertiary'),
  };

  const isWide = width >= 600;

  useEffect(() => {
    // Load top items
    supabase
      .from('list_activity')
      .select('item_name')
      .eq('action', 'checked')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => {
        if (!data) return;
        const freq = new Map<string, number>();
        for (const d of data) freq.set(d.item_name, (freq.get(d.item_name) ?? 0) + 1);
        setTopItems([...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count })));
      });
  }, []);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSearched(true);
    const { data } = await supabase
      .from('list_activity')
      .select('item_name, action, created_at')
      .ilike('item_name', `%${query.trim()}%`)
      .order('created_at', { ascending: false })
      .limit(50);
    setResults(data ?? []);
  }, [query]);

  const actionLabel: Record<string, string> = {
    added: 'Lagt til', checked: 'Handlet', unchecked: 'Fjernet avhuking', removed: 'Slettet', edited: 'Redigert',
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: c.bgGrouped }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + Spacing.sm },
          isWide && { maxWidth: contentMaxWidth, alignSelf: 'center' as const, width: '100%' },
        ]}
      >
        <Text style={[styles.largeTitle, { color: c.text }]}>📋 Historikk & Innsikt</Text>

        {/* Strava-style detection banner */}
        <TouchableOpacity
          style={[styles.stravaBanner, { backgroundColor: c.primaryContainer, borderColor: c.outlineVariant }]}
          activeOpacity={0.8}
        >
          <Text style={[styles.stravaText, { color: c.text }]}>
            Handlet du på <Text style={[styles.stravaAccent, { color: c.tint }]}>Kiwi Torshov</Text> kl. 14:23?
          </Text>
          <View style={styles.stravaButtons}>
            <TouchableOpacity style={[styles.stravaBtn, { backgroundColor: c.tint }]} activeOpacity={0.7}>
              <Text style={[styles.stravaBtnText, { color: c.onPrimary }]}>Ja, bekreft</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.stravaBtnOutline, { borderColor: c.outlineVariant }]} activeOpacity={0.7}>
              <Text style={[styles.stravaBtnOutlineText, { color: c.textSecondary }]}>Nei</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>

        {/* Search */}
        <View style={[styles.searchCard, { backgroundColor: c.surfaceHigh, borderColor: c.outlineVariant }]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={[styles.searchInput, { color: c.text }]}
            placeholder="Når kjøpte vi sist parmesan?"
            placeholderTextColor={c.textTertiary}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
        </View>

        {/* Search results */}
        {searched && results.length > 0 && (
          <View style={[styles.card, { backgroundColor: c.surfaceLowest, borderColor: c.outlineVariant }]}>
            {results.slice(0, 10).map((item, index) => (
              <View
                key={`${item.created_at}-${index}`}
                style={[
                  styles.resultRow,
                  index < Math.min(results.length, 10) - 1 && { borderBottomColor: c.separator, borderBottomWidth: StyleSheet.hairlineWidth },
                ]}
              >
                <View style={styles.resultContent}>
                  <Text style={[styles.resultName, { color: c.text }]}>{item.item_name}</Text>
                  <Text style={[styles.resultAction, { color: c.textTertiary }]}>{actionLabel[item.action] ?? item.action}</Text>
                </View>
                <Text style={[styles.resultDate, { color: c.textTertiary }]}>
                  {new Date(item.created_at).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })}
                </Text>
              </View>
            ))}
          </View>
        )}

        {searched && results.length === 0 && (
          <View style={styles.emptyResult}>
            <Text style={[styles.emptyText, { color: c.textSecondary }]}>Ingen treff for "{query}"</Text>
          </View>
        )}

        {/* Top items */}
        {topItems.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>🏆 TOPP VARER</Text>
            <View style={[styles.card, { backgroundColor: c.surfaceLowest, borderColor: c.outlineVariant }]}>
              {topItems.map((item, index) => (
                <View
                  key={item.name}
                  style={[
                    styles.topRow,
                    index < topItems.length - 1 && { borderBottomColor: c.separator, borderBottomWidth: StyleSheet.hairlineWidth },
                  ]}
                >
                  <View style={[styles.rankBadge, { backgroundColor: index === 0 ? c.tint : c.surfaceContainer }]}>
                    <Text style={[styles.rankText, { color: index === 0 ? c.onPrimary : c.textSecondary }]}>#{index + 1}</Text>
                  </View>
                  <Text style={[styles.topName, { color: c.text }]}>{item.name}</Text>
                  <Text style={[styles.topCount, { color: c.tint }]}>{item.count}×</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {!searched && topItems.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={[styles.emptyText, { color: c.textSecondary }]}>
              Begynn å handle for å se historikk her
            </Text>
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xxl },
  largeTitle: { fontSize: 28, fontWeight: '800', marginBottom: Spacing.lg },

  // Strava banner
  stravaBanner: { padding: Spacing.lg, borderRadius: Radius.xl, marginBottom: Spacing.lg, borderWidth: 1 },
  stravaText: { fontSize: 18, fontWeight: '600', lineHeight: 26, marginBottom: Spacing.md },
  stravaAccent: { fontWeight: '800' },
  stravaButtons: { flexDirection: 'row', gap: Spacing.sm },
  stravaBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: Radius.full },
  stravaBtnText: { fontSize: 14, fontWeight: '700' },
  stravaBtnOutline: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: Radius.full, borderWidth: 1 },
  stravaBtnOutlineText: { fontSize: 14, fontWeight: '600' },

  // Search
  searchCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: Radius.full, paddingHorizontal: Spacing.md, borderWidth: 1, minHeight: 52, marginBottom: Spacing.lg,
  },
  searchIcon: { fontSize: 16, marginRight: Spacing.sm },
  searchInput: { flex: 1, fontSize: 17, paddingVertical: 12 },

  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 2, marginBottom: Spacing.sm, marginTop: Spacing.md, paddingHorizontal: Spacing.xs },

  card: { borderRadius: Radius.xl, padding: Spacing.md, borderWidth: 1, marginBottom: Spacing.md },

  // Results
  resultRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: Spacing.sm },
  resultContent: { flex: 1 },
  resultName: { fontSize: 16, fontWeight: '600' },
  resultAction: { fontSize: 12, marginTop: 2 },
  resultDate: { fontSize: 12 },

  // Top items
  topRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: Spacing.sm, gap: Spacing.md },
  rankBadge: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  rankText: { fontSize: 12, fontWeight: '800' },
  topName: { flex: 1, fontSize: 16, fontWeight: '600', textTransform: 'capitalize' },
  topCount: { fontSize: 15, fontWeight: '700' },

  emptyResult: { alignItems: 'center', paddingVertical: Spacing.lg },
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: Spacing.md },
  emptyText: { fontSize: 15, textAlign: 'center' },
});
