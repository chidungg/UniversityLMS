import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertCircle, BarChart3, ChevronRight, RefreshCw, RotateCcw } from 'lucide-react'
import { useAuth } from '../../../app/AuthContext'
import AdminShell from '../../../components/layout/AdminShell'
import StatisticsCharts from './StatisticsCharts'
import {
  ACTIVITY_OPTIONS,
  DEFAULT_FILTERS,
  PERIOD_OPTIONS,
  STATUS_OPTIONS,
  fetchStatistics,
  formatStatisticsTimestamp,
  normalizeFilters,
  statisticsErrorMessage,
} from './statisticsPreview'
import '../admin.css'
import '../users/users.css'
import './statistics.css'

const COLUMNS_BY_ACTIVITY = {
  all: [
    { key: 'courseCode', label: 'Course', type: 'text' },
    { key: 'status', label: 'Status', type: 'text' },
    { key: 'instructorName', label: 'Instructor', type: 'text' },
    { key: 'enrollments', label: 'Enrollments', type: 'number' },
    { key: 'submissionsTotal', label: 'Submissions', type: 'number' },
    { key: 'averageAssignmentPct', label: 'Avg. Assignment', type: 'pct' },
    { key: 'quizAttemptsTotal', label: 'Quiz Attempts', type: 'number' },
    { key: 'averageQuizPct', label: 'Avg. Quiz', type: 'pct' },
  ],
  enrollments: [
    { key: 'courseCode', label: 'Course', type: 'text' },
    { key: 'status', label: 'Status', type: 'text' },
    { key: 'instructorName', label: 'Instructor', type: 'text' },
    { key: 'enrollments', label: 'Enrolled Students', type: 'number' },
  ],
  assignments: [
    { key: 'courseCode', label: 'Course', type: 'text' },
    { key: 'status', label: 'Status', type: 'text' },
    { key: 'assignmentsCount', label: 'Assignments', type: 'number' },
    { key: 'submissionsTotal', label: 'Submissions', type: 'number' },
    { key: 'submissionsGraded', label: 'Graded', type: 'number' },
    { key: 'submissionsPending', label: 'Pending Grading', type: 'number' },
    { key: 'averageAssignmentPct', label: 'Avg. Score', type: 'pct' },
  ],
  quizzes: [
    { key: 'courseCode', label: 'Course', type: 'text' },
    { key: 'status', label: 'Status', type: 'text' },
    { key: 'quizzesCount', label: 'Quizzes', type: 'number' },
    { key: 'quizAttemptsTotal', label: 'Attempts', type: 'number' },
    { key: 'quizAttemptsCompleted', label: 'Completed', type: 'number' },
    { key: 'averageQuizPct', label: 'Avg. Score', type: 'pct' },
    { key: 'quizPassRatePct', label: 'Pass Rate', type: 'pct' },
  ],
}

const NO_DATA_COPY = {
  empty_system: 'No courses have been created in the system yet. Create a course first to start recording enrollments and assessments.',
  no_matching_courses: 'No courses match the selected statistical criteria. Adjust or reset your filters to inspect available courses.',
  no_enrollment_data: 'No student enrollment records match the selected criteria.',
  no_submission_data: 'No assignment submission records match the selected criteria.',
  no_quiz_data: 'No quiz attempt records match the selected criteria.',
  no_period_activity: 'No enrollment, assignment, or quiz activity was recorded during the selected time range.',
}

function CourseStatus({ status }) {
  return (
    <span className={`admin-status ${status === 'Active' ? 'is-active' : ''}`}>
      <span className="user-status-dot" aria-hidden="true" />
      {status}
    </span>
  )
}

function SortIcon({ active, dir }) {
  return <span aria-hidden="true">{active ? (dir === 'asc' ? '↑' : '↓') : '↕'}</span>
}

function formatPct(value) {
  return value === null || value === undefined ? '—' : `${value}%`
}

