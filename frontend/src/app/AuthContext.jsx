import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { authApi, validUser } from '../services/http'
const AuthContext = createContext(null)
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sessionError, setSessionError] = useState('')
  const epoch = useRef(0)
  const refresh = useCallback(async () => {
    const version = ++epoch.current
    try {
      const data = await authApi.me()
      if (!validUser(data.user)) throw new Error('Dữ liệu phiên đăng nhập không hợp lệ.')
      if (version === epoch.current) { setUser(data.user); setSessionError('') }
      return data.user
    } catch (error) {
      if (version === epoch.current) {
        setUser(null)
        setSessionError(error.status === 401 || error.code === 'ACCOUNT_DISABLED' ? '' : error.message)
      }
      return null
    } finally { if (version === epoch.current) setLoading(false) }
  }, [])
  useEffect(() => {
    // Remove credentials left by the old preview implementation.
    try { localStorage.removeItem('lms_token'); localStorage.removeItem('lms_user') } catch { /* Authentication does not depend on browser storage. */ }
    refresh()
    const revalidate = (event) => {
      if (document.visibilityState === 'hidden') return
      // Only show the blocking session check when restoring a frozen bfcache snapshot.
      if (event?.type === 'pageshow' && event.persisted) setLoading(true)
      refresh()
    }
    const invalidate = (event) => {
      epoch.current += 1
      setLoading(false)
      if (event.detail === 'PASSWORD_CHANGE_REQUIRED') setUser((value) => value ? { ...value, mustChangePassword: true } : null)
      else setUser(null)
    }
    window.addEventListener('focus', revalidate)
    window.addEventListener('pageshow', revalidate)
    document.addEventListener('visibilitychange', revalidate)
    window.addEventListener('lms:auth-invalid', invalidate)
    return () => {
      window.removeEventListener('focus', revalidate); window.removeEventListener('pageshow', revalidate)
      document.removeEventListener('visibilitychange', revalidate); window.removeEventListener('lms:auth-invalid', invalidate)
    }
  }, [refresh])
  const login = async (email, password) => {
    epoch.current += 1
    const data = await authApi.login(email, password)
    if (!validUser(data.user)) throw new Error('Dữ liệu đăng nhập không hợp lệ.')
    setSessionError(''); setUser(data.user); setLoading(false)
    return data.user
  }
  const logout = async () => {
    epoch.current += 1
    try { await authApi.logout() }
    catch (error) { if (error.status !== 401 && error.code !== 'ACCOUNT_DISABLED') throw error }
    setUser(null); setSessionError(''); setLoading(false)
  }
  return <AuthContext.Provider value={{ user, loading, sessionError, refresh, login, logout, isAuthenticated: Boolean(user), isStudent: user?.role === 'Student' }}>{children}</AuthContext.Provider>
}
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth requires AuthProvider')
  return context
}
