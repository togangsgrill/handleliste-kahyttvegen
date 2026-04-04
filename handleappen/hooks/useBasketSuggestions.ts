import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/useAuthStore';

export interface BasketSuggestion {
  name: string;
  pairedWith: string;
  coOccurrences: number;
  typicalQuantity: number;
  categoryId: string | null;
}

// Merkevarer som fjernes — disse gir ingen nyttig informasjon for handlelisten
const BRAND_NOISE = [
  'bama', 'tine', 'q-meieriene', ' q ', 'first price', 'eldorado', 'freia', 'gilde', 'nortura',
  'mills', 'stabburet', 'felix', 'lofoten', 'kuraas', 'urkraft', 'sætre', 'kvelde mølle',
  'sam mills', 'gårdschips', 'bremykt',
];

// Støykoder som alltid fjernes (butikkspesifikke, pantekoder, etc.)
const NOISE_PATTERN = /\bpant\b|\bemb\b|\butgående\b|\bsalg av\b/gi;

// Formater lesbare mengder: "800G" → "800g", "1,75L" → "1,75l", "18STK" → "18 stk"
// Behold disse — de er nyttige ("Helmelk 1,75l", "Egg 18 stk")
function formatQuantity(raw: string): string {
  return raw
    .replace(/(\d+[,.]?\d*)\s*(KG|G|DL|ML|L|STK|PK|CL)\b/gi, (_, num, unit) => {
      const u = unit.toLowerCase();
      // Show stk as "X stk", weight/volume as "Xg", "Xl" etc.
      return u === 'stk' || u === 'pk' ? `${num} ${u}` : `${num}${u}`;
    });
}

