import { useEffect, useState } from 'react';
import { Text, View, ScrollView, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useAuthStore } from '@/stores/useAuthStore';
import { supabase } from '@/lib/supabase';
import { fetchTrumfReceipts, TrumfReceipt } from '@/lib/trumf';

const C = {
  bg: '#d8fff0',
  white: '#ffffff',
  low: '#bffee7',
  container: '#b2f6de',
  high: '#a7f1d8',
  primary: '#006947',
  primaryContainer: '#00feb2',
  onPrimaryContainer: '#005c3e',
  text: '#00362a',
  textSec: '#2f6555',
  outline: '#81b8a5',
  error: '#b31b25',
  success: '#006947',
  font: "'Plus Jakarta Sans', system-ui, sans-serif",
  fontBody: "'Manrope', system-ui, sans-serif",
};

const isWeb = Platform.OS === 'web';

type ImportStatus = 'idle' | 'fetching' | 'importing' | 'done' | 'error';

// JS-snippet brukeren limer inn i konsollen på trumf.no
const APP_URL = 'https://handleliste-azure.vercel.app';
export const TRUMF_CONSOLE_SNIPPET = `fetch("https://www.trumf.no/api/auth/session", { credentials: "include" })
  .then(r => r.json())
  .then(data => {
    if (data.accessToken) {
      const url = "${APP_URL}/(app)/settings/trumf-import?token=" + encodeURIComponent(data.accessToken);
      console.log("%c✅ Klikk her for å importere Trumf-kvitteringer", "color:#006947;font-weight:bold;font-size:16px");
      console.log(url);
      window.open(url, "_blank");
    } else {
      console.error("❌ Token ikke funnet – er du logget inn på trumf.no?");
    }
  })
  .catch(err => console.error("❌ Feil:", err.message));`;

async function importReceiptsToSupabase(
  receipts: TrumfReceipt[],
  householdId: string,
  onProgress: (done: number, total: number) => void,
): Promise<{ imported: number; skipped: number }> {
  let imported = 0;
  let skipped = 0;

  for (let i = 0; i < receipts.length; i++) {
    const receipt = receipts[i];
    onProgress(i, receipts.length);

    // Finn eller opprett butikk
    const { data: existingStore } = await supabase
      .from('store_locations')
      .select('id')
      .eq('chain', receipt.storeChain)
      .eq('name', receipt.storeName)
      .single();

    let storeId: string;
    if (existingStore) {
      storeId = existingStore.id;
    } else {
      const { data: newStore, error } = await supabase
        .from('store_locations')
        .insert({ chain: receipt.storeChain, name: receipt.storeName })
        .select('id')
        .single();
      if (error || !newStore) { skipped++; continue; }
      storeId = newStore.id;
    }

    // Sjekk om kvittering allerede er importert (basert på dato + butikk + beløp)
    const { data: existingReceipt } = await supabase
      .from('receipts')
      .select('id')
      .eq('household_id', householdId)
      .eq('store_location_id', storeId)
      .eq('total_amount', receipt.totalAmount)
      .gte('purchased_at', receipt.purchasedAt.substring(0, 10) + 'T00:00:00Z')
      .lte('purchased_at', receipt.purchasedAt.substring(0, 10) + 'T23:59:59Z')
      .single();

    if (existingReceipt) { skipped++; continue; }

    // Opprett kvittering
    const { data: newReceipt, error: receiptError } = await supabase
      .from('receipts')
      .insert({
        household_id: householdId,
        store_location_id: storeId,
        total_amount: receipt.totalAmount,
        purchased_at: receipt.purchasedAt,
      })
      .select('id')
      .single();

    if (receiptError || !newReceipt) { skipped++; continue; }

    // Opprett varelinjer
    if (receipt.items.length > 0) {
      await supabase.from('receipt_items').insert(
        receipt.items.map((item) => ({
          receipt_id: newReceipt.id,
          name: item.name,
          quantity: item.quantity,
          unit_price: item.unitPrice ?? (item.totalPrice / item.quantity),
          total_price: item.totalPrice,
        }))
      );

      // Oppdater prishistorikk
      await supabase.from('price_history').insert(
        receipt.items.map((item) => ({
          household_id: householdId,
          item_name: item.name.toLowerCase(),
          store_location_id: storeId,
          unit_price: item.unitPrice ?? (item.totalPrice / item.quantity),
          observed_at: receipt.purchasedAt,
          receipt_id: newReceipt.id,
          confidence: 0.8,
        }))
      );
    }

    imported++;
  }

  onProgress(receipts.length, receipts.length);
  return { imported, skipped };
}

