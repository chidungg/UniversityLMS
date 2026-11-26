import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Clock,
  Award,
  Users,
  CheckCircle2,
  XCircle,
  Search,
  Edit3,
  Eye,
  RotateCcw,
} from "lucide-react";
import { api } from "../../services/api";
import { Breadcrumb } from "../../components/ui/Breadcrumb";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorBanner } from "../../components/ui/ErrorBanner";
import { getCourseTheme } from "../../utils/courseThemes";
import { formatDateTime } from "./components/formatters";

const RESULT_FILTERS = [
  { id: "ALL", label: "All Students" },
  { id: "COMPLETED", label: "Completed" },
  { id: "PASSED", label: "Passed" },
  { id: "FAILED", label: "Needs Review" },
  { id: "NOT_ATTEMPTED", label: "Not Attempted" },
  { id: "IN_PROGRESS", label: "In Progress" },
  { id: "EXPIRED", label: "Expired Attempts" },
];

export function InstructorQuizResultsPage() {
  const { quizId } = useParams();
  return <QuizResults key={quizId} quizId={quizId} />;
}

function QuizResults({ quizId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [inspectRow, setInspectRow] = useState(null);

  const fetchResults = useCallback(async (signal) => {
    setLoading(true);
    setError("");
    try {
      const result = await api.getInstructorQuizResults(quizId, { signal });
      if (!signal?.aborted) setData(result.data);
    } catch (requestError) {
      if (!signal?.aborted) setError(requestError.message || "Failed to load quiz results.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [quizId]);

  useEffect(() => {
    const controller = new AbortController();
    fetchResults(controller.signal);
    return () => controller.abort();
  }, [fetchResults]);

  const roster = useMemo(() => data?.rosterAttempts || [], [data]);

  const filteredRoster = useMemo(() => {
    return roster.filter((row) => {
      if (statusFilter === "PASSED" && row.attempt?.passed !== true) return false;
      if (statusFilter === "FAILED" && row.attempt?.passed !== false) return false;
      if (!["ALL", "PASSED", "FAILED"].includes(statusFilter) && row.status !== statusFilter) return false;

      if (searchQuery.trim()) {
        const term = searchQuery.trim().toLowerCase();
        return (
          row.student.fullName.toLowerCase().includes(term) ||
          row.student.email.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [roster, statusFilter, searchQuery]);

  if (loading) {
    return <LoadingSpinner message="Loading student quiz attempts..." />;
  }

  if (error || !data?.quiz) {
    return (
      <div className="lms-page">
        <Breadcrumb
          items={[
            { label: "Dashboard", to: "/instructor/dashboard" },
            { label: "Quizzes & Assessments", to: "/instructor/quizzes" },
            { label: "Results" },
          ]}
        />
        <ErrorBanner message={error || "Quiz not found."} onRetry={() => fetchResults()} />
      </div>
    );
  }

  const { quiz, summary } = data;
  const theme = getCourseTheme(quiz.courseId);
  const SubjectIcon = theme.icon;
  const questionTotal = quiz.questionCount ?? quiz.questions?.length ?? 0;

  return (
    <div className="lms-page">
      <Breadcrumb
        items={[
          { label: "Dashboard", to: "/instructor/dashboard" },
          { label: "Quizzes & Assessments", to: "/instructor/quizzes" },
          { label: quiz.title },
          { label: "Results" },
        ]}
      />

      <section className="lms-card lms-card-accent" style={{ gap: "14px", padding: "20px 22px" }}>
        <div className="lms-card-head" style={{ alignItems: "flex-start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span className="lms-course-code">
                <SubjectIcon size={13} aria-hidden="true" />
                {quiz.courseId?.courseCode} — {quiz.courseId?.courseName}
              </span>
              <Badge variant={quiz.computedStatus} size="sm" />
            </div>

            <h1 style={{ margin: 0 }}>{quiz.title} — Results</h1>
          </div>

          <Link to={`/instructor/quizzes/${quiz._id}/edit`}>
            <Button variant="secondary" size="sm" icon={Edit3}>
              Edit Quiz &amp; Questions
            </Button>
          </Link>
        </div>

        <div
          className="lms-info-box tabular-nums"
          style={{ display: "flex", flexWrap: "wrap", gap: "20px", padding: "10px 14px" }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <Clock size={14} aria-hidden="true" />
            <span>
              <strong>Time Limit:</strong> {quiz.timeLimit} mins
            </span>
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <Award size={14} aria-hidden="true" />
            <span>
              <strong>Max Score:</strong> {quiz.maxScore} pts ({questionTotal} questions)
            </span>
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <Users size={14} aria-hidden="true" />
            <span>
              <strong>Window:</strong> {formatDateTime(quiz.startTime)} → {formatDateTime(quiz.endTime)}
            </span>
          </span>
        </div>
      </section>

      <div className="lms-metric-strip">
        <div className="lms-metric-cell">
          <span className="lms-metric-label">Attempts Submitted</span>
          <span className="lms-metric-value">
            {summary.totalAttempts} / {summary.totalEnrolled}
          </span>
        </div>
        <div className="lms-metric-cell">
          <span className="lms-metric-label">Average Score</span>
          <span className="lms-metric-value">
            {summary.avgScore !== null ? `${summary.avgScore} / ${quiz.maxScore}` : "—"}
          </span>
        </div>
        <div className="lms-metric-cell">
          <span className="lms-metric-label">Highest Score</span>
          <span className="lms-metric-value">
            {summary.highestScore !== null ? `${summary.highestScore} / ${quiz.maxScore}` : "—"}
          </span>
        </div>
        <div className="lms-metric-cell">
          <span className="lms-metric-label">Pass Rate (≥{summary.passThreshold}%)</span>
          <span className="lms-metric-value">
            {summary.passRate !== null ? `${summary.passRate}%` : "—"}
          </span>
        </div>
      </div>

      <div className="lms-toolbar">
        <div className="lms-toolbar-group">
          {RESULT_FILTERS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`lms-pill-tab ${statusFilter === tab.id ? "active" : ""}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="lms-toolbar-controls">
          <div style={{ width: "240px" }}>
            <Input
              icon={Search}
              aria-label="Search students"
              placeholder="Search student name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {(statusFilter !== "ALL" || searchQuery) && (
            <Button
              variant="secondary"
              size="sm"
              icon={RotateCcw}
              onClick={() => {
                setStatusFilter("ALL");
                setSearchQuery("");
              }}
            >
              Reset
            </Button>
          )}
        </div>
      </div>

      {summary.totalAttempts === 0 && roster.length > 0 && (
        <div className="lms-info-box">No quiz results are available yet.</div>
      )}

      {filteredRoster.length === 0 ? (
        <EmptyState
          icon={Users}
          title={roster.length ? "No matching student results" : "No students or attempts yet"}
          description={roster.length ? "No students matched your current status filter or search keyword." : undefined}
          actionLabel={roster.length ? "Clear Filters" : undefined}
          onAction={() => {
            setStatusFilter("ALL");
            setSearchQuery("");
          }}
        />
      ) : (
        <div className="lms-table-wrap">
          <table className="lms-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Status</th>
                <th>Submitted At</th>
                <th>Duration</th>
                <th className="is-numeric">Score</th>
                <th>Outcome</th>
                <th style={{ textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRoster.map((row) => {
                const att = row.attempt;
                return (
                  <tr key={row.student._id}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: "14px" }}>{row.student.fullName}</div>
                      <div style={{ fontSize: "12px" }}>{row.student.email}</div>
                    </td>

                    <td>
                      <Badge variant={row.status} size="sm" />
                    </td>

                    <td className="tabular-nums" style={{ whiteSpace: "nowrap", fontSize: "13px" }}>
                      {att ? formatDateTime(att.submittedAt) : "—"}
                    </td>

                    <td className="tabular-nums" style={{ fontSize: "13px" }}>
                      {att?.durationTaken || "—"}
                    </td>

                    <td className="is-numeric" style={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                      {att ? `${att.score} / ${att.maxScore} (${att.percentage}%)` : "—"}
                    </td>

                    <td>
                      {att ? <Badge variant={att.passed ? "PASSED" : "FAILED"} size="sm" /> : "—"}
                    </td>

                    <td style={{ textAlign: "right" }}>
                      {att ? (
                        <Button
                          variant="outline"
                          size="sm"
                          icon={Eye}
                          onClick={() => setInspectRow(row)}
                        >
                          Inspect Answers
                        </Button>
                      ) : (
                        <span style={{ fontSize: "12px" }}>
                          {row.status === "NOT_ATTEMPTED" ? "No attempt" : "Not submitted"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        isOpen={Boolean(inspectRow)}
        onClose={() => setInspectRow(null)}
        title={inspectRow ? `Attempt Details — ${inspectRow.student.fullName}` : "Attempt Details"}
        maxWidth="700px"
        footer={
          <Button variant="secondary" size="sm" onClick={() => setInspectRow(null)}>
            Close
          </Button>
        }
      >
        {inspectRow?.attempt && (
          <div className="lms-form-stack">
            <div
              className="lms-info-box tabular-nums"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "10px",
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: "14px" }}>{inspectRow.student.fullName}</div>
                <div style={{ fontSize: "12px" }}>
                  Submitted {formatDateTime(inspectRow.attempt.submittedAt)} · Duration{" "}
                  {inspectRow.attempt.durationTaken ?? "—"}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "15px", fontWeight: 700 }}>
                  {inspectRow.attempt.score} / {inspectRow.attempt.maxScore} pts ({inspectRow.attempt.percentage}%)
                </span>
                <Badge variant={inspectRow.attempt.passed ? "PASSED" : "FAILED"} size="sm" />
              </div>
            </div>

            {!inspectRow.attempt.detailedReview?.length ? (
              <div className="lms-info-box">
                Detailed question breakdown is unavailable for this quiz.
              </div>
            ) : (
              <div className="lms-form-stack" style={{ gap: "10px" }}>
                {inspectRow.attempt.detailedReview.map((item, idx) => (
                  <div
                    key={item.questionId || idx}
                    className={`lms-quiz-review-card ${item.isCorrect ? "is-correct" : "is-incorrect"}`}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: "10px",
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: "14px" }}>
                        Q{idx + 1}. {item.prompt}
                      </div>
                      <span
                        className="tabular-nums"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          fontSize: "12px",
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.isCorrect ? (
                          <CheckCircle2 size={14} aria-hidden="true" />
                        ) : (
                          <XCircle size={14} aria-hidden="true" />
                        )}
                        {item.earnedPoints} / {item.points} pts
                      </span>
                    </div>

                    <div style={{ fontSize: "13px" }}>
                      <strong>Student selected:</strong>{" "}
                      {item.selectedOptionId
                        ? `${item.selectedOptionId}. ${item.selectedOptionText}`
                        : "No answer selected"}
                    </div>

                    {!item.isCorrect && (
                      <div style={{ fontSize: "13px" }}>
                        <strong>Correct answer:</strong> {item.correctOptionId}. {item.correctOptionText}
                      </div>
                    )}

                    {item.explanation && (
                      <div style={{ fontSize: "12px", paddingTop: "4px", borderTop: "1px solid var(--color-border-subtle)" }}>
                        {item.explanation}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
