import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Users,
  GraduationCap,
  BookOpen,
  UserCheck,
  KeyRound,
  BarChart3,
  ArrowRight,
  AlertCircle,
  RefreshCw,
  Search,
  X,
  ChevronRight,
} from 'lucide-react'
import { adminNavigation } from '../../components/layout/adminNavigation'
import Dialog from '../../components/ui/Dialog'
import Icon from '../../components/ui/Icon'
import {
  dashboardErrorMessage,
  fetchAdminDashboard,
  formatDashboardTimestamp,
} from './dashboardApi'
import './admin.css'

const quickAccessIcons = {
  users: Users,
  book: BookOpen,
  enroll: UserCheck,
  lock: KeyRound,
  chart: BarChart3,
}

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'Active', label: 'Active' },
  { value: 'Inactive', label: 'Inactive' },
]

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`
}

function Status({ children }) {
  return (
    <span className={`admin-status ${children === 'Active' ? 'is-active' : ''}`}>
      <span className="user-status-dot" aria-hidden="true" />
      {children}
    </span>
  )
}

function DashboardSkeleton() {
  return (
    <div className="admin-dashboard-skeleton" role="status" aria-live="polite">
      <span className="sr-only">Loading dashboard…</span>
      <div className="admin-metrics" aria-hidden="true">
        {[0, 1, 2, 3].map((slot) => (
          <div className="admin-metric" key={slot}>
            <span className="admin-metric-icon admin-skeleton-box" />
            <div className="admin-metric-body">
              <div className="admin-skeleton-line admin-skeleton-value" />
              <div className="admin-skeleton-line admin-skeleton-label" />
              <div className="admin-skeleton-line admin-skeleton-note" />
            </div>
          </div>
        ))}
      </div>
      <div className="admin-content-grid" aria-hidden="true">
        <div className="admin-panel admin-skeleton-panel">
          <div className="admin-panel-heading">
            <div className="admin-skeleton-line admin-skeleton-label" />
          </div>
          <div className="admin-skeleton-rows">
            {[0, 1, 2, 3].map((row) => (
              <div className="admin-skeleton-row" key={row} />
            ))}
          </div>
        </div>
        <div className="admin-side-stack">
          <div className="admin-panel admin-skeleton-panel">
            <div className="admin-skeleton-rows">
              <div className="admin-skeleton-row" />
              <div className="admin-skeleton-row" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function CourseTable({ courses, totalCatalogCount, statusFilter, search, onSelect, onClearFilters }) {
  const hasFilters = Boolean(search.trim()) || statusFilter !== 'all'

  return (
    <div className="admin-table-scroll">
      <table className="admin-table">
        <caption className="sr-only">Courses, instructors, and enrollment counts</caption>
        <thead>
          <tr>
            <th scope="col">Course</th>
            <th scope="col">Instructor</th>
            <th scope="col">Enrolled</th>
            <th scope="col">Status</th>
            <th scope="col"><span className="sr-only">Details</span></th>
          </tr>
        </thead>
        <tbody>
          {courses.map((course) => (
            <tr key={course.id}>
              <th scope="row">
                <button
                  type="button"
                  className="admin-row-link"
                  onClick={() => onSelect(course.id)}
                >
                  {course.code}
                </button>
                <span className="admin-cell-note">{course.name}</span>
              </th>
              <td>
                {course.instructor ? (
                  <>
                    <span>{course.instructor.fullName}</span>
                    {!course.instructor.isActive && (
                      <span className="admin-cell-note">Inactive account</span>
                    )}
                  </>
                ) : (
                  <span className="admin-unassigned">Not assigned</span>
                )}
              </td>
              <td className="admin-num-cell">{course.enrolledCount}</td>
              <td><Status>{course.status}</Status></td>
              <td>
                <button
                  type="button"
                  className="admin-icon-button"
                  aria-label={`View details for ${course.code}`}
                  onClick={() => onSelect(course.id)}
                >
                  <ArrowRight size={15} aria-hidden="true" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {!courses.length && (
        <div className="admin-empty">
          <Search size={22} aria-hidden="true" />
          {totalCatalogCount === 0 ? (
            <>
              <strong>No courses yet</strong>
              <p>Create a course in the catalog to assign instructors and enroll students.</p>
              <Link className="admin-button admin-button-primary" to="/admin/courses">
                Open Courses
              </Link>
            </>
          ) : (
            <>
              <strong>No courses found</strong>
              <p>Try another course code, name, instructor, or status filter.</p>
              {hasFilters && (
                <button type="button" className="admin-button" onClick={onClearFilters}>
                  Clear filters
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function AdminDashboard() {
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedCourseId, setSelectedCourseId] = useState(null)
  const [reloadTick, setReloadTick] = useState(0)
  const isManualRefresh = useRef(false)
  const searchInputRef = useRef(null)

  useEffect(() => {
    document.title = 'Dashboard | University LMS'
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const manual = isManualRefresh.current

    if (manual) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setError('')

    fetchAdminDashboard({ signal: controller.signal })
      .then((result) => {
        setDashboard(result)
        setLoading(false)
        setRefreshing(false)
        if (manual) {
          setFeedback('Dashboard updated.')
          isManualRefresh.current = false
        }
      })
      .catch((failure) => {
        if (controller.signal.aborted) return
        setError(dashboardErrorMessage(failure))
        setLoading(false)
        setRefreshing(false)
        setFeedback('')
        isManualRefresh.current = false
      })

    return () => controller.abort()
  }, [reloadTick])

  function refresh() {
    if (loading || refreshing) return
    isManualRefresh.current = true
    setFeedback('')
    setReloadTick((tick) => tick + 1)
  }

  function clearFilters() {
    setSearch('')
    setStatusFilter('all')
    searchInputRef.current?.focus()
  }

  const courses = dashboard?.courses || []
  const normalizedSearch = search.trim().toLowerCase()
  const filteredCourses = courses.filter((course) => {
    if (statusFilter !== 'all' && course.status !== statusFilter) return false
    if (!normalizedSearch) return true
    const haystack = [
      course.code,
      course.name,
      course.instructor?.fullName || '',
      course.instructor?.email || '',
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(normalizedSearch)
  })

  const selectedCourse = selectedCourseId
    ? courses.find((course) => course.id === selectedCourseId) || null
    : null

  const summary = dashboard?.summary || {
    users: { students: 0, activeStudents: 0, instructors: 0, activeInstructors: 0 },
    courses: { total: 0, active: 0, inactive: 0, unassignedActive: 0, unenrolledActive: 0 },
    enrollments: { total: 0, uniqueStudents: 0 },
    pendingPasswordResets: 0,
    assessments: { materials: 0, assignments: 0, quizzes: 0 },
  }
  const attention = dashboard?.attention || { unassignedCourses: [], pendingResets: [], totalCount: 0 }
  const updatedText = dashboard?.generatedAt ? formatDashboardTimestamp(dashboard.generatedAt) : ''
  const visibleUnassigned = attention.unassignedCourses.slice(0, 5)
  const latestReset = attention.pendingResets[0]

  return (
    <>
      <div className="admin-page-heading">
        <div className="admin-heading-title">
          <h1>Dashboard</h1>
          {updatedText && <span className="admin-updated">Updated {updatedText}</span>}
        </div>
        <div className="admin-heading-actions">
          <button
            type="button"
            className="admin-button"
            onClick={refresh}
            disabled={loading || refreshing}
          >
            <RefreshCw size={15} className={refreshing ? 'admin-spinning' : ''} aria-hidden="true" />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          <Link className="admin-button admin-button-primary" to="/admin/courses">
            <BookOpen size={15} aria-hidden="true" />
            Manage courses
          </Link>
        </div>
      </div>

      {error && dashboard && (
        <div className="admin-feedback has-failed" role="alert">
          <span>{error}</span>
          <button type="button" className="admin-row-link" onClick={refresh}>
            Try again
          </button>
        </div>
      )}

      {!error && feedback && (
        <div className="admin-feedback" role="status" aria-atomic="true">
          <span>{feedback}</span>
          <button
            type="button"
            className="admin-feedback-close"
            onClick={() => setFeedback('')}
            aria-label="Dismiss status message"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}

      {loading && !dashboard ? (
        <DashboardSkeleton />
      ) : error && !dashboard ? (
        <section className="admin-panel admin-dashboard-error" role="alert">
          <AlertCircle size={22} aria-hidden="true" />
          <div>
            <h2>Unable to load dashboard</h2>
            <p>{error}</p>
            <button type="button" className="admin-button admin-button-primary" onClick={refresh}>
              Try again
            </button>
          </div>
        </section>
      ) : (
        <>
          <section className="admin-metrics" aria-label="Workspace summary" aria-busy={refreshing}>
            {[
              [
                'Students',
                summary.users.students,
                `${summary.users.activeStudents} active`,
                Users,
              ],
              [
                'Instructors',
                summary.users.instructors,
                `${summary.users.activeInstructors} active`,
                GraduationCap,
              ],
              [
                'Active courses',
                summary.courses.active,
                `${summary.courses.total} in catalog`,
                BookOpen,
              ],
              [
                'Enrollments',
                summary.enrollments.total,
                `${pluralize(summary.enrollments.uniqueStudents, 'student')} enrolled`,
                UserCheck,
              ],
            ].map(([label, value, note, MetricIcon]) => (
              <div className="admin-metric" key={label}>
                <span className="admin-metric-icon" aria-hidden="true">
                  <MetricIcon size={18} />
                </span>
                <div className="admin-metric-body">
                  <strong>{refreshing ? '—' : value}</strong>
                  <h2>{label}</h2>
                  <p>{note}</p>
                </div>
              </div>
            ))}
          </section>

          <div className="admin-content-grid">
            <section className="admin-panel">
              <div className="admin-panel-heading">
                <h2>Course overview</h2>
                <Link to="/admin/courses">
                  View all
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </div>

              <div className="admin-table-toolbar">
                <div className="admin-search">
                  <Search size={15} aria-hidden="true" />
                  <input
                    ref={searchInputRef}
                    aria-label="Search courses"
                    placeholder="Search by course code, name, or instructor…"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch('')
                        searchInputRef.current?.focus()
                      }}
                      aria-label="Clear course search"
                    >
                      <X size={15} aria-hidden="true" />
                    </button>
                  )}
                </div>

                <div className="admin-filter-group" role="group" aria-label="Filter courses by status">
                  {STATUS_FILTERS.map((opt) => {
                    const active = statusFilter === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        className={`admin-filter-pill ${active ? 'is-active' : ''}`}
                        aria-pressed={active}
                        onClick={() => setStatusFilter(opt.value)}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <CourseTable
                courses={filteredCourses}
                totalCatalogCount={courses.length}
                statusFilter={statusFilter}
                search={search}
                onSelect={setSelectedCourseId}
                onClearFilters={clearFilters}
              />

              <div className="admin-table-footer">
                <span>
                  {filteredCourses.length === courses.length
                    ? pluralize(courses.length, 'course')
                    : `Showing ${filteredCourses.length} of ${pluralize(courses.length, 'course')}`}
                </span>
                <Link to="/admin/statistics" className="lms-link">
                  View statistics &amp; reports
                </Link>
              </div>
            </section>

            <div className="admin-side-stack">
              <section className="admin-panel">
                <div className="admin-panel-heading">
                  <h2>
                    Needs attention <span className="admin-count">{attention.totalCount}</span>
                  </h2>
                  <AlertCircle size={17} aria-hidden="true" />
                </div>

                {attention.totalCount === 0 ? (
                  <p className="admin-attention-empty">
                    All active courses have an assigned instructor and no password resets are pending.
                  </p>
                ) : (
                  <>
                    {summary.pendingPasswordResets > 0 && (
                      <div className="admin-attention-row">
                        <div className="admin-attention-info">
                          <strong>Password reset requests</strong>
                          <p>
                            {pluralize(summary.pendingPasswordResets, 'pending request')}
                            {latestReset?.email ? ` · ${latestReset.email}` : ''}
                          </p>
                        </div>
                        <Link
                          className="admin-button"
                          to="/admin/password-resets"
                          aria-label="Review pending password resets"
                        >
                          Review
                        </Link>
                      </div>
                    )}

                    {visibleUnassigned.map((item) => (
                      <div className="admin-attention-row" key={item.id}>
                        <div className="admin-attention-info">
                          <strong>{item.code}</strong>
                          <span className="admin-attention-sub">{item.name}</span>
                          <p>
                            No instructor assigned
                            {item.enrolledCount === 0
                              ? ' · 0 students'
                              : ` · ${pluralize(item.enrolledCount, 'student')} enrolled`}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="admin-button"
                          aria-label={`Review ${item.code}`}
                          onClick={() => setSelectedCourseId(item.id)}
                        >
                          Review
                        </button>
                      </div>
                    ))}

                    {attention.unassignedCourses.length > visibleUnassigned.length && (
                      <div className="admin-attention-more">
                        <Link to="/admin/enrollments" className="lms-link">
                          View all {attention.unassignedCourses.length} unassigned courses
                        </Link>
                      </div>
                    )}
                  </>
                )}
              </section>

              <aside className="admin-panel admin-quick-access" aria-label="Quick access">
                <div className="admin-panel-heading">
                  <h2>Quick access</h2>
                </div>
                {adminNavigation.slice(1).map((item) => {
                  const QuickIcon = quickAccessIcons[item.icon] || BookOpen
                  return (
                    <Link key={item.path} to={item.path}>
                      <span className="admin-shortcut-icon" aria-hidden="true">
                        <QuickIcon size={16} />
                      </span>
                      <strong>{item.label}</strong>
                      <ChevronRight size={15} aria-hidden="true" />
                    </Link>
                  )
                })}
              </aside>

              <section className="admin-panel">
                <div className="admin-panel-heading">
                  <h2>Academic snapshot</h2>
                  <BarChart3 size={17} aria-hidden="true" />
                </div>
                <dl className="admin-enrollment-summary">
                  <div>
                    <dt>Total enrollments</dt>
                    <dd>{summary.enrollments.total}</dd>
                  </div>
                  <div>
                    <dt>Unique students enrolled</dt>
                    <dd>{summary.enrollments.uniqueStudents}</dd>
                  </div>
                  <div>
                    <dt>Active courses without students</dt>
                    <dd>{summary.courses.unenrolledActive}</dd>
                  </div>
                  <div>
                    <dt>Pending password resets</dt>
                    <dd>{summary.pendingPasswordResets}</dd>
                  </div>
                  <div>
                    <dt>Assignments / quizzes</dt>
                    <dd>{summary.assessments.assignments} / {summary.assessments.quizzes}</dd>
                  </div>
                </dl>
              </section>
            </div>
          </div>
        </>
      )}

      {selectedCourse && (
        <Dialog onDismiss={() => setSelectedCourseId(null)} aria-labelledby="course-dialog-title">
          <header className="dialog-header">
            <h2 id="course-dialog-title">{selectedCourse.code}</h2>
            <button
              type="button"
              className="dialog-close"
              onClick={() => setSelectedCourseId(null)}
              aria-label="Close course details"
            >
              <Icon name="close" />
            </button>
          </header>
          <div className="dialog-body admin-class-details">
            <h3>{selectedCourse.name}</h3>
            {selectedCourse.description && (
              <p className="admin-course-description">{selectedCourse.description}</p>
            )}
            <dl>
              <div>
                <dt>Instructor</dt>
                <dd>{selectedCourse.instructor ? selectedCourse.instructor.fullName : 'Not assigned'}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd><Status>{selectedCourse.status}</Status></dd>
              </div>
              <div>
                <dt>Enrolled students</dt>
                <dd>{selectedCourse.counts.enrollments}</dd>
              </div>
              <div>
                <dt>Materials</dt>
                <dd>{selectedCourse.counts.materials}</dd>
              </div>
              <div>
                <dt>Assignments</dt>
                <dd>{selectedCourse.counts.assignments}</dd>
              </div>
              <div>
                <dt>Quizzes</dt>
                <dd>{selectedCourse.counts.quizzes}</dd>
              </div>
            </dl>
          </div>
          <footer className="dialog-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => setSelectedCourseId(null)}
            >
              Close
            </button>
            <Link
              className="admin-button admin-button-primary"
              to={`/admin/enrollments?courseId=${encodeURIComponent(selectedCourse.id)}`}
            >
              Manage enrollments
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </footer>
        </Dialog>
      )}
    </>
  )
}
