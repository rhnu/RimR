import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Theme } from '@/commands';

export type { Theme };

type ThemeState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function applyThemeClass(theme: Theme) {
  const root = document.documentElement;
  const isDark = theme === 'dark' || (theme === 'system' && systemPrefersDark());
  root.classList.toggle('dark', isDark);
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'system',
      setTheme: (theme) => {
        applyThemeClass(theme);
        set({ theme });
      },
    }),
    {
      name: 'rimr-theme',
      onRehydrateStorage: () => (state) => {
        if (state) applyThemeClass(state.theme);
      },
    },
  ),
);
