import { useEffect, useRef, useState } from 'react'
import Dialog from '../../../components/ui/Dialog'
import Icon from '../../../components/ui/Icon'
import { changePreviewCourse, courseErrorMessage, linkedClasses } from './coursePreview'

export default function CourseActionDialog({ course, action, onClose, onSaved }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const cancelRef = useRef(null)
  const request = useRef(null)
  const lock = useRef(false)
  const classes = linkedClasses(course.id)
  const blocked = action === 'delete' && classes.length > 0
  const label = { activate: 'Activate', deactivate: 'Deactivate', delete: 'Delete' }[action]
  useEffect(() => () => request.current?.abort(), [])
  function close() { request.current?.abort(); onClose() }
  async function confirm() {
    if (lock.current || blocked) return
    lock.current = true
    setBusy(true)
    setMessage('')
    const controller = new AbortController()
    request.current = controller
    try {
      const courses = await changePreviewCourse(course.id, action, { signal: controller.signal })
      onSaved(courses, `${course.code} ${action === 'delete' ? 'deleted' : action === 'activate' ? 'activated' : 'deactivated'} in this preview.`)
    } catch (error) {
      if (controller.signal.aborted) return
      setMessage(courseErrorMessage(error))
      lock.current = false
      setBusy(false)
    }
  }
  return <Dialog initialFocusRef={cancelRef} onDismiss={close} aria-labelledby="course-action-title" aria-describedby="course-action-description">
    <header className="dialog-header"><div><p className="dialog-eyebrow">COURSE MANAGEMENT</p><h2 id="course-action-title">{blocked ? 'Course cannot be deleted' : `${label} course?`}</h2></div><button className="dialog-close" aria-label="Close course confirmation" onClick={close}><Icon name="close" /></button></header>
    <div className="dialog-body user-form"><div className="user-confirm-identity"><span>{course.code}</span><strong>{course.name}</strong></div><p id="course-action-description">{blocked ? `This course is linked to ${classes.length} ${classes.length === 1 ? 'class' : 'classes'}. Keep its academic records and deactivate the course instead.` : action === 'delete' ? 'Remove this course from the sample catalog. This cannot be undone. There are no linked classes.' : action === 'deactivate' ? 'Mark this course as Inactive. The course, its classes and enrollment records will be kept. Existing class statuses will not change.' : 'Mark this course as Active in the catalog. Existing class statuses will not change.'}</p>{blocked && <ul className="course-linked-classes">{classes.map((item) => <li key={item.id}>{item.code || item.id}</li>)}</ul>}<div className="user-info"><Icon name="alert" size={20} /><p>This updates sample data in this browser tab only.</p></div>{message && <p className="user-error-summary" role="alert">{message}</p>}<span className="sr-only" role="status">{busy ? 'Updating the course catalog.' : ''}</span></div>
    <footer className="dialog-actions"><button ref={cancelRef} className="secondary-button" onClick={close}>{blocked ? 'Close' : 'Cancel'}</button>{!blocked && <button className={`admin-button ${action === 'activate' ? 'user-primary' : 'user-danger-solid'}`} disabled={busy} onClick={confirm}>{busy ? 'Updating…' : `${label} course`}</button>}</footer>
  </Dialog>
}
