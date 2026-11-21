import { useEffect } from 'react'
import Icon from '../../components/ui/Icon'
import './error-page.css'

export default function ErrorPage({ code, label, title, description }) {
  useEffect(() => {
    document.title = `${code} ${label} | University LMS`
  }, [code, label])

  return <div className="auth-page error-page">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <header className="site-header">
      <a className="brand" href="/login" aria-label="University LMS — home">
        <span className="brand-mark"><Icon name="book" size={26} /></span>
        <span className="brand-wordmark"><span>University <b>LMS</b><span className="brand-dot">.</span></span><small>LEARNING MANAGEMENT SYSTEM</small></span>
      </a>
      <div className="header-right"><span className="portal-label">Online learning portal</span><span className="header-divider" /><a href="/support" className="help-link"><Icon name="help" size={18} />Help</a></div>
    </header>

    <main id="main-content" className="error-main" tabIndex={-1}>
      <section className="error-column" aria-labelledby="error-title">
        <p className="section-eyebrow">YOUR DIGITAL LEARNING SPACE</p>
        <div className="login-card error-card">
          <div className="card-heading">
            <div className="heading-icon"><Icon name={code === '403' ? 'shield' : 'help'} size={24} /></div>
            <p className="error-code">{code}</p>
            <p className="error-label">{label}</p>
            <h1 id="error-title">{title}</h1>
            <p className="error-description">{description}</p>
          </div>
          <a className="primary-button" href="/login">Back to sign in<Icon name="arrow" size={18} /></a>
          <div className="account-note"><Icon name="shield" size={19} /><p>Use your university-provided account.</p></div>
        </div>
        <p className="below-card">Need help? <a href="/support">View sign-in guidance<Icon name="arrow" size={14} /></a></p>
      </section>
    </main>

    <footer className="site-footer"><p>© {new Date().getFullYear()} University LMS<span className="footer-dot">·</span>Learning management system</p><span>For students, instructors and administrators</span></footer>
  </div>
}
