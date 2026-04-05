import { create } from 'zustand';

interface Toast {
  id: string;
  message: string;
  icon?: string;
}

interface UIState {
  selectedListId: string | null;
  setSelectedList: (id: string | null) => void;
  toasts: Toast[];
  showToast: (message: string, icon?: string) => void;
  dismissToast: (id: string) => void;
}

let toastCounter = 0;

export const useUIStore = create<UIState>((set) => ({
  selectedListId: null,
  setSelectedList: (id) => set({ selectedListId: id }),
  toasts: [],
  showToast: (message, icon) => {
    const id = `toast-${++toastCounter}`;
    set((s) => ({ toasts: [...s.toasts, { id, message, icon }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
