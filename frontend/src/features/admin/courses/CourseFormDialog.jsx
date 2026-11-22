import { useEffect, useRef, useState } from 'react'
import Dialog from '../../../components/ui/Dialog'
import Icon from '../../../components/ui/Icon'
import { courseErrorMessage, courseLimits, createCourse, getCourseById, updateCourse, validateCourse } from './coursePreview'

function buildBaseline(record) {
  return {
    code: record?.code || '',
    name: record?.name || '',
    description: record?.description || '',
  }
}

export default function CourseFormDialog({ course, courses, authenticated = false, preview = false, onClose, onSaved }) {
  const isEdit = Boolean(course)
  const [baseline, setBaseline] = useState(() => buildBaseline(course))
  const [values, setValues] = useState(() => buildBaseline(course))
  const [loadingRecord, setLoadingRecord] = useState(isEdit)
  const [loadRecordError, setLoadRecordError] = useState('')
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [discarding, setDiscarding] = useState(false)
  const firstField = useRef(null)
  const closeButtonRef = useRef(null)
  const summary = useRef(null)
  const request = useRef(null)
  const locked = useRef(false)

  useEffect(() => {
    if (!course?.id) return () => request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setLoadingRecord(true)
    setLoadRecordError('')
    getCourseById(course.id, { signal: controller.signal, authenticated })
      .then((result) => {
        const nextBaseline = buildBaseline(result.course)
        setBaseline(nextBaseline)
        setValues(nextBaseline)
        setLoadingRecord(false)
        requestAnimationFrame(() => firstField.current?.focus())
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        setLoadRecordError(courseErrorMessage(error, true))
        setLoadingRecord(false)
      })
    return () => controller.abort()
  }, [course?.id, authenticated])

  const dirty = !loadingRecord && !loadRecordError && (
    values.code !== baseline.code ||
    values.name !== baseline.name ||
    values.description !== baseline.description
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
      requestAnimationFrame(() => document.getElementById('course-keep-editing')?.focus())
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
    if (!event.relatedTarget?.matches('input, textarea')) return
    setErrors((previous) => ({ ...previous, [field]: validateCourse(values, courses, course?.id)[field] }))
  }

  function showErrors(fields) {
    setErrors(fields)
    requestAnimationFrame(() => summary.current?.focus())
  }

  async function submit(event) {
    event.preventDefault()
    if (locked.current || loadingRecord || loadRecordError || discarding) return
    const fields = validateCourse(values, courses, course?.id)
    setMessage('')
    if (Object.keys(fields).length) {
      showErrors(fields)
      return
    }
    locked.current = true
    setBusy(true)
    const controller = new AbortController()
    request.current = controller
    try {
      const result = isEdit
        ? await updateCourse(course.id, values, { signal: controller.signal, authenticated })
        : await createCourse(values, { signal: controller.signal, authenticated })
      const suffix = result.preview ? ' in this preview.' : '.'
      onSaved(result, `${result.record.code} ${isEdit ? 'updated' : 'added'}${suffix}`)
    } catch (error) {
      if (controller.signal.aborted) return
      if (error.fields && Object.keys(error.fields).length) showErrors(error.fields)
      else setMessage(courseErrorMessage(error))
      locked.current = false
      setBusy(false)
    }
  }

  return (
    <Dialog
      onDismiss={close}
      initialFocusRef={isEdit ? closeButtonRef : firstField}
      aria-labelledby="course-form-title"
      aria-describedby="course-form-description"
    >
      <header className="dialog-header">
        <div>
          <p className="dialog-eyebrow">COURSE CATALOG</p>
          <h2 id="course-form-title">{isEdit ? 'Edit course' : 'Add course'}</h2>
        </div>
        <button className="dialog-close" type="button" aria-label="Close course form" onClick={close}>
          <Icon name="close" />
        </button>
      </header>

      <form noValidate onSubmit={submit} aria-busy={busy || loadingRecord}>
        <div className="dialog-body user-form course-form">
          <p id="course-form-description">
            {isEdit ? 'Update the course information in your catalog.' : 'Create a course before organizing enrollments and teaching content.'} Fields marked * are required.
          </p>

          {loadingRecord ? (
            <div className="user-dialog-loading" role="status" aria-live="polite">
              <Icon name="refresh" size={18} className="admin-spinning" />
              <span>Loading course details…</span>
            </div>
          ) : loadRecordError ? (
            <div className="user-error-summary" role="alert">
              <strong>Unable to load course details</strong>
              <p>{loadRecordError}</p>
            </div>
          ) : (
            <>
              {Object.values(errors).some(Boolean) && (
                <div className="user-error-summary" ref={summary} tabIndex={-1} role="alert">
                  <strong>Please check the following fields:</strong>
                  <ul>
                    {Object.entries(errors).filter(([, error]) => error).map(([field, error]) => (
                      <li key={field}>
                        <a href={`#course-${field}`} onClick={(event) => { event.preventDefault(); document.getElementById(`course-${field}`)?.focus() }}>
                          {error}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {['code', 'name'].map((field) => (
                <div key={field} className="user-field">
                  <label htmlFor={`course-${field}`}>
                    {field === 'code' ? 'Course code' : 'Course name'} <span aria-hidden="true">*</span>
                  </label>
                  <input
                    ref={field === 'code' ? firstField : undefined}
                    id={`course-${field}`}
                    value={values[field]}
                    onChange={(event) => update(field, event.target.value)}
                    onBlur={(event) => blur(field, event)}
                    required
                    maxLength={courseLimits[field]}
                    disabled={busy}
                    autoComplete="off"
                    spellCheck={field !== 'code'}
                    placeholder={field === 'code' ? 'e.g. SE104' : 'e.g. Software Engineering'}
                    aria-invalid={Boolean(errors[field])}
                    aria-describedby={[field === 'code' && 'course-code-help', errors[field] && `course-${field}-error`].filter(Boolean).join(' ') || undefined}
                  />
                  {field === 'code' && (
                    <p id="course-code-help" className="user-field-help">
                      A unique code (letters, numbers, hyphens, underscores, or dots), up to 30 characters. Saved in uppercase.
                    </p>
                  )}
                  {errors[field] && <p id={`course-${field}-error`} className="user-field-error" aria-live="polite">{errors[field]}</p>}
                </div>
              ))}

              <div className="user-field">
                <label htmlFor="course-description">
                  Short description <span className="course-optional">(optional)</span>
                </label>
                <textarea
                  id="course-description"
                  rows={3}
                  maxLength={courseLimits.description}
                  value={values.description}
                  onChange={(event) => update('description', event.target.value)}
                  onBlur={(event) => blur('description', event)}
                  disabled={busy}
                  placeholder="Summarize the topics covered in this course."
                  aria-invalid={Boolean(errors.description)}
                  aria-describedby={`course-description-count${errors.description ? ' course-description-error' : ''}`}
                />
                <p id="course-description-count" className="course-character-count">{values.description.length}/500 characters</p>
                {errors.description && <p id="course-description-error" className="user-field-error">{errors.description}</p>}
              </div>

              <div className="user-info">
                <Icon name="book" size={20} />
                <p>
                  {preview
                    ? `${isEdit ? 'Status is managed separately from the catalog. Editing a course keeps its linked classes.' : 'New courses start as Active. You can change their status from the catalog.'} Changes apply to this browser preview only.`
                    : isEdit
                      ? 'Status is managed separately from the catalog. Updating a course keeps its linked enrollments, materials and assignments.'
                      : 'New courses start as Active. You can manage course status from the catalog at any time.'}
                </p>
              </div>

              {message && <p className="user-error-summary" role="alert">{message}</p>}

              {discarding && (
                <div className="user-discard" role="alert">
                  <strong>Discard your changes?</strong>
                  <p>Your unsaved course details will be lost.</p>
                  <div>
                    <button id="course-keep-editing" className="admin-button" type="button" onClick={() => { setDiscarding(false); firstField.current?.focus() }}>
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
          <span className="sr-only" role="status">{busy ? 'Saving course changes.' : ''}</span>
        </div>

        <footer className="dialog-actions">
          <button ref={closeButtonRef} className="secondary-button" type="button" onClick={close}>Cancel</button>
          {!loadingRecord && !loadRecordError && (
            <button className="admin-button user-primary" type="submit" disabled={busy || discarding}>
              {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Add course'}
            </button>
          )}
        </footer>
      </form>
    </Dialog>
  )
}
