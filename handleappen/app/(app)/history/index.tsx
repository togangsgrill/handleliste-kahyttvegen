import { useState, useEffect, useRef } from 'react';
import { Text, TextInput, TouchableOpacity, View, ScrollView, Platform, Modal, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
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
  font: Platform.OS === 'web' ? "'Plus Jakarta Sans', system-ui, sans-serif" : undefined,
  fontBody: Platform.OS === 'web' ? "'Manrope', system-ui, sans-serif" : undefined,
};

const isWeb = Platform.OS === 'web';

interface Trip {
  dato: string;          // ISO date string
  butikk: string;
  antall_varer: number;
  total: number;
  store_location_id: string;
}

interface TripItem {
  item_name: string;
  unit_price: number;
}

interface SearchResult {
  item_name: string;
  unit_price: number;
  observed_at: string;
  store_name: string;
}

interface PendingVisit {
  id: string;
  detected_at: string;
  store_locations: { name: string; chain: string } | null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' });
}

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

// ---- Handletur-bottomsheet ----
function TripSheet({ trip, onClose }: { trip: Trip | null; onClose: () => void }) {
  const [items, setItems] = useState<TripItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!trip) return;
    setLoading(true);
    const dayStart = trip.dato + 'T00:00:00.000Z';
    const dayEnd = trip.dato + 'T23:59:59.999Z';
    supabase
      .from('price_history')
      .select('item_name, unit_price')
      .eq('store_location_id', trip.store_location_id)
      .gte('observed_at', dayStart)
      .lte('observed_at', dayEnd)
      .order('unit_price', { ascending: false })
      .then(({ data }) => {
        setItems(data ?? []);
        setLoading(false);
      });
  }, [trip?.dato, trip?.store_location_id]);

  if (!trip) return null;

  return (
    <Modal visible={!!trip} transparent animationType="slide">
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,54,42,0.3)' }}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={[{
          backgroundColor: C.white,
          borderTopLeftRadius: 28, borderTopRightRadius: 28,
          maxHeight: '85%' as any,
        }, isWeb ? ({ boxShadow: '0px -20px 60px rgba(0,54,42,0.15)' } as any) : {}]}>
          <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.outline + '66' }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 20 } as any}>
              <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: C.low, alignItems: 'center', justifyContent: 'center' }}>
                <MaterialIcons name="shopping-basket" size={22} color={C.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: C.text, fontFamily: C.font } as any}>{trip.butikk}</Text>
                <Text style={{ fontSize: 13, color: C.textSec, fontFamily: C.fontBody, marginTop: 2 } as any}>{formatDate(trip.dato)}</Text>
              </View>
              <TouchableOpacity onPress={onClose}>
                <MaterialIcons name="close" size={22} color={C.textSec} />
              </TouchableOpacity>
            </View>

            {/* Nøkkeltall */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 } as any}>
              <View style={{ flex: 1, backgroundColor: C.low, borderRadius: 16, padding: 14 }}>
                <MaterialIcons name="receipt" size={16} color={C.primary} />
                <Text style={{ fontSize: 24, fontWeight: '800', color: C.text, marginTop: 8, fontFamily: C.font } as any}>
                  {trip.total.toFixed(0)} kr
                </Text>
                <Text style={{ fontSize: 12, color: C.textSec, fontFamily: C.fontBody } as any}>totalt</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: C.low, borderRadius: 16, padding: 14 }}>
                <MaterialIcons name="shopping-cart" size={16} color={C.primary} />
                <Text style={{ fontSize: 24, fontWeight: '800', color: C.text, marginTop: 8, fontFamily: C.font } as any}>
                  {trip.antall_varer}
                </Text>
                <Text style={{ fontSize: 12, color: C.textSec, fontFamily: C.fontBody } as any}>varer</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: C.low, borderRadius: 16, padding: 14 }}>
                <MaterialIcons name="sell" size={16} color={C.primary} />
                <Text style={{ fontSize: 24, fontWeight: '800', color: C.text, marginTop: 8, fontFamily: C.font } as any}>
                  {(trip.total / trip.antall_varer).toFixed(0)} kr
                </Text>
                <Text style={{ fontSize: 12, color: C.textSec, fontFamily: C.fontBody } as any}>snitt/vare</Text>
              </View>
            </View>

            {/* Vareliste */}
            <Text style={{ fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, color: C.textSec, fontFamily: C.fontBody, marginBottom: 10 } as any}>
              Kjøpte varer
            </Text>
            {loading ? (
              <ActivityIndicator color={C.primary} />
            ) : (
              <View style={{ backgroundColor: C.container, borderRadius: 16, overflow: 'hidden' }}>
                {items.map((item, i) => (
                  <View key={i} style={[
                    { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 16 } as any,
                    i < items.length - 1 ? { borderBottomWidth: 1, borderBottomColor: 'rgba(0,54,42,0.07)' } : {},
                  ]}>
                    <Text style={{ flex: 1, fontSize: 14, fontWeight: '500', color: C.text, fontFamily: C.fontBody, textTransform: 'capitalize' } as any}>
                      {item.item_name}
                    </Text>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: C.primary, fontFamily: C.fontBody } as any}>
                      {item.unit_price.toFixed(0)} kr
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const householdId = useAuthStore((s) => s.householdId);
  const userId = useAuthStore((s) => s.userId);

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(true);
  const [showAllTrips, setShowAllTrips] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [pendingVisit, setPendingVisit] = useState<PendingVisit | null>(null);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from('detected_visits')
      .select('id, detected_at, store_locations(name, chain)')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('detected_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => { if (data) setPendingVisit(data as unknown as PendingVisit); });
  }, [userId]);

  useEffect(() => {
    if (!householdId) return;
    setLoadingTrips(true);
    supabase
      .from('price_history')
      .select('observed_at, unit_price, store_location_id, store_locations(name)')
      .order('observed_at', { ascending: false })
      .limit(2000)
      .then(({ data }) => {
        if (!data) { setLoadingTrips(false); return; }

        // Grupper per dato + butikk
        const map = new Map<string, Trip>();
        for (const row of data as any[]) {
          const dato = row.observed_at.slice(0, 10);
          const key = `${dato}__${row.store_location_id}`;
          if (!map.has(key)) {
            map.set(key, {
              dato,
              butikk: row.store_locations?.name ?? 'Ukjent',
              antall_varer: 0,
              total: 0,
              store_location_id: row.store_location_id,
            });
          }
          const t = map.get(key)!;
          t.antall_varer += 1;
          t.total += Number(row.unit_price);
        }
        const sorted = [...map.values()].sort((a, b) => b.dato.localeCompare(a.dato));
        setTrips(sorted);
        setLoadingTrips(false);
      });
  }, [householdId]);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!query.trim()) { setSearched(false); setSearchResults([]); return; }
    searchTimerRef.current = setTimeout(async () => {
      setSearched(true);
      const { data } = await supabase
        .from('price_history')
        .select('item_name, unit_price, observed_at, store_locations(name)')
        .ilike('item_name', `%${query.trim()}%`)
        .order('observed_at', { ascending: false })
        .limit(30);
      setSearchResults((data ?? []).map((r: any) => ({
        item_name: r.item_name,
        unit_price: r.unit_price,
        observed_at: r.observed_at,
        store_name: r.store_locations?.name ?? 'Ukjent',
      })));
    }, 300);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [query]);

  const handleVisitResponse = async (confirmed: boolean) => {
    if (!pendingVisit) return;
    await supabase.from('detected_visits').update({
      status: confirmed ? 'confirmed' : 'dismissed',
      ...(confirmed ? { confirmed_at: new Date().toISOString() } : {}),
    }).eq('id', pendingVisit.id);
    setPendingVisit(null);
  };

  const visibleTrips = showAllTrips ? trips : trips.slice(0, 8);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      {isWeb && <View style={{ height: 58, marginTop: 'env(safe-area-inset-top, 0px)' } as any} />}
      <View style={{
        backgroundColor: 'rgba(236,253,245,0.92)', zIndex: 40,
        ...(isWeb ? { paddingTop: 'env(safe-area-inset-top, 0px)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', boxShadow: '0px 10px 30px rgba(0,54,42,0.06)', position: 'fixed', top: 0, left: 0, right: 0 } as any : { paddingTop: insets.top + 8 }),
      }}>
        <View style={{ paddingHorizontal: 24, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 10 } as any}>
          <MaterialIcons name="shopping-basket" size={22} color={C.primary} />
          <Text style={{ fontSize: 20, fontWeight: '800', color: C.text, letterSpacing: -0.5, fontFamily: C.font } as any}>Handleliste</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 28, paddingBottom: 160, maxWidth: 720, alignSelf: 'center' as any, width: '100%' as any }}>

        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 3, color: C.textSec, marginBottom: 8, textTransform: 'uppercase', fontFamily: C.fontBody } as any}>Historikk</Text>
          <Text style={{ fontSize: 28, fontWeight: '800', color: C.text, letterSpacing: -0.5, fontFamily: C.font } as any}>Handlehistorikk</Text>
          <Text style={{ fontSize: 16, color: C.textSec, marginTop: 6, fontFamily: C.fontBody } as any}>Dine handleturer</Text>
        </View>

        {/* Pending visit */}
        {pendingVisit && (
          <View style={[{
            backgroundColor: C.primary, borderRadius: 16, padding: 24, marginBottom: 24, gap: 16,
          }, isWeb ? { boxShadow: '0px 20px 40px rgba(0,105,71,0.25)' } as any : {}]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 } as any}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' }}>
                <MaterialIcons name="store" size={22} color="#ffffff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 2, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', fontFamily: C.fontBody } as any}>Handlet du nylig?</Text>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#ffffff', fontFamily: C.font, marginTop: 2 } as any}>
                  {pendingVisit.store_locations?.name ?? 'Ukjent butikk'}{' '}
                  kl. {new Date(pendingVisit.detected_at).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 12 } as any}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}
                onPress={() => handleVisitResponse(false)} activeOpacity={0.8}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#ffffff', fontFamily: C.fontBody } as any}>Nei</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 2, paddingVertical: 14, alignItems: 'center', borderRadius: 14, backgroundColor: '#ffffff' }}
                onPress={() => handleVisitResponse(true)} activeOpacity={0.8}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: C.primary, fontFamily: C.fontBody } as any}>Ja, bekreft</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Søk */}
        <View style={{ marginBottom: 24 }}>
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 10,
            backgroundColor: 'rgba(157,236,210,0.5)', borderWidth: 1, borderColor: C.outline + '4D',
            borderRadius: 9999, paddingHorizontal: 20, height: 52,
          } as any}>
            <MaterialIcons name="search" size={20} color={C.textSec} />
            <TextInput
              style={{ flex: 1, fontSize: 16, color: C.text, fontWeight: '500', fontFamily: C.fontBody } as any}
              placeholder="Søk etter vare..."
              placeholderTextColor={C.outline}
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')}>
                <MaterialIcons name="close" size={18} color={C.textSec} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Søkeresultater */}
        {searched && (
          <View style={[{
            backgroundColor: C.white, borderRadius: 20, overflow: 'hidden',
            borderWidth: 1, borderColor: C.outline + '33', marginBottom: 24,
          }, isWeb ? { boxShadow: '0px 8px 24px rgba(0,54,42,0.06)' } as any : {}]}>
            <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.outline + '22' }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: C.textSec, textTransform: 'uppercase', letterSpacing: 1.5, fontFamily: C.fontBody } as any}>
                {searchResults.length} treff for «{query}»
              </Text>
            </View>
            {searchResults.length === 0 ? (
              <View style={{ padding: 20 }}>
                <Text style={{ color: C.textSec, fontFamily: C.fontBody } as any}>Ingen treff — prøv et annet søkeord</Text>
              </View>
            ) : searchResults.map((r, i) => (
              <View key={i} style={[
                { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, gap: 12 } as any,
                i < searchResults.length - 1 ? { borderBottomWidth: 1, borderBottomColor: C.outline + '22' } : {},
              ]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: C.text, fontFamily: C.fontBody, textTransform: 'capitalize' } as any}>{r.item_name}</Text>
                  <Text style={{ fontSize: 12, color: C.textSec, marginTop: 2, fontFamily: C.fontBody } as any}>
                    {r.store_name} · {daysSince(r.observed_at) === 0 ? 'i dag' : `${daysSince(r.observed_at)}d siden`}
                  </Text>
                </View>
                <Text style={{ fontSize: 15, fontWeight: '700', color: C.primary, fontFamily: C.fontBody } as any}>
                  {r.unit_price.toFixed(0)} kr
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Handleturer */}
        {!searched && (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 14 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: C.text, fontFamily: C.font } as any}>Handleturer</Text>
              {trips.length > 8 && (
                <TouchableOpacity onPress={() => setShowAllTrips((v) => !v)}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: C.primary, fontFamily: C.fontBody } as any}>
                    {showAllTrips ? 'Vis færre' : `Se alle ${trips.length}`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {loadingTrips ? (
              <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} />
            ) : trips.length === 0 ? (
              <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 } as any}>
                <MaterialIcons name="shopping-cart" size={56} color="rgba(0,105,71,0.15)" />
                <Text style={{ fontSize: 18, fontWeight: '600', color: C.text, fontFamily: C.font } as any}>Ingen handleturer ennå</Text>
                <Text style={{ fontSize: 15, color: C.textSec, textAlign: 'center', fontFamily: C.fontBody } as any}>Scan en kvittering for å komme i gang</Text>
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                {visibleTrips.map((trip, i) => {
                  const ago = daysSince(trip.dato);
                  const agoLabel = ago === 0 ? 'i dag' : ago === 1 ? 'i går' : `${ago}d siden`;
                  return (
                    <TouchableOpacity
                      key={`${trip.dato}-${trip.store_location_id}`}
                      onPress={() => setSelectedTrip(trip)}
                      activeOpacity={0.75}
                      style={[{
                        backgroundColor: C.white, borderRadius: 18, padding: 16,
                        flexDirection: 'row', alignItems: 'center', gap: 14,
                      }, isWeb ? { boxShadow: '0px 4px 12px rgba(0,54,42,0.04)' } as any : {}]}
                    >
                      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.low, alignItems: 'center', justifyContent: 'center' }}>
                        <MaterialIcons name="shopping-basket" size={20} color={C.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: C.text, fontFamily: C.fontBody } as any}>{trip.butikk}</Text>
                        <Text style={{ fontSize: 12, color: C.textSec, marginTop: 2, fontFamily: C.fontBody } as any}>
                          {formatDate(trip.dato)} · {trip.antall_varer} varer
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 3 }}>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: C.primary, fontFamily: C.font } as any}>
                          {trip.total.toFixed(0)} kr
                        </Text>
                        <Text style={{ fontSize: 11, color: C.outline, fontFamily: C.fontBody } as any}>{agoLabel}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <TripSheet trip={selectedTrip} onClose={() => setSelectedTrip(null)} />
    </View>
  );
}
