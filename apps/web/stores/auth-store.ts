import { create } from 'zustand';
import { signOut } from 'next-auth/react';

type Role =
  | 'cloud_architect'
  | 'devops_engineer'
  | 'data_engineer'
  | 'system_admin'
  | 'network_admin';

type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
  avatar?: string;
  mfaEnabled: boolean;
  organization?: string;
};

type AuthState = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  setUser: (user) =>
    set({ user, isAuthenticated: user !== null, isLoading: false }),

  setLoading: (isLoading) => set({ isLoading }),

  logout: () => {
    set({ user: null, isAuthenticated: false, isLoading: false });
    signOut({ callbackUrl: '/login' });
  },
}));

export type { Role, User, AuthState };
