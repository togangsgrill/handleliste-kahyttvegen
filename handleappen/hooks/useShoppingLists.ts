import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/useAuthStore';
import type { Database } from '@/types/database';

type ShoppingList = Database['public']['Tables']['shopping_lists']['Row'];

export function useShoppingLists() {
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const householdId = useAuthStore((s) => s.householdId);

  const fetchLists = useCallback(async () => {
    if (!householdId) {
      // Ingen household ennå — behold loading-state til den kommer
      return;
    }

    const { data, error: fetchError } = await supabase
      .from('shopping_lists')
      .select('*')
      .eq('household_id', householdId)
      .eq('is_deleted', false)
      .order('updated_at', { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setLists(data ?? []);
    }
    setIsLoading(false);
  }, [householdId]);

  const fetchListsRef = useRef(fetchLists);
  useEffect(() => {
    fetchListsRef.current = fetchLists;
  }, [fetchLists]);

  useEffect(() => {
    if (householdId) {
      setIsLoading(true);
      fetchLists();
    }
  }, [householdId, fetchLists]);

  // Realtime subscription — avhenger KUN av householdId for å unngå
  // at kanalen rives ned og gjenopprettes ved hver re-render (som kan
  // trigge `cannot add postgres_changes callbacks after subscribe()`
  // når Supabase-klienten gjenbruker samme kanalnavn).
  useEffect(() => {
    if (!householdId) return;

    const channel = supabase
      .channel(`lists:${householdId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shopping_lists',
          filter: `household_id=eq.${householdId}`,
        },
        () => {
          fetchListsRef.current();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [householdId]);

  const createList = async (name: string) => {
    const userId = useAuthStore.getState().userId;
    if (!householdId || !userId) return;

    const { error: insertError } = await supabase
      .from('shopping_lists')
      .insert({
        household_id: householdId,
        created_by: userId,
        name,
        visibility: 'shared',
      });

    if (insertError) throw insertError;
  };

  const deleteList = async (id: string) => {
    const { error: deleteError } = await supabase
      .from('shopping_lists')
      .update({ is_deleted: true })
      .eq('id', id);

    if (deleteError) throw deleteError;
  };

  return { lists, isLoading, error, createList, deleteList, refresh: fetchLists };
}
