import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../app/AuthContext'
import Icon from '../../components/ui/Icon'
import campus from '../../assets/hcmute-campus.webp'
import { authMessages, login, roleRoutes, validateLogin } from './auth'
import ForgotPasswordDialog from './ForgotPasswordDialog'
import { SessionStatus } from './SessionControls'
import './login.css'

function LocalLink({ to, children, onClick, ...props }) {
  return <Link to={to} {...props} onClick={onClick}>{children}</Link>
}

function LoginForm({ authenticate = login, onForgotPassword, onAuthenticated, routeNotice = '' }) {
  const [values, setValues] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [showSummary, setShowSummary] = useState(false)
  const [visible, setVisible] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const summary = useRef(null)
  const request = useRef(null)
  const redirectTimer = useRef(null)
  const mounted = useRef(true)
  const submitting = useRef(false)
  const busy = status === 'loading' || status === 'success'

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      request.current?.abort()
      window.clearTimeout(redirectTimer.current)
    }
  }, [])

  function update(field, value) {
    setValues((previous) => ({ ...previous, [field]: value }))
    if (status === 'error') { setStatus('idle'); setMessage('') }
    if (errors[field] && !validateLogin({ ...values, [field]: value })[field]) {
      setErrors((previous) => { const next = { ...previous }; delete next[field]; return next })
    }
  }

  function validateField(field) {
    const error = validateLogin(values)[field]
    setErrors((previous) => { const next = { ...previous }; if (error) next[field] = error; else delete next[field]; return next })
  }

  async function submit(event) {
    event.preventDefault()
    if (submitting.current) return
    const nextErrors = validateLogin(values)
    setErrors(nextErrors)
    setMessage('')
    setStatus('idle')
    if (Object.keys(nextErrors).length) {
      setShowSummary(true)
      requestAnimationFrame(() => summary.current?.focus())
      return
    }
    setShowSummary(false)
    submitting.current = true
    setStatus('loading')
    request.current = new AbortController()
    try {
      const result = await authenticate(values, { signal: request.current.signal })
      if (request.current.signal.aborted || !mounted.current) return
      setStatus('success')
      setValues((previous) => ({ ...previous, password: '' }))
      setMessage('Signed in successfully. Taking you to your learning space…')
      const destination = result.user?.mustChangePassword ? '/change-password' : result.destination
      redirectTimer.current = window.setTimeout(async () => {
        if (!mounted.current) return
        if (onAuthenticated) await onAuthenticated(destination)
        else window.location.replace(destination)
      }, 450)
    } catch (error) {
      if (request.current.signal.aborted || !mounted.current) return
      setStatus('error')
      setMessage(authMessages[error.code] || authMessages.UNAVAILABLE)
      submitting.current = false
    }
  }

  return <>
    <div className="card-heading">
      <h1 id="page-title">Sign in</h1>
    </div>
    <form noValidate onSubmit={submit} aria-labelledby="page-title" aria-busy={status === 'loading'}>
      {!message && routeNotice && (
        <div className="form-notice success-notice" role="status">
          <Icon name="check" />
          <p>{routeNotice}</p>
        </div>
      )}
      {showSummary && Object.keys(errors).length > 0 && (
        <div className="form-notice error-summary" ref={summary} tabIndex={-1} role="alert">
          <strong>Please check your sign-in details.</strong>
          <ul>
            {Object.entries(errors).map(([field, error]) => (
              <li key={field}>
                <a
                  href={`#${field}`}
                  onClick={(event) => {
                    event.preventDefault()
                    document.getElementById(field)?.focus()
                  }}
                >
                  {error}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="field">
        <label htmlFor="email">Email <span className="required-mark" aria-hidden="true">*</span></label>
        <div className={`input-wrap ${errors.email ? 'has-error' : ''}`}>
          <Icon name="mail" />
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            placeholder="Enter your email"
            value={values.email}
            onChange={(event) => update('email', event.target.value)}
            onBlur={() => validateField('email')}
            disabled={busy}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'email-error' : undefined}
          />
        </div>
        {errors.email && <p className="field-error" id="email-error" aria-live="polite">{errors.email}</p>}
      </div>

      <div className="field password-field">
        <label htmlFor="password">Password <span className="required-mark" aria-hidden="true">*</span></label>
        <div className={`input-wrap ${errors.password ? 'has-error' : ''}`}>
          <Icon name="lock" />
          <input
            id="password"
            name="password"
            type={visible ? 'text' : 'password'}
            autoComplete="current-password"
            required
            placeholder="Enter your password"
            value={values.password}
            onChange={(event) => update('password', event.target.value)}
            onBlur={() => { validateField('password'); setCapsLock(false) }}
            onKeyUp={(event) => setCapsLock(event.getModifierState('CapsLock'))}
            onKeyDown={(event) => setCapsLock(event.getModifierState('CapsLock'))}
            disabled={busy}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={[errors.password && 'password-error', capsLock && 'caps-lock'].filter(Boolean).join(' ') || undefined}
          />
          <button
            className="password-toggle"
            type="button"
            aria-label={visible ? 'Hide password' : 'Show password'}
            aria-pressed={visible}
            onClick={() => setVisible(!visible)}
            disabled={busy}
          >
            <Icon name={visible ? 'eyeOff' : 'eye'} />
          </button>
        </div>
        {errors.password && <p className="field-error" id="password-error" aria-live="polite">{errors.password}</p>}
        {capsLock && <p className="field-hint" id="caps-lock" role="status">Caps Lock is on.</p>}
      </div>

      <div className="forgot-row">
        <button
          type="button"
          className="text-button"
          disabled={busy}
          onClick={() => onForgotPassword(values.email)}
        >
          Forgot password?
        </button>
        <LocalLink to="/support" className="login-help-link">Help</LocalLink>
      </div>

      <div aria-live="polite" aria-atomic="true">
        {message && (
          <div
            className={`form-notice ${status === 'success' ? 'success-notice' : ''}`}
            role={status === 'error' ? 'alert' : 'status'}
          >
            <Icon name={status === 'success' ? 'check' : 'alert'} />
            <p>{message}</p>
          </div>
        )}
      </div>

      <button className="primary-button" type="submit" disabled={busy}>
        {status === 'loading'
          ? <><span className="spinner" />Signing in…</>
          : status === 'success'
            ? <><Icon name="check" />Signed in successfully</>
            : <>Sign in<Icon name="arrow" size={18} /></>}
      </button>
    </form>
  </>
}

function SupportContent({ unavailable, onForgotPassword }) {
  return <>
    <div className="card-heading">
      <h1 id="page-title">{unavailable ? 'Page unavailable' : 'Sign-in help'}</h1>
    </div>
    <div className="support-copy">
      {unavailable ? (
        <p>This area is not available yet.</p>
      ) : (
        <>
          <p>Use the email and password provided by your university. Your account determines your role automatically.</p>
          <div className="support-note">
            <Icon name="shield" />
            <p>If you do not have an account or your account has been disabled, contact your university administrator.</p>
          </div>
          <button type="button" className="text-button support-text-link" onClick={onForgotPassword}>
            I forgot my password<Icon name="arrow" size={18} />
          </button>
        </>
      )}
    </div>
    <LocalLink to="/login" className="primary-button">
      <Icon name="back" size={18} />
      Back to sign in
    </LocalLink>
  </>
}

export default function LoginPage() {
  const { user, loading, refresh } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const path = location.pathname
  const [recoveryEmail, setRecoveryEmail] = useState(() => path === '/forgot-password' ? '' : null)
  const main = useRef(null)

  useEffect(() => {
    if (path === '/forgot-password') {
      setRecoveryEmail((previous) => previous === null ? '' : previous)
    } else if (path === '/login') {
      setRecoveryEmail(null)
    }
    if (path !== '/forgot-password') {
      requestAnimationFrame(() => main.current?.focus())
    }
  }, [path])

  const isLogin = path === '/' || path === '/login' || path === '/forgot-password'
  const isSupport = path === '/support'
  useEffect(() => {
    document.title = `${recoveryEmail !== null ? 'Forgot password' : isLogin ? 'Sign in' : isSupport ? 'Sign-in help' : 'Page unavailable'} | University LMS`
  }, [isLogin, recoveryEmail, isSupport])

  function closeRecovery() {
    setRecoveryEmail(null)
    if (path === '/forgot-password') navigate('/login', { replace: true })
  }

  async function handleAuthenticated(destination) {
    await refresh()
    navigate(destination, { replace: true })
  }

  if (loading) return <SessionStatus />
  if (user) return <Navigate to={user.mustChangePassword ? '/change-password' : roleRoutes[user.role]} replace />

  return (
    <div className="lms-workspace lms-portal-student auth-page">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <main id="main-content" className="auth-main" tabIndex={-1} ref={main}>
        <section className="campus-panel" aria-label="University campus">
          <img
            className="campus-image"
            src={campus}
            width="1237"
            height="1002"
            alt="Entrance to HCMC University of Technology and Engineering at 1 Vo Van Ngan Street"
            fetchPriority="high"
          />
        </section>

        <section className="form-panel" aria-labelledby="page-title">
          <div className="form-column">
            <div className="login-card">
              {isLogin ? (
                <LoginForm
                  onForgotPassword={setRecoveryEmail}
                  onAuthenticated={handleAuthenticated}
                  routeNotice={location.state?.message || ''}
                />
              ) : (
                <SupportContent
                  unavailable={!isSupport}
                  onForgotPassword={() => setRecoveryEmail('')}
                />
              )}
            </div>
          </div>
        </section>
      </main>

      {recoveryEmail !== null && (
        <ForgotPasswordDialog initialEmail={recoveryEmail} onClose={closeRecovery} />
      )}
    </div>
  )
}
