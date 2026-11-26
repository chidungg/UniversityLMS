import { useMemo, useState } from "react";
import { Search, Users } from "lucide-react";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Input } from "../../../components/ui/Input";

const GRADEBOOK_FILTERS = [
  { id: "ALL", label: "All Students" },
  { id: "HAS_GRADED", label: "Has Graded Work" },
  { id: "NEEDS_GRADING", label: "Needs Grading" },
  { id: "MISSING_WORK", label: "Missing Work" },
];

function AssignmentCell({ item }) {
  return (
    <div className="mon-cell-stack">
      {item.status === "GRADED" && (
        <>
          <span className="mon-score-line">
            {item.grade} / {item.maxScore} <small>({item.percentage}%)</small>
          </span>
          <Badge variant="GRADED" size="sm" />
          {item.isLate && <span className="mon-flag-warning">Late</span>}
        </>
      )}
      {item.status === "SUBMITTED" && (
        <>
          <Badge variant="SUBMITTED" label="Needs Grading" size="sm" />
          {item.isLate && <span className="mon-flag-warning">Submitted late</span>}
        </>
      )}
      {item.status === "NOT_SUBMITTED" && (
        <>
          {item.isPastDue ? (
            <Badge variant="OVERDUE" label="Past Due" size="sm" />
          ) : (
            <Badge variant="NOT_SUBMITTED" size="sm" />
          )}
        </>
      )}
    </div>
  );
}

function QuizCell({ item }) {
  return (
    <div className="mon-cell-stack">
      {item.score !== null ? (
        <>
          <span className="mon-score-line">
            {item.score} / {item.maxScore} <small>({item.percentage}%)</small>
          </span>
          <Badge variant={item.passed ? "PASSED" : "FAILED"} size="sm" />
        </>
      ) : (
        <Badge variant={item.status} size="sm" />
      )}
    </div>
  );
}