function normalizeReceiptName(raw: string): string {
  let name = raw.toLowerCase().trim();
  // Remove noise codes
  name = name.replace(NOISE_PATTERN, '');
  // Remove known brands
  for (const brand of BRAND_NOISE) {
    name = name.replace(new RegExp(`\\b${brand.trim()}\\b`, 'gi'), '');
  }
  // Clean up whitespace, then format quantities nicely
  name = name.replace(/\s+/g, ' ').trim();
  name = formatQuantity(name);
  // Capitalize first letter
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// Regelbasert kategoritilknytning (uten API-kall)
const CATEGORY_RULES: [RegExp, string][] = [
  [/banan|eple|pære|appelsin|sitron|agurk|tomat|paprika|løk|gulrot|potet|salat|avocado|bær|frukt|grønt|brokkoli|søtpotet|sopp/i, 'Frukt & grønt'],
  [/melk|yoghurt|ost|rømme|smør|fløte|cottage|kvarg|kefir|kremfløte|meieri/i, 'Meieri'],
  [/kjøttdeig|kylling|svin|biff|lam|pølse|bacon|salami|skinke|kjøtt|karbonader/i, 'Kjøtt'],
  [/laks|torsk|makrell|sild|reke|fisk|sjømat|tunfisk/i, 'Fisk & sjømat'],
  [/brød|rundstykke|bagel|lefse|knekke|kavring|mel|gjær|havre|gryn/i, 'Brød & bakevarer'],
  [/pasta|ris|hermetikk|bønner|linser|erter|tomat.*boks|kokos|olje|eddik|saus|buljong|krydder/i, 'Hermetikk & tørrvarer'],
  [/frys|iskrem|pizza.*frys/i, 'Frysevarer'],
  [/juice|vann|brus|kaffe|te|saft|øl|vin|soda/i, 'Drikke'],
  [/chips|sjokolade|godteri|snacks|nøtter|popcorn|kjeks|kake/i, 'Snacks & godteri'],
  [/vaskemiddel|oppvask|tørkepapir|søppelpose|klut|rengjør|bleie|dopapir/i, 'Husholdning'],
  [/sjampo|såpe|tannkrem|deodorant|barbering|plaster|solkrem/i, 'Personlig pleie'],
];

function inferCategory(name: string, categoryMap: Map<string, string>): string | null {
  for (const [pattern, catName] of CATEGORY_RULES) {
    if (pattern.test(name)) return categoryMap.get(catName.toLowerCase()) ?? null;
  }
  return null;
}

/**
 * Market basket analysis: given the current list items,
 * find items frequently bought together with them that
 * aren't already on the list.
 *
 * Pure SQL logic — no API calls.
 */
export function useBasketSuggestions(currentItemNames: string[]) {
  const [suggestions, setSuggestions] = useState<BasketSuggestion[]>([]);
  const householdId = useAuthStore((s) => s.householdId);

  useEffect(() => {
    if (!householdId || currentItemNames.length === 0) {
      setSuggestions([]);
      return;
    }
    loadSuggestions();
  }, [householdId, currentItemNames.join(',')]);

  async function loadSuggestions() {
    if (!householdId) return;

    // Fetch categories once for category inference
    const { data: categoriesData } = await supabase.from('categories').select('id, name');
    const categoryMap = new Map<string, string>();
    for (const cat of categoriesData ?? []) categoryMap.set(cat.name.toLowerCase(), cat.id);

    // receipt_items stores names in UPPERCASE — match loosely via normalized form
    // Find receipts that contain items similar to current list items
    const upperNames = currentItemNames.map((n) => n.toUpperCase());

    const { data: matchedRows } = await (supabase
      .from('receipt_items' as any)
      .select('receipt_id, name')
      .in('name', upperNames) as any);

    if (!matchedRows || matchedRows.length === 0) return;

    // Group: normalized list item → set of receipt IDs
    const itemReceiptMap = new Map<string, Set<string>>();
    for (const row of matchedRows) {
      const normalized = normalizeReceiptName(row.name as string).toLowerCase();
      if (!itemReceiptMap.has(normalized)) itemReceiptMap.set(normalized, new Set());
      itemReceiptMap.get(normalized)!.add(row.receipt_id);
    }

    // Fetch co-items from those receipts — use RPC-style join to avoid large .in()
    const allReceiptIds = [...new Set(matchedRows.map((r: any) => r.receipt_id as string))];
    if (allReceiptIds.length === 0) return;

    // Batch in chunks of 100 to stay within URL limits
    const chunks: string[][] = [];
    for (let i = 0; i < allReceiptIds.length; i += 100) chunks.push(allReceiptIds.slice(i, i + 100));

    const coItems: any[] = [];
    for (const chunk of chunks) {
      const { data } = await (supabase
        .from('receipt_items' as any)
        .select('receipt_id, name, quantity')
        .in('receipt_id', chunk) as any);
      if (data) coItems.push(...data);
    }

    if (coItems.length === 0) return;

    // Build co-occurrence counts using normalized names to avoid duplicates
    // Deduplication key strips quantity so "Helmelk 1,75l" and "Helmelk" merge,
    // but we keep the most common normalized form as the display name.
    const coCount = new Map<string, { count: number; pairedWith: string; quantities: number[]; displayName: string }>();
    const currentSet = new Set(currentItemNames.map((n) => n.toLowerCase()));

    // Strip quantity digits for dedup key only
    const dedupKey = (name: string) => name.replace(/\s*\d+[,.]?\d*\s*(kg|g|dl|ml|l|stk|pk|cl)\b/gi, '').replace(/\s+/g, ' ').trim().toLowerCase();

    for (const [listItem, receipts] of itemReceiptMap) {
      for (const row of coItems) {
        if (!receipts.has(row.receipt_id)) continue;

        const normalized = normalizeReceiptName(row.name as string);
        const key = dedupKey(normalized);

        // Skip if already on list
        if (currentSet.has(normalized.toLowerCase())) continue;
        if ([...currentSet].some((c) => dedupKey(normalizeReceiptName(c)) === key)) continue;

        const qty = typeof row.quantity === 'number' && row.quantity > 0 ? row.quantity : 1;
        const existing = coCount.get(key);
        if (!existing) {
          coCount.set(key, { count: 1, pairedWith: listItem, quantities: [qty], displayName: normalized });
        } else {
          existing.count++;
          existing.quantities.push(qty);
          // Keep the shorter/cleaner display name (fewer chars = less noise)
          if (normalized.length < existing.displayName.length) existing.displayName = normalized;
        }
      }
    }

    const result: BasketSuggestion[] = [...coCount.entries()]
      .filter(([, v]) => v.count >= 3)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 6)
      .map(([key, { count, pairedWith, quantities, displayName }]) => ({
        name: displayName,
        pairedWith,
        coOccurrences: count,
        typicalQuantity: median(quantities),
        categoryId: inferCategory(key, categoryMap),
      }));

    setSuggestions(result);
  }

  return suggestions;
}

function median(values: number[]): number {
  if (values.length === 0) return 1;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : Math.round(sorted[mid]);
}
