import { useEffect, useRef, useState } from 'react'
import AdminShell from '../../components/layout/AdminShell'
import { adminNavigation } from '../../components/layout/adminNavigation'
import Dialog from '../../components/ui/Dialog'
import Icon from '../../components/ui/Icon'
import { dashboardSample, summarizeDashboard } from './dashboardData'
import { readPreviewUsers } from './users/userPreview'
import './admin.css'

function Status({ children }) {
  return <span className={`admin-status ${children === 'Active' ? 'is-active' : ''}`}>{children}</span>
}

function ClassTable({ data, onSelect, filter = '' }) {
  const rows = data.classes.filter((item) => `${item.id} ${data.courses.find((course) => course.id === item.courseId)?.name}`.toLowerCase().includes(filter.toLowerCase().trim()))
  return <div className="admin-table-scroll"><table className="admin-table"><caption className="sr-only">Classes and instructor assignments — sample data</caption><thead><tr><th scope="col">Class / course</th><th scope="col">Instructor</th><th scope="col">Students</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Details</span></th></tr></thead><tbody>{rows.map((item) => <tr key={item.id}><th scope="row"><button className="admin-row-link" onClick={() => onSelect(item)}>{item.id}</button><span className="admin-cell-note">{data.courses.find((course) => course.id === item.courseId)?.name}</span></th><td>{data.users.find((user) => user.id === item.instructorId)?.name || <span className="admin-unassigned">Not assigned</span>}</td><td>{data.enrollments.filter((entry) => entry.classId === item.id).length}</td><td><Status>{item.status}</Status></td><td><button className="admin-icon-button" aria-label={`View ${item.id}`} onClick={() => onSelect(item)}><Icon name="arrow" size={16} /></button></td></tr>)}</tbody></table>{!rows.length && <div className="admin-empty"><Icon name="search" size={28} /><strong>No classes found</strong><p>Try another class code or course name.</p></div>}</div>
}

function ModulePreview({ path, data, onSelect }) {
  if (path === '/admin/classes') return <ClassTable data={data} onSelect={onSelect} />
  const rows = path === '/admin/courses' ? data.courses.map((course) => [course.id, course.name, course.status])
      : path === '/admin/enrollments' ? data.enrollments.map((entry) => [data.users.find((user) => user.id === entry.studentId)?.name, entry.classId, data.users.find((user) => user.id === data.classes.find((item) => item.id === entry.classId)?.instructorId)?.name || 'Not assigned'])
        : data.courses.map((course) => { const classes = data.classes.filter((item) => item.courseId === course.id); return [course.id, course.name, classes.length, data.enrollments.filter((entry) => classes.some((item) => item.id === entry.classId)).length] })
  const headings = path === '/admin/courses' ? ['Course code', 'Course name', 'Status'] : path === '/admin/enrollments' ? ['Student', 'Class', 'Instructor'] : ['Course code', 'Course name', 'Classes', 'Enrollments']
  return <div className="admin-table-scroll"><table className="admin-table"><caption className="sr-only">Read-only sample records</caption><thead><tr>{headings.map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, col) => <td key={col}>{headings[col] === 'Status' ? <Status>{cell}</Status> : cell}</td>)}</tr>)}</tbody></table></div>
}

