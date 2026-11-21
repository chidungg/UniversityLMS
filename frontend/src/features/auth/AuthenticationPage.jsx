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
          aria-label={`${visible ? 'Ẩn' : 'Hiện'} ${label.toLowerCase()}`}
          aria-pressed={visible}
          onClick={() => setVisible(!visible)}
        >
          {visible ? 'Ẩn' : 'Hiện'}
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
  const title = 'Đổi mật khẩu'

  useEffect(() => {
    document.title = `${title} | University LMS`
    const previousLanguage = document.documentElement.lang
    document.documentElement.lang = 'vi'
    return () => { document.documentElement.lang = previousLanguage }
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
        throw new Error('Mật khẩu mới cần ít nhất 8 ký tự, tối đa 72 byte UTF-8 và xác nhận phải khớp.')
      }
      await authApi.changePassword(values)
      await refresh()
      navigate('/login', { replace: true, state: { message: 'Đã đổi mật khẩu và kết thúc các phiên cũ. Vui lòng đăng nhập lại.' } })
    } catch (failure) {
      setError(failure.message)
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  if (loading || sessionError) return <SessionStatus />

  return (
    <main className="session-page">
      <section className="session-card" aria-labelledby="session-title">
        <p>University LMS</p>
        <h1 id="session-title">{title}</h1>
        <p>
          {user?.mustChangePassword
            ? 'Bạn đang sử dụng mật khẩu tạm. Hãy đặt mật khẩu riêng trước khi tiếp tục.'
            : 'Sau khi đổi mật khẩu, bạn cần đăng nhập lại trên các thiết bị.'}
        </p>
        {location.state?.message && <p className="session-success" role="status">{location.state.message}</p>}
        <form onSubmit={submit} className="session-form" aria-busy={busy}>
          {error && <div className="session-error" role="alert" ref={errorRef} tabIndex={-1}>{error}</div>}
          <PasswordField
            id="currentPassword"
            label="Mật khẩu hiện tại"
            autoComplete="current-password"
            value={values.currentPassword}
            onChange={(value) => update('currentPassword', value)}
            disabled={busy}
          />
          <PasswordField
            id="password"
            label="Mật khẩu mới"
            autoComplete="new-password"
            value={values.password}
            onChange={(value) => update('password', value)}
            disabled={busy}
          />
          <PasswordField
            id="confirmPassword"
            label="Xác nhận mật khẩu mới"
            value={values.confirmPassword}
            onChange={(value) => update('confirmPassword', value)}
            disabled={busy}
          />
          <p>Ít nhất 8 ký tự, tối đa 72 byte UTF-8.</p>
          <button className="session-primary" type="submit" disabled={busy}>
            {busy ? 'Đang xử lý…' : 'Lưu mật khẩu mới'}
          </button>
        </form>
        <Link to={roleRoutes[user?.role] || '/'} hidden={user?.mustChangePassword}>Về khu vực của tôi</Link>
        <LogoutButton />
      </section>
    </main>
  )
}
