import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api, todayISO } from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    // The server sets a readable pf_hint cookie next to the httpOnly session cookie.
    // No hint → never logged in here, so skip the request (and the 401 it would log).
    if (!document.cookie.split('; ').includes('pf_hint=1')) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      const data = await api(`/api/auth/me?date=${todayISO()}`)
      setUser(data.user)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Any API call answering 401 means the session is gone: forget the user (the guard redirects to Login)
  useEffect(() => {
    const onUnauthorized = () => setUser(null)
    window.addEventListener('pulsefit:unauthorized', onUnauthorized)
    return () => window.removeEventListener('pulsefit:unauthorized', onUnauthorized)
  }, [])

  const login = useCallback(async (email, password) => {
    const data = await api('/api/auth/login', { method: 'POST', body: { email, password, date: todayISO() } })
    setUser(data.user)
    return data.user
  }, [])

  const signup = useCallback(async (fields) => {
    const data = await api('/api/auth/signup', { method: 'POST', body: fields })
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(async () => {
    await api('/api/auth/logout', { method: 'POST' })
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, refresh }}>{children}</AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

export function initialsOf(name = '') {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join('') || '?'
  )
}
