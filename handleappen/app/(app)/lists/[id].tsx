import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Text, TextInput, TouchableOpacity, View, Modal, ScrollView, Platform, Pressable } from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StitchAppBar } from '@/components/stitch-app-bar';
import { StitchCard } from '@/components/stitch-card';
import { ItemDetailSheet } from '@/components/item-detail-sheet';
import { useListItems } from '@/hooks/useListItems';
import { useCategories } from '@/hooks/useCategories';
import { usePriceHistory } from '@/hooks/usePriceHistory';
import { BarcodeScanner } from '@/components/barcode-scanner';
import { StorePicker } from '@/components/store-picker';
import { CategoryOrderEditor } from '@/components/category-order-editor';
import { ReceiptScanner } from '@/components/receipt-scanner';
import { useSmartSuggestions } from '@/hooks/useSmartSuggestions';
import { useBasketSuggestions } from '@/hooks/useBasketSuggestions';
import { useCategoryOrder } from '@/hooks/useCategoryOrder';
import { useItemSearch } from '@/hooks/useItemSearch';
import { useExpectedList } from '@/hooks/useExpectedList';
import { useEnrichItems } from '@/hooks/useEnrichItems';
import { useSortedItems, SORT_OPTIONS, type SortMode } from '@/hooks/useSortedItems';
import { DraggableList } from '@/components/draggable-list';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/useAuthStore';
import { lookupByEan, searchProducts, type KassalProduct } from '@/lib/kassal';
import type { StoreWithDistance } from '@/hooks/useNearbyStores';
import type { Database } from '@/types/database';

type ListItem = Database['public']['Tables']['list_items']['Row'];

const C = {
  bg: '#d8fff0',
  white: '#ffffff',
  low: '#bffee7',
  container: '#b2f6de',
  high: '#a7f1d8',
  highest: '#9decd2',
  primary: '#006947',
  primaryContainer: '#00feb2',
  onPrimaryFixed: '#00472f',
  text: '#00362a',
  textSec: '#2f6555',
  outline: '#81b8a5',
  secondaryContainer: '#5afcd2',
  onSecContainer: '#005d4a',
  tertiary: '#006575',
  font: "'Plus Jakarta Sans', system-ui, sans-serif",
  fontBody: "'Manrope', system-ui, sans-serif",
};

