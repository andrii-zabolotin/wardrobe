import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  activeAvatarId: string | null;
  setAuth: (token: string, user: User) => void;
  setActiveAvatarId: (id: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      activeAvatarId: null,
      setAuth: (token, user) => set({ token, user }),
      setActiveAvatarId: (id) => set({ activeAvatarId: id }),
      logout: () => set({ token: null, user: null, activeAvatarId: null }),
    }),
    {
      name: 'wardrobe-auth',
    }
  )
);
