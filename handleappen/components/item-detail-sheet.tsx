import { useState, useEffect } from 'react';
import {
  Text, TextInput, TouchableOpacity, View, Modal, ScrollView,
  Platform, ActivityIndicator, Image, Pressable,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/useAuthStore';
import type { StorePrice } from '@/hooks/usePriceHistory';
import type { Database } from '@/types/database';
import type { KassalAllergen } from '@/lib/kassal';

type ListItem = Database['public']['Tables']['list_items']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];

const C = {
  bg: '#d8fff0', white: '#ffffff', low: '#bffee7', container: '#b2f6de',
  high: '#a7f1d8', highest: '#9decd2', primary: '#006947',
  primaryContainer: '#00feb2', text: '#00362a', textSec: '#2f6555',
  outline: '#81b8a5', error: '#b31b25',
  font: Platform.OS === 'web' ? "'Plus Jakarta Sans', system-ui, sans-serif" : undefined,
  fontBody: Platform.OS === 'web' ? "'Manrope', system-ui, sans-serif" : undefined,
};
const isWeb = Platform.OS === 'web';

interface PurchaseStat {
  count: number;
  lastDate: string | null;
  firstDate: string | null;
}

interface Props {
  item: ListItem | null;
  categories: Category[];
  storePrices: StorePrice[];
  latestPrice: { unitPrice: number; storeName: string; observedAt: string } | undefined;
  onClose: () => void;
  onSave: (id: string, updates: Partial<ListItem>) => Promise<void>;
  onDelete: (item: ListItem) => void;
}

