import { useEffect, useRef, useState } from 'react'
import AdminShell from '../../../components/layout/AdminShell'
import Icon from '../../../components/ui/Icon'
import EnrollStudentDialog from './EnrollStudentDialog'
import AssignInstructorDialog from './AssignInstructorDialog'
import EnrollmentActionDialog from './EnrollmentActionDialog'
import { enrollmentErrorMessage, listEnrollmentWorkspace } from './enrollmentPreview'
import '../admin.css'
import '../users/users.css'
import './enrollments.css'

function Status({ status }) {
  return <span className={`admin-status ${status === 'Active' ? 'is-active' : ''}`}><span className="user-status-dot" aria-hidden="true" />{status}</span>
}

function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

function readInitialClassId() {
  return new URLSearchParams(window.location.search).get('classId') || ''
}

export default function EnrollmentManagement() {
  const [data, setData] = useState({ classes: [], courses: [], users: [], enrollments: [] })
  const [selectedClassId, setSelectedClassId] = useState(readInitialClassId)
  const [loading, setLoading] = useState(true)
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

  useEffect(() => {
    document.title = 'Enrollment & assignment | University LMS'
    const controller = new AbortController()
    listEnrollmentWorkspace({ signal: controller.signal })
      .then((result) => { setData(result); setLoading(false) })
      .catch((failure) => {
        if (controller.signal.aborted) return
        setError(enrollmentErrorMessage(failure, true))
        setLoading(false)
      })
    return () => controller.abort()
  }, [revision])

  useEffect(() => {
    if (dialog || !restoreTarget.current) return
    const target = restoreTarget.current
    restoreTarget.current = null
    if (document.activeElement === document.body || !document.activeElement?.isConnected) {
      target.current?.focus()
    }
  }, [dialog])

  const selectedClass = data.classes.find((item) => item.id === selectedClassId)
    || data.classes.find((item) => item.status === 'Active')
    || data.classes[0]
    || null
  const selectedCourse = selectedClass ? data.courses.find((course) => course.id === selectedClass.courseId) : null
  const assignedInstructor = selectedClass?.instructorId ? data.users.find((user) => user.id === selectedClass.instructorId) : null
  const instructorNeedsReview = Boolean(
    selectedClass?.instructorId && (!assignedInstructor || assignedInstructor.role !== 'Instructor' || assignedInstructor.status !== 'Active')
  )
  const classIsInactive = selectedClass?.status === 'Inactive'

  const classEnrollments = selectedClass
    ? data.enrollments
        .filter((entry) => entry.classId === selectedClass.id)
        .map((entry) => {
          const user = data.users.find((item) => item.id === entry.studentId)
          return {
            ...entry,
            user,
            name: user?.name || 'Account unavailable',
            email: user?.email || entry.studentId,
            status: user?.status || 'Inactive',
            role: user?.role || 'Unavailable',
          }
        })
    : []

  const filteredStudents = classEnrollments
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
    setLoading(true)
    setError('')
    setMessage('')
    setRevision((value) => value + 1)
  }

  function selectClass(nextId) {
    setSelectedClassId(nextId)
    setQuery('')
    setStatusFilter('All statuses')
    setPage(1)
    setMessage('')
    const url = new URL(window.location.href)
    if (nextId) url.searchParams.set('classId', nextId)
    else url.searchParams.delete('classId')
    window.history.replaceState(null, '', url)
  }

  function filter(setter, value) { setter(value); setPage(1) }
  function clearFilters() { setQuery(''); setStatusFilter('All statuses'); setPage(1); searchRef.current?.focus() }
  function sortBy(field) { setSort({ field, direction: sort.field === field && sort.direction === 'ascending' ? 'descending' : 'ascending' }); setPage(1) }

  function handleSaved(result, feedback, focusRef) {
    restoreTarget.current = focusRef
    setData((previous) => ({
      classes: result.classes || previous.classes,
      courses: result.courses || previous.courses,
      users: result.users || previous.users,
      enrollments: result.enrollments || previous.enrollments,
    }))
    setMessage(feedback)
    setDialog(null)
  }

  return <AdminShell path="/admin/enrollments">
    <div className="user-page enroll-page">
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">ADMINISTRATION / ENROLLMENT & ASSIGNMENT</p>
          <h1>Enrollment & assignment</h1>
          <p>Select a class to assign its instructor and manage enrolled students.</p>
        </div>
        <button
          ref={enrollButton}
          className="admin-button user-primary"
          onClick={() => setDialog({ type: 'enroll' })}
          disabled={loading || Boolean(error) || !selectedClass || classIsInactive}
        >
          <span className="user-plus" aria-hidden="true">+</span>Enroll student
        </button>
      </div>

      <div className="user-preview-notice">
        <span className="admin-sample-label">Sample data</span>
        <p>Changes are saved for this browser tab only. No live academic records are changed.</p>
      </div>

      <div className="user-feedback" role="status" aria-atomic="true">
        {message && <>
          <Icon name="check" size={18} />
          <span>{message}</span>
          <button aria-label="Dismiss success message" onClick={() => setMessage('')}><Icon name="close" size={16} /></button>
        </>}
      </div>

      {error ? (
        <section className="admin-panel user-directory" aria-label="Enrollment workspace error">
          <div className="user-empty" role="alert">
            <Icon name="alert" size={30} />
            <h3>Unable to load enrollments</h3>
            <p>{error}</p>
            <button className="admin-button" onClick={refresh}>Try again</button>
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
      ) : !selectedClass ? (
        <section className="admin-panel user-directory" aria-label="No classes available">
          <div className="user-empty">
            <span className="user-empty-icon"><Icon name="classes" size={28} /></span>
            <h3>No classes available</h3>
            <p>Create a class before assigning an instructor or enrolling students.</p>
            <a className="admin-button user-primary" href="/admin/classes">Manage classes</a>
          </div>
        </section>
      ) : (
        <div className="enroll-workspace">
          <section className="admin-panel enroll-context-panel" aria-label="Class selection">
            <div className="enroll-context-grid">
              <div className="user-field">
                <label htmlFor="enroll-class-select">Select class</label>
                <select
                  id="enroll-class-select"
                  value={selectedClass.id}
                  onChange={(event) => selectClass(event.target.value)}
                >
                  {data.classes.map((item) => {
                    const course = data.courses.find((entry) => entry.id === item.courseId)
                    return <option key={item.id} value={item.id}>
                      {item.code} — {course ? course.name : 'Course unavailable'}{item.status === 'Inactive' ? ' (Inactive)' : ''}
                    </option>
                  })}
                </select>
              </div>
              <dl className="enroll-meta" aria-label="Selected class summary">
                <div className="enroll-meta-item">
                  <dt>Course</dt>
                  <dd>
                    {selectedCourse ? <>{selectedCourse.name} <span className="enroll-meta-code">({selectedCourse.code})</span></> : 'Course unavailable'}
                  </dd>
                </div>
                <div className="enroll-meta-item">
                  <dt>Status</dt>
                  <dd><Status status={selectedClass.status} /></dd>
                </div>
                <div className="enroll-meta-item">
                  <dt>Enrolled</dt>
                  <dd>{classEnrollments.length} {classEnrollments.length === 1 ? 'student' : 'students'}</dd>
                </div>
              </dl>
              <div className="enroll-context-actions">
                <button className="admin-button" onClick={refresh} disabled={loading}>
                  <Icon name="refresh" size={16} />Refresh
                </button>
              </div>
            </div>
          </section>

          {classIsInactive && (
            <div className="enroll-inactive-notice" role="status">
              <Icon name="alert" size={20} />
              <p>{selectedClass.code} is inactive. Existing assignments and enrollments remain visible, and you can remove records, but new assignments and enrollments are disabled until the class is activated.</p>
              <a href="/admin/classes">Manage classes<Icon name="arrow" size={15} /></a>
            </div>
          )}

          <section className="admin-panel enroll-instructor-panel" aria-labelledby="enroll-instructor-title">
            <div className="enroll-instructor-header">
              <div>
                <h2 id="enroll-instructor-title">Assigned instructor</h2>
                <p>Teaching staff responsible for {selectedClass.code}.</p>
              </div>
            </div>
            <div className="enroll-instructor-card">
              {selectedClass.instructorId ? (
                <div className="enroll-instructor-person">
                  <span className="user-initials is-instructor" aria-hidden="true">
                    {assignedInstructor ? initials(assignedInstructor.name) : '?'}
                  </span>
                  <div className="enroll-instructor-details">
                    <div className="enroll-instructor-name-row">
                      <strong>{assignedInstructor?.name || 'Instructor account unavailable'}</strong>
                      {assignedInstructor && <Status status={assignedInstructor.status} />}
                    </div>
                    <span>{assignedInstructor?.email || selectedClass.instructorId}</span>
                    {instructorNeedsReview && (
                      <div className="enroll-warning-note">
                        <Icon name="alert" size={15} />
                        <span>Assignment needs review — this account is unavailable, inactive or no longer an Instructor.</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="enroll-instructor-person">
                  <span className="enroll-unassigned-icon" aria-hidden="true"><Icon name="instructor" size={20} /></span>
                  <div className="enroll-instructor-details">
                    <strong>No instructor assigned</strong>
                    <span>Assign an active instructor so teaching staff can manage {selectedClass.code}.</span>
                  </div>
                </div>
              )}
              <div className="enroll-instructor-actions">
                <button
                  ref={assignButton}
                  className="admin-button"
                  disabled={classIsInactive}
                  onClick={() => setDialog({ type: 'assign' })}
                >
                  {selectedClass.instructorId ? 'Change instructor' : 'Assign instructor'}
                </button>
                {selectedClass.instructorId && (
                  <button
                    className="admin-row-link user-danger"
                    aria-label={`Unassign ${assignedInstructor?.name || 'instructor'} from ${selectedClass.code}`}
                    onClick={() => setDialog({ type: 'unassign', person: assignedInstructor, personId: selectedClass.instructorId })}
                  >
                    Unassign
                  </button>
                )}
              </div>
            </div>
          </section>

          <section className="admin-panel user-directory enroll-directory" aria-labelledby="enroll-roster-title">
            <div className="user-directory-heading">
              <div>
                <h2 id="enroll-roster-title">
                  Enrolled students <span className="admin-count">{classEnrollments.length}</span>
                </h2>
                <p>Students enrolled in {selectedClass.code}{selectedCourse ? ` · ${selectedCourse.name}` : ''}.</p>
              </div>
            </div>

            <div className="user-filters enroll-filters">
              <div className="user-field">
                <label htmlFor="enroll-student-filter">Search enrolled students</label>
                <div className="user-search-control">
                  <Icon name="search" size={18} />
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
              <button className="admin-row-link user-clear" onClick={clearFilters} disabled={!hasFilters}>
                Clear filters
              </button>
            </div>

            <div className="user-results-summary" role="status" aria-atomic="true">
              {`${filteredStudents.length} ${filteredStudents.length === 1 ? 'student' : 'students'}${hasFilters ? ' match your filters' : ` enrolled in ${selectedClass.code}`}`}
              <span>One enrollment per student per class</span>
            </div>

            {rows.length ? (
              <div className="admin-table-scroll">
                <table className="admin-table user-table enroll-table">
                  <caption className="sr-only">
                    Enrolled students in {selectedClass.code} ({selectedCourse?.name || 'Course unavailable'}), sample data
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
                          <button onClick={() => sortBy(field)} aria-label={`Sort by ${label.toLowerCase()}`}>
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
                              className="admin-row-link user-danger"
                              aria-label={`Unenroll ${entry.name} from ${selectedClass.code}`}
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
                <span className="user-empty-icon"><Icon name={hasFilters ? 'search' : 'enroll'} size={28} /></span>
                <h3>{hasFilters ? 'No matching students' : 'No students enrolled yet'}</h3>
                <p>
                  {hasFilters
                    ? 'Try another student name or email, or clear your filters.'
                    : classIsInactive
                      ? `Activate ${selectedClass.code} in Classes before enrolling students.`
                      : `Enroll active students to give them access to ${selectedClass.code}.`}
                </p>
                {hasFilters ? (
                  <button className="admin-button" onClick={clearFilters}>Clear all filters</button>
                ) : !classIsInactive ? (
                  <button className="admin-button" onClick={() => setDialog({ type: 'enroll' })}>Enroll first student</button>
                ) : (
                  <a className="admin-button" href="/admin/classes">Manage classes</a>
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
                    className="admin-button"
                    aria-label="Previous page"
                    disabled={currentPage === 1}
                    onClick={() => setPage(currentPage - 1)}
                  >
                    <Icon name="chevron" size={16} className="user-chevron-back" />
                  </button>
                  <span>Page {currentPage} of {pages}</span>
                  <button
                    className="admin-button"
                    aria-label="Next page"
                    disabled={currentPage === pages}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    <Icon name="chevron" size={16} />
                  </button>
                </nav>
              </div>
            </div>
          </section>
        </div>
      )}

      <div className="user-guidance">
        <Icon name="enroll" size={19} />
        <p>Manage class rosters and teaching assignments here. Changes synchronize with Overview and Classes in this preview.</p>
      </div>
    </div>

    {dialog?.type === 'enroll' && selectedClass && (
      <EnrollStudentDialog
        classItem={selectedClass}
        course={selectedCourse}
        users={data.users}
        enrollments={data.enrollments}
        onClose={() => setDialog(null)}
        onSaved={(result, feedback) => handleSaved(result, feedback, enrollButton)}
      />
    )}
    {dialog?.type === 'assign' && selectedClass && (
      <AssignInstructorDialog
        classItem={selectedClass}
        course={selectedCourse}
        currentInstructor={assignedInstructor}
        users={data.users}
        onClose={() => setDialog(null)}
        onSaved={(result, feedback) => handleSaved(result, feedback, assignButton)}
      />
    )}
    {(dialog?.type === 'unenroll' || dialog?.type === 'unassign') && selectedClass && (
      <EnrollmentActionDialog
        action={dialog.type}
        classItem={selectedClass}
        course={selectedCourse}
        person={dialog.person}
        personId={dialog.personId}
        onClose={() => setDialog(null)}
        onSaved={(result, feedback) => handleSaved(result, feedback, dialog.type === 'unenroll' ? enrollButton : assignButton)}
      />
    )}
  </AdminShell>
}
