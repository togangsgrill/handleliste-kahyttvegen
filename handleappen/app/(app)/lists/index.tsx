import { useState, useEffect, memo } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
  Modal,
  useWindowDimensions,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useShoppingLists } from '@/hooks/useShoppingLists';
import { useListItemCounts } from '@/hooks/useListItemCounts';
import { useAuthStore } from '@/stores/useAuthStore';
import { supabase } from '@/lib/supabase';
import { Spacing, Radius, contentMaxWidth } from '@/constants/theme';
import type { Database } from '@/types/database';

type ShoppingList = Database['public']['Tables']['shopping_lists']['Row'];

const ListCard = memo(function ListCard({
  item,
  colors,
  itemCount,
}: {
  item: ShoppingList;
  colors: Record<string, string>;
  itemCount: { total: number; checked: number } | undefined;
}) {
  const total = itemCount?.total ?? 0;
  const checked = itemCount?.checked ?? 0;
  const progress = total > 0 ? checked / total : 0;
  const isComplete = total > 0 && checked === total;
  const isActive = total > 0 && checked < total;

  return (
    <TouchableOpacity
      style={[styles.listCard, { backgroundColor: colors.cardHighlight, borderColor: colors.outlineVariant }]}
      onPress={() => router.push(`/(app)/lists/${item.id}`)}
      activeOpacity={0.7}
    >
      {/* Icon */}
      <View style={[styles.cardIcon, { backgroundColor: colors.primaryContainer }]}>
        <Text style={styles.cardIconText}>🛒</Text>
      </View>

      {/* Content */}
      <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
        {item.name}
      </Text>
      <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
        {total > 0 ? `${total} varer` : 'Ingen varer ennå'}
      </Text>

      {/* Footer */}
      <View style={styles.cardFooter}>
        {isActive && (
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: colors.tint }]} />
            <Text style={[styles.statusText, { color: colors.tint }]}>
              {checked}/{total}
            </Text>
          </View>
        )}
        {isComplete && (
          <Text style={[styles.statusText, { color: colors.success }]}>✓ Ferdig</Text>
        )}
        {!isActive && !isComplete && (
          <Text style={[styles.statusText, { color: colors.textTertiary }]}>
            {new Date(item.updated_at).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })}
          </Text>
        )}
        <Text style={[styles.cardArrow, { color: colors.textSecondary }]}>→</Text>
      </View>

      {/* Progress bar */}
      {total > 0 && (
        <View style={[styles.cardProgress, { backgroundColor: colors.outlineVariant }]}>
          <View style={[styles.cardProgressFill, { width: `${progress * 100}%`, backgroundColor: colors.tint }]} />
        </View>
      )}
    </TouchableOpacity>
  );
});

