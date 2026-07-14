import { create } from 'zustand';
import { apiClient } from '../api/client';

interface DevState {
  devMode: boolean;
  setDevMode: (enabled: boolean) => void;
  toggleDevMode: () => Promise<void>;
  fetchDevMode: () => Promise<void>;
}

export const useDevStore = create<DevState>((set, get) => ({
  devMode: false,
  setDevMode: (enabled) => set({ devMode: enabled }),
  fetchDevMode: async () => {
    try {
      const res = await apiClient.get('/settings');
      set({ devMode: res.data.dev_mode });
    } catch (e) {
      console.error('Failed to fetch dev mode', e);
    }
  },
  toggleDevMode: async () => {
    const currentState = get().devMode;
    try {
      const res = await apiClient.patch('/settings', { dev_mode: !currentState });
      set({ devMode: res.data.dev_mode });
    } catch (e) {
      console.error('Failed to toggle dev mode', e);
    }
  },
}));
