import { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuthStore } from '@/stores/useAuthStore';
import { supabase } from '@/lib/supabase';
import { Spacing, Radius, contentMaxWidth } from '@/constants/theme';

interface Stats {
  totalItems: number;
  totalChecked: number;
  totalLists: number;
  topItems: { name: string; count: number }[];
  recentActivity: { action: string; item_name: string; created_at: string }[];
}

export default function StatisticsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const householdId = useAuthStore((s) => s.householdId);
  const [stats, setStats] = useState<Stats | null>(null);

  const textSecondary = useThemeColor({}, 'textSecondary');
  const cardBg = useThemeColor({}, 'card');
  const separator = useThemeColor({}, 'separator');
  const tint = useThemeColor({}, 'tint');
  const success = useThemeColor({}, 'success');
  const bgGrouped = useThemeColor({}, 'backgroundGrouped');

  const isWide = width >= 600;

  useEffect(() => {
    if (!householdId) return;
    loadStats();
  }, [householdId]);

  async function loadStats() {
    if (!householdId) return;

    // Get lists count
    const { count: totalLists } = await supabase
      .from('shopping_lists')
      .select('*', { count: 'exact', head: true })
      .eq('household_id', householdId)
      .eq('is_deleted', false);

    // Get all activity for top items
    const { data: activity } = await supabase
      .from('list_activity')
      .select('action, item_name, created_at')
      .eq('action', 'added')
      .order('created_at', { ascending: false })
      .limit(500);

    // Count items added
    const itemCounts = new Map<string, number>();
    for (const a of activity ?? []) {
      const name = a.item_name.toLowerCase();
      itemCounts.set(name, (itemCounts.get(name) ?? 0) + 1);
    }
    const topItems = [...itemCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    // Recent activity
    const { data: recent } = await supabase
      .from('list_activity')
      .select('action, item_name, created_at')
      .order('created_at', { ascending: false })
      .limit(20);

    // Total items and checked
    const { count: totalItems } = await supabase
      .from('list_items')
      .select('*', { count: 'exact', head: true })
      .eq('is_deleted', false);

    const { count: totalChecked } = await supabase
      .from('list_items')
      .select('*', { count: 'exact', head: true })
      .eq('is_deleted', false)
      .eq('is_checked', true);

    setStats({
      totalItems: totalItems ?? 0,
      totalChecked: totalChecked ?? 0,
      totalLists: totalLists ?? 0,
      topItems,
      recentActivity: recent ?? [],
    });
  }

  const actionEmoji: Record<string, string> = {
    added: '➕',
    checked: '✅',
    unchecked: '⬜',
    removed: '🗑️',
    edited: '✏️',
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgGrouped }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + Spacing.sm },
          isWide && { maxWidth: contentMaxWidth, alignSelf: 'center' as const, width: '100%' },
        ]}
      >
        <ThemedText style={styles.largeTitle}>Statistikk</ThemedText>

        {/* Summary cards */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: cardBg }]}>
            <Text style={[styles.summaryNumber, { color: tint }]}>{stats?.totalLists ?? 0}</Text>
            <Text style={[styles.summaryLabel, { color: textSecondary }]}>Lister</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: cardBg }]}>
            <Text style={[styles.summaryNumber, { color: tint }]}>{stats?.totalItems ?? 0}</Text>
            <Text style={[styles.summaryLabel, { color: textSecondary }]}>Varer</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: cardBg }]}>
            <Text style={[styles.summaryNumber, { color: success }]}>{stats?.totalChecked ?? 0}</Text>
            <Text style={[styles.summaryLabel, { color: textSecondary }]}>Handlet</Text>
          </View>
        </View>

        {/* Top items */}
        {stats && stats.topItems.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: textSecondary }]}>MEST KJØPTE VARER</Text>
            <View style={[styles.card, { backgroundColor: cardBg }]}>
              {stats.topItems.map((item, index) => (
                <View
                  key={item.name}
                  style={[
                    styles.topItemRow,
                    index < stats.topItems.length - 1 && { borderBottomColor: separator, borderBottomWidth: StyleSheet.hairlineWidth },
                  ]}
                >
                  <Text style={[styles.topItemRank, { color: textSecondary }]}>#{index + 1}</Text>
                  <ThemedText style={styles.topItemName}>{item.name}</ThemedText>
                  <Text style={[styles.topItemCount, { color: tint }]}>{item.count}×</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Recent activity */}
        {stats && stats.recentActivity.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: textSecondary }]}>SISTE AKTIVITET</Text>
            <View style={[styles.card, { backgroundColor: cardBg }]}>
              {stats.recentActivity.map((a, index) => (
                <View
                  key={`${a.created_at}-${index}`}
                  style={[
                    styles.activityRow,
                    index < stats.recentActivity.length - 1 && { borderBottomColor: separator, borderBottomWidth: StyleSheet.hairlineWidth },
                  ]}
                >
                  <Text style={styles.activityEmoji}>{actionEmoji[a.action] ?? '·'}</Text>
                  <View style={styles.activityContent}>
                    <ThemedText style={styles.activityName} numberOfLines={1}>{a.item_name}</ThemedText>
                    <Text style={[styles.activityTime, { color: textSecondary }]}>
                      {new Date(a.created_at).toLocaleString('nb-NO', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {stats && stats.topItems.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={[styles.emptyText, { color: textSecondary }]}>
              Begynn å handle for å se statistikk her
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
  largeTitle: { fontSize: 34, fontWeight: '700', letterSpacing: 0.4, marginBottom: Spacing.lg },
  summaryRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  summaryCard: {
    flex: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  summaryNumber: { fontSize: 28, fontWeight: '700' },
  summaryLabel: { fontSize: 13, marginTop: 4 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '400',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  card: { borderRadius: Radius.md, overflow: 'hidden', marginBottom: Spacing.lg },
  topItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: Spacing.md,
    minHeight: 44,
  },
  topItemRank: { fontSize: 13, fontWeight: '600', width: 30 },
  topItemName: { flex: 1, fontSize: 17, textTransform: 'capitalize' },
  topItemCount: { fontSize: 15, fontWeight: '600' },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    minHeight: 44,
    gap: Spacing.sm,
  },
  activityEmoji: { fontSize: 16 },
  activityContent: { flex: 1 },
  activityName: { fontSize: 15 },
  activityTime: { fontSize: 12, marginTop: 2 },
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: Spacing.md },
  emptyText: { fontSize: 15, textAlign: 'center' },
});