export function GradebookTable({ data, onInspectStudent }) {
  const [search, setSearch] = useState("");
  const [scoreFilter, setScoreFilter] = useState("ALL");

  const { summary = {}, assignments = [], quizzes = [], rows = [] } = data;
  const term = search.trim().toLowerCase();

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (term) {
        const match =
          row.student.fullName.toLowerCase().includes(term) ||
          row.student.email.toLowerCase().includes(term);
        if (!match) return false;
      }
      if (scoreFilter === "HAS_GRADED") return row.summary.gradedItemsCount > 0;
      if (scoreFilter === "NEEDS_GRADING") {
        return row.assignmentGrades.some((item) => item.status === "SUBMITTED");
      }
      if (scoreFilter === "MISSING_WORK") {
        return (
          row.assignmentGrades.some((item) => item.status === "NOT_SUBMITTED") ||
          row.quizGrades.some((item) => ["NOT_ATTEMPTED", "EXPIRED"].includes(item.status))
        );
      }
      return true;
    });
  }, [rows, term, scoreFilter]);

  return (
    <section
      id="monitoring-panel-gradebook"
      role="tabpanel"
      aria-labelledby="monitoring-tab-gradebook"
      style={{ display: "grid", gap: "16px" }}
    >
      <div className="mon-summary-strip" aria-label="Gradebook summary metrics">
        <div className="mon-metric">
          <span className="mon-metric-label">Enrolled Students</span>
          <strong className="mon-metric-value">{summary.enrolledCount ?? 0}</strong>
          <span className="mon-metric-meta">
            {summary.assignmentCount ?? 0} assignments · {summary.quizCount ?? 0} quizzes
          </span>
        </div>

        <div className="mon-metric">
          <span className="mon-metric-label">Assignment Submissions</span>
          <strong className="mon-metric-value">{summary.gradedSubmissions ?? 0}</strong>
          <span className="mon-metric-meta">
            graded · {summary.pendingGrading ?? 0} awaiting grading
          </span>
        </div>

        <div className="mon-metric">
          <span className="mon-metric-label">Class Assignment Avg</span>
          <strong className="mon-metric-value">
            {summary.classAssignmentAvgPct !== null && summary.classAssignmentAvgPct !== undefined
              ? `${summary.classAssignmentAvgPct}%`
              : "—"}
          </strong>
          <span className="mon-metric-meta">Graded submissions</span>
        </div>

        <div className="mon-metric">
          <span className="mon-metric-label">Class Quiz Avg</span>
          <strong className="mon-metric-value">
            {summary.classQuizAvgPct !== null && summary.classQuizAvgPct !== undefined
              ? `${summary.classQuizAvgPct}%`
              : "—"}
          </strong>
          <span className="mon-metric-meta">
            {summary.completedQuizAttempts ?? 0} completed
            {summary.quizPassRatePct !== null && summary.quizPassRatePct !== undefined
              ? ` · ${summary.quizPassRatePct}% passed`
              : ""}
          </span>
        </div>
      </div>

      <div className="mon-panel">
        <div className="mon-panel-header">
          <h2>Gradebook</h2>
          <span className="mon-course-meta-text">
            Showing {filteredRows.length} of {rows.length} {rows.length === 1 ? "student" : "students"}
          </span>
        </div>

        <div className="mon-toolbar">
          <div className="mon-filter-pills" role="group" aria-label="Filter gradebook students">
            {GRADEBOOK_FILTERS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`lms-pill-tab ${scoreFilter === option.id ? "active" : ""}`}
                aria-pressed={scoreFilter === option.id}
                onClick={() => setScoreFilter(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="mon-search-box">
            <Input
              type="search"
              icon={Search}
              aria-label="Search students in gradebook"
              placeholder="Search student name or email..."
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
              description="Adjust your search term or selected gradebook filter."
              actionLabel="Clear Filters"
              onAction={() => {
                setSearch("");
                setScoreFilter("ALL");
              }}
            />
          </div>
        ) : (
          <div className="mon-table-scroll">
            <table className="mon-table" aria-label="Course gradebook">
              <thead>
                <tr>
                  <th scope="col" className="mon-sticky-col">Student</th>
                  {assignments.map((assignment) => (
                    <th key={assignment._id} scope="col" className="mon-grade-cell">
                      {assignment.title}
                      <span className="mon-col-meta">
                        Assign · Max {assignment.maxScore}
                        {assignment.avgScore !== null ? ` · Avg ${assignment.avgScore}` : ""}
                      </span>
                    </th>
                  ))}
                  {quizzes.map((quiz) => (
                    <th key={quiz._id} scope="col" className="mon-grade-cell">
                      {quiz.title}
                      <span className="mon-col-meta">
                        Quiz · Max {quiz.maxScore}
                        {quiz.avgScore !== null ? ` · Avg ${quiz.avgScore}` : ""}
                      </span>
                    </th>
                  ))}
                  <th scope="col" className="is-numeric">Assign. Avg</th>
                  <th scope="col" className="is-numeric">Quiz Avg</th>
                  <th scope="col" className="is-numeric">Scored Avg</th>
                  <th scope="col">Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.student._id}>
                    <th scope="row" className="mon-sticky-col">
                      <span className="mon-student-name">{row.student.fullName}</span>
                      <span className="mon-student-email">{row.student.email}</span>
                    </th>
                    {row.assignmentGrades.map((item) => (
                      <td key={item.assignmentId} className="mon-grade-cell">
                        <AssignmentCell item={item} />
                      </td>
                    ))}
                    {row.quizGrades.map((item) => (
                      <td key={item.quizId} className="mon-grade-cell">
                        <QuizCell item={item} />
                      </td>
                    ))}
                    <td className="is-numeric">
                      {row.summary.assignmentAveragePct !== null ? `${row.summary.assignmentAveragePct}%` : "—"}
                    </td>
                    <td className="is-numeric">
                      {row.summary.quizAveragePct !== null ? `${row.summary.quizAveragePct}%` : "—"}
                    </td>
                    <td className="is-numeric">
                      <strong>
                        {row.summary.overallAveragePct !== null ? `${row.summary.overallAveragePct}%` : "—"}
                      </strong>
                    </td>
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
