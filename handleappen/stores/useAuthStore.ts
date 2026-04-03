import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';

interface AuthState {
  session: Session | null;
  userId: string | null;
  householdId: string | null;
  isLoading: boolean;
  setSession: (session: Session | null) => void;
  setHouseholdId: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  userId: null,
  householdId: null,
  isLoading: true,
  setSession: (session) =>
    set({
      session,
      userId: session?.user?.id ?? null,
    }),
  setHouseholdId: (id) => set({ householdId: id }),
  setLoading: (loading) => set({ isLoading: loading }),
}));
