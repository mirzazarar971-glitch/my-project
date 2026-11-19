import { createContext } from 'react'

export type AuthUser = {
  id: string
  name: string
  email: string
  role: 'user' | 'admin'
}

export type AuthContextValue = {
  user: AuthUser | null
  status: 'loading' | 'guest' | 'authenticated' | 'unavailable'
  authError: string
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  toggleFavorite: (slug: string) => Promise<void>
  recordVisit: (slug: string) => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