export default function AdminDashboard() {
  const path = window.location.pathname === '/admin/dashboard' ? '/admin' : window.location.pathname
  const current = adminNavigation.find((item) => item.path === path) || adminNavigation[0]
  const [data] = useState(() => {
    try { return { ...dashboardSample, users: readPreviewUsers() } }
    catch { return dashboardSample }
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
    if (!navigator.onLine) { setFailed(true); setFeedback('You are offline. Check your connection and try again.'); return }
    setRefreshing(true)
    timer.current = window.setTimeout(() => { setRefreshing(false); setFeedback('Sample overview refreshed. No live data was requested.') }, 500)
  }

  return <AdminShell path={path}>
    <div className="admin-page-heading"><div><p className="admin-eyebrow">ADMINISTRATION / {overview ? 'AT A GLANCE' : 'WORKSPACE'}</p><h1>{overview ? 'Your workspace, at a glance.' : current.label}</h1><p>{overview ? 'Manage your academic workspace and see what needs attention.' : 'Explore the sample records behind your dashboard.'}</p></div><button className="admin-button" onClick={refresh} disabled={refreshing}><Icon name="refresh" size={16} className={refreshing ? 'admin-spinning' : ''} />{refreshing ? 'Refreshing…' : 'Refresh'}</button></div>
    <div className="admin-preview-notice"><span className="admin-sample-label">Sample data</span><p>You are viewing a frontend preview. Accounts, classes and totals are illustrative.</p></div>
    <div className={`admin-feedback ${failed ? 'has-failed' : ''}`} role="status">{feedback}{failed && <button className="admin-row-link" onClick={refresh}>Try again</button>}</div>
    {overview ? <>
      <section className="admin-welcome" aria-labelledby="welcome-title"><div><p className="admin-eyebrow">ADMIN CONTROL CENTER</p><h2 id="welcome-title">Keep learning organized.</h2><p>Connect the right people to the right classes.<br />Manage enrollment and instructor assignments in one place.</p><a href="/admin/enrollments">Manage enrollments<Icon name="arrow" size={18} /></a></div><div className="admin-welcome-symbol" aria-hidden="true"><Icon name="book" size={64} /><span><Icon name="check" size={19} /></span></div></section>
      <section className="admin-metrics" aria-label="Academic overview, sample data" aria-busy={refreshing}>{[
        ['Student accounts', summary.students, 'Registered student accounts', 'users'],
        ['Instructors', summary.instructors, 'Teaching staff accounts', 'instructor'],
        ['Active courses', summary.activeCourses, `${data.courses.length} courses in the catalog`, 'book'],
        ['Active classes', summary.activeClasses, `${data.classes.length} classes in total`, 'classes'],
      ].map(([label, value, note, icon]) => <div className="admin-metric" key={label}><div><h2>{label}</h2><span><Icon name={icon} size={20} /></span></div><strong>{refreshing ? '—' : value}</strong><p>{note}</p></div>)}</section>
      <div className="admin-section-heading"><div><h2>Academic workspace</h2><p>Classes, enrollment and the people who make learning happen.</p></div><a href="/admin/statistics">View reports<Icon name="arrow" size={16} /></a></div>
      <div className="admin-content-grid"><section className="admin-panel"><div className="admin-panel-heading"><div><h2>Class overview</h2><p>Instructor assignments and student enrollment.</p></div><a href="/admin/classes">View all<Icon name="arrow" size={14} /></a></div><div className="admin-search"><Icon name="search" size={18} /><input aria-label="Search classes" placeholder="Search by class code or course name…" value={search} onChange={(event) => setSearch(event.target.value)} />{search && <button onClick={() => setSearch('')} aria-label="Clear class search"><Icon name="close" size={16} /></button>}</div><ClassTable data={data} filter={search} onSelect={setSelected} /><div className="admin-table-footer">{data.classes.length} classes in this sample workspace<span>Sample records</span></div></section>
      <aside className="admin-panel admin-quick-access" aria-label="Quick access"><div className="admin-panel-heading"><div><h2>Quick access</h2><p>Your everyday administration tasks.</p></div></div>{adminNavigation.slice(1, 5).map((item) => <a key={item.path} href={item.path}><span className="admin-shortcut-icon"><Icon name={item.icon} size={20} /></span><span><strong>{item.label}</strong><small>{{ users: 'Accounts, roles and access', courses: 'Your course catalog', classes: 'Classes and teaching staff', enrollments: 'Students and assignments' }[item.path.split('/').at(-1)]}</small></span><Icon name="chevron" size={16} /></a>)}</aside></div>
      <div className="admin-bottom-grid"><section className="admin-panel"><div className="admin-panel-heading"><div><h2>Needs attention <span className="admin-count">{summary.unassigned.length}</span></h2><p>Active classes awaiting an instructor assignment.</p></div><Icon name="alert" size={20} /></div>{summary.unassigned.map((item) => <div className="admin-attention-row" key={item.id}><span className="admin-shortcut-icon"><Icon name="classes" /></span><div><strong>{item.id} · {data.courses.find((course) => course.id === item.courseId)?.name}</strong><p>No instructor assigned{summary.unenrolled.some((row) => row.id === item.id) ? ' · No students enrolled' : ''}</p></div><button className="admin-button" onClick={() => setSelected(item)}>Review<Icon name="arrow" size={15} /></button></div>)}</section><section className="admin-panel"><div className="admin-panel-heading"><div><h2>Enrollment snapshot</h2><p>Student participation across sample classes.</p></div><Icon name="enroll" /></div><dl className="admin-enrollment-summary"><div><dt>Total enrollments</dt><dd>{data.enrollments.length}</dd></div><div><dt>Students enrolled</dt><dd>{new Set(data.enrollments.map((item) => item.studentId)).size}</dd></div><div><dt>Active classes without students</dt><dd>{summary.unenrolled.length}</dd></div></dl></section></div>
    </> : <section className="admin-panel"><div className="admin-panel-heading"><div><h2>{current.label} preview</h2><p>Read-only sample records. Management actions will be added with this module.</p></div><a href="/admin">Back to overview</a></div><ModulePreview path={path} data={data} onSelect={setSelected} /></section>}
    {selected && <Dialog onDismiss={() => setSelected(null)} aria-labelledby="class-dialog-title"><header className="dialog-header"><div><p className="dialog-eyebrow">CLASS DETAILS · SAMPLE DATA</p><h2 id="class-dialog-title">{selected.id}</h2></div><button className="dialog-close" onClick={() => setSelected(null)} aria-label="Close class details"><Icon name="close" /></button></header><div className="dialog-body admin-class-details"><h3>{data.courses.find((course) => course.id === selected.courseId)?.name}</h3><dl><div><dt>Instructor</dt><dd>{data.users.find((user) => user.id === selected.instructorId)?.name || 'Not assigned'}</dd></div><div><dt>Students enrolled</dt><dd>{data.enrollments.filter((item) => item.classId === selected.id).length}</dd></div><div><dt>Status</dt><dd><Status>{selected.status}</Status></dd></div></dl><p>Class details are shown for preview. Changes to assignments and enrollment are not available yet.</p></div><footer className="dialog-actions"><button className="secondary-button" onClick={() => setSelected(null)}>Close</button><a className="admin-button" href="/admin/enrollments">View enrollments<Icon name="arrow" size={16} /></a></footer></Dialog>}
  </AdminShell>
}
