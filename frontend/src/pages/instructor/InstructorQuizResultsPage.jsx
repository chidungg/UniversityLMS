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
];

export const InstructorQuizResultsPage = () => {
  const { quizId } = useParams();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [inspectRow, setInspectRow] = useState(null);

  const fetchResults = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.getInstructorQuizResults(quizId);
      if (res.status === "success") {
        setData(res.data);
      }
    } catch (err) {
      setError(err.message || "Failed to load quiz results.");
    } finally {
      setLoading(false);
    }
  }, [quizId]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  const roster = useMemo(() => data?.rosterAttempts || [], [data]);

  const filteredRoster = useMemo(() => {
    return roster.filter((row) => {
      if (statusFilter === "COMPLETED" && row.status !== "COMPLETED") return false;
      if (statusFilter === "NOT_ATTEMPTED" && row.status !== "NOT_ATTEMPTED") return false;
      if (statusFilter === "PASSED" && !(row.attempt && row.attempt.passed)) return false;
      if (statusFilter === "FAILED" && !(row.attempt && !row.attempt.passed)) return false;

      if (searchQuery.trim()) {
        const term = searchQuery.trim().toLowerCase();
        return (
          row.student.fullName.toLowerCase().includes(term) ||
          row.student.email.toLowerCase().includes(term) ||
          (row.student.studentCode && row.student.studentCode.toLowerCase().includes(term))
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
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <Breadcrumb
          items={[
            { label: "Dashboard", to: "/instructor/dashboard" },
            { label: "Quizzes & Assessments", to: "/instructor/quizzes" },
            { label: "Results" },
          ]}
        />
        <ErrorBanner message={error || "Quiz not found."} onRetry={fetchResults} />
      </div>
    );
  }

  const { quiz, summary } = data;
  const theme = getCourseTheme(quiz.courseId);
  const SubjectIcon = theme.icon;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <Breadcrumb
        items={[
          { label: "Dashboard", to: "/instructor/dashboard" },
          { label: "Quizzes & Assessments", to: "/instructor/quizzes" },
          { label: quiz.title },
          { label: "Results" },
        ]}
      />

      {/* Quiz Header Card */}
      <div
        className="lms-course-card"
        style={{
          backgroundColor: "var(--color-surface)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--color-border)",
          borderTop: `4px solid ${theme.color}`,
          padding: "22px 24px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px", flexWrap: "wrap" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: theme.badgeColor,
                  backgroundColor: theme.badgeBg,
                  border: `1px solid ${theme.border}`,
                  padding: "3px 8px",
                  borderRadius: "4px",
                }}
              >
                <SubjectIcon size={13} />
                {quiz.courseId?.courseCode} — {quiz.courseId?.courseName}
              </span>
              <Badge variant={quiz.computedStatus} size="sm" />
            </div>

            <h1 style={{ fontSize: "22px", fontWeight: 700, color: "var(--color-text)" }}>
              {quiz.title} — Results
            </h1>
          </div>

          <Link to={`/instructor/quizzes/${quiz._id}/edit`}>
            <Button variant="secondary" size="sm" icon={Edit3}>
              Edit Quiz & Questions
            </Button>
          </Link>
        </div>

        <div
          className="tabular-nums"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "24px",
            padding: "12px 16px",
            backgroundColor: "var(--color-surface-soft)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--color-border)",
            fontSize: "13px",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Clock size={15} style={{ color: "var(--color-primary-700)" }} />
            <span>
              <strong>Time Limit:</strong> {quiz.timeLimit} mins
            </span>
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Award size={15} style={{ color: "var(--color-primary-700)" }} />
            <span>
              <strong>Max Score:</strong> {quiz.maxScore ?? 10} pts ({quiz.questions?.length || 0} questions)
            </span>
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Users size={15} style={{ color: "var(--color-primary-700)" }} />
            <span>
              <strong>Window:</strong> {formatDateTime(quiz.startTime)} → {formatDateTime(quiz.endTime)}
            </span>
          </span>
        </div>
      </div>

      {/* 4-Metric Summary Strip */}
      <div
        className="tabular-nums"
        style={{
          backgroundColor: "var(--color-surface)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--color-border)",
          padding: "16px 24px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: "20px",
        }}
      >
        <div>
          <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--color-text)" }}>
            {summary.totalAttempts} / {summary.totalEnrolled}
          </div>
          <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Attempts Submitted</div>
        </div>
        <div>
          <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--color-primary-700)" }}>
            {summary.avgScore !== null ? `${summary.avgScore} / ${quiz.maxScore ?? 10}` : "—"}
          </div>
          <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Average Score</div>
        </div>
        <div>
          <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--color-success)" }}>
            {summary.highestScore !== null ? `${summary.highestScore} / ${quiz.maxScore ?? 10}` : "—"}
          </div>
          <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Highest Score</div>
        </div>
        <div>
          <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--color-text)" }}>
            {summary.passRate !== null ? `${summary.passRate}%` : "—"}
          </div>
          <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Pass Rate (≥50%)</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          backgroundColor: "var(--color-surface)",
          padding: "14px 16px",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--color-border)",
        }}
      >
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
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

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <div style={{ width: "240px" }}>
            <Input
              icon={Search}
              placeholder="Search student name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ height: "36px" }}
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

      {/* Results Table */}
      {filteredRoster.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No matching student results"
          description="No students matched your current status filter or search keyword."
          actionLabel="Clear Filters"
          onAction={() => {
            setStatusFilter("ALL");
            setSearchQuery("");
          }}
        />
      ) : (
        <div
          style={{
            backgroundColor: "var(--color-surface)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--color-border)",
            overflowX: "auto",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr
                style={{
                  backgroundColor: "var(--color-surface-soft)",
                  borderBottom: "1px solid var(--color-border)",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "var(--color-text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                <th style={{ padding: "12px 18px" }}>Student</th>
                <th style={{ padding: "12px 16px" }}>Status</th>
                <th style={{ padding: "12px 16px" }}>Submitted At</th>
                <th style={{ padding: "12px 16px" }}>Duration</th>
                <th style={{ padding: "12px 16px" }}>Score</th>
                <th style={{ padding: "12px 16px" }}>Outcome</th>
                <th style={{ padding: "12px 18px", textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRoster.map((row, idx) => {
                const att = row.attempt;
                return (
                  <tr
                    key={row.student._id}
                    className="lms-table-row"
                    style={{
                      borderBottom: idx === filteredRoster.length - 1 ? "none" : "1px solid var(--color-border-subtle)",
                    }}
                  >
                    <td style={{ padding: "14px 18px" }}>
                      <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--color-text)" }}>
                        {row.student.fullName}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                        {row.student.studentCode ? `${row.student.studentCode} · ` : ""}
                        {row.student.email}
                      </div>
                    </td>

                    <td style={{ padding: "14px 16px" }}>
                      <Badge variant={row.status} size="sm" />
                    </td>

                    <td className="tabular-nums" style={{ padding: "14px 16px", fontSize: "13px", color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>
                      {att ? formatDateTime(att.submittedAt) : "—"}
                    </td>

                    <td className="tabular-nums" style={{ padding: "14px 16px", fontSize: "13px", color: "var(--color-text-muted)" }}>
                      {att?.durationTaken || "—"}
                    </td>

                    <td className="tabular-nums" style={{ padding: "14px 16px", fontSize: "14px", fontWeight: 600 }}>
                      {att ? `${att.score} / ${att.maxScore} (${att.percentage}%)` : "—"}
                    </td>

                    <td style={{ padding: "14px 16px" }}>
                      {att ? (
                        <Badge variant={att.passed ? "PASSED" : "FAILED"} size="sm" />
                      ) : (
                        <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>—</span>
                      )}
                    </td>

                    <td style={{ padding: "14px 18px", textAlign: "right" }}>
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
                        <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>No attempt</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Inspect Student Attempt Modal */}
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
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div
              className="tabular-nums"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "10px",
                padding: "12px 14px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--color-surface-soft)",
                border: "1px solid var(--color-border)",
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: "14px" }}>{inspectRow.student.fullName}</div>
                <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                  Submitted {formatDateTime(inspectRow.attempt.submittedAt)} · Duration {inspectRow.attempt.durationTaken}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "16px", fontWeight: 700, color: "var(--color-primary-700)" }}>
                  {inspectRow.attempt.score} / {inspectRow.attempt.maxScore} pts ({inspectRow.attempt.percentage}%)
                </span>
                <Badge variant={inspectRow.attempt.passed ? "PASSED" : "FAILED"} size="sm" />
              </div>
            </div>

            {inspectRow.attempt.detailedReview?.length === 0 ? (
              <p style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>
                Detailed question breakdown is unavailable for this quiz.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {inspectRow.attempt.detailedReview.map((item, idx) => (
                  <div
                    key={item.questionId || idx}
                    style={{
                      padding: "14px 16px",
                      borderRadius: "var(--radius-md)",
                      border: `1px solid ${item.isCorrect ? "#A7F3D0" : "#FECACA"}`,
                      backgroundColor: item.isCorrect ? "#F0FDF4" : "#FEF2F2",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
                      <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--color-text)" }}>
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
                          color: item.isCorrect ? "var(--color-success)" : "var(--color-danger)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.isCorrect ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                        {item.earnedPoints} / {item.points} pts
                      </span>
                    </div>

                    <div style={{ fontSize: "13px", color: "var(--color-text)" }}>
                      <strong>Student selected:</strong>{" "}
                      {item.selectedOptionId ? `${item.selectedOptionId}. ${item.selectedOptionText}` : "No answer selected"}
                    </div>

                    {!item.isCorrect && (
                      <div style={{ fontSize: "13px", color: "var(--color-success)" }}>
                        <strong>Correct answer:</strong> {item.correctOptionId}. {item.correctOptionText}
                      </div>
                    )}

                    {item.explanation && (
                      <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
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
};
