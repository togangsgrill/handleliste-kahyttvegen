import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Finner butikken brukeren handler mest i (siste 60 dager), basert på antall
 * unike handleturer (grupperes per dato + butikk). Brukes til å forhåndsvelge
 * butikk i handleliste-detalj, slik at brukeren slipper å velge hver gang.
 *
 * Returnerer `null` hvis ingen handlehistorikk finnes.
 */
export function useFavoriteStore() {
  const [favoriteStoreId, setFavoriteStoreId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000).toISOString();
      const { data } = await supabase
        .from('price_history')
        .select('store_location_id, observed_at')
        .gte('observed_at', sixtyDaysAgo)
        .not('store_location_id', 'is', null)
        .limit(1000);

      if (!data || data.length === 0) {
        setLoading(false);
        return;
      }

      // Tell unike turer (dato + butikk) per butikk
      const tripsByStore = new Map<string, Set<string>>();
      for (const row of data as any[]) {
        const storeId = row.store_location_id as string;
        const day = (row.observed_at as string).slice(0, 10);
        if (!tripsByStore.has(storeId)) tripsByStore.set(storeId, new Set());
        tripsByStore.get(storeId)!.add(day);
      }

      let bestStoreId: string | null = null;
      let bestTripCount = 0;
      for (const [storeId, days] of tripsByStore) {
        if (days.size > bestTripCount) {
          bestTripCount = days.size;
          bestStoreId = storeId;
        }
      }

      setFavoriteStoreId(bestStoreId);
      setLoading(false);
    })();
  }, []);

  return { favoriteStoreId, loading };
}
