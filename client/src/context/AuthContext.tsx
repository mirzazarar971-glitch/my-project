import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { api, getApiError } from '../services/api'
import { usePreferences } from '../state/preferences'
import { AuthContext, type AuthContextValue, type AuthUser } from './authValue'

export function AuthProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const isAdminRoute = pathname.startsWith('/admin')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [status, setStatus] = useState<AuthContextValue['status']>(() => isAdminRoute ? 'loading' : 'guest')
  const [authError, setAuthError] = useState('')

  const acceptUser = useCallback((nextUser: AuthUser) => {
    setUser(nextUser)
    setStatus('authenticated')
    setAuthError('')
  }, [])

  useEffect(() => {
    if (!isAdminRoute) return
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
  }, [acceptUser, isAdminRoute])

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post<{ user: AuthUser }>('/auth/login', { email, password })
    acceptUser(data.user)
  }, [acceptUser])
  const logout = useCallback(async () => {
    await api.post('/auth/logout')
    setUser(null)
    setStatus('guest')
    setAuthError('')
  }, [])
  const toggleFavorite = useCallback(async (slug: string) => {
    usePreferences.getState().toggleFavorite(slug)
  }, [])
  const recordVisit = useCallback((slug: string) => {
    usePreferences.getState().recordVisit(slug)
  }, [])

  const value = useMemo(() => ({ user, status, authError, login, logout, toggleFavorite, recordVisit }), [user, status, authError, login, logout, toggleFavorite, recordVisit])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
