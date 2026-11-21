import { request } from '../../../services/http'
import { readPreviewUsers } from '../users/userPreview'
import { readPreviewPasswordResets, writePreviewPasswordResets } from './passwordResetStore'

export const resetLimits = { minPassword: 8, maxPasswordBytes: 72, resolutionNote: 300 }

const utf8Encoder = new TextEncoder()

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

export function resolveRequestAccount(request, users, currentUserId = '') {
  const user = users.find((entry) => entry.email.toLowerCase() === request.email.trim().toLowerCase()) || null
  if (!user) return { user: null, eligible: false, issue: 'Account not found', reason: 'UNMATCHED_ACCOUNT' }
  if (currentUserId && user.id === currentUserId) return { user, eligible: false, issue: 'Cannot self-reset', reason: 'SELF_RESET' }
  if (user.status !== 'Active') return { user, eligible: false, issue: 'Inactive account', reason: 'ACCOUNT_DISABLED' }
  return { user, eligible: true, issue: '', reason: '' }
}

export function validateResetApproval(values) {
  const errors = {}
  if (!values.verified) errors.verified = 'Confirm that you have verified the account holder’s identity before resetting the password.'
  if (!values.password) errors.password = 'Enter a temporary password.'
  else if (!values.password.trim()) errors.password = 'Temporary password cannot consist only of spaces.'
  else if (values.password.length < resetLimits.minPassword) errors.password = `Use at least ${resetLimits.minPassword} characters.`
  else if (utf8Encoder.encode(values.password).length > resetLimits.maxPasswordBytes) {
    errors.password = `Use ${resetLimits.maxPasswordBytes} UTF-8 bytes or fewer.`
  }
  if (!values.confirmPassword) errors.confirmPassword = 'Confirm the temporary password.'
  else if (values.password !== values.confirmPassword) errors.confirmPassword = 'Passwords do not match.'
  if (values.resolutionNote.length > resetLimits.resolutionNote) {
    errors.resolutionNote = `Keep the note to ${resetLimits.resolutionNote} characters or fewer.`
  }
  return errors
}

export function validateResetRejection(values) {
  const errors = {}
  if (!values.resolutionNote.trim()) errors.resolutionNote = 'Enter a reason for rejecting this request.'
  else if (values.resolutionNote.length > resetLimits.resolutionNote) {
    errors.resolutionNote = `Keep the reason to ${resetLimits.resolutionNote} characters or fewer.`
  }
  return errors
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

async function delay(signal) {
  signal?.throwIfAborted()
  await new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new DOMException('Cancelled', 'AbortError')) }
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve() }, 350)
    signal?.addEventListener('abort', abort, { once: true })
  })
  signal?.throwIfAborted()
  if (globalThis.navigator?.onLine === false) throw new Error('OFFLINE')
}

async function fetchLiveQueue({ signal } = {}) {
  const firstPage = await request('/admin/recovery-requests?page=1&limit=100', { signal })
  const allRequests = [...(firstPage.requests || [])]
  const usersById = new Map((firstPage.users || []).map((user) => [user.id, user]))
  const total = firstPage.pagination?.total ?? allRequests.length
  let page = 2
  while (allRequests.length < total && page <= 10) {
    const nextPage = await request(`/admin/recovery-requests?page=${page}&limit=100`, { signal })
    const batch = nextPage.requests || []
    if (!batch.length) break
    allRequests.push(...batch)
    for (const user of nextPage.users || []) usersById.set(user.id, user)
    page += 1
  }
  return { requests: allRequests, users: [...usersById.values()], preview: false }
}

export async function listPasswordResetWorkspace({ signal, authenticated = false } = {}) {
  if (globalThis.navigator?.onLine === false) throw new Error('OFFLINE')
  try {
    return await fetchLiveQueue({ signal })
  } catch (error) {
    if (error.name === 'AbortError' || signal?.aborted) throw error
    if (!isViteBackendAbsent(error, authenticated)) throw error
    await delay(signal)
    return {
      requests: readPreviewPasswordResets(),
      users: readPreviewUsers(),
      preview: true,
    }
  }
}

