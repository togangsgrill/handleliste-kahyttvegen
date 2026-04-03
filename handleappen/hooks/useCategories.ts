import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type Category = Database['public']['Tables']['categories']['Row'];

let cachedCategories: Category[] | null = null;

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>(cachedCategories ?? []);

  useEffect(() => {
    if (cachedCategories) return;

    supabase
      .from('categories')
      .select('*')
      .order('name')
      .then(({ data }) => {
        if (data) {
          cachedCategories = data;
          setCategories(data);
        }
      });
  }, []);

  return categories;
}