function daysSince(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

export function ItemDetailSheet({ item, categories, storePrices, latestPrice, onClose, onSave, onDelete }: Props) {
  const householdId = useAuthStore((s) => s.householdId);

  // Edit state
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [note, setNote] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Stats
  const [stats, setStats] = useState<PurchaseStat | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Allergens
  const [allergens, setAllergens] = useState<KassalAllergen[]>([]);
  const [householdAllergens, setHouseholdAllergens] = useState<string[]>([]);

  useEffect(() => {
    if (!item) return;
    setName(item.name);
    setQuantity(String(item.quantity));
    setNote(item.note ?? '');
    setCategoryId(item.category_id);
    setStats(null);
    setAllergens([]);
    loadStats(item.name);
    loadAllergens(item);
  }, [item?.id]);

  // Load household allergen profile
  useEffect(() => {
    if (!householdId) return;
    supabase.from('households').select('allergens').eq('id', householdId).single().then(({ data }) => {
      setHouseholdAllergens(data?.allergens ?? []);
    });
  }, [householdId]);

  const loadStats = async (itemName: string) => {
    if (!householdId) return;
    setLoadingStats(true);
    const { data } = await supabase
      .from('list_activity')
      .select('created_at')
      .eq('action', 'checked')
      .ilike('item_name', itemName)
      .order('created_at', { ascending: false });

    if (data && data.length > 0) {
      setStats({
        count: data.length,
        lastDate: data[0].created_at,
        firstDate: data[data.length - 1].created_at,
      });
    } else {
      setStats({ count: 0, lastDate: null, firstDate: null });
    }
    setLoadingStats(false);
  };

  const loadAllergens = async (li: ListItem) => {
    const ean = (li as any).barcode;
    if (!ean) return;
    const { data } = await supabase
      .from('kassal_products')
      .select('allergens')
      .eq('ean', ean)
      .maybeSingle();
    if (data?.allergens) {
      setAllergens(data.allergens as KassalAllergen[]);
    }
  };

  // Map Kassal allergen codes to household allergen keys
  const allergenCodeMap: Record<string, string> = {
    gluten: 'gluten', wheat: 'gluten', barley: 'gluten', rye: 'gluten', oats: 'gluten',
    milk: 'laktose', lactose: 'laktose',
    egg: 'egg', eggs: 'egg',
    peanuts: 'peanøtter', peanut: 'peanøtter',
    nuts: 'trenøtter', tree_nuts: 'trenøtter', almonds: 'trenøtter', hazelnuts: 'trenøtter', walnuts: 'trenøtter', cashews: 'trenøtter',
    fish: 'fisk',
    crustaceans: 'skalldyr', shellfish: 'skalldyr', molluscs: 'skalldyr',
    soy: 'soya', soybeans: 'soya',
    celery: 'selleri',
    mustard: 'sennep',
    sesame: 'sesamfrø', sesame_seeds: 'sesamfrø',
    sulphites: 'svoveldioksid', sulphur_dioxide: 'svoveldioksid',
    lupin: 'lupin', lupine: 'lupin',
  };

  const isHouseholdAllergen = (a: KassalAllergen): boolean => {
    const code = a.code?.toLowerCase() ?? '';
    const mapped = allergenCodeMap[code];
    if (mapped && householdAllergens.includes(mapped)) return true;
    // Also try matching display_name against household allergen keys
    const dn = a.display_name?.toLowerCase() ?? '';
    return householdAllergens.some((ha) => dn.includes(ha));
  };

  const presentAllergens = allergens.filter((a) => a.contains === 'YES');
  const traceAllergens = allergens.filter((a) => a.contains === 'CAN_CONTAIN_TRACES');

  const handleSave = async () => {
    if (!item) return;
    setSaving(true);
    await onSave(item.id, {
      name: name.trim() || item.name,
      quantity: parseInt(quantity) || 1,
      note: note.trim() || null,
      category_id: categoryId,
    });
    setSaving(false);
    onClose();
  };

  const cheapestStore = storePrices.length > 0 ? storePrices[0] : null;

  return (
    <Modal visible={!!item} transparent animationType="slide">
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,54,42,0.3)' }}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />

        <View style={[{
          backgroundColor: C.white,
          borderTopLeftRadius: 28, borderTopRightRadius: 28,
          maxHeight: '88%' as any,
        }, isWeb ? ({ boxShadow: '0px -20px 60px rgba(0,54,42,0.15)' } as any) : {}]}>
          {/* Handle */}
          <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.outline + '66' }} />
          </View>

          <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">

            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 12 } as any}>
              {(item as any)?.image_url && (
                <Image
                  source={{ uri: (item as any).image_url }}
                  style={[
                    {
                      width: 64,
                      height: 64,
                      borderRadius: 12,
                      backgroundColor: '#ffffff',
                      padding: 8,
                    },
                    Platform.OS === 'web'
                      ? ({ boxShadow: '0px 2px 8px rgba(0,54,42,0.12)' } as any)
                      : {
                          shadowColor: '#00362a',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.12,
                          shadowRadius: 8,
                          elevation: 3,
                        },
                  ]}
                  resizeMode="contain"
                />
              )}
              <View style={{ flex: 1 }}>
                <TextInput
                  style={{ fontSize: 19, fontWeight: '800', color: C.text, fontFamily: C.font } as any}
                  value={name}
                  onChangeText={setName}
                />
              </View>
              <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
                <MaterialIcons name="close" size={22} color={C.textSec} />
              </TouchableOpacity>
            </View>

            {/* Stat-kort */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 } as any}>
              {/* Kjøpsfrekvens */}
              <View style={{ flex: 1, backgroundColor: C.low, borderRadius: 14, padding: 10 }}>
                <MaterialIcons name="shopping-cart" size={16} color={C.primary} />
                {loadingStats ? (
                  <ActivityIndicator size="small" color={C.primary} style={{ marginTop: 6 }} />
                ) : (
                  <>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: C.text, marginTop: 4, fontFamily: C.font } as any}>
                      {stats?.count ?? 0}× <Text style={{ fontSize: 11, fontWeight: '600', color: C.textSec } as any}>kjøpt</Text>
                    </Text>
                    {stats?.lastDate && (
                      <Text style={{ fontSize: 10, color: C.outline, marginTop: 2, fontFamily: C.fontBody } as any}>
                        sist for {daysSince(stats.lastDate)}d siden
                      </Text>
                    )}
                  </>
                )}
              </View>

              {/* Siste pris */}
              <View style={{ flex: 1, backgroundColor: C.low, borderRadius: 14, padding: 10 }}>
                <MaterialIcons name="sell" size={16} color={C.primary} />
                {latestPrice ? (
                  <>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: C.text, marginTop: 4, fontFamily: C.font } as any}>
                      {latestPrice.unitPrice.toFixed(0)} kr
                    </Text>
                    <Text style={{ fontSize: 10, color: C.textSec, fontFamily: C.fontBody } as any} numberOfLines={1}>
                      {latestPrice.storeName} · {daysSince(latestPrice.observedAt)}d siden
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: C.outline, marginTop: 4, fontFamily: C.font } as any}>—</Text>
                    <Text style={{ fontSize: 10, color: C.textSec, fontFamily: C.fontBody } as any}>ingen prisdata</Text>
                  </>
                )}
              </View>
            </View>

            {/* Prissammenligning mellom butikker */}
            {storePrices.length > 1 && (
              <View style={{ backgroundColor: C.container, borderRadius: 16, padding: 14, marginBottom: 20 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, color: C.textSec, fontFamily: C.fontBody, marginBottom: 10 } as any}>
                  Prissammenligning
                </Text>
                {storePrices.map((sp, i) => {
                  const isCheapest = i === 0;
                  const diff = cheapestStore ? sp.unitPrice - cheapestStore.unitPrice : 0;
                  return (
                    <View key={sp.storeLocationId} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: i < storePrices.length - 1 ? 8 : 0 } as any}>
                      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 } as any}>
                        {isCheapest && <MaterialIcons name="star" size={12} color={C.primary} />}
                        <Text style={{ fontSize: 14, fontWeight: isCheapest ? '700' : '500', color: C.text, fontFamily: C.fontBody } as any}>
                          {sp.storeName}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: isCheapest ? C.primary : C.text, fontFamily: C.fontBody } as any}>
                        {sp.unitPrice.toFixed(0)} kr
                      </Text>
                      {!isCheapest && diff > 0 && (
                        <Text style={{ fontSize: 11, color: C.textSec, marginLeft: 6, fontFamily: C.fontBody } as any}>
                          +{diff.toFixed(0)}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            {/* Allergener */}
            {(presentAllergens.length > 0 || traceAllergens.length > 0) && (
              <View style={{ backgroundColor: C.container, borderRadius: 16, padding: 14, marginBottom: 20 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, color: C.textSec, fontFamily: C.fontBody, marginBottom: 10 } as any}>
                  Allergener
                </Text>
                {presentAllergens.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: traceAllergens.length > 0 ? 10 : 0 } as any}>
                    {presentAllergens.map((a) => {
                      const warn = isHouseholdAllergen(a);
                      return (
                        <View
                          key={a.code}
                          style={{
                            flexDirection: 'row', alignItems: 'center', gap: 4,
                            paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
                            backgroundColor: warn ? 'rgba(201,123,0,0.15)' : C.low,
                            borderWidth: warn ? 1 : 0, borderColor: '#c97b00',
                          } as any}
                        >
                          {warn && <MaterialIcons name="warning-amber" size={13} color="#c97b00" />}
                          <Text style={{ fontSize: 12, fontWeight: warn ? '700' : '500', color: warn ? '#c97b00' : C.text, fontFamily: C.fontBody } as any}>
                            {a.display_name}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                )}
                {traceAllergens.length > 0 && (
                  <View>
                    <Text style={{ fontSize: 11, color: C.outline, fontFamily: C.fontBody, marginBottom: 6 } as any}>
                      Kan inneholde spor av:
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 } as any}>
                      {traceAllergens.map((a) => {
                        const warn = isHouseholdAllergen(a);
                        return (
                          <View
                            key={a.code}
                            style={{
                              paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
                              backgroundColor: warn ? 'rgba(201,123,0,0.08)' : C.low,
                            } as any}
                          >
                            <Text style={{ fontSize: 11, color: warn ? '#c97b00' : C.outline, fontFamily: C.fontBody, fontWeight: warn ? '600' : '400' } as any}>
                              {a.display_name}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Divider */}
            <View style={{ height: 1, backgroundColor: C.outline + '22', marginBottom: 14 }} />

            {/* Antall */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: C.text, fontFamily: C.font } as any}>Antall</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 } as any}>
                <TouchableOpacity
                  style={{ width: 30, height: 30, borderRadius: 999, backgroundColor: C.low, alignItems: 'center', justifyContent: 'center' }}
                  onPress={() => setQuantity(String(Math.max(1, parseInt(quantity) - 1)))}
                >
                  <Text style={{ color: C.text, fontSize: 18 }}>−</Text>
                </TouchableOpacity>
                <Text style={{ fontSize: 17, fontWeight: '700', color: C.text, minWidth: 24, textAlign: 'center' } as any}>{quantity}</Text>
                <TouchableOpacity
                  style={{ width: 30, height: 30, borderRadius: 999, backgroundColor: C.low, alignItems: 'center', justifyContent: 'center' }}
                  onPress={() => setQuantity(String(parseInt(quantity) + 1))}
                >
                  <Text style={{ color: C.text, fontSize: 18 }}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Kategori */}
            <Text style={{ fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, color: C.textSec, fontFamily: C.fontBody, marginBottom: 6 } as any}>
              Kategori
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: !categoryId ? C.primary : C.container }}
                  onPress={() => setCategoryId(null)}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: !categoryId ? C.white : C.text, fontFamily: C.fontBody } as any}>Ingen</Text>
                </TouchableOpacity>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: categoryId === cat.id ? C.primary : C.container }}
                    onPress={() => setCategoryId(cat.id)}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: categoryId === cat.id ? C.white : C.text, fontFamily: C.fontBody } as any}>
                      {cat.emoji} {cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Notat */}
            <TextInput
              style={[{
                backgroundColor: C.low, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
                fontSize: 15, color: C.text, fontFamily: C.fontBody, marginBottom: 24,
              } as any]}
              value={note}
              onChangeText={setNote}
              placeholder="Notat (f.eks. kjøp økologisk)..."
              placeholderTextColor={C.outline}
            />

            {/* Knapper */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 16, alignItems: 'center', borderRadius: 14, borderWidth: 1, borderColor: C.outline + '44' }}
                onPress={onClose}
              >
                <Text style={{ color: C.primary, fontSize: 16, fontWeight: '600', fontFamily: C.fontBody } as any}>Avbryt</Text>
              </TouchableOpacity>
              <Pressable
                style={({ pressed }) => [{
                  flex: 2, paddingVertical: 16, alignItems: 'center', borderRadius: 14,
                  backgroundColor: saving ? C.outline : C.primary, flexDirection: 'row', justifyContent: 'center', gap: 8,
                  transform: [{ scale: pressed && !saving ? 0.96 : 1 }],
                  ...(isWeb ? { transition: 'transform 0.1s' } : {}),
                } as any]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving && <ActivityIndicator size="small" color={C.white} />}
                <Text style={{ color: C.white, fontSize: 16, fontWeight: '600', fontFamily: C.fontBody } as any}>Lagre</Text>
              </Pressable>
            </View>

            {/* Slett */}
            <TouchableOpacity
              style={{ paddingVertical: 14, alignItems: 'center', borderRadius: 14, backgroundColor: 'rgba(179,27,37,0.07)' }}
              onPress={() => { onClose(); if (item) onDelete(item); }}
              activeOpacity={0.7}
            >
              <Text style={{ color: C.error, fontSize: 15, fontWeight: '600', fontFamily: C.fontBody } as any}>Slett vare</Text>
            </TouchableOpacity>

          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