export default function TrumfImportScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useLocalSearchParams<{ token: string }>();
  const householdId = useAuthStore((s) => s.householdId);

  const isLoading = useAuthStore((s) => s.isLoading);

  const [status, setStatus] = useState<ImportStatus>('idle');
  const [receipts, setReceipts] = useState<TrumfReceipt[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [error, setError] = useState('');
  const [showSnippet, setShowSnippet] = useState(false);
  const [copied, setCopied] = useState(false);

  // Start fetch automatisk når auth er klar og token er til stede
  useEffect(() => {
    if (!isLoading && token && householdId && status === 'idle') {
      handleFetch();
    }
  }, [isLoading, token, householdId]);

  const handleFetch = async () => {
    if (!token) return;
    setStatus('fetching');
    setError('');
    try {
      const data = await fetchTrumfReceipts(token);
      setReceipts(data);
      setStatus('idle');
    } catch (e: any) {
      setError(e.message ?? 'Kunne ikke hente kvitteringer fra Trumf.');
      setStatus('error');
    }
  };

  const handleImport = async () => {
    if (!householdId || receipts.length === 0) return;
    setStatus('importing');
    setError('');
    try {
      const res = await importReceiptsToSupabase(receipts, householdId, (done, total) =>
        setProgress({ done, total })
      );
      setResult(res);
      setStatus('done');
    } catch (e: any) {
      setError(e.message ?? 'Import feilet.');
      setStatus('error');
    }
  };

  const handleCopySnippet = async () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(TRUMF_CONSOLE_SNIPPET);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const progressPct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      {isWeb && <View style={{ height: 58 }} />}
      <View style={{
        backgroundColor: 'rgba(236,253,245,0.92)', zIndex: 40,
        ...(isWeb
          ? { backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', boxShadow: '0px 10px 30px rgba(0,54,42,0.06)', position: 'fixed', top: 0, left: 0, right: 0 } as any
          : { paddingTop: insets.top + 8 }),
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14 } as any}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <MaterialIcons name="arrow-back" size={22} color={C.primary} />
          </TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: '800', color: C.text, letterSpacing: -0.5, fontFamily: C.font } as any}>
            Importer fra Trumf
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 28, paddingBottom: 80, maxWidth: 720, alignSelf: 'center' as any, width: '100%' as any }}>

        {/* Intro-kort */}
        <View style={[{ backgroundColor: C.white, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: C.outline + '33', marginBottom: 20 }, isWeb ? { boxShadow: '0px 10px 30px rgba(0,54,42,0.06)' } as any : {}]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 } as any}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#e8003c12', justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: 22 }}>🛒</Text>
            </View>
            <Text style={{ fontSize: 20, fontWeight: '800', color: C.text, fontFamily: C.font } as any}>Trumf-kvitteringer</Text>
          </View>
          <Text style={{ fontSize: 15, color: C.textSec, lineHeight: 22, fontFamily: C.fontBody } as any}>
            Importer handlehistorikken din fra Trumf.no direkte til appen. Dataen brukes til prisestimater og smarte forslag.
          </Text>
        </View>

        {/* Steg 1 — Hent token */}
        {!token && (
          <View style={[{ backgroundColor: C.white, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: C.outline + '33', marginBottom: 20 }, isWeb ? { boxShadow: '0px 10px 30px rgba(0,54,42,0.06)' } as any : {}]}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 16, fontFamily: C.font } as any}>
              Steg 1 av 2 — Koble til Trumf
            </Text>

            {[
              { n: '1', text: 'Logg inn på trumf.no og åpne en kvittering' },
              { n: '2', text: 'Åpne konsollen (F12 → Console)' },
              { n: '3', text: 'Lim inn koden nedenfor og trykk Enter' },
              { n: '4', text: 'Klikk lenken som dukker opp i konsollen' },
            ].map((step) => (
              <View key={step.n} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 } as any}>
                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: C.primaryContainer, justifyContent: 'center', alignItems: 'center', marginTop: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: C.onPrimaryContainer } as any}>{step.n}</Text>
                </View>
                <Text style={{ flex: 1, fontSize: 14, color: C.textSec, lineHeight: 20, fontFamily: C.fontBody } as any}>{step.text}</Text>
              </View>
            ))}

            <TouchableOpacity
              onPress={() => setShowSnippet(!showSnippet)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: showSnippet ? 12 : 0 } as any}
            >
              <MaterialIcons name={showSnippet ? 'expand-less' : 'expand-more'} size={20} color={C.primary} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: C.primary, fontFamily: C.fontBody } as any}>
                {showSnippet ? 'Skjul kode' : 'Vis JavaScript-kode'}
              </Text>
            </TouchableOpacity>

            {showSnippet && (
              <View style={{ backgroundColor: C.low, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: C.outline + '44' }}>
                <Text style={{ fontSize: 11, color: C.text, fontFamily: 'monospace', lineHeight: 18 } as any}>
                  {TRUMF_CONSOLE_SNIPPET}
                </Text>
                <TouchableOpacity
                  onPress={handleCopySnippet}
                  style={{ marginTop: 12, alignSelf: 'flex-end', backgroundColor: C.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 9999, flexDirection: 'row', alignItems: 'center', gap: 6 } as any}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name={copied ? 'check' : 'content-copy'} size={14} color="#fff" />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff', fontFamily: C.fontBody } as any}>
                    {copied ? 'Kopiert!' : 'Kopier'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Steg 2 — Forhåndsvisning og import */}
        {token && status !== 'done' && (
          <View style={[{ backgroundColor: C.white, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: C.outline + '33', marginBottom: 20 }, isWeb ? { boxShadow: '0px 10px 30px rgba(0,54,42,0.06)' } as any : {}]}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 4, fontFamily: C.font } as any}>
              Steg 2 av 2 — Importer
            </Text>

            {/* Venter på auth */}
            {isLoading && (
              <View style={{ alignItems: 'center', paddingVertical: 32, gap: 12 } as any}>
                <ActivityIndicator size="large" color={C.primary} />
                <Text style={{ fontSize: 14, color: C.textSec, fontFamily: C.fontBody } as any}>Logger inn...</Text>
              </View>
            )}

            {status === 'fetching' && (
              <View style={{ alignItems: 'center', paddingVertical: 32, gap: 12 } as any}>
                <ActivityIndicator size="large" color={C.primary} />
                <Text style={{ fontSize: 14, color: C.textSec, fontFamily: C.fontBody } as any}>Henter kvitteringer fra Trumf...</Text>
              </View>
            )}

            {status === 'idle' && receipts.length > 0 && (
              <>
                <Text style={{ fontSize: 14, color: C.textSec, marginBottom: 20, fontFamily: C.fontBody } as any}>
                  Fant <Text style={{ fontWeight: '700', color: C.text }}>{receipts.length} kvitteringer</Text> fra Trumf klar for import.
                </Text>

                {/* Forhåndsvisning av de 3 første */}
                {receipts.slice(0, 3).map((r) => (
                  <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.outline + '22' } as any}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: C.text, fontFamily: C.fontBody } as any}>{r.storeName}</Text>
                      <Text style={{ fontSize: 12, color: C.textSec, fontFamily: C.fontBody } as any}>
                        {new Date(r.purchasedAt).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {' · '}{r.items.length} varer
                      </Text>
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: C.primary, fontFamily: C.fontBody } as any}>
                      {r.totalAmount.toLocaleString('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 })}
                    </Text>
                  </View>
                ))}
                {receipts.length > 3 && (
                  <Text style={{ fontSize: 12, color: C.textSec, marginTop: 8, fontFamily: C.fontBody } as any}>
                    + {receipts.length - 3} til...
                  </Text>
                )}

                <TouchableOpacity
                  onPress={handleImport}
                  style={{ marginTop: 20, backgroundColor: C.primary, paddingVertical: 14, borderRadius: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, ...(isWeb ? { boxShadow: '0px 8px 24px rgba(0,105,71,0.2)' } as any : {}) } as any}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="download" size={18} color="#fff" />
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff', fontFamily: C.fontBody } as any}>
                    Importer {receipts.length} kvitteringer
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {status === 'importing' && (
              <View style={{ alignItems: 'center', paddingVertical: 24, gap: 16 } as any}>
                <ActivityIndicator size="large" color={C.primary} />
                <Text style={{ fontSize: 14, fontWeight: '700', color: C.text, fontFamily: C.fontBody } as any}>
                  Importerer {progress.done} av {progress.total}...
                </Text>
                {/* Progressbar */}
                <View style={{ width: '100%', height: 8, backgroundColor: C.low, borderRadius: 4 }}>
                  <View style={{ width: `${progressPct}%` as any, height: 8, backgroundColor: C.primary, borderRadius: 4 }} />
                </View>
                <Text style={{ fontSize: 12, color: C.textSec, fontFamily: C.fontBody } as any}>{progressPct}%</Text>
              </View>
            )}

            {/* Tom liste etter fetch — sannsynligvis feil API-endepunkt */}
            {!isLoading && status === 'idle' && receipts.length === 0 && !error && (
              <View style={{ alignItems: 'center', paddingVertical: 24, gap: 12 } as any}>
                <Text style={{ fontSize: 14, color: C.textSec, textAlign: 'center', fontFamily: C.fontBody } as any}>
                  Ingen kvitteringer funnet. Token kan ha utløpt, eller Trumf API-strukturen kan ha endret seg.
                </Text>
                <TouchableOpacity
                  onPress={handleFetch}
                  style={{ backgroundColor: C.primary, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 9999 } as any}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff', fontFamily: C.fontBody } as any}>Prøv igjen</Text>
                </TouchableOpacity>
              </View>
            )}

            {status === 'error' && (
              <View style={{ paddingVertical: 16, gap: 12 } as any}>
                <Text style={{ fontSize: 14, color: C.error, fontFamily: C.fontBody } as any}>{error}</Text>
                <TouchableOpacity
                  onPress={handleFetch}
                  style={{ alignSelf: 'flex-start', backgroundColor: C.primary, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 9999 } as any}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff', fontFamily: C.fontBody } as any}>Prøv igjen</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Ferdig */}
        {status === 'done' && result && (
          <View style={[{ backgroundColor: C.white, borderRadius: 20, padding: 28, borderWidth: 1, borderColor: C.outline + '33', marginBottom: 20, alignItems: 'center' }, isWeb ? { boxShadow: '0px 10px 30px rgba(0,54,42,0.06)' } as any : {}]}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: C.primaryContainer, justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
              <MaterialIcons name="check" size={28} color={C.primary} />
            </View>
            <Text style={{ fontSize: 20, fontWeight: '800', color: C.text, marginBottom: 8, fontFamily: C.font } as any}>Import fullført!</Text>
            <Text style={{ fontSize: 15, color: C.textSec, textAlign: 'center', lineHeight: 22, fontFamily: C.fontBody } as any}>
              <Text style={{ fontWeight: '700', color: C.text }}>{result.imported} kvitteringer</Text> importert.
              {result.skipped > 0 ? ` ${result.skipped} var allerede importert.` : ''}
            </Text>
            <TouchableOpacity
              onPress={() => router.replace('/(app)/settings')}
              style={{ marginTop: 24, backgroundColor: C.primary, paddingVertical: 12, paddingHorizontal: 28, borderRadius: 9999 } as any}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff', fontFamily: C.fontBody } as any}>Tilbake til innstillinger</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </View>
  );
}
