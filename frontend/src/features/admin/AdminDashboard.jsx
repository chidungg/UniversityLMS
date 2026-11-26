import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Users,
  GraduationCap,
  BookOpen,
  Presentation,
  UserCheck,
  KeyRound,
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
import { dashboardSample, summarizeDashboard } from './dashboardData'
import { readPreviewUsers } from './users/userPreview'
import { readPreviewCourses } from './courses/coursePreview'
import { readPreviewClasses } from './classes/classStore'
import { readPreviewEnrollments } from './enrollments/enrollmentStore'
import './admin.css'

const quickAccessIcons = {
  users: Users,
  book: BookOpen,
  classes: Presentation,
  enroll: UserCheck,
  lock: KeyRound,
}

function Status({ children }) {
  return (
    <span className={`admin-status ${children === 'Active' ? 'is-active' : ''}`}>
      <span className="user-status-dot" aria-hidden="true" />
      {children}
    </span>
  )
}

function ClassTable({ data, onSelect, filter = '' }) {
  const rows = data.classes.filter((item) =>
    `${item.code || item.id} ${data.courses.find((course) => course.id === item.courseId)?.name}`
      .toLowerCase()
      .includes(filter.toLowerCase().trim()),
  )
  return (
    <div className="admin-table-scroll">
      <table className="admin-table">
        <caption className="sr-only">Classes and instructor assignments</caption>
        <thead>
          <tr>
            <th scope="col">Class / course</th>
            <th scope="col">Instructor</th>
            <th scope="col">Students</th>
            <th scope="col">Status</th>
            <th scope="col"><span className="sr-only">Details</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr key={item.id}>
              <th scope="row">
                <button type="button" className="admin-row-link" onClick={() => onSelect(item)}>{item.code || item.id}</button>
                <span className="admin-cell-note">{data.courses.find((course) => course.id === item.courseId)?.name}</span>
              </th>
              <td>
                {data.users.find((user) => user.id === item.instructorId)?.name || <span className="admin-unassigned">Not assigned</span>}
              </td>
              <td>{data.enrollments.filter((entry) => entry.classId === item.id).length}</td>
              <td><Status>{item.status}</Status></td>
              <td>
                <button type="button" className="admin-icon-button" aria-label={`View ${item.code || item.id}`} onClick={() => onSelect(item)}>
                  <ArrowRight size={15} aria-hidden="true" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && (
        <div className="admin-empty">
          <Search size={22} aria-hidden="true" />
          <strong>No classes found</strong>
          <p>Try another class code or course name.</p>
        </div>
      )}
    </div>
  )
}

