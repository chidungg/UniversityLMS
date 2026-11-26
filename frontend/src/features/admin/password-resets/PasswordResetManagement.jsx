import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../../app/AuthContext'
import Icon from '../../../components/ui/Icon'
import ResetRequestDetailsDialog from './ResetRequestDetailsDialog'
import ResetPasswordDialog from './ResetPasswordDialog'
import RejectResetDialog from './RejectResetDialog'
import { formatRequestDate, listPasswordResetWorkspace, passwordResetErrorMessage, resolveRequestAccount } from './passwordResetPreview'
import { RESET_STATUSES } from './passwordResetStore'
import '../admin.css'
import '../users/users.css'
import './passwordResets.css'

function RequestStatus({ status }) {
  const modifier = status === 'Completed' ? 'is-active' : status === 'Pending' ? 'is-pending' : 'is-rejected'
  return <span className={`admin-status ${modifier}`}><span className="user-status-dot" aria-hidden="true" />{status}</span>
}

function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

export default function PasswordResetManagement() {
  const { user } = useAuth()
  const authenticated = Boolean(user)
  const [data, setData] = useState({ requests: [], users: [], preview: !authenticated })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All statuses')
  const [accountFilter, setAccountFilter] = useState('All accounts')
  const [sort, setSort] = useState({ field: 'submittedAt', direction: 'descending' })
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(10)
  const [revision, setRevision] = useState(0)
  const [dialog, setDialog] = useState(null)
  const refreshButton = useRef(null)
  const searchRef = useRef(null)
  const afterSave = useRef(false)

  useEffect(() => {
    document.title = 'Password resets | University LMS'
    const controller = new AbortController()
    listPasswordResetWorkspace({ signal: controller.signal, authenticated })
      .then((result) => { setData(result); setLoading(false) })
      .catch((failure) => {
        if (controller.signal.aborted) return
        setError(passwordResetErrorMessage(failure, true))
        setLoading(false)
      })
    return () => controller.abort()
  }, [revision, authenticated])

  useEffect(() => {
    if (dialog || !afterSave.current) return
    afterSave.current = false
    if (document.activeElement === document.body || !document.activeElement?.isConnected) {
      refreshButton.current?.focus()
    }
  }, [dialog])

  function refresh() {
    setLoading(true)
    setError('')
    setMessage('')
    setRevision((value) => value + 1)
  }

  function filter(setter, value) { setter(value); setPage(1) }
  function clearFilters() {
    setQuery('')
    setStatusFilter('All statuses')
    setAccountFilter('All accounts')
    setPage(1)
    searchRef.current?.focus()
  }

  function sortBy(field) {
    setSort({
      field,
      direction: sort.field === field && sort.direction === 'ascending' ? 'descending' : 'ascending',
    })
    setPage(1)
  }

  function handleSaved(result, feedback) {
    afterSave.current = true
    setData({ requests: result.requests, users: result.users, preview: Boolean(result.preview) })
    setMessage(feedback)
    setDialog(null)
  }

  const enriched = data.requests.map((request) => {
    const account = resolveRequestAccount(request, data.users, user?._id || '')
    return {
      request,
      account,
      displayName: account.user?.name || 'Unmatched account',
    }
  })

  const pendingCount = enriched.filter((item) => item.request.status === 'Pending').length
  const completedCount = enriched.filter((item) => item.request.status === 'Completed').length
  const rejectedCount = enriched.filter((item) => item.request.status === 'Rejected').length

  const filtered = enriched
    .filter(({ request, account, displayName }) => {
      const roleLabel = account.user?.role || ''
      const searchText = `${request.id} ${displayName} ${request.email} ${roleLabel} ${request.note}`.toLowerCase()
      const matchesQuery = searchText.includes(query.trim().toLowerCase())
      const matchesStatus = statusFilter === 'All statuses' || request.status === statusFilter
      const matchesAccount = accountFilter === 'All accounts'
        || (accountFilter === 'Eligible accounts' && account.eligible)
        || (accountFilter === 'Needs review' && !account.eligible)
      return matchesQuery && matchesStatus && matchesAccount
    })
    .sort((a, b) => {
      const dir = sort.direction === 'ascending' ? 1 : -1
      if (sort.field === 'submittedAt') {
        return (Date.parse(a.request.submittedAt) - Date.parse(b.request.submittedAt)) * dir
      }
      if (sort.field === 'student') {
        return `${a.displayName} ${a.request.email}`.localeCompare(`${b.displayName} ${b.request.email}`, 'en', { sensitivity: 'base' }) * dir
      }
      return a.request.status.localeCompare(b.request.status, 'en', { sensitivity: 'base' }) * dir
    })

  const pages = Math.max(1, Math.ceil(filtered.length / size))
  const currentPage = Math.min(page, pages)
  const rows = filtered.slice((currentPage - 1) * size, currentPage * size)
  const hasFilters = Boolean(query || statusFilter !== 'All statuses' || accountFilter !== 'All accounts')

  return (
    <div className="user-page reset-page">
      <div className="admin-page-heading">
        <div className="lms-page-title-row">
          <h1>Password resets</h1>
          <span className="admin-count">{loading || error ? '—' : `${pendingCount} pending`}</span>
        </div>
        <button ref={refreshButton} type="button" className="admin-button" onClick={refresh} disabled={loading}>
          <Icon name="refresh" size={15} className={loading ? 'admin-spinning' : ''} />
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {data.preview && (
        <div className="user-preview-notice">
          <span className="admin-sample-label">Sample data</span>
          <p>Changes are saved in this browser tab only.</p>
        </div>
      )}

      <div className="user-feedback" role="status" aria-atomic="true">
        {message && (
          <>
            <Icon name="check" size={17} />
            <span>{message}</span>
            <button type="button" aria-label="Dismiss success message" onClick={() => setMessage('')}>
              <Icon name="close" size={15} />
            </button>
          </>
        )}
      </div>

      <section className="admin-panel user-directory" aria-label="Recovery requests">
        <div className="user-filters reset-filters" style={{ paddingTop: '14px' }}>
          <div className="user-field">
            <label htmlFor="reset-search">Search requests</label>
            <div className="user-search-control">
              <Icon name="search" size={16} />
              <input
                ref={searchRef}
                id="reset-search"
                type="search"
                placeholder="Name, email, request ID or note…"
                value={query}
                onChange={(event) => filter(setQuery, event.target.value)}
              />
            </div>
          </div>
          <div className="user-field">
            <label htmlFor="reset-status-filter">Status</label>
            <select
              id="reset-status-filter"
              value={statusFilter}
              onChange={(event) => filter(setStatusFilter, event.target.value)}
            >
              <option>All statuses</option>
              {RESET_STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
          </div>
          <div className="user-field">
            <label htmlFor="reset-account-filter">Account check</label>
            <select
              id="reset-account-filter"
              value={accountFilter}
              onChange={(event) => filter(setAccountFilter, event.target.value)}
            >
              <option>All accounts</option>
              <option>Eligible accounts</option>
              <option>Needs review</option>
            </select>
          </div>
          <button type="button" className="admin-row-link user-clear" onClick={clearFilters} disabled={!hasFilters}>
            Clear filters
          </button>
        </div>

        <div className="user-results-summary" role="status" aria-atomic="true">
          {loading
            ? 'Loading requests…'
            : error
              ? 'Request queue unavailable'
              : `${filtered.length} ${filtered.length === 1 ? 'request' : 'requests'}${hasFilters ? ' matching filters' : ''}`}
          {!loading && !error && <span>{pendingCount} pending · {completedCount} completed · {rejectedCount} rejected</span>}
        </div>

        {error ? (
          <div className="user-empty" role="alert">
            <Icon name="alert" size={26} />
            <h3>Unable to load reset requests</h3>
            <p>{error}</p>
            <button type="button" className="admin-button" onClick={refresh}>Try again</button>
          </div>
        ) : loading ? (
          <div className="user-skeleton" aria-hidden="true">
            {[0, 1, 2, 3].map((row) => <div key={row}><span /><span /><span /><span /></div>)}
          </div>
        ) : (
          <>
            {rows.length ? (
              <div className="admin-table-scroll">
                <table className="admin-table user-table reset-table">
                  <caption className="sr-only">Password reset requests queue</caption>
                  <colgroup>
                    <col className="reset-col-student" />
                    <col className="reset-col-note" />
                    <col className="reset-col-submitted" />
                    <col className="reset-col-status" />
                    <col className="reset-col-actions" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th scope="col" aria-sort={sort.field === 'student' ? sort.direction : 'none'}>
                        <button type="button" onClick={() => sortBy('student')} aria-label="Sort by account">
                          Account
                          <span aria-hidden="true">{sort.field === 'student' ? sort.direction === 'ascending' ? '↑' : '↓' : '↕'}</span>
                        </button>
                      </th>
                      <th scope="col">Requester note</th>
                      <th scope="col" aria-sort={sort.field === 'submittedAt' ? sort.direction : 'none'}>
                        <button type="button" onClick={() => sortBy('submittedAt')} aria-label="Sort by submitted date">
                          Submitted
                          <span aria-hidden="true">{sort.field === 'submittedAt' ? sort.direction === 'ascending' ? '↑' : '↓' : '↕'}</span>
                        </button>
                      </th>
                      <th scope="col" aria-sort={sort.field === 'status' ? sort.direction : 'none'}>
                        <button type="button" onClick={() => sortBy('status')} aria-label="Sort by status">
                          Status
                          <span aria-hidden="true">{sort.field === 'status' ? sort.direction === 'ascending' ? '↑' : '↓' : '↕'}</span>
                        </button>
                      </th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((item) => {
                      const { request, account, displayName } = item
                      const isPending = request.status === 'Pending'
                      return (
                        <tr key={request.id}>
                          <th scope="row">
                            <div className="reset-student-cell">
                              <span className={`user-initials ${account.user?.role === 'Instructor' || !account.user ? 'is-instructor' : ''}`} aria-hidden="true">
                                {account.user ? initials(account.user.name) : '?'}
                              </span>
                              <div className="reset-student-text">
                                <button
                                  type="button"
                                  className="admin-row-link reset-student-link"
                                  aria-label={`View request ${request.id} for ${displayName}`}
                                  onClick={() => setDialog({ type: 'details', item })}
                                >
                                  {displayName}
                                </button>
                                <span className="reset-cell-email">
                                  {request.email}{account.user ? ` · ${account.user.role}` : ''}
                                </span>
                                {!account.eligible && (
                                  <span className="reset-account-warning">
                                    <Icon name="alert" size={12} />
                                    {account.issue}
                                  </span>
                                )}
                              </div>
                            </div>
                          </th>
                          <td className="reset-note-cell">
                            {request.note ? (
                              <>
                                <p>{request.note.length > 96 ? `${request.note.slice(0, 96).trimEnd()}…` : request.note}</p>
                                {request.note.length > 96 && (
                                  <button
                                    type="button"
                                    className="admin-row-link reset-read-more"
                                    aria-label={`Read more of note for ${request.id}`}
                                    onClick={() => setDialog({ type: 'details', item })}
                                  >
                                    Read more
                                  </button>
                                )}
                              </>
                            ) : (
                              <span className="reset-note-empty">—</span>
                            )}
                          </td>
                          <td className="reset-date-cell">
                            {formatRequestDate(request.submittedAt)}
                            <span className="reset-id-note">{request.id}</span>
                          </td>
                          <td><RequestStatus status={request.status} /></td>
                          <td>
                            <div className="reset-row-actions">
                              {isPending ? (
                                <>
                                  <button
                                    type="button"
                                    className="admin-row-link"
                                    aria-label={`Reset password for ${request.id}`}
                                    onClick={() => setDialog({ type: 'reset', item })}
                                  >
                                    Reset
                                  </button>
                                  <button
                                    type="button"
                                    className="admin-row-link user-danger"
                                    aria-label={`Reject request ${request.id}`}
                                    onClick={() => setDialog({ type: 'reject', item })}
                                  >
                                    Reject
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  className="admin-row-link"
                                  aria-label={`Details for ${request.id}`}
                                  onClick={() => setDialog({ type: 'details', item })}
                                >
                                  Details
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="user-empty">
                <span className="user-empty-icon"><Icon name={hasFilters ? 'search' : 'lock'} size={24} /></span>
                <h3>{hasFilters ? 'No matching requests' : 'No password reset requests'}</h3>
                <p>
                  {hasFilters
                    ? 'Try another search term or clear filters.'
                    : 'Password reset requests will appear here.'}
                </p>
                {hasFilters && <button type="button" className="admin-button" onClick={clearFilters}>Clear all filters</button>}
              </div>
            )}

            <div className="user-pagination">
              <p>
                {filtered.length
                  ? `${(currentPage - 1) * size + 1}–${Math.min(currentPage * size, filtered.length)} of ${filtered.length} ${filtered.length === 1 ? 'request' : 'requests'}`
                  : '0 requests'}
              </p>
              <div>
                <label htmlFor="reset-page-size">Rows per page</label>
                <select
                  id="reset-page-size"
                  value={size}
                  onChange={(event) => filter(setSize, Number(event.target.value))}
                >
                  {[5, 10, 25, 50].map((value) => <option key={value}>{value}</option>)}
                </select>
                <nav aria-label="Password reset requests pagination">
                  <button
                    type="button"
                    className="admin-button"
                    aria-label="Previous page"
                    disabled={currentPage === 1}
                    onClick={() => setPage(currentPage - 1)}
                  >
                    <Icon name="chevron" size={15} className="user-chevron-back" />
                  </button>
                  <span>Page {currentPage} of {pages}</span>
                  <button
                    type="button"
                    className="admin-button"
                    aria-label="Next page"
                    disabled={currentPage === pages}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    <Icon name="chevron" size={15} />
                  </button>
                </nav>
              </div>
            </div>
          </>
        )}
      </section>

      {dialog?.type === 'details' && (
        <ResetRequestDetailsDialog
          item={dialog.item}
          onClose={() => setDialog(null)}
          onStartReset={(item) => setDialog({ type: 'reset', item })}
          onStartReject={(item) => setDialog({ type: 'reject', item })}
        />
      )}
      {dialog?.type === 'reset' && (
        <ResetPasswordDialog
          item={dialog.item}
          authenticated={authenticated}
          currentUserId={user?._id || ''}
          onClose={() => setDialog(null)}
          onSaved={handleSaved}
        />
      )}
      {dialog?.type === 'reject' && (
        <RejectResetDialog
          item={dialog.item}
          authenticated={authenticated}
          onClose={() => setDialog(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
