import { readPreviewUsers } from '../users/userPreview'
import { readPreviewPasswordResets, writePreviewPasswordResets } from './passwordResetStore'

export const resetLimits = { minPassword: 8, maxPassword: 128, resolutionNote: 300 }

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

export function formatRequestDate(iso) {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  const parts = Object.fromEntries(dateFormatter.formatToParts(date).map((part) => [part.type, part.value]))
  return `${parts.day}/${parts.month}/${parts.year}, ${parts.hour}:${parts.minute}`
}

export function resolveRequestAccount(request, users) {
  const user = users.find((entry) => entry.email.toLowerCase() === request.email.trim().toLowerCase()) || null
  if (!user) return { user: null, eligible: false, issue: 'Account not found', reason: 'UNMATCHED_ACCOUNT' }
  if (user.role !== 'Student') return { user, eligible: false, issue: `Non-student role (${user.role})`, reason: 'NON_STUDENT' }
  if (user.status !== 'Active') return { user, eligible: false, issue: 'Inactive account', reason: 'INACTIVE_STUDENT' }
  return { user, eligible: true, issue: '', reason: '' }
}

export function validateResetApproval(values) {
  const errors = {}
  if (!values.verified) errors.verified = 'Confirm that you have verified the student’s identity before resetting the password.'
  if (!values.password) errors.password = 'Enter a temporary password.'
  else if (!values.password.trim()) errors.password = 'Temporary password cannot consist only of spaces.'
  else if (values.password.length < resetLimits.minPassword) errors.password = `Use at least ${resetLimits.minPassword} characters.`
  else if (values.password.length > resetLimits.maxPassword) errors.password = `Use ${resetLimits.maxPassword} characters or fewer.`
  if (!values.confirmPassword) errors.confirmPassword = 'Confirm the temporary password.'
  else if (values.password !== values.confirmPassword) errors.confirmPassword = 'Passwords do not match.'
  if (values.resolutionNote.length > resetLimits.resolutionNote) errors.resolutionNote = `Keep the note to ${resetLimits.resolutionNote} characters or fewer.`
  return errors
}

export function validateResetRejection(values) {
  const errors = {}
  if (!values.resolutionNote.trim()) errors.resolutionNote = 'Enter a reason for rejecting this request.'
  else if (values.resolutionNote.length > resetLimits.resolutionNote) errors.resolutionNote = `Keep the reason to ${resetLimits.resolutionNote} characters or fewer.`
  return errors
}

async function delay(signal) {
  signal?.throwIfAborted()
  await new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new DOMException('Cancelled', 'AbortError')) }
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve() }, 350)
    signal?.addEventListener('abort', abort, { once: true })
  })
  signal?.throwIfAborted()
  if (!navigator.onLine) throw new Error('OFFLINE')
}

export async function listPasswordResetWorkspace({ signal } = {}) {
  await delay(signal)
  return {
    requests: readPreviewPasswordResets(),
    users: readPreviewUsers(),
  }
}

export async function completePreviewPasswordReset(requestId, values, { signal } = {}) {
  await delay(signal)
  const fields = validateResetApproval(values)
  if (Object.keys(fields).length) throw Object.assign(new Error('VALIDATION'), { fields })
  const requests = readPreviewPasswordResets()
  const users = readPreviewUsers()
  const existing = requests.find((item) => item.id === requestId)
  if (!existing) throw new Error('NOT_FOUND')
  if (existing.status !== 'Pending') throw new Error('ALREADY_PROCESSED')
  const account = resolveRequestAccount(existing, users)
  if (!account.eligible) throw new Error(account.reason)

  // Security boundary: temporary passwords are never persisted to browser storage.
  const updated = {
    ...existing,
    status: 'Completed',
    reviewedAt: new Date().toISOString(),
    resolutionNote: values.resolutionNote.trim() || 'Identity verified by administrator. Temporary password reset recorded.',
  }
  const next = requests.map((item) => item.id === requestId ? updated : item)
  writePreviewPasswordResets(next)
  return { requests: next, users, record: updated, student: account.user }
}

export async function rejectPreviewPasswordReset(requestId, values, { signal } = {}) {
  await delay(signal)
  const fields = validateResetRejection(values)
  if (Object.keys(fields).length) throw Object.assign(new Error('VALIDATION'), { fields })
  const requests = readPreviewPasswordResets()
  const users = readPreviewUsers()
  const existing = requests.find((item) => item.id === requestId)
  if (!existing) throw new Error('NOT_FOUND')
  if (existing.status !== 'Pending') throw new Error('ALREADY_PROCESSED')

  const updated = {
    ...existing,
    status: 'Rejected',
    reviewedAt: new Date().toISOString(),
    resolutionNote: values.resolutionNote.trim(),
  }
  const next = requests.map((item) => item.id === requestId ? updated : item)
  writePreviewPasswordResets(next)
  return { requests: next, users, record: updated }
}

export function passwordResetErrorMessage(error, loading = false) {
  if (error.message === 'OFFLINE') return 'You are offline. Check your connection and try again. No changes were saved.'
  if (error.message === 'NOT_FOUND') return 'This reset request is no longer available. Close this dialog and refresh the queue.'
  if (error.message === 'ALREADY_PROCESSED') return 'This request has already been processed. Refresh the queue to see its current status.'
  if (error.message === 'UNMATCHED_ACCOUNT') return 'No student account matches this email address. Verify the email or reject the request.'
  if (error.message === 'INACTIVE_STUDENT') return 'This student account is inactive. Activate the account in User management before completing a reset.'
  if (error.message === 'NON_STUDENT') return 'This queue handles student accounts only. Review this account in User management instead.'
  return loading
    ? 'We could not load the sample reset requests. Check browser storage and try again.'
    : 'Unable to save the preview. Your details have been kept. Allow browser storage and try again.'
}
