import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark' | 'system';

type UIState = {
  sidebarCollapsed: boolean;
  theme: Theme;
  commandPaletteOpen: boolean;
  notificationsPanelOpen: boolean;
  toggleSidebar: () => void;
  setTheme: (theme: Theme) => void;
  toggleCommandPalette: () => void;
  toggleNotificationsPanel: () => void;
};

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      theme: 'system',
      commandPaletteOpen: false,
      notificationsPanelOpen: false,

      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      setTheme: (theme) => set({ theme }),

      toggleCommandPalette: () =>
        set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen })),

      toggleNotificationsPanel: () =>
        set((state) => ({ notificationsPanelOpen: !state.notificationsPanelOpen })),
    }),
    {
      name: 'cloud-manager-ui',
      partialize: (state) => ({ theme: state.theme }),
    },
  ),
);

export type { Theme, UIState };
