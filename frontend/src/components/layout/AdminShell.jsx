import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Presentation,
  UserCheck,
  KeyRound,
  BarChart3,
  GraduationCap,
  ArrowLeftRight,
  LogOut,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react'
import { useAuth } from '../../app/AuthContext'
import { Badge } from '../ui/Badge'
import { adminNavigation } from './adminNavigation'

const navIcons = {
  grid: LayoutDashboard,
  users: Users,
  book: BookOpen,
  classes: Presentation,
  enroll: UserCheck,
  lock: KeyRound,
  chart: BarChart3,
}

export default function AdminShell({ path, children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const current = adminNavigation.find((item) => item.path === path) || adminNavigation[0]
  const displayName = user?.fullName || 'Admin preview'
  const displayEmail = user?.email || 'admin@lms-demo.test'
  const avatarInitial = displayName.trim().charAt(0).toUpperCase() || 'A'

  async function handleLogout() {
    if (loggingOut) return
    setLoggingOut(true)
    setLogoutError('')
    try {
      await logout()
      navigate('/login')
    } catch (error) {
      setLogoutError(error.message || 'Unable to sign out. Please try again.')
      setLoggingOut(false)
    }
  }

  const sidebarContent = (
    <aside className="admin-sidebar" aria-label="Admin workspace navigation">
      <div className="admin-brand-header">
        <Link to="/admin" className="admin-brand">
          <span className="admin-brand-mark" aria-hidden="true">
            <GraduationCap size={20} />
          </span>
          <span className="admin-brand-text">
            <strong>University LMS</strong>
            <small>Admin Portal</small>
          </span>
        </Link>
        <button
          type="button"
          className="admin-mobile-close"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        >
          <X size={20} />
        </button>
      </div>

      <div className="admin-nav-scroll">
        <p className="admin-nav-label">Administration</p>
        <nav aria-label="Administration">
          {adminNavigation.map((item) => {
            const NavIcon = navIcons[item.icon] || LayoutDashboard
            const active = current.path === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                aria-current={active ? 'page' : undefined}
                onClick={() => setMobileOpen(false)}
              >
                <NavIcon size={18} aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="admin-sidebar-footer">
        <Link className="admin-portal-switch" to="/student/dashboard" onClick={() => setMobileOpen(false)}>
          <ArrowLeftRight size={14} aria-hidden="true" />
          <span>Student Portal</span>
        </Link>
        <span className="admin-term-label">Academic Year 2026–2027</span>
      </div>
    </aside>
  )

  return (
    <div className="admin-shell">
      <a className="skip-link" href="#admin-main">Skip to main content</a>

      <div className="admin-desktop-sidebar">{sidebarContent}</div>

      {mobileOpen && (
        <div
          className="admin-drawer-overlay"
          role="presentation"
          onClick={() => setMobileOpen(false)}
        >
          <div className="admin-drawer-panel" onClick={(event) => event.stopPropagation()}>
            {sidebarContent}
          </div>
        </div>
      )}

      <div className="admin-body">
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <button
              type="button"
              className="admin-mobile-toggle"
              aria-label="Toggle navigation"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={20} />
            </button>
            <nav className="admin-breadcrumb" aria-label="Breadcrumb">
              <Link to="/admin">Admin Portal</Link>
              <ChevronRight size={14} aria-hidden="true" />
              <span aria-current="page">{current.label}</span>
            </nav>
          </div>

          <div className="admin-topbar-right">
            <div className="admin-topbar-user">
              <span className="admin-avatar" aria-hidden="true">{avatarInitial}</span>
              <div className="admin-topbar-user-info">
                <strong>{displayName}</strong>
                <div className="admin-topbar-user-meta">
                  <span>{displayEmail}</span>
                  <Badge variant="SUBMITTED" label="Admin" size="sm" />
                </div>
              </div>
            </div>
            <Link className="admin-change-password" to="/change-password">
              Change password
            </Link>
            <button
              type="button"
              className="admin-logout-button"
              onClick={handleLogout}
              disabled={loggingOut}
            >
              <LogOut size={15} aria-hidden="true" />
              <span>{loggingOut ? 'Signing out…' : 'Log out'}</span>
            </button>
            {logoutError && <span className="admin-logout-error" role="alert">{logoutError}</span>}
          </div>
        </header>

        <main id="admin-main" tabIndex={-1} className="admin-main">
          {children}
        </main>

        <footer className="admin-footer">
          <span>University LMS · Admin Portal</span>
          <span>{user ? 'Authenticated session' : 'Frontend preview · Sample data'}</span>
        </footer>
      </div>
    </div>
  )
}
