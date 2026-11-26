import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Dialog from '../../../components/ui/Dialog'
import Icon from '../../../components/ui/Icon'
import ClassFormDialog from './ClassFormDialog'
import ClassActionDialog from './ClassActionDialog'
import { classErrorMessage, listClassWorkspace } from './classPreview'
import { classEnrollmentCount } from './classStore'
import '../admin.css'
import '../users/users.css'
import './classes.css'

function Status({ status }) {
  return (
    <span className={`admin-status ${status === 'Active' ? 'is-active' : ''}`}>
      <span className="user-status-dot" aria-hidden="true" />
      {status}
    </span>
  )
}

function ClassDetails({ item, data, onClose }) {
  const course = data.courses.find((entry) => entry.id === item.courseId)
  const instructor = data.users.find((entry) => entry.id === item.instructorId)
  return (
    <Dialog onDismiss={onClose} aria-labelledby="class-details-title">
      <header className="dialog-header">
        <h2 id="class-details-title">{item.code}</h2>
        <button type="button" className="dialog-close" aria-label="Close class details" onClick={onClose}>
          <Icon name="close" />
        </button>
      </header>
      <div className="dialog-body user-form class-details">
        <div>
          <h3>{course?.name || 'Course unavailable'}</h3>
          <p>{course?.code || '—'}{course?.status === 'Inactive' ? ' · Inactive course' : ''}</p>
        </div>
        <dl>
          <div>
            <dt>Instructor</dt>
            <dd>
              {instructor?.name || (item.instructorId ? 'Instructor unavailable' : 'Not assigned')}
              {instructor && (instructor.status !== 'Active' || instructor.role !== 'Instructor') && (
                <small>Assignment needs review</small>
              )}
            </dd>
          </div>
          <div>
            <dt>Students enrolled</dt>
            <dd>{classEnrollmentCount(item.id)}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd><Status status={item.status} /></dd>
          </div>
        </dl>
      </div>
      <footer className="dialog-actions">
        <button type="button" className="secondary-button" onClick={onClose}>Close</button>
      </footer>
    </Dialog>
  )
}

