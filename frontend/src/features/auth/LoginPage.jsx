import { useEffect, useRef, useState } from 'react'
import Icon from '../../components/ui/Icon'
import campus from '../../assets/hcmute-campus.webp'
import { authMessages, login, validateLogin } from './auth'
import ForgotPasswordDialog from './ForgotPasswordDialog'
import './login.css'

function navigate(path) {
  window.history.pushState(null, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function LocalLink({ to, children, onClick, ...props }) {
  return <a href={to} {...props} onClick={(event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    onClick?.()
    navigate(to)
  }}>{children}</a>
}

function LoginForm({ authenticate = login, onForgotPassword }) {
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
  const submitting = useRef(false)
  const busy = status === 'loading' || status === 'success'

  useEffect(() => () => {
    request.current?.abort()
    window.clearTimeout(redirectTimer.current)
  }, [])

  function update(field, value) {
    setValues((previous) => ({ ...previous, [field]: value }))
    if (status === 'error') { setStatus('idle'); setMessage('') }
    // Clear a corrected error, but do not introduce new errors while typing.
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
      if (request.current.signal.aborted) return
      setStatus('success')
      setValues((previous) => ({ ...previous, password: '' }))
      setMessage('Signed in successfully. Taking you to your learning space…')
      redirectTimer.current = window.setTimeout(() => window.location.replace(result.destination), 900)
    } catch (error) {
      if (request.current.signal.aborted) return
      setStatus('error')
      setMessage(authMessages[error.code] || authMessages.UNAVAILABLE)
      submitting.current = false
    }
  }

  return <>
    <div className="card-heading">
      <div className="heading-icon"><Icon name="lock" size={24} /></div>
      <h1 id="page-title">Sign in</h1>
      <p>Welcome back to University LMS.</p>
    </div>
    <form noValidate onSubmit={submit} aria-labelledby="page-title" aria-busy={status === 'loading'}>
      {showSummary && Object.keys(errors).length > 0 && <div className="form-notice error-summary" ref={summary} tabIndex={-1} role="alert">
        <strong>Please check your sign-in details.</strong>
        <ul>{Object.entries(errors).map(([field, error]) => <li key={field}><a href={`#${field}`} onClick={(event) => { event.preventDefault(); document.getElementById(field)?.focus() }}>{error}</a></li>)}</ul>
      </div>}
      <div className="field">
        <label htmlFor="email">Email <span className="required-mark" aria-hidden="true">*</span></label>
        <div className={`input-wrap ${errors.email ? 'has-error' : ''}`}>
          <Icon name="mail" />
          <input id="email" name="email" type="email" autoComplete="username" inputMode="email" autoCapitalize="none" spellCheck={false} required placeholder="Enter your email" value={values.email} onChange={(event) => update('email', event.target.value)} onBlur={() => validateField('email')} disabled={busy} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'email-error' : undefined} />
        </div>
        {errors.email && <p className="field-error" id="email-error" aria-live="polite">{errors.email}</p>}
      </div>
      <div className="field password-field">
        <label htmlFor="password">Password <span className="required-mark" aria-hidden="true">*</span></label>
        <div className={`input-wrap ${errors.password ? 'has-error' : ''}`}>
          <Icon name="lock" />
          <input id="password" name="password" type={visible ? 'text' : 'password'} autoComplete="current-password" required placeholder="Enter your password" value={values.password} onChange={(event) => update('password', event.target.value)} onBlur={() => { validateField('password'); setCapsLock(false) }} onKeyUp={(event) => setCapsLock(event.getModifierState('CapsLock'))} onKeyDown={(event) => setCapsLock(event.getModifierState('CapsLock'))} disabled={busy} aria-invalid={Boolean(errors.password)} aria-describedby={[errors.password && 'password-error', capsLock && 'caps-lock'].filter(Boolean).join(' ') || undefined} />
          <button className="password-toggle" type="button" aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible} onClick={() => setVisible(!visible)} disabled={busy}><Icon name={visible ? 'eyeOff' : 'eye'} /></button>
        </div>
        {errors.password && <p className="field-error" id="password-error" aria-live="polite">{errors.password}</p>}
        {capsLock && <p className="field-hint" id="caps-lock" role="status">Caps Lock is on.</p>}
      </div>
      <div className="forgot-row"><button type="button" className="text-button" disabled={busy} onClick={() => onForgotPassword(values.email)}>Forgot password?</button></div>
      <div aria-live="polite" aria-atomic="true">
        {message && <div className={`form-notice ${status === 'success' ? 'success-notice' : ''}`}><Icon name={status === 'success' ? 'check' : 'alert'} /><p>{message}</p></div>}
      </div>
      <button className="primary-button" type="submit" disabled={busy}>
        {status === 'loading' ? <><span className="spinner" />Signing in…</> : status === 'success' ? <><Icon name="check" />Signed in successfully</> : <>Sign in<Icon name="arrow" size={18} /></>}
      </button>
    </form>
    <div className="account-note"><Icon name="shield" size={19} /><p>Use your university-provided account.</p></div>
  </>
}

