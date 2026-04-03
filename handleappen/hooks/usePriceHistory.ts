import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/useAuthStore';

interface PriceInfo {
  itemName: string;
  unitPrice: number;
  storeName: string;
  observedAt: string;
}

export function usePriceHistory(itemNames: string[]) {
  const [prices, setPrices] = useState<Map<string, PriceInfo>>(new Map());
  const householdId = useAuthStore((s) => s.householdId);

  useEffect(() => {
    if (!householdId || itemNames.length === 0) return;

    const lowerNames = itemNames.map((n) => n.toLowerCase());

    supabase
      .from('price_history')
      .select('item_name, unit_price, observed_at, store_location_id, store_locations(name)')
      .eq('household_id', householdId)
      .in('item_name', lowerNames)
      .order('observed_at', { ascending: false })
      .then(({ data }) => {
        if (!data) return;
        const map = new Map<string, PriceInfo>();
        for (const row of data) {
          const key = row.item_name.toLowerCase();
          if (!map.has(key)) {
            map.set(key, {
              itemName: row.item_name,
              unitPrice: row.unit_price,
              storeName: (row as any).store_locations?.name ?? '',
              observedAt: row.observed_at,
            });
          }
        }
        setPrices(map);
      });
  }, [householdId, itemNames.join(',')]);

  const getPrice = (name: string): PriceInfo | undefined => {
    return prices.get(name.toLowerCase());
  };

  const totalEstimate = (): { estimate: number; knownCount: number; totalCount: number } => {
    let estimate = 0;
    let knownCount = 0;
    for (const name of itemNames) {
      const price = getPrice(name);
      if (price) {
        estimate += price.unitPrice;
        knownCount++;
      }
    }
    return { estimate, knownCount, totalCount: itemNames.length };
  };

  return { getPrice, totalEstimate, prices };
}
