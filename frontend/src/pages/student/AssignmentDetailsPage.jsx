import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  Clock,
  Award,
  Upload,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  Download,
  Send,
  FileText,
} from "lucide-react";
import { api } from "../../services/api";
import { Breadcrumb } from "../../components/ui/Breadcrumb";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Textarea } from "../../components/ui/Textarea";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { ErrorBanner } from "../../components/ui/ErrorBanner";
import { Modal } from "../../components/ui/Modal";
import { getCourseTheme } from "../../utils/courseThemes";

export const AssignmentDetailsPage = () => {
  const { assignmentId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Submission Form State
  const [content, setContent] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const fetchAssignment = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.getAssignmentDetails(assignmentId);
      if (res.status === "success") {
        setData(res.data);
        if (res.data.submission) {
          setContent(res.data.submission.content || "");
        }
      }
    } catch (err) {
      setError(err.message || "Failed to load assignment details.");
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    fetchAssignment();
  }, [fetchAssignment]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 25 * 1024 * 1024) {
        setSubmitError("File size exceeds 25 MB limit.");
        return;
      }
      setSelectedFile(file);
      setSubmitError("");
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    setSubmitError("");

    if (!content.trim() && !selectedFile) {
      setSubmitError("Please enter text content or attach a file to submit.");
      return;
    }

    setShowConfirmModal(true);
  };

  const executeSubmission = async () => {
    setShowConfirmModal(false);
    setSubmitting(true);
    setSubmitError("");
    setSubmitSuccess("");

    try {
      const formData = new FormData();
      if (content.trim()) formData.append("content", content.trim());
      if (selectedFile) formData.append("file", selectedFile);

      const res = await api.submitAssignment(assignmentId, formData);
      if (res.status === "success") {
        setSubmitSuccess(res.message || "Assignment submitted successfully.");
        setSelectedFile(null);
        await fetchAssignment();
      }
    } catch (err) {
      setSubmitError(err.message || "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading assignment..." />;
  }

  if (error) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <Breadcrumb items={[{ label: "Dashboard", to: "/student/dashboard" }, { label: "Assignments", to: "/student/assignments" }, { label: "Assignment Details" }]} />
        <ErrorBanner message={error} onRetry={fetchAssignment} />
      </div>
    );
  }

  if (!data) return null;

  const { submission, status } = data;
  const dueDate = new Date(data.dueDate);
  const isOverdue = dueDate < new Date() && status === "OVERDUE";
  const isGraded = submission && submission.grade !== null && submission.grade !== undefined;
  const theme = getCourseTheme(data.courseId?.courseCode);
  const SubjectIcon = theme.icon;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <Breadcrumb
        items={[
          { label: "Dashboard", to: "/student/dashboard" },
          { label: "Assignments", to: "/student/assignments" },
          { label: data.title },
        ]}
      />

      {/* Main Banner / Header */}
      <div
        className="lms-course-card"
        style={{
              backgroundColor: "var(--color-surface)",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--color-border)",
              borderTop: `3px solid ${theme.color}`,
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
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
                    {data.courseId?.courseCode} — {data.courseId?.courseName}
                  </span>
                  <Badge variant={status} />
                </div>
                <h1 style={{ fontSize: "22px", fontWeight: 700, color: "var(--color-text)", letterSpacing: "-0.015em" }}>
                  {data.title}
                </h1>
              </div>
            </div>

        {/* Metadata Strip */}
        <div
          className="tabular-nums"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "24px",
            padding: "14px 16px",
            backgroundColor: "var(--color-surface-soft)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--color-border)",
            fontSize: "13px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Clock size={16} style={{ color: isOverdue ? "var(--color-danger)" : "var(--color-text-muted)" }} />
            <span>
              <strong>Deadline:</strong>{" "}
              {dueDate.toLocaleDateString("en-US", {
                weekday: "short",
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Award size={16} style={{ color: "var(--color-text-muted)" }} />
            <span>
              <strong>Maximum Score:</strong> {data.maxScore ?? 10} points
            </span>
          </div>

          {submission && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <CheckCircle2 size={16} style={{ color: "var(--color-success)" }} />
              <span>
                <strong>Last Submitted:</strong>{" "}
                {new Date(submission.submittedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div style={{ marginTop: "8px" }}>
          <h2 style={{ fontSize: "15px", fontWeight: 600, color: "var(--color-text)", marginBottom: "8px" }}>
            Assignment Instructions & Requirements
          </h2>
          <div
            style={{
              padding: "16px",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--color-surface-soft)",
              border: "1px solid var(--color-border)",
              fontSize: "14px",
              color: "var(--color-text)",
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
            }}
          >
            {data.description || "No specific instructions provided by instructor."}
          </div>
        </div>
      </div>

      {/* ST07: Submission Details & Instructor Feedback (If already submitted) */}
      {submission && (
        <section
          style={{
            backgroundColor: "var(--color-surface)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--color-border)",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <FileCheck size={20} style={{ color: "var(--color-primary-700)" }} />
              <h2 style={{ fontSize: "17px", fontWeight: 600, color: "var(--color-text)" }}>
                Your Recorded Submission
              </h2>
            </div>
            <Badge variant={status} />
          </div>

          {/* Graded Card */}
          {isGraded ? (
            <div
              style={{
                padding: "16px 20px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--color-success-bg)",
                border: "1px solid #A7F3D0",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-success)", letterSpacing: "0.04em" }}>
                  INSTRUCTOR EVALUATION & GRADE
                </span>
                <span className="tabular-nums" style={{ fontSize: "20px", fontWeight: 700, color: "var(--color-success)" }}>
                  {submission.grade} / {data.maxScore ?? 10} pts
                </span>
              </div>
              <div>
                <strong style={{ fontSize: "13px", color: "var(--color-text)" }}>Feedback:</strong>
                <p style={{ fontSize: "14px", color: "var(--color-text)", marginTop: "4px" }}>
                  {submission.feedback || "Good job! The assignment meets academic requirements."}
                </p>
              </div>
            </div>
          ) : (
            <div
              style={{
                padding: "12px 16px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--color-primary-100)",
                border: "1px solid #BAE6FD",
                color: "var(--color-primary-700)",
                fontSize: "13px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <Clock size={16} />
              <span>
                <strong>Submitted — awaiting grading:</strong> Your instructor has received your submission and will post grades and feedback once reviewed.
              </span>
            </div>
          )}

          {/* Submitted Content */}
          {submission.content && (
            <div>
              <h3 style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-muted)", marginBottom: "6px" }}>
                SUBMITTED TEXT SOLUTION
              </h3>
              <div
                style={{
                  padding: "14px",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: "var(--color-surface-soft)",
                  border: "1px solid var(--color-border)",
                  fontSize: "14px",
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                }}
              >
                {submission.content}
              </div>
            </div>
          )}

          {/* Attached File */}
          {submission.fileUrl && (
            <div>
              <h3 style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-muted)", marginBottom: "6px" }}>
                ATTACHED SUBMISSION FILE
              </h3>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--color-border)",
                  backgroundColor: "var(--color-page)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <FileText size={18} style={{ color: "var(--color-primary-700)" }} />
                  <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--color-text)" }}>
                    {submission.fileName || submission.fileUrl.split("/").pop()}
                  </span>
                </div>
                <a
                  href={submission.fileUrl}
                  download
                  target="_blank"
                  rel="noreferrer"
                  style={{ textDecoration: "none" }}
                >
                  <Button variant="outline" size="sm" icon={Download}>
                    Download
                  </Button>
                </a>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Submission Form Section (ST06) */}
      {!isGraded ? (
        <section
          style={{
            backgroundColor: "var(--color-surface)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--color-border)",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Upload size={20} style={{ color: "var(--color-primary-700)" }} />
            <h2 style={{ fontSize: "17px", fontWeight: 600, color: "var(--color-text)" }}>
              {submission ? "Update Your Submission" : "Submit Assignment"}
            </h2>
          </div>

          {submitSuccess && (
            <div
              role="alert"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "12px 16px",
                borderRadius: "var(--radius-sm)",
                backgroundColor: "var(--color-success-bg)",
                border: "1px solid #A7F3D0",
                color: "var(--color-success)",
                fontSize: "14px",
              }}
            >
              <CheckCircle2 size={18} />
              <span>{submitSuccess}</span>
            </div>
          )}

          {submitError && (
            <div
              role="alert"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "12px 16px",
                borderRadius: "var(--radius-sm)",
                backgroundColor: "var(--color-danger-bg)",
                border: "1px solid #FECACA",
                color: "var(--color-danger)",
                fontSize: "14px",
              }}
            >
              <AlertCircle size={18} />
              <span>{submitError}</span>
            </div>
          )}

          <form onSubmit={handleFormSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <Textarea
              label="Text Solution / Method Statement"
              placeholder="Type your explanation, answers, methodology, or source link here..."
              rows={5}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              helperText="You may submit text, an attached file, or both."
            />

            {/* File Attachment */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "13px", fontWeight: 500, color: "var(--color-text)" }}>
                Attach Document / Code Archive (Optional)
              </label>
              <input
                type="file"
                onChange={handleFileChange}
                style={{
                  padding: "8px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--color-border)",
                  backgroundColor: "var(--color-surface)",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              />
              <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                Supported formats: PDF, DOCX, ZIP, TXT, PY, JS. Max size: 25 MB.
              </span>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
              <Button
                type="submit"
                variant="primary"
                size="md"
                icon={Send}
                loading={submitting}
              >
                {submission ? "Update Submission" : "Submit Assignment"}
              </Button>
            </div>
          </form>
        </section>
      ) : (
        <div
          style={{
            padding: "16px",
            borderRadius: "var(--radius-md)",
            backgroundColor: "var(--color-surface-soft)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-secondary)",
            fontSize: "13px",
            textAlign: "center",
          }}
        >
          This assignment has been graded. Further submissions are locked.
        </div>
      )}

      {/* Confirmation Modal */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Confirm Assignment Submission"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowConfirmModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={executeSubmission} loading={submitting}>
              Yes, Submit Now
            </Button>
          </>
        }
      >
        <p style={{ fontSize: "14px", color: "var(--color-text)", lineHeight: 1.5 }}>
          Are you sure you want to {submission ? "update your submission for" : "submit"}{" "}
          <strong>"{data.title}"</strong>?
        </p>
        <p style={{ fontSize: "13px", color: "var(--color-text-secondary)", marginTop: "8px" }}>
          Your submission will be recorded with the current server timestamp.
        </p>
      </Modal>
    </div>
  );
};
