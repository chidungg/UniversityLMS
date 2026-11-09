import { dashboardSample } from '../dashboardData'

// A replaceable frontend adapter, never an authentication or authorization source.
export const USER_PREVIEW_KEY = 'university-lms.user-preview.v1'
export const USER_ROLES = ['Student', 'Instructor', 'Admin']

export function validateUser(values, users, currentId) {
  const errors = {}
  if (!values.name.trim()) errors.name = 'Enter a full name.'
  else if (values.name.trim().length > 100) errors.name = 'Use 100 characters or fewer.'
  const email = values.email.trim()
  if (!email) errors.email = 'Enter an email address.'
  else if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email address, such as name@example.edu.'
  else if (users.some((user) => user.id !== currentId && user.email.toLowerCase() === email.toLowerCase())) errors.email = 'This email is already in use. Enter a different email address.'
  if (!USER_ROLES.includes(values.role)) errors.role = 'Select a role.'
  return errors
}

export function readPreviewUsers() {
  const stored = sessionStorage.getItem(USER_PREVIEW_KEY)
  if (stored === null) return structuredClone(dashboardSample.users)
  const users = JSON.parse(stored)
  if (!Array.isArray(users) || users.some((user) => !user || typeof user.id !== 'string' || !user.id || typeof user.name !== 'string' || !user.name.trim() || typeof user.email !== 'string' || !USER_ROLES.includes(user.role) || !['Active', 'Inactive'].includes(user.status)) || new Set(users.map((user) => user.id)).size !== users.length) throw new Error('STORAGE')
  return users
}

async function previewDelay(signal) {
  signal?.throwIfAborted()
  await new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new DOMException('Cancelled', 'AbortError')) }
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve() }, 350)
    signal?.addEventListener('abort', abort, { once: true })
  })
  signal?.throwIfAborted()
  if (!navigator.onLine) throw new Error('OFFLINE')
}

export async function listPreviewUsers({ signal } = {}) {
  await previewDelay(signal)
  return readPreviewUsers()
}

export async function savePreviewUser(values, { id, signal } = {}) {
  await previewDelay(signal)
  const users = readPreviewUsers()
  if (id && !users.some((user) => user.id === id)) throw new Error('NOT_FOUND')
  const errors = validateUser(values, users, id)
  if (Object.keys(errors).length) throw Object.assign(new Error('VALIDATION'), { fields: errors })
  const record = { id: id || `U-${crypto.randomUUID()}`, name: values.name.trim(), email: values.email.trim().toLowerCase(), role: values.role, status: id ? users.find((user) => user.id === id).status : 'Active' }
  const next = id ? users.map((user) => user.id === id ? record : user) : [record, ...users]
  sessionStorage.setItem(USER_PREVIEW_KEY, JSON.stringify(next))
  return { users: next, record }
}

export async function setPreviewUserStatus(id, status, { signal } = {}) {
  await previewDelay(signal)
  const users = readPreviewUsers()
  if (!users.some((user) => user.id === id)) throw new Error('NOT_FOUND')
  if (!['Active', 'Inactive'].includes(status)) throw new Error('INVALID_STATUS')
  const next = users.map((user) => user.id === id ? { ...user, status } : user)
  sessionStorage.setItem(USER_PREVIEW_KEY, JSON.stringify(next))
  return next
}

export function userErrorMessage(error) {
  if (error.message === 'OFFLINE') return 'You are offline. Check your connection and try again. Your changes have not been saved.'
  if (error.message === 'NOT_FOUND') return 'This user is no longer available. Close this dialog and refresh the directory.'
  return 'Unable to save the preview. Your details have been kept. Allow browser storage and try again.'
}
