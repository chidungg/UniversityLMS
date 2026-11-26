import { useState } from 'react'

const MAX_CHART_COURSES = 8

function EnrollmentComparisonChart({ rows, totalEnrollments }) {
  const ranked = [...rows]
    .sort((a, b) => b.enrollments - a.enrollments || a.courseCode.localeCompare(b.courseCode))
    .slice(0, MAX_CHART_COURSES)
  const maxEnrollments = ranked.reduce((max, row) => Math.max(max, row.enrollments), 0)
  const leader = ranked[0]

  return (
    <section className="admin-panel stat-chart-panel" aria-labelledby="stat-enrollment-chart-title">
      <div className="stat-chart-header">
        <h3 id="stat-enrollment-chart-title">Enrollment by course</h3>
        <div className="stat-legend" aria-label="Chart legend">
          <span className="stat-legend-item">
            <span className="stat-swatch is-enrollment" aria-hidden="true" />
            Enrolled students
          </span>
        </div>
      </div>

      {maxEnrollments === 0 ? (
        <div className="stat-chart-empty" role="status">
          <p>No enrollments recorded for the selected criteria.</p>
        </div>
      ) : (
        <>
          <p className="sr-only">
            Enrollment comparison chart showing {ranked.length} courses. Highest enrollment: {leader.courseCode} ({leader.courseName}) with {leader.enrollments} {leader.enrollments === 1 ? 'student' : 'students'}.
          </p>
          <ul className="stat-bar-list">
            {ranked.map((row) => {
              const barPct = maxEnrollments > 0 ? Math.round((row.enrollments / maxEnrollments) * 100) : 0
              const sharePct = totalEnrollments > 0 ? Math.round((row.enrollments / totalEnrollments) * 100) : 0
              return (
                <li key={row.courseId} className="stat-bar-row">
                  <div className="stat-bar-label">
                    <strong>{row.courseCode}</strong>
                    <span>{row.courseName}</span>
                  </div>
                  <div className="stat-bar-track" aria-hidden="true">
                    <div
                      className="stat-bar-fill is-enrollment"
                      style={{ width: `${row.enrollments > 0 ? Math.max(barPct, 3) : 0}%` }}
                    />
                  </div>
                  <div className="stat-bar-value">
                    <strong>{row.enrollments}</strong>
                    <span>{row.enrollments === 1 ? 'student' : 'students'}{totalEnrollments > 0 ? ` · ${sharePct}%` : ''}</span>
                  </div>
                </li>
              )
            })}
          </ul>
          {rows.length > MAX_CHART_COURSES && (
            <p className="stat-chart-footnote">
              Showing top {MAX_CHART_COURSES} of {rows.length} matching courses. See the table above for the complete list.
            </p>
          )}
        </>
      )}
    </section>
  )
}

