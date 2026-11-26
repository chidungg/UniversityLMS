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
      <div className="lms-page">
        <Breadcrumb
          items={[
            { label: "Dashboard", to: "/student/dashboard" },
            { label: "Assignments", to: "/student/assignments" },
            { label: "Assignment Details" },
          ]}
        />
        <ErrorBanner message={error} onRetry={fetchAssignment} />
      </div>
    );
  }

  if (!data) return null;

  const { submission, status } = data;
  const dueDate = new Date(data.dueDate);
  const isGraded = submission && submission.grade !== null && submission.grade !== undefined;
  const theme = getCourseTheme(data.courseId?.courseCode);
  const SubjectIcon = theme.icon;

  return (
    <div className="lms-page">
      <Breadcrumb
        items={[
          { label: "Dashboard", to: "/student/dashboard" },
          { label: "Assignments", to: "/student/assignments" },
          { label: data.title },
        ]}
      />

      <section className="lms-card lms-card-accent" style={{ gap: "14px", padding: "20px 22px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span className="lms-course-code">
            <SubjectIcon size={13} aria-hidden="true" />
            {data.courseId?.courseCode} — {data.courseId?.courseName}
          </span>
          <Badge variant={status} size="sm" />
        </div>

        <h1 style={{ margin: 0 }}>{data.title}</h1>

        <div
          className="lms-info-box tabular-nums"
          style={{ display: "flex", flexWrap: "wrap", gap: "20px", padding: "10px 14px" }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <Clock size={14} aria-hidden="true" />
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
          </span>

          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <Award size={14} aria-hidden="true" />
            <span>
              <strong>Maximum Score:</strong> {data.maxScore ?? 10} points
            </span>
          </span>

          {submission && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <CheckCircle2 size={14} aria-hidden="true" />
              <span>
                <strong>Last Submitted:</strong>{" "}
                {new Date(submission.submittedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </span>
          )}
        </div>

        {data.description && (
          <div className="lms-field">
            <h2 style={{ fontSize: "14px", margin: "0 0 6px" }}>Instructions &amp; Requirements</h2>
            <div className="lms-info-box" style={{ whiteSpace: "pre-wrap" }}>
              {data.description}
            </div>
          </div>
        )}
      </section>

      {submission && (
        <section className="lms-panel lms-panel-pad lms-form-stack">
          <div className="lms-card-head">
            <div className="lms-section-title">
              <FileCheck size={17} aria-hidden="true" />
              <h2 style={{ margin: 0 }}>Your Recorded Submission</h2>
            </div>
            <Badge variant={status} size="sm" />
          </div>

          {isGraded ? (
            <div
              style={{
                padding: "14px 16px",
                borderRadius: "4px",
                backgroundColor: "var(--color-success-bg)",
                border: "1px solid #86EFAC",
                borderLeft: "3px solid #16A34A",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <div className="lms-card-head">
                <span style={{ fontSize: "13px", fontWeight: 600 }}>Instructor Grade</span>
                <span className="tabular-nums" style={{ fontSize: "18px", fontWeight: 700 }}>
                  {submission.grade} / {data.maxScore ?? 10} pts
                </span>
              </div>
              {submission.feedback && (
                <div>
                  <strong style={{ fontSize: "13px" }}>Feedback:</strong>
                  <p style={{ fontSize: "14px", margin: "4px 0 0", whiteSpace: "pre-wrap" }}>
                    {submission.feedback}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="lms-info-box" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Clock size={15} aria-hidden="true" style={{ flexShrink: 0 }} />
              <span>
                <strong>Submitted — awaiting grading:</strong> Your instructor has received your submission.
              </span>
            </div>
          )}

          {submission.content && (
            <div className="lms-field">
              <span className="lms-field-label">Submitted Text Solution</span>
              <div className="lms-info-box" style={{ whiteSpace: "pre-wrap" }}>
                {submission.content}
              </div>
            </div>
          )}

          {submission.fileUrl && (
            <div className="lms-field">
              <span className="lms-field-label">Attached Submission File</span>
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
                  <span style={{ fontSize: "13px", fontWeight: 500, overflowWrap: "anywhere" }}>
                    {submission.fileName || submission.fileUrl.split("/").pop()}
                  </span>
                </div>
                <a
                  href={submission.fileUrl}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className="lms-button lms-button--outline lms-button--sm"
                >
                  <Download size={14} aria-hidden="true" />
                  Download
                </a>
              </div>
            </div>
          )}
        </section>
      )}

      {!isGraded ? (
        <section className="lms-panel lms-panel-pad lms-form-stack">
          <div className="lms-section-title">
            <Upload size={17} aria-hidden="true" />
            <h2 style={{ margin: 0 }}>{submission ? "Update Your Submission" : "Submit Assignment"}</h2>
          </div>

          {submitSuccess && (
            <div role="alert" className="lms-success-banner">
              <div className="lms-banner-content">
                <CheckCircle2 size={16} aria-hidden="true" />
                <span>{submitSuccess}</span>
              </div>
            </div>
          )}

          {submitError && (
            <div role="alert" className="lms-error-banner">
              <div className="lms-banner-content">
                <AlertCircle size={16} aria-hidden="true" />
                <span>{submitError}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleFormSubmit} className="lms-form-stack">
            <Textarea
              label="Text Solution / Method Statement"
              placeholder="Type your explanation, answers, or source link here..."
              rows={5}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              helperText="Submit text, an attached file, or both."
            />

            <div className="lms-field">
              <label htmlFor="submission-file" className="lms-field-label">
                Attach Document / Code Archive (Optional)
              </label>
              <div className="lms-file-box">
                <input id="submission-file" type="file" onChange={handleFileChange} />
                <span className="lms-field-helper">
                  PDF, DOCX, ZIP, TXT, PY, JS. Max size: 25 MB.
                </span>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Button type="submit" variant="primary" size="md" icon={Send} loading={submitting}>
                {submission ? "Update Submission" : "Submit Assignment"}
              </Button>
            </div>
          </form>
        </section>
      ) : (
        <div className="lms-info-box" style={{ textAlign: "center" }}>
          This assignment has been graded. Further submissions are locked.
        </div>
      )}

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
        <p style={{ fontSize: "14px", lineHeight: 1.5, margin: 0 }}>
          Are you sure you want to {submission ? "update your submission for" : "submit"}{" "}
          <strong>&ldquo;{data.title}&rdquo;</strong>?
        </p>
        <p style={{ fontSize: "13px", marginTop: "8px", marginBottom: 0 }}>
          Your submission will be recorded with the current server timestamp.
        </p>
      </Modal>
    </div>
  );
};
