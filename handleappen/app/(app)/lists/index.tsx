import { useState, useEffect, memo } from 'react';
import { Text, TouchableOpacity, View, TextInput, Modal, ScrollView, Platform } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useShoppingLists } from '@/hooks/useShoppingLists';
import { useListItemCounts } from '@/hooks/useListItemCounts';
import { useAuthStore } from '@/stores/useAuthStore';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type ShoppingList = Database['public']['Tables']['shopping_lists']['Row'];

const C = {
  bg: '#d8fff0', white: '#ffffff', low: '#bffee7', high: '#a7f1d8',
  highest: '#9decd2', primary: '#006947', primaryContainer: '#00feb2',
  onPrimaryFixed: '#00472f', text: '#00362a', textSec: '#2f6555',
  outline: '#81b8a5', secondaryContainer: '#5afcd2', tertiary: '#006575',
  font: "'Plus Jakarta Sans', system-ui, sans-serif",
  fontBody: "'Manrope', system-ui, sans-serif",
};
const isWeb = Platform.OS === 'web';

function getListIcon(name: string) {
  const l = name.toLowerCase();
  if (l.includes('uke') || l.includes('daglig') || l.includes('mat')) return { icon: 'shopping-basket' as const, bg: C.primaryContainer };
  if (l.includes('bygg') || l.includes('verktøy')) return { icon: 'build' as const, bg: C.highest };
  if (l.includes('apotek') || l.includes('medisin')) return { icon: 'medical-services' as const, bg: C.secondaryContainer };
  return { icon: 'shopping-basket' as const, bg: C.primaryContainer };
}

const STORE_KEYWORDS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bspar\b|eurospar/i, label: 'Spar' },
  { pattern: /\brema\b|rema\s*1000/i, label: 'Rema' },
  { pattern: /\bkiwi\b/i, label: 'Kiwi' },
  { pattern: /\bmeny\b/i, label: 'Meny' },
  { pattern: /\bcoop\b|extra/i, label: 'Coop' },
  { pattern: /\bjoker\b/i, label: 'Joker' },
];

function getStoreHint(name: string): string | null {
  for (const { pattern, label } of STORE_KEYWORDS) {
    if (pattern.test(name)) return label;
  }
  return null;
}

const ListCard = memo(function ListCard({ item, itemCount, onDelete }: {
  item: ShoppingList;
  itemCount: { total: number; checked: number } | undefined;
  isFirst: boolean;
  onDelete: (item: ShoppingList) => void;
}) {
  const total = itemCount?.total ?? 0;
  const checked = itemCount?.checked ?? 0;
  const remaining = total - checked;
  const progress = total > 0 ? checked / total : 0;
  const isComplete = total > 0 && checked === total;
  const isActive = total > 0 && checked < total;
  const { icon, bg } = getListIcon(item.name);
  const storeHint = getStoreHint(item.name);

  return (
    <TouchableOpacity
      style={[{
        backgroundColor: C.white,
        borderRadius: 16, padding: 16,
        flexDirection: 'row', alignItems: 'center', gap: 14,
      }, isWeb ? ({ boxShadow: '0px 2px 10px rgba(0,54,42,0.06)' } as any) : {}]}
      onPress={() => router.push(`/(app)/lists/${item.id}`)}
      activeOpacity={0.85}
    >
      {/* Ikon */}
      <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: bg, justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
        <MaterialIcons name={icon} size={22} color={C.onPrimaryFixed} />
      </View>

      {/* Midten: navn + info + progress */}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 } as any}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: C.text, fontFamily: C.font, flexShrink: 1 } as any} numberOfLines={1}>
            {item.name}
          </Text>
          {storeHint && (
            <View style={{ backgroundColor: C.low, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2, flexShrink: 0 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: C.primary, fontFamily: C.fontBody } as any}>{storeHint}</Text>
            </View>
          )}
        </View>

        <Text style={{ fontSize: 14, color: C.textSec, fontFamily: C.fontBody, marginBottom: total > 0 ? 8 : 0 } as any}>
          {total === 0
            ? 'Tom liste'
            : isComplete
            ? `${total} varer handlet ✓`
            : checked > 0
            ? `${remaining} gjenstår · ${checked} av ${total} handlet`
            : `${total} vare${total !== 1 ? 'r' : ''}`}
        </Text>

        {total > 0 && (
          <View style={{ height: 3, backgroundColor: C.outline + '33', borderRadius: 2, overflow: 'hidden' }}>
            <View style={{
              height: 3,
              width: `${Math.round(progress * 100)}%`,
              backgroundColor: isComplete ? '#006853' : C.primary,
              borderRadius: 2,
            } as any} />
          </View>
        )}
      </View>

      {/* Høyre: status-badge + meny */}
      <View style={{ alignItems: 'flex-end', gap: 6, flexShrink: 0 } as any}>
        {isActive && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.primary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 } as any}>
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#ffffff' }} />
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#ffffff', textTransform: 'uppercase', letterSpacing: 1, fontFamily: C.fontBody } as any}>I gang</Text>
          </View>
        )}
        {isComplete && (
          <Text style={{ fontSize: 10, fontWeight: '700', color: '#006853', fontFamily: C.fontBody } as any}>✓</Text>
        )}
        {!isActive && !isComplete && (
          <Text style={{ fontSize: 11, color: C.outline, fontFamily: C.fontBody } as any}>
            {new Date(item.updated_at).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })}
          </Text>
        )}
        <TouchableOpacity
          onPress={(e) => { e.stopPropagation(); onDelete(item); }}
          activeOpacity={0.7}
          style={{ padding: 4 }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialIcons name="more-vert" size={18} color={C.outline} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
});