export default function StatisticsManagement() {
  const { user, loading: authLoading } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const filters = useMemo(
    () =>
      normalizeFilters({
        courseStatus: searchParams.get('courseStatus') || DEFAULT_FILTERS.courseStatus,
        courseId: searchParams.get('courseId') || DEFAULT_FILTERS.courseId,
        activityType: searchParams.get('activityType') || DEFAULT_FILTERS.activityType,
        period: searchParams.get('period') || DEFAULT_FILTERS.period,
      }),
    [searchParams],
  )

  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [reloadTick, setReloadTick] = useState(0)
  const [sort, setSort] = useState({ key: 'courseCode', dir: 'asc' })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const courseSelectRef = useRef(null)
  const authenticated = Boolean(user)

  useEffect(() => {
    document.title = 'Statistics & reports | University LMS'
  }, [])

  useEffect(() => {
    if (authLoading) return undefined
    const controller = new AbortController()
    setError('')
    setLoading((prev) => (report ? prev : true))
    setRefreshing(Boolean(report))

    fetchStatistics(filters, { signal: controller.signal, authenticated })
      .then((data) => {
        setReport(data)
        setLoading(false)
        setRefreshing(false)
      })
      .catch((failure) => {
        if (failure.name === 'AbortError' || controller.signal.aborted) return
        setError(statisticsErrorMessage(failure))
        setLoading(false)
        setRefreshing(false)
      })

    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, authenticated, filters.courseStatus, filters.courseId, filters.activityType, filters.period, reloadTick])

  const hasActiveFilters =
    filters.courseStatus !== 'all' ||
    filters.courseId !== 'all' ||
    filters.activityType !== 'all' ||
    filters.period !== 'all'

  function updateFilter(key, value) {
    const next = normalizeFilters({ ...filters, [key]: value })
    const params = new URLSearchParams()
    if (next.courseStatus !== 'all') params.set('courseStatus', next.courseStatus)
    if (next.courseId !== 'all') params.set('courseId', next.courseId)
    if (next.activityType !== 'all') params.set('activityType', next.activityType)
    if (next.period !== 'all') params.set('period', next.period)
    setPage(1)
    setSearchParams(params)
  }

  function resetFilters() {
    setPage(1)
    setSearchParams(new URLSearchParams())
    requestAnimationFrame(() => courseSelectRef.current?.focus())
  }

  function triggerReload() {
    setReloadTick((tick) => tick + 1)
  }

  const columns = COLUMNS_BY_ACTIVITY[filters.activityType] || COLUMNS_BY_ACTIVITY.all
  const activeSort = columns.some((col) => col.key === sort.key) ? sort : { key: 'courseCode', dir: 'asc' }

  function toggleSort(key) {
    setSort((prev) => ({
      key,
      dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc',
    }))
    setPage(1)
  }

  const sortedRows = useMemo(() => {
    const rows = [...(report?.courseBreakdown || [])]
    const colDef = columns.find((col) => col.key === activeSort.key) || columns[0]
    const factor = activeSort.dir === 'asc' ? 1 : -1

    rows.sort((a, b) => {
      const valA = a[colDef.key]
      const valB = b[colDef.key]

      if (colDef.type === 'text') {
        const cmp = String(valA || '').localeCompare(String(valB || ''))
        return cmp !== 0 ? cmp * factor : a.courseCode.localeCompare(b.courseCode)
      }

      if (valA === null && valB === null) return a.courseCode.localeCompare(b.courseCode)
      if (valA === null) return 1
      if (valB === null) return -1
      const diff = Number(valA) - Number(valB)
      return diff !== 0 ? diff * factor : a.courseCode.localeCompare(b.courseCode)
    })
    return rows
  }, [report?.courseBreakdown, columns, activeSort.key, activeSort.dir])

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const visibleRows = sortedRows.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const start = sortedRows.length ? (currentPage - 1) * pageSize + 1 : 0
  const end = Math.min(sortedRows.length, currentPage * pageSize)

  const summary = report?.summary
  const meta = report?.meta
  const courseOptions = report?.filters?.courses || []
  const updatedText = formatStatisticsTimestamp(meta?.generatedAt)
  const preview = Boolean(report?.preview)
  const hasData = Boolean(meta?.hasData)

  const activeCriterionParts = []
  if (filters.courseId !== 'all') {
    const match = courseOptions.find((item) => item.id === filters.courseId)
    activeCriterionParts.push(match ? `${match.code} — ${match.name}` : 'Selected course')
  }
  if (filters.courseStatus !== 'all') activeCriterionParts.push(`${filters.courseStatus} courses`)
  if (filters.activityType !== 'all') {
    const label = ACTIVITY_OPTIONS.find((item) => item.value === filters.activityType)?.label
    if (label) activeCriterionParts.push(label)
  }
  if (filters.period !== 'all') {
    const label = PERIOD_OPTIONS.find((item) => item.value === filters.period)?.label
    if (label) activeCriterionParts.push(label)
  }

  return (
    <AdminShell path="/admin/statistics">
      <div className="user-page stat-page">
        <div className="admin-page-heading">
          <div>
            <p className="admin-eyebrow">Administration / Statistics &amp; reports</p>
            <h1>Statistics &amp; reports</h1>
            <p>Review enrollment volume, submission activity, and quiz outcomes across courses.</p>
          </div>
          <div className="admin-heading-actions">
            {updatedText && !error && (
              <span className="stat-updated-at">Updated {updatedText}</span>
            )}
            <button
              type="button"
              className="admin-button"
              onClick={triggerReload}
              disabled={loading || refreshing}
            >
              <RefreshCw size={15} className={loading || refreshing ? 'admin-spinning' : ''} aria-hidden="true" />
              {loading || refreshing ? 'Loading…' : 'Refresh'}
            </button>
          </div>
        </div>

        {preview && (
          <div className="user-preview-notice">
            <span className="admin-sample-label">Sample data</span>
            <p>You are viewing an offline preview built from browser sample data. Sign in to view live system statistics.</p>
          </div>
        )}

        <section className="admin-panel stat-criteria-panel" aria-label="Statistical criteria">
          <div className="stat-filters">
            <div className="user-field">
              <label htmlFor="stat-course">Course</label>
              <select
                ref={courseSelectRef}
                id="stat-course"
                value={filters.courseId}
                disabled={loading}
                onChange={(event) => updateFilter('courseId', event.target.value)}
              >
                <option value="all">All courses</option>
                {courseOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} — {item.name}{item.status === 'Inactive' ? ' (Inactive)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="user-field">
              <label htmlFor="stat-status">Course status</label>
              <select
                id="stat-status"
                value={filters.courseStatus}
                disabled={loading}
                onChange={(event) => updateFilter('courseStatus', event.target.value)}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="user-field">
              <label htmlFor="stat-activity">Statistical focus</label>
              <select
                id="stat-activity"
                value={filters.activityType}
                disabled={loading}
                onChange={(event) => updateFilter('activityType', event.target.value)}
              >
                {ACTIVITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="user-field">
              <label htmlFor="stat-period">Time range</label>
              <select
                id="stat-period"
                value={filters.period}
                disabled={loading}
                onChange={(event) => updateFilter('period', event.target.value)}
              >
                {PERIOD_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="admin-row-link user-clear stat-reset-btn"
              disabled={!hasActiveFilters || loading}
              onClick={resetFilters}
            >
              Reset filters
            </button>
          </div>

          <div className="stat-criteria-status" role="status" aria-live="polite">
            {refreshing
              ? 'Refreshing statistical summaries…'
              : activeCriterionParts.length > 0
                ? `Filtered by: ${activeCriterionParts.join(' · ')}`
                : 'Showing system-wide academic statistics across all courses and recorded terms.'}
          </div>
        </section>

        {loading ? (
          <div className="stat-loading-stack" aria-busy="true">
            <div className="stat-skeleton-strip" aria-hidden="true">
              {[0, 1, 2, 3].map((idx) => (
                <div key={idx} className="stat-skeleton-metric">
                  <span className="stat-skeleton-sm" />
                  <span className="stat-skeleton-lg" />
                  <span className="stat-skeleton-md" />
                </div>
              ))}
            </div>
            <section className="admin-panel stat-table-panel" aria-hidden="true">
              <div className="user-skeleton">
                {[0, 1, 2, 3].map((row) => <div key={row}><span /><span /><span /><span /></div>)}
              </div>
            </section>
          </div>
        ) : error ? (
          <section className="admin-panel stat-error-panel" role="alert" aria-labelledby="stat-error-title">
            <span className="stat-error-icon" aria-hidden="true">
              <AlertCircle size={24} />
            </span>
            <div>
              <h2 id="stat-error-title">Unable to retrieve statistical data</h2>
              <p>{error}</p>
              <div className="stat-error-actions">
                <button type="button" className="admin-button user-primary" onClick={triggerReload}>
                  Try again
                </button>
                {hasActiveFilters && (
                  <button type="button" className="admin-button" onClick={resetFilters}>
                    Reset filters
                  </button>
                )}
              </div>
            </div>
          </section>
        ) : !hasData ? (
          <section className="admin-panel user-directory" aria-label="No statistical data available">
            <div className="user-empty" role="status">
              <span className="user-empty-icon" aria-hidden="true">
                <BarChart3 size={26} />
              </span>
              <h2>No statistical data is currently available</h2>
              <p>{NO_DATA_COPY[meta?.noDataReason] || 'No statistical records match the selected criteria.'}</p>
              <div className="stat-empty-actions">
                {hasActiveFilters && (
                  <button type="button" className="admin-button user-primary" onClick={resetFilters}>
                    <RotateCcw size={15} aria-hidden="true" />
                    Reset filters
                  </button>
                )}
                {meta?.noDataReason === 'empty_system' && (
                  <Link className="admin-button user-primary" to="/admin/courses">
                    Manage courses
                  </Link>
                )}
              </div>
            </div>
          </section>
        ) : (
          <div className="stat-content" aria-busy={refreshing}>
            <section className="stat-summary-strip" aria-label="Statistical summary metrics">
              <div className="stat-metric">
                <span className="stat-metric-label">Courses</span>
                <strong className="stat-metric-value">{summary.courses.total}</strong>
                <span className="stat-metric-meta">
                  {summary.courses.active} active · {summary.courses.inactive} inactive
                </span>
              </div>

              <div className={`stat-metric ${filters.activityType === 'enrollments' ? 'is-focused' : ''}`}>
                <span className="stat-metric-label">Enrollments</span>
                <strong className="stat-metric-value">{summary.enrollments.total}</strong>
                <span className="stat-metric-meta">
                  {summary.enrollments.uniqueStudents} {summary.enrollments.uniqueStudents === 1 ? 'student' : 'students'} · avg {summary.enrollments.averagePerCourse}/course
                </span>
              </div>

              <div className={`stat-metric ${filters.activityType === 'assignments' ? 'is-focused' : ''}`}>
                <span className="stat-metric-label">Assignment submissions</span>
                <strong className="stat-metric-value">{summary.submissions.total}</strong>
                <span className="stat-metric-meta">
                  {summary.submissions.graded} graded · {summary.submissions.pendingGrading} pending
                  {summary.submissions.averageScorePct !== null ? ` · avg ${summary.submissions.averageScorePct}%` : ''}
                </span>
              </div>

              <div className={`stat-metric ${filters.activityType === 'quizzes' ? 'is-focused' : ''}`}>
                <span className="stat-metric-label">Quiz attempts</span>
                <strong className="stat-metric-value">{summary.quizAttempts.total}</strong>
                <span className="stat-metric-meta">
                  {summary.quizAttempts.completed} completed · {summary.quizAttempts.inProgress} in progress
                  {summary.quizAttempts.averageScorePct !== null ? ` · avg ${summary.quizAttempts.averageScorePct}%` : ''}
                </span>
              </div>
            </section>

            <section className="admin-panel user-directory stat-table-panel" aria-labelledby="stat-table-title">
              <div className="user-directory-heading">
                <div>
                  <h2 id="stat-table-title">
                    Course statistics breakdown <span className="admin-count">{sortedRows.length}</span>
                  </h2>
                  <p>Structured per-course summary across enrolled students, assignments, and quiz attempts.</p>
                </div>
              </div>

              <div className="admin-table-scroll">
                <table className="admin-table stat-table">
                  <caption className="sr-only">Course statistics breakdown table</caption>
                  <thead>
                    <tr>
                      {columns.map((col) => {
                        const isSorted = activeSort.key === col.key
                        const ariaSort = isSorted ? (activeSort.dir === 'asc' ? 'ascending' : 'descending') : 'none'
                        return (
                          <th
                            key={col.key}
                            scope="col"
                            className={col.type === 'text' ? '' : 'is-numeric'}
                            aria-sort={ariaSort}
                          >
                            <button
                              type="button"
                              aria-label={`Sort by ${col.label.toLowerCase()}`}
                              onClick={() => toggleSort(col.key)}
                            >
                              {col.label}
                              <SortIcon active={isSorted} dir={activeSort.dir} />
                            </button>
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row) => (
                      <tr key={row.courseId}>
                        <th scope="row" className="stat-course-cell">
                          <Link
                            className="admin-row-link stat-course-link"
                            to={`/admin/enrollments?courseId=${encodeURIComponent(row.courseId)}`}
                          >
                            {row.courseCode}
                          </Link>
                          <span className="stat-course-name">{row.courseName}</span>
                        </th>
                        <td>
                          <CourseStatus status={row.status} />
                        </td>

                        {filters.activityType === 'all' && (
                          <>
                            <td className={row.instructorName === 'Not assigned' ? 'stat-unassigned' : ''}>
                              {row.instructorName}
                            </td>
                            <td className="is-numeric">{row.enrollments}</td>
                            <td className="is-numeric">
                              {row.submissionsTotal}
                              {row.submissionsPending > 0 && (
                                <span className="stat-sub-note">{row.submissionsPending} pending</span>
                              )}
                            </td>
                            <td className="is-numeric">{formatPct(row.averageAssignmentPct)}</td>
                            <td className="is-numeric">{row.quizAttemptsTotal}</td>
                            <td className="is-numeric">{formatPct(row.averageQuizPct)}</td>
                          </>
                        )}

                        {filters.activityType === 'enrollments' && (
                          <>
                            <td className={row.instructorName === 'Not assigned' ? 'stat-unassigned' : ''}>
                              {row.instructorName}
                            </td>
                            <td className="is-numeric">{row.enrollments}</td>
                          </>
                        )}

                        {filters.activityType === 'assignments' && (
                          <>
                            <td className="is-numeric">{row.assignmentsCount}</td>
                            <td className="is-numeric">{row.submissionsTotal}</td>
                            <td className="is-numeric">{row.submissionsGraded}</td>
                            <td className="is-numeric">{row.submissionsPending}</td>
                            <td className="is-numeric">{formatPct(row.averageAssignmentPct)}</td>
                          </>
                        )}

                        {filters.activityType === 'quizzes' && (
                          <>
                            <td className="is-numeric">{row.quizzesCount}</td>
                            <td className="is-numeric">{row.quizAttemptsTotal}</td>
                            <td className="is-numeric">{row.quizAttemptsCompleted}</td>
                            <td className="is-numeric">{formatPct(row.averageQuizPct)}</td>
                            <td className="is-numeric">{formatPct(row.quizPassRatePct)}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {sortedRows.length > 0 && (
                <div className="user-pagination">
                  <p>
                    {start}–{end} of {sortedRows.length} {sortedRows.length === 1 ? 'course' : 'courses'}
                  </p>
                  <div>
                    <label htmlFor="stat-rows">Rows per page</label>
                    <select
                      id="stat-rows"
                      value={pageSize}
                      onChange={(event) => {
                        setPageSize(Number(event.target.value))
                        setPage(1)
                      }}
                    >
                      {[5, 10, 25, 50].map((size) => (
                        <option key={size} value={size}>{size}</option>
                      ))}
                    </select>
                    <nav aria-label="Course statistics pagination">
                      <button
                        type="button"
                        className="admin-button"
                        disabled={currentPage === 1}
                        aria-label="Previous page"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                      >
                        <ChevronRight size={16} className="user-chevron-back" aria-hidden="true" />
                      </button>
                      <span>Page {currentPage} of {totalPages}</span>
                      <button
                        type="button"
                        className="admin-button"
                        disabled={currentPage === totalPages}
                        aria-label="Next page"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      >
                        <ChevronRight size={16} aria-hidden="true" />
                      </button>
                    </nav>
                  </div>
                </div>
              )}
            </section>

            <StatisticsCharts
              courseBreakdown={report.courseBreakdown}
              totalEnrollments={summary.enrollments.total}
              activityType={filters.activityType}
            />
          </div>
        )}

        <p className="user-guidance">
          <BarChart3 size={16} aria-hidden="true" />
          Read-only report generated from Course, Enrollment, Assignment Submission, and Quiz Attempt records. No system data is modified.
        </p>
      </div>
    </AdminShell>
  )
}
