import { useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Presentation,
  UserCheck,
  KeyRound,
  BarChart3,
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
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState('')

  const resolvedPath =
    path || (location.pathname === '/admin/dashboard' ? '/admin' : location.pathname)
  const current = adminNavigation.find((item) => item.path === resolvedPath) || adminNavigation[0]
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
    <aside className="lms-sidebar admin-sidebar" aria-label="Admin workspace navigation">
      <div className="lms-sidebar-header">
        <Link to="/admin" className="lms-brand" onClick={() => setMobileOpen(false)}>
          <span className="lms-brand-text">
            <strong className="lms-brand-title">University LMS</strong>
            <span className="lms-brand-role">Admin Portal</span>
          </span>
        </Link>
        <button
          type="button"
          className="lms-mobile-close"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        >
          <X size={18} />
        </button>
      </div>

      <nav className="lms-sidebar-nav" aria-label="Administration">
        {adminNavigation.map((item) => {
          const NavIcon = navIcons[item.icon] || LayoutDashboard
          const active = current.path === item.path
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`lms-nav-link ${active ? 'is-active' : ''}`}
              aria-current={active ? 'page' : undefined}
              onClick={() => setMobileOpen(false)}
            >
              <NavIcon size={17} aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )

  return (
    <div className="lms-workspace lms-portal-admin admin-shell">
      <a className="skip-link" href="#admin-main">Skip to main content</a>

      <div className="lms-desktop-sidebar admin-desktop-sidebar">{sidebarContent}</div>

      {mobileOpen && (
        <div
          className="lms-drawer-overlay"
          role="presentation"
          onClick={() => setMobileOpen(false)}
        >
          <div className="lms-drawer-panel" onClick={(event) => event.stopPropagation()}>
            {sidebarContent}
          </div>
        </div>
      )}

      <div className="lms-main-column admin-body">
        <header className="lms-topbar admin-topbar">
          <div className="lms-topbar-left">
            <button
              type="button"
              className="lms-mobile-toggle"
              aria-label="Toggle navigation"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={18} />
            </button>
            <nav className="lms-topbar-breadcrumb" aria-label="Breadcrumb">
              <Link to="/admin">Admin Portal</Link>
              <ChevronRight size={14} aria-hidden="true" />
              <span aria-current="page">{current.label}</span>
            </nav>
          </div>

          <div className="lms-topbar-right">
            <div className="lms-topbar-user">
              <span className="lms-avatar" aria-hidden="true">{avatarInitial}</span>
              <div className="lms-topbar-user-info">
                <strong className="lms-topbar-user-name">{displayName}</strong>
                <div className="lms-topbar-user-meta">
                  <span>{displayEmail}</span>
                  <Badge variant="DEFAULT" label="Admin" size="sm" showDot={false} />
                </div>
              </div>
            </div>
            <span className="lms-topbar-divider" aria-hidden="true" />
            <Link className="lms-topbar-link" to="/change-password">
              Change password
            </Link>
            <button
              type="button"
              className="lms-topbar-logout"
              aria-label={loggingOut ? 'Signing out…' : 'Log out'}
              onClick={handleLogout}
              disabled={loggingOut}
            >
              <LogOut size={15} aria-hidden="true" />
              <span>{loggingOut ? 'Signing out…' : 'Log out'}</span>
            </button>
            {logoutError && <span className="lms-topbar-error" role="alert">{logoutError}</span>}
          </div>
        </header>

        <main id="admin-main" tabIndex={-1} className="admin-main">
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  )
}
