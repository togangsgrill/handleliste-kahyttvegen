import { create } from 'zustand';

interface UIState {
  selectedListId: string | null;
  setSelectedList: (id: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  selectedListId: null,
  setSelectedList: (id) => set({ selectedListId: id }),
}));
