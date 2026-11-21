export const roleRoutes = {
  admin: '/admin/users',
  instructor: '/instructor/classes',
  student: '/student/courses',
}

export function validateLogin({ email, password }) {
  const errors = {}
  if (!email.trim()) errors.email = 'Please enter your email.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = 'Enter a valid email address, e.g. name@university.edu.'
  if (!password) errors.password = 'Please enter your password.'
  // Existing passwords must remain valid; creation rules belong to reset/signup.
  return errors
}

export class AuthError extends Error {
  constructor(code) { super(code); this.name = 'AuthError'; this.code = code }
}

export const authMessages = {
  NOT_CONFIGURED: 'Sign-in is currently unavailable. Please try again later or contact your university account administrator.',
  INVALID_CREDENTIALS: 'Incorrect email or password. Please check your details and try again.',
  ACCOUNT_DISABLED: 'Your account has been disabled. Please contact your university account administrator for help.',
  FORBIDDEN: 'Your account does not have access to this system. Please contact your university account administrator.',
  RATE_LIMITED: 'Too many sign-in attempts. Please wait a moment and try again.',
  OFFLINE: 'You are offline. Check your connection and try signing in again.',
  TIMEOUT: 'The connection is taking longer than expected. Please try signing in again.',
  UNAVAILABLE: 'Unable to connect to the system. Please try signing in again later.',
  INVALID_RESPONSE: 'Unable to verify your sign-in session. Please try again or contact your university account administrator.',
}

// Proposed, opt-in contract: no authentication endpoint exists in the backend yet.
// The server must create a secure HttpOnly cookie and enforce authorization.
export async function login(credentials, { endpoint = import.meta.env?.VITE_AUTH_LOGIN_URL, fetcher = fetch, signal } = {}) {
  if (globalThis.navigator?.onLine === false) throw new AuthError('OFFLINE')
  if (!endpoint) throw new AuthError('NOT_CONFIGURED')
  const timeout = AbortSignal.timeout(15000)
  let response
  try {
    response = await fetcher(endpoint, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email: credentials.email.trim(), password: credentials.password }),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new AuthError(timeout.aborted ? 'TIMEOUT' : 'UNAVAILABLE')
  }
  let data
  try {
    data = await response.json()
  } catch (error) {
    if (signal?.aborted) throw error
    if (timeout.aborted) throw new AuthError('TIMEOUT')
    data = null
  }
  if (!response.ok) {
    if (response.status === 403 && data?.code === 'ACCOUNT_DISABLED') throw new AuthError('ACCOUNT_DISABLED')
    if (response.status === 401) throw new AuthError('INVALID_CREDENTIALS')
    if (response.status === 403) throw new AuthError('FORBIDDEN')
    if (response.status === 429) throw new AuthError('RATE_LIMITED')
    throw new AuthError('UNAVAILABLE')
  }
  if (data?.user?.isActive === false) throw new AuthError('ACCOUNT_DISABLED')
  const destination = Object.hasOwn(roleRoutes, data?.user?.role) ? roleRoutes[data.user.role] : null
  if (!destination || !data.user.id) throw new AuthError('INVALID_RESPONSE')
  return { user: data.user, destination }
}