export default function ListsScreen() {
  const { t } = useTranslation();
  const { lists, isLoading, createList } = useShoppingLists();
  const [showModal, setShowModal] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [householdName, setHouseholdName] = useState('');
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const householdId = useAuthStore((s) => s.householdId);

  const colors = {
    text: useThemeColor({}, 'text'),
    textSecondary: useThemeColor({}, 'textSecondary'),
    textTertiary: useThemeColor({}, 'textTertiary'),
    tint: useThemeColor({}, 'tint'),
    card: useThemeColor({}, 'card'),
    cardHighlight: useThemeColor({}, 'cardHighlight'),
    inputBg: useThemeColor({}, 'inputBackground'),
    separator: useThemeColor({}, 'separator'),
    bgGrouped: useThemeColor({}, 'backgroundGrouped'),
    success: useThemeColor({}, 'success'),
    primaryContainer: useThemeColor({}, 'primaryContainer'),
    outlineVariant: useThemeColor({}, 'outlineVariant'),
    surfaceContainer: useThemeColor({}, 'surfaceContainer'),
  };

  const itemCounts = useListItemCounts(lists.map((l) => l.id));
  const isWide = width >= 600;
  const isGrid = width >= 500;

  useEffect(() => {
    if (!householdId) return;
    supabase.from('households').select('name').eq('id', householdId).single().then(({ data }) => {
      if (data) setHouseholdName(data.name);
    });
  }, [householdId]);

  const handleCreate = async () => {
    if (!newListName.trim()) return;
    try {
      await createList(newListName.trim());
      setNewListName('');
      setShowModal(false);
    } catch (e) {
      console.error('Create list error:', e);
    }
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.bgGrouped }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + Spacing.md },
          isWide && { maxWidth: contentMaxWidth + 200, alignSelf: 'center' as const, width: '100%' },
        ]}
      >
        {/* Welcome header */}
        <View style={styles.welcomeSection}>
          <Text style={[styles.welcomeLabel, { color: colors.tint }]}>HUSHOLDNING</Text>
          <Text style={[styles.welcomeTitle, { color: colors.text }]}>
            Hei, <Text style={[styles.welcomeAccent, { color: colors.tint }]}>{householdName || 'der'}</Text>
          </Text>
          <Text style={[styles.welcomeSubtitle, { color: colors.textSecondary }]}>
            {lists.length > 0
              ? `${lists.length} liste${lists.length > 1 ? 'r' : ''} aktiv${lists.length > 1 ? 'e' : ''}`
              : 'Opprett din første handleliste'}
          </Text>
        </View>

        {/* Lists grid */}
        {lists.length === 0 && !isLoading ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📝</Text>
            <ThemedText style={[styles.emptyText, { color: colors.text }]}>
              {t('lists.empty')}
            </ThemedText>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
              {t('lists.empty_subtitle')}
            </Text>
          </View>
        ) : (
          <View style={[styles.grid, isGrid && styles.gridTwo]}>
            {lists.map((item) => (
              <ListCard
                key={item.id}
                item={item}
                colors={colors}
                itemCount={itemCounts.get(item.id)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.tint }]}
        onPress={() => setShowModal(true)}
        activeOpacity={0.8}
      >
        <Text style={[styles.fabText, { color: colors.text === '#d8fff0' ? '#003825' : '#c8ffe0' }]}>+</Text>
        {isWide && (
          <Text style={[styles.fabLabel, { color: colors.text === '#d8fff0' ? '#003825' : '#c8ffe0' }]}>Ny liste</Text>
        )}
      </TouchableOpacity>

      {/* Create modal */}
      <Modal visible={showModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => { setShowModal(false); setNewListName(''); }}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
              <ThemedText style={styles.modalTitle}>{t('lists.new_list')}</ThemedText>
              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.inputBg, color: colors.text }]}
                placeholder={t('lists.name_placeholder')}
                placeholderTextColor={colors.textSecondary}
                value={newListName}
                onChangeText={setNewListName}
                onSubmitEditing={handleCreate}
                returnKeyType="done"
                autoFocus
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalCancel}
                  onPress={() => { setShowModal(false); setNewListName(''); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.modalCancelText, { color: colors.tint }]}>{t('lists.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalCreate, { backgroundColor: colors.tint, opacity: !newListName.trim() ? 0.5 : 1 }]}
                  onPress={handleCreate}
                  disabled={!newListName.trim()}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.modalCreateText, { color: colors.text === '#d8fff0' ? '#003825' : '#c8ffe0' }]}>
                    {t('lists.create')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.md, paddingBottom: 120 },
  welcomeSection: { marginBottom: Spacing.xl },
  welcomeLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 3, marginBottom: Spacing.sm },
  welcomeTitle: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  welcomeAccent: { fontStyle: 'italic' },
  welcomeSubtitle: { fontSize: 16, marginTop: Spacing.sm, lineHeight: 22 },
  grid: { gap: Spacing.md },
  gridTwo: { flexDirection: 'row', flexWrap: 'wrap' },
  listCard: {
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    minHeight: 180,
    justifyContent: 'space-between',
    borderWidth: 1,
    flex: 1,
    minWidth: 200,
    marginBottom: Spacing.md,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  cardIconText: { fontSize: 22 },
  cardTitle: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  cardSubtitle: { fontSize: 14 },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.lg,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5 },
  cardArrow: { fontSize: 18 },
  cardProgress: { height: 3, borderRadius: 2, marginTop: Spacing.sm, overflow: 'hidden' },
  cardProgressFill: { height: '100%', borderRadius: 2 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: Spacing.md },
  emptyText: { fontSize: 20, fontWeight: '600' },
  emptySubtext: { fontSize: 15, marginTop: Spacing.sm },
  fab: {
    position: 'absolute',
    bottom: 100,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: Radius.full,
    shadowColor: '#00eea6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
    gap: Spacing.sm,
  },
  fabText: { fontSize: 28, fontWeight: '400', marginTop: -2 },
  fabLabel: { fontSize: 15, fontWeight: '700' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  modalContent: { borderRadius: Radius.xl, padding: Spacing.lg, gap: Spacing.md },
  modalTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  modalInput: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    fontSize: 17,
    minHeight: 48,
  },
  modalButtons: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
  modalCancel: {
    flex: 1, paddingVertical: 14, alignItems: 'center',
    borderRadius: Radius.md, minHeight: 50, justifyContent: 'center',
  },
  modalCancelText: { fontSize: 17, fontWeight: '600' },
  modalCreate: {
    flex: 1, paddingVertical: 14, alignItems: 'center',
    borderRadius: Radius.md, minHeight: 50, justifyContent: 'center',
  },
  modalCreateText: { fontSize: 17, fontWeight: '600' },
});