export default function ClassManagement() {
  const [data, setData] = useState({ classes: [], courses: [], users: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState('')
  const [courseFilter, setCourseFilter] = useState('')
  const [status, setStatus] = useState('All statuses')
  const [sort, setSort] = useState({ field: 'code', direction: 'ascending' })
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(10)
  const [revision, setRevision] = useState(0)
  const [dialog, setDialog] = useState(null)
  const addButton = useRef(null)
  const search = useRef(null)
  const afterSave = useRef(false)

  useEffect(() => {
    document.title = 'Classes | University LMS'
    const controller = new AbortController()
    listClassWorkspace({ signal: controller.signal })
      .then((result) => { setData(result); setLoading(false) })
      .catch((failure) => {
        if (controller.signal.aborted) return
        setError(classErrorMessage(failure, true))
        setLoading(false)
      })
    return () => controller.abort()
  }, [revision])

  useEffect(() => {
    if (dialog || !afterSave.current) return
    afterSave.current = false
    if (document.activeElement === document.body || !document.activeElement?.isConnected) addButton.current?.focus()
  }, [dialog])

  function refresh() { setLoading(true); setError(''); setMessage(''); setRevision((value) => value + 1) }
  function filter(setter, value) { setter(value); setPage(1) }
  function clear() { setQuery(''); setCourseFilter(''); setStatus('All statuses'); setPage(1); search.current?.focus() }
  function sortBy(field) { setSort({ field, direction: sort.field === field && sort.direction === 'ascending' ? 'descending' : 'ascending' }); setPage(1) }
  function saved(classes, feedback) { afterSave.current = true; setData((previous) => ({ ...previous, classes })); setMessage(feedback); setDialog(null) }

  const enriched = data.classes.map((item) => ({
    ...item,
    course: data.courses.find((entry) => entry.id === item.courseId),
    instructor: data.users.find((entry) => entry.id === item.instructorId),
  }))
  const sortValue = (item) => (sort.field === 'course' ? item.course?.name || '' : sort.field === 'instructor' ? item.instructor?.name || '' : item[sort.field])
  const filtered = enriched
    .filter((item) => (
      `${item.code} ${item.course?.code || ''} ${item.course?.name || ''} ${item.instructor?.name || ''}`.toLowerCase().includes(query.trim().toLowerCase()) &&
      (!courseFilter || item.courseId === courseFilter) &&
      (status === 'All statuses' || item.status === status)
    ))
    .sort((a, b) => sortValue(a).localeCompare(sortValue(b), 'en', { numeric: true, sensitivity: 'base' }) * (sort.direction === 'ascending' ? 1 : -1))
  const pages = Math.max(1, Math.ceil(filtered.length / size))
  const current = Math.min(page, pages)
  const rows = filtered.slice((current - 1) * size, current * size)
  const hasFilters = Boolean(query || courseFilter || status !== 'All statuses')
  const hasActiveCourses = data.courses.some((course) => course.status === 'Active')

  return (
    <div className="user-page class-page">
      <div className="admin-page-heading">
        <div className="lms-page-title-row">
          <h1>Classes</h1>
          <span className="admin-count">{loading || error ? '—' : data.classes.length}</span>
        </div>
        <div className="admin-heading-actions">
          <button type="button" className="admin-button" onClick={refresh} disabled={loading}>
            <Icon name="refresh" size={15} className={loading ? 'admin-spinning' : ''} />
            {loading ? 'Loading…' : 'Refresh'}
          </button>
          <button ref={addButton} type="button" className="admin-button user-primary" onClick={() => setDialog({ type: 'form' })} disabled={loading || Boolean(error)}>
            <span className="user-plus" aria-hidden="true">+</span>
            Add class
          </button>
        </div>
      </div>

      <div className="user-preview-notice">
        <span className="admin-sample-label">Sample data</span>
        <p>Changes are saved in this browser tab only.</p>
      </div>

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

      {!loading && !error && !hasActiveCourses && (
        <div className="class-course-required">
          <Icon name="book" size={18} />
          <p>Add or activate a course before creating a class.</p>
          <Link to="/admin/courses">Manage courses<Icon name="arrow" size={15} /></Link>
        </div>
      )}

      <section className="admin-panel user-directory" aria-label="Class directory">
        <div className="user-filters class-filters" style={{ paddingTop: '14px' }}>
          <div className="user-field">
            <label htmlFor="class-search">Search classes</label>
            <div className="user-search-control">
              <Icon name="search" size={16} />
              <input ref={search} id="class-search" type="search" placeholder="Class code, course or instructor…" value={query} onChange={(event) => filter(setQuery, event.target.value)} />
            </div>
          </div>
          <div className="user-field">
            <label htmlFor="class-course-filter">Course</label>
            <select id="class-course-filter" value={courseFilter} onChange={(event) => filter(setCourseFilter, event.target.value)}>
              <option value="">All courses</option>
              {data.courses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.name}</option>)}
            </select>
          </div>
          <div className="user-field">
            <label htmlFor="class-status-filter">Status</label>
            <select id="class-status-filter" value={status} onChange={(event) => filter(setStatus, event.target.value)}>
              <option>All statuses</option>
              <option>Active</option>
              <option>Inactive</option>
            </select>
          </div>
          <button type="button" className="admin-row-link user-clear" onClick={clear} disabled={!hasFilters}>Clear filters</button>
        </div>

        <div className="user-results-summary" role="status" aria-atomic="true">
          {loading ? 'Loading classes…' : error ? 'Directory unavailable' : `${filtered.length} ${filtered.length === 1 ? 'class' : 'classes'}${hasFilters ? ' matching filters' : ''}`}
        </div>

        {error ? (
          <div className="user-empty" role="alert">
            <Icon name="alert" size={26} />
            <h3>Unable to load classes</h3>
            <p>{error}</p>
            <button type="button" className="admin-button" onClick={refresh}>Try again</button>
          </div>
        ) : loading ? (
          <div className="user-skeleton" aria-hidden="true">
            {[0, 1, 2, 3].map((item) => <div key={item}><span /><span /><span /><span /></div>)}
          </div>
        ) : (
          <>
            {rows.length ? (
              <div className="admin-table-scroll">
                <table className="admin-table user-table class-table">
                  <caption className="sr-only">University classes, sample data</caption>
                  <colgroup>
                    <col className="class-col-code" />
                    <col className="class-col-course" />
                    <col className="class-col-instructor" />
                    <col className="class-col-status" />
                    <col className="class-col-actions" />
                  </colgroup>
                  <thead>
                    <tr>
                      {[['code', 'Class code'], ['course', 'Course'], ['instructor', 'Instructor'], ['status', 'Status']].map(([field, label]) => (
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
                    {rows.map((item) => (
                      <tr key={item.id}>
                        <th scope="row">
                          <button type="button" className="admin-row-link class-code" aria-label={`View ${item.code}`} onClick={() => setDialog({ type: 'details', item })}>
                            {item.code}
                          </button>
                        </th>
                        <td>
                          <strong className="class-course-name">{item.course?.name || 'Course unavailable'}</strong>
                          <span className="class-cell-note">{item.course?.code || '—'}{item.course?.status === 'Inactive' ? ' · Inactive course' : ''}</span>
                        </td>
                        <td>
                          {item.instructor ? (
                            <>
                              {item.instructor.name}
                              {(item.instructor.role !== 'Instructor' || item.instructor.status !== 'Active') && (
                                <span className="class-cell-note">Assignment needs review</span>
                              )}
                            </>
                          ) : (
                            <span className="class-unassigned">{item.instructorId ? 'Instructor unavailable' : 'Not assigned'}</span>
                          )}
                        </td>
                        <td><Status status={item.status} /></td>
                        <td>
                          <div className="class-row-actions">
                            <button type="button" className="admin-row-link" aria-label={`Edit ${item.code}`} onClick={() => setDialog({ type: 'form', item })}>Edit</button>
                            <button type="button" className="admin-row-link" aria-label={`${item.status === 'Active' ? 'Deactivate' : 'Activate'} ${item.code}`} onClick={() => setDialog({ type: item.status === 'Active' ? 'deactivate' : 'activate', item })}>
                              {item.status === 'Active' ? 'Deactivate' : 'Activate'}
                            </button>
                            <button type="button" className="admin-row-link user-danger" aria-label={`Delete ${item.code}`} onClick={() => setDialog({ type: 'delete', item })}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="user-empty">
                <span className="user-empty-icon"><Icon name={hasFilters ? 'search' : 'classes'} size={24} /></span>
                <h3>{hasFilters ? 'No classes found' : 'No classes yet'}</h3>
                <p>{hasFilters ? 'Try another search term or clear filters.' : 'Create your first class for an existing course.'}</p>
                <button type="button" className="admin-button" onClick={hasFilters ? clear : () => setDialog({ type: 'form' })}>
                  {hasFilters ? 'Clear all filters' : 'Add your first class'}
                </button>
              </div>
            )}
            <div className="user-pagination">
              <p>{filtered.length ? `${(current - 1) * size + 1}–${Math.min(current * size, filtered.length)} of ${filtered.length} classes` : '0 classes'}</p>
              <div>
                <label htmlFor="class-page-size">Rows per page</label>
                <select id="class-page-size" value={size} onChange={(event) => filter(setSize, Number(event.target.value))}>
                  {[5, 10, 25, 50].map((value) => <option key={value}>{value}</option>)}
                </select>
                <nav aria-label="Class directory pagination">
                  <button type="button" className="admin-button" aria-label="Previous page" disabled={current === 1} onClick={() => setPage(current - 1)}>
                    <Icon name="chevron" size={15} className="user-chevron-back" />
                  </button>
                  <span>Page {current} of {pages}</span>
                  <button type="button" className="admin-button" aria-label="Next page" disabled={current === pages} onClick={() => setPage(current + 1)}>
                    <Icon name="chevron" size={15} />
                  </button>
                </nav>
              </div>
            </div>
          </>
        )}
      </section>

      {dialog?.type === 'form' && <ClassFormDialog item={dialog.item} data={data} onClose={() => setDialog(null)} onSaved={saved} />}
      {dialog?.type === 'details' && <ClassDetails item={dialog.item} data={data} onClose={() => setDialog(null)} />}
      {['activate', 'deactivate', 'delete'].includes(dialog?.type) && (
        <ClassActionDialog
          item={dialog.item}
          course={data.courses.find((course) => course.id === dialog.item.courseId)}
          action={dialog.type}
          onClose={() => setDialog(null)}
          onSaved={saved}
        />
      )}
    </div>
  )
}
