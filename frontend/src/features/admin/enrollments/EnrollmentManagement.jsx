import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../../app/AuthContext'
import Icon from '../../../components/ui/Icon'
import EnrollStudentDialog from './EnrollStudentDialog'
import AssignInstructorDialog from './AssignInstructorDialog'
import EnrollmentActionDialog from './EnrollmentActionDialog'
import { enrollmentErrorMessage, getEnrollmentDetail, listEnrollmentWorkspace } from './enrollmentPreview'
import '../admin.css'
import '../users/users.css'
import './enrollments.css'

function Status({ status }) {
  return (
    <span className={`admin-status ${status === 'Active' ? 'is-active' : ''}`}>
      <span className="user-status-dot" aria-hidden="true" />
      {status}
    </span>
  )
}

function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

function readInitialSelectedId() {
  const params = new URLSearchParams(window.location.search)
  return params.get('courseId') || params.get('classId') || ''
}

export default function EnrollmentManagement() {
  const { user } = useAuth()
  const authenticated = Boolean(user)
  const initialSelectedId = useRef(readInitialSelectedId())
  const [workspace, setWorkspace] = useState({
    preview: !authenticated,
    items: [],
    selectedItem: null,
    instructor: null,
    enrollments: [],
  })
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All statuses')
  const [sort, setSort] = useState({ field: 'name', direction: 'ascending' })
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(10)
  const [revision, setRevision] = useState(0)
  const [dialog, setDialog] = useState(null)
  const enrollButton = useRef(null)
  const assignButton = useRef(null)
  const searchRef = useRef(null)
  const restoreTarget = useRef(null)
  const selectRequest = useRef(null)

  useEffect(() => {
    document.title = 'Enrollment & assignment | University LMS'
    const controller = new AbortController()
    selectRequest.current?.abort()
    listEnrollmentWorkspace({
      signal: controller.signal,
      authenticated,
      selectedId: initialSelectedId.current,
    })
      .then((result) => {
        setWorkspace(result)
        if (result.selectedItem?.id) {
          initialSelectedId.current = result.selectedItem.id
        }
        setLoading(false)
        setSwitching(false)
      })
      .catch((failure) => {
        if (controller.signal.aborted) return
        setError(enrollmentErrorMessage(failure, true))
        setLoading(false)
        setSwitching(false)
      })
    return () => {
      controller.abort()
      selectRequest.current?.abort()
    }
  }, [revision, authenticated])

  useEffect(() => {
    if (dialog || !restoreTarget.current) return
    const target = restoreTarget.current
    restoreTarget.current = null
    if (document.activeElement === document.body || !document.activeElement?.isConnected) {
      target.current?.focus()
    }
  }, [dialog])

  const preview = workspace.preview
  const items = workspace.items
  const selectedItem = workspace.selectedItem
  const assignedInstructor = workspace.instructor
  const isInactive = selectedItem?.status === 'Inactive'
  const instructorNeedsReview = Boolean(
    selectedItem?.instructorId &&
    (!assignedInstructor || assignedInstructor.role !== 'Instructor' || assignedInstructor.status !== 'Active'),
  )

  const roster = workspace.enrollments.map((entry) => ({
    ...entry,
    user: entry.student,
    name: entry.student?.name || 'Account unavailable',
    email: entry.student?.email || entry.studentId,
    status: entry.student?.status || 'Inactive',
    role: entry.student?.role || 'Unavailable',
  }))

  const filteredStudents = roster
    .filter((entry) => {
      const matchesQuery = `${entry.name} ${entry.email}`.toLowerCase().includes(query.trim().toLowerCase())
      const matchesStatus = statusFilter === 'All statuses' || entry.status === statusFilter
      return matchesQuery && matchesStatus
    })
    .sort((a, b) => a[sort.field].localeCompare(b[sort.field], 'en', { sensitivity: 'base' }) * (sort.direction === 'ascending' ? 1 : -1))

  const pages = Math.max(1, Math.ceil(filteredStudents.length / size))
  const currentPage = Math.min(page, pages)
  const rows = filteredStudents.slice((currentPage - 1) * size, currentPage * size)
  const hasFilters = Boolean(query || statusFilter !== 'All statuses')

  function refresh() {
    if (selectedItem?.id) {
      initialSelectedId.current = selectedItem.id
    }
    setLoading(true)
    setError('')
    setMessage('')
    setRevision((value) => value + 1)
  }

  async function selectCourseOrClass(nextId) {
    initialSelectedId.current = nextId
    setQuery('')
    setStatusFilter('All statuses')
    setPage(1)
    setMessage('')
    setError('')

    const url = new URL(window.location.href)
    if (preview) {
      url.searchParams.delete('courseId')
      if (nextId) url.searchParams.set('classId', nextId)
      else url.searchParams.delete('classId')
    } else {
      url.searchParams.delete('classId')
      if (nextId) url.searchParams.set('courseId', nextId)
      else url.searchParams.delete('courseId')
    }
    window.history.replaceState(null, '', url)

    if (!nextId) return
    selectRequest.current?.abort()
    const controller = new AbortController()
    selectRequest.current = controller
    setSwitching(true)
    try {
      const result = await getEnrollmentDetail(nextId, { signal: controller.signal, authenticated })
      setWorkspace(result)
      setSwitching(false)
    } catch (failure) {
      if (controller.signal.aborted) return
      setError(enrollmentErrorMessage(failure, true))
      setSwitching(false)
    }
  }

  function filter(setter, value) { setter(value); setPage(1) }
  function clearFilters() { setQuery(''); setStatusFilter('All statuses'); setPage(1); searchRef.current?.focus() }
  function sortBy(field) {
    setSort({
      field,
      direction: sort.field === field && sort.direction === 'ascending' ? 'descending' : 'ascending',
    })
    setPage(1)
  }

  function handleSaved(result, feedback, focusRef) {
    restoreTarget.current = focusRef
    setWorkspace(result)
    if (result.selectedItem?.id) {
      initialSelectedId.current = result.selectedItem.id
    }
    setMessage(feedback)
    setDialog(null)
  }

  const unitSingular = preview ? 'class' : 'course'
  const managePath = preview ? '/admin/classes' : '/admin/courses'
  const manageLabel = preview ? 'Manage classes' : 'Manage courses'

  return (
    <div className="user-page enroll-page">
      <div className="admin-page-heading">
        <h1>Enrollment &amp; assignment</h1>
        <button
          ref={enrollButton}
          type="button"
          className="admin-button user-primary"
          onClick={() => setDialog({ type: 'enroll' })}
          disabled={loading || switching || Boolean(error) || !selectedItem || isInactive}
        >
          <span className="user-plus" aria-hidden="true">+</span>
          Enroll student
        </button>
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

      {error ? (
        <section className="admin-panel user-directory" aria-label="Enrollment workspace error">
          <div className="user-empty" role="alert">
            <Icon name="alert" size={26} />
            <h3>Unable to load enrollments</h3>
            <p>{error}</p>
            <button type="button" className="admin-button" onClick={refresh}>Try again</button>
          </div>
        </section>
      ) : loading ? (
        <div className="enroll-workspace" aria-busy="true">
          <section className="admin-panel enroll-skeleton-panel" aria-hidden="true">
            <div className="enroll-skeleton-bar" />
            <div className="enroll-skeleton-bar" />
          </section>
          <section className="admin-panel user-directory" aria-hidden="true">
            <div className="user-skeleton">{[0, 1, 2, 3].map((row) => <div key={row}><span /><span /><span /><span /></div>)}</div>
          </section>
        </div>
      ) : !selectedItem ? (
        <section className="admin-panel user-directory" aria-label={`No ${unitSingular}s available`}>
          <div className="user-empty">
            <span className="user-empty-icon"><Icon name={preview ? 'classes' : 'book'} size={24} /></span>
            <h3>{preview ? 'No classes available' : 'No courses available'}</h3>
            <p>
              {preview
                ? 'Create a class before assigning an instructor or enrolling students.'
                : 'Create a course in Courses before assigning an instructor or enrolling students.'}
            </p>
            <Link className="admin-button user-primary" to={managePath}>{manageLabel}</Link>
          </div>
        </section>
      ) : (
        <div className="enroll-workspace" aria-busy={switching}>
          <div className="enroll-top-grid">
            <section className="admin-panel enroll-context-panel" aria-label={preview ? 'Class selection' : 'Course selection'}>
              <div className="enroll-context-top">
                <div className="user-field">
                  <label htmlFor="enroll-class-select">{preview ? 'Select class' : 'Select course'}</label>
                  <select
                    id="enroll-class-select"
                    value={selectedItem.id}
                    disabled={switching}
                    onChange={(event) => selectCourseOrClass(event.target.value)}
                  >
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.code} — {item.name}{item.status === 'Inactive' ? ' (Inactive)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <button type="button" className="admin-button" onClick={refresh} disabled={loading || switching}>
                  <Icon name="refresh" size={15} className={switching ? 'admin-spinning' : ''} />
                  {switching ? 'Loading…' : 'Refresh'}
                </button>
              </div>
              <dl className="enroll-meta" aria-label={`Selected ${unitSingular} summary`}>
                <div className="enroll-meta-item">
                  <dt>Status:</dt>
                  <dd><Status status={selectedItem.status} /></dd>
                </div>
                <div className="enroll-meta-item">
                  <dt>Enrolled:</dt>
                  <dd>{roster.length} {roster.length === 1 ? 'student' : 'students'}</dd>
                </div>
              </dl>
            </section>

            <section className="admin-panel enroll-instructor-panel" aria-labelledby="enroll-instructor-title">
              <div className="enroll-instructor-header">
                <h2 id="enroll-instructor-title">Assigned instructor</h2>
                <div className="enroll-instructor-actions">
                  <button
                    ref={assignButton}
                    type="button"
                    className="admin-button"
                    disabled={isInactive || switching}
                    onClick={() => setDialog({ type: 'assign' })}
                  >
                    {selectedItem.instructorId ? 'Change instructor' : 'Assign instructor'}
                  </button>
                  {selectedItem.instructorId && (
                    <button
                      type="button"
                      className="admin-row-link user-danger"
                      disabled={switching}
                      aria-label={`Unassign ${assignedInstructor?.name || 'instructor'} from ${selectedItem.code}`}
                      onClick={() => setDialog({ type: 'unassign', person: assignedInstructor, personId: selectedItem.instructorId })}
                    >
                      Unassign
                    </button>
                  )}
                </div>
              </div>
              <div className="enroll-instructor-card">
                {selectedItem.instructorId ? (
                  <div className="enroll-instructor-person">
                    <span className="user-initials is-instructor" aria-hidden="true">
                      {assignedInstructor ? initials(assignedInstructor.name) : '?'}
                    </span>
                    <div className="enroll-instructor-details">
                      <div className="enroll-instructor-name-row">
                        <strong>{assignedInstructor?.name || 'Instructor account unavailable'}</strong>
                        {assignedInstructor && <Status status={assignedInstructor.status} />}
                      </div>
                      <span>{assignedInstructor?.email || selectedItem.instructorId}</span>
                      {instructorNeedsReview && (
                        <div className="enroll-warning-note">
                          <Icon name="alert" size={14} />
                          <span>Assignment needs review</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="enroll-instructor-person">
                    <span className="enroll-unassigned-icon" aria-hidden="true"><Icon name="instructor" size={18} /></span>
                    <div className="enroll-instructor-details">
                      <strong>No instructor assigned</strong>
                      <span>Select Assign instructor to add teaching staff.</span>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>

          {isInactive && (
            <div className="enroll-inactive-notice" role="status">
              <Icon name="alert" size={18} />
              <p>
                {selectedItem.code} is inactive. New assignments and enrollments are disabled until activated.
              </p>
              <Link to={managePath}>{manageLabel}<Icon name="arrow" size={14} /></Link>
            </div>
          )}

          <section className="admin-panel user-directory enroll-directory" aria-labelledby="enroll-roster-title">
            <div className="user-directory-heading">
              <h2 id="enroll-roster-title">
                Enrolled students <span className="admin-count">{roster.length}</span>
              </h2>
            </div>

            <div className="user-filters enroll-filters">
              <div className="user-field">
                <label htmlFor="enroll-student-filter">Search enrolled students</label>
                <div className="user-search-control">
                  <Icon name="search" size={16} />
                  <input
                    ref={searchRef}
                    id="enroll-student-filter"
                    type="search"
                    placeholder="Search by student name or email…"
                    value={query}
                    onChange={(event) => filter(setQuery, event.target.value)}
                  />
                </div>
              </div>
              <div className="user-field">
                <label htmlFor="enroll-status-filter">Account status</label>
                <select
                  id="enroll-status-filter"
                  value={statusFilter}
                  onChange={(event) => filter(setStatusFilter, event.target.value)}
                >
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
              {`${filteredStudents.length} ${filteredStudents.length === 1 ? 'student' : 'students'}${hasFilters ? ' matching filters' : ` enrolled in ${selectedItem.code}`}`}
            </div>

            {rows.length ? (
              <div className="admin-table-scroll">
                <table className="admin-table user-table enroll-table">
                  <caption className="sr-only">
                    Enrolled students in {selectedItem.code} ({selectedItem.name}){preview ? ', sample data' : ''}
                  </caption>
                  <colgroup>
                    <col className="enroll-col-student" />
                    <col className="enroll-col-email" />
                    <col className="enroll-col-status" />
                    <col className="enroll-col-actions" />
                  </colgroup>
                  <thead>
                    <tr>
                      {[['name', 'Student'], ['email', 'Email'], ['status', 'Account status']].map(([field, label]) => (
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
                    {rows.map((entry) => (
                      <tr key={entry.studentId}>
                        <th scope="row">
                          <div className="user-identity">
                            <span className="user-initials" aria-hidden="true">
                              {entry.user ? initials(entry.user.name) : '?'}
                            </span>
                            <div>
                              <strong>{entry.name}</strong>
                              {(!entry.user || entry.user.role !== 'Student') && (
                                <span className="enroll-student-note">
                                  {entry.user ? `Role changed (${entry.user.role})` : 'Account missing'}
                                </span>
                              )}
                            </div>
                          </div>
                        </th>
                        <td>{entry.email}</td>
                        <td><Status status={entry.status} /></td>
                        <td>
                          <div className="user-row-actions">
                            <button
                              type="button"
                              className="admin-row-link user-danger"
                              disabled={switching}
                              aria-label={`Unenroll ${entry.name} from ${selectedItem.code}`}
                              onClick={() => setDialog({ type: 'unenroll', person: entry.user, personId: entry.studentId })}
                            >
                              Unenroll
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="user-empty">
                <span className="user-empty-icon"><Icon name={hasFilters ? 'search' : 'enroll'} size={24} /></span>
                <h3>{hasFilters ? 'No matching students' : 'No students enrolled yet'}</h3>
                <p>
                  {hasFilters
                    ? 'Try another search term or clear filters.'
                    : isInactive
                      ? `Activate ${selectedItem.code} before enrolling students.`
                      : `Enroll students to grant access to ${selectedItem.code}.`}
                </p>
                {hasFilters ? (
                  <button type="button" className="admin-button" onClick={clearFilters}>Clear all filters</button>
                ) : !isInactive ? (
                  <button type="button" className="admin-button" onClick={() => setDialog({ type: 'enroll' })}>Enroll first student</button>
                ) : (
                  <Link className="admin-button" to={managePath}>{manageLabel}</Link>
                )}
              </div>
            )}

            <div className="user-pagination">
              <p>
                {filteredStudents.length
                  ? `${(currentPage - 1) * size + 1}–${Math.min(currentPage * size, filteredStudents.length)} of ${filteredStudents.length} ${filteredStudents.length === 1 ? 'student' : 'students'}`
                  : '0 students'}
              </p>
              <div>
                <label htmlFor="enroll-page-size">Rows per page</label>
                <select
                  id="enroll-page-size"
                  value={size}
                  onChange={(event) => filter(setSize, Number(event.target.value))}
                >
                  {[5, 10, 25, 50].map((value) => <option key={value}>{value}</option>)}
                </select>
                <nav aria-label="Enrolled students pagination">
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
          </section>
        </div>
      )}

      {dialog?.type === 'enroll' && selectedItem && (
        <EnrollStudentDialog
          selectedItem={selectedItem}
          authenticated={authenticated}
          preview={preview}
          onClose={() => setDialog(null)}
          onSaved={(result, feedback) => handleSaved(result, feedback, enrollButton)}
        />
      )}
      {dialog?.type === 'assign' && selectedItem && (
        <AssignInstructorDialog
          selectedItem={selectedItem}
          currentInstructor={assignedInstructor}
          authenticated={authenticated}
          preview={preview}
          onClose={() => setDialog(null)}
          onSaved={(result, feedback) => handleSaved(result, feedback, assignButton)}
        />
      )}
      {(dialog?.type === 'unenroll' || dialog?.type === 'unassign') && selectedItem && (
        <EnrollmentActionDialog
          action={dialog.type}
          selectedItem={selectedItem}
          person={dialog.person}
          personId={dialog.personId}
          authenticated={authenticated}
          preview={preview}
          onClose={() => setDialog(null)}
          onSaved={(result, feedback) => handleSaved(result, feedback, dialog.type === 'unenroll' ? enrollButton : assignButton)}
        />
      )}
    </div>
  )
}
