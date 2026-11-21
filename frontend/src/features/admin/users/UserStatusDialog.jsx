import { useEffect, useRef, useState } from 'react'
import Dialog from '../../../components/ui/Dialog'
import Icon from '../../../components/ui/Icon'
import { setPreviewUserStatus, userErrorMessage } from './userPreview'

export default function UserStatusDialog({ user, onClose, onSaved }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const cancelRef = useRef(null)
  const request = useRef(null)
  const lock = useRef(false)
  const deactivate = user.status === 'Active'
  const action = deactivate ? 'Deactivate' : 'Activate'
  useEffect(() => () => request.current?.abort(), [])
  async function confirm() {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setMessage('')
    const controller = new AbortController()
    request.current = controller
    try {
      const users = await setPreviewUserStatus(user.id, deactivate ? 'Inactive' : 'Active', { signal: controller.signal })
      onSaved(users, `${user.name} ${deactivate ? 'deactivated' : 'activated'} in this preview.`)
    } catch (error) {
      if (controller.signal.aborted) return
      setMessage(userErrorMessage(error))
      lock.current = false
      setBusy(false)
    }
  }
  return <Dialog initialFocusRef={cancelRef} onDismiss={onClose} aria-labelledby="user-status-title" aria-describedby="user-status-description">
    <header className="dialog-header"><div><p className="dialog-eyebrow">ACCOUNT STATUS</p><h2 id="user-status-title">{action} user?</h2></div><button className="dialog-close" aria-label="Close status confirmation" onClick={onClose}><Icon name="close" /></button></header>
    <div className="dialog-body user-form"><div className="user-confirm-identity"><strong>{user.name}</strong><span>{user.email}</span></div><p id="user-status-description">{deactivate ? 'Mark this account as inactive. In the connected system, an inactive user cannot access the LMS. Their account record is kept.' : 'Mark this account as active. In the connected system, access is determined by the assigned role.'}</p><div className="user-info"><Icon name="shield" size={20} /><p>This updates sample data only. No real account access will change.</p></div>{message && <p className="user-error-summary" role="alert">{message}</p>}<span className="sr-only" role="status">{busy ? 'Updating account status.' : ''}</span></div>
    <footer className="dialog-actions"><button ref={cancelRef} className="secondary-button" onClick={onClose}>Cancel</button><button className={`admin-button ${deactivate ? 'user-danger-solid' : 'user-primary'}`} onClick={confirm} disabled={busy}>{busy ? 'Updating…' : `${action} user`}</button></footer>
  </Dialog>
}
