import { useMemo } from 'react';
import type { Database } from '@/types/database';

type ListItem = Database['public']['Tables']['list_items']['Row'];

export type SortMode = 'category' | 'added' | 'alpha' | 'manual' | 'store';

interface Category {
  id: string;
  name: string;
  emoji: string;
}

// Din foretrukne kategori-rekkefølge
const DEFAULT_CATEGORY_ORDER = [
  'b2dcf5a2-ed95-4e32-b890-7d2df69d9bde', // Frukt & grønt
  'ccd2858f-bf23-4a3c-b7e7-597bac4dca4f', // Kjøtt
  '8a826b45-7160-4f61-a2d3-63c65ca0833c', // Fisk & sjømat
  '58f7fe57-ee85-4e0c-bf73-8f264bb410a5', // Meieri
  '4addaa0e-6c79-4a84-a7cd-b72dbea60729', // Frysevarer
  '20dc70f5-eb2a-42cc-89f3-602ad8709f89', // Drikke
  '1ca2d3da-c453-4c2b-afde-6dbfad848813', // Brød & bakevarer
  'de43d2fb-f747-4ed0-a4fb-e6851754e1ba', // Husholdning
  'b74ddde6-5a6d-47c6-bb4e-acfb189d6a52', // Personlig pleie
  'bbcdd5c4-a59d-43eb-93c2-d5be2cc0c699', // Hermetikk & tørrvarer
  '9c008df3-2d0b-42ac-83f2-d2e0fad1d116', // Snacks & godteri
  '449bf891-7804-4079-9105-5a7c0413d3ef', // Annet
];

export function useSortedItems(
  items: ListItem[],
  sortMode: SortMode,
  categoryOrder: Category[], // from useCategoryOrder (store-specific)
  catMap: Map<string, Category>,
  hasCustomStoreOrder = false,
) {
  return useMemo(() => {
    switch (sortMode) {
      case 'store': {
        const orderIds = hasCustomStoreOrder
          ? categoryOrder.map((c) => c.id)
          : DEFAULT_CATEGORY_ORDER;
        const catIndex = new Map(orderIds.map((id, i) => [id, i]));
        return [...items].sort((a, b) => {
          const ai = catIndex.get(a.category_id ?? '') ?? 999;
          const bi = catIndex.get(b.category_id ?? '') ?? 999;
          if (ai !== bi) return ai - bi;
          return a.name.localeCompare(b.name, 'nb');
        });
      }
      case 'category': {
        const catIndex = new Map(DEFAULT_CATEGORY_ORDER.map((id, i) => [id, i]));
        return [...items].sort((a, b) => {
          const ai = catIndex.get(a.category_id ?? '') ?? 999;
          const bi = catIndex.get(b.category_id ?? '') ?? 999;
          if (ai !== bi) return ai - bi;
          return a.name.localeCompare(b.name, 'nb');
        });
      }
      case 'alpha':
        return [...items].sort((a, b) => a.name.localeCompare(b.name, 'nb'));
      case 'added':
        return [...items].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      case 'manual':
        return [...items].sort((a, b) => {
          const ao = (a as any).sort_order ?? 9999;
          const bo = (b as any).sort_order ?? 9999;
          if (ao !== bo) return ao - bo;
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });
      default:
        return items;
    }
  }, [items, sortMode, categoryOrder]);
}

export const SORT_OPTIONS: Array<{ mode: SortMode; label: string; icon: string }> = [
  { mode: 'store',    label: 'Butikk',      icon: 'store' },
  { mode: 'category', label: 'Kategori',    icon: 'category' },
  { mode: 'alpha',    label: 'A–Å',         icon: 'sort-by-alpha' },
  { mode: 'added',    label: 'Lagt til',    icon: 'schedule' },
  { mode: 'manual',   label: 'Egendefinert', icon: 'drag-handle' },
];
