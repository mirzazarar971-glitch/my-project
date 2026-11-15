import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, getApiError } from '../services/api'
import { usePreferences } from '../state/preferences'
import { AuthContext, type AuthContextValue, type AuthUser } from './authValue'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [status, setStatus] = useState<AuthContextValue['status']>('loading')
  const [authError, setAuthError] = useState('')

  const acceptUser = useCallback(async (nextUser: AuthUser) => {
    const guestFavorites = usePreferences.getState().favorites
    const serverFavorites = new Set(nextUser.favorites)
    const mergedFavorites = [...new Set([...nextUser.favorites, ...guestFavorites])]
    for (const slug of guestFavorites.filter((favorite) => !serverFavorites.has(favorite))) {
      await api.patch('/auth/favorites', { slug, action: 'add' })
    }
    usePreferences.getState().setFavorites(mergedFavorites)
    usePreferences.getState().setRecent(nextUser.recentlyUsed)
    setUser({ ...nextUser, favorites: mergedFavorites })
    setStatus('authenticated')
    setAuthError('')
  }, [])

  useEffect(() => {
    let active = true
    void api.get<{ user: AuthUser }>('/auth/me')
      .then(({ data }) => active ? acceptUser(data.user) : undefined)
      .catch((error: unknown) => {
        if (!active) return
        const message = getApiError(error)
        setUser(null)
        if (message.includes('requires a configured MongoDB') || message.includes('Network Error')) {
          setStatus('unavailable')
          setAuthError(message)
        } else {
          setStatus('guest')
          setAuthError('')
        }
      })
    return () => { active = false }
  }, [acceptUser])

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post<{ user: AuthUser }>('/auth/login', { email, password })
    await acceptUser(data.user)
  }, [acceptUser])
  const register = useCallback(async (name: string, email: string, password: string) => {
    const { data } = await api.post<{ user: AuthUser }>('/auth/register', { name, email, password })
    await acceptUser(data.user)
  }, [acceptUser])
  const logout = useCallback(async () => {
    await api.post('/auth/logout')
    setUser(null)
    setStatus('guest')
    setAuthError('')
  }, [])
  const toggleFavorite = useCallback(async (slug: string) => {
    const before = usePreferences.getState().favorites
    usePreferences.getState().toggleFavorite(slug)
    if (!user) return
    const action = before.includes(slug) ? 'remove' : 'add'
    try {
      const { data } = await api.patch<{ user: AuthUser }>('/auth/favorites', { slug, action })
      setUser(data.user)
      usePreferences.getState().setFavorites(data.user.favorites)
    } catch (error) {
      usePreferences.getState().setFavorites(before)
      throw new Error(getApiError(error, 'Could not sync this favorite.'))
    }
  }, [user])
  const recordVisit = useCallback((slug: string) => {
    usePreferences.getState().recordVisit(slug)
    if (!user) return
    void api.post(`/tools/${encodeURIComponent(slug)}/use`).catch((error: unknown) => {
      setAuthError(`Activity could not be synced: ${getApiError(error)}`)
    })
  }, [user])

  const value = useMemo(() => ({ user, status, authError, login, register, logout, toggleFavorite, recordVisit }), [user, status, authError, login, register, logout, toggleFavorite, recordVisit])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
