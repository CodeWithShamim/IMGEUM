import {create} from 'zustand';

export type ToastKind = 'pending' | 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
  txHash?: `0x${string}`;
  /** i18n key already resolved by the caller; message is display text. */
}

interface ToastStore {
  toasts: Toast[];
  push: (t: Omit<Toast, 'id'>) => string;
  update: (id: string, patch: Partial<Toast>) => void;
  dismiss: (id: string) => void;
}

export const useToasts = create<ToastStore>((set) => ({
  toasts: [],
  push: (t) => {
    const id = Math.random().toString(36).slice(2);
    set((s) => ({toasts: [...s.toasts, {...t, id}]}));
    if (t.kind === 'success' || t.kind === 'info') {
      setTimeout(() => set((s) => ({toasts: s.toasts.filter((x) => x.id !== id)})), 6000);
    }
    return id;
  },
  update: (id, patch) =>
    set((s) => {
      const toasts = s.toasts.map((x) => (x.id === id ? {...x, ...patch} : x));
      if (patch.kind === 'success' || patch.kind === 'info') {
        setTimeout(() => set((st) => ({toasts: st.toasts.filter((x) => x.id !== id)})), 6000);
      }
      return {toasts};
    }),
  dismiss: (id) => set((s) => ({toasts: s.toasts.filter((x) => x.id !== id)})),
}));
