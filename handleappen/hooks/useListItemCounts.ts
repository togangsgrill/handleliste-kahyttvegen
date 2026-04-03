import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface ItemCount {
  total: number;
  checked: number;
}

export function useListItemCounts(listIds: string[]) {
  const [counts, setCounts] = useState<Map<string, ItemCount>>(new Map());

  useEffect(() => {
    if (listIds.length === 0) return;

    supabase
      .from('list_items')
      .select('list_id, is_checked')
      .in('list_id', listIds)
      .eq('is_deleted', false)
      .then(({ data }) => {
        if (!data) return;
        const map = new Map<string, ItemCount>();
        for (const item of data) {
          const current = map.get(item.list_id) ?? { total: 0, checked: 0 };
          current.total++;
          if (item.is_checked) current.checked++;
          map.set(item.list_id, current);
        }
        setCounts(map);
      });
  }, [listIds.join(',')]);

  return counts;
}
