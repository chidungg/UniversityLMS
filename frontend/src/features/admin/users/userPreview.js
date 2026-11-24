import { request } from '../../../services/http'
import { dashboardSample } from '../dashboardData'

// Replaceable frontend adapter backed by /api/admin/users when authenticated, with preview fallback only when Vite backend proxy is absent.
export const USER_PREVIEW_KEY = 'university-lms.user-preview.v1'
export const USER_ROLES = ['Student', 'Instructor', 'Administrator']
export const userLimits = { name: 100, email: 254, minPassword: 8, maxPasswordBytes: 72 }

const utf8Encoder = new TextEncoder()

function normalizePreviewUser(user) {
  if (!user || typeof user !== 'object') return user
  return user.role === 'Admin' ? { ...user, role: 'Administrator' } : user
}

function normalizeApiUser(user) {
  return {
    id: user.id || user._id,
    name: user.name || user.fullName,
    email: user.email,
    role: user.role === 'Admin' ? 'Administrator' : user.role,
    status: user.status || (user.isActive ? 'Active' : 'Inactive'),
    mustChangePassword: Boolean(user.mustChangePassword),
    createdAt: user.createdAt || null,
  }
}

export function validateUser(values, users = [], currentId, { requirePassword = false } = {}) {
  const errors = {}
  const trimmedName = (values.name || '').trim()
  if (!trimmedName) errors.name = 'Enter a full name.'
  else if (trimmedName.length > userLimits.name) errors.name = `Use ${userLimits.name} characters or fewer.`

  const email = (values.email || '').trim()
  if (!email) errors.email = 'Enter an email address.'
  else if (email.length > userLimits.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Enter a valid email address, such as name@example.edu.'
  } else if (users.some((user) => user.id !== currentId && user.email.toLowerCase() === email.toLowerCase())) {
    errors.email = 'This email is already in use. Enter a different email address.'
  }

  if (!USER_ROLES.includes(values.role)) errors.role = 'Select a role.'

  if (requirePassword) {
    const password = values.password || ''
    const confirmPassword = values.confirmPassword || ''
    if (!password) errors.password = 'Enter an initial password.'
    else if (!password.trim()) errors.password = 'Initial password cannot consist only of spaces.'
    else if (password.length < userLimits.minPassword) errors.password = `Use at least ${userLimits.minPassword} characters.`
    else if (utf8Encoder.encode(password).length > userLimits.maxPasswordBytes) {
      errors.password = `Use ${userLimits.maxPasswordBytes} UTF-8 bytes or fewer.`
    }

    if (!confirmPassword) errors.confirmPassword = 'Confirm the initial password.'
    else if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match.'
  }

  return errors
}

export function readPreviewUsers() {
  const stored = sessionStorage.getItem(USER_PREVIEW_KEY)
  if (stored === null) return structuredClone(dashboardSample.users)
  const parsed = JSON.parse(stored)
  if (!Array.isArray(parsed)) throw new Error('STORAGE')
  const users = parsed.map(normalizePreviewUser)
  if (
    users.some((user) => (
      !user ||
      typeof user.id !== 'string' || !user.id ||
      typeof user.name !== 'string' || !user.name.trim() ||
      typeof user.email !== 'string' ||
      !USER_ROLES.includes(user.role) ||
      !['Active', 'Inactive'].includes(user.status)
    )) ||
    new Set(users.map((user) => user.id)).size !== users.length
  ) throw new Error('STORAGE')
  return users
}

function isViteBackendAbsent(error, authenticated) {
  return (
    !authenticated &&
    error?.status === 503 &&
    error?.data?.message === 'Backend unavailable' &&
    !error?.code &&
    globalThis.navigator?.onLine !== false
  )
}

async function previewDelay(signal) {
  signal?.throwIfAborted()
  await new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new DOMException('Cancelled', 'AbortError')) }
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve() }, 350)
    signal?.addEventListener('abort', abort, { once: true })
  })
  signal?.throwIfAborted()
  if (globalThis.navigator?.onLine === false) throw new Error('OFFLINE')
}

async function fetchLiveUsers({ signal } = {}) {
  const firstPage = await request('/admin/users?page=1&limit=100', { signal })
  const allUsers = [...(firstPage.users || []).map(normalizeApiUser)]
  const total = firstPage.pagination?.total ?? allUsers.length
  let page = 2
  while (allUsers.length < total && page <= 20) {
    const nextPage = await request(`/admin/users?page=${page}&limit=100`, { signal })
    const batch = (nextPage.users || []).map(normalizeApiUser)
    if (!batch.length) break
    allUsers.push(...batch)
    page += 1
  }
  return allUsers
}

export async function listUsers({ signal, authenticated = false } = {}) {
  if (globalThis.navigator?.onLine === false) throw new Error('OFFLINE')
  try {
    return { users: await fetchLiveUsers({ signal }), preview: false }
  } catch (error) {
    if (error.name === 'AbortError' || signal?.aborted) throw error
    if (!isViteBackendAbsent(error, authenticated)) throw error
    await previewDelay(signal)
    return { users: readPreviewUsers(), preview: true }
  }
}

export const listPreviewUsers = listUsers

