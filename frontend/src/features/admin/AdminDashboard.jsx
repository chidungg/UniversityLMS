import { useEffect, useRef, useState } from 'react'
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
  ShieldCheck,
} from 'lucide-react'
import AdminShell from '../../components/layout/AdminShell'
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
        <caption className="sr-only">Classes and instructor assignments — sample data</caption>
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
                <button className="admin-row-link" onClick={() => onSelect(item)}>{item.code || item.id}</button>
                <span className="admin-cell-note">{data.courses.find((course) => course.id === item.courseId)?.name}</span>
              </th>
              <td>
                {data.users.find((user) => user.id === item.instructorId)?.name || <span className="admin-unassigned">Not assigned</span>}
              </td>
              <td>{data.enrollments.filter((entry) => entry.classId === item.id).length}</td>
              <td><Status>{item.status}</Status></td>
              <td>
                <button className="admin-icon-button" aria-label={`View ${item.code || item.id}`} onClick={() => onSelect(item)}>
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && (
        <div className="admin-empty">
          <Search size={26} aria-hidden="true" />
          <strong>No classes found</strong>
          <p>Try another class code or course name.</p>
        </div>
      )}
    </div>
  )
}

function ModulePreview({ data }) {
  const rows = data.courses.map((course) => {
    const classes = data.classes.filter((item) => item.courseId === course.id)
    return [
      course.code || course.id,
      course.name,
      classes.length,
      data.enrollments.filter((entry) => classes.some((item) => item.id === entry.classId)).length,
    ]
  })
  const headings = ['Course code', 'Course name', 'Classes', 'Enrollments']
  return (
    <div className="admin-table-scroll">
      <table className="admin-table">
        <caption className="sr-only">Read-only sample records</caption>
        <thead>
          <tr>{headings.map((label) => <th key={label} scope="col">{label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, col) => <td key={col}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function AdminDashboard() {
  const path = window.location.pathname === '/admin/dashboard' ? '/admin' : window.location.pathname
  const current = adminNavigation.find((item) => item.path === path) || adminNavigation[0]
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
  const overview = path === '/admin'

  useEffect(() => {
    document.title = `${current.label} | University LMS`
    return () => window.clearTimeout(timer.current)
  }, [current.label])

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
    <AdminShell path={path}>
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">Administration / {overview ? 'At a glance' : 'Workspace'}</p>
          <h1>{overview ? 'Your workspace, at a glance.' : current.label}</h1>
          <p>{overview ? 'Manage accounts, courses, classes and academic operations in one workspace.' : 'Explore the sample records behind your dashboard.'}</p>
        </div>
        <div className="admin-heading-actions">
          <button className="admin-button" onClick={refresh} disabled={refreshing}>
            <RefreshCw size={15} className={refreshing ? 'admin-spinning' : ''} aria-hidden="true" />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          {overview && (
            <a className="admin-button admin-button-primary" href="/admin/classes">
              <Presentation size={15} aria-hidden="true" />
              Manage classes
            </a>
          )}
        </div>
      </div>

      <div className="admin-preview-notice">
        <span className="admin-sample-label">Sample data</span>
        <p>You are viewing a frontend preview. Accounts, classes and totals are illustrative.</p>
      </div>

      <div className={`admin-feedback ${failed ? 'has-failed' : ''}`} role="status">
        {feedback}
        {failed && <button className="admin-row-link" onClick={refresh}>Try again</button>}
      </div>

      {overview ? (
        <>
          <section className="admin-welcome" aria-labelledby="welcome-title">
            <div className="admin-welcome-left">
              <span className="admin-welcome-icon" aria-hidden="true">
                <ShieldCheck size={20} />
              </span>
              <div>
                <p className="admin-eyebrow">Admin control center</p>
                <h2 id="welcome-title">Keep learning organized.</h2>
                <p>Connect the right people to the right classes, manage enrollment and review student password requests.</p>
              </div>
            </div>
            <a className="admin-welcome-cta" href="/admin/enrollments">
              Manage enrollments
              <ArrowRight size={16} aria-hidden="true" />
            </a>
          </section>

          <section className="admin-metrics" aria-label="Academic overview, sample data" aria-busy={refreshing}>
            {[
              ['Student accounts', summary.students, 'Registered students', Users, ''],
              ['Instructors', summary.instructors, 'Teaching staff accounts', GraduationCap, ''],
              ['Active courses', summary.activeCourses, `${data.courses.length} in catalog`, BookOpen, 'is-success'],
              ['Active classes', summary.activeClasses, `${data.classes.length} total classes`, Presentation, 'is-warning'],
            ].map(([label, value, note, MetricIcon, tone]) => (
              <div className="admin-metric" key={label}>
                <span className={`admin-metric-icon ${tone}`} aria-hidden="true">
                  <MetricIcon size={20} />
                </span>
                <div className="admin-metric-body">
                  <strong>{refreshing ? '—' : value}</strong>
                  <h2>{label}</h2>
                  <p>{note}</p>
                </div>
              </div>
            ))}
          </section>

          <div className="admin-section-heading">
            <div>
              <h2>Academic workspace</h2>
              <p>Classes, enrollment and everyday administrative modules.</p>
            </div>
            <a href="/admin/statistics">
              View reports
              <ArrowRight size={15} aria-hidden="true" />
            </a>
          </div>

          <div className="admin-content-grid">
            <section className="admin-panel">
              <div className="admin-panel-heading">
                <div>
                  <h2>Class overview</h2>
                  <p>Instructor assignments and student enrollment.</p>
                </div>
                <a href="/admin/classes">
                  View all
                  <ArrowRight size={14} aria-hidden="true" />
                </a>
              </div>
              <div className="admin-search">
                <Search size={16} aria-hidden="true" />
                <input
                  aria-label="Search classes"
                  placeholder="Search by class code or course name…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                {search && (
                  <button onClick={() => setSearch('')} aria-label="Clear class search">
                    <X size={15} aria-hidden="true" />
                  </button>
                )}
              </div>
              <ClassTable data={data} filter={search} onSelect={setSelected} />
              <div className="admin-table-footer">
                <span>{data.classes.length} classes in this sample workspace</span>
                <span>Sample records</span>
              </div>
            </section>

            <aside className="admin-panel admin-quick-access" aria-label="Quick access">
              <div className="admin-panel-heading">
                <div>
                  <h2>Quick access</h2>
                  <p>Everyday administration tasks.</p>
                </div>
              </div>
              {adminNavigation.slice(1, 6).map((item) => {
                const QuickIcon = quickAccessIcons[item.icon] || BookOpen
                const key = item.path.split('/').at(-1)
                const subtitle = {
                  users: 'Accounts, roles and access',
                  courses: 'Your course catalog',
                  classes: 'Classes and teaching staff',
                  enrollments: 'Students and assignments',
                  'password-resets': 'Student recovery requests',
                }[key]
                return (
                  <a key={item.path} href={item.path}>
                    <span className="admin-shortcut-icon" aria-hidden="true">
                      <QuickIcon size={18} />
                    </span>
                    <span>
                      <strong>{item.label}</strong>
                      <small>{subtitle}</small>
                    </span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </a>
                )
              })}
            </aside>
          </div>

          <div className="admin-bottom-grid">
            <section className="admin-panel">
              <div className="admin-panel-heading">
                <div>
                  <h2>
                    Needs attention <span className="admin-count">{summary.unassigned.length}</span>
                  </h2>
                  <p>Active classes awaiting an instructor assignment.</p>
                </div>
                <AlertCircle size={18} aria-hidden="true" />
              </div>
              {summary.unassigned.length ? (
                summary.unassigned.map((item) => (
                  <div className="admin-attention-row" key={item.id}>
                    <span className="admin-shortcut-icon" aria-hidden="true">
                      <Presentation size={18} />
                    </span>
                    <div>
                      <strong>{item.code || item.id} · {data.courses.find((course) => course.id === item.courseId)?.name}</strong>
                      <p>
                        No instructor assigned
                        {summary.unenrolled.some((row) => row.id === item.id) ? ' · No students enrolled' : ''}
                      </p>
                    </div>
                    <button className="admin-button" onClick={() => setSelected(item)}>
                      Review
                      <ArrowRight size={14} aria-hidden="true" />
                    </button>
                  </div>
                ))
              ) : (
                <p className="admin-attention-empty">All active classes currently have an assigned instructor.</p>
              )}
            </section>

            <section className="admin-panel">
              <div className="admin-panel-heading">
                <div>
                  <h2>Enrollment snapshot</h2>
                  <p>Student participation across sample classes.</p>
                </div>
                <UserCheck size={18} aria-hidden="true" />
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
                  <dt>Active classes without students</dt>
                  <dd>{summary.unenrolled.length}</dd>
                </div>
              </dl>
            </section>
          </div>
        </>
      ) : (
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <h2>{current.label} preview</h2>
              <p>Read-only sample records. Management actions will be added with this module.</p>
            </div>
            <a href="/admin">Back to overview</a>
          </div>
          <ModulePreview data={data} />
        </section>
      )}

      {selected && (
        <Dialog onDismiss={() => setSelected(null)} aria-labelledby="class-dialog-title">
          <header className="dialog-header">
            <div>
              <p className="dialog-eyebrow">CLASS DETAILS · SAMPLE DATA</p>
              <h2 id="class-dialog-title">{selected.code || selected.id}</h2>
            </div>
            <button className="dialog-close" onClick={() => setSelected(null)} aria-label="Close class details">
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
            <p>Class details are shown for preview. Use Enrollment & assignment to assign instructors or manage students.</p>
          </div>
          <footer className="dialog-actions">
            <button className="secondary-button" onClick={() => setSelected(null)}>Close</button>
            <a className="admin-button admin-button-primary" href={`/admin/enrollments?classId=${encodeURIComponent(selected.id)}`}>
              View enrollments
              <ArrowRight size={15} aria-hidden="true" />
            </a>
          </footer>
        </Dialog>
      )}
    </AdminShell>
  )
}