export default function AdminDashboard() {
  const [data] = useState(() => {
    const snapshot = { ...dashboardSample }
    try { snapshot.users = readPreviewUsers() } catch { /* Keep initial fixtures if preview storage is unavailable. */ }
    try { snapshot.courses = readPreviewCourses() } catch { /* The catalog provides storage-error recovery. */ }
    try { snapshot.classes = readPreviewClasses() } catch { /* Class directory shows storage recovery. */ }
    try { snapshot.enrollments = readPreviewEnrollments() } catch { /* Enrollment workspace shows storage recovery. */ }
    return snapshot
  })
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [failed, setFailed] = useState(false)
  const timer = useRef(null)
  const summary = summarizeDashboard(data)

  useEffect(() => {
    document.title = 'Overview | University LMS'
    return () => window.clearTimeout(timer.current)
  }, [])

  function refresh() {
    if (refreshing) return
    setFailed(false)
    setFeedback('')
    if (!navigator.onLine) {
      setFailed(true)
      setFeedback('You are offline. Check your connection and try again.')
      return
    }
    setRefreshing(true)
    timer.current = window.setTimeout(() => {
      setRefreshing(false)
      setFeedback('Sample overview refreshed. No live data was requested.')
    }, 500)
  }

  return (
    <>
      <div className="admin-page-heading">
        <h1>Your workspace, at a glance.</h1>
        <div className="admin-heading-actions">
          <button type="button" className="admin-button" onClick={refresh} disabled={refreshing}>
            <RefreshCw size={15} className={refreshing ? 'admin-spinning' : ''} aria-hidden="true" />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          <Link className="admin-button admin-button-primary" to="/admin/classes">
            <Presentation size={15} aria-hidden="true" />
            Manage classes
          </Link>
        </div>
      </div>

      <div className="admin-preview-notice">
        <span className="admin-sample-label">Sample data</span>
        <p>Preview overview built from sample records.</p>
      </div>

      <div className={`admin-feedback ${failed ? 'has-failed' : ''}`} role="status">
        {feedback}
        {failed && <button type="button" className="admin-row-link" onClick={refresh}>Try again</button>}
      </div>

      <section className="admin-metrics" aria-label="Academic overview, sample data" aria-busy={refreshing}>
        {[
          ['Student accounts', summary.students, 'Registered', Users],
          ['Instructors', summary.instructors, 'Teaching staff', GraduationCap],
          ['Active courses', summary.activeCourses, `${data.courses.length} in catalog`, BookOpen],
          ['Active classes', summary.activeClasses, `${data.classes.length} total`, Presentation],
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
            <h2>Class overview</h2>
            <Link to="/admin/classes">
              View all
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
          <div className="admin-search">
            <Search size={15} aria-hidden="true" />
            <input
              aria-label="Search classes"
              placeholder="Search by class code or course name…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} aria-label="Clear class search">
                <X size={15} aria-hidden="true" />
              </button>
            )}
          </div>
          <ClassTable data={data} filter={search} onSelect={setSelected} />
          <div className="admin-table-footer">
            <span>{data.classes.length} classes</span>
            <Link to="/admin/statistics" className="lms-link">View reports</Link>
          </div>
        </section>

        <div className="admin-side-stack">
          <section className="admin-panel">
            <div className="admin-panel-heading">
              <h2>
                Needs attention <span className="admin-count">{summary.unassigned.length}</span>
              </h2>
              <AlertCircle size={17} aria-hidden="true" />
            </div>
            {summary.unassigned.length ? (
              summary.unassigned.map((item) => (
                <div className="admin-attention-row" key={item.id}>
                  <div>
                    <strong>{item.code || item.id}</strong>
                    <p>
                      No instructor assigned
                      {summary.unenrolled.some((row) => row.id === item.id) ? ' · 0 students' : ''}
                    </p>
                  </div>
                  <button type="button" className="admin-button" onClick={() => setSelected(item)}>
                    Review
                  </button>
                </div>
              ))
            ) : (
              <p className="admin-attention-empty">All active classes have an assigned instructor.</p>
            )}
          </section>

          <aside className="admin-panel admin-quick-access" aria-label="Quick access">
            <div className="admin-panel-heading">
              <h2>Quick access</h2>
            </div>
            {adminNavigation.slice(1, 6).map((item) => {
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
              <h2>Enrollment snapshot</h2>
              <UserCheck size={17} aria-hidden="true" />
            </div>
            <dl className="admin-enrollment-summary">
              <div>
                <dt>Total enrollments</dt>
                <dd>{data.enrollments.length}</dd>
              </div>
              <div>
                <dt>Students enrolled</dt>
                <dd>{new Set(data.enrollments.map((item) => item.studentId)).size}</dd>
              </div>
              <div>
                <dt>Classes without students</dt>
                <dd>{summary.unenrolled.length}</dd>
              </div>
            </dl>
          </section>
        </div>
      </div>

      {selected && (
        <Dialog onDismiss={() => setSelected(null)} aria-labelledby="class-dialog-title">
          <header className="dialog-header">
            <h2 id="class-dialog-title">{selected.code || selected.id}</h2>
            <button type="button" className="dialog-close" onClick={() => setSelected(null)} aria-label="Close class details">
              <Icon name="close" />
            </button>
          </header>
          <div className="dialog-body admin-class-details">
            <h3>{data.courses.find((course) => course.id === selected.courseId)?.name}</h3>
            <dl>
              <div>
                <dt>Instructor</dt>
                <dd>{data.users.find((user) => user.id === selected.instructorId)?.name || 'Not assigned'}</dd>
              </div>
              <div>
                <dt>Students enrolled</dt>
                <dd>{data.enrollments.filter((item) => item.classId === selected.id).length}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd><Status>{selected.status}</Status></dd>
              </div>
            </dl>
          </div>
          <footer className="dialog-actions">
            <button type="button" className="secondary-button" onClick={() => setSelected(null)}>Close</button>
            <Link className="admin-button admin-button-primary" to={`/admin/enrollments?classId=${encodeURIComponent(selected.id)}`}>
              View enrollments
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </footer>
        </Dialog>
      )}
    </>
  )
}
