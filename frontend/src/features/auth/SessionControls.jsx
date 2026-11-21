import { useState, useEffect } from 'react'
import { Navigate, Outlet, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../../app/AuthContext'
import { roleRoutes } from '../../services/http'
import './session.css'

export function SessionStatus() {
  const { sessionError, refresh } = useAuth()
  return <main className="session-page"><div className="session-card" role="status">{sessionError ? <><p>{sessionError}</p><button onClick={refresh}>Thử lại</button></> : <p>Đang kiểm tra phiên đăng nhập…</p>}</div></main>
}
export function ProtectedRoute({ roles, allowPasswordChange = false }) {
  const { user, loading, sessionError, refresh } = useAuth()
  const location = useLocation()
  const [checkedKey, setCheckedKey] = useState(null)
  useEffect(() => {
    let active = true
    refresh().then(() => { if (active) setCheckedKey(location.key) })
    return () => { active = false }
  }, [location.key, refresh])
  if (loading || sessionError || checkedKey !== location.key) return <SessionStatus />
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/403" replace />
  if (user.mustChangePassword && !allowPasswordChange) return <Navigate to="/change-password" replace />
  return <Outlet />
}
export function HomeRedirect() {
  const { user, loading, sessionError } = useAuth()
  if (loading || sessionError) return <SessionStatus />
  return <Navigate to={user ? user.mustChangePassword ? '/change-password' : roleRoutes[user.role] : '/login'} replace />
}
export function LogoutButton({ className = '' }) {
  const { logout } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit() {
    if (busy) return
    setBusy(true); setError('')
    try { await logout() } catch (failure) { setError(failure.message); setBusy(false) }
  }
  return <span className="session-logout"><button type="button" className={className} onClick={submit} disabled={busy}>{busy ? 'Đang đăng xuất…' : 'Đăng xuất'}</button>{error && <span role="alert">{error} Phiên chưa được đăng xuất; vui lòng thử lại.</span>}</span>
}
export function InstructorEntry() {
  const { user } = useAuth()
  return <main className="session-page"><section className="session-card"><p>University LMS · Giảng viên</p><h1>Lớp tôi dạy</h1><p>Xin chào, {user.fullName}.</p><p>Chức năng lớp được phân công sẽ khả dụng khi module quản lý lớp được kết nối.</p><Link to="/change-password">Đổi mật khẩu</Link><LogoutButton /></section></main>
}
