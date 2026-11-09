import LoginPage from './features/auth/LoginPage'
import ForbiddenPage from './features/errors/ForbiddenPage'
import NotFoundPage from './features/errors/NotFoundPage'
import AdminDashboard from './features/admin/AdminDashboard'

export default function App() {
  const path = window.location.pathname

  if (['/admin', '/admin/dashboard', '/admin/users', '/admin/courses', '/admin/classes', '/admin/enrollments', '/admin/statistics'].includes(path)) return <AdminDashboard />

  if (path === '/403' || path === '/forbidden') return <ForbiddenPage />
  if (path === '/404' || path === '/not-found') return <NotFoundPage />
  if (path === '/' || path === '/login' || path === '/forgot-password' || path === '/support') return <LoginPage />

  return <NotFoundPage />
}