export default function ListDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { activeItems, checkedItems, items, addItem, toggleItem, updateItem, deleteItem } = useListItems(id);
  const categories = useCategories();
  const catMap = useMemo(() => new Map(categories.map((cat) => [cat.id, cat])), [categories]);
  const quantityMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const item of items) m.set(item.name, item.quantity);
    return m;
  }, [items]);
  const priceHistory = usePriceHistory(items.map((i) => i.name), quantityMap);
  const smartSuggestions = useSmartSuggestions(id, items.map((i) => i.name));
  const basketSuggestions = useBasketSuggestions(activeItems.map((i) => i.name));

  const [selectedStore, setSelectedStore] = useState<StoreWithDistance | null>(null);
  const [showCategoryOrder, setShowCategoryOrder] = useState(false);
  const categoryOrder = useCategoryOrder(selectedStore?.id ?? null);

  const expectedList = useExpectedList(items.map((i) => i.name));
  useEnrichItems(items);
  const [showExpected, setShowExpected] = useState(false);

  const [sortMode, setSortMode] = useState<SortMode>('store');
  const [manualOrder, setManualOrder] = useState<string[]>([]); // item ids in manual order

  const sortedActiveItems = useSortedItems(
    sortMode === 'manual' && manualOrder.length > 0
      ? activeItems.map((item, i) => ({ ...item, sort_order: manualOrder.indexOf(item.id) }))
      : activeItems,
    sortMode,
    categoryOrder.orderedCategories,
    catMap,
    categoryOrder.hasCustomOrder,
  );

  const [newItemName, setNewItemName] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const itemSearch = useItemSearch();
  const [showChecked, setShowChecked] = useState(true);
  const [showScanner, setShowScanner] = useState(false);
  const [showReceiptScanner, setShowReceiptScanner] = useState(false);
  const [kassalResults, setKassalResults] = useState<KassalProduct[]>([]);
  const kassalSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editItem, setEditItem] = useState<ListItem | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<ListItem | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [listName, setListName] = useState('');
  const householdId = useAuthStore((s) => s.householdId);

  useEffect(() => {
    if (!id) return;
    supabase.from('shopping_lists').select('name').eq('id', id).single().then(({ data }) => {
      if (data) setListName(data.name);
    });
  }, [id]);

  const totalAll = activeItems.length + checkedItems.length;
  const progress = totalAll > 0 ? Math.round((checkedItems.length / totalAll) * 100) : 0;
  const estimate = useMemo(() => priceHistory.totalEstimate(), [priceHistory]);

  const handleAdd = async (name?: string, quantity = 1, categoryId?: string, kassalMeta?: { barcode?: string; imageUrl?: string; weight?: number | null; weightUnit?: string | null }) => {
    const itemName = name ?? newItemName;
    if (!itemName.trim()) return;
    await addItem(itemName, quantity, categoryId, kassalMeta);
    if (!name) setNewItemName('');
    setSearchResults([]);
    setKassalResults([]);
    smartSuggestions.accept(itemName);
  };

  const handleBarcodeScan = useCallback(async (barcode: string) => {
    setShowScanner(false);
    const product = await lookupByEan(barcode);
    if (product) {
      await handleAdd(product.name, 1, undefined, {
        barcode: product.ean,
        imageUrl: product.imageUrl ?? undefined,
        weight: product.weight,
        weightUnit: product.weightUnit ?? undefined,
      });
    } else {
      setNewItemName(barcode);
    }
  }, []);

  const handleKassalSearch = useCallback((text: string) => {
    if (kassalSearchTimeout.current) clearTimeout(kassalSearchTimeout.current);
    if (text.trim().length < 2) { setKassalResults([]); return; }
    kassalSearchTimeout.current = setTimeout(async () => {
      const results = await searchProducts(text, 5);
      setKassalResults(results);
    }, 600);
  }, []);

  const handleSaveEdit = async (id: string, updates: Partial<ListItem>) => {
    await updateItem(id, updates);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <StitchAppBar onBack={() => router.canGoBack() ? router.back() : router.replace('/(app)/lists')} title={listName || 'Liste'} />

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 160, maxWidth: 672, marginHorizontal: 'auto', width: '100%' }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Store Selector */}
          <View style={[{ marginBottom: 24, backgroundColor: C.white, borderRadius: 20, padding: 16 }, Platform.OS === 'web' ? { boxShadow: '0px 4px 12px rgba(0,54,42,0.04)' } as any : {}]}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: C.textSec, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8, fontFamily: C.fontBody } as any}>Butikk</Text>
            <StorePicker selectedStoreId={selectedStore?.id ?? null} onSelect={setSelectedStore} />
          </View>

          {/* Add Item */}
          <View style={{ marginBottom: (searchResults.length > 0 || kassalResults.length > 0) ? 0 : 20 }}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <View
                style={[
                  { flex: 1, backgroundColor: 'rgba(178,246,222,0.5)', borderRadius: 999, paddingHorizontal: 18, paddingVertical: 12, flexDirection: 'row', alignItems: 'center' },
                ]}
              >
                <MaterialIcons name="shopping-basket" size={18} color={C.textSec} style={{ marginRight: 10 }} />
                <TextInput
                  style={{ flex: 1, fontSize: 15, color: C.text, fontWeight: '500', fontFamily: C.fontBody }}
                  placeholder="Legg til i listen..."
                  placeholderTextColor="rgba(47,101,85,0.5)"
                  value={newItemName}
                  onChangeText={(text) => {
                    setNewItemName(text);
                    setSearchResults(itemSearch.search(text));
                    handleKassalSearch(text);
                  }}
                  onSubmitEditing={() => handleAdd()}
                  returnKeyType="done"
                />
              </View>
              <Pressable
                style={({ pressed }) => [
                  { width: 44, height: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: C.primary, transform: [{ scale: pressed ? 0.94 : 1 }] },
                  Platform.OS === 'web' ? ({ boxShadow: '0px 4px 16px rgba(0,105,71,0.35)', transition: 'transform 0.1s' } as any) : undefined,
                ]}
                onPress={() => handleAdd()}
              >
                <MaterialIcons name="add" size={22} color={C.white} />
              </Pressable>
              {Platform.OS === 'web' && (
                <>
                  <TouchableOpacity
                    onPress={() => setShowScanner(true)}
                    style={{ width: 40, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white, borderWidth: 1, borderColor: C.outline + '44' }}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name="qr-code-scanner" size={18} color={C.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setShowReceiptScanner(true)}
                    style={{ width: 40, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white, borderWidth: 1, borderColor: C.outline + '44' }}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name="receipt-long" size={18} color={C.primary} />
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* Autocomplete dropdown — historikk */}
            {searchResults.length > 0 && (
              <View
                style={[
                  { marginTop: 4, marginBottom: 8, borderRadius: 16, overflow: 'hidden', backgroundColor: C.white },
                  Platform.OS === 'web' ? ({ boxShadow: '0px 8px 24px rgba(0,54,42,0.10)' } as any) : {},
                ]}
              >
                {searchResults.map((name, i) => (
                  <TouchableOpacity
                    key={name}
                    onPress={() => { handleAdd(name); setKassalResults([]); }}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 20,
                      paddingVertical: 14,
                      borderBottomWidth: i < searchResults.length - 1 ? 1 : 0,
                      borderBottomColor: C.low,
                    }}
                  >
                    <MaterialIcons name="history" size={16} color={C.outline} style={{ marginRight: 12 }} />
                    <Text style={{ fontSize: 16, color: C.text, fontFamily: C.fontBody }}>{name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Kassal produktsøk */}
            {kassalResults.length > 0 && (
              <View
                style={[
                  { marginTop: searchResults.length > 0 ? 0 : 4, marginBottom: 16, borderRadius: 16, overflow: 'hidden', backgroundColor: C.white },
                  Platform.OS === 'web' ? ({ boxShadow: '0px 8px 24px rgba(0,54,42,0.10)' } as any) : {},
                ]}
              >
                <Text style={{ fontSize: 10, fontWeight: '700', color: C.textSec, textTransform: 'uppercase', letterSpacing: 1.2, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4, fontFamily: C.fontBody } as any}>
                  Fra Kassal
                </Text>
                {kassalResults.map((product, i) => (
                  <TouchableOpacity
                    key={product.id}
                    onPress={() => { handleAdd(product.name, 1, undefined, { barcode: product.ean, imageUrl: product.imageUrl ?? undefined, weight: product.weight, weightUnit: product.weightUnit ?? undefined }); setKassalResults([]); }}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 20,
                      paddingVertical: 12,
                      borderBottomWidth: i < kassalResults.length - 1 ? 1 : 0,
                      borderBottomColor: C.low,
                    }}
                  >
                    <MaterialIcons name="storefront" size={16} color={C.primary} style={{ marginRight: 12 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, color: C.text, fontFamily: C.fontBody, fontWeight: '500' }}>{product.name}</Text>
                      {product.brand && (
                        <Text style={{ fontSize: 12, color: C.textSec, fontFamily: C.fontBody }}>{product.brand}</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {showScanner && <BarcodeScanner onScan={handleBarcodeScan} onClose={() => setShowScanner(false)} />}

          {totalAll === 0 ? (
            <View style={{ alignItems: 'center', paddingTop: 64, gap: 12 }}>
              <MaterialIcons name="shopping-cart" size={56} color="rgba(0,105,71,0.15)" />
              <Text style={{ fontSize: 20, fontWeight: '700', fontFamily: C.font, color: C.text }}>{t('items.no_items')}</Text>
              <Text style={{ color: C.textSec, fontFamily: C.fontBody }}>{t('items.no_items_subtitle')}</Text>
            </View>
          ) : (
            <>
              {/* Section header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, marginBottom: 12 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, color: C.textSec, opacity: 0.8, fontFamily: C.font }}>
                  Aktive Varer ({activeItems.length})
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 } as any}>
                  {totalAll > 0 && (
                    <TouchableOpacity onPress={() => setShowClearConfirm(true)} activeOpacity={0.7} style={{ padding: 4 }}>
                      <MaterialIcons name="delete-sweep" size={18} color={C.textSec} />
                    </TouchableOpacity>
                  )}
                  <View style={{ backgroundColor: C.primaryContainer, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: C.primary, fontFamily: C.font }}>{progress}% ferdig</Text>
                  </View>
                </View>
              </View>

              {/* Sort chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}>
                {SORT_OPTIONS.map((opt) => {
                  const active = sortMode === opt.mode;
                  return (
                    <TouchableOpacity
                      key={opt.mode}
                      onPress={() => setSortMode(opt.mode)}
                      activeOpacity={0.7}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 4,
                        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
                        backgroundColor: active ? C.primary : C.low,
                      }}
                    >
                      <MaterialIcons name={opt.icon as any} size={13} color={active ? C.white : C.textSec} />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: active ? C.white : C.textSec, fontFamily: C.font }}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Active items */}
              {sortMode === 'manual' ? (
                <DraggableList
                  data={sortedActiveItems}
                  keyExtractor={(item) => item.id}
                  onReorder={(from, to) => {
                    const reordered = [...sortedActiveItems];
                    const [moved] = reordered.splice(from, 1);
                    reordered.splice(to, 0, moved);
                    const newOrder = reordered.map((i) => i.id);
                    setManualOrder(newOrder);
                    // Persist to DB
                    const userId = useAuthStore.getState().userId;
                    if (userId) {
                      Promise.all(
                        newOrder.map((itemId, idx) =>
                          supabase.from('list_items').update({ sort_order: idx }).eq('id', itemId)
                        )
                      );
                    }
                  }}
                  renderItem={(item, isDragging) => {
                    const cat = catMap.get(item.category_id ?? '');
                    const price = priceHistory.getPrice(item.name);
                    const exclusiveStore = priceHistory.getExclusiveStore(item.name);
                    const weightLabel = (item as any).weight && (item as any).weight_unit
                      ? `${(item as any).weight} ${(item as any).weight_unit}`
                      : null;
                    return (
                      <TouchableOpacity
                        style={[
                          { backgroundColor: isDragging ? C.low : C.white, padding: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 16 },
                          Platform.OS === 'web' ? ({ boxShadow: '0px 10px 30px rgba(0,54,42,0.04)' } as any) : undefined,
                        ]}
                        onPress={() => setEditItem(item)}
                        activeOpacity={0.7}
                      >
                        <MaterialIcons name="drag-handle" size={18} color={C.outline} />
                        <TouchableOpacity
                          style={{ width: 24, height: 24, borderRadius: 999, borderWidth: 2, borderColor: C.primary, alignItems: 'center', justifyContent: 'center', backgroundColor: item.is_checked ? C.primary : 'transparent' }}
                          onPress={() => toggleItem(item)}
                        >
                          {item.is_checked && <MaterialIcons name="check" size={14} color={C.white} />}
                        </TouchableOpacity>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            {cat && <Text style={{ fontSize: 18 }}>{cat.emoji}</Text>}
                            <Text style={{ fontWeight: '700', color: C.text, fontSize: 18, lineHeight: 24, fontFamily: C.fontBody }}>{item.name}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 } as any}>
                            {item.quantity > 1 && (
                              <View style={{ backgroundColor: C.container, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                                <Text style={{ fontSize: 12, fontWeight: '700', color: C.textSec, fontFamily: C.fontBody } as any}>{item.quantity} stk</Text>
                              </View>
                            )}
                            {weightLabel && (
                              <Text style={{ fontSize: 12, color: C.textSec, fontFamily: C.fontBody } as any}>{weightLabel}</Text>
                            )}
                            {price && <Text style={{ fontSize: 12, color: C.textSec, fontFamily: C.fontBody } as any}>ca. {price.unitPrice.toFixed(0)} kr</Text>}
                            {exclusiveStore && (
                              <View style={{ backgroundColor: 'rgba(0,101,117,0.1)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                                <Text style={{ fontSize: 11, fontWeight: '700', color: C.tertiary, fontFamily: C.fontBody } as any}>{exclusiveStore}</Text>
                              </View>
                            )}
                            {item.note ? <Text style={{ fontSize: 12, color: C.textSec, fontStyle: 'italic', fontFamily: C.fontBody } as any}>{item.note}</Text> : null}
                          </View>
                        </View>
                        <TouchableOpacity onPress={() => setDeleteConfirmItem(item)} style={{ opacity: 0.4 }}>
                          <MaterialIcons name="more-vert" size={18} color={C.textSec} />
                        </TouchableOpacity>
                      </TouchableOpacity>
                    );
                  }}
                />
              ) : (
                <View style={{ gap: 12 }}>
                  {sortedActiveItems.map((item) => {
                    const cat = catMap.get(item.category_id ?? '');
                    const price = priceHistory.getPrice(item.name);
                    const exclusiveStore = priceHistory.getExclusiveStore(item.name);
                    const weightLabel = (item as any).weight && (item as any).weight_unit
                      ? `${(item as any).weight} ${(item as any).weight_unit}`
                      : null;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[
                          { backgroundColor: C.white, padding: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 16 },
                          Platform.OS === 'web' ? ({ boxShadow: '0px 10px 30px rgba(0,54,42,0.04)' } as any) : undefined,
                        ]}
                        onPress={() => setEditItem(item)}
                        activeOpacity={0.7}
                      >
                        <TouchableOpacity
                          style={{ width: 24, height: 24, borderRadius: 999, borderWidth: 2, borderColor: C.primary, alignItems: 'center', justifyContent: 'center', backgroundColor: item.is_checked ? C.primary : 'transparent' }}
                          onPress={() => toggleItem(item)}
                        >
                          {item.is_checked && <MaterialIcons name="check" size={14} color={C.white} />}
                        </TouchableOpacity>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            {cat && <Text style={{ fontSize: 18 }}>{cat.emoji}</Text>}
                            <Text style={{ fontWeight: '700', color: C.text, fontSize: 18, lineHeight: 24, fontFamily: C.fontBody }}>{item.name}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 } as any}>
                            {item.quantity > 1 && (
                              <View style={{ backgroundColor: C.container, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                                <Text style={{ fontSize: 12, fontWeight: '700', color: C.textSec, fontFamily: C.fontBody } as any}>{item.quantity} stk</Text>
                              </View>
                            )}
                            {weightLabel && (
                              <Text style={{ fontSize: 12, color: C.textSec, fontFamily: C.fontBody } as any}>{weightLabel}</Text>
                            )}
                            {price && <Text style={{ fontSize: 12, color: C.textSec, fontFamily: C.fontBody } as any}>ca. {price.unitPrice.toFixed(0)} kr</Text>}
                            {exclusiveStore && (
                              <View style={{ backgroundColor: 'rgba(0,101,117,0.1)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                                <Text style={{ fontSize: 11, fontWeight: '700', color: C.tertiary, fontFamily: C.fontBody } as any}>{exclusiveStore}</Text>
                              </View>
                            )}
                            {item.note ? <Text style={{ fontSize: 12, color: C.textSec, fontStyle: 'italic', fontFamily: C.fontBody } as any}>{item.note}</Text> : null}
                          </View>
                        </View>
                        <TouchableOpacity onPress={() => setDeleteConfirmItem(item)} style={{ opacity: 0.4 }}>
                          <MaterialIcons name="more-vert" size={18} color={C.textSec} />
                        </TouchableOpacity>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Price estimate — only show when we have price data */}
              {estimate.knownCount > 0 && (
                <View style={{ marginTop: 24, padding: 20, backgroundColor: 'rgba(0,254,178,0.3)', borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: C.primary, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4, fontFamily: C.fontBody } as any}>Estimert total</Text>
                    <Text style={{ fontSize: 28, fontWeight: '800', color: C.text, fontFamily: C.font } as any}>ca. {estimate.estimate.toFixed(0)} kr</Text>
                  </View>
                  <Text style={{ fontSize: 12, color: C.textSec, fontFamily: C.fontBody } as any}>{estimate.knownCount}/{estimate.totalCount} varer</Text>
                </View>
              )}

              {/* Checked items */}
              {checkedItems.length > 0 && (
                <View style={{ marginTop: 40, opacity: 0.4 }}>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, marginBottom: 12 }}
                    onPress={() => setShowChecked(!showChecked)}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, color: C.textSec, fontFamily: C.font }}>
                      Kjøpt ({checkedItems.length})
                    </Text>
                    <MaterialIcons name={showChecked ? 'expand-more' : 'chevron-right'} size={18} color={C.textSec} />
                  </TouchableOpacity>
                  {showChecked && (
                    <View style={{ gap: 12 }}>
                      {checkedItems.map((item) => (
                        <TouchableOpacity
                          key={item.id}
                          style={{ backgroundColor: C.low, padding: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 16 }}
                          onPress={() => toggleItem(item)}
                          activeOpacity={0.7}
                        >
                          <View style={{ width: 24, height: 24, borderRadius: 999, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' }}>
                            <MaterialIcons name="check" size={14} color={C.white} />
                          </View>
                          <Text style={{ fontWeight: '700', color: C.text, textDecorationLine: 'line-through', fontFamily: C.fontBody, flex: 1 }}>{item.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* Glemte du? — market basket suggestions */}
              {basketSuggestions.length > 0 && (
                <View style={{ marginTop: 40, marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, paddingHorizontal: 8 }}>
                    <MaterialIcons name="help-outline" size={16} color={C.textSec} />
                    <Text style={{ fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, color: C.textSec, fontFamily: C.font }}>
                      Glemte du?
                    </Text>
                  </View>
                  <View style={{ gap: 8 }}>
                    {basketSuggestions.map((sg) => (
                      <TouchableOpacity
                        key={sg.name}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, backgroundColor: C.low }}
                        onPress={() => handleAdd(sg.name, sg.typicalQuantity, sg.categoryId ?? undefined)}
                        activeOpacity={0.7}
                      >
                        <MaterialIcons name="add-circle-outline" size={20} color={C.primary} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontWeight: '600', color: C.text, fontFamily: C.fontBody }}>{sg.name}</Text>
                          <Text style={{ fontSize: 11, color: C.textSec, fontFamily: C.fontBody }}>
                            Kjøpt sammen med {sg.pairedWith} {sg.coOccurrences}×
                            {sg.typicalQuantity > 1 ? ` · vanligvis ${sg.typicalQuantity} stk` : ''}
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          {sg.typicalQuantity > 1 && (
                            <View style={{ backgroundColor: C.primaryContainer, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                              <Text style={{ fontSize: 12, fontWeight: '700', color: C.onPrimaryFixed, fontFamily: C.fontBody }}>{sg.typicalQuantity}</Text>
                            </View>
                          )}
                          <MaterialIcons name="chevron-right" size={16} color={C.textSec} />
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Smart Forslag */}
              {(smartSuggestions.suggestions.length > 0 || smartSuggestions.loading) && (
                <View style={{ marginTop: 48, marginBottom: 40 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16, paddingHorizontal: 8 }}>
                    <MaterialIcons name="bolt" size={18} color={C.primary} />
                    <Text style={{ fontSize: 14, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5, color: C.primary, fontFamily: C.font }}>
                      Smart Forslag
                    </Text>
                    {smartSuggestions.loading && (
                      <Text style={{ fontSize: 12, color: C.textSec, fontFamily: C.fontBody }}>Tenker...</Text>
                    )}
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: 'row', gap: 12, paddingBottom: 16 }}>
                      {smartSuggestions.suggestions.map((sg) => (
                        <View
                          key={sg.name}
                          style={{ backgroundColor: C.secondaryContainer, borderRadius: 16, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' }}
                        >
                          <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 16, paddingRight: 8, paddingVertical: 12 }}
                            onPress={() => handleAdd(sg.name, 1, sg.categoryId ?? undefined)}
                            activeOpacity={0.7}
                          >
                            <Text style={{ color: C.onSecContainer, fontWeight: '700', fontFamily: C.fontBody }}>{sg.name}</Text>
                            <MaterialIcons name="add-circle" size={16} color={C.onSecContainer} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={{ paddingHorizontal: 8, paddingVertical: 12 }}
                            onPress={() => smartSuggestions.dismiss(sg.name)}
                            activeOpacity={0.7}
                          >
                            <MaterialIcons name="close" size={14} color={C.textSec} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              )}
            </>
          )}

          {/* Forventet handleliste — vises alltid, også når listen er tom */}
          {expectedList.expectedItems.length > 0 && (
            <View style={{ marginTop: totalAll === 0 ? 16 : 48, marginBottom: 24 }}>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, paddingHorizontal: 8 }}
                onPress={() => setShowExpected((v) => !v)}
                activeOpacity={0.7}
              >
                <MaterialIcons name="playlist-add-check" size={18} color={C.tertiary} />
                <Text style={{ fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, color: C.tertiary, fontFamily: C.font, flex: 1 }}>
                  Forventet handleliste
                </Text>
                <Text style={{ fontSize: 11, color: C.textSec, fontFamily: C.fontBody, marginRight: 4 }}>
                  {expectedList.expectedItems.length} varer
                </Text>
                <MaterialIcons name={showExpected ? 'expand-less' : 'expand-more'} size={18} color={C.textSec} />
              </TouchableOpacity>

              {showExpected && (
                <>
                  <View style={{ gap: 8 }}>
                    {expectedList.expectedItems.map((item) => (
                      <TouchableOpacity
                        key={item.name}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, backgroundColor: C.container }}
                        onPress={() => handleAdd(item.name, item.typicalQuantity, item.categoryId)}
                        activeOpacity={0.7}
                      >
                        <MaterialIcons name="add-circle-outline" size={20} color={C.tertiary} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontWeight: '600', color: C.text, fontFamily: C.fontBody }}>{item.name}</Text>
                          <Text style={{ fontSize: 11, color: C.textSec, fontFamily: C.fontBody }}>
                            Kjøpt {item.purchaseCount}×
                            {item.daysSinceLast < 90 ? ` · sist for ${item.daysSinceLast}d siden` : ''}
                          </Text>
                        </View>
                        {item.typicalQuantity > 1 && (
                          <View style={{ backgroundColor: 'rgba(0,101,117,0.12)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: C.tertiary, fontFamily: C.fontBody }}>{item.typicalQuantity}</Text>
                          </View>
                        )}
                        <MaterialIcons name="chevron-right" size={16} color={C.textSec} />
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Legg til alle */}
                  <TouchableOpacity
                    style={[
                      { marginTop: 12, paddingVertical: 14, borderRadius: 16, alignItems: 'center', backgroundColor: C.tertiary },
                      Platform.OS === 'web' ? ({ boxShadow: '0px 4px 16px rgba(0,101,117,0.25)' } as any) : {},
                    ]}
                    onPress={async () => {
                      for (const item of expectedList.expectedItems) {
                        await handleAdd(item.name, item.typicalQuantity, item.categoryId);
                      }
                      setShowExpected(false);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={{ fontSize: 15, fontWeight: '700', color: C.white, fontFamily: C.font }}>
                      Legg til alle ({expectedList.expectedItems.length})
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
        </ScrollView>

        <ItemDetailSheet
          item={editItem}
          categories={categories}
          storePrices={editItem ? priceHistory.getStoreComparison(editItem.name) : []}
          latestPrice={editItem ? priceHistory.getPrice(editItem.name) : undefined}
          onClose={() => setEditItem(null)}
          onSave={handleSaveEdit}
          onDelete={(item) => { setEditItem(null); setDeleteConfirmItem(item); }}
        />

        {/* Delete confirmation modal */}
        <Modal visible={!!deleteConfirmItem} transparent animationType="fade">
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: 'rgba(0,54,42,0.3)', justifyContent: 'center', paddingHorizontal: 24 }}
            activeOpacity={1}
            onPress={() => setDeleteConfirmItem(null)}
          >
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              <View style={[
                { backgroundColor: C.white, borderRadius: 24, padding: 24, gap: 16, maxWidth: 480, alignSelf: 'center', width: '100%' },
                Platform.OS === 'web' ? ({ boxShadow: '0px 10px 30px rgba(0,54,42,0.12)' } as any) : undefined,
              ]}>
                <View style={{ alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(179,27,37,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialIcons name="delete-outline" size={24} color="#b31b25" />
                  </View>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: C.text, fontFamily: C.font, textAlign: 'center' }}>
                    Slett vare?
                  </Text>
                  <Text style={{ fontSize: 15, color: C.textSec, fontFamily: C.fontBody, textAlign: 'center' }}>
                    «{deleteConfirmItem?.name}» vil bli fjernet fra listen.
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TouchableOpacity
                    style={{ flex: 1, paddingVertical: 16, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(129,184,165,0.3)' }}
                    onPress={() => setDeleteConfirmItem(null)}
                  >
                    <Text style={{ color: C.primary, fontSize: 16, fontWeight: '600', fontFamily: C.fontBody }}>Avbryt</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flex: 1, paddingVertical: 16, alignItems: 'center', borderRadius: 12, backgroundColor: '#b31b25' }}
                    onPress={async () => {
                      if (deleteConfirmItem) {
                        await deleteItem(deleteConfirmItem);
                        setDeleteConfirmItem(null);
                      }
                    }}
                  >
                    <Text style={{ color: C.white, fontSize: 16, fontWeight: '600', fontFamily: C.fontBody }}>Slett</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        {/* Clear list confirmation modal */}
        <Modal visible={showClearConfirm} transparent animationType="fade">
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: 'rgba(0,54,42,0.3)', justifyContent: 'center', paddingHorizontal: 24 }}
            activeOpacity={1}
            onPress={() => setShowClearConfirm(false)}
          >
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              <View style={[
                { backgroundColor: C.white, borderRadius: 24, padding: 24, gap: 16, maxWidth: 480, alignSelf: 'center', width: '100%' },
                Platform.OS === 'web' ? ({ boxShadow: '0px 10px 30px rgba(0,54,42,0.12)' } as any) : undefined,
              ]}>
                <View style={{ alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(179,27,37,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialIcons name="delete-sweep" size={24} color="#b31b25" />
                  </View>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: C.text, fontFamily: C.font, textAlign: 'center' }}>
                    Tøm listen?
                  </Text>
                  <Text style={{ fontSize: 15, color: C.textSec, fontFamily: C.fontBody, textAlign: 'center' }}>
                    Alle {totalAll} varer blir fjernet fra listen.
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TouchableOpacity
                    style={{ flex: 1, paddingVertical: 16, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(129,184,165,0.3)' }}
                    onPress={() => setShowClearConfirm(false)}
                  >
                    <Text style={{ color: C.primary, fontSize: 16, fontWeight: '600', fontFamily: C.fontBody }}>Avbryt</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flex: 1, paddingVertical: 16, alignItems: 'center', borderRadius: 12, backgroundColor: '#b31b25' }}
                    onPress={async () => {
                      setShowClearConfirm(false);
                      await supabase.from('list_items').update({ is_deleted: true }).eq('list_id', id);
                    }}
                  >
                    <Text style={{ color: C.white, fontSize: 16, fontWeight: '600', fontFamily: C.fontBody }}>Tøm</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        <CategoryOrderEditor
          storeLocationId={selectedStore?.id ?? null}
          storeName={selectedStore?.name ?? ''}
          visible={showCategoryOrder}
          onClose={() => setShowCategoryOrder(false)}
        />

        <ReceiptScanner
          visible={showReceiptScanner}
          storeLocationId={selectedStore?.id ?? null}
          storeName={selectedStore?.name ?? null}
          onClose={() => setShowReceiptScanner(false)}
          onSaved={(count) => {
            setShowReceiptScanner(false);
            // priceHistory will auto-refetch on next render via useEffect
          }}
        />
      </View>
    </>
  );
}
