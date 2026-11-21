import { useEffect, useRef, useState } from 'react'
import Dialog from '../../../components/ui/Dialog'
import Icon from '../../../components/ui/Icon'
import { changePreviewClass, classErrorMessage } from './classPreview'
import { classEnrollmentCount, hasClassRelationships } from './classStore'

export default function ClassActionDialog({ item, course, action, onClose, onSaved }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const cancel = useRef(null)
  const request = useRef(null)
  const lock = useRef(false)
  const blockedDelete = action === 'delete' && hasClassRelationships(item)
  const blockedActivate = action === 'activate' && course?.status !== 'Active'
  const blocked = blockedDelete || blockedActivate
  const label = { activate: 'Activate', deactivate: 'Deactivate', delete: 'Delete' }[action]
  useEffect(() => () => request.current?.abort(), [])
  function close() { request.current?.abort(); onClose() }
  async function confirm() {
    if (lock.current || blocked) return
    lock.current = true; setBusy(true); setMessage('')
    const controller = new AbortController(); request.current = controller
    try { onSaved(await changePreviewClass(item.id, action, { signal: controller.signal }), `${item.code} ${action === 'delete' ? 'deleted' : action === 'activate' ? 'activated' : 'deactivated'} in this preview.`) }
    catch (error) { if (controller.signal.aborted) return; setMessage(classErrorMessage(error)); lock.current = false; setBusy(false) }
  }
  return <Dialog initialFocusRef={cancel} onDismiss={close} aria-labelledby="class-action-title" aria-describedby="class-action-description">
    <header className="dialog-header"><div><p className="dialog-eyebrow">CLASS MANAGEMENT</p><h2 id="class-action-title">{blockedDelete ? 'Class cannot be deleted' : blockedActivate ? 'Class cannot be activated' : `${label} class?`}</h2></div><button className="dialog-close" aria-label="Close class confirmation" onClick={close}><Icon name="close" /></button></header>
    <div className="dialog-body user-form"><div className="user-confirm-identity"><strong>{item.code}</strong><span>{course?.name || 'Course unavailable'}</span></div><p id="class-action-description">{blockedDelete ? `This class has ${classEnrollmentCount(item.id)} enrolled students${item.instructorId ? ' and an assigned instructor' : ''}. Keep its academic records and deactivate it instead.` : blockedActivate ? 'The linked course is inactive or unavailable. Activate the course before activating this class.' : action === 'delete' ? 'Remove this class from the sample directory. It has no enrollments or assigned instructor. This cannot be undone.' : action === 'deactivate' ? 'Mark this class as Inactive. Its course, instructor assignment and student enrollments will be kept.' : 'Mark this class as Active. Its existing instructor assignment and student enrollments will stay the same.'}</p><div className="user-info"><Icon name="alert" size={20} /><p>This changes sample data in this browser tab only.</p></div>{message && <p className="user-error-summary" role="alert">{message}</p>}<span role="status" className="sr-only">{busy ? 'Updating the class directory.' : ''}</span></div>
    <footer className="dialog-actions"><button ref={cancel} className="secondary-button" onClick={close}>{blocked ? 'Close' : 'Cancel'}</button>{!blocked && <button className={`admin-button ${action === 'activate' ? 'user-primary' : 'user-danger-solid'}`} disabled={busy} onClick={confirm}>{busy ? 'Updating…' : `${label} class`}</button>}</footer>
  </Dialog>
}
