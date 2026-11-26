import { useState, useEffect } from 'react'
import { Navigate, Outlet, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../../app/AuthContext'
import { roleRoutes } from '../../services/http'
import './session.css'

export function SessionStatus() {
  const { sessionError, refresh } = useAuth()
  return (
    <main className="lms-workspace session-page">
      <div className="session-card" role="status">
        {sessionError ? (
          <>
            <p>{sessionError}</p>
            <button type="button" onClick={refresh}>Retry</button>
          </>
        ) : (
          <p>Checking session…</p>
        )}
      </div>
    </main>
  )
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
  return (
    <span className="session-logout">
      <button type="button" className={className} onClick={submit} disabled={busy}>
        {busy ? 'Signing out…' : 'Log out'}
      </button>
      {error && <span role="alert">{error} Sign-out did not complete; please try again.</span>}
    </span>
  )
}

export function InstructorEntry() {
  const { user } = useAuth()
  return (
    <main className="lms-workspace session-page">
      <section className="session-card">
        <div className="session-brand">University LMS · Instructor</div>
        <h1>Assigned Courses</h1>
        <p>Welcome, {user.fullName}.</p>
        <div className="session-footer-actions">
          <Link className="lms-link" to="/change-password">Change password</Link>
          <LogoutButton />
        </div>
      </section>
    </main>
  )
}