function SupportContent({ unavailable, onForgotPassword }) {
  return <>
    <div className="card-heading">
      <div className="heading-icon"><Icon name="help" size={24} /></div>
      <h1 id="page-title">{unavailable ? 'Page unavailable' : 'Sign-in help'}</h1>
      <p>{unavailable ? 'This area is not available yet.' : 'A few details to help you sign in.'}</p>
    </div>
    <div className="support-copy">
      {unavailable ? <p>The sign-in page is ready. Learning and administration pages will be available in a future update.</p> : <>
        <p>Use the email and password provided by your university. Your account determines your role automatically.</p>
        <div className="support-note"><Icon name="shield" /><p>If you do not have an account or your account has been disabled, contact your university account administrator.</p></div>
        <button type="button" className="text-button support-text-link" onClick={onForgotPassword}>I forgot my password<Icon name="arrow" size={18} /></button>
      </>}
    </div>
    <LocalLink to="/login" className="primary-button"><Icon name="back" size={18} />Back to sign in</LocalLink>
  </>
}

export default function LoginPage() {
  const [path, setPath] = useState(window.location.pathname)
  const [recoveryEmail, setRecoveryEmail] = useState(() => window.location.pathname === '/forgot-password' ? '' : null)
  const main = useRef(null)
  useEffect(() => {
    const onNavigate = () => {
      if (window.location.pathname === path) return
      const nextPath = window.location.pathname
      setPath(nextPath)
      setRecoveryEmail(nextPath === '/forgot-password' ? '' : null)
      if (nextPath !== '/forgot-password') requestAnimationFrame(() => main.current?.focus())
    }
    window.addEventListener('popstate', onNavigate)
    return () => window.removeEventListener('popstate', onNavigate)
  }, [path])
  const isLogin = path === '/' || path === '/login' || path === '/forgot-password'
  const isSupport = path === '/support'
  useEffect(() => { document.title = `${recoveryEmail !== null ? 'Forgot password' : isLogin ? 'Sign in' : isSupport ? 'Sign-in help' : 'Page unavailable'} | University LMS` }, [isLogin, recoveryEmail, isSupport])

  function closeRecovery() {
    setRecoveryEmail(null)
    if (path === '/forgot-password') navigate('/login')
  }

  return <div className="auth-page">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <header className="site-header">
      <LocalLink to="/login" className="brand">
        <span className="brand-mark"><Icon name="book" size={26} /></span>
        <span className="brand-wordmark"><span>University <b>LMS</b><span className="brand-dot">.</span></span><small>LEARNING MANAGEMENT SYSTEM</small></span>
      </LocalLink>
      <div className="header-right"><span className="portal-label">Online learning portal</span><span className="header-divider" /><LocalLink to="/support" className="help-link"><Icon name="help" size={18} />Help</LocalLink></div>
    </header>
    <main id="main-content" className="auth-main" tabIndex={-1} ref={main}>
      <section className="campus-panel" aria-label="University campus">
        <img className="campus-image" src={campus} width="1237" height="1002" alt="Entrance to HCMC University of Technology and Engineering at 1 Vo Van Ngan Street" fetchPriority="high" />
        <div className="campus-caption"><span className="campus-caption-icon"><Icon name="pin" size={20} /></span><div><p>HCMC University of Technology and Engineering</p><span>1 Vo Van Ngan Street, Ho Chi Minh City</span></div><span className="campus-abbr" aria-hidden="true">HCMUTE</span></div>
      </section>
      <section className="form-panel" aria-labelledby="page-title">
        <div className="form-column">
          <p className="section-eyebrow">YOUR DIGITAL LEARNING SPACE</p>
          <div className="login-card">{isLogin ? <LoginForm onForgotPassword={setRecoveryEmail} /> : <SupportContent unavailable={!isSupport} onForgotPassword={() => setRecoveryEmail('')} />}</div>
          <p className="below-card">Need help? <LocalLink to="/support">View sign-in guidance<Icon name="arrow" size={14} /></LocalLink></p>
        </div>
      </section>
    </main>
    <footer className="site-footer"><p>© {new Date().getFullYear()} University LMS<span className="footer-dot">·</span>Learning management system</p><span>For students, instructors and administrators</span></footer>
    {recoveryEmail !== null && <ForgotPasswordDialog initialEmail={recoveryEmail} onClose={closeRecovery} />}
  </div>
}
