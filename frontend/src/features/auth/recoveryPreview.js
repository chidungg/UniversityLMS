import { validateLogin } from './auth'

export function validateRecovery({ email, note }) {
  const errors = {}
  const emailError = validateLogin({ email, password: 'unused' }).email
  if (emailError) errors.email = emailError
  if (note.length > 500) errors.note = 'Keep your note to 500 characters or fewer.'
  return errors
}

// Frontend demonstration only. No request, persistence, or account lookup occurs.
// Replace this adapter after the recovery workflow and API are agreed with the team.
export async function previewRecoveryRequest(_values, { signal } = {}) {
  if (signal?.aborted) throw new DOMException('Preview cancelled', 'AbortError')
  if (navigator.onLine === false) throw new Error('OFFLINE')
  await new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer)
      reject(new DOMException('Preview cancelled', 'AbortError'))
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort)
      resolve()
    }, 900)
    signal?.addEventListener('abort', abort, { once: true })
  })
  if (navigator.onLine === false) throw new Error('OFFLINE')
  return { preview: true }
}
