import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/useAuthStore';
import type { Database } from '@/types/database';

type ListItem = Database['public']['Tables']['list_items']['Row'];

export function useListItems(listId: string | undefined) {
  const [items, setItems] = useState<ListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    if (!listId) return;

    const { data } = await supabase
      .from('list_items')
      .select('*')
      .eq('list_id', listId)
      .eq('is_deleted', false)
      .order('is_checked', { ascending: true })
      .order('created_at', { ascending: true });

    setItems(data ?? []);
    setIsLoading(false);
  }, [listId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Realtime subscription
  useEffect(() => {
    if (!listId) return;

    const channel = supabase
      .channel(`items:${listId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'list_items',
          filter: `list_id=eq.${listId}`,
        },
        () => {
          fetchItems();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [listId, fetchItems]);

  const addItem = async (name: string) => {
    const userId = useAuthStore.getState().userId;
    if (!listId || !userId) return;

    const { error } = await supabase.from('list_items').insert({
      list_id: listId,
      name: name.trim(),
      added_by: userId,
      quantity: 1,
    });

    if (error) throw error;

    // Log activity
    await supabase.from('list_activity').insert({
      list_id: listId,
      user_id: userId,
      action: 'added',
      item_name: name.trim(),
    });
  };

  const toggleItem = async (item: ListItem) => {
    const userId = useAuthStore.getState().userId;
    if (!userId) return;

    const newChecked = !item.is_checked;

    const { error } = await supabase
      .from('list_items')
      .update({
        is_checked: newChecked,
        checked_by: newChecked ? userId : null,
        checked_at: newChecked ? new Date().toISOString() : null,
      })
      .eq('id', item.id);

    if (error) throw error;

    await supabase.from('list_activity').insert({
      list_id: item.list_id,
      user_id: userId,
      action: newChecked ? 'checked' : 'unchecked',
      item_name: item.name,
    });
  };

  const updateItem = async (
    id: string,
    updates: { name?: string; quantity?: number; note?: string | null; category_id?: string | null }
  ) => {
    const { error } = await supabase
      .from('list_items')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
  };

  const deleteItem = async (item: ListItem) => {
    const userId = useAuthStore.getState().userId;

    const { error } = await supabase
      .from('list_items')
      .update({ is_deleted: true })
      .eq('id', item.id);

    if (error) throw error;

    if (userId) {
      await supabase.from('list_activity').insert({
        list_id: item.list_id,
        user_id: userId,
        action: 'removed',
        item_name: item.name,
      });
    }
  };

  const activeItems = items.filter((i) => !i.is_checked);
  const checkedItems = items.filter((i) => i.is_checked);

  return {
    items,
    activeItems,
    checkedItems,
    isLoading,
    addItem,
    toggleItem,
    updateItem,
    deleteItem,
    refresh: fetchItems,
  };
}
