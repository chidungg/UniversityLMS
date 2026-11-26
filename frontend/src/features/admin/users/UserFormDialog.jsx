import { useEffect, useRef, useState } from 'react'
import Dialog from '../../../components/ui/Dialog'
import Icon from '../../../components/ui/Icon'
import { createUser, getUserById, updateUser, USER_ROLES, userErrorMessage, userLimits, validateUser } from './userPreview'

const roleDescriptions = {
  Student: 'Access enrolled classes, learning materials and assessments.',
  Instructor: 'Manage teaching activities for assigned classes.',
  Administrator: 'Manage accounts, courses, classes and enrollment.',
}

function buildBaseline(record) {
  return {
    name: record?.name || '',
    email: record?.email || '',
    role: record?.role === 'Admin' ? 'Administrator' : record?.role || 'Student',
    password: '',
    confirmPassword: '',
    mustChangePassword: true,
  }
}

export default function UserFormDialog({ user, users, authenticated = false, preview: _preview = false, currentUserId = '', onClose, onSaved }) {
  const isEdit = Boolean(user)
  const isSelf = Boolean(isEdit && currentUserId && user.id === currentUserId)
  const [baseline, setBaseline] = useState(() => buildBaseline(user))
  const [values, setValues] = useState(() => buildBaseline(user))
  const [loadingRecord, setLoadingRecord] = useState(isEdit)
  const [loadRecordError, setLoadRecordError] = useState('')
  const [errors, setErrors] = useState({})
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [discarding, setDiscarding] = useState(false)
  const firstField = useRef(null)
  const closeButtonRef = useRef(null)
  const summaryRef = useRef(null)
  const request = useRef(null)
  const locked = useRef(false)

  useEffect(() => {
    if (!user?.id) return () => request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setLoadingRecord(true)
    setLoadRecordError('')
    getUserById(user.id, { signal: controller.signal, authenticated })
      .then((result) => {
        const nextBaseline = buildBaseline(result.user)
        setBaseline(nextBaseline)
        setValues(nextBaseline)
        setLoadingRecord(false)
        requestAnimationFrame(() => firstField.current?.focus())
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        setLoadRecordError(userErrorMessage(error, true))
        setLoadingRecord(false)
      })
    return () => controller.abort()
  }, [user?.id, authenticated])

  const dirty = !loadingRecord && !loadRecordError && (
    values.name !== baseline.name ||
    values.email !== baseline.email ||
    values.role !== baseline.role ||
    (!isEdit && (Boolean(values.password) || Boolean(values.confirmPassword) || values.mustChangePassword !== true))
  )

  function close() {
    if (busy || loadingRecord || loadRecordError) {
      request.current?.abort()
      onClose()
      return
    }
    if (discarding) {
      setDiscarding(false)
      firstField.current?.focus()
      return
    }
    if (dirty) {
      setDiscarding(true)
      requestAnimationFrame(() => document.getElementById('user-keep-editing')?.focus())
      return
    }
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
    const nextErrors = validateUser(values, users, user?.id, { requirePassword: !isEdit })
    setErrors((previous) => ({ ...previous, [field]: nextErrors[field] }))
  }

  function focusErrors(fields) {
    setErrors(fields)
    requestAnimationFrame(() => summaryRef.current?.focus())
  }

  async function submit(event) {
    event.preventDefault()
    if (locked.current || loadingRecord || loadRecordError || discarding) return
    const nextErrors = validateUser(values, users, user?.id, { requirePassword: !isEdit })
    setMessage('')
    if (Object.keys(nextErrors).length) {
      focusErrors(nextErrors)
      return
    }
    locked.current = true
    setBusy(true)
    const controller = new AbortController()
    request.current = controller
    try {
      const result = isEdit
        ? await updateUser(user.id, values, { signal: controller.signal, authenticated })
        : await createUser(values, { signal: controller.signal, authenticated })
      const suffix = result.preview ? ' in this preview.' : '.'
      onSaved(result, `${result.record.name} ${isEdit ? 'updated' : 'added'}${suffix}`, user?.id)
    } catch (error) {
      if (controller.signal.aborted) return
      if (error.fields && Object.keys(error.fields).length) focusErrors(error.fields)
      else setMessage(userErrorMessage(error))
      locked.current = false
      setBusy(false)
    }
  }

  return <Dialog
    onDismiss={close}
    initialFocusRef={isEdit ? closeButtonRef : firstField}
    aria-labelledby="user-form-title"
    aria-describedby="user-form-description"
  >
    <header className="dialog-header">
      <div>
        <p className="dialog-eyebrow">ACCOUNT MANAGEMENT</p>
        <h2 id="user-form-title">{isEdit ? 'Edit user' : 'Add user'}</h2>
      </div>
      <button type="button" className="dialog-close" aria-label="Close user form" onClick={close}>
        <Icon name="close" />
      </button>
    </header>

    <form noValidate onSubmit={submit} aria-busy={busy || loadingRecord}>
      <div className="dialog-body user-form">
        <p id="user-form-description">
          {isEdit ? 'Update account details and the assigned role.' : 'Add an account to your university workspace.'} All required fields must be valid before saving.
        </p>

        {loadingRecord ? (
          <div className="user-dialog-loading" role="status" aria-live="polite">
            <Icon name="refresh" size={18} className="admin-spinning" />
            <span>Loading user account details…</span>
          </div>
        ) : loadRecordError ? (
          <div className="user-error-summary" role="alert">
            <strong>Unable to load user details</strong>
            <p>{loadRecordError}</p>
          </div>
        ) : (
          <>
            {Object.values(errors).some(Boolean) && (
              <div className="user-error-summary" ref={summaryRef} tabIndex={-1} role="alert">
                <strong>Please check the following fields:</strong>
                <ul>
                  {Object.entries(errors).filter(([, error]) => error).map(([field, error]) => (
                    <li key={field}>
                      <a href={`#user-${field}`} onClick={(event) => { event.preventDefault(); document.getElementById(`user-${field}`)?.focus() }}>
                        {error}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="user-field">
              <label htmlFor="user-name">Full name</label>
              <input
                ref={firstField}
                id="user-name"
                autoComplete="off"
                value={values.name}
                onChange={(event) => update('name', event.target.value)}
                onBlur={(event) => blur('name', event)}
                disabled={busy}
                required
                maxLength={userLimits.name}
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? 'user-name-error' : undefined}
                placeholder="e.g. Alex Nguyen"
              />
              {errors.name && <p id="user-name-error" className="user-field-error">{errors.name}</p>}
            </div>

            <div className="user-field">
              <label htmlFor="user-email">Email address</label>
              <input
                id="user-email"
                type="email"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                value={values.email}
                onChange={(event) => update('email', event.target.value)}
                onBlur={(event) => blur('email', event)}
                disabled={busy}
                required
                maxLength={userLimits.email}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'user-email-error' : undefined}
                placeholder="name@example.edu"
              />
              {errors.email && <p id="user-email-error" className="user-field-error">{errors.email}</p>}
            </div>

            <div className="user-field">
              <label htmlFor="user-role">Role</label>
              <select
                id="user-role"
                value={values.role}
                onChange={(event) => update('role', event.target.value)}
                disabled={busy || isSelf}
                required
                aria-invalid={Boolean(errors.role)}
                aria-describedby={`user-role-help${errors.role ? ' user-role-error' : ''}`}
              >
                {USER_ROLES.map((role) => <option key={role}>{role}</option>)}
              </select>
              <p id="user-role-help" className="user-field-help">
                {isSelf ? 'Your own Administrator role cannot be changed here.' : roleDescriptions[values.role]}
              </p>
              {errors.role && <p id="user-role-error" className="user-field-error">{errors.role}</p>}
            </div>

            {!isEdit && (
              <>
                <div className="user-form-row">
                  <div className="user-field">
                    <label htmlFor="user-password">Initial password</label>
                    <div className="user-password-control">
                      <input
                        id="user-password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={values.password}
                        onChange={(event) => update('password', event.target.value)}
                        onBlur={(event) => blur('password', event)}
                        disabled={busy}
                        required
                        maxLength={userLimits.maxPasswordBytes}
                        aria-invalid={Boolean(errors.password)}
                        aria-describedby={`user-password-help${errors.password ? ' user-password-error' : ''}`}
                        placeholder="At least 8 characters"
                      />
                      <button
                        type="button"
                        className="user-password-toggle"
                        aria-label={showPassword ? 'Hide initial password' : 'Show initial password'}
                        aria-pressed={showPassword}
                        disabled={busy}
                        onClick={() => setShowPassword((value) => !value)}
                      >
                        <Icon name={showPassword ? 'eyeOff' : 'eye'} size={17} />
                      </button>
                    </div>
                    <p id="user-password-help" className="user-field-help">
                      {userLimits.minPassword}–{userLimits.maxPasswordBytes} characters.
                    </p>
                    {errors.password && <p id="user-password-error" className="user-field-error">{errors.password}</p>}
                  </div>

                  <div className="user-field">
                    <label htmlFor="user-confirmPassword">Confirm password</label>
                    <div className="user-password-control">
                      <input
                        id="user-confirmPassword"
                        type={showConfirm ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={values.confirmPassword}
                        onChange={(event) => update('confirmPassword', event.target.value)}
                        onBlur={(event) => blur('confirmPassword', event)}
                        disabled={busy}
                        required
                        maxLength={userLimits.maxPasswordBytes}
                        aria-invalid={Boolean(errors.confirmPassword)}
                        aria-describedby={errors.confirmPassword ? 'user-confirm-error' : undefined}
                        placeholder="Re-enter password"
                      />
                      <button
                        type="button"
                        className="user-password-toggle"
                        aria-label={showConfirm ? 'Hide confirmation password' : 'Show confirmation password'}
                        aria-pressed={showConfirm}
                        disabled={busy}
                        onClick={() => setShowConfirm((value) => !value)}
                      >
                        <Icon name={showConfirm ? 'eyeOff' : 'eye'} size={17} />
                      </button>
                    </div>
                    {errors.confirmPassword && <p id="user-confirm-error" className="user-field-error">{errors.confirmPassword}</p>}
                  </div>
                </div>

                <div className="user-field">
                  <label className="user-checkbox-box" htmlFor="user-mustChangePassword">
                    <input
                      id="user-mustChangePassword"
                      type="checkbox"
                      checked={values.mustChangePassword}
                      disabled={busy}
                      onChange={(event) => update('mustChangePassword', event.target.checked)}
                    />
                    <span>Require password change on first sign-in</span>
                  </label>
                </div>
              </>
            )}

            {isEdit && values.role !== baseline.role && (
              <div className="user-info">
                <Icon name="shield" size={18} />
                <p>Changing from {baseline.role} to {values.role} updates access permissions on next verification.</p>
              </div>
            )}

            {message && <p className="user-error-summary" role="alert">{message}</p>}

            {discarding && (
              <div className="user-discard" role="alert">
                <strong>Discard your changes?</strong>
                <p>Your unsaved details will be lost.</p>
                <div>
                  <button id="user-keep-editing" className="admin-button" type="button" onClick={() => { setDiscarding(false); firstField.current?.focus() }}>
                    Keep editing
                  </button>
                  <button className="admin-button user-danger" type="button" onClick={() => { request.current?.abort(); onClose() }}>
                    Discard changes
                  </button>
                </div>
              </div>
            )}
          </>
        )}
        <span className="sr-only" role="status">{busy ? 'Saving user changes.' : ''}</span>
      </div>

      <footer className="dialog-actions">
        <button ref={closeButtonRef} type="button" className="secondary-button" onClick={close}>Cancel</button>
        {!loadingRecord && !loadRecordError && (
          <button className="admin-button user-primary" type="submit" disabled={busy || discarding}>
            {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Add user'}
          </button>
        )}
      </footer>
    </form>
  </Dialog>
}
