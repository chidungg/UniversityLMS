import { useEffect, useRef, useState } from 'react'
import Dialog from '../../../components/ui/Dialog'
import Icon from '../../../components/ui/Icon'
import { classErrorMessage, savePreviewClass, validateClass } from './classPreview'
import { hasClassRelationships } from './classStore'

export default function ClassFormDialog({ item, data, onClose, onSaved }) {
  const initial = { code: item?.code || '', courseId: item?.courseId || '' }
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [discarding, setDiscarding] = useState(false)
  const firstField = useRef(null)
  const summary = useRef(null)
  const request = useRef(null)
  const lock = useRef(false)
  const courseLocked = item && hasClassRelationships(item)
  const selectable = data.courses.filter((course) => course.status === 'Active' || course.id === item?.courseId)
  const currentCourse = data.courses.find((course) => course.id === item?.courseId)
  const dirty = values.code !== initial.code || values.courseId !== initial.courseId
  useEffect(() => () => request.current?.abort(), [])

  function close() {
    if (busy) { request.current?.abort(); onClose(); return }
    if (discarding) { setDiscarding(false); firstField.current?.focus(); return }
    if (dirty) { setDiscarding(true); requestAnimationFrame(() => document.getElementById('class-keep-editing')?.focus()); return }
    onClose()
  }
  function update(field, value) { setValues((previous) => ({ ...previous, [field]: value })); setErrors((previous) => ({ ...previous, [field]: undefined })); setMessage('') }
  function showErrors(fields) { setErrors(fields); requestAnimationFrame(() => summary.current?.focus()) }
  function blur(field, event) {
    if (!event.relatedTarget?.matches('input, select')) return
    setErrors((previous) => ({ ...previous, [field]: validateClass(values, data.classes, data.courses, item)[field] }))
  }
  async function submit(event) {
    event.preventDefault()
    if (lock.current || discarding) return
    const fields = validateClass(values, data.classes, data.courses, item)
    setMessage('')
    if (Object.keys(fields).length) { showErrors(fields); return }
    lock.current = true; setBusy(true)
    const controller = new AbortController(); request.current = controller
    try {
      const result = await savePreviewClass(values, { id: item?.id, signal: controller.signal })
      onSaved(result.classes, `${result.record.code} ${item ? 'updated' : 'added'} in this preview.`)
    } catch (error) {
      if (controller.signal.aborted) return
      if (error.fields) showErrors(error.fields)
      else setMessage(classErrorMessage(error))
      lock.current = false; setBusy(false)
    }
  }

  return <Dialog initialFocusRef={firstField} onDismiss={close} aria-labelledby="class-form-title" aria-describedby="class-form-description">
    <header className="dialog-header"><div><p className="dialog-eyebrow">CLASS MANAGEMENT</p><h2 id="class-form-title">{item ? 'Edit class' : 'Add class'}</h2></div><button type="button" className="dialog-close" aria-label="Close class form" onClick={close}><Icon name="close" /></button></header>
    <form noValidate onSubmit={submit} aria-busy={busy}><div className="dialog-body user-form">
      <p id="class-form-description">{item ? 'Update the class code and linked course.' : 'Create a class for an existing course.'} Fields marked * are required.</p>
      {Object.values(errors).some(Boolean) && <div className="user-error-summary" ref={summary} tabIndex={-1}><strong>Please check the following fields:</strong><ul>{Object.entries(errors).filter(([, error]) => error).map(([field, error]) => <li key={field}><a href={`#class-${field}`} onClick={(event) => { event.preventDefault(); document.getElementById(`class-${field}`)?.focus() }}>{error}</a></li>)}</ul></div>}
      <div className="user-field"><label htmlFor="class-code">Class code <span aria-hidden="true">*</span></label><input ref={firstField} id="class-code" value={values.code} onChange={(event) => update('code', event.target.value)} onBlur={(event) => blur('code', event)} required maxLength={40} disabled={busy} autoComplete="off" spellCheck={false} placeholder="e.g. SE104-03" aria-invalid={Boolean(errors.code)} aria-describedby={`class-code-help${errors.code ? ' class-code-error' : ''}`} /><p id="class-code-help" className="user-field-help">A unique class code, up to 40 characters. Saved in uppercase.</p>{errors.code && <p id="class-code-error" className="user-field-error" aria-live="polite">{errors.code}</p>}</div>
      <div className="user-field"><label htmlFor="class-courseId">Course <span aria-hidden="true">*</span></label>{courseLocked ? <input id="class-courseId" readOnly value={currentCourse ? `${currentCourse.code} · ${currentCourse.name}` : 'Course unavailable'} aria-invalid={Boolean(errors.courseId)} aria-describedby={`class-course-help${errors.courseId ? ' class-courseId-error' : ''}`} /> : <select id="class-courseId" value={values.courseId} onChange={(event) => update('courseId', event.target.value)} onBlur={(event) => blur('courseId', event)} disabled={busy} required aria-invalid={Boolean(errors.courseId)} aria-describedby={`class-course-help${errors.courseId ? ' class-courseId-error' : ''}`}><option value="">Select a course</option>{item && !currentCourse && <option value={item.courseId} disabled>Course unavailable</option>}{selectable.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.name}{course.status !== 'Active' ? ' (Inactive)' : ''}</option>)}</select>}<p id="class-course-help" className="user-field-help">{courseLocked ? 'The course is kept because this class has enrollments or an assigned instructor.' : 'Select an active course. An existing inactive course can be kept when editing.'}</p>{errors.courseId && <p id="class-courseId-error" className="user-field-error" aria-live="polite">{errors.courseId}</p>}</div>
      {values.courseId && <div className="class-course-summary"><Icon name="book" size={20} /><span>{data.courses.find((course) => course.id === values.courseId)?.name || 'Course unavailable'}</span></div>}
      {!selectable.length && <p className="user-error-summary" role="alert">No active courses are available. <a href="/admin/courses" onClick={(event) => { if (dirty) { event.preventDefault(); close() } }}>Manage courses</a> to add or activate a course first.</p>}
      <div className="user-info"><Icon name="classes" size={20} /><p>{item ? 'Editing keeps the class’s existing instructor and enrollments.' : 'New classes start as Active, with no instructor or students assigned.'} Instructor assignment and enrollment are managed separately. Changes apply to this browser preview only.</p></div>
      {message && <p className="user-error-summary" role="alert">{message}</p>}
      {discarding && <div className="user-discard" role="alert"><strong>Discard your changes?</strong><p>Your unsaved class details will be lost.</p><div><button id="class-keep-editing" type="button" className="admin-button" onClick={() => { setDiscarding(false); firstField.current?.focus() }}>Keep editing</button><button type="button" className="admin-button user-danger" onClick={onClose}>Discard changes</button></div></div>}
      <span className="sr-only" role="status">{busy ? 'Saving class changes.' : ''}</span>
    </div><footer className="dialog-actions"><button type="button" className="secondary-button" onClick={close}>Cancel</button><button type="submit" className="admin-button user-primary" disabled={busy || discarding || !selectable.length}>{busy ? 'Saving…' : item ? 'Save changes' : 'Add class'}</button></footer></form>
  </Dialog>
}
