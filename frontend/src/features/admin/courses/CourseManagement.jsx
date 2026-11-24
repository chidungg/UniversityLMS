import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../../app/AuthContext'
import AdminShell from '../../../components/layout/AdminShell'
import Dialog from '../../../components/ui/Dialog'
import Icon from '../../../components/ui/Icon'
import CourseFormDialog from './CourseFormDialog'
import CourseActionDialog from './CourseActionDialog'
import { courseErrorMessage, getCourseById, linkedClasses, listCourses } from './coursePreview'
import '../admin.css'
import '../users/users.css'
import './courses.css'

function CourseStatus({ status }) {
  return (
    <span className={`admin-status ${status === 'Active' ? 'is-active' : ''}`}>
      <span className="user-status-dot" aria-hidden="true" />
      {status}
    </span>
  )
}

function CourseDetails({ course, authenticated, preview, onClose }) {
  const [detail, setDetail] = useState(course)
  const [loading, setLoading] = useState(!preview)
  const [error, setError] = useState('')
  const classes = preview ? linkedClasses(course.id) : []

  useEffect(() => {
    if (preview) return undefined
    const controller = new AbortController()
    setLoading(true)
    setError('')
    getCourseById(course.id, { signal: controller.signal, authenticated })
      .then((result) => {
        setDetail(result.course)
        setLoading(false)
      })
      .catch((failure) => {
        if (controller.signal.aborted) return
        setError(courseErrorMessage(failure, true))
        setLoading(false)
      })
    return () => controller.abort()
  }, [course.id, authenticated, preview])

  const counts = detail.counts || { enrollments: 0, materials: 0, assignments: 0, quizzes: 0 }

  return (
    <Dialog onDismiss={onClose} aria-labelledby="course-details-title">
      <header className="dialog-header">
        <div>
          <p className="dialog-eyebrow">{preview ? 'COURSE DETAILS · SAMPLE DATA' : 'COURSE DETAILS'}</p>
          <h2 id="course-details-title">{detail.code}</h2>
        </div>
        <button className="dialog-close" aria-label="Close course details" onClick={onClose}>
          <Icon name="close" />
        </button>
      </header>
      <div className="dialog-body user-form course-details">
        {loading ? (
          <div className="user-dialog-loading" role="status" aria-live="polite">
            <Icon name="refresh" size={18} className="admin-spinning" />
            <span>Loading course details…</span>
          </div>
        ) : error ? (
          <div className="user-error-summary" role="alert">
            <strong>Unable to load course details</strong>
            <p>{error}</p>
          </div>
        ) : (
          <>
            <h3>{detail.name}</h3>
            <CourseStatus status={detail.status} />
            <div>
              <h4>Description</h4>
              <p>{detail.description || 'No description provided.'}</p>
            </div>
            {preview ? (
              <div>
                <h4>Linked classes <span className="admin-count">{classes.length}</span></h4>
                {classes.length ? (
                  <ul className="course-linked-classes">
                    {classes.map((item) => <li key={item.id}>{item.code || item.id}</li>)}
                  </ul>
                ) : (
                  <p>No classes are linked to this course yet.</p>
                )}
              </div>
            ) : (
              <div>
                <h4>Linked academic records</h4>
                <dl className="course-counts">
                  <div>
                    <dt>Enrollments</dt>
                    <dd>{counts.enrollments}</dd>
                  </div>
                  <div>
                    <dt>Materials</dt>
                    <dd>{counts.materials}</dd>
                  </div>
                  <div>
                    <dt>Assignments</dt>
                    <dd>{counts.assignments}</dd>
                  </div>
                  <div>
                    <dt>Quizzes</dt>
                    <dd>{counts.quizzes}</dd>
                  </div>
                </dl>
              </div>
            )}
          </>
        )}
      </div>
      <footer className="dialog-actions">
        <button className="secondary-button" onClick={onClose}>Close</button>
      </footer>
    </Dialog>
  )
}

