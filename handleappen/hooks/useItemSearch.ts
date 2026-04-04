import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/useAuthStore';

/**
 * Bygger en normalisert liste over kjente varenavn fra:
 * - price_history (registrerte priser)
 * - receipt_items (importerte kvitteringer)
 *
 * Brukes til autocomplete i søkefeltet.
 */
export function useItemSearch() {
  const [candidates, setCandidates] = useState<string[]>([]);
  const householdId = useAuthStore((s) => s.householdId);

  useEffect(() => {
    if (!householdId) return;

    async function load() {
      const [priceRes, receiptRes] = await Promise.all([
        (supabase
          .from('price_history' as any)
          .select('item_name')
          .eq('household_id', householdId) as any),
        (supabase
          .from('receipt_items' as any)
          .select('name, receipts!inner(household_id)')
          .eq('receipts.household_id', householdId) as any),
      ]);

      const seen = new Set<string>();
      const result: string[] = [];

      const normalize = (raw: string) =>
        raw
          .trim()
          .toLowerCase()
          .replace(/\s+/g, ' ')
          // Fjern vekt/mengdeangivelser på slutten, f.eks. "melk 1l" → "melk"
          .replace(/\s+\d+[\d.,]*\s*(g|kg|ml|l|dl|cl|pk|stk|x\d+)$/i, '');

      for (const row of priceRes.data ?? []) {
        const n = normalize(row.item_name as string);
        if (n && !seen.has(n)) { seen.add(n); result.push(capitalize(n)); }
      }

      for (const row of receiptRes.data ?? []) {
        const n = normalize(row.name as string);
        if (n && !seen.has(n)) { seen.add(n); result.push(capitalize(n)); }
      }

      result.sort((a, b) => a.localeCompare(b, 'nb'));
      setCandidates(result);
    }

    load();
  }, [householdId]);

  /**
   * Returnerer forslag som matcher søkestrengen.
   * Viser treff tidlig i strengen først, deretter alfabetisk.
   */
  function search(query: string): string[] {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return candidates
      .filter((c) => c.toLowerCase().includes(q))
      .sort((a, b) => {
        const ai = a.toLowerCase().indexOf(q);
        const bi = b.toLowerCase().indexOf(q);
        if (ai !== bi) return ai - bi;
        return a.localeCompare(b, 'nb');
      })
      .slice(0, 8);
  }

  return { search };
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