interface Recipe { id: string; name: string; base_servings: number; source_label: string | null }
interface HomeStats { totalTrips: number; avgSpend: number; monthTotal: number; monthChange: number | null }


export default function ListsScreen() {
  const { t } = useTranslation();
  const { lists, isLoading, createList, deleteList } = useShoppingLists();
  const [showModal, setShowModal] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [deleteConfirmList, setDeleteConfirmList] = useState<ShoppingList | null>(null);
  const insets = useSafeAreaInsets();
  const householdId = useAuthStore((s) => s.householdId);
  const itemCounts = useListItemCounts(lists.map((l) => l.id));

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [streakWeeks, setStreakWeeks] = useState<number>(0);
  const [homeStats, setHomeStats] = useState<HomeStats | null>(null);

  useEffect(() => {
    if (!householdId) return;

    // Siste handletur + streak fra prishistorikk
    supabase
      .from('price_history')
      .select('observed_at, unit_price, store_location_id, store_locations(name)')
      .order('observed_at', { ascending: false })
      .limit(500)
      .then(({ data }) => {
        if (!data || data.length === 0) return;
        // Grupper per dato+butikk, finn siste tur
        const map = new Map<string, { butikk: string; total: number; antall: number; dato: string }>();
        for (const row of data as any[]) {
          const dato = (row.observed_at as string).slice(0, 10);
          const key = `${dato}__${row.store_location_id}`;
          if (!map.has(key)) map.set(key, { butikk: row.store_locations?.name ?? 'Ukjent', total: 0, antall: 0, dato });
          const t = map.get(key)!;
          t.total += Number(row.unit_price);
          t.antall += 1;
        }
        const sorted = [...map.values()].sort((a, b) => b.dato.localeCompare(a.dato));

        // Streak
        const weeks = new Set(sorted.map((t) => {
          const d = new Date(t.dato);
          const jan1 = new Date(d.getFullYear(), 0, 1);
          return `${d.getFullYear()}-${Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7)}`;
        }));
        setStreakWeeks(weeks.size);

        // Månedlig forbruk + snitt per tur
        const now = new Date();
        const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const lastMonth = (() => { const d = new Date(now.getFullYear(), now.getMonth() - 1, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; })();
        const thisMonthTrips = sorted.filter((t) => t.dato.startsWith(thisMonth));
        const lastMonthTrips = sorted.filter((t) => t.dato.startsWith(lastMonth));
        const monthTotal = thisMonthTrips.reduce((s, t) => s + t.total, 0);
        const lastMonthTotal = lastMonthTrips.reduce((s, t) => s + t.total, 0);
        const monthChange = lastMonthTotal > 0 ? Math.round(((monthTotal - lastMonthTotal) / lastMonthTotal) * 100) : null;
        const totalSpendAll = sorted.reduce((s, t) => s + t.total, 0);
        const avgSpend = sorted.length > 0 ? Math.round(totalSpendAll / sorted.length) : 0;
        setHomeStats({ totalTrips: sorted.length, avgSpend, monthTotal, monthChange });
      });

    supabase.from('recipes')
      .select('id, name, base_servings, source_label')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false })
      .limit(4)
      .then(({ data }) => { if (data) setRecipes(data); });
  }, [householdId]);

  const handleCreate = async () => {
    if (!newListName.trim()) return;
    try { await createList(newListName.trim()); setNewListName(''); setShowModal(false); } catch (e) { console.error(e); }
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'God morgen' : hour < 18 ? 'God ettermiddag' : 'God kveld';

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      {isWeb && <View style={{ height: 58, marginTop: 'env(safe-area-inset-top, 0px)' } as any} />}
      <View style={{
        backgroundColor: 'rgba(236,253,245,0.92)', zIndex: 40,
        ...(isWeb ? { paddingTop: 'env(safe-area-inset-top, 0px)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', boxShadow: '0px 10px 30px rgba(0,54,42,0.06)', position: 'fixed', top: 0, left: 0, right: 0 } as any : { paddingTop: insets.top + 8 }),
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 } as any}>
            <MaterialIcons name="shopping-basket" size={22} color={C.primary} />
            <Text style={{ fontSize: 20, fontWeight: '800', color: C.text, fontFamily: C.font, letterSpacing: -0.5 } as any}>Handleliste</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 } as any}>
            <TouchableOpacity
              style={{ padding: 8, borderRadius: 9999 }}
              activeOpacity={0.7}
              onPress={() => router.push('/(app)/lists/recipes-list')}
            >
              <MaterialIcons name="restaurant-menu" size={22} color={C.textSec} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 28, paddingBottom: 160, maxWidth: 720, alignSelf: 'center' as any, width: '100%' as any }}>

        {/* Hilsen */}
        <View style={{ marginBottom: 32 }}>
          <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 3, color: C.textSec, marginBottom: 8, textTransform: 'uppercase', fontFamily: C.fontBody } as any}>Lister</Text>
          <Text style={{ fontSize: 28, fontWeight: '800', color: C.text, letterSpacing: -0.5, fontFamily: C.font } as any}>
            {greeting} 👋
          </Text>
          <Text style={{ fontSize: 16, color: C.textSec, marginTop: 6, fontFamily: C.fontBody } as any}>
            {lists.length > 0
              ? `${lists.length} liste${lists.length > 1 ? 'r' : ''} klar${lists.length > 1 ? 'e' : ''}`
              : 'Opprett din første handleliste'}
          </Text>
        </View>

        {/* Lister */}
        {isLoading ? (
          <View style={{ gap: 10, marginBottom: 32 } as any}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[{ backgroundColor: C.white, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, opacity: 1 - i * 0.2 }, isWeb ? ({ boxShadow: '0px 2px 10px rgba(0,54,42,0.06)' } as any) : {}]}>
                <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: C.low }} />
                <View style={{ flex: 1, gap: 8 } as any}>
                  <View style={{ height: 16, borderRadius: 6, backgroundColor: C.low, width: '60%' } as any} />
                  <View style={{ height: 12, borderRadius: 6, backgroundColor: C.low, width: '40%' } as any} />
                </View>
              </View>
            ))}
          </View>
        ) : lists.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: 40, gap: 12, marginBottom: 40 } as any}>
            <MaterialIcons name="playlist-add" size={56} color="rgba(0,105,71,0.15)" />
            <Text style={{ fontSize: 18, fontWeight: '600', color: C.text, fontFamily: C.font } as any}>{t('lists.empty')}</Text>
            <Text style={{ fontSize: 14, color: C.textSec, fontFamily: C.fontBody } as any}>{t('lists.empty_subtitle')}</Text>
          </View>
        ) : (
          <View style={{ gap: 10, marginBottom: 32 } as any}>
            {lists.map((item, i) => (
              <ListCard key={item.id} item={item} itemCount={itemCounts.get(item.id)} isFirst={i === 0} onDelete={setDeleteConfirmList} />
            ))}
          </View>
        )}

        {/* Ukesmeny-snarvei */}
        <TouchableOpacity
          onPress={() => router.push('/(app)/lists/meal-plan')}
          activeOpacity={0.8}
          style={[{
            backgroundColor: C.white, borderRadius: 20, padding: 16, marginBottom: 24,
            flexDirection: 'row', alignItems: 'center', gap: 14,
            borderWidth: 1, borderColor: C.outline + '22',
          }, isWeb ? ({ boxShadow: '0px 4px 12px rgba(0,54,42,0.04)' } as any) : {}]}
        >
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.low, alignItems: 'center', justifyContent: 'center' }}>
            <MaterialIcons name="restaurant-menu" size={22} color={C.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: C.text, fontFamily: C.fontBody } as any}>Ukesmeny</Text>
            <Text style={{ fontSize: 12, color: C.textSec, marginTop: 2, fontFamily: C.fontBody } as any}>Planlegg middager og legg ingredienser i liste</Text>
          </View>
          <MaterialIcons name="chevron-right" size={18} color={C.outline} />
        </TouchableOpacity>

        {/* Gamification-kort */}
        {homeStats && homeStats.totalTrips > 0 && (
          <TouchableOpacity
            onPress={() => router.push('/(app)/statistics')}
            activeOpacity={0.85}
            style={[{
              borderRadius: 22, marginBottom: 24, overflow: 'hidden',
            }, isWeb ? ({ boxShadow: '0px 8px 24px rgba(0,54,42,0.10)' } as any) : {}]}
          >
            {/* Bakgrunn */}
            <View style={{
              backgroundColor: C.primary,
              padding: 20,
              ...(isWeb ? { background: 'linear-gradient(135deg, #006947 0%, #00a66e 100%)' } as any : {}),
            }}>
              {/* Topplinje */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 } as any}>
                  <Text style={{ fontSize: 18, lineHeight: 22 }}>🛒</Text>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#ffffff', opacity: 0.9, fontFamily: C.fontBody, letterSpacing: 0.5 } as any}>Din handleprofil</Text>
                </View>
                <MaterialIcons name="chevron-right" size={18} color="rgba(255,255,255,0.6)" />
              </View>

              {/* Hoved-stats */}
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 } as any}>
                <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 14, padding: 14, alignItems: 'center' }}>
                  <Text style={{ fontSize: 26, fontWeight: '800', color: '#ffffff', fontFamily: C.font, lineHeight: 30 } as any}>{homeStats.totalTrips}</Text>
                  <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', fontFamily: C.fontBody, marginTop: 2, textAlign: 'center' } as any}>turer</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 14, padding: 14, alignItems: 'center' }}>
                  <Text style={{ fontSize: 26, fontWeight: '800', color: '#ffffff', fontFamily: C.font, lineHeight: 30 } as any}>
                    {homeStats.avgSpend >= 1000 ? `${(homeStats.avgSpend / 1000).toFixed(1)}k` : homeStats.avgSpend}
                  </Text>
                  <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', fontFamily: C.fontBody, marginTop: 2, textAlign: 'center' } as any}>snitt/tur</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 14, padding: 14, alignItems: 'center' }}>
                  <Text style={{ fontSize: 26, fontWeight: '800', color: '#ffffff', fontFamily: C.font, lineHeight: 30 } as any}>
                    {streakWeeks > 0 ? `${streakWeeks}` : '—'}
                  </Text>
                  <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', fontFamily: C.fontBody, marginTop: 2, textAlign: 'center' } as any}>{streakWeeks > 0 ? '🔥 uker' : 'uker'}</Text>
                </View>
              </View>

              {/* Bunn: denne måneden */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' } as any}>
                <View>
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', fontFamily: C.fontBody } as any}>Denne måneden</Text>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: '#ffffff', fontFamily: C.font, marginTop: 1 } as any}>
                    {homeStats.monthTotal >= 1000
                      ? `${(homeStats.monthTotal / 1000).toFixed(1)}k kr`
                      : `${homeStats.monthTotal.toFixed(0)} kr`}
                  </Text>
                </View>
                {homeStats.monthChange !== null && (
                  <View style={{
                    flexDirection: 'row', alignItems: 'center', gap: 4,
                    backgroundColor: homeStats.monthChange > 0 ? 'rgba(255,80,80,0.2)' : 'rgba(0,254,178,0.2)',
                    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
                  } as any}>
                    <MaterialIcons
                      name={homeStats.monthChange > 0 ? 'trending-up' : 'trending-down'}
                      size={14}
                      color={homeStats.monthChange > 0 ? '#ffaaaa' : '#00feb2'}
                    />
                    <Text style={{
                      fontSize: 13, fontWeight: '700', fontFamily: C.fontBody,
                      color: homeStats.monthChange > 0 ? '#ffaaaa' : '#00feb2',
                    } as any}>
                      {homeStats.monthChange > 0 ? '+' : ''}{homeStats.monthChange}%
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* Oppskrifter */}
        {recipes.length > 0 && (
          <View style={{ marginBottom: 40 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: C.text, fontFamily: C.font } as any}>Oppskrifter</Text>
              <TouchableOpacity onPress={() => router.push('/(app)/lists/recipes-list')} activeOpacity={0.7}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: C.primary, fontFamily: C.fontBody } as any}>Se alle</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 } as any}>
              {recipes.map((r) => (
                <TouchableOpacity
                  key={r.id}
                  onPress={() => router.push('/(app)/lists/recipes-list')}
                  activeOpacity={0.7}
                  style={[{
                    flexDirection: 'row', alignItems: 'center', gap: 10,
                    backgroundColor: C.white, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
                    borderWidth: 1, borderColor: C.outline + '33',
                  }, isWeb ? ({ boxShadow: '0px 2px 8px rgba(0,54,42,0.04)' } as any) : {}]}
                >
                  <MaterialIcons name="restaurant" size={16} color={C.primary} />
                  <View>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: C.text, fontFamily: C.fontBody } as any}>{r.name}</Text>
                    {r.source_label && (
                      <Text style={{ fontSize: 11, color: C.textSec, fontFamily: C.fontBody } as any}>{r.source_label}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                onPress={() => router.push('/(app)/lists/recipe')}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 8,
                  backgroundColor: C.low, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
                  borderWidth: 1, borderColor: C.outline + '33', borderStyle: 'dashed',
                } as any}
              >
                <MaterialIcons name="add" size={16} color={C.textSec} />
                <Text style={{ fontSize: 14, fontWeight: '600', color: C.textSec, fontFamily: C.fontBody } as any}>Importer</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

      </ScrollView>

      {/* Mini-FAB — importer oppskrift */}
      <TouchableOpacity
        style={[{
          position: 'absolute', bottom: 96 + insets.bottom + 72, right: 24, zIndex: 50,
          width: 44, height: 44, borderRadius: 22,
          backgroundColor: C.white,
          alignItems: 'center', justifyContent: 'center',
          borderWidth: 1.5, borderColor: C.outline + '55',
        }, isWeb ? ({ boxShadow: '0px 4px 16px rgba(0,54,42,0.12)' } as any) : {}]}
        onPress={() => router.push('/(app)/lists/recipe')}
        activeOpacity={0.8}
      >
        <MaterialIcons name="restaurant-menu" size={20} color={C.primary} />
      </TouchableOpacity>

      {/* FAB — ny liste */}
      <TouchableOpacity
        style={{
          position: 'absolute', bottom: 96 + insets.bottom, right: 24, zIndex: 50,
          paddingVertical: 20, paddingHorizontal: 20, borderRadius: 9999,
          backgroundColor: C.primary,
          ...(isWeb ? { background: 'linear-gradient(135deg, #006947, #00feb2)', boxShadow: '0px 20px 50px rgba(0,105,71,0.3)' } as any : {}),
        } as any}
        onPress={() => setShowModal(true)}
        activeOpacity={0.8}
      >
        <MaterialIcons name="add" size={28} color="#ffffff" />
      </TouchableOpacity>

      {/* Slett liste-dialog */}
      <Modal visible={!!deleteConfirmList} transparent animationType="fade">
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,54,42,0.35)', justifyContent: 'center', paddingHorizontal: 24 }}
          activeOpacity={1}
          onPress={() => setDeleteConfirmList(null)}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={{
              backgroundColor: C.white, borderRadius: 24, padding: 28, gap: 16,
              maxWidth: 480, alignSelf: 'center', width: '100%',
              ...(isWeb ? ({ boxShadow: '0px 30px 60px rgba(0,54,42,0.15)' } as any) : {}),
            } as any}>
              <View style={{ alignItems: 'center', gap: 8 }}>
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(179,27,37,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                  <MaterialIcons name="delete-outline" size={24} color="#b31b25" />
                </View>
                <Text style={{ fontSize: 18, fontWeight: '700', color: C.text, fontFamily: C.font, textAlign: 'center' } as any}>
                  Slett liste?
                </Text>
                <Text style={{ fontSize: 15, color: C.textSec, fontFamily: C.fontBody, textAlign: 'center' } as any}>
                  «{deleteConfirmList?.name}» vil bli slettet permanent.
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity
                  style={{ flex: 1, paddingVertical: 16, alignItems: 'center', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(129,184,165,0.3)' }}
                  onPress={() => setDeleteConfirmList(null)}
                >
                  <Text style={{ fontSize: 17, fontWeight: '600', color: C.primary, fontFamily: C.fontBody } as any}>Avbryt</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, paddingVertical: 16, alignItems: 'center', borderRadius: 14, backgroundColor: '#b31b25' }}
                  onPress={async () => {
                    if (!deleteConfirmList) return;
                    setDeleteConfirmList(null);
                    await deleteList(deleteConfirmList.id);
                  }}
                >
                  <Text style={{ fontSize: 17, fontWeight: '600', color: C.white, fontFamily: C.fontBody } as any}>Slett</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Modal — ny liste */}
      <Modal visible={showModal} transparent animationType="fade">
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,54,42,0.35)', justifyContent: 'center', paddingHorizontal: 24 }}
          activeOpacity={1}
          onPress={() => { setShowModal(false); setNewListName(''); }}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={{
              backgroundColor: C.white, borderRadius: 24, padding: 28, gap: 16,
              maxWidth: 480, alignSelf: 'center', width: '100%',
              ...(isWeb ? ({ boxShadow: '0px 30px 60px rgba(0,54,42,0.15)' } as any) : {}),
            } as any}>
              <Text style={{ fontSize: 22, fontWeight: '700', color: C.text, textAlign: 'center', fontFamily: C.font } as any}>
                Ny liste
              </Text>
              <TextInput
                style={{
                  backgroundColor: C.low, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 16,
                  fontSize: 17, color: C.text, fontFamily: C.fontBody,
                  borderWidth: 1, borderColor: 'rgba(129,184,165,0.3)',
                } as any}
                placeholder="Navn på listen..."
                placeholderTextColor={C.outline}
                value={newListName}
                onChangeText={setNewListName}
                onSubmitEditing={handleCreate}
                returnKeyType="done"
                autoFocus
              />
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                <TouchableOpacity
                  style={{ flex: 1, paddingVertical: 16, alignItems: 'center', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(129,184,165,0.3)' }}
                  onPress={() => { setShowModal(false); setNewListName(''); }}
                >
                  <Text style={{ fontSize: 17, fontWeight: '600', color: C.primary, fontFamily: C.fontBody } as any}>Avbryt</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, paddingVertical: 16, alignItems: 'center', borderRadius: 14, backgroundColor: C.primary, opacity: !newListName.trim() ? 0.5 : 1 }}
                  onPress={handleCreate}
                  disabled={!newListName.trim()}
                >
                  <Text style={{ fontSize: 17, fontWeight: '600', color: '#ffffff', fontFamily: C.fontBody } as any}>Opprett</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
