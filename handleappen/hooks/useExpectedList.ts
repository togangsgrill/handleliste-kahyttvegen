import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/useAuthStore';

// ── Kategori-IDs fra DB ──────────────────────────────────────────────────────
const CAT = {
  fruktGront:     'b2dcf5a2-ed95-4e32-b890-7d2df69d9bde',
  meieri:         '58f7fe57-ee85-4e0c-bf73-8f264bb410a5',
  kjott:          'ccd2858f-bf23-4a3c-b7e7-597bac4dca4f',
  fisk:           '8a826b45-7160-4f61-a2d3-63c65ca0833c',
  brod:           '1ca2d3da-c453-4c2b-afde-6dbfad848813',
  drikke:         '20dc70f5-eb2a-42cc-89f3-602ad8709f89',
  frysevarer:     '4addaa0e-6c79-4a84-a7cd-b72dbea60729',
  hermetikk:      'bbcdd5c4-a59d-43eb-93c2-d5be2cc0c699',
  snacks:         '9c008df3-2d0b-42ac-83f2-d2e0fad1d116',
  husholdning:    'de43d2fb-f747-4ed0-a4fb-e6851754e1ba',
  personlig:      'b74ddde6-5a6d-47c6-bb4e-acfb189d6a52',
  annet:          '449bf891-7804-4079-9105-5a7c0413d3ef',
} as const;

// Keyword → kategori. Sjekkes i rekkefølge, første treff vinner.
// Bruker prefix-match (ikke \b på slutten) for å fange bøyningsformer,
// f.eks. "banan" treffer "bananer bama", "eple" treffer "epler".
const CATEGORY_RULES: Array<{ pattern: RegExp; categoryId: string }> = [
  // Frukt & grønt
  { pattern: /\b(eple|pær|banan|appelsin|sitron|lime|mango|ananas|drue|kiwi|jordbær|bringebær|blåbær|melon|plomme|fersken|aprikos|avokado|tomat|agurk|paprika|løk|hvitløk|gulrot|potet|brokko|blomkål|salat|spinat|purre|selleri|sopp|mais|erter|bønne|squash|aubergine|reddik|rucola|ingefær|chili|koriander|persille|basilikum|timian|dill|gresskar|søtpotet|vårløk|stangselleri|pastinakk|kål|rosenkål|grønnsak|frukt)/i, categoryId: CAT.fruktGront },
  // Meieri
  { pattern: /\b(melk|yoghurt|rømme|fløte|smør|ost|kvarg|cottage|kefir|kremfløte|kremost|brunost|hvitost|gudbrandsdal|jarlsberg|norvegia|brie|camembert|mozarella|mozzarella|parmesan|ricotta|egg)/i, categoryId: CAT.meieri },
  // Kjøtt
  { pattern: /\b(kylling|karbonade|kjøttdeig|bacon|pølse|kotelett|lammekjøtt|svinekjøtt|oksekjøtt|beef|burger|filet|stek|ribbe|skinke|spekeskinke|servelat|salami|lever|pate|biff|entrecote|indrefilet|kjøtt)/i, categoryId: CAT.kjott },
  // Fisk & sjømat
  { pattern: /\b(laks|torsk|sei|makrell|sild|reke|krabbe|hummer|musling|blåskjell|ørret|abbor|tuna|tunfisk|sardin|ansjos|kaviar|fiskefilet|fiskebolle|fiskepudding|fiskekake|pangasius|tilapia|sjømat|fisk)/i, categoryId: CAT.fisk },
  // Brød & bakevarer
  { pattern: /\b(brød|rundstykke|bagel|baguette|focaccia|ciabatta|tortilla|loff|knekkebrød|kneipp|havrebrød|rugbrød|pita|lefse|lompe|mel|gjær|bakepulver|natron|havregryn|müsli|granola|cornflakes|frokostblanding|vaffelrøre|pannekake|kake|muffin|bolle|horn|croissant|wienerbrød|pai|pizzabunn|pizzadeig)/i, categoryId: CAT.brod },
  // Drikke
  { pattern: /\b(juice|saft|brus|cola|pepsi|fanta|solo|farris|imsdal|vann|kaffe|te|kakao|smoothie|energidrikk|redbull|monster|øl|vin|cider|vodka|whisky|gin)/i, categoryId: CAT.drikke },
  // Frysevarer
  { pattern: /\b(iskrem|frossen|pommesfrites|pomfrit|vaffel|blomkålris|fiskepinn|frys)/i, categoryId: CAT.frysevarer },
  // Hermetikk & tørrvarer
  { pattern: /\b(hermetikk|pasta|spaghetti|penne|fusilli|ris|linse|kikert|kidney|bulgur|couscous|quinoa|suppe|buljong|kraft|ketchup|majones|sennep|dressing|olivenolje|rapsolje|eddik|sukker|krydder|vaniljesukker|kanel|karri|paprikapulver|oregano|løkpulver|hvitløkspulver|spisskummen|muskat|laurbær|soyasaus|worcester|tabasco)/i, categoryId: CAT.hermetikk },
  // Snacks & godteri
  { pattern: /\b(chips|popcorn|nøtt|cashew|mandel|valnøtt|peanøtt|sjokolade|godteri|drops|lakris|karamell|kjeks|kiks|cracker|digestive|nougat|marshmallow|skumbanan|vingummi|fruktgummi|snickers|twix|kitkat|daim|freia)/i, categoryId: CAT.snacks },
  // Husholdning
  { pattern: /\b(tørkepapir|toalettpapir|serviett|husholdningspapir|oppvask|handsåpe|vaskemiddel|skyllemiddel|tøymykner|rengjøring|soppsvamp|klut|søppelpose|søppelsekk|plastfolie|bakepapir|batteri|lyspære|stearinlys)/i, categoryId: CAT.husholdning },
  // Personlig pleie
  { pattern: /\b(sjampo|balsam|dusjsåpe|deodorant|tannkrem|tannbørste|barberblad|barberskum|fuktighetskrem|solkrem|leppepomade|tampong|hårspray|hårgel|hårfarge|barberhøvel)/i, categoryId: CAT.personlig },
];

