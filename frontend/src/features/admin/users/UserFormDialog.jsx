import { useEffect, useRef, useState } from 'react'
import Dialog from '../../../components/ui/Dialog'
import Icon from '../../../components/ui/Icon'
import { savePreviewUser, USER_ROLES, userErrorMessage, validateUser } from './userPreview'

const roleDescriptions = {
  Student: 'Access enrolled classes, learning materials and assessments.',
  Instructor: 'Manage teaching activities for assigned classes.',
  Admin: 'Manage accounts, courses, classes and enrollment.',
}

export default function UserFormDialog({ user, users, onClose, onSaved }) {
  const [values, setValues] = useState({ name: user?.name || '', email: user?.email || '', role: user?.role || 'Student' })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [discarding, setDiscarding] = useState(false)
  const firstField = useRef(null)
  const summaryRef = useRef(null)
  const request = useRef(null)
  const locked = useRef(false)
  const dirty = values.name !== (user?.name || '') || values.email !== (user?.email || '') || values.role !== (user?.role || 'Student')
  useEffect(() => () => request.current?.abort(), [])

  function close() {
    if (busy) { request.current?.abort(); onClose(); return }
    if (discarding) { setDiscarding(false); firstField.current?.focus(); return }
    if (dirty) { setDiscarding(true); requestAnimationFrame(() => document.getElementById('user-keep-editing')?.focus()); return }
    request.current?.abort()
    onClose()
  }
  function update(field, value) {
    setValues((previous) => ({ ...previous, [field]: value }))
    setErrors((previous) => ({ ...previous, [field]: undefined }))
    setMessage('')
  }
  function blur(field, event) {
    if (!event.relatedTarget?.matches('input, select')) return
    setErrors((previous) => ({ ...previous, [field]: validateUser(values, users, user?.id)[field] }))
  }
  function focusErrors(fields) {
    setErrors(fields)
    requestAnimationFrame(() => summaryRef.current?.focus())
  }
  async function submit(event) {
    event.preventDefault()
    if (locked.current) return
    const nextErrors = validateUser(values, users, user?.id)
    setMessage('')
    if (Object.keys(nextErrors).length) { focusErrors(nextErrors); return }
    locked.current = true
    setBusy(true)
    const controller = new AbortController()
    request.current = controller
    try {
      const result = await savePreviewUser(values, { id: user?.id, signal: controller.signal })
      onSaved(result.users, `${result.record.name} ${user ? 'updated' : 'added'} in this preview.`)
    } catch (error) {
      if (controller.signal.aborted) return
      if (error.fields) focusErrors(error.fields)
      else setMessage(userErrorMessage(error))
      locked.current = false
      setBusy(false)
    }
  }

  return <Dialog onDismiss={close} initialFocusRef={firstField} aria-labelledby="user-form-title" aria-describedby="user-form-description">
    <header className="dialog-header"><div><p className="dialog-eyebrow">ACCOUNT MANAGEMENT</p><h2 id="user-form-title">{user ? 'Edit user' : 'Add user'}</h2></div><button type="button" className="dialog-close" aria-label="Close user form" onClick={close}><Icon name="close" /></button></header>
    <form noValidate onSubmit={submit} aria-busy={busy}>
      <div className="dialog-body user-form">
        <p id="user-form-description">{user ? 'Update account details and the assigned role.' : 'Add an account to your university workspace.'} All fields are required.</p>
        {Object.values(errors).some(Boolean) && <div className="user-error-summary" ref={summaryRef} tabIndex={-1}><strong>Please check the following fields:</strong><ul>{Object.entries(errors).filter(([, error]) => error).map(([field, error]) => <li key={field}><a href={`#user-${field}`} onClick={(event) => { event.preventDefault(); document.getElementById(`user-${field}`)?.focus() }}>{error}</a></li>)}</ul></div>}
        <div className="user-field"><label htmlFor="user-name">Full name</label><input ref={firstField} id="user-name" autoComplete="off" value={values.name} onChange={(event) => update('name', event.target.value)} onBlur={(event) => blur('name', event)} disabled={busy} required maxLength={100} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'user-name-error' : undefined} placeholder="e.g. Alex Nguyen" />{errors.name && <p id="user-name-error" className="user-field-error">{errors.name}</p>}</div>
        <div className="user-field"><label htmlFor="user-email">Email address</label><input id="user-email" type="email" autoComplete="off" autoCapitalize="none" spellCheck={false} value={values.email} onChange={(event) => update('email', event.target.value)} onBlur={(event) => blur('email', event)} disabled={busy} required maxLength={254} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'user-email-error' : undefined} placeholder="name@example.edu" />{errors.email && <p id="user-email-error" className="user-field-error">{errors.email}</p>}</div>
        <div className="user-field"><label htmlFor="user-role">Role</label><select id="user-role" value={values.role} onChange={(event) => update('role', event.target.value)} disabled={busy} required aria-invalid={Boolean(errors.role)} aria-describedby={`user-role-help${errors.role ? ' user-role-error' : ''}`}>{USER_ROLES.map((role) => <option key={role}>{role}</option>)}</select><p id="user-role-help" className="user-field-help">{roleDescriptions[values.role]}</p>{errors.role && <p id="user-role-error" className="user-field-error">{errors.role}</p>}</div>
        {user && values.role !== user.role && <div className="user-info"><Icon name="shield" size={20} /><p>Changing from {user.role} to {values.role} changes the account’s intended access. Review the role before saving.</p></div>}
        <div className="user-info"><Icon name="alert" size={20} /><p>Preview only. Changes stay in this browser tab. No sign-in account is created and no email is sent.{!user && ' New sample users start as Active.'}</p></div>
        {message && <p className="user-error-summary" role="alert">{message}</p>}
        {discarding && <div className="user-discard" role="alert"><strong>Discard your changes?</strong><p>Your unsaved details will be lost.</p><div><button id="user-keep-editing" className="admin-button" type="button" onClick={() => { setDiscarding(false); firstField.current?.focus() }}>Keep editing</button><button className="admin-button user-danger" type="button" onClick={() => { request.current?.abort(); onClose() }}>Discard changes</button></div></div>}
        <span className="sr-only" role="status">{busy ? 'Saving preview changes.' : ''}</span>
      </div>
      <footer className="dialog-actions"><button type="button" className="secondary-button" onClick={close}>Cancel</button><button className="admin-button user-primary" type="submit" disabled={busy || discarding}>{busy ? 'Saving…' : user ? 'Save changes' : 'Add user'}</button></footer>
    </form>
  </Dialog>
}
