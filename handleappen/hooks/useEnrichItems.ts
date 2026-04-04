import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { searchProducts } from '@/lib/kassal';
import type { Database } from '@/types/database';

type ListItem = Database['public']['Tables']['list_items']['Row'];

// Berik varer som mangler EAN ved å søke på navn mot Kassal.
// Maks 1 kall per sekund for å holde seg under rate-limit.
export function useEnrichItems(items: ListItem[]) {
  const enrichedIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const toEnrich = items.filter(
      (item) =>
        !(item as any).barcode &&
        !enrichedIds.current.has(item.id)
    );

    if (toEnrich.length === 0) return;

    console.log(`[enrich] Beriker ${toEnrich.length} varer`);

    let cancelled = false;
    let i = 0;

    async function processNext() {
      if (cancelled || i >= toEnrich.length) return;

      const item = toEnrich[i++];
      enrichedIds.current.add(item.id);

      console.log(`[enrich] Søker på: ${item.name}`);

      try {
        const results = await searchProducts(item.name, 1);
        if (cancelled) return;

        const match = results[0];
        if (!match) return;

        // Bare oppdater om navnet matcher rimelig godt
        const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
        const itemWords = normalize(item.name).split(' ');
        const matchWords = normalize(match.name).split(' ');
        const overlap = itemWords.filter((w) => matchWords.includes(w)).length;
        if (overlap === 0) return;

        const { error } = await (supabase.from('list_items') as any).update({
          barcode: match.ean,
          image_url: match.imageUrl ?? null,
          weight: match.weight ?? null,
          weight_unit: match.weightUnit ?? null,
        }).eq('id', item.id);
        if (error) console.warn('[enrich] update feilet:', error.message);
      } catch {
        // Ignorer feil — ikke kritisk
      }

      // Vent 1100ms før neste kall (holder oss under 60/min)
      setTimeout(processNext, 1100);
    }

    processNext();

    return () => { cancelled = true; };
  }, [items]);
}
