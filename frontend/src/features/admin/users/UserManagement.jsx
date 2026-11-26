import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../../app/AuthContext'
import Icon from '../../../components/ui/Icon'
import UserFormDialog from './UserFormDialog'
import UserStatusDialog from './UserStatusDialog'
import { listUsers, USER_ROLES, userErrorMessage } from './userPreview'
import '../admin.css'
import './users.css'

function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

function roleBadgeClass(role) {
  if (role === 'Instructor') return 'is-instructor'
  if (role === 'Administrator') return 'is-admin'
  return ''
}

export default function UserManagement() {
  const { user: currentUser, refresh: refreshAuth } = useAuth()
  const authenticated = Boolean(currentUser)
  const currentUserId = currentUser?._id || ''
  const [directory, setDirectory] = useState({ users: [], preview: !authenticated })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState('')
  const [role, setRole] = useState('All roles')
  const [status, setStatus] = useState('All statuses')
  const [sort, setSort] = useState({ field: 'name', direction: 'ascending' })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [revision, setRevision] = useState(0)
  const [dialog, setDialog] = useState(null)
  const addButton = useRef(null)
  const searchRef = useRef(null)
  const afterSave = useRef(false)

  useEffect(() => {
    document.title = 'User management | University LMS'
    const controller = new AbortController()
    listUsers({ signal: controller.signal, authenticated })
      .then((result) => {
        setDirectory({ users: result.users, preview: Boolean(result.preview) })
        setLoading(false)
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        setLoadError(userErrorMessage(error, true))
        setLoading(false)
      })
    return () => controller.abort()
  }, [revision, authenticated])

  useEffect(() => {
    if (dialog || !afterSave.current) return
    afterSave.current = false
    if (document.activeElement === document.body || !document.activeElement?.isConnected) {
      addButton.current?.focus()
    }
  }, [dialog])

  function load() {
    setLoading(true)
    setLoadError('')
    setMessage('')
    setRevision((value) => value + 1)
  }

  const users = directory.users
  const preview = directory.preview
  const filtered = users
    .filter((user) => (
      `${user.name} ${user.email}`.toLowerCase().includes(query.trim().toLowerCase()) &&
      (role === 'All roles' || user.role === role) &&
      (status === 'All statuses' || user.status === status)
    ))
    .sort((a, b) => a[sort.field].localeCompare(b[sort.field], 'en', { sensitivity: 'base' }) * (sort.direction === 'ascending' ? 1 : -1))
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const hasFilters = query !== '' || role !== 'All roles' || status !== 'All statuses'

  function filter(setter, value) {
    setter(value)
    setPage(1)
  }

  function clearFilters() {
    setQuery('')
    setRole('All roles')
    setStatus('All statuses')
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

  function saved(result, feedback, editedUserId) {
    afterSave.current = true
    setDirectory({ users: result.users, preview: Boolean(result.preview) })
    setMessage(feedback)
    setDialog(null)
    if (editedUserId && editedUserId === currentUserId) {
      refreshAuth()
    }
  }

  return (
    <div className="user-page">
      <div className="admin-page-heading">
        <div className="lms-page-title-row">
          <h1>User management</h1>
          <span className="admin-count">{loading || loadError ? '—' : users.length}</span>
        </div>
        <div className="admin-heading-actions">
          <button type="button" className="admin-button" onClick={load} disabled={loading}>
            <Icon name="refresh" className={loading ? 'admin-spinning' : ''} size={15} />
            {loading ? 'Loading…' : 'Refresh'}
          </button>
          <button
            ref={addButton}
            type="button"
            className="admin-button user-primary"
            onClick={() => setDialog({ type: 'form' })}
            disabled={loading || Boolean(loadError)}
          >
            <span aria-hidden="true" className="user-plus">+</span>
            Add user
          </button>
        </div>
      </div>

      {preview && (
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

      <section className="admin-panel user-directory" aria-label="Account directory">
        <div className="user-filters" style={{ paddingTop: '14px' }}>
          <div className="user-field user-search-field">
            <label htmlFor="user-search">Search users</label>
            <div className="user-search-control">
              <Icon name="search" size={16} />
              <input
                ref={searchRef}
                id="user-search"
                type="search"
                placeholder="Search by name or email…"
                value={query}
                onChange={(event) => filter(setQuery, event.target.value)}
              />
            </div>
          </div>
          <div className="user-field">
            <label htmlFor="user-role-filter">Role</label>
            <select id="user-role-filter" value={role} onChange={(event) => filter(setRole, event.target.value)}>
              <option>All roles</option>
              {USER_ROLES.map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>
          <div className="user-field">
            <label htmlFor="user-status-filter">Status</label>
            <select id="user-status-filter" value={status} onChange={(event) => filter(setStatus, event.target.value)}>
              <option>All statuses</option>
              <option>Active</option>
              <option>Inactive</option>
            </select>
          </div>
          <button type="button" className="admin-row-link user-clear" onClick={clearFilters} disabled={!hasFilters}>
            Clear filters
          </button>
        </div>

        <div className="user-results-summary" role="status" aria-atomic="true">
          {loading
            ? 'Loading accounts…'
            : loadError
              ? 'Directory unavailable'
              : `${filtered.length} ${filtered.length === 1 ? 'user' : 'users'}${hasFilters ? ' matching filters' : ''}`}
        </div>

        {loadError ? (
          <div className="user-empty" role="alert">
            <Icon name="alert" size={26} />
            <h3>Unable to load users</h3>
            <p>{loadError}</p>
            <button type="button" className="admin-button" onClick={load}>Try again</button>
          </div>
        ) : loading ? (
          <div className="user-skeleton" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((row) => <div key={row}><span /><span /><span /><span /></div>)}
          </div>
        ) : (
          <>
            {rows.length ? (
              <div className="admin-table-scroll">
                <table className="admin-table user-table">
                  <caption className="sr-only">{preview ? 'University user accounts, sample data' : 'University user accounts'}</caption>
                  <colgroup>
                    <col className="user-col-name" />
                    <col className="user-col-email" />
                    <col className="user-col-role" />
                    <col className="user-col-status" />
                    <col className="user-col-actions" />
                  </colgroup>
                  <thead>
                    <tr>
                      {[['name', 'Full name'], ['email', 'Email'], ['role', 'Role'], ['status', 'Status']].map(([field, label]) => (
                        <th key={field} scope="col" aria-sort={sort.field === field ? sort.direction : 'none'}>
                          <button type="button" onClick={() => sortBy(field)} aria-label={`Sort by ${label.toLowerCase()}`}>
                            {label}
                            <span aria-hidden="true">{sort.field === field ? sort.direction === 'ascending' ? '↑' : '↓' : '↕'}</span>
                          </button>
                        </th>
                      ))}
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((user) => {
                      const isSelf = Boolean(currentUserId && user.id === currentUserId)
                      const nextAction = user.status === 'Active' ? 'Deactivate' : 'Activate'
                      return (
                        <tr key={user.id}>
                          <th scope="row">
                            <div className="user-identity">
                              <span className={`user-initials ${roleBadgeClass(user.role)}`} aria-hidden="true">
                                {initials(user.name)}
                              </span>
                              <strong>{user.name}</strong>
                              {isSelf && <span className="user-self-badge">You</span>}
                            </div>
                          </th>
                          <td>{user.email}</td>
                          <td>{user.role}</td>
                          <td>
                            <span className={`admin-status ${user.status === 'Active' ? 'is-active' : ''}`}>
                              <span className="user-status-dot" aria-hidden="true" />
                              {user.status}
                            </span>
                          </td>
                          <td>
                            <div className="user-row-actions">
                              <button
                                type="button"
                                className="admin-row-link"
                                aria-label={`Edit ${user.name}`}
                                onClick={() => setDialog({ type: 'form', user })}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className={`admin-row-link ${user.status === 'Active' ? 'user-danger' : ''}`}
                                aria-label={isSelf ? `${nextAction} ${user.name} (your current account)` : `${nextAction} ${user.name}`}
                                title={isSelf ? 'You cannot deactivate your own account' : undefined}
                                disabled={isSelf}
                                onClick={() => setDialog({ type: 'status', user })}
                              >
                                {nextAction}
                              </button>
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
                <span className="user-empty-icon"><Icon name={hasFilters ? 'search' : 'users'} size={24} /></span>
                <h3>{hasFilters ? 'No users found' : 'No users yet'}</h3>
                <p>{hasFilters ? 'Try another search term or clear filters.' : 'Add your first user account.'}</p>
                <button type="button" className="admin-button" onClick={hasFilters ? clearFilters : () => setDialog({ type: 'form' })}>
                  {hasFilters ? 'Clear all filters' : 'Add your first user'}
                </button>
              </div>
            )}
            <div className="user-pagination">
              <p>{filtered.length ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filtered.length)} of ${filtered.length} users` : '0 users'}</p>
              <div>
                <label htmlFor="user-page-size">Rows per page</label>
                <select id="user-page-size" value={pageSize} onChange={(event) => filter(setPageSize, Number(event.target.value))}>
                  {[5, 10, 25, 50].map((size) => <option key={size}>{size}</option>)}
                </select>
                <nav aria-label="User directory pagination">
                  <button type="button" className="admin-button" aria-label="Previous page" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1}>
                    <Icon name="chevron" className="user-chevron-back" size={15} />
                  </button>
                  <span>Page {currentPage} of {pageCount}</span>
                  <button type="button" className="admin-button" aria-label="Next page" onClick={() => setPage(currentPage + 1)} disabled={currentPage === pageCount}>
                    <Icon name="chevron" size={15} />
                  </button>
                </nav>
              </div>
            </div>
          </>
        )}
      </section>

      {dialog?.type === 'form' && (
        <UserFormDialog
          user={dialog.user}
          users={users}
          authenticated={authenticated}
          preview={preview}
          currentUserId={currentUserId}
          onClose={() => setDialog(null)}
          onSaved={saved}
        />
      )}
      {dialog?.type === 'status' && (
        <UserStatusDialog
          user={dialog.user}
          authenticated={authenticated}
          preview={preview}
          onClose={() => setDialog(null)}
          onSaved={saved}
        />
      )}
    </div>
  )
}
