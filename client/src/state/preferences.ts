import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Preferences = {
  favorites: string[]
  recent: string[]
  theme: 'dark' | 'light'
  toggleFavorite: (slug: string) => void
  recordVisit: (slug: string) => void
  setFavorites: (favorites: string[]) => void
  setRecent: (recent: string[]) => void
  setTheme: (theme: 'dark' | 'light') => void
}

export const usePreferences = create<Preferences>()(persist((set) => ({
  favorites: [],
  recent: [],
  theme: 'dark',
  toggleFavorite: (slug) => set((state) => ({
    favorites: state.favorites.includes(slug)
      ? state.favorites.filter((item) => item !== slug)
      : [slug, ...state.favorites],
  })),
  recordVisit: (slug) => set((state) => ({
    recent: [slug, ...state.recent.filter((item) => item !== slug)].slice(0, 8),
  })),
  setFavorites: (favorites) => set({ favorites: [...new Set(favorites)] }),
  setRecent: (recent) => set({ recent: [...new Set(recent)].slice(0, 8) }),
  setTheme: (theme) => set({ theme }),
}), { name: 'devtools-hub-preferences' }))
