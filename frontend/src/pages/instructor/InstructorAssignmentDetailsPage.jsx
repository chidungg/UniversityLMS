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
import { downloadBlob } from "../../utils/downloadBlob";
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

export function InstructorAssignmentDetailsPage() {
  const { assignmentId } = useParams();
  return <AssignmentDetails key={assignmentId} assignmentId={assignmentId} />;
}

function AssignmentDetails({ assignmentId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedbackBanner, setFeedbackBanner] = useState("");

  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [editModalOpen, setEditModalOpen] = useState(false);

  const [gradingRow, setGradingRow] = useState(null);
  const [gradeValue, setGradeValue] = useState("");
  const [gradeComment, setGradeComment] = useState("");
  const [gradeError, setGradeError] = useState("");
  const [savingGrade, setSavingGrade] = useState(false);
  const [gradeNeedsRefresh, setGradeNeedsRefresh] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);
  const [submissionAttempt, setSubmissionAttempt] = useState(0);
  const [downloadError, setDownloadError] = useState("");
  const [downloading, setDownloading] = useState(false);

  const fetchDetails = useCallback(async (signal) => {
    setLoading(true);
    setError("");
    try {
      const result = await api.getInstructorAssignmentDetails(assignmentId, { signal });
      if (!signal?.aborted) setData(result.data);
      return result.data;
    } catch (requestError) {
      if (!signal?.aborted) setError(requestError.message || "Failed to load assignment submissions.");
      return null;
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    const controller = new AbortController();
    fetchDetails(controller.signal);
    return () => controller.abort();
  }, [fetchDetails]);

  const submissionId = gradingRow?.submission?._id;
  useEffect(() => {
    if (!submissionId) return;
    const controller = new AbortController();
    api.getInstructorAssignmentSubmission(assignmentId, submissionId, { signal: controller.signal })
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        setSubmissionResult({ data });
        setGradeValue(data.grade == null ? "" : String(data.grade));
        setGradeComment(data.feedback || "");
      })
      .catch((error) => {
        if (!controller.signal.aborted) setSubmissionResult({ error });
      });
    return () => controller.abort();
  }, [assignmentId, submissionId, submissionAttempt]);
  const reviewedSubmission = submissionResult?.data;

  const openGradingModal = (row) => {
    if (!row.submission) return;
    setSubmissionResult(null);
    setGradingRow(row);
    setGradeError("");
    setGradeNeedsRefresh(false);
    setDownloadError("");
  };

  const roster = useMemo(() => data?.rosterSubmissions || [], [data]);
  const assignment = data?.assignment;
  const assignedCourse = assignment?.courseId;
  const courses = useMemo(() => assignedCourse ? [assignedCourse] : [], [assignedCourse]);
  const canGrade = assignedCourse?.isActive !== false;

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
          row.student.email.toLowerCase().includes(term)
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
    if (!reviewedSubmission || !assignment || !canGrade || gradeNeedsRefresh) return;
    const maxScore = assignment.maxScore ?? 10;
    if (gradeValue.trim() === "") {
      setGradeError("Please enter a numeric grade.");
      return;
    }
    const num = Number(gradeValue);
    if (!Number.isFinite(num) || num < 0 || num > maxScore) {
      setGradeError(`Grade must be between 0 and ${maxScore}.`);
      return;
    }

    setSavingGrade(true);
    setGradeError("");
    try {
      await api.gradeSubmission(assignment._id, reviewedSubmission._id, {
        grade: num,
        feedback: gradeComment,
        revision: reviewedSubmission.revision,
      });
      setFeedbackBanner(`Saved grade (${num}/${maxScore}) for ${gradingRow.student.fullName}.`);
      const currentSubmissionId = reviewedSubmission._id;
      setGradingRow(null);
      const refreshed = await fetchDetails();
      const next = moveToNext && refreshed?.rosterSubmissions.find(
        (row) => row.status === "SUBMITTED" && row.submission._id !== currentSubmissionId
      );
      if (next) openGradingModal(next);
    } catch (error) {
      setGradeError(error.message || "Failed to save grade.");
      setGradeNeedsRefresh(error.code === "SUBMISSION_CHANGED");
    } finally {
      setSavingGrade(false);
    }
  };

  const handleSaveAssignment = async (payload, id) => {
    await api.updateAssignment(id, payload);
    setFeedbackBanner("Assignment details updated.");
    await fetchDetails();
  };

  const handleDownloadSubmissionFile = async (submission) => {
    setDownloadError("");
    setDownloading(true);
    try {
      const blob = await api.downloadInstructorSubmissionBlob(assignmentId, submission._id);
      downloadBlob(blob, submission.fileName || "submission");
    } catch (error) {
      setDownloadError(error.message || "Failed to download the submission.");
    } finally {
      setDownloading(false);
    }
  };

  const reloadSubmission = () => {
    setSubmissionResult(null);
    setGradeNeedsRefresh(false);
    setGradeError("");
    setSubmissionAttempt((current) => current + 1);
  };

  if (loading) {
    return <LoadingSpinner message="Loading assignment and student submissions..." />;
  }

  if (error || !assignment) {
    return (
      <div className="lms-page">
        <Breadcrumb
          items={[
            { label: "Dashboard", to: "/instructor/dashboard" },
            { label: "Assignments", to: "/instructor/assignments" },
            { label: "Submissions" },
          ]}
        />
        <ErrorBanner message={error || "Assignment not found."} onRetry={() => fetchDetails()} />
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
    <div className="lms-page">
      <Breadcrumb
        items={[
          { label: "Dashboard", to: "/instructor/dashboard" },
          { label: "Assignments & Grading", to: "/instructor/assignments" },
          { label: assignment.title },
        ]}
      />

      <SuccessBanner message={feedbackBanner} onDismiss={() => setFeedbackBanner("")} />

      <section className="lms-card lms-card-accent" style={{ gap: "14px", padding: "20px 22px" }}>
        <div className="lms-card-head" style={{ alignItems: "flex-start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span className="lms-course-code">
                <SubjectIcon size={13} aria-hidden="true" />
                {assignment.courseId?.courseCode} — {assignment.courseId?.courseName}
              </span>
              <Badge
                variant={isPastDue ? "EXPIRED" : "AVAILABLE"}
                label={isPastDue ? "Past Due" : "Open for Submission"}
                size="sm"
              />
            </div>

            <h1 style={{ margin: 0 }}>{assignment.title}</h1>
          </div>

          <Button
            variant="secondary"
            size="sm"
            icon={Edit3}
            disabled={!canGrade}
            onClick={() => setEditModalOpen(true)}
          >
            Edit Assignment
          </Button>
        </div>

        <div
          className="lms-info-box tabular-nums"
          style={{ display: "flex", flexWrap: "wrap", gap: "20px", padding: "10px 14px" }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <Clock size={14} aria-hidden="true" />
            <span>
              <strong>Due Date:</strong> {formatDateTime(assignment.dueDate)}
            </span>
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <Award size={14} aria-hidden="true" />
            <span>
              <strong>Max Score:</strong> {assignment.maxScore ?? 10} pts
            </span>
          </span>
        </div>

        {assignment.description && (
          <p style={{ fontSize: "14px", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>
            {assignment.description}
          </p>
        )}
      </section>

      <div className="lms-metric-strip">
        <div className="lms-metric-cell">
          <span className="lms-metric-label">Enrolled Students</span>
          <span className="lms-metric-value">{roster.length}</span>
        </div>
        <div className="lms-metric-cell">
          <span className="lms-metric-label">Submitted</span>
          <span className="lms-metric-value">{submittedCount}</span>
        </div>
        <div className="lms-metric-cell">
          <span className="lms-metric-label">Graded</span>
          <span className="lms-metric-value">{gradedCount}</span>
        </div>
        <div className="lms-metric-cell">
          <span className="lms-metric-label">Needs Grading</span>
          <span className="lms-metric-value">{ungradedCount}</span>
        </div>
        <div className="lms-metric-cell">
          <span className="lms-metric-label">Not Submitted</span>
          <span className="lms-metric-value">{notSubmittedCount}</span>
        </div>
      </div>

      <div className="lms-toolbar">
        <div className="lms-toolbar-group">
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

      {submittedCount === 0 && roster.length > 0 && (
        <div className="lms-info-box">No submissions have been received yet.</div>
      )}

      {filteredRoster.length === 0 ? (
        <EmptyState
          icon={Users}
          title={roster.length ? "No matching student submissions" : "No students or submissions yet"}
          description={roster.length ? "No students matched the selected filter." : undefined}
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
                <th>Submission Content</th>
                <th className="is-numeric">Grade</th>
                <th style={{ textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRoster.map((row) => {
                const sub = row.submission;
                return (
                  <tr key={row.student._id}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: "14px" }}>{row.student.fullName}</div>
                      <div style={{ fontSize: "12px" }}>{row.student.email}</div>
                    </td>

                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                        <Badge variant={row.status} size="sm" />
                        {row.isLate && <Badge variant="LATE" size="sm" />}
                      </div>
                    </td>

                    <td className="tabular-nums" style={{ whiteSpace: "nowrap", fontSize: "13px" }}>
                      {sub ? formatDateTime(sub.submittedAt) : "—"}
                    </td>

                    <td style={{ maxWidth: "280px" }}>
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
                              }}
                            >
                              <FileText size={13} aria-hidden="true" />
                              <span>{sub.fileName}</span>
                            </div>
                          )}
                          {sub.preview && (
                            <p
                              style={{
                                fontSize: "12px",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                margin: "2px 0 0",
                              }}
                            >
                              {sub.preview}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: "12px" }}>No submission uploaded</span>
                      )}
                    </td>

                    <td className="is-numeric" style={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                      {sub && sub.grade !== null && sub.grade !== undefined
                        ? `${sub.grade} / ${assignment.maxScore ?? 10}`
                        : `— / ${assignment.maxScore ?? 10}`}
                    </td>

                    <td style={{ textAlign: "right" }}>
                      {sub && (
                        <Button
                          variant={canGrade && row.status === "SUBMITTED" ? "primary" : "outline"}
                          size="sm"
                          icon={ClipboardCheck}
                          onClick={() => openGradingModal(row)}
                        >
                          {canGrade ? (row.status === "GRADED" ? "Edit Grade" : "Grade") : "View Submission"}
                        </Button>
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
        isOpen={Boolean(gradingRow)}
        onClose={() => { if (!savingGrade && !downloading) setGradingRow(null); }}
        title={gradingRow ? `${canGrade ? "Grade Submission" : "View Submission"} — ${gradingRow.student.fullName}` : "Submission"}
        maxWidth="660px"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setGradingRow(null)} disabled={savingGrade || downloading}>
              {canGrade ? "Cancel" : "Close"}
            </Button>
            {(gradeNeedsRefresh || submissionResult?.error) && (
              <Button variant="outline" size="sm" onClick={reloadSubmission}>
                Reload Submission
              </Button>
            )}
            {canGrade && reviewedSubmission && !gradeNeedsRefresh && nextUngradedRow && (
              <Button variant="outline" size="sm" onClick={() => saveGrade(true)} loading={savingGrade}>
                Save &amp; Grade Next
              </Button>
            )}
            {canGrade && reviewedSubmission && !gradeNeedsRefresh && (
              <Button variant="primary" size="sm" icon={CheckCircle2} onClick={() => saveGrade()} loading={savingGrade}>
                Save Grade
              </Button>
            )}
          </>
        }
      >
        {gradingRow && !submissionResult && <LoadingSpinner message="Loading submission..." />}
        {submissionResult?.error && (
          <ErrorBanner message={submissionResult.error.message || "Failed to load the submission."} />
        )}
        {gradingRow && reviewedSubmission && (
          <div className="lms-form-stack">
            <div
              className="lms-info-box"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "8px",
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: "14px" }}>{gradingRow.student.fullName}</div>
                <div style={{ fontSize: "12px" }}>{gradingRow.student.email}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <span className="tabular-nums" style={{ fontSize: "12px" }}>
                  Submitted {formatDateTime(reviewedSubmission.submittedAt)}
                </span>
                <Badge variant={gradingRow.isLate ? "LATE" : "ON_TIME"} size="sm" />
              </div>
            </div>

            <div className="lms-field">
              <span className="lms-field-label">Submitted Solution Text</span>
              <div
                className="lms-info-box"
                style={{ backgroundColor: "var(--color-page)", whiteSpace: "pre-wrap" }}
              >
                {reviewedSubmission.content || "No text description submitted."}
              </div>
            </div>

            {downloadError && <ErrorBanner message={downloadError} />}
            {reviewedSubmission.hasFile && (
              <div
                className="lms-info-box"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                  backgroundColor: "var(--color-surface)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                  <FileText size={16} aria-hidden="true" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: "13px", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {reviewedSubmission.fileName || "Attached file"}
                  </span>
                  {reviewedSubmission.fileSize && (
                    <span style={{ fontSize: "12px" }}>
                      ({formatFileSize(reviewedSubmission.fileSize)})
                    </span>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  icon={Download}
                  loading={downloading}
                  onClick={() => handleDownloadSubmissionFile(reviewedSubmission)}
                >
                  Download
                </Button>
              </div>
            )}

            {canGrade ? (
              <div
                className="lms-form-stack"
                style={{ paddingTop: "12px", borderTop: "1px solid var(--color-border)" }}
              >
                <Input
                  label={`Score (0 – ${assignment.maxScore ?? 10}) *`}
                  type="number"
                  min="0"
                  max={assignment.maxScore ?? 10}
                  step="any"
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
                  maxLength={5000}
                  value={gradeComment}
                  onChange={(e) => setGradeComment(e.target.value)}
                  placeholder="Provide feedback for the student..."
                />
              </div>
            ) : (
              reviewedSubmission.feedback && (
                <div className="lms-info-box" style={{ whiteSpace: "pre-wrap" }}>
                  {reviewedSubmission.feedback}
                </div>
              )
            )}
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
}