export async function completePreviewPasswordReset(requestId, values, { signal, authenticated = false, currentUserId = '' } = {}) {
  const fields = validateResetApproval(values)
  if (Object.keys(fields).length) throw Object.assign(new Error('VALIDATION'), { fields })
  if (globalThis.navigator?.onLine === false) throw new Error('OFFLINE')

  try {
    const response = await request(`/admin/recovery-requests/${encodeURIComponent(requestId)}`, {
      method: 'PATCH',
      body: {
        action: 'complete',
        verified: true,
        password: values.password,
        confirmPassword: values.confirmPassword,
        resolutionNote: values.resolutionNote.trim(),
      },
      signal,
    })
    const workspace = await fetchLiveQueue({ signal })
    return { ...workspace, record: response.record, account: response.account, preview: false }
  } catch (error) {
    if (error.name === 'AbortError' || signal?.aborted) throw error
    if (!isViteBackendAbsent(error, authenticated)) throw error
    await delay(signal)
    const requests = readPreviewPasswordResets()
    const users = readPreviewUsers()
    const existing = requests.find((item) => item.id === requestId)
    if (!existing) throw new Error('NOT_FOUND', { cause: error })
    if (existing.status !== 'Pending') throw new Error('ALREADY_PROCESSED', { cause: error })
    const account = resolveRequestAccount(existing, users, currentUserId)
    if (!account.eligible) throw new Error(account.reason, { cause: error })

    // Security boundary: temporary passwords are never persisted to browser storage.
    const updated = {
      ...existing,
      status: 'Completed',
      reviewedAt: new Date().toISOString(),
      resolutionNote: values.resolutionNote.trim() || 'Identity verified by administrator. Temporary password reset recorded.',
    }
    const next = requests.map((item) => item.id === requestId ? updated : item)
    writePreviewPasswordResets(next)
    return { requests: next, users, record: updated, account: account.user, preview: true }
  }
}

export async function rejectPreviewPasswordReset(requestId, values, { signal, authenticated = false } = {}) {
  const fields = validateResetRejection(values)
  if (Object.keys(fields).length) throw Object.assign(new Error('VALIDATION'), { fields })
  if (globalThis.navigator?.onLine === false) throw new Error('OFFLINE')

  try {
    const response = await request(`/admin/recovery-requests/${encodeURIComponent(requestId)}`, {
      method: 'PATCH',
      body: {
        action: 'reject',
        resolutionNote: values.resolutionNote.trim(),
      },
      signal,
    })
    const workspace = await fetchLiveQueue({ signal })
    return { ...workspace, record: response.record, account: response.account, preview: false }
  } catch (error) {
    if (error.name === 'AbortError' || signal?.aborted) throw error
    if (!isViteBackendAbsent(error, authenticated)) throw error
    await delay(signal)
    const requests = readPreviewPasswordResets()
    const users = readPreviewUsers()
    const existing = requests.find((item) => item.id === requestId)
    if (!existing) throw new Error('NOT_FOUND', { cause: error })
    if (existing.status !== 'Pending') throw new Error('ALREADY_PROCESSED', { cause: error })

    const updated = {
      ...existing,
      status: 'Rejected',
      reviewedAt: new Date().toISOString(),
      resolutionNote: values.resolutionNote.trim(),
    }
    const next = requests.map((item) => item.id === requestId ? updated : item)
    writePreviewPasswordResets(next)
    return { requests: next, users, record: updated, preview: true }
  }
}

export function passwordResetErrorMessage(error, loading = false) {
  const code = error?.code || error?.message
  if (globalThis.navigator?.onLine === false || code === 'OFFLINE' || error?.status === 0) {
    return 'You are offline or unable to reach the server. Check your connection and try again. No changes were saved.'
  }
  if (code === 'NOT_FOUND') return 'This reset request is no longer available. Close this dialog and refresh the queue.'
  if (code === 'ALREADY_PROCESSED') return 'This request has already been processed. Refresh the queue to see its current status.'
  if (code === 'UNMATCHED_ACCOUNT') return 'No account matches this email address. Verify the email or reject the request.'
  if (code === 'ACCOUNT_DISABLED' || code === 'INACTIVE_STUDENT') {
    return 'This account is inactive. Activate the account in User management before completing a reset.'
  }
  if (code === 'SELF_RESET') return 'You cannot reset your own password here. Use Change password or ask another administrator.'
  if (code === 'PASSWORD_REUSED') return 'Temporary password must differ from the account’s current password.'
  if (code === 'RATE_LIMITED') return 'Too many password reset attempts. Wait a moment and try again.'
  if (code === 'VALIDATION') return error.message || 'Please check the entered details and try again.'
  return error?.message || (
    loading
      ? 'Unable to load password reset requests. Please try again.'
      : 'Unable to save the password reset request. Please try again.'
  )
}