export async function getUserById(id, { signal, authenticated = false } = {}) {
  if (globalThis.navigator?.onLine === false) throw new Error('OFFLINE')
  try {
    const data = await request(`/admin/users/${encodeURIComponent(id)}`, { signal })
    return { user: normalizeApiUser(data.user), preview: false }
  } catch (error) {
    if (error.name === 'AbortError' || signal?.aborted) throw error
    if (!isViteBackendAbsent(error, authenticated)) throw error
    await previewDelay(signal)
    const user = readPreviewUsers().find((entry) => entry.id === id)
    if (!user) throw new Error('NOT_FOUND', { cause: error })
    return { user, preview: true }
  }
}

export async function createUser(values, { signal, authenticated = false } = {}) {
  if (globalThis.navigator?.onLine === false) throw new Error('OFFLINE')
  try {
    const response = await request('/admin/users', {
      method: 'POST',
      body: {
        fullName: values.name.trim(),
        email: values.email.trim().toLowerCase(),
        role: values.role,
        password: values.password,
        confirmPassword: values.confirmPassword,
        mustChangePassword: values.mustChangePassword !== false,
      },
      signal,
    })
    const users = await fetchLiveUsers({ signal })
    return { users, record: normalizeApiUser(response.user), preview: false }
  } catch (error) {
    if (error.name === 'AbortError' || signal?.aborted) throw error
    if (!isViteBackendAbsent(error, authenticated)) throw error
    await previewDelay(signal)
    const users = readPreviewUsers()
    const fields = validateUser(values, users, undefined, { requirePassword: true })
    if (Object.keys(fields).length) throw Object.assign(new Error('VALIDATION', { cause: error }), { fields })
    // Security boundary: passwords are never stored in browser preview storage.
    const record = {
      id: `U-${crypto.randomUUID()}`,
      name: values.name.trim(),
      email: values.email.trim().toLowerCase(),
      role: values.role,
      status: 'Active',
      mustChangePassword: values.mustChangePassword !== false,
    }
    const next = [record, ...users]
    sessionStorage.setItem(USER_PREVIEW_KEY, JSON.stringify(next))
    return { users: next, record, preview: true }
  }
}

export async function updateUser(id, values, { signal, authenticated = false } = {}) {
  if (globalThis.navigator?.onLine === false) throw new Error('OFFLINE')
  try {
    const response = await request(`/admin/users/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: {
        fullName: values.name.trim(),
        email: values.email.trim().toLowerCase(),
        role: values.role,
      },
      signal,
    })
    const users = await fetchLiveUsers({ signal })
    return { users, record: normalizeApiUser(response.user), preview: false }
  } catch (error) {
    if (error.name === 'AbortError' || signal?.aborted) throw error
    if (!isViteBackendAbsent(error, authenticated)) throw error
    await previewDelay(signal)
    const users = readPreviewUsers()
    const existing = users.find((user) => user.id === id)
    if (!existing) throw new Error('NOT_FOUND', { cause: error })
    const fields = validateUser(values, users, id)
    if (Object.keys(fields).length) throw Object.assign(new Error('VALIDATION', { cause: error }), { fields })
    const record = {
      ...existing,
      name: values.name.trim(),
      email: values.email.trim().toLowerCase(),
      role: values.role,
    }
    const next = users.map((user) => user.id === id ? record : user)
    sessionStorage.setItem(USER_PREVIEW_KEY, JSON.stringify(next))
    return { users: next, record, preview: true }
  }
}

export async function changeUserStatus(id, status, { signal, authenticated = false } = {}) {
  if (globalThis.navigator?.onLine === false) throw new Error('OFFLINE')
  try {
    const response = await request(`/admin/users/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: {
        isActive: status === 'Active',
        status,
      },
      signal,
    })
    const users = await fetchLiveUsers({ signal })
    return { users, record: normalizeApiUser(response.user), preview: false }
  } catch (error) {
    if (error.name === 'AbortError' || signal?.aborted) throw error
    if (!isViteBackendAbsent(error, authenticated)) throw error
    await previewDelay(signal)
    const users = readPreviewUsers()
    const existing = users.find((user) => user.id === id)
    if (!existing) throw new Error('NOT_FOUND', { cause: error })
    if (!['Active', 'Inactive'].includes(status)) throw new Error('INVALID_STATUS', { cause: error })
    const record = { ...existing, status }
    const next = users.map((user) => user.id === id ? record : user)
    sessionStorage.setItem(USER_PREVIEW_KEY, JSON.stringify(next))
    return { users: next, record, preview: true }
  }
}

export function userErrorMessage(error, loading = false) {
  const code = error?.code || error?.message
  if (globalThis.navigator?.onLine === false || code === 'OFFLINE' || error?.status === 0) {
    return 'You are offline or unable to reach the server. Check your connection and try again.'
  }
  if (code === 'ACCOUNT_EXISTS') return 'This email is already in use. Enter a different email address.'
  if (code === 'NOT_FOUND') return 'This user is no longer available. Close this dialog and refresh the directory.'
  if (code === 'SELF_DEACTIVATE') return 'You cannot deactivate your own account.'
  if (code === 'SELF_ROLE_CHANGE') return 'You cannot change your own Administrator role.'
  if (code === 'LAST_ADMIN') return 'At least one active Administrator account must remain in the system.'
  if (code === 'RATE_LIMITED') return 'Too many user management requests. Wait a moment and try again.'
  if (code === 'VALIDATION') return error?.message || 'Please check the entered details and try again.'
  if (code === 'STORAGE') return 'Unable to load or save preview storage. Allow browser storage and try again.'
  return error?.message || (
    loading
      ? 'Unable to load the user directory. Please try again.'
      : 'Unable to save user changes. Please try again.'
  )
}
