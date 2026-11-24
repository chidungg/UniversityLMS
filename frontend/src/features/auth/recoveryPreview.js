import { request } from '../../services/http'
import { validateLogin } from './auth'

export function validateRecovery({ email, note }) {
  const errors = {}
  const emailError = validateLogin({ email, password: 'unused' }).email
  if (emailError) errors.email = emailError
  if (note.length > 500) errors.note = 'Keep your note to 500 characters or fewer.'
  return errors
}

export async function previewRecoveryRequest(values, { signal } = {}) {
  if (signal?.aborted) throw new DOMException('Recovery request cancelled', 'AbortError')
  if (globalThis.navigator?.onLine === false) throw new Error('OFFLINE')
  try {
    const data = await request('/auth/recovery-requests', {
      method: 'POST',
      body: { email: values.email.trim(), note: (values.note || '').trim() },
      signal,
    })
    return {
      submitted: true,
      message: data?.message || 'Your recovery request has been received.',
    }
  } catch (error) {
    if (error.name === 'AbortError' || signal?.aborted) throw error
    if (globalThis.navigator?.onLine === false) throw new Error('OFFLINE', { cause: error })
    if (error.status === 429) throw new Error('RATE_LIMITED', { cause: error })
    if (error.status === 400) throw Object.assign(new Error('VALIDATION', { cause: error }), { message: error.message })
    throw error
  }
}
