import { useMemo, useState } from "react";
import { Info, Search, Users } from "lucide-react";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Input } from "../../../components/ui/Input";
import { formatDateTime } from "./formatters";

const PROGRESS_FILTERS = [
  { id: "ALL", label: "All Students" },
  { id: "ON_TRACK", label: "On Track" },
  { id: "NEEDS_ATTENTION", label: "Needs Attention" },
  { id: "NO_ACTIVITY", label: "No Activity" },
];

function attentionBadge(status) {
  if (status === "ON_TRACK") return <Badge variant="PASSED" label="On Track" size="sm" />;
  if (status === "NEEDS_ATTENTION") return <Badge variant="LATE" label="Needs Attention" size="sm" />;
  return <Badge variant="NOT_ATTEMPTED" label="No Activity" size="sm" />;
}

export function LearningProgressPanel({ data, onInspectStudent }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const { summary = {}, rows = [] } = data;
  const term = search.trim().toLowerCase();

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (term) {
        const match =
          row.student.fullName.toLowerCase().includes(term) ||
          row.student.email.toLowerCase().includes(term);
        if (!match) return false;
      }
      if (statusFilter !== "ALL" && row.progress.attentionStatus !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [rows, term, statusFilter]);

  return (
    <section
      id="monitoring-panel-progress"
      role="tabpanel"
      aria-labelledby="monitoring-tab-progress"
      style={{ display: "grid", gap: "16px" }}
    >
      <div className="mon-summary-strip" aria-label="Learning progress summary metrics">
        <div className="mon-metric">
          <span className="mon-metric-label">Enrolled Students</span>
          <strong className="mon-metric-value">{summary.enrolledCount ?? 0}</strong>
          <span className="mon-metric-meta">
            {summary.totalSubmittedAssignments ?? 0} submissions · {summary.totalCompletedQuizzes ?? 0} quiz attempts
          </span>
        </div>

        <div className="mon-metric">
          <span className="mon-metric-label">Tracked Assessments</span>
          <strong className="mon-metric-value">{summary.trackedItemsTotal ?? 0}</strong>
          <span className="mon-metric-meta">
            {summary.assignmentCount ?? 0} assignments · {summary.quizCount ?? 0} quizzes
          </span>
        </div>

        <div className="mon-metric">
          <span className="mon-metric-label">On Track</span>
          <strong className="mon-metric-value">{summary.studentsOnTrack ?? 0}</strong>
          <span className="mon-metric-meta">No past-due missing or failed quizzes</span>
        </div>

        <div className="mon-metric">
          <span className="mon-metric-label">Needs Attention</span>
          <strong className="mon-metric-value">
            {(summary.studentsNeedingAttention ?? 0) + (summary.studentsWithNoActivity ?? 0)}
          </strong>
          <span className="mon-metric-meta">
            {summary.studentsNeedingAttention ?? 0} flagged · {summary.studentsWithNoActivity ?? 0} no activity
          </span>
        </div>
      </div>

      <div className="mon-methodology-note" role="note">
        <Info size={16} aria-hidden="true" />
        <span>
          Progress tracks submitted assignments ({summary.assignmentCount ?? 0}) and completed quizzes ({summary.quizCount ?? 0}). Published course materials ({summary.materialCount ?? 0}) are listed for context and are not view-tracked.
        </span>
      </div>

      <div className="mon-panel">
        <div className="mon-panel-header">
          <div>
            <h2>Student Learning Progress</h2>
            <p>
              Participation and completion counts derived directly from recorded submissions and quiz attempts.
            </p>
          </div>
          <span className="mon-course-meta-text">
            Showing {filteredRows.length} of {rows.length} {rows.length === 1 ? "student" : "students"}
          </span>
        </div>

        <div className="mon-toolbar">
          <div className="mon-filter-pills" role="group" aria-label="Filter by student progress status">
            {PROGRESS_FILTERS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`lms-pill-tab ${statusFilter === option.id ? "active" : ""}`}
                aria-pressed={statusFilter === option.id}
                onClick={() => setStatusFilter(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="mon-search-box">
            <Input
              type="search"
              icon={Search}
              aria-label="Search students in learning progress"
              placeholder="Search student name or email…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        {filteredRows.length === 0 ? (
          <div style={{ padding: "24px" }}>
            <EmptyState
              icon={Users}
              title="No matching students"
              description="Adjust your search term or selected progress filter."
              actionLabel="Clear Filters"
              onAction={() => {
                setSearch("");
                setStatusFilter("ALL");
              }}
            />
          </div>
        ) : (
          <div className="mon-table-scroll">
            <table className="mon-table" aria-label="Student learning progress">
              <thead>
                <tr>
                  <th scope="col">Student</th>
                  <th scope="col">Assignments</th>
                  <th scope="col">Quizzes</th>
                  <th scope="col">Assessed Activity</th>
                  <th scope="col">Last Activity</th>
                  <th scope="col">Status</th>
                  <th scope="col">Inspect</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const { progress } = row;
                  const pct = progress.completionRatePct ?? 0;
                  return (
                    <tr key={row.student._id}>
                      <th scope="row">
                        <span className="mon-student-name">{row.student.fullName}</span>
                        <span className="mon-student-email">{row.student.email}</span>
                      </th>
                      <td>
                        <strong>
                          {progress.assignmentsSubmitted} / {progress.assignmentsTotal}
                        </strong>{" "}
                        submitted
                        <span className="mon-breakdown-note">
                          {progress.assignmentsGraded} graded · {progress.assignmentsPendingGrading} pending
                        </span>
                        {progress.assignmentsLate > 0 && (
                          <span className="mon-flag-warning" style={{ display: "block", marginTop: "2px" }}>
                            {progress.assignmentsLate} late submission{progress.assignmentsLate === 1 ? "" : "s"}
                          </span>
                        )}
                        {progress.assignmentsMissingPastDue > 0 && (
                          <span className="mon-flag-danger" style={{ display: "block", marginTop: "2px" }}>
                            {progress.assignmentsMissingPastDue} missing past due
                          </span>
                        )}
                      </td>
                      <td>
                        <strong>
                          {progress.quizzesCompleted} / {progress.quizzesTotal}
                        </strong>{" "}
                        completed
                        <span className="mon-breakdown-note">
                          {progress.quizzesPassed} passed
                          {progress.quizzesInProgress > 0 ? ` · ${progress.quizzesInProgress} in progress` : ""}
                        </span>
                        {progress.quizzesMissedExpired > 0 && (
                          <span className="mon-flag-danger" style={{ display: "block", marginTop: "2px" }}>
                            {progress.quizzesMissedExpired} expired unsubmitted
                          </span>
                        )}
                      </td>
                      <td className="mon-progress-cell">
                        <div className="mon-progress-label">
                          <span>
                            {progress.trackedItemsCompleted} / {progress.trackedItemsTotal} completed
                          </span>
                          <span>{progress.completionRatePct !== null ? `${pct}%` : "—"}</span>
                        </div>
                        <div className="mon-progress-track" aria-hidden="true">
                          <div className="mon-progress-fill" style={{ width: `${pct}%` }} />
                        </div>
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {progress.lastActivityAt ? formatDateTime(progress.lastActivityAt) : "—"}
                      </td>
                      <td>{attentionBadge(progress.attentionStatus)}</td>
                      <td>
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label={`Details for ${row.student.fullName}`}
                          onClick={() => onInspectStudent(row)}
                        >
                          Details
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
