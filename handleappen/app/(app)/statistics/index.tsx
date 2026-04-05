import { useEffect, useState } from 'react';
import {
  Text,
  View,
  ScrollView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';

import { useAuthStore } from '@/stores/useAuthStore';
import { supabase } from '@/lib/supabase';

const color = {
  bg: '#d8fff0',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#bffee7',
  surfaceContainer: '#b2f6de',
  surfaceContainerHigh: '#a7f1d8',
  surfaceContainerHighest: '#9decd2',
  primary: '#006947',
  primaryContainer: '#00feb2',
  onPrimary: '#c8ffe0',
  onPrimaryContainer: '#005c3e',
  onSurface: '#00362a',
  onSurfaceVariant: '#2f6555',
  outlineVariant: '#81b8a5',
  secondary: '#006853',
  secondaryContainer: '#5afcd2',
  onSecondaryContainer: '#005d4a',
  tertiary: '#006575',
  error: '#b31b25',
};

const isWeb = Platform.OS === 'web';
const font = isWeb ? {
  headline: "'Plus Jakarta Sans', system-ui, sans-serif",
  body: "'Manrope', system-ui, sans-serif",
} : { headline: undefined, body: undefined };

interface MonthSpend {
  month: string; // "2026-02"
  label: string; // "Feb"
  total: number;
  tripCount: number;
}


interface StoreVisit {
  name: string;
  chain: string;
  visits: number;
  totalSpent: number;
}

interface GamificationData {
  streakWeeks: number;
  monthChange: number | null; // percentage change from previous month
  cheapestTrip: { store: string; amount: number; date: string } | null;
  biggestTrip: { store: string; amount: number; items: number } | null;
  totalTrips: number;
  uniqueStores: number;
  daysSinceLast: number | null;
  recordDaysBetween: number | null;
  avgSpendPerTrip: number | null;
  bestAvgSpendPerTrip: number | null; // record: highest single-trip amount
}

interface Stats {
  totalItems: number;
  totalChecked: number;
  totalLists: number;
  storeVisits: StoreVisit[];
  monthlySpend: MonthSpend[];
  gamification: GamificationData;
}

const fullMonthNames: Record<string, string> = {
  '01': 'Januar', '02': 'Februar', '03': 'Mars', '04': 'April',
  '05': 'Mai', '06': 'Juni', '07': 'Juli', '08': 'August',
  '09': 'September', '10': 'Oktober', '11': 'November', '12': 'Desember',
};

// Formatter en ISO-måned ('2026-04') til menneskelig label relativt til nå.
// "Denne måneden" for inneværende, fullt navn for siste 11 mnd, ellers "Mnd YY".
function formatMonthLabel(monthKey: string): string {
  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  if (monthKey === currentKey) return 'Denne måneden';

  const [yearStr, mmStr] = monthKey.split('-');
  const year = Number(yearStr);
  const monthNum = mmStr;
  const monthsAgo = (now.getFullYear() - year) * 12 + (now.getMonth() + 1 - Number(mmStr));
  const name = fullMonthNames[monthNum] ?? monthKey;
  if (monthsAgo <= 11) return name;
  return `${name} ${String(year).slice(2)}`;
}

export default function StatisticsScreen() {
  const insets = useSafeAreaInsets();
  const householdId = useAuthStore((s) => s.householdId);
  const [stats, setStats] = useState<Stats | null>(null);
  const [showAllStores, setShowAllStores] = useState(false);
  const [showAllMonths, setShowAllMonths] = useState(false);

  useEffect(() => {
    if (!householdId) return;
    loadStats();
  }, [householdId]);

  async function loadStats() {
    if (!householdId) return;

    // Parallel fetches
    const [
      { count: totalLists },
      { count: totalItems },
      { count: totalChecked },
      { data: receipts },
      { data: receiptItems },
    ] = await Promise.all([
      supabase.from('shopping_lists').select('*', { count: 'exact', head: true })
        .eq('household_id', householdId).eq('is_deleted', false),
      supabase.from('list_items').select('*', { count: 'exact', head: true })
        .eq('is_deleted', false),
      supabase.from('list_items').select('*', { count: 'exact', head: true })
        .eq('is_deleted', false).eq('is_checked', true),
      (supabase.from('receipts' as any)
        .select('id, total_amount, purchased_at, store_location_id, store_locations(name, chain)')
        .eq('household_id', householdId)
        .order('purchased_at', { ascending: false }) as any),
      (supabase.from('receipt_items' as any)
        .select('name, quantity, total_price, receipt_id') as any),
    ]);

    // --- Store visits ---
    const storeMap = new Map<string, StoreVisit>();
    for (const r of (receipts ?? [])) {
      const store = (r as any).store_locations;
      if (!store) continue;
      const key = r.store_location_id as string;
      const existing = storeMap.get(key);
      const amount = Number(r.total_amount) || 0;
      if (existing) {
        existing.visits++;
        existing.totalSpent += amount;
      } else {
        storeMap.set(key, {
          name: store.name,
          chain: store.chain,
          visits: 1,
          totalSpent: amount,
        });
      }
    }
    const storeVisits = [...storeMap.values()].sort((a, b) => b.visits - a.visits);

    // --- Monthly spend ---
    const monthMap = new Map<string, { total: number; tripCount: number }>();
    for (const r of (receipts ?? [])) {
      if (!r.purchased_at) continue;
      const month = (r.purchased_at as string).slice(0, 7); // "2026-02"
      const existing = monthMap.get(month);
      const amount = Number(r.total_amount) || 0;
      if (existing) {
        existing.total += amount;
        existing.tripCount++;
      } else {
        monthMap.set(month, { total: amount, tripCount: 1 });
      }
    }
    const monthlySpend: MonthSpend[] = [...monthMap.entries()]
      .sort((a, b) => b[0].localeCompare(a[0])) // nyeste først
      .map(([month, { total, tripCount }]) => ({
        month,
        label: formatMonthLabel(month),
        total,
        tripCount,
      }));

    // --- Gamification ---
    const allReceipts = receipts ?? [];

    // Streak: consecutive weeks with purchases
    const weekSet = new Set<string>();
    for (const r of allReceipts) {
      if (!r.purchased_at) continue;
      const d = new Date(r.purchased_at as string);
      const startOfYear = new Date(d.getFullYear(), 0, 1);
      const weekNum = Math.ceil(((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
      weekSet.add(`${d.getFullYear()}-W${weekNum}`);
    }
    const sortedWeeks = [...weekSet].sort().reverse();
    let streakWeeks = 0;
    for (let i = 0; i < sortedWeeks.length; i++) {
      if (i === 0) { streakWeeks = 1; continue; }
      // Simple consecutive check
      const [prevY, prevW] = sortedWeeks[i - 1].split('-W').map(Number);
      const [curY, curW] = sortedWeeks[i].split('-W').map(Number);
      if ((prevY === curY && prevW - curW === 1) || (prevY - curY === 1 && curW === 52 && prevW === 1)) {
        streakWeeks++;
      } else {
        break;
      }
    }

    // Month-over-month change (monthlySpend er nå sortert nyeste først)
    let monthChange: number | null = null;
    if (monthlySpend.length >= 2) {
      const curr = monthlySpend[0].total;
      const prev = monthlySpend[1].total;
      if (prev > 0) monthChange = Math.round(((curr - prev) / prev) * 100);
    }

    // Cheapest and biggest trips
    let cheapestTrip: GamificationData['cheapestTrip'] = null;
    let biggestTrip: GamificationData['biggestTrip'] = null;

    // Count items per receipt
    const itemsPerReceipt = new Map<string, number>();
    for (const ri of (receiptItems ?? [])) {
      const rid = ri.receipt_id as string;
      itemsPerReceipt.set(rid, (itemsPerReceipt.get(rid) ?? 0) + 1);
    }

    for (const r of allReceipts) {
      const amount = Number(r.total_amount) || 0;
      const store = (r as any).store_locations;
      const storeName = store?.name ?? 'Ukjent';
      const date = (r.purchased_at as string).slice(0, 10);
      const itemCount = itemsPerReceipt.get(r.id as string) ?? 0;

      if (amount > 0 && (!cheapestTrip || amount < cheapestTrip.amount)) {
        cheapestTrip = { store: storeName, amount, date };
      }
      if (!biggestTrip || itemCount > biggestTrip.items) {
        biggestTrip = { store: storeName, amount, items: itemCount };
      }
    }

    const uniqueStores = new Set(allReceipts.map((r: any) => r.store_location_id)).size;

    // --- Days since last trip ---
    let daysSinceLast: number | null = null;
    if (allReceipts.length > 0 && allReceipts[0].purchased_at) {
      const lastDate = new Date(allReceipts[0].purchased_at as string);
      const now = new Date();
      daysSinceLast = Math.floor((now.getTime() - lastDate.getTime()) / 86400000);
    }

    // --- Record days between trips ---
    let recordDaysBetween: number | null = null;
    const sortedReceipts = [...allReceipts]
      .filter((r) => r.purchased_at)
      .sort((a, b) => new Date(a.purchased_at as string).getTime() - new Date(b.purchased_at as string).getTime());
    for (let i = 1; i < sortedReceipts.length; i++) {
      const prev = new Date(sortedReceipts[i - 1].purchased_at as string);
      const curr = new Date(sortedReceipts[i].purchased_at as string);
      const days = Math.floor((curr.getTime() - prev.getTime()) / 86400000);
      if (recordDaysBetween === null || days > recordDaysBetween) {
        recordDaysBetween = days;
      }
    }

    // --- Average spend per trip ---
    let avgSpendPerTrip: number | null = null;
    const tripsWithAmount = allReceipts.filter((r) => Number(r.total_amount) > 0);
    if (tripsWithAmount.length > 0) {
      const totalSpent = tripsWithAmount.reduce((sum, r) => sum + Number(r.total_amount), 0);
      avgSpendPerTrip = Math.round(totalSpent / tripsWithAmount.length);
    }

    // --- Record (highest) single trip amount ---
    let bestAvgSpendPerTrip: number | null = null;
    for (const r of tripsWithAmount) {
      const amt = Number(r.total_amount);
      if (bestAvgSpendPerTrip === null || amt > bestAvgSpendPerTrip) {
        bestAvgSpendPerTrip = amt;
      }
    }

    setStats({
      totalItems: totalItems ?? 0,
      totalChecked: totalChecked ?? 0,
      totalLists: totalLists ?? 0,
      storeVisits,
      monthlySpend,
      gamification: {
        streakWeeks,
        monthChange,
        cheapestTrip,
        biggestTrip,
        totalTrips: allReceipts.length,
        uniqueStores,
        daysSinceLast,
        recordDaysBetween,
        avgSpendPerTrip,
        bestAvgSpendPerTrip,
      },
    });
  }


  const completionRate = stats && stats.totalItems > 0
    ? Math.round((stats.totalChecked / stats.totalItems) * 100)
    : 0;
  const maxMonthTotal = stats?.monthlySpend ? Math.max(...stats.monthlySpend.map((m) => m.total), 1) : 1;

  const cardStyle = {
    backgroundColor: color.surfaceContainerLowest,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: color.outlineVariant + '33',
    ...(isWeb ? { boxShadow: '0px 10px 30px rgba(0,54,42,0.04)' } : {}),
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 60,
          maxWidth: 720,
          alignSelf: 'center' as any,
          width: '100%' as any,
        }}
      >
        <Text style={{ fontSize: 24, fontWeight: '800', color: color.onSurface, letterSpacing: -0.5, fontFamily: font.headline }}>Innsikt</Text>
        <Text style={{ fontSize: 13, color: color.onSurfaceVariant, marginTop: 2, marginBottom: 16, fontFamily: font.body }}>Din handlevane og forbruk</Text>

        {/* ===== GAMIFICATION HERO ===== */}
        {stats && stats.gamification.totalTrips > 0 && stats.gamification.daysSinceLast !== null && (
          <View style={{ marginBottom: 16, gap: 8 } as any}>

            {/* Hovedkort: dager siden sist */}
            <View style={{
              borderRadius: 14, padding: 16,
              backgroundColor: color.surfaceContainerLowest,
              borderWidth: 1, borderColor: color.outlineVariant + '33',
              ...(isWeb ? { boxShadow: '0px 10px 30px rgba(0,54,42,0.06)' } : {}),
            } as any}>
              <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, color: color.onSurfaceVariant, marginBottom: 2, fontFamily: font.body } as any}>
                DAGER SIDEN SIST
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 6 } as any}>
                <Text style={{ fontSize: 44, fontWeight: '800', color: color.primary, lineHeight: 48, fontFamily: font.headline } as any}>
                  {stats.gamification.daysSinceLast}
                </Text>
                <Text style={{ fontSize: 15, fontWeight: '600', color: color.onSurfaceVariant, fontFamily: font.body } as any}>
                  dager
                </Text>
              </View>
              {stats.gamification.recordDaysBetween !== null && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 } as any}>
                  <View style={{ flex: 1, height: 4, backgroundColor: color.surfaceContainerHighest, borderRadius: 2, overflow: 'hidden' } as any}>
                    <View style={{
                      height: '100%', borderRadius: 2,
                      width: `${Math.min(100, (stats.gamification.daysSinceLast / stats.gamification.recordDaysBetween) * 100)}%`,
                      ...(isWeb ? { background: 'linear-gradient(90deg, #006947, #00feb2)' } : { backgroundColor: color.primary }),
                    } as any} />
                  </View>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: color.onSurfaceVariant, fontFamily: font.body, flexShrink: 0 } as any}>
                    {stats.gamification.daysSinceLast >= stats.gamification.recordDaysBetween
                      ? '🏆 Ny rekord!'
                      : `Rekord: ${stats.gamification.recordDaysBetween} dager`}
                  </Text>
                </View>
              )}
            </View>

            {/* Andre rad: snitt per tur + månedlig endring */}
            <View style={{ flexDirection: 'row', gap: 10 } as any}>
              {stats.gamification.avgSpendPerTrip !== null && (
                <View style={{
                  flex: 1, borderRadius: 20, padding: 20,
                  backgroundColor: color.surfaceContainerLowest,
                  borderWidth: 1, borderColor: color.outlineVariant + '33',
                  ...(isWeb ? { boxShadow: '0px 6px 20px rgba(0,54,42,0.04)' } : {}),
                } as any}>
                  <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 2, color: color.onSurfaceVariant, marginBottom: 6, fontFamily: font.body } as any}>
                    SNITT PER TUR
                  </Text>
                  <Text style={{ fontSize: 28, fontWeight: '800', color: color.onSurface, fontFamily: font.headline } as any}>
                    {stats.gamification.avgSpendPerTrip} kr
                  </Text>
                  {stats.gamification.bestAvgSpendPerTrip !== null && (
                    <Text style={{ fontSize: 12, color: color.onSurfaceVariant, marginTop: 4, fontFamily: font.body } as any}>
                      Høyeste tur: {Math.round(stats.gamification.bestAvgSpendPerTrip)} kr
                    </Text>
                  )}
                </View>
              )}

              {stats.gamification.monthChange !== null && (
                <View style={{
                  flex: 1, borderRadius: 20, padding: 20,
                  backgroundColor: color.surfaceContainerLowest,
                  borderWidth: 1, borderColor: color.outlineVariant + '33',
                  ...(isWeb ? { boxShadow: '0px 6px 20px rgba(0,54,42,0.04)' } : {}),
                } as any}>
                  <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 2, color: color.onSurfaceVariant, marginBottom: 6, fontFamily: font.body } as any}>
                    VS. FORRIGE MND
                  </Text>
                  <Text style={{
                    fontSize: 28, fontWeight: '800', fontFamily: font.headline,
                    color: stats.gamification.monthChange <= 0 ? color.primary : color.error,
                  } as any}>
                    {stats.gamification.monthChange > 0 ? '+' : ''}{stats.gamification.monthChange}%
                  </Text>
                  <Text style={{ fontSize: 12, color: color.onSurfaceVariant, marginTop: 4, fontFamily: font.body } as any}>
                    {stats.gamification.monthChange <= 0 ? 'Brukte mindre 👍' : 'Brukte mer'}
                  </Text>
                </View>
              )}
            </View>

            {/* Chips/badges */}
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' } as any}>
              {stats.gamification.totalTrips >= 1 && (
                <View style={{ backgroundColor: color.surfaceContainerHigh, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9999, flexDirection: 'row', alignItems: 'center', gap: 5 } as any}>
                  <Text style={{ fontSize: 13 }}>🧾</Text>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: color.onSurfaceVariant, fontFamily: font.body } as any}>{stats.gamification.totalTrips} turer totalt</Text>
                </View>
              )}
              {stats.gamification.uniqueStores >= 2 && (
                <View style={{ backgroundColor: color.surfaceContainerHigh, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9999, flexDirection: 'row', alignItems: 'center', gap: 5 } as any}>
                  <Text style={{ fontSize: 13 }}>🏪</Text>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: color.onSurfaceVariant, fontFamily: font.body } as any}>{stats.gamification.uniqueStores} butikker</Text>
                </View>
              )}
            </View>

          </View>
        )}

        {/* ===== MONTHLY SPEND ===== */}
        {stats && stats.monthlySpend.length > 0 && (
          <View style={[cardStyle, { padding: 14, marginBottom: 14 }] as any}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 } as any}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 } as any}>
                <MaterialIcons name="account-balance-wallet" size={18} color={color.primary} />
                <Text style={{ fontSize: 15, fontWeight: '700', color: color.onSurface, fontFamily: font.headline } as any}>Utgifter per måned</Text>
              </View>
              {stats.monthlySpend.length > 3 && (
                <TouchableOpacity onPress={() => setShowAllMonths((v) => !v)}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: color.primary, fontFamily: font.body } as any}>
                    {showAllMonths ? 'Vis færre' : `Se alle ${stats.monthlySpend.length}`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            {(showAllMonths ? stats.monthlySpend : stats.monthlySpend.slice(0, 3)).map((m, i, arr) => (
              <View key={m.month} style={{ marginBottom: i < arr.length - 1 ? 8 : 0 } as any}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 } as any}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: color.onSurface, fontFamily: font.body } as any}>{m.label}</Text>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: color.primary, fontFamily: font.body } as any}>
                    {m.total.toFixed(0)} kr · {m.tripCount} turer
                  </Text>
                </View>
                <View style={{ height: 5, backgroundColor: color.surfaceContainerHighest, borderRadius: 3, overflow: 'hidden' }}>
                  <View style={{
                    height: '100%', borderRadius: 3,
                    width: `${(m.total / maxMonthTotal) * 100}%`,
                    ...(isWeb ? { background: 'linear-gradient(90deg, #006947, #00feb2)' } : { backgroundColor: color.primary }),
                  } as any} />
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ===== STORE VISITS ===== */}
        {stats && stats.storeVisits.length > 0 && (
          <View style={[cardStyle, { padding: 14, marginBottom: 14 }] as any}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 } as any}>
                <MaterialIcons name="storefront" size={18} color={color.primary} />
                <Text style={{ fontSize: 15, fontWeight: '700', color: color.onSurface, fontFamily: font.headline } as any}>Butikker</Text>
              </View>
              {stats.storeVisits.length > 3 && (
                <TouchableOpacity onPress={() => setShowAllStores((v) => !v)}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: color.primary, fontFamily: font.body } as any}>
                    {showAllStores ? 'Vis færre' : `Se alle ${stats.storeVisits.length}`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            {(showAllStores ? stats.storeVisits : stats.storeVisits.slice(0, 3)).map((s, i) => (
              <View key={s.name} style={{
                flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                paddingVertical: 8,
                borderBottomWidth: i < (showAllStores ? stats.storeVisits.length : Math.min(3, stats.storeVisits.length)) - 1 ? 1 : 0,
                borderBottomColor: 'rgba(129,184,165,0.15)',
              } as any}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: color.onSurface, fontFamily: font.body } as any} numberOfLines={1}>{s.name}</Text>
                  <Text style={{ fontSize: 11, color: color.onSurfaceVariant, fontFamily: font.body } as any}>{s.chain} · {s.visits} turer</Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: '700', color: color.primary, fontFamily: font.body } as any}>
                  {s.totalSpent.toFixed(0)} kr
                </Text>
              </View>
            ))}
          </View>
        )}

        {stats && stats.storeVisits.length === 0 && stats.gamification.totalTrips === 0 && (
          <View style={{ alignItems: 'center', paddingTop: 40, gap: 14 }}>
            <MaterialIcons name="insights" size={56} color={color.outlineVariant} />
            <Text style={{ fontSize: 16, fontWeight: '700', color: color.onSurface, fontFamily: font.headline }}>Ingen innsikt ennå</Text>
            <Text style={{ fontSize: 14, color: color.onSurfaceVariant, textAlign: 'center', maxWidth: 280, lineHeight: 20 }}>
              Importer handlehistorikk fra Trumf, eller begynn å bruke handlelisten, så får du innsikt over tid.
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/(app)/settings/trumf-import')}
              activeOpacity={0.8}
              style={{
                marginTop: 8, backgroundColor: color.primary,
                paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999,
                flexDirection: 'row', alignItems: 'center', gap: 8,
              } as any}
            >
              <Text style={{ fontSize: 14 }}>🛒</Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#ffffff', fontFamily: font.body } as any}>
                Importer fra Trumf
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
