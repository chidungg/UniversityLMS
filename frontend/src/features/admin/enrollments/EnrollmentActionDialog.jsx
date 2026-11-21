import { useEffect, useRef, useState } from 'react'
import Dialog from '../../../components/ui/Dialog'
import Icon from '../../../components/ui/Icon'
import { enrollmentErrorMessage, unassignPreviewInstructor, unenrollPreviewStudent } from './enrollmentPreview'

export default function EnrollmentActionDialog({ action, classItem, course, person, personId, onClose, onSaved }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const cancelRef = useRef(null)
  const request = useRef(null)
  const lock = useRef(false)
  useEffect(() => () => request.current?.abort(), [])

  const isUnenroll = action === 'unenroll'
  const personName = person?.name || (isUnenroll ? 'Unavailable student' : 'Unavailable instructor')

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
      const result = isUnenroll
        ? await unenrollPreviewStudent(classItem.id, personId, { signal: controller.signal })
        : await unassignPreviewInstructor(classItem.id, { signal: controller.signal })
      const feedback = isUnenroll
        ? `${personName} unenrolled from ${classItem.code} in this preview.`
        : `${personName} unassigned from ${classItem.code} in this preview.`
      onSaved(result, feedback)
    } catch (error) {
      if (controller.signal.aborted) return
      setMessage(enrollmentErrorMessage(error))
      lock.current = false
      setBusy(false)
    }
  }

  return <Dialog initialFocusRef={cancelRef} onDismiss={close} aria-labelledby="enroll-action-title" aria-describedby="enroll-action-description">
    <header className="dialog-header">
      <div>
        <p className="dialog-eyebrow">{isUnenroll ? 'ENROLLMENT REMOVAL' : 'INSTRUCTOR ASSIGNMENT'}</p>
        <h2 id="enroll-action-title">{isUnenroll ? 'Unenroll student?' : 'Unassign instructor?'}</h2>
      </div>
      <button type="button" className="dialog-close" aria-label="Close confirmation dialog" onClick={close}><Icon name="close" /></button>
    </header>
    <div className="dialog-body user-form">
      <div className="user-confirm-identity">
        <strong>{personName}</strong>
        <span>{person?.email || personId} · {classItem.code}{course ? ` (${course.name})` : ''}</span>
      </div>
      <p id="enroll-action-description">
        {isUnenroll
          ? `Remove ${personName} from ${classItem.code}. They will no longer appear on this class roster until enrolled again.`
          : `Remove ${personName} as the instructor for ${classItem.code}. The class will stay listed as Not assigned until another instructor is assigned.`}
      </p>
      <div className="user-info">
        <Icon name="alert" size={20} />
        <p>This updates sample data in this browser tab only.</p>
      </div>
      {message && <p className="user-error-summary" role="alert">{message}</p>}
      <span className="sr-only" role="status">{busy ? 'Updating enrollment records.' : ''}</span>
    </div>
    <footer className="dialog-actions">
      <button ref={cancelRef} type="button" className="secondary-button" onClick={close}>Cancel</button>
      <button type="button" className="admin-button user-danger-solid" disabled={busy} onClick={confirm}>
        {busy ? 'Updating…' : isUnenroll ? 'Unenroll student' : 'Unassign instructor'}
      </button>
    </footer>
  </Dialog>
}
