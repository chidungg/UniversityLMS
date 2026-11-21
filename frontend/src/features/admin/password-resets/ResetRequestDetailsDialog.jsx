import Dialog from '../../../components/ui/Dialog'
import Icon from '../../../components/ui/Icon'
import { formatRequestDate } from './passwordResetPreview'

function RequestStatus({ status }) {
  const modifier = status === 'Completed' ? 'is-active' : status === 'Pending' ? 'is-pending' : 'is-rejected'
  return <span className={`admin-status ${modifier}`}><span className="user-status-dot" aria-hidden="true" />{status}</span>
}

export default function ResetRequestDetailsDialog({ item, onClose, onStartReset, onStartReject }) {
  const { request, account } = item
  return <Dialog onDismiss={onClose} aria-labelledby="reset-details-title">
    <div className="reset-dialog-scope">
      <header className="dialog-header">
        <div>
          <p className="dialog-eyebrow">PASSWORD RESET REQUEST · SAMPLE DATA</p>
          <h2 id="reset-details-title">{request.id}</h2>
        </div>
        <button type="button" className="dialog-close" aria-label="Close request details" onClick={onClose}><Icon name="close" /></button>
      </header>
      <div className="dialog-body user-form reset-details">
        <div className="user-confirm-identity">
          <div className="reset-details-head">
            <strong>{account.user?.name || 'Unmatched account'}</strong>
            <RequestStatus status={request.status} />
          </div>
          <span>{request.email}</span>
          {!account.eligible && <span className="reset-account-warning"><Icon name="alert" size={14} />{account.issue}</span>}
        </div>
        <dl>
          <div><dt>Request ID</dt><dd>{request.id}</dd></div>
          <div><dt>Account status</dt><dd>{account.user ? `${account.user.role} · ${account.user.status}` : 'No matching account'}</dd></div>
          <div><dt>Submitted</dt><dd>{formatRequestDate(request.submittedAt)}</dd></div>
          <div><dt>Reviewed</dt><dd>{request.reviewedAt ? formatRequestDate(request.reviewedAt) : 'Pending review'}</dd></div>
        </dl>
        <div className="reset-details-section">
          <h3>Student note</h3>
          <p>{request.note || 'No note provided by the student.'}</p>
        </div>
        {request.status !== 'Pending' && (
          <div className="reset-details-section">
            <h3>{request.status === 'Rejected' ? 'Rejection reason' : 'Resolution note'}</h3>
            <p>{request.resolutionNote || 'No resolution note recorded.'}</p>
          </div>
        )}
        <div className="user-info">
          <Icon name="shield" size={20} />
          <p>Passwords are never shown or stored in this request history. Verify student identity before resetting any password.</p>
        </div>
      </div>
      <footer className="dialog-actions">
        <button type="button" className="secondary-button" onClick={onClose}>Close</button>
        {request.status === 'Pending' && <>
          <button type="button" className="admin-button user-danger" onClick={() => onStartReject(item)}>Reject</button>
          <button type="button" className="admin-button user-primary" onClick={() => onStartReset(item)}>Reset password</button>
        </>}
      </footer>
    </div>
  </Dialog>
}
