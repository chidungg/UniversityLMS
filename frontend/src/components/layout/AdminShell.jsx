import Icon from '../ui/Icon'
import { useAuth } from '../../app/AuthContext'
import { LogoutButton } from '../../features/auth/SessionControls'

import { adminNavigation } from './adminNavigation'


export default function AdminShell({ path, children }) {
  const { user } = useAuth()
  const current = adminNavigation.find((item) => item.path === path) || adminNavigation[0]
  return <div className="admin-shell">
    <a className="skip-link" href="#admin-main">Skip to main content</a>
    <aside className="admin-sidebar" aria-label="Admin workspace navigation">
      <a href="/admin" className="admin-brand"><span className="admin-brand-icon"><Icon name="book" size={24} /></span><span>University <b>LMS.</b><small>LEARNING MANAGEMENT SYSTEM</small></span></a>
      <div className="admin-workspace"><Icon name="shield" /><div><strong>Admin workspace</strong><span>Academic administration</span></div></div>
      <p className="admin-nav-label">WORKSPACE</p>
      <nav aria-label="Administration">{adminNavigation.map((item) => <a key={item.path} href={item.path} aria-current={current.path === item.path ? 'page' : undefined}><Icon name={item.icon} size={19} /><span>{item.label}</span></a>)}</nav>
      <div className="admin-sidebar-bottom"><div className="admin-sidebar-note"><Icon name="shield" size={20} /><strong>A connected learning space.</strong><p>Keep accounts, classes and access organized in one place.</p></div><LogoutButton className="admin-exit" /></div>
    </aside>
    <div className="admin-body">
      <header className="admin-topbar"><nav className="admin-breadcrumb" aria-label="Breadcrumb"><a href="/admin">Workspace</a><Icon name="chevron" size={14} /><span aria-current="page">{current.label}</span></nav><details className="admin-account"><summary><span><strong>{user?.fullName}</strong><small>Administrator</small></span><span className="admin-avatar" aria-hidden="true">AD</span></summary><div className="admin-account-popover"><p>{user?.email}</p><a href="/change-password">Đổi mật khẩu</a><LogoutButton /></div></details></header>
      <main id="admin-main" tabIndex={-1} className="admin-main">{children}</main>
      <footer className="admin-footer"><span>University LMS · Administration</span><span>{path === '/admin/password-resets' ? 'Quản lý khôi phục tài khoản' : 'Các module học vụ hiện dùng dữ liệu minh họa'}</span></footer>
    </div>
  </div>
}
