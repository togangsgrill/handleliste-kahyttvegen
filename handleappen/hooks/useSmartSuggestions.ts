import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/useAuthStore';
import { isClaudeConfigured, generateSuggestions } from '@/lib/claude';

interface Suggestion {
  name: string;
  confidence: number;
  categoryId: string | null;
  status: 'pending' | 'accepted' | 'dismissed';
}

export function useSmartSuggestions(listId: string | undefined, currentItemNames: string[]) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const householdId = useAuthStore((s) => s.householdId);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!householdId || !listId || !isClaudeConfigured() || fetchedRef.current) return;
    fetchedRef.current = true;
    loadSuggestions();
  }, [householdId, listId]);

  async function loadSuggestions() {
    if (!householdId || !listId) return;
    setLoading(true);

    try {
      // Check for cached suggestions in DB
      const { data: cached } = await (supabase
        .from('list_item_suggestions' as any)
        .select('name, confidence, status, category_id')
        .eq('list_id', listId)
        .eq('status', 'pending') as any);

      if (cached && cached.length > 0) {
        setSuggestions(cached.map((s: any) => ({
          name: s.name,
          confidence: s.confidence,
          categoryId: s.category_id ?? null,
          status: s.status,
        })));
        setLoading(false);
        return;
      }

      // Build purchase history: join receipt_items → receipts via household_id
      // Use foreign key relationship to avoid passing thousands of IDs in .in()
      const { data: items } = await (supabase
        .from('receipt_items' as any)
        .select('name, receipts!inner(purchased_at, household_id)')
        .eq('receipts.household_id', householdId)
        .limit(2000) as any);

      if (!items || items.length < 3) {
        setLoading(false);
        return;
      }

      // Build frequency map
      const freq = new Map<string, { count: number; lastDate: string }>();
      for (const item of items) {
        const name = (item.name as string).toLowerCase();
        const date = (item.receipts as any)?.purchased_at ?? '';
        const existing = freq.get(name);
        if (!existing) {
          freq.set(name, { count: 1, lastDate: date });
        } else {
          existing.count++;
          if (date > existing.lastDate) existing.lastDate = date;
        }
      }

      // Call Claude with real purchase history
      const history = [...freq.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 50)
        .map(([name, { count, lastDate }]) => ({
          name,
          frequency: count,
          lastPurchased: lastDate,
        }));

      const result = await generateSuggestions(history);

      // Fetch categories to map name → id
      const { data: categories } = await supabase.from('categories').select('id, name');
      const categoryMap = new Map<string, string>();
      for (const cat of categories ?? []) categoryMap.set(cat.name.toLowerCase(), cat.id);

      // Filter out items already on the list
      const currentSet = new Set(currentItemNames.map((n) => n.toLowerCase()));
      const filtered = result
        .filter((sg) => !currentSet.has(sg.name.toLowerCase()))
        .slice(0, 8)
        .map((sg) => ({
          name: sg.name,
          confidence: sg.confidence,
          categoryId: sg.categoryName ? (categoryMap.get(sg.categoryName.toLowerCase()) ?? null) : null,
          status: 'pending' as const,
        }));

      // Save to DB for caching
      if (filtered.length > 0 && listId) {
        await (supabase.from('list_item_suggestions' as any).insert(
          filtered.map((sg) => ({
            list_id: listId,
            name: sg.name,
            confidence: sg.confidence,
            category_id: sg.categoryId,
            suggested_by: 'ai',
            status: 'pending',
          }))
        ) as any);
      }

      setSuggestions(filtered);
    } catch (e) {
      console.warn('[SmartSuggestions] feil:', e);
    } finally {
      setLoading(false);
    }
  }

  const accept = useCallback(async (name: string) => {
    setSuggestions((prev) => prev.filter((s) => s.name !== name));
    if (listId) {
      await (supabase
        .from('list_item_suggestions' as any)
        .update({ status: 'accepted' })
        .eq('list_id', listId)
        .eq('name', name) as any);
    }
  }, [listId]);

  const dismiss = useCallback(async (name: string) => {
    setSuggestions((prev) => prev.filter((s) => s.name !== name));
    if (listId) {
      await (supabase
        .from('list_item_suggestions' as any)
        .update({ status: 'dismissed' })
        .eq('list_id', listId)
        .eq('name', name) as any);
    }
  }, [listId]);

  const visibleSuggestions = suggestions.filter((s) => s.status === 'pending');

  return { suggestions: visibleSuggestions, accept, dismiss, loading };
}
