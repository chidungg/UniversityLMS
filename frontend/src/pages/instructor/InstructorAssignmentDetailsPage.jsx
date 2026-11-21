import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  Clock,
  Award,
  Users,
  CheckCircle2,
  FileText,
  Download,
  Search,
  Edit3,
  ClipboardCheck,
  RotateCcw,
} from "lucide-react";
import { api } from "../../services/api";
import { Breadcrumb } from "../../components/ui/Breadcrumb";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Textarea } from "../../components/ui/Textarea";
import { Modal } from "../../components/ui/Modal";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorBanner } from "../../components/ui/ErrorBanner";
import { getCourseTheme } from "../../utils/courseThemes";
import { AssignmentFormModal } from "./components/AssignmentFormModal";
import { SuccessBanner } from "./components/SuccessBanner";
import { formatDateTime, formatFileSize } from "./components/formatters";

const SUBMISSION_FILTERS = [
  { id: "ALL", label: "All Students" },
  { id: "SUBMITTED", label: "Needs Grading" },
  { id: "GRADED", label: "Graded" },
  { id: "LATE", label: "Late" },
  { id: "NOT_SUBMITTED", label: "Not Submitted" },
];

const QUICK_FEEDBACK_PRESETS = [
  "Meets all requirements cleanly. Well-structured implementation.",
  "Good effort; review edge-case validation and formatting.",
  "Incomplete submission. Please review the assignment instructions.",
];

