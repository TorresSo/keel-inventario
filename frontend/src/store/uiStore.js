import { create } from 'zustand';

let nextId = 1;

export const useUiStore = create((set) => ({
  loading: false,
  notifications: [],

  setLoading: (loading) => set({ loading }),

  notify: (message, type = 'info') => {
    const id = nextId++;
    set((state) => ({
      notifications: [...state.notifications, { id, message, type }],
    }));
    setTimeout(() => {
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id),
      }));
    }, 4500);
  },

  dismiss: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
}));

export const notifySuccess = (msg) => useUiStore.getState().notify(msg, 'success');
export const notifyError = (msg) => useUiStore.getState().notify(msg, 'error');
export const notifyInfo = (msg) => useUiStore.getState().notify(msg, 'info');
