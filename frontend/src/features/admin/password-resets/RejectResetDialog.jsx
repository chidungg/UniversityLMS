import { useEffect, useRef, useState } from 'react'
import Dialog from '../../../components/ui/Dialog'
import Icon from '../../../components/ui/Icon'
import { passwordResetErrorMessage, rejectPreviewPasswordReset, resetLimits, validateResetRejection } from './passwordResetPreview'

export default function RejectResetDialog({ item, authenticated = false, onClose, onSaved }) {
  const { request, account } = item
  const [resolutionNote, setResolutionNote] = useState('')
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [discarding, setDiscarding] = useState(false)
  const reasonRef = useRef(null)
  const summaryRef = useRef(null)
  const pendingRequest = useRef(null)
  const lock = useRef(false)
  useEffect(() => () => pendingRequest.current?.abort(), [])

  const dirty = Boolean(resolutionNote)

  function close() {
    if (busy) { pendingRequest.current?.abort(); onClose(); return }
    if (discarding) { setDiscarding(false); reasonRef.current?.focus(); return }
    if (dirty) {
      setDiscarding(true)
      requestAnimationFrame(() => document.getElementById('reject-keep-editing')?.focus())
      return
    }
    onClose()
  }

  function showErrors(fields) {
    setErrors(fields)
    requestAnimationFrame(() => summaryRef.current?.focus())
  }

  async function submit(event) {
    event.preventDefault()
    if (lock.current || discarding) return
    const fields = validateResetRejection({ resolutionNote })
    setMessage('')
    if (Object.keys(fields).length) { showErrors(fields); return }
    lock.current = true
    setBusy(true)
    const controller = new AbortController()
    pendingRequest.current = controller
    try {
      const result = await rejectPreviewPasswordReset(request.id, { resolutionNote }, { signal: controller.signal, authenticated })
      onSaved(result, `Reset request ${request.id} rejected. Current password remains unchanged.`)
    } catch (error) {
      if (controller.signal.aborted) return
      if (error.fields) showErrors(error.fields)
      else setMessage(passwordResetErrorMessage(error))
      lock.current = false
      setBusy(false)
    }
  }

  return <Dialog initialFocusRef={reasonRef} onDismiss={close} aria-labelledby="reject-reset-title" aria-describedby="reject-reset-description">
    <div className="reset-dialog-scope">
      <header className="dialog-header">
        <div>
          <p className="dialog-eyebrow">PASSWORD RESET REQUEST</p>
          <h2 id="reject-reset-title">Reject reset request?</h2>
        </div>
        <button type="button" className="dialog-close" aria-label="Close rejection dialog" onClick={close}><Icon name="close" /></button>
      </header>
      <form noValidate onSubmit={submit} aria-busy={busy} className="reset-form">
        <div className="dialog-body user-form">
          <div className="user-confirm-identity">
            <strong>{account.user?.name || 'Unmatched account'}</strong>
            <span>{request.email} · {request.id}</span>
          </div>
          <p id="reject-reset-description">Mark this request as Rejected. The account’s current password remains unchanged. Fields marked * are required.</p>
          {errors.resolutionNote && (
            <div className="user-error-summary" ref={summaryRef} tabIndex={-1} role="alert">
              <strong>Please check the following fields:</strong>
              <ul>
                <li><a href="#reject-resolutionNote" onClick={(event) => { event.preventDefault(); reasonRef.current?.focus() }}>{errors.resolutionNote}</a></li>
              </ul>
            </div>
          )}
          <div className="user-field">
            <label htmlFor="reject-resolutionNote">Reason for rejection <span aria-hidden="true">*</span></label>
            <textarea
              ref={reasonRef}
              id="reject-resolutionNote"
              rows={3}
              required
              maxLength={resetLimits.resolutionNote}
              value={resolutionNote}
              disabled={busy}
              placeholder="e.g. No matching account found, or identity could not be verified."
              aria-invalid={Boolean(errors.resolutionNote)}
              aria-describedby={`reject-reason-count${errors.resolutionNote ? ' reject-reason-error' : ''}`}
              onChange={(event) => { setResolutionNote(event.target.value); setErrors({}); setMessage('') }}
            />
            <div id="reject-reason-count" className="reset-count-row">
              <span>Explain why the request cannot be fulfilled.</span>
              <span>{resolutionNote.length}/{resetLimits.resolutionNote} characters</span>
            </div>
            {errors.resolutionNote && <p id="reject-reason-error" className="user-field-error" aria-live="polite">{errors.resolutionNote}</p>}
          </div>
          <div className="user-info">
            <Icon name="alert" size={20} />
            <p>Rejected requests remain in the audit queue with your reason recorded. No notification is sent automatically.</p>
          </div>
          {message && <p className="user-error-summary" role="alert">{message}</p>}
          {discarding && (
            <div className="user-discard" role="alert">
              <strong>Discard your changes?</strong>
              <p>Your entered rejection reason will be lost.</p>
              <div>
                <button id="reject-keep-editing" type="button" className="admin-button" onClick={() => { setDiscarding(false); reasonRef.current?.focus() }}>Keep editing</button>
                <button type="button" className="admin-button user-danger" onClick={onClose}>Discard changes</button>
              </div>
            </div>
          )}
          <span className="sr-only" role="status">{busy ? 'Rejecting reset request.' : ''}</span>
        </div>
        <footer className="dialog-actions">
          <button type="button" className="secondary-button" onClick={close}>Cancel</button>
          <button type="submit" className="admin-button user-danger-solid" disabled={busy || discarding}>{busy ? 'Updating…' : 'Reject request'}</button>
        </footer>
      </form>
    </div>
  </Dialog>
}
