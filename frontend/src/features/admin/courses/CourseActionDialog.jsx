import { useEffect, useRef, useState } from 'react'
import Dialog from '../../../components/ui/Dialog'
import Icon from '../../../components/ui/Icon'
import { changeCourseStatus, courseErrorMessage } from './coursePreview'

export default function CourseActionDialog({ course, action, authenticated = false, preview = false, onClose, onSaved }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const cancelRef = useRef(null)
  const request = useRef(null)
  const lock = useRef(false)
  const deactivate = action === 'deactivate'
  const label = deactivate ? 'Deactivate' : 'Activate'

  useEffect(() => () => request.current?.abort(), [])

  function close() {
    request.current?.abort()
    onClose()
  }

  async function confirm() {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setMessage('')
    const controller = new AbortController()
    request.current = controller
    try {
      const nextStatus = deactivate ? 'Inactive' : 'Active'
      const result = await changeCourseStatus(course.id, nextStatus, {
        signal: controller.signal,
        authenticated,
      })
      const suffix = result.preview ? ' in this preview.' : '.'
      onSaved(result, `${course.code} ${deactivate ? 'deactivated' : 'activated'}${suffix}`)
    } catch (error) {
      if (controller.signal.aborted) return
      setMessage(courseErrorMessage(error))
      lock.current = false
      setBusy(false)
    }
  }

  return (
    <Dialog
      initialFocusRef={cancelRef}
      onDismiss={close}
      aria-labelledby="course-action-title"
      aria-describedby="course-action-description"
    >
      <header className="dialog-header">
        <div>
          <p className="dialog-eyebrow">COURSE MANAGEMENT</p>
          <h2 id="course-action-title">{label} course?</h2>
        </div>
        <button className="dialog-close" aria-label="Close course confirmation" onClick={close}>
          <Icon name="close" />
        </button>
      </header>

      <div className="dialog-body user-form">
        <div className="user-confirm-identity">
          <span>{course.code}</span>
          <strong>{course.name}</strong>
        </div>
        <p id="course-action-description">
          {preview
            ? deactivate
              ? 'Mark this course as Inactive. The course, its classes and enrollment records will be kept. Existing class statuses will not change.'
              : 'Mark this course as Active in the catalog. Existing class statuses will not change.'
            : deactivate
              ? 'Mark this course as Inactive. Historical enrollments, materials and assessments will be kept, and the course will be hidden from active student course views until reactivated.'
              : 'Mark this course as Active in the catalog. Enrolled students and instructors will see this course in active listings again.'}
        </p>
        <div className="user-info">
          <Icon name={preview ? 'alert' : 'shield'} size={20} />
          <p>{preview ? 'This updates sample data in this browser tab only.' : 'Course status changes take effect immediately.'}</p>
        </div>
        {message && <p className="user-error-summary" role="alert">{message}</p>}
        <span className="sr-only" role="status">{busy ? 'Updating the course catalog.' : ''}</span>
      </div>

      <footer className="dialog-actions">
        <button ref={cancelRef} className="secondary-button" onClick={close}>Cancel</button>
        <button className={`admin-button ${deactivate ? 'user-danger-solid' : 'user-primary'}`} disabled={busy} onClick={confirm}>
          {busy ? 'Updating…' : `${label} course`}
        </button>
      </footer>
    </Dialog>
  )
}