export default function CourseManagement() {
  const { user } = useAuth()
  const authenticated = Boolean(user)
  const [catalog, setCatalog] = useState({ courses: [], preview: !authenticated })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('All statuses')
  const [sort, setSort] = useState({ field: 'code', direction: 'ascending' })
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(10)
  const [dialog, setDialog] = useState(null)
  const [revision, setRevision] = useState(0)
  const addButton = useRef(null)
  const searchRef = useRef(null)
  const focusAfterSave = useRef(false)

  useEffect(() => {
    if (dialog || !focusAfterSave.current) return
    focusAfterSave.current = false
    // Run after the dialog's cleanup: filtering can remove its trigger row.
    if (document.activeElement === document.body || !document.activeElement?.isConnected) {
      addButton.current?.focus()
    }
  }, [dialog])

  useEffect(() => {
    document.title = 'Courses | University LMS'
    const controller = new AbortController()
    listCourses({ signal: controller.signal, authenticated })
      .then((result) => {
        setCatalog({ courses: result.courses, preview: Boolean(result.preview) })
        setLoading(false)
      })
      .catch((failure) => {
        if (controller.signal.aborted) return
        setError(courseErrorMessage(failure, true))
        setLoading(false)
      })
    return () => controller.abort()
  }, [revision, authenticated])

  function refresh() {
    setLoading(true)
    setError('')
    setMessage('')
    setRevision((value) => value + 1)
  }

  function filter(setter, value) { setter(value); setPage(1) }
  function clear() { setQuery(''); setStatus('All statuses'); setPage(1); searchRef.current?.focus() }
  function sortBy(field) {
    setSort({
      field,
      direction: sort.field === field && sort.direction === 'ascending' ? 'descending' : 'ascending',
    })
    setPage(1)
  }
  function saved(result, feedback) {
    focusAfterSave.current = true
    setCatalog({ courses: result.courses, preview: Boolean(result.preview) })
    setMessage(feedback)
    setDialog(null)
  }

  const courses = catalog.courses
  const preview = catalog.preview
  const filtered = courses
    .filter((course) => (
      `${course.code} ${course.name} ${course.description}`.toLowerCase().includes(query.trim().toLowerCase()) &&
      (status === 'All statuses' || course.status === status)
    ))
    .sort((a, b) => a[sort.field].localeCompare(b[sort.field], 'en', { numeric: true, sensitivity: 'base' }) * (sort.direction === 'ascending' ? 1 : -1))
  const pages = Math.max(1, Math.ceil(filtered.length / size))
  const current = Math.min(page, pages)
  const rows = filtered.slice((current - 1) * size, current * size)
  const hasFilters = query !== '' || status !== 'All statuses'

  return (
    <AdminShell path="/admin/courses">
      <div className="user-page course-page">
        <div className="admin-page-heading">
          <div>
            <p className="admin-eyebrow">ADMINISTRATION / ACADEMIC CATALOG</p>
            <h1>Courses</h1>
            <p>Organize your university’s courses and keep the catalog up to date.</p>
          </div>
          <button
            ref={addButton}
            className="admin-button user-primary"
            onClick={() => setDialog({ type: 'form' })}
            disabled={loading || Boolean(error)}
          >
            <span className="user-plus" aria-hidden="true">+</span>
            Add course
          </button>
        </div>

        {preview && (
          <div className="user-preview-notice">
            <span className="admin-sample-label">Sample data</span>
            <p>Changes are saved for this browser tab only. No live academic records are changed.</p>
          </div>
        )}

        <div className="user-feedback" role="status" aria-atomic="true">
          {message && (
            <>
              <Icon name="check" size={18} />
              <span>{message}</span>
              <button onClick={() => setMessage('')} aria-label="Dismiss success message">
                <Icon name="close" size={16} />
              </button>
            </>
          )}
        </div>

        <section className="admin-panel user-directory" aria-labelledby="course-catalog-title">
          <div className="user-directory-heading">
            <div>
              <h2 id="course-catalog-title">
                Course catalog <span className="admin-count">{loading || error ? '—' : courses.length}</span>
              </h2>
              <p>Course information, availability and actions in one place.</p>
            </div>
            <button className="admin-button" onClick={refresh} disabled={loading}>
              <Icon name="refresh" size={16} className={loading ? 'admin-spinning' : ''} />
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>

          <div className="user-filters course-filters">
            <div className="user-field">
              <label htmlFor="course-search">Search courses</label>
              <div className="user-search-control">
                <Icon name="search" size={18} />
                <input
                  ref={searchRef}
                  id="course-search"
                  type="search"
                  value={query}
                  placeholder="Search by code, name or description…"
                  onChange={(event) => filter(setQuery, event.target.value)}
                />
              </div>
            </div>
            <div className="user-field">
              <label htmlFor="course-status-filter">Status</label>
              <select id="course-status-filter" value={status} onChange={(event) => filter(setStatus, event.target.value)}>
                <option>All statuses</option>
                <option>Active</option>
                <option>Inactive</option>
              </select>
            </div>
            <button className="admin-row-link user-clear" onClick={clear} disabled={!hasFilters}>Clear filters</button>
          </div>

          <div className="user-results-summary" role="status" aria-atomic="true">
            {loading
              ? 'Loading the course catalog…'
              : error
                ? 'Catalog unavailable'
                : `${filtered.length} ${filtered.length === 1 ? 'course' : 'courses'}${hasFilters ? ' match your filters' : ' in your catalog'}`}
            <span>Manage courses here · Manage enrollment in Enrollments</span>
          </div>

          {error ? (
            <div className="user-empty" role="alert">
              <Icon name="alert" size={30} />
              <h3>Unable to load courses</h3>
              <p>{error}</p>
              <button className="admin-button" onClick={refresh}>Try again</button>
            </div>
          ) : loading ? (
            <div className="user-skeleton" aria-hidden="true">
              {[0, 1, 2, 3].map((item) => <div key={item}><span /><span /><span /><span /></div>)}
            </div>
          ) : (
            <>
              {rows.length ? (
                <div className="admin-table-scroll">
                  <table className="admin-table user-table course-table">
                    <caption className="sr-only">
                      {preview ? 'University course catalog, sample data' : 'University course catalog'}
                    </caption>
                    <colgroup>
                      <col className="course-col-code" />
                      <col className="course-col-name" />
                      <col className="course-col-description" />
                      <col className="course-col-status" />
                      <col className="course-col-actions" />
                    </colgroup>
                    <thead>
                      <tr>
                        {[['code', 'Course code'], ['name', 'Course name'], ['description', 'Description'], ['status', 'Status']].map(([field, label]) => (
                          <th
                            scope="col"
                            key={field}
                            aria-sort={field === 'description' ? undefined : sort.field === field ? sort.direction : 'none'}
                          >
                            {field === 'description' ? label : (
                              <button onClick={() => sortBy(field)} aria-label={`Sort by ${label.toLowerCase()}`}>
                                {label}
                                <span aria-hidden="true">{sort.field === field ? sort.direction === 'ascending' ? '↑' : '↓' : '↕'}</span>
                              </button>
                            )}
                          </th>
                        ))}
                        <th scope="col">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((course) => {
                        const action = course.status === 'Active' ? 'deactivate' : 'activate'
                        const actionLabel = course.status === 'Active' ? 'Deactivate' : 'Activate'
                        return (
                          <tr key={course.id}>
                            <th scope="row">
                              <button
                                className="admin-row-link course-code"
                                aria-label={`View ${course.code}`}
                                onClick={() => setDialog({ type: 'details', course })}
                              >
                                {course.code}
                              </button>
                            </th>
                            <td className="course-name-cell">{course.name}</td>
                            <td className="course-description-cell">
                              {course.description ? (
                                <>
                                  <p>{course.description.length > 120 ? `${course.description.slice(0, 120).trimEnd()}…` : course.description}</p>
                                  {course.description.length > 120 && (
                                    <button
                                      className="admin-row-link course-read-more"
                                      onClick={() => setDialog({ type: 'details', course })}
                                      aria-label={`Read full description of ${course.code}`}
                                    >
                                      Read more
                                    </button>
                                  )}
                                </>
                              ) : (
                                <span className="course-no-description">No description provided</span>
                              )}
                            </td>
                            <td><CourseStatus status={course.status} /></td>
                            <td>
                              <div className="course-row-actions">
                                <button
                                  className="admin-row-link"
                                  aria-label={`Edit ${course.code}`}
                                  onClick={() => setDialog({ type: 'form', course })}
                                >
                                  Edit
                                </button>
                                <button
                                  className={`admin-row-link ${action === 'deactivate' ? 'user-danger' : ''}`}
                                  aria-label={`${actionLabel} ${course.code}`}
                                  onClick={() => setDialog({ type: action, course })}
                                >
                                  {actionLabel}
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
                  <span className="user-empty-icon"><Icon name={hasFilters ? 'search' : 'book'} size={28} /></span>
                  <h3>{hasFilters ? 'No courses found' : 'No courses yet'}</h3>
                  <p>{hasFilters ? 'Try a different course code or name, or clear your filters.' : 'Add your first course to start building the academic catalog.'}</p>
                  <button className="admin-button" onClick={hasFilters ? clear : () => setDialog({ type: 'form' })}>
                    {hasFilters ? 'Clear all filters' : 'Add your first course'}
                  </button>
                </div>
              )}
              <div className="user-pagination">
                <p>{filtered.length ? `${(current - 1) * size + 1}–${Math.min(current * size, filtered.length)} of ${filtered.length} courses` : '0 courses'}</p>
                <div>
                  <label htmlFor="course-page-size">Rows per page</label>
                  <select id="course-page-size" value={size} onChange={(event) => filter(setSize, Number(event.target.value))}>
                    {[5, 10, 25, 50].map((value) => <option key={value}>{value}</option>)}
                  </select>
                  <nav aria-label="Course catalog pagination">
                    <button
                      className="admin-button"
                      aria-label="Previous page"
                      disabled={current === 1}
                      onClick={() => setPage(current - 1)}
                    >
                      <Icon name="chevron" size={16} className="user-chevron-back" />
                    </button>
                    <span>Page {current} of {pages}</span>
                    <button
                      className="admin-button"
                      aria-label="Next page"
                      disabled={current === pages}
                      onClick={() => setPage(current + 1)}
                    >
                      <Icon name="chevron" size={16} />
                    </button>
                  </nav>
                </div>
              </div>
            </>
          )}
        </section>

        <div className="user-guidance">
          <Icon name="book" size={19} />
          <p>A course defines what is taught. Deactivate courses to preserve their enrollments, learning materials and assessment records.</p>
        </div>
      </div>

      {dialog?.type === 'form' && (
        <CourseFormDialog
          course={dialog.course}
          courses={courses}
          authenticated={authenticated}
          preview={preview}
          onClose={() => setDialog(null)}
          onSaved={saved}
        />
      )}
      {dialog?.type === 'details' && (
        <CourseDetails
          course={dialog.course}
          authenticated={authenticated}
          preview={preview}
          onClose={() => setDialog(null)}
        />
      )}
      {['activate', 'deactivate'].includes(dialog?.type) && (
        <CourseActionDialog
          course={dialog.course}
          action={dialog.type}
          authenticated={authenticated}
          preview={preview}
          onClose={() => setDialog(null)}
          onSaved={saved}
        />
      )}
    </AdminShell>
  )
}
