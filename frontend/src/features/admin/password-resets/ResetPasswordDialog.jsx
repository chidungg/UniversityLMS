import { useEffect, useRef, useState } from 'react'
import Dialog from '../../../components/ui/Dialog'
import Icon from '../../../components/ui/Icon'
import { completePreviewPasswordReset, passwordResetErrorMessage, resetLimits, validateResetApproval } from './passwordResetPreview'

const initialValues = { verified: false, password: '', confirmPassword: '', resolutionNote: '' }

export default function ResetPasswordDialog({ item, authenticated = false, currentUserId = '', onClose, onSaved }) {
  const { request, account } = item
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState({})
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [discarding, setDiscarding] = useState(false)
  const firstField = useRef(null)
  const closeRef = useRef(null)
  const summaryRef = useRef(null)
  const pendingRequest = useRef(null)
  const lock = useRef(false)
  useEffect(() => () => pendingRequest.current?.abort(), [])

  const blocked = !account.eligible
  const dirty = values.verified || Boolean(values.password) || Boolean(values.confirmPassword) || Boolean(values.resolutionNote)

  function close() {
    if (busy) { pendingRequest.current?.abort(); onClose(); return }
    if (blocked) { onClose(); return }
    if (discarding) { setDiscarding(false); firstField.current?.focus(); return }
    if (dirty) {
      setDiscarding(true)
      requestAnimationFrame(() => document.getElementById('reset-keep-editing')?.focus())
      return
    }
    onClose()
  }

  function update(field, value) {
    const next = { ...values, [field]: value }
    setValues(next)
    setErrors((previous) => ({ ...previous, [field]: undefined }))
    setMessage('')
  }

  function blur(field, event) {
    if (!event.relatedTarget?.matches('input, textarea')) return
    setErrors((previous) => ({ ...previous, [field]: validateResetApproval(values)[field] }))
  }

  function showErrors(fields) {
    setErrors(fields)
    requestAnimationFrame(() => summaryRef.current?.focus())
  }

  async function submit(event) {
    event.preventDefault()
    if (lock.current || discarding || blocked) return
    const fields = validateResetApproval(values)
    setMessage('')
    if (Object.keys(fields).length) { showErrors(fields); return }
    lock.current = true
    setBusy(true)
    const controller = new AbortController()
    pendingRequest.current = controller
    try {
      const result = await completePreviewPasswordReset(request.id, values, {
        signal: controller.signal,
        authenticated,
        currentUserId,
      })
      const targetName = result.account?.name || account.user.name
      setValues(initialValues)
      onSaved(
        result,
        `Password reset completed for ${targetName} (${request.id}). Active sessions were revoked and a password change is required at next sign-in.`,
      )
    } catch (error) {
      if (controller.signal.aborted) return
      if (error.fields) showErrors(error.fields)
      else setMessage(passwordResetErrorMessage(error))
      lock.current = false
      setBusy(false)
    }
  }

  const blockedDescription = account.reason === 'SELF_RESET'
    ? 'You cannot reset your own password from this queue. Use Change password or ask another administrator to verify your request.'
    : account.reason === 'ACCOUNT_DISABLED'
      ? 'This account is currently Inactive. Activate the account in User management before issuing a password reset, or reject this request.'
      : `No account matches ${request.email}. Confirm the registered email address or reject this request.`

  return <Dialog
    initialFocusRef={blocked ? closeRef : firstField}
    onDismiss={close}
    aria-labelledby="reset-password-title"
    aria-describedby="reset-password-description"
  >
    <div className="reset-dialog-scope">
      <header className="dialog-header">
        <div>
          <p className="dialog-eyebrow">ACCOUNT PASSWORD RESET</p>
          <h2 id="reset-password-title">{blocked ? 'Reset cannot be completed' : 'Reset account password'}</h2>
        </div>
        <button type="button" className="dialog-close" aria-label="Close password reset dialog" onClick={close}><Icon name="close" /></button>
      </header>
      {blocked ? <>
        <div className="dialog-body user-form">
          <div className="user-confirm-identity">
            <strong>{account.user?.name || 'Unmatched account'}</strong>
            <span>{request.email}{account.user ? ` · ${account.user.role}` : ''} · {request.id}</span>
          </div>
          <div className="reset-blocked-box" role="alert">
            <Icon name="alert" size={20} />
            <p id="reset-password-description">{blockedDescription}</p>
          </div>
          {request.note && (
            <div className="reset-student-quote">
              <strong>Requester note</strong>
              {request.note}
            </div>
          )}
        </div>
        <footer className="dialog-actions">
          <button ref={closeRef} type="button" className="secondary-button" onClick={close}>Close</button>
          {account.user && account.reason !== 'SELF_RESET' && <a className="admin-button user-primary" href="/admin/users">Open User management</a>}
        </footer>
      </> : (
        <form noValidate onSubmit={submit} aria-busy={busy} className="reset-form">
          <div className="dialog-body user-form">
            <div className="user-confirm-identity">
              <strong>{account.user.name}</strong>
              <span>{request.email} · {account.user.role} · {request.id}</span>
            </div>
            {request.note && (
              <div className="reset-student-quote">
                <strong>Requester note</strong>
                {request.note}
              </div>
            )}
            <p id="reset-password-description">Verify the user’s identity, then set a temporary password. Fields marked * are required.</p>
            {Object.values(errors).some(Boolean) && (
              <div className="user-error-summary" ref={summaryRef} tabIndex={-1} role="alert">
                <strong>Please check the following fields:</strong>
                <ul>
                  {Object.entries(errors).filter(([, error]) => error).map(([field, error]) => (
                    <li key={field}>
                      <a href={`#reset-${field}`} onClick={(event) => { event.preventDefault(); document.getElementById(`reset-${field}`)?.focus() }}>{error}</a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="user-field">
              <label className={`reset-verify-box ${errors.verified ? 'is-invalid' : ''}`} htmlFor="reset-verified">
                <input
                  ref={firstField}
                  id="reset-verified"
                  type="checkbox"
                  checked={values.verified}
                  disabled={busy}
                  aria-invalid={Boolean(errors.verified)}
                  aria-describedby={errors.verified ? 'reset-verified-error' : undefined}
                  onChange={(event) => update('verified', event.target.checked)}
                />
                <span>I have verified {account.user.name}’s identity under university policy.<span aria-hidden="true">&nbsp;*</span></span>
              </label>
              {errors.verified && <p id="reset-verified-error" className="user-field-error" aria-live="polite">{errors.verified}</p>}
            </div>

            <div className="user-field">
              <label htmlFor="reset-password">Temporary password <span aria-hidden="true">*</span></label>
              <div className="reset-password-control">
                <input
                  id="reset-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={values.password}
                  disabled={busy}
                  required
                  maxLength={resetLimits.maxPasswordBytes}
                  placeholder="At least 8 characters"
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={`reset-password-help${errors.password ? ' reset-password-error' : ''}`}
                  onChange={(event) => update('password', event.target.value)}
                  onBlur={(event) => blur('password', event)}
                />
                <button
                  type="button"
                  className="reset-password-toggle"
                  aria-label={showPassword ? 'Hide temporary password' : 'Show temporary password'}
                  aria-pressed={showPassword}
                  disabled={busy}
                  onClick={() => setShowPassword((value) => !value)}
                >
                  <Icon name={showPassword ? 'eyeOff' : 'eye'} size={18} />
                </button>
              </div>
              <p id="reset-password-help" className="user-field-help">Minimum {resetLimits.minPassword} characters, up to {resetLimits.maxPasswordBytes} UTF-8 bytes. Paste and password managers are supported.</p>
              {errors.password && <p id="reset-password-error" className="user-field-error" aria-live="polite">{errors.password}</p>}
            </div>

            <div className="user-field">
              <label htmlFor="reset-confirmPassword">Confirm temporary password <span aria-hidden="true">*</span></label>
              <div className="reset-password-control">
                <input
                  id="reset-confirmPassword"
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={values.confirmPassword}
                  disabled={busy}
                  required
                  maxLength={resetLimits.maxPasswordBytes}
                  placeholder="Re-enter temporary password"
                  aria-invalid={Boolean(errors.confirmPassword)}
                  aria-describedby={errors.confirmPassword ? 'reset-confirm-error' : undefined}
                  onChange={(event) => update('confirmPassword', event.target.value)}
                  onBlur={(event) => blur('confirmPassword', event)}
                />
                <button
                  type="button"
                  className="reset-password-toggle"
                  aria-label={showConfirm ? 'Hide confirmation password' : 'Show confirmation password'}
                  aria-pressed={showConfirm}
                  disabled={busy}
                  onClick={() => setShowConfirm((value) => !value)}
                >
                  <Icon name={showConfirm ? 'eyeOff' : 'eye'} size={18} />
                </button>
              </div>
              {errors.confirmPassword && <p id="reset-confirm-error" className="user-field-error" aria-live="polite">{errors.confirmPassword}</p>}
            </div>

            <div className="user-field">
              <label htmlFor="reset-resolutionNote">Resolution note <span className="optional-label">(optional)</span></label>
              <textarea
                id="reset-resolutionNote"
                rows={3}
                maxLength={resetLimits.resolutionNote}
                value={values.resolutionNote}
                disabled={busy}
                placeholder="e.g. Verified student ID at Academic Affairs desk. Do not enter any password here."
                aria-invalid={Boolean(errors.resolutionNote)}
                aria-describedby={`reset-note-count${errors.resolutionNote ? ' reset-note-error' : ''}`}
                onChange={(event) => update('resolutionNote', event.target.value)}
                onBlur={(event) => blur('resolutionNote', event)}
              />
              <div id="reset-note-count" className="reset-count-row">
                <span>Recorded in the request history without credentials.</span>
                <span>{values.resolutionNote.length}/{resetLimits.resolutionNote} characters</span>
              </div>
              {errors.resolutionNote && <p id="reset-note-error" className="user-field-error" aria-live="polite">{errors.resolutionNote}</p>}
            </div>

            <div className="user-info">
              <Icon name="shield" size={20} />
              <p>Completing a reset revokes all active sessions for this account and requires a password change at next sign-in. Temporary passwords are never stored in request history or sent by email.</p>
            </div>
            {message && <p className="user-error-summary" role="alert">{message}</p>}
            {discarding && (
              <div className="user-discard" role="alert">
                <strong>Discard your changes?</strong>
                <p>Your entered password reset details will be cleared.</p>
                <div>
                  <button id="reset-keep-editing" type="button" className="admin-button" onClick={() => { setDiscarding(false); firstField.current?.focus() }}>Keep editing</button>
                  <button type="button" className="admin-button user-danger" onClick={onClose}>Discard changes</button>
                </div>
              </div>
            )}
            <span className="sr-only" role="status">{busy ? 'Recording password reset.' : ''}</span>
          </div>
          <footer className="dialog-actions">
            <button type="button" className="secondary-button" onClick={close}>Cancel</button>
            <button type="submit" className="admin-button user-primary" disabled={busy || discarding}>{busy ? 'Saving…' : 'Confirm password reset'}</button>
          </footer>
        </form>
      )}
    </div>
  </Dialog>
}
