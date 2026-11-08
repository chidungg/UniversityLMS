import LoginPage from './features/auth/LoginPage'
import ForbiddenPage from './features/errors/ForbiddenPage'
import NotFoundPage from './features/errors/NotFoundPage'

export default function App() {
  const path = window.location.pathname

  if (path === '/403' || path === '/forbidden') return <ForbiddenPage />
  if (path === '/404' || path === '/not-found') return <NotFoundPage />
  if (path === '/' || path === '/login' || path === '/forgot-password' || path === '/support') return <LoginPage />

  return <NotFoundPage />
}
