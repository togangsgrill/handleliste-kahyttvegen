import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/useAuthStore';

export interface PriceInfo {
  itemName: string;
  unitPrice: number;
  storeName: string;
  observedAt: string;
  storeLocationId: string;
}

export interface StorePrice {
  storeName: string;
  storeLocationId: string;
  unitPrice: number;
  observedAt: string;
}

export function usePriceHistory(itemNames: string[], quantities?: Map<string, number>) {
  const [prices, setPrices] = useState<Map<string, PriceInfo>>(new Map());
  const [allPrices, setAllPrices] = useState<Map<string, StorePrice[]>>(new Map());
  const householdId = useAuthStore((s) => s.householdId);

  useEffect(() => {
    if (!householdId || itemNames.length === 0) return;

    const lowerNames = itemNames.map((n) => n.toLowerCase());

    (supabase
      .from('price_history' as any)
      .select('item_name, unit_price, observed_at, store_location_id, store_locations(name)')
      .eq('household_id', householdId)
      .order('observed_at', { ascending: false }) as any)
      .then(({ data }: { data: any[] | null }) => {
        if (!data) return;

        const latestMap = new Map<string, PriceInfo>();
        const storeMap = new Map<string, StorePrice[]>();

        for (const row of data) {
          const key = (row.item_name as string).toLowerCase();
          const storeName = row.store_locations?.name ?? '';
          const storeLocationId = row.store_location_id as string;

          // Build store comparison map (latest price per store per item)
          if (!storeMap.has(key)) storeMap.set(key, []);
          const existing = storeMap.get(key)!;
          if (!existing.some((p) => p.storeLocationId === storeLocationId)) {
            existing.push({
              storeName,
              storeLocationId,
              unitPrice: row.unit_price,
              observedAt: row.observed_at,
            });
          }

          // Latest price per item (first hit wins since sorted desc)
          if (!latestMap.has(key)) {
            latestMap.set(key, {
              itemName: row.item_name,
              unitPrice: row.unit_price,
              storeName,
              observedAt: row.observed_at,
              storeLocationId,
            });
          }
        }

        // Fuzzy matching: for list items without exact match,
        // try partial word match against price_history item names
        for (const name of lowerNames) {
          if (latestMap.has(name)) continue;
          const words = name.split(/\s+/).filter((w) => w.length >= 3);
          if (words.length === 0) continue;

          let bestMatch: { key: string; score: number } | null = null;
          for (const [priceKey] of latestMap) {
            let score = 0;
            for (const word of words) {
              if (priceKey.includes(word)) score++;
            }
            if (score > 0 && (!bestMatch || score > bestMatch.score)) {
              bestMatch = { key: priceKey, score };
            }
          }

          if (bestMatch) {
            const match = latestMap.get(bestMatch.key)!;
            latestMap.set(name, { ...match });
            const matchStores = storeMap.get(bestMatch.key);
            if (matchStores) storeMap.set(name, matchStores);
          }
        }

        setPrices(latestMap);
        setAllPrices(storeMap);
      });
  }, [householdId, itemNames.join(',')]);

  const getPrice = (name: string): PriceInfo | undefined => {
    return prices.get(name.toLowerCase());
  };

  const getStoreComparison = (name: string): StorePrice[] => {
    const stores = allPrices.get(name.toLowerCase()) ?? [];
    return [...stores].sort((a, b) => a.unitPrice - b.unitPrice);
  };

  // Returns the chain name if the item has only ever been bought at one chain.
  // This is a hint that the product may only be available there — not a strict rule.
  const getExclusiveStore = (name: string): string | null => {
    const stores = allPrices.get(name.toLowerCase()) ?? [];
    if (stores.length === 0) return null;

    const toChain = (storeName: string): string => {
      const n = storeName.toLowerCase();
      if (n.includes('eurospar')) return 'Eurospar';
      if (n.includes('spar')) return 'Spar';
      if (n.includes('kiwi')) return 'Kiwi';
      if (n.includes('meny')) return 'Meny';
      if (n.includes('rema')) return 'Rema 1000';
      if (n.includes('extra') || n.includes('xtra')) return 'Coop Extra';
      if (n.includes('coop')) return 'Coop';
      if (n.includes('joker')) return 'Joker';
      return storeName.split(' ')[0];
    };

    const chains = new Set(stores.map((s) => toChain(s.storeName)));
    if (chains.size !== 1) return null;
    return [...chains][0];
  };

  const totalEstimate = (): { estimate: number; knownCount: number; totalCount: number } => {
    let estimate = 0;
    let knownCount = 0;
    for (const name of itemNames) {
      const price = getPrice(name);
      if (price) {
        const qty = quantities?.get(name) ?? 1;
        estimate += price.unitPrice * qty;
        knownCount++;
      }
    }
    return { estimate, knownCount, totalCount: itemNames.length };
  };

  return { getPrice, getStoreComparison, getExclusiveStore, totalEstimate, prices };
}
