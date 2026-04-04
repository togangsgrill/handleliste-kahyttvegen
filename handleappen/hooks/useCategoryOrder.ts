import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/useAuthStore';
import { useCategories } from '@/hooks/useCategories';

interface OrderedCategory {
  id: string;
  name: string;
  emoji: string;
  sortOrder: number;
}

export function useCategoryOrder(storeLocationId: string | null) {
  const categories = useCategories();
  const userId = useAuthStore((s) => s.userId);
  const [orderedCategories, setOrderedCategories] = useState<OrderedCategory[]>([]);
  const [hasCustomOrder, setHasCustomOrder] = useState(false);

  useEffect(() => {
    if (!userId || !storeLocationId || categories.length === 0) {
      // Default order: just use categories as-is
      setOrderedCategories(categories.map((c, i) => ({ ...c, sortOrder: i })));
      setHasCustomOrder(false);
      return;
    }
    loadOrder();
  }, [userId, storeLocationId, categories.length]);

  async function loadOrder() {
    if (!userId || !storeLocationId) return;

    const { data } = await (supabase
      .from('user_category_order' as any)
      .select('category_id, sort_order')
      .eq('user_id', userId)
      .eq('store_location_id', storeLocationId)
      .order('sort_order', { ascending: true }) as any);

    if (data && data.length > 0) {
      const orderMap = new Map<string, number>();
      for (const d of data) orderMap.set(d.category_id, d.sort_order);

      const ordered = categories
        .map((c) => ({ ...c, sortOrder: orderMap.get(c.id) ?? 999 }))
        .sort((a, b) => a.sortOrder - b.sortOrder);

      setOrderedCategories(ordered);
      setHasCustomOrder(true);
    } else {
      setOrderedCategories(categories.map((c, i) => ({ ...c, sortOrder: i })));
      setHasCustomOrder(false);
    }
  }

  const moveCategory = useCallback(async (categoryId: string, direction: 'up' | 'down') => {
    setOrderedCategories((prev) => {
      const idx = prev.findIndex((c) => c.id === categoryId);
      if (idx < 0) return prev;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;

      const next = [...prev];
      [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
      return next.map((c, i) => ({ ...c, sortOrder: i }));
    });
  }, []);

  const saveOrder = useCallback(async () => {
    if (!userId || !storeLocationId) return;

    // Delete existing order for this user+store
    await (supabase
      .from('user_category_order' as any)
      .delete()
      .eq('user_id', userId)
      .eq('store_location_id', storeLocationId) as any);

    // Insert new order
    const rows = orderedCategories.map((c, i) => ({
      user_id: userId,
      store_location_id: storeLocationId,
      category_id: c.id,
      sort_order: i,
    }));

    await (supabase.from('user_category_order' as any).insert(rows) as any);
    setHasCustomOrder(true);
  }, [userId, storeLocationId, orderedCategories]);

  return { orderedCategories, hasCustomOrder, moveCategory, saveOrder };
}
