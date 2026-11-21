import { useEffect, useRef, useState } from 'react'
import AdminShell from '../../../components/layout/AdminShell'
import Icon from '../../../components/ui/Icon'
import UserFormDialog from './UserFormDialog'
import UserStatusDialog from './UserStatusDialog'
import { listPreviewUsers, USER_ROLES } from './userPreview'
import '../admin.css'
import './users.css'

export default function UserManagement() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState('')
  const [role, setRole] = useState('All roles')
  const [status, setStatus] = useState('All statuses')
  const [sort, setSort] = useState({ field: 'name', direction: 'ascending' })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [dialog, setDialog] = useState(null)
  const request = useRef(null)
  const addButton = useRef(null)
  const searchRef = useRef(null)

  async function load() {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    setLoadError('')
    setMessage('')
    try {
      setUsers(await listPreviewUsers({ signal: controller.signal }))
      setLoading(false)
    } catch (error) {
      if (controller.signal.aborted) return
      setLoadError(error.message === 'OFFLINE' ? 'You are offline. Check your connection and try again.' : 'We could not load the sample directory. Check that browser storage is available, then try again.')
      setLoading(false)
    }
  }
  useEffect(() => {
    document.title = 'User management | University LMS'
    // The preview adapter is asynchronous so loading/error behavior matches future API use.
    const controller = new AbortController()
    request.current = controller
    listPreviewUsers({ signal: controller.signal }).then((data) => { setUsers(data); setLoading(false) }).catch((error) => {
      if (controller.signal.aborted) return
      setLoadError(error.message === 'OFFLINE' ? 'You are offline. Check your connection and try again.' : 'We could not load the sample directory. Check that browser storage is available, then try again.')
      setLoading(false)
    })
    return () => request.current?.abort()
  }, [])

  const filtered = users.filter((user) => `${user.name} ${user.email}`.toLowerCase().includes(query.trim().toLowerCase()) && (role === 'All roles' || user.role === role) && (status === 'All statuses' || user.status === status)).sort((a, b) => a[sort.field].localeCompare(b[sort.field], 'en', { sensitivity: 'base' }) * (sort.direction === 'ascending' ? 1 : -1))
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const hasFilters = query !== '' || role !== 'All roles' || status !== 'All statuses'
  function filter(setter, value) { setter(value); setPage(1) }
  function clearFilters() { setQuery(''); setRole('All roles'); setStatus('All statuses'); setPage(1); searchRef.current?.focus() }
  function sortBy(field) { setSort({ field, direction: sort.field === field && sort.direction === 'ascending' ? 'descending' : 'ascending' }); setPage(1) }
  function saved(next, feedback) {
    setUsers(next)
    setMessage(feedback)
    setDialog(null)
    // A changed role/status can remove the invoking row from the filtered table.
    requestAnimationFrame(() => { if (document.activeElement === document.body) addButton.current?.focus() })
  }

  return <AdminShell path="/admin/users">
    <div className="user-page">
      <div className="admin-page-heading"><div><p className="admin-eyebrow">ADMINISTRATION / PEOPLE & ACCESS</p><h1>User management</h1><p>Manage university accounts, roles and account status.</p></div><button ref={addButton} className="admin-button user-primary" onClick={() => setDialog({ type: 'form' })} disabled={loading || Boolean(loadError)}><span aria-hidden="true" className="user-plus">+</span>Add user</button></div>
      <div className="user-preview-notice"><span className="admin-sample-label">Sample data</span><p>Changes are saved for this browser tab only. No real accounts or access permissions are changed.</p></div>
      <div className="user-feedback" role="status" aria-atomic="true">{message && <><Icon name="check" size={18} /><span>{message}</span><button aria-label="Dismiss success message" onClick={() => setMessage('')}><Icon name="close" size={16} /></button></>}</div>
      <section className="admin-panel user-directory" aria-labelledby="user-directory-title">
        <div className="user-directory-heading"><div><h2 id="user-directory-title">Account directory <span className="admin-count">{loading || loadError ? '—' : users.length}</span></h2><p>One place to keep your university community up to date.</p></div><button className="admin-button" onClick={load} disabled={loading}><Icon name="refresh" className={loading ? 'admin-spinning' : ''} size={16} />{loading ? 'Loading…' : 'Refresh'}</button></div>
        <div className="user-filters"><div className="user-field user-search-field"><label htmlFor="user-search">Search users</label><div className="user-search-control"><Icon name="search" size={18} /><input ref={searchRef} id="user-search" type="search" placeholder="Search by name or email…" value={query} onChange={(event) => filter(setQuery, event.target.value)} /></div></div><div className="user-field"><label htmlFor="user-role-filter">Role</label><select id="user-role-filter" value={role} onChange={(event) => filter(setRole, event.target.value)}><option>All roles</option>{USER_ROLES.map((item) => <option key={item}>{item}</option>)}</select></div><div className="user-field"><label htmlFor="user-status-filter">Status</label><select id="user-status-filter" value={status} onChange={(event) => filter(setStatus, event.target.value)}><option>All statuses</option><option>Active</option><option>Inactive</option></select></div><button className="admin-row-link user-clear" onClick={clearFilters} disabled={!hasFilters}>Clear filters</button></div>
        <div className="user-results-summary" role="status" aria-atomic="true">{loading ? 'Loading the account directory…' : loadError ? 'Directory unavailable' : `${filtered.length} ${filtered.length === 1 ? 'user' : 'users'}${hasFilters ? ' match your filters' : ' in your directory'}`}<span>Roles define access · Status controls availability</span></div>
        {loadError ? <div className="user-empty" role="alert"><Icon name="alert" size={30} /><h3>Unable to load users</h3><p>{loadError}</p><button className="admin-button" onClick={load}>Try again</button></div> : loading ? <div className="user-skeleton" aria-hidden="true">{[0, 1, 2, 3, 4].map((row) => <div key={row}><span /><span /><span /><span /></div>)}</div> : <>
          {rows.length ? <div className="admin-table-scroll"><table className="admin-table user-table"><caption className="sr-only">University user accounts, sample data</caption><colgroup><col className="user-col-name" /><col className="user-col-email" /><col className="user-col-role" /><col className="user-col-status" /><col className="user-col-actions" /></colgroup><thead><tr>{[['name', 'Full name'], ['email', 'Email'], ['role', 'Role'], ['status', 'Status']].map(([field, label]) => <th key={field} scope="col" aria-sort={sort.field === field ? sort.direction : 'none'}><button onClick={() => sortBy(field)} aria-label={`Sort by ${label.toLowerCase()}`}>{label}<span aria-hidden="true">{sort.field === field ? sort.direction === 'ascending' ? '↑' : '↓' : '↕'}</span></button></th>)}<th scope="col">Actions</th></tr></thead><tbody>{rows.map((user) => <tr key={user.id}><th scope="row"><div className="user-identity"><span className={`user-initials ${user.role === 'Instructor' ? 'is-instructor' : ''}`} aria-hidden="true">{user.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span><strong>{user.name}</strong></div></th><td>{user.email}</td><td>{user.role}</td><td><span className={`admin-status ${user.status === 'Active' ? 'is-active' : ''}`}><span className="user-status-dot" aria-hidden="true" />{user.status}</span></td><td><div className="user-row-actions"><button className="admin-row-link" aria-label={`Edit ${user.name}`} onClick={() => setDialog({ type: 'form', user })}>Edit</button><button className={`admin-row-link ${user.status === 'Active' ? 'user-danger' : ''}`} aria-label={`${user.status === 'Active' ? 'Deactivate' : 'Activate'} ${user.name}`} onClick={() => setDialog({ type: 'status', user })}>{user.status === 'Active' ? 'Deactivate' : 'Activate'}</button></div></td></tr>)}</tbody></table></div> : <div className="user-empty"><span className="user-empty-icon"><Icon name={hasFilters ? 'search' : 'users'} size={28} /></span><h3>{hasFilters ? 'No users found' : 'No users yet'}</h3><p>{hasFilters ? 'Try a different name or email, or clear your filters.' : 'Add your first user to start managing accounts and roles.'}</p><button className="admin-button" onClick={hasFilters ? clearFilters : () => setDialog({ type: 'form' })}>{hasFilters ? 'Clear all filters' : 'Add your first user'}</button></div>}
          <div className="user-pagination"><p>{filtered.length ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filtered.length)} of ${filtered.length} users` : '0 users'}</p><div><label htmlFor="user-page-size">Rows per page</label><select id="user-page-size" value={pageSize} onChange={(event) => filter(setPageSize, Number(event.target.value))}>{[5, 10, 25, 50].map((size) => <option key={size}>{size}</option>)}</select><nav aria-label="User directory pagination"><button className="admin-button" aria-label="Previous page" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1}><Icon name="chevron" className="user-chevron-back" size={16} /></button><span>Page {currentPage} of {pageCount}</span><button className="admin-button" aria-label="Next page" onClick={() => setPage(currentPage + 1)} disabled={currentPage === pageCount}><Icon name="chevron" size={16} /></button></nav></div></div>
        </>}
      </section>
      <div className="user-guidance"><Icon name="shield" size={19} /><p>Keep access current. Deactivate accounts that no longer need access; their records remain in the directory.</p></div>
    </div>
    {dialog?.type === 'form' && <UserFormDialog user={dialog.user} users={users} onClose={() => setDialog(null)} onSaved={saved} />}
    {dialog?.type === 'status' && <UserStatusDialog user={dialog.user} onClose={() => setDialog(null)} onSaved={saved} />}
  </AdminShell>
}