function guessCategory(name: string): string {
  const lower = name.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(lower)) return rule.categoryId;
  }
  return CAT.annet;
}

// ── Pant-filter ──────────────────────────────────────────────────────────────
const PANT_PATTERNS = /\bpant\b|pantelapp|returgods|retur gods|tomgods|tom flaske|tomflaske/i;

function isPant(name: string): boolean {
  return PANT_PATTERNS.test(name);
}

// ── Hjelpefunksjoner ─────────────────────────────────────────────────────────
function median(values: number[]): number {
  if (values.length === 0) return 1;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : Math.round(sorted[mid]);
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Interface & hook ─────────────────────────────────────────────────────────
export interface ExpectedItem {
  name: string;
  typicalQuantity: number;
  purchaseCount: number;
  daysSinceLast: number;
  score: number;
  categoryId: string;
}

export function useExpectedList(currentItemNames: string[]) {
  const [expectedItems, setExpectedItems] = useState<ExpectedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const householdId = useAuthStore((s) => s.householdId);

  useEffect(() => {
    if (!householdId) return;
    load();
  }, [householdId]);

  async function load() {
    setLoading(true);
    try {
      const { data: receipts } = await (supabase
        .from('receipts' as any)
        .select('id, purchased_at')
        .eq('household_id', householdId)
        .order('purchased_at', { ascending: false }) as any);

      if (!receipts || receipts.length === 0) return;

      const receiptIds = receipts.map((r: any) => r.id as string);
      const receiptDateMap = new Map<string, string>(
        receipts.map((r: any) => [r.id as string, r.purchased_at as string])
      );

      const { data: items } = await (supabase
        .from('receipt_items' as any)
        .select('receipt_id, name, quantity')
        .in('receipt_id', receiptIds) as any);

      if (!items || items.length === 0) return;

      const agg = new Map<string, { quantities: number[]; dates: string[] }>();

      for (const row of items) {
        const name = (row.name as string).toLowerCase().trim();
        if (isPant(name)) continue;
        const qty = typeof row.quantity === 'number' && row.quantity > 0 ? row.quantity : 1;
        const date = receiptDateMap.get(row.receipt_id as string) ?? '';

        const existing = agg.get(name);
        if (!existing) {
          agg.set(name, { quantities: [qty], dates: [date] });
        } else {
          existing.quantities.push(qty);
          existing.dates.push(date);
        }
      }

      const now = Date.now();
      const currentSet = new Set(currentItemNames.map((n) => n.toLowerCase()));
      const result: ExpectedItem[] = [];

      for (const [name, { quantities, dates }] of agg) {
        if (currentSet.has(name)) continue;

        const purchaseCount = dates.length;
        const lastDate = dates.sort().at(-1) ?? '';
        const daysSinceLast = lastDate
          ? Math.floor((now - new Date(lastDate).getTime()) / 86_400_000)
          : 999;

        const recency = Math.exp(-Math.max(0, daysSinceLast - 14) / 30);
        const score = purchaseCount * recency;

        result.push({
          name: capitalize(name),
          typicalQuantity: median(quantities),
          purchaseCount,
          daysSinceLast,
          score,
          categoryId: guessCategory(name),
        });
      }

      result.sort((a, b) => b.score - a.score);
      setExpectedItems(result.filter((i) => i.purchaseCount >= 2).slice(0, 20));
    } finally {
      setLoading(false);
    }
  }

  const filtered = expectedItems.filter(
    (i) => !currentItemNames.map((n) => n.toLowerCase()).includes(i.name.toLowerCase())
  );

  return { expectedItems: filtered, loading, refresh: load };
}