function AssessmentComparisonChart({ rows, activityType }) {
  const defaultSeries = activityType === 'assignments' ? 'assignments' : activityType === 'quizzes' ? 'quizzes' : 'both'
  const [seriesOverride, setSeriesOverride] = useState(null)
  const activeSeries = activityType === 'all' ? (seriesOverride || 'both') : defaultSeries

  const scoredCourses = rows
    .filter((row) => {
      if (activeSeries === 'assignments') return row.averageAssignmentPct !== null
      if (activeSeries === 'quizzes') return row.averageQuizPct !== null
      return row.averageAssignmentPct !== null || row.averageQuizPct !== null
    })
    .sort((a, b) => {
      const scoreA = Math.max(a.averageAssignmentPct ?? -1, a.averageQuizPct ?? -1)
      const scoreB = Math.max(b.averageAssignmentPct ?? -1, b.averageQuizPct ?? -1)
      return scoreB - scoreA || a.courseCode.localeCompare(b.courseCode)
    })
    .slice(0, MAX_CHART_COURSES)

  const showAssignments = activeSeries === 'both' || activeSeries === 'assignments'
  const showQuizzes = activeSeries === 'both' || activeSeries === 'quizzes'

  return (
    <section className="admin-panel stat-chart-panel" aria-labelledby="stat-assessment-chart-title">
      <div className="stat-chart-header">
        <h3 id="stat-assessment-chart-title">Assessment scores by course</h3>

        <div className="stat-chart-controls">
          <div className="stat-legend" aria-label="Assessment score series">
            {showAssignments && (
              <span className="stat-legend-item">
                <span className="stat-swatch is-assignment" aria-hidden="true" />
                Assignments
              </span>
            )}
            {showQuizzes && (
              <span className="stat-legend-item">
                <span className="stat-swatch is-quiz" aria-hidden="true" />
                Quizzes
              </span>
            )}
          </div>

          {activityType === 'all' && (
            <div className="stat-series-toggle" role="group" aria-label="Filter assessment chart series">
              {[
                { id: 'both', label: 'Both' },
                { id: 'assignments', label: 'Assignments' },
                { id: 'quizzes', label: 'Quizzes' },
              ].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={activeSeries === option.id ? 'is-selected' : ''}
                  aria-pressed={activeSeries === option.id}
                  onClick={() => setSeriesOverride(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {scoredCourses.length === 0 ? (
        <div className="stat-chart-empty" role="status">
          <p>No graded assignment submissions or completed quiz attempts yet for the selected criteria.</p>
        </div>
      ) : (
        <>
          <p className="sr-only">
            Assessment comparison chart displaying percentage scores across {scoredCourses.length} courses.
          </p>
          <div className="stat-scale-header" aria-hidden="true">
            <span>Course</span>
            <div className="stat-scale-ticks">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
            <span>Average</span>
          </div>
          <ul className="stat-bar-list">
            {scoredCourses.map((row) => (
              <li key={row.courseId} className="stat-bar-row is-grouped">
                <div className="stat-bar-label">
                  <strong>{row.courseCode}</strong>
                  <span>{row.courseName}</span>
                </div>
                <div className="stat-bar-stack" aria-hidden="true">
                  {showAssignments && (
                    <div className="stat-bar-track is-compact">
                      {row.averageAssignmentPct !== null && (
                        <div
                          className="stat-bar-fill is-assignment"
                          style={{ width: `${Math.max(row.averageAssignmentPct, 2)}%` }}
                        />
                      )}
                    </div>
                  )}
                  {showQuizzes && (
                    <div className="stat-bar-track is-compact">
                      {row.averageQuizPct !== null && (
                        <div
                          className="stat-bar-fill is-quiz"
                          style={{ width: `${Math.max(row.averageQuizPct, 2)}%` }}
                        />
                      )}
                    </div>
                  )}
                </div>
                <div className="stat-bar-value is-grouped">
                  {showAssignments && (
                    <span>
                      Assign: <strong>{row.averageAssignmentPct !== null ? `${row.averageAssignmentPct}%` : '—'}</strong>
                    </span>
                  )}
                  {showQuizzes && (
                    <span>
                      Quiz: <strong>{row.averageQuizPct !== null ? `${row.averageQuizPct}%` : '—'}</strong>
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {rows.length > MAX_CHART_COURSES && (
            <p className="stat-chart-footnote">
              Showing up to {MAX_CHART_COURSES} courses with recorded scores.
            </p>
          )}
        </>
      )}
    </section>
  )
}

export default function StatisticsCharts({ courseBreakdown, totalEnrollments, activityType }) {
  const showEnrollments = activityType === 'all' || activityType === 'enrollments'
  const showAssessments = activityType === 'all' || activityType === 'assignments' || activityType === 'quizzes'
  const singleColumn = !(showEnrollments && showAssessments)

  return (
    <section aria-labelledby="stat-charts-heading">
      <h2 id="stat-charts-heading" className="sr-only">Course comparison charts</h2>
      <div className={`stat-charts-grid ${singleColumn ? 'is-single' : ''}`}>
        {showEnrollments && (
          <EnrollmentComparisonChart rows={courseBreakdown} totalEnrollments={totalEnrollments} />
        )}
        {showAssessments && (
          <AssessmentComparisonChart rows={courseBreakdown} activityType={activityType} />
        )}
      </div>
    </section>
  )
}
