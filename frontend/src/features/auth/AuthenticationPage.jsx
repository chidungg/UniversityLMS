import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../app/AuthContext'
import { authApi, roleRoutes } from '../../services/http'
import { SessionStatus, LogoutButton } from './SessionControls'
import './session.css'

export function PasswordField({ id, label, value, onChange, autoComplete = 'new-password', disabled }) {
  const [visible, setVisible] = useState(false)
  return <div className="session-field"><label htmlFor={id}>{label}</label><div className="session-password"><input id={id} name={id} type={visible ? 'text' : 'password'} autoComplete={autoComplete} value={value} onChange={(event) => onChange(event.target.value)} required disabled={disabled} /><button type="button" aria-label={`${visible ? 'Ẩn' : 'Hiện'} ${label.toLowerCase()}`} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? 'Ẩn' : 'Hiện'}</button></div></div>
}
export default function AuthenticationPage({ recovery = false, changePassword = false }) {
  const { user, loading, sessionError, login, refresh } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [values, setValues] = useState({ email: '', password: '', currentPassword: '', confirmPassword: '', note: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const errorRef = useRef(null)
  const lock = useRef(false)
  const title = changePassword ? 'Đổi mật khẩu' : recovery ? 'Quên mật khẩu' : 'Đăng nhập'
  useEffect(() => {
    document.title = `${title} | University LMS`
    const previousLanguage = document.documentElement.lang
    document.documentElement.lang = 'vi'
    return () => { document.documentElement.lang = previousLanguage }
  }, [title])
  useEffect(() => { if (error) errorRef.current?.focus() }, [error])
  function update(key, value) { setValues((previous) => ({ ...previous, [key]: value })); setError('') }
  async function submit(event) {
    event.preventDefault()
    if (lock.current) return
    lock.current = true; setBusy(true); setError(''); setSuccess('')
    try {
      if (changePassword) {
        if (values.password.length < 8 || new TextEncoder().encode(values.password).length > 72 || values.password !== values.confirmPassword) throw new Error('Mật khẩu mới cần ít nhất 8 ký tự, tối đa 72 byte UTF-8 và xác nhận phải khớp.')
        await authApi.changePassword(values)
        await refresh()
        navigate('/login', { replace: true, state: { message: 'Đã đổi mật khẩu và kết thúc các phiên cũ. Vui lòng đăng nhập lại.' } })
      } else if (recovery) {
        const result = await authApi.recover({ email: values.email.trim(), note: values.note.trim() })
        setSuccess(result.message)
      } else {
        const account = await login(values.email, values.password)
        setValues((previous) => ({ ...previous, password: '' }))
        navigate(account.mustChangePassword ? '/change-password' : roleRoutes[account.role], { replace: true })
      }
    } catch (failure) { setError(failure.message) }
    finally { lock.current = false; setBusy(false) }
  }
  if (loading || sessionError) return <SessionStatus />
  if (user && !changePassword) return <Navigate to={user.mustChangePassword ? '/change-password' : roleRoutes[user.role]} replace />
  return <main className="session-page"><section className="session-card" aria-labelledby="session-title">
    <p>University LMS</p><h1 id="session-title">{title}</h1>
    <p>{changePassword ? user?.mustChangePassword ? 'Bạn đang sử dụng mật khẩu tạm. Hãy đặt mật khẩu riêng trước khi tiếp tục.' : 'Sau khi đổi mật khẩu, bạn cần đăng nhập lại trên các thiết bị.' : recovery ? 'Gửi yêu cầu để quản trị viên xác minh danh tính và đặt lại mật khẩu.' : 'Sử dụng tài khoản do trường cung cấp.'}</p>
    {location.state?.message && <p className="session-success" role="status">{location.state.message}</p>}
    {success ? <><p className="session-success" role="status">{success}</p><p>Mật khẩu hiện tại giữ nguyên cho đến khi quản trị viên xử lý yêu cầu. Liên hệ bộ phận quản trị tài khoản của trường để xác minh danh tính.</p><Link to="/login">Trở về đăng nhập</Link></> : <form onSubmit={submit} className="session-form" aria-busy={busy}>
      {error && <div className="session-error" role="alert" ref={errorRef} tabIndex={-1}>{error}</div>}
      {!changePassword && <div className="session-field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={254} value={values.email} onChange={(event) => update('email', event.target.value)} disabled={busy} /></div>}
      {changePassword && <PasswordField id="currentPassword" label="Mật khẩu hiện tại" autoComplete="current-password" value={values.currentPassword} onChange={(value) => update('currentPassword', value)} disabled={busy} />}
      {!recovery && <PasswordField id="password" label={changePassword ? 'Mật khẩu mới' : 'Mật khẩu'} autoComplete={changePassword ? 'new-password' : 'current-password'} value={values.password} onChange={(value) => update('password', value)} disabled={busy} />}
      {changePassword && <><PasswordField id="confirmPassword" label="Xác nhận mật khẩu mới" value={values.confirmPassword} onChange={(value) => update('confirmPassword', value)} disabled={busy} /><p>Ít nhất 8 ký tự, tối đa 72 byte UTF-8.</p></>}
      {recovery && <div className="session-field"><label htmlFor="note">Ghi chú (không bắt buộc)</label><textarea id="note" rows={3} maxLength={500} value={values.note} onChange={(event) => update('note', event.target.value)} disabled={busy} aria-describedby="note-help" /><small id="note-help">{values.note.length}/500 ký tự. Không ghi mật khẩu vào ghi chú.</small></div>}
      <button className="session-primary" type="submit" disabled={busy}>{busy ? 'Đang xử lý…' : changePassword ? 'Lưu mật khẩu mới' : recovery ? 'Gửi yêu cầu' : 'Đăng nhập'}</button>
      {!changePassword && <Link to={recovery ? '/login' : '/forgot-password'}>{recovery ? 'Trở về đăng nhập' : 'Quên mật khẩu?'}</Link>}
    </form>}
    {changePassword && <><Link to={roleRoutes[user?.role] || '/'} hidden={user?.mustChangePassword}>Về khu vực của tôi</Link><LogoutButton /></>}
  </section></main>
}
