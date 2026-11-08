import { useEffect, useRef, useState } from 'react'
import Dialog from '../../components/ui/Dialog'
import Icon from '../../components/ui/Icon'
import { previewRecoveryRequest, validateRecovery } from './recoveryPreview'
import './recovery.css'

export default function ForgotPasswordDialog({ initialEmail = '', onClose, sendRequest = previewRecoveryRequest }) {
  const [values, setValues] = useState({ email: initialEmail, note: '' })
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const emailRef = useRef(null)
  const noteRef = useRef(null)
  const resultRef = useRef(null)
  const requestRef = useRef(null)
  const submitting = useRef(false)
  const busy = status === 'loading'
  const complete = status === 'success'

  useEffect(() => () => requestRef.current?.abort(), [])
  useEffect(() => { if (complete) resultRef.current?.focus() }, [complete])

  function update(field, value) {
    const nextValues = { ...values, [field]: value }
    setValues(nextValues)
    if (status === 'error') { setStatus('idle'); setMessage('') }
    if (errors[field] && !validateRecovery(nextValues)[field]) {
      setErrors((previous) => { const next = { ...previous }; delete next[field]; return next })
    }
  }

  function validateField(field, event) {
    // Avoid inserting errors between pointer-down and click on an action button.
    // Submit validates explicitly; dismissing (or effect cleanup) needs no validation.
    if (!event.currentTarget.closest('dialog')?.contains(event.relatedTarget) || event.relatedTarget?.closest('button')) return
    const error = validateRecovery(values)[field]
    setErrors((previous) => { const next = { ...previous }; if (error) next[field] = error; else delete next[field]; return next })
  }

  async function submit(event) {
    event.preventDefault()
    if (submitting.current) return
    const nextErrors = validateRecovery(values)
    setErrors(nextErrors)
    setMessage('')
    if (Object.keys(nextErrors).length) {
      const invalidField = nextErrors.email ? emailRef : noteRef
      invalidField.current?.focus()
      return
    }
    submitting.current = true
    setStatus('loading')
    const controller = new AbortController()
    requestRef.current = controller
    try {
      await sendRequest({ email: values.email.trim(), note: values.note.trim() }, { signal: controller.signal })
      if (!controller.signal.aborted) setStatus('success')
    } catch (error) {
      if (controller.signal.aborted) return
      setStatus('error')
      setMessage(error.message === 'OFFLINE'
        ? 'You are offline. Check your connection and try again. Your details have been kept.'
        : 'Unable to complete the request preview. Please try again. Your details have been kept.')
      submitting.current = false
    }
  }

  return <Dialog onDismiss={onClose} initialFocusRef={emailRef} aria-labelledby="recovery-title" aria-describedby={complete ? 'recovery-result' : 'recovery-description'}>
    <header className="dialog-header">
      <div>
        <p className="dialog-eyebrow">UNIVERSITY LMS · ACCOUNT SERVICES</p>
        <h2 id="recovery-title">{complete ? 'Request preview complete' : 'Forgot your password?'}</h2>
      </div>
      <button type="button" className="dialog-close" onClick={onClose} aria-label="Close password recovery"><Icon name="close" /></button>
    </header>
    {complete ? <>
      <div className="dialog-body recovery-result" ref={resultRef} tabIndex={-1}>
        <span className="recovery-result-icon"><Icon name="check" size={26} /></span>
        <h3>Recovery request preview</h3>
        <p id="recovery-result">This demonstrates the confirmation step. No request has been sent to an administrator, and your password has not changed.</p>
        <div className="recovery-account"><span>Account email</span><strong>{values.email.trim()}</strong></div>
        <p className="recovery-next-step">For help with your account now, contact your university account administrator.</p>
      </div>
      <footer className="dialog-actions"><button type="button" className="primary-button" onClick={onClose}>Back to sign in<Icon name="arrow" size={18} /></button></footer>
    </> : <form noValidate onSubmit={submit} aria-busy={busy}>
      <div className="dialog-body">
        <p id="recovery-description" className="recovery-description">Send a recovery request to your administrator. Only an administrator can reset student and staff passwords.</p>
        <p className="recovery-preview-label">Preview only · No request will be sent.</p>
        <div className="field recovery-field">
          <label htmlFor="recovery-email">Account email <span aria-hidden="true" className="required-mark">*</span></label>
          <input ref={emailRef} id="recovery-email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required placeholder="Your registered email" value={values.email} disabled={busy} onChange={(event) => update('email', event.target.value)} onBlur={(event) => validateField('email', event)} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'recovery-email-error' : undefined} />
          {errors.email && <p id="recovery-email-error" className="field-error" aria-live="polite">{errors.email}</p>}
        </div>
        <div className="field recovery-field recovery-note-field">
          <label htmlFor="recovery-note">Note <span className="optional-label">(optional)</span></label>
          <textarea ref={noteRef} id="recovery-note" name="note" rows={3} maxLength={500} placeholder="Tell your administrator how they can help. Do not include a password." value={values.note} disabled={busy} onChange={(event) => update('note', event.target.value)} onBlur={(event) => validateField('note', event)} aria-invalid={Boolean(errors.note)} aria-describedby={`recovery-note-count${errors.note ? ' recovery-note-error' : ''}`} />
          <p id="recovery-note-count" className="recovery-count">{values.note.length}/500 characters</p>
          {errors.note && <p id="recovery-note-error" className="field-error" aria-live="polite">{errors.note}</p>}
        </div>
        <div className="recovery-info"><Icon name="shield" size={22} /><p>Your current password stays the same until your administrator verifies your identity and resets it.</p></div>
        {message && <div className="form-notice recovery-error" role="alert"><Icon name="alert" /><p>{message}</p></div>}
        <span className="sr-only" role="status">{busy ? 'Preparing your request preview. No request is being sent.' : ''}</span>
      </div>
      <footer className="dialog-actions">
        <button className="secondary-button" type="button" onClick={onClose}>Cancel</button>
        <button className="primary-button" type="submit" disabled={busy}>{busy ? <><span className="spinner" />Preparing…</> : <>Send request<Icon name="arrow" size={18} /></>}</button>
      </footer>
    </form>}
  </Dialog>
}