export const InstructorAssignmentDetailsPage = () => {
  const { assignmentId } = useParams();

  const [data, setData] = useState(null);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedbackBanner, setFeedbackBanner] = useState("");

  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Grading Modal State
  const [gradingRow, setGradingRow] = useState(null);
  const [gradeValue, setGradeValue] = useState("");
  const [gradeComment, setGradeComment] = useState("");
  const [gradeError, setGradeError] = useState("");
  const [savingGrade, setSavingGrade] = useState(false);

  const fetchDetails = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [detailRes, courseRes] = await Promise.all([
        api.getInstructorAssignmentDetails(assignmentId),
        api.getInstructorCourses(),
      ]);
      if (detailRes.status === "success") {
        setData(detailRes.data);
      }
      if (courseRes.status === "success") {
        setCourses(courseRes.data);
      }
    } catch (err) {
      setError(err.message || "Failed to load assignment submissions.");
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const openGradingModal = (row) => {
    setGradingRow(row);
    setGradeValue(
      row.submission?.grade !== null && row.submission?.grade !== undefined
        ? String(row.submission.grade)
        : ""
    );
    setGradeComment(row.submission?.feedback || "");
    setGradeError("");
  };

  const roster = useMemo(() => data?.rosterSubmissions || [], [data]);
  const assignment = data?.assignment;

  const filteredRoster = useMemo(() => {
    return roster.filter((row) => {
      if (statusFilter === "SUBMITTED" && row.status !== "SUBMITTED") return false;
      if (statusFilter === "GRADED" && row.status !== "GRADED") return false;
      if (statusFilter === "NOT_SUBMITTED" && row.status !== "NOT_SUBMITTED") return false;
      if (statusFilter === "LATE" && !row.isLate) return false;

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

  const nextUngradedRow = useMemo(() => {
    if (!gradingRow) return null;
    return roster.find(
      (r) => r.status === "SUBMITTED" && r.student._id !== gradingRow.student._id
    );
  }, [roster, gradingRow]);

  const saveGrade = async (moveToNext = false) => {
    if (!gradingRow || !assignment) return;
    const maxScore = assignment.maxScore ?? 10;
    if (gradeValue.trim() === "") {
      setGradeError("Please enter a numeric grade.");
      return;
    }
    const num = Number(gradeValue);
    if (Number.isNaN(num) || num < 0 || num > maxScore) {
      setGradeError(`Grade must be between 0 and ${maxScore}.`);
      return;
    }

    setSavingGrade(true);
    setGradeError("");
    try {
      await api.gradeSubmission(assignment._id, {
        submissionId: gradingRow.submission?._id,
        studentId: gradingRow.student._id,
        grade: num,
        feedback: gradeComment,
      });
      setFeedbackBanner(`Saved grade (${num}/${maxScore}) for ${gradingRow.student.fullName}.`);
      const nextTarget = moveToNext ? nextUngradedRow : null;
      await fetchDetails();
      if (nextTarget) {
        openGradingModal(nextTarget);
      } else {
        setGradingRow(null);
      }
    } catch (err) {
      setGradeError(err.message || "Failed to save grade.");
    } finally {
      setSavingGrade(false);
    }
  };

  const handleSaveAssignment = async (payload, id) => {
    await api.updateAssignment(id, payload);
    setFeedbackBanner("Assignment details updated.");
    await fetchDetails();
  };

  const handleDownloadSubmissionFile = (submission) => {
    const text = `Submission File: ${submission.fileName || "submission.txt"}\nSubmitted At: ${submission.submittedAt}\n\n${submission.content || ""}`;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = submission.fileName || "student_submission.txt";
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  if (loading) {
    return <LoadingSpinner message="Loading assignment and student submissions..." />;
  }

  if (error || !assignment) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <Breadcrumb
          items={[
            { label: "Dashboard", to: "/instructor/dashboard" },
            { label: "Assignments", to: "/instructor/assignments" },
            { label: "Submissions" },
          ]}
        />
        <ErrorBanner message={error || "Assignment not found."} onRetry={fetchDetails} />
      </div>
    );
  }

  const theme = getCourseTheme(assignment.courseId);
  const SubjectIcon = theme.icon;
  const submittedCount = roster.filter((r) => r.submission).length;
  const gradedCount = roster.filter((r) => r.status === "GRADED").length;
  const ungradedCount = roster.filter((r) => r.status === "SUBMITTED").length;
  const notSubmittedCount = roster.filter((r) => r.status === "NOT_SUBMITTED").length;
  const isPastDue = new Date(assignment.dueDate) < new Date();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <Breadcrumb
        items={[
          { label: "Dashboard", to: "/instructor/dashboard" },
          { label: "Assignments & Grading", to: "/instructor/assignments" },
          { label: assignment.title },
        ]}
      />

      <SuccessBanner message={feedbackBanner} onDismiss={() => setFeedbackBanner("")} />

      {/* Assignment Header Card */}
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
          gap: "16px",
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
                {assignment.courseId?.courseCode} — {assignment.courseId?.courseName}
              </span>
              <Badge
                variant={isPastDue ? "EXPIRED" : "AVAILABLE"}
                label={isPastDue ? "Past Due" : "Open for Submission"}
                size="sm"
              />
            </div>

            <h1 style={{ fontSize: "22px", fontWeight: 700, color: "var(--color-text)" }}>
              {assignment.title}
            </h1>
          </div>

          <Button variant="secondary" size="sm" icon={Edit3} onClick={() => setEditModalOpen(true)}>
            Edit Assignment
          </Button>
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
              <strong>Due Date:</strong> {formatDateTime(assignment.dueDate)}
            </span>
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Award size={15} style={{ color: "var(--color-primary-700)" }} />
            <span>
              <strong>Max Score:</strong> {assignment.maxScore ?? 10} pts
            </span>
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Users size={15} style={{ color: "var(--color-primary-700)" }} />
            <span>
              <strong>Enrolled:</strong> {roster.length} students
            </span>
          </span>
        </div>

        {assignment.description && (
          <p style={{ fontSize: "14px", color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
            {assignment.description}
          </p>
        )}
      </div>

      {/* 5-Metric Submission Strip */}
      <div
        className="tabular-nums"
        style={{
          backgroundColor: "var(--color-surface)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--color-border)",
          padding: "14px 20px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: "16px",
        }}
      >
        <div>
          <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--color-text)" }}>{roster.length}</div>
          <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Enrolled Students</div>
        </div>
        <div>
          <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--color-primary-700)" }}>{submittedCount}</div>
          <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Submitted</div>
        </div>
        <div>
          <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--color-success)" }}>{gradedCount}</div>
          <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Graded</div>
        </div>
        <div>
          <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--color-warning)" }}>{ungradedCount}</div>
          <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Needs Grading</div>
        </div>
        <div>
          <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--color-text-secondary)" }}>{notSubmittedCount}</div>
          <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Not Submitted</div>
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
          {SUBMISSION_FILTERS.map((tab) => (
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

      {/* Student Submissions Table */}
      {filteredRoster.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No matching student submissions"
          description="No students matched the selected submission filter or search query."
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
                <th style={{ padding: "12px 16px" }}>Submission Content</th>
                <th style={{ padding: "12px 16px" }}>Grade</th>
                <th style={{ padding: "12px 18px", textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRoster.map((row, idx) => {
                const sub = row.submission;
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
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                        <Badge variant={row.status} size="sm" />
                        {row.isLate && <Badge variant="LATE" size="sm" />}
                      </div>
                    </td>

                    <td className="tabular-nums" style={{ padding: "14px 16px", fontSize: "13px", color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>
                      {sub ? formatDateTime(sub.submittedAt) : "—"}
                    </td>

                    <td style={{ padding: "14px 16px", maxWidth: "280px" }}>
                      {sub ? (
                        <div>
                          {sub.fileName && (
                            <div
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "5px",
                                fontSize: "12px",
                                fontWeight: 600,
                                color: "var(--color-primary-700)",
                              }}
                            >
                              <FileText size={13} />
                              <span>{sub.fileName}</span>
                            </div>
                          )}
                          {sub.content && (
                            <p
                              style={{
                                fontSize: "12px",
                                color: "var(--color-text-secondary)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                marginTop: "2px",
                              }}
                            >
                              {sub.content}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                          No submission uploaded
                        </span>
                      )}
                    </td>

                    <td className="tabular-nums" style={{ padding: "14px 16px", fontSize: "14px", fontWeight: 600, whiteSpace: "nowrap" }}>
                      {sub && sub.grade !== null && sub.grade !== undefined ? (
                        <span style={{ color: "var(--color-success)" }}>
                          {sub.grade} / {assignment.maxScore ?? 10}
                        </span>
                      ) : (
                        <span style={{ color: "var(--color-text-muted)" }}>— / {assignment.maxScore ?? 10}</span>
                      )}
                    </td>

                    <td style={{ padding: "14px 18px", textAlign: "right" }}>
                      <Button
                        variant={row.status === "SUBMITTED" ? "primary" : "outline"}
                        size="sm"
                        icon={ClipboardCheck}
                        onClick={() => openGradingModal(row)}
                      >
                        {row.status === "GRADED"
                          ? "Edit Grade"
                          : row.status === "SUBMITTED"
                            ? "Grade"
                            : "Record Grade"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Grading Modal */}
      <Modal
        isOpen={Boolean(gradingRow)}
        onClose={() => setGradingRow(null)}
        title={gradingRow ? `Grade Submission — ${gradingRow.student.fullName}` : "Grade Submission"}
        maxWidth="660px"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setGradingRow(null)} disabled={savingGrade}>
              Cancel
            </Button>
            {nextUngradedRow && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => saveGrade(true)}
                loading={savingGrade}
              >
                Save & Grade Next
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              icon={CheckCircle2}
              onClick={() => saveGrade(false)}
              loading={savingGrade}
            >
              Save Grade
            </Button>
          </>
        }
      >
        {gradingRow && (
          <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            {/* Student & Timing Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "8px",
                padding: "12px 14px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--color-surface-soft)",
                border: "1px solid var(--color-border)",
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--color-text)" }}>
                  {gradingRow.student.fullName}
                </div>
                <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                  {gradingRow.student.email}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {gradingRow.submission ? (
                  <>
                    <span className="tabular-nums" style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
                      Submitted {formatDateTime(gradingRow.submission.submittedAt)}
                    </span>
                    <Badge variant={gradingRow.isLate ? "LATE" : "ON_TIME"} size="sm" />
                  </>
                ) : (
                  <Badge variant="NOT_SUBMITTED" size="sm" />
                )}
              </div>
            </div>

            {/* Student Submitted Content */}
            {gradingRow.submission ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <h3 style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", marginBottom: "6px" }}>
                    Submitted Solution Text
                  </h3>
                  <div
                    style={{
                      padding: "12px 14px",
                      borderRadius: "var(--radius-sm)",
                      backgroundColor: "var(--color-page)",
                      border: "1px solid var(--color-border)",
                      fontSize: "14px",
                      color: "var(--color-text)",
                      lineHeight: 1.55,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {gradingRow.submission.content || "No text description submitted."}
                  </div>
                </div>

                {gradingRow.submission.fileName && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--color-border)",
                      backgroundColor: "var(--color-surface)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                      <FileText size={16} style={{ color: "var(--color-primary-700)", flexShrink: 0 }} />
                      <span style={{ fontSize: "13px", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {gradingRow.submission.fileName}
                      </span>
                      {gradingRow.submission.fileSize && (
                        <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                          ({formatFileSize(gradingRow.submission.fileSize)})
                        </span>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      icon={Download}
                      onClick={() => handleDownloadSubmissionFile(gradingRow.submission)}
                    >
                      Download
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: "var(--color-warning-bg)",
                  border: "1px solid #FDE68A",
                  color: "var(--color-warning)",
                  fontSize: "13px",
                }}
              >
                This student has not uploaded a submission yet. You may still enter a manual grade (e.g. 0).
              </div>
            )}

            {/* Grading Inputs */}
            <div style={{ display: "flex", flexDirection: "column", gap: "14px", paddingTop: "8px", borderTop: "1px solid var(--color-border)" }}>
              <Input
                label={`Score (0 – ${assignment.maxScore ?? 10}) *`}
                type="number"
                min="0"
                max={assignment.maxScore ?? 10}
                step="0.5"
                value={gradeValue}
                onChange={(e) => {
                  setGradeValue(e.target.value);
                  if (gradeError) setGradeError("");
                }}
                error={gradeError}
                placeholder={`Enter score out of ${assignment.maxScore ?? 10}`}
              />

              <Textarea
                label="Instructor Feedback"
                rows={4}
                value={gradeComment}
                onChange={(e) => setGradeComment(e.target.value)}
                placeholder="Provide constructive feedback for the student..."
              />

              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {QUICK_FEEDBACK_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setGradeComment(preset)}
                    style={{
                      fontSize: "11px",
                      padding: "4px 8px",
                      borderRadius: "4px",
                      border: "1px solid var(--color-border)",
                      backgroundColor: "var(--color-surface-soft)",
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    + {preset.slice(0, 36)}…
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <AssignmentFormModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        assignment={assignment}
        courses={courses}
        onSave={handleSaveAssignment}
      />
    </div>
  );
};
