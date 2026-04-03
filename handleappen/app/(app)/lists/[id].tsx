import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useThemeColor } from '@/hooks/use-theme-color';
import { useListItems } from '@/hooks/useListItems';
import { useCategories } from '@/hooks/useCategories';
import { usePriceHistory } from '@/hooks/usePriceHistory';
import { BarcodeScanner } from '@/components/barcode-scanner';
import { isClaudeConfigured, generateSuggestions } from '@/lib/claude';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/useAuthStore';
import type { Database } from '@/types/database';

type ListItem = Database['public']['Tables']['list_items']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];

export default function ListDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { activeItems, checkedItems, items, addItem, toggleItem, updateItem, deleteItem } = useListItems(id);
  const categories = useCategories();
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const priceHistory = usePriceHistory(items.map((i) => i.name));

  const [newItemName, setNewItemName] = useState('');
  const [showChecked, setShowChecked] = useState(true);
  const [showScanner, setShowScanner] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [editItem, setEditItem] = useState<ListItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editQuantity, setEditQuantity] = useState('1');
  const [editNote, setEditNote] = useState('');
  const [editCategoryId, setEditCategoryId] = useState<string | null>(null);
  const [listName, setListName] = useState('');
  const householdId = useAuthStore((s) => s.householdId);

  useEffect(() => {
    if (!id) return;
    supabase.from('shopping_lists').select('name').eq('id', id).single().then(({ data }) => {
      if (data) setListName(data.name);
    });
  }, [id]);

  // AI suggestions
  useEffect(() => {
    if (!householdId || !isClaudeConfigured()) return;
    supabase.from('list_activity').select('item_name').eq('action', 'added')
      .order('created_at', { ascending: false }).limit(100)
      .then(async ({ data }) => {
        if (!data || data.length < 3) return;
        const freq = new Map<string, number>();
        for (const d of data) freq.set(d.item_name, (freq.get(d.item_name) ?? 0) + 1);
        try {
          const result = await generateSuggestions(
            [...freq.entries()].map(([name, frequency]) => ({ name, frequency, lastPurchased: new Date().toISOString() }))
          );
          const currentNames = new Set(items.map((i) => i.name.toLowerCase()));
          setSuggestions(result.filter((s) => !currentNames.has(s.name.toLowerCase())).map((s) => s.name).slice(0, 6));
        } catch { /* AI not configured */ }
      });
  }, [householdId, items.length]);

  const totalAll = activeItems.length + checkedItems.length;
  const progress = totalAll > 0 ? Math.round((checkedItems.length / totalAll) * 100) : 0;
  const estimate = useMemo(() => priceHistory.totalEstimate(), [priceHistory]);

  const handleAdd = async (name?: string) => {
    const itemName = name ?? newItemName;
    if (!itemName.trim()) return;
    await addItem(itemName);
    if (!name) setNewItemName('');
    setSuggestions((prev) => prev.filter((s) => s.toLowerCase() !== itemName.toLowerCase()));
  };

  const handleBarcodeScan = useCallback((barcode: string) => {
    setShowScanner(false);
    setNewItemName(barcode);
  }, []);

  const openEdit = (item: ListItem) => {
    setEditItem(item);
    setEditName(item.name);
    setEditQuantity(String(item.quantity));
    setEditNote(item.note ?? '');
    setEditCategoryId(item.category_id);
  };

  const handleSaveEdit = async () => {
    if (!editItem) return;
    await updateItem(editItem.id, {
      name: editName.trim() || editItem.name,
      quantity: parseInt(editQuantity) || 1,
      note: editNote.trim() || null,
      category_id: editCategoryId,
    });
    setEditItem(null);
  };

  return (
    <>
      <Stack.Screen options={{ headerTitle: listName, headerBackTitle: t('tabs.lists') }} />
      <View className="flex-1 bg-background">
        <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 120, paddingTop: 8 }} keyboardShouldPersistTaps="handled">

          {/* Store Selector */}
          <View className="mb-6 p-5 bg-surface-container-low rounded-3xl relative overflow-hidden border border-outline-variant/20">
            <Text className="text-on-surface-variant font-label text-[11px] font-bold uppercase tracking-widest mb-1">Valgt Butikk</Text>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-3">
                <Text className="text-primary-fixed-dim text-xl">📍</Text>
                <Text className="text-2xl font-extrabold font-headline text-on-surface">Velg butikk</Text>
              </View>
              <TouchableOpacity className="flex-row items-center gap-1 px-4 py-2 bg-surface-container rounded-full border border-surface-variant/30" activeOpacity={0.7}>
                <Text className="text-on-surface-variant text-sm font-bold">Bytt ▾</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Add Item Input */}
          <View className="mb-6 flex-row gap-3">
            <View className="flex-1 bg-surface-container-high/40 border border-surface-variant/30 rounded-full px-5 py-3 flex-row items-center">
              <Text className="text-on-surface-variant mr-3 text-lg">🛒</Text>
              <TextInput
                className="flex-1 text-lg text-on-surface font-medium"
                placeholder="Legg til i listen..."
                placeholderTextColor="rgba(167, 241, 216, 0.5)"
                value={newItemName}
                onChangeText={setNewItemName}
                onSubmitEditing={() => handleAdd()}
                returnKeyType="done"
              />
              {Platform.OS === 'web' && (
                <TouchableOpacity onPress={() => setShowScanner(true)} activeOpacity={0.5}>
                  <Text className="text-on-surface-variant text-lg ml-2">📷</Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              className="w-14 h-14 rounded-full bg-primary items-center justify-center shadow-lg"
              onPress={() => handleAdd()}
              activeOpacity={0.8}
            >
              <Text className="text-on-primary text-2xl font-bold" style={{ marginTop: -2 }}>+</Text>
            </TouchableOpacity>
          </View>

          {showScanner && <BarcodeScanner onScan={handleBarcodeScan} onClose={() => setShowScanner(false)} />}

          {totalAll === 0 ? (
            <View className="items-center pt-16">
              <Text className="text-5xl mb-4">🛒</Text>
              <Text className="text-on-surface text-xl font-bold">{t('items.no_items')}</Text>
              <Text className="text-on-surface-variant text-base mt-2">{t('items.no_items_subtitle')}</Text>
            </View>
          ) : (
            <>
              {/* Active Items Header */}
              <View className="flex-row items-center justify-between px-2 mb-3">
                <Text className="text-sm font-bold uppercase tracking-widest text-on-surface-variant opacity-80">
                  Aktive Varer ({activeItems.length})
                </Text>
                <Text className="text-xs font-bold text-on-primary bg-primary-fixed-dim px-3 py-1 rounded-full">
                  {progress}% ferdig
                </Text>
              </View>

              {/* Active Items */}
              {activeItems.map((item) => {
                const cat = catMap.get(item.category_id ?? '');
                const price = priceHistory.getPrice(item.name);
                return (
                  <TouchableOpacity
                    key={item.id}
                    className="bg-surface-container-lowest p-4 rounded-2xl flex-row items-center gap-4 mb-3 border border-surface-variant/10"
                    onPress={() => openEdit(item)}
                    activeOpacity={0.7}
                  >
                    <TouchableOpacity
                      className={`w-6 h-6 rounded-full border-2 border-primary-fixed-dim items-center justify-center ${item.is_checked ? 'bg-primary' : ''}`}
                      onPress={() => toggleItem(item)}
                    >
                      {item.is_checked && <Text className="text-on-primary text-xs font-bold">✓</Text>}
                    </TouchableOpacity>
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2">
                        {cat && <Text className="text-lg">{cat.emoji}</Text>}
                        <Text className={`font-bold text-lg leading-tight ${item.is_checked ? 'text-on-surface-variant line-through' : 'text-on-surface'}`}>
                          {item.name}
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-3 mt-1">
                        {item.quantity > 1 && (
                          <Text className="text-xs font-bold text-on-surface-variant bg-surface-container px-2 py-0.5 rounded">
                            {item.quantity} stk
                          </Text>
                        )}
                        <Text className="text-xs text-on-surface-variant/60 italic">
                          {price ? `Sist sett: ${price.unitPrice.toFixed(2)} kr` : 'Pris mangler'}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => deleteItem(item)} className="opacity-40">
                      <Text className="text-on-surface-variant text-xl">⋮</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}

              {/* Estimated Total */}
              <View className="bg-surface-container-low rounded-3xl p-6 my-4 border border-outline-variant/10">
                <Text className="text-on-surface-variant font-label text-[11px] font-bold uppercase tracking-widest">Estimert Total</Text>
                <Text className="text-on-surface text-3xl font-extrabold font-headline mt-1">
                  {estimate.knownCount > 0 ? `ca. ${estimate.estimate.toFixed(0)} kr` : '—'}
                </Text>
                <Text className="text-on-surface-variant text-sm mt-1">
                  {estimate.knownCount > 0
                    ? `Kun ${estimate.knownCount} av ${estimate.totalCount} varer`
                    : 'Skann kvitteringer for prisestimat'}
                </Text>
              </View>

              {/* Checked Items */}
              {checkedItems.length > 0 && (
                <>
                  <TouchableOpacity className="flex-row items-center justify-between px-2 py-3 mt-2" onPress={() => setShowChecked(!showChecked)}>
                    <Text className="text-sm font-bold uppercase tracking-widest text-on-surface-variant opacity-80">
                      Kjøpt ({checkedItems.length})
                    </Text>
                    <Text className="text-on-surface-variant">{showChecked ? '▾' : '▸'}</Text>
                  </TouchableOpacity>
                  {showChecked && checkedItems.map((item) => {
                    const cat = catMap.get(item.category_id ?? '');
                    return (
                      <TouchableOpacity
                        key={item.id}
                        className="bg-surface-container-lowest/50 p-4 rounded-2xl flex-row items-center gap-4 mb-2 opacity-60"
                        onPress={() => toggleItem(item)}
                        activeOpacity={0.7}
                      >
                        <View className="w-6 h-6 rounded-full bg-primary items-center justify-center">
                          <Text className="text-on-primary text-xs font-bold">✓</Text>
                        </View>
                        <View className="flex-1">
                          <Text className="text-on-surface-variant line-through font-medium text-lg">{item.name}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}

              {/* Smart Suggestions */}
              {suggestions.length > 0 && (
                <View className="mt-6">
                  <Text className="text-sm font-bold uppercase tracking-widest text-on-surface-variant opacity-80 px-2 mb-3">
                    ✨ Smart Forslag
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {suggestions.map((s) => (
                      <TouchableOpacity
                        key={s}
                        className="flex-row items-center gap-2 px-4 py-3 bg-surface-container-high/60 rounded-full mr-3 border border-outline-variant/20"
                        onPress={() => handleAdd(s)}
                        activeOpacity={0.7}
                      >
                        <Text className="text-on-surface text-sm font-semibold">{s}</Text>
                        <Text className="text-primary text-lg font-bold">+</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </>
          )}
        </ScrollView>

        {/* Edit Modal */}
        <Modal visible={!!editItem} transparent animationType="fade">
          <TouchableOpacity className="flex-1 bg-black/50 justify-center px-6" activeOpacity={1} onPress={() => setEditItem(null)}>
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              <View className="bg-surface-container-low rounded-3xl p-6 gap-4">
                <Text className="text-on-surface text-xl font-bold font-headline text-center">{t('items.edit')}</Text>
                <TextInput
                  className="bg-surface-container rounded-xl px-4 py-3 text-lg text-on-surface"
                  value={editName} onChangeText={setEditName}
                />
                <Text className="text-on-surface-variant text-[11px] font-bold uppercase tracking-widest">Kategori</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <TouchableOpacity
                    className={`px-4 py-2 rounded-full mr-2 ${!editCategoryId ? 'bg-primary' : 'bg-surface-container'}`}
                    onPress={() => setEditCategoryId(null)}
                  >
                    <Text className={`text-sm font-semibold ${!editCategoryId ? 'text-on-primary' : 'text-on-surface'}`}>Ingen</Text>
                  </TouchableOpacity>
                  {categories.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      className={`px-4 py-2 rounded-full mr-2 ${editCategoryId === cat.id ? 'bg-primary' : 'bg-surface-container'}`}
                      onPress={() => setEditCategoryId(cat.id)}
                    >
                      <Text className={`text-sm font-semibold ${editCategoryId === cat.id ? 'text-on-primary' : 'text-on-surface'}`}>
                        {cat.emoji} {cat.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <View className="flex-row justify-between items-center">
                  <Text className="text-on-surface text-[11px] font-bold uppercase tracking-widest">Antall</Text>
                  <View className="flex-row items-center gap-4">
                    <TouchableOpacity className="w-9 h-9 rounded-full bg-surface-container items-center justify-center"
                      onPress={() => setEditQuantity(String(Math.max(1, parseInt(editQuantity) - 1)))}>
                      <Text className="text-on-surface text-xl">−</Text>
                    </TouchableOpacity>
                    <Text className="text-on-surface text-xl font-bold min-w-[28px] text-center">{editQuantity}</Text>
                    <TouchableOpacity className="w-9 h-9 rounded-full bg-surface-container items-center justify-center"
                      onPress={() => setEditQuantity(String(parseInt(editQuantity) + 1))}>
                      <Text className="text-on-surface text-xl">+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <TextInput
                  className="bg-surface-container rounded-xl px-4 py-3 text-lg text-on-surface"
                  value={editNote} onChangeText={setEditNote}
                  placeholder={t('items.note_placeholder')} placeholderTextColor="rgba(167,241,216,0.5)"
                />
                <View className="flex-row gap-3 mt-2">
                  <TouchableOpacity className="flex-1 py-4 items-center rounded-xl" onPress={() => setEditItem(null)}>
                    <Text className="text-primary text-lg font-semibold">{t('lists.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity className="flex-1 py-4 items-center rounded-xl bg-primary" onPress={handleSaveEdit}>
                    <Text className="text-on-primary text-lg font-semibold">{t('items.save')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      </View>
    </>
  );
}
