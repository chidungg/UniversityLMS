import { useState, useEffect, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  FileText,
  Clock,
  AlertCircle,
  Search,
  Plus,
  Edit3,
  Trash2,
  ClipboardCheck,
  RotateCcw,
} from "lucide-react";
import { api } from "../../services/api";
import { Breadcrumb } from "../../components/ui/Breadcrumb";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorBanner } from "../../components/ui/ErrorBanner";
import { getCourseTheme } from "../../utils/courseThemes";
import { AssignmentFormModal } from "./components/AssignmentFormModal";
import { ConfirmDeleteModal } from "./components/ConfirmDeleteModal";
import { SuccessBanner } from "./components/SuccessBanner";
import { formatDateTime } from "./components/formatters";

const STATUS_TABS = [
  { id: "ALL", label: "All Assignments" },
  { id: "NEEDS_GRADING", label: "Needs Grading" },
  { id: "OPEN", label: "Open" },
  { id: "PAST_DUE", label: "Past Due" },
];

export const InstructorAssignmentsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCourseId = searchParams.get("courseId") || "";

  const [courses, setCourses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  const [selectedCourse, setSelectedCourse] = useState(initialCourseId);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const [formModal, setFormModal] = useState({ open: false, assignment: null });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCourses = useCallback(async () => {
    try {
      const res = await api.getInstructorCourses();
      if (res.status === "success") {
        setCourses(res.data);
      }
    } catch {
      // Ignored; handled by main fetch
    }
  }, []);

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (selectedCourse) params.courseId = selectedCourse;
      if (statusFilter !== "ALL") params.status = statusFilter;
      if (searchQuery.trim()) params.q = searchQuery.trim();

      const res = await api.getInstructorAssignments(params);
      if (res.status === "success") {
        setAssignments(res.data);
      }
    } catch (err) {
      setError(err.message || "Failed to load assignments.");
    } finally {
      setLoading(false);
    }
  }, [selectedCourse, statusFilter, searchQuery]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const handleSaveAssignment = async (payload, assignmentId) => {
    if (assignmentId) {
      const res = await api.updateAssignment(assignmentId, payload);
      setFeedback(res.message || "Assignment updated successfully.");
    } else {
      const res = await api.createAssignment(payload);
      setFeedback(res.message || "Assignment created successfully.");
    }
    await fetchAssignments();
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteAssignment(deleteTarget._id);
      setFeedback(`Deleted assignment "${deleteTarget.title}".`);
      setDeleteTarget(null);
      await fetchAssignments();
    } catch (err) {
      setError(err.message || "Failed to delete assignment.");
    } finally {
      setDeleting(false);
    }
  };

  const resetFilters = () => {
    setSelectedCourse("");
    setStatusFilter("ALL");
    setSearchQuery("");
    setSearchParams({});
  };

  const hasFilters = Boolean(selectedCourse || statusFilter !== "ALL" || searchQuery.trim());

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <Breadcrumb
        items={[
          { label: "Dashboard", to: "/instructor/dashboard" },
          { label: "Assignments & Grading" },
        ]}
      />

      {/* Page Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "16px",
          paddingBottom: "16px",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "var(--color-text)", marginBottom: "4px" }}>
            Assignments & Grading
          </h1>
          <p style={{ fontSize: "14px", color: "var(--color-text-secondary)" }}>
            Create and manage coursework assignments, track student submissions, and enter grades and feedback.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          icon={Plus}
          onClick={() => setFormModal({ open: true, assignment: null })}
        >
          Create Assignment
        </Button>
      </div>

      <SuccessBanner message={feedback} onDismiss={() => setFeedback("")} />

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
          {STATUS_TABS.map((tab) => (
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

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ width: "210px" }}>
            <Select
              aria-label="Filter by course"
              value={selectedCourse}
              onChange={(e) => {
                setSelectedCourse(e.target.value);
                setSearchParams(e.target.value ? { courseId: e.target.value } : {});
              }}
              style={{ height: "36px" }}
            >
              <option value="">All Courses</option>
              {courses.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.courseCode} — {c.courseName}
                </option>
              ))}
            </Select>
          </div>

          <div style={{ width: "230px" }}>
            <Input
              icon={Search}
              placeholder="Search assignments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ height: "36px" }}
            />
          </div>

          {hasFilters && (
            <Button variant="secondary" size="sm" icon={RotateCcw} onClick={resetFilters}>
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <LoadingSpinner message="Loading assignments..." />
      ) : error ? (
        <ErrorBanner message={error} onRetry={fetchAssignments} />
      ) : assignments.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={hasFilters ? "No assignments match your filters" : "No assignments created yet"}
          description={
            hasFilters
              ? "Try adjusting your status tab, course selection, or search keyword."
              : "Create an assignment to collect student submissions and post grades."
          }
          actionLabel={hasFilters ? "Clear Filters" : "Create Assignment"}
          onAction={hasFilters ? resetFilters : () => setFormModal({ open: true, assignment: null })}
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
                <th style={{ padding: "12px 18px" }}>Assignment</th>
                <th style={{ padding: "12px 16px" }}>Course</th>
                <th style={{ padding: "12px 16px" }}>Due Date</th>
                <th style={{ padding: "12px 16px" }}>Max Score</th>
                <th style={{ padding: "12px 16px" }}>Submissions</th>
                <th style={{ padding: "12px 18px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((assignment, idx) => {
                const theme = getCourseTheme(assignment.courseId);
                const isPastDue = new Date(assignment.dueDate) < new Date();

                return (
                  <tr
                    key={assignment._id}
                    className="lms-table-row"
                    style={{
                      borderBottom: idx === assignments.length - 1 ? "none" : "1px solid var(--color-border-subtle)",
                    }}
                  >
                    <td style={{ padding: "14px 18px", maxWidth: "360px" }}>
                      <Link
                        to={`/instructor/assignments/${assignment._id}`}
                        style={{
                          fontSize: "14px",
                          fontWeight: 600,
                          color: "var(--color-text)",
                          textDecoration: "none",
                          display: "block",
                        }}
                      >
                        {assignment.title}
                      </Link>
                      {assignment.description && (
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
                          {assignment.description}
                        </p>
                      )}
                    </td>

                    <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: 700,
                          color: theme.color,
                          backgroundColor: theme.colorLight,
                          padding: "2px 8px",
                          borderRadius: "4px",
                        }}
                      >
                        {assignment.courseId?.courseCode || "Course"}
                      </span>
                    </td>

                    <td
                      className="tabular-nums"
                      style={{
                        padding: "14px 16px",
                        fontSize: "13px",
                        color: isPastDue ? "var(--color-text-muted)" : "var(--color-text)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        {isPastDue ? (
                          <AlertCircle size={14} style={{ color: "var(--color-text-muted)" }} />
                        ) : (
                          <Clock size={14} style={{ color: "var(--color-primary-700)" }} />
                        )}
                        {formatDateTime(assignment.dueDate)}
                      </span>
                    </td>

                    <td className="tabular-nums" style={{ padding: "14px 16px", fontSize: "13px", color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>
                      {assignment.maxScore ?? 10} pts
                    </td>

                    <td className="tabular-nums" style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text)" }}>
                          {assignment.submissionCount ?? 0} / {assignment.enrolledCount ?? 0}
                        </span>
                        {assignment.ungradedCount > 0 ? (
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 600,
                              padding: "2px 7px",
                              borderRadius: "4px",
                              backgroundColor: "var(--color-warning-bg)",
                              color: "var(--color-warning)",
                              border: "1px solid #FDE68A",
                            }}
                          >
                            {assignment.ungradedCount} ungraded
                          </span>
                        ) : assignment.submissionCount > 0 ? (
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 600,
                              padding: "2px 7px",
                              borderRadius: "4px",
                              backgroundColor: "var(--color-success-bg)",
                              color: "var(--color-success)",
                              border: "1px solid #A7F3D0",
                            }}
                          >
                            All graded
                          </span>
                        ) : null}
                      </div>
                    </td>

                    <td style={{ padding: "14px 18px" }}>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px" }}>
                        <Link to={`/instructor/assignments/${assignment._id}`}>
                          <Button
                            variant={assignment.ungradedCount > 0 ? "primary" : "secondary"}
                            size="sm"
                            icon={ClipboardCheck}
                          >
                            Submissions
                          </Button>
                        </Link>
                        <Button
                          variant="outline"
                          size="sm"
                          icon={Edit3}
                          onClick={() => setFormModal({ open: true, assignment })}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Trash2}
                          aria-label={`Delete ${assignment.title}`}
                          onClick={() => setDeleteTarget(assignment)}
                          style={{ color: "var(--color-danger)" }}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AssignmentFormModal
        isOpen={formModal.open}
        onClose={() => setFormModal({ open: false, assignment: null })}
        assignment={formModal.assignment}
        courses={courses}
        defaultCourseId={selectedCourse}
        onSave={handleSaveAssignment}
      />

      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Assignment"
        itemName={deleteTarget?.title}
        warningText="All student submissions and recorded grades associated with this assignment will also be removed."
        loading={deleting}
      />
    </div>
  );
};
