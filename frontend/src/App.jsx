import LoginPage from './features/auth/LoginPage'
import ForbiddenPage from './features/errors/ForbiddenPage'
import NotFoundPage from './features/errors/NotFoundPage'
import AdminDashboard from './features/admin/AdminDashboard'
import UserManagement from './features/admin/users/UserManagement'
import CourseManagement from './features/admin/courses/CourseManagement'
import ClassManagement from './features/admin/classes/ClassManagement'
import EnrollmentManagement from './features/admin/enrollments/EnrollmentManagement'

export default function App() {
  const path = window.location.pathname

  if (path === '/admin/users') return <UserManagement />
  if (path === '/admin/courses') return <CourseManagement />
  if (path === '/admin/classes') return <ClassManagement />
  if (path === '/admin/enrollments') return <EnrollmentManagement />

  if (['/admin', '/admin/dashboard', '/admin/statistics'].includes(path)) return <AdminDashboard />

  if (path === '/403' || path === '/forbidden') return <ForbiddenPage />
  if (path === '/404' || path === '/not-found') return <NotFoundPage />
  if (path === '/' || path === '/login' || path === '/forgot-password' || path === '/support') return <LoginPage />

  return <NotFoundPage />
}
