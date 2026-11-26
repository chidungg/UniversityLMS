import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../app/AuthContext'
import { authApi, roleRoutes } from '../../services/http'
import { SessionStatus, LogoutButton } from './SessionControls'
import './session.css'

export function PasswordField({ id, label, value, onChange, autoComplete = 'new-password', disabled }) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="session-field">
      <label htmlFor={id}>{label}</label>
      <div className="session-password">
        <input
          id={id}
          name={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required
          disabled={disabled}
        />
        <button
          type="button"
          aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
          aria-pressed={visible}
          onClick={() => setVisible(!visible)}
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
    </div>
  )
}

export default function AuthenticationPage() {
  const { user, loading, sessionError, refresh } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [values, setValues] = useState({ currentPassword: '', password: '', confirmPassword: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const errorRef = useRef(null)
  const lock = useRef(false)
  const title = 'Change password'

  useEffect(() => {
    document.title = `${title} | University LMS`
  }, [title])

  useEffect(() => { if (error) errorRef.current?.focus() }, [error])

  function update(key, value) {
    setValues((previous) => ({ ...previous, [key]: value }))
    setError('')
  }

  async function submit(event) {
    event.preventDefault()
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      if (values.password.length < 8 || new TextEncoder().encode(values.password).length > 72 || values.password !== values.confirmPassword) {
        throw new Error('New password must be 8–72 UTF-8 bytes and match confirmation.')
      }
      await authApi.changePassword(values)
      await refresh()
      navigate('/login', { replace: true, state: { message: 'Password updated and previous sessions signed out. Please sign in again.' } })
    } catch (failure) {
      setError(failure.message)
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  if (loading || sessionError) return <SessionStatus />

  return (
    <main className="lms-workspace session-page">
      <section className="session-card" aria-labelledby="session-title">
        <div className="session-brand">University LMS</div>
        <h1 id="session-title">{title}</h1>
        {user?.mustChangePassword && (
          <p className="session-notice">
            You are using a temporary password. Set a personal password to continue.
          </p>
        )}
        {location.state?.message && <p className="session-success" role="status">{location.state.message}</p>}
        <form onSubmit={submit} className="session-form" aria-busy={busy}>
          {error && <div className="session-error" role="alert" ref={errorRef} tabIndex={-1}>{error}</div>}
          <PasswordField
            id="currentPassword"
            label="Current password"
            autoComplete="current-password"
            value={values.currentPassword}
            onChange={(value) => update('currentPassword', value)}
            disabled={busy}
          />
          <PasswordField
            id="password"
            label="New password"
            autoComplete="new-password"
            value={values.password}
            onChange={(value) => update('password', value)}
            disabled={busy}
          />
          <PasswordField
            id="confirmPassword"
            label="Confirm new password"
            value={values.confirmPassword}
            onChange={(value) => update('confirmPassword', value)}
            disabled={busy}
          />
          <p className="session-hint">At least 8 characters (max 72 UTF-8 bytes).</p>
          <button className="session-primary" type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save new password'}
          </button>
        </form>
        <div className="session-footer-actions">
          {!user?.mustChangePassword && (
            <Link className="lms-link" to={roleRoutes[user?.role] || '/'}>
              Back to workspace
            </Link>
          )}
          <LogoutButton />
        </div>
      </section>
    </main>
  )
}
