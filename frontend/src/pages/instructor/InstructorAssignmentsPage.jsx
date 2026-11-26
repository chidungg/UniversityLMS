import { useState, useEffect, useMemo } from "react";
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
import { WeekList, WeekViewToggle } from "../../components/materials/MaterialList";
import { Breadcrumb } from "../../components/ui/Breadcrumb";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorBanner } from "../../components/ui/ErrorBanner";
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
  const selectedCourse = searchParams.get("courseId") || "";
  const [courseResult, setCourseResult] = useState(null);
  const [listResult, setListResult] = useState(null);
  const [courseAttempt, setCourseAttempt] = useState(0);
  const [listAttempt, setListAttempt] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [byWeek, setByWeek] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const q = searchQuery.trim();
  const queryKey = JSON.stringify([selectedCourse, statusFilter, q, listAttempt]);

  const [formModal, setFormModal] = useState({ open: false, assignment: null });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    api.getInstructorCourses({}, { signal: controller.signal })
      .then(({ data }) => {
        if (!controller.signal.aborted) setCourseResult({ courseAttempt, courses: data });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setCourseResult({ courseAttempt, error });
      });
    return () => controller.abort();
  }, [courseAttempt]);

  useEffect(() => {
    const controller = new AbortController();
    const params = {};
    if (selectedCourse) params.courseId = selectedCourse;
    if (statusFilter !== "ALL") params.status = statusFilter;
    if (q) params.q = q;
    api.getInstructorAssignments(params, { signal: controller.signal })
      .then(({ data }) => {
        if (!controller.signal.aborted) setListResult({ queryKey, assignments: data });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setListResult({ queryKey, error });
      });
    return () => controller.abort();
  }, [selectedCourse, statusFilter, q, queryKey]);

  const refreshAssignments = () => setListAttempt((current) => current + 1);

  const handleSaveAssignment = async (payload, assignmentId) => {
    const result = assignmentId
      ? await api.updateAssignment(assignmentId, payload)
      : await api.createAssignment(payload);
    setFeedback(result.message);
    refreshAssignments();
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await api.deleteAssignment(deleteTarget._id);
      setFeedback(`Deleted assignment "${deleteTarget.title}".`);
      setDeleteTarget(null);
      refreshAssignments();
    } catch (error) {
      setDeleteError(error.message || "Failed to delete assignment.");
    } finally {
      setDeleting(false);
    }
  };

  const resetFilters = () => {
    setStatusFilter("ALL");
    setSearchQuery("");
    setSearchParams({});
  };

  const currentCourses = courseResult?.courseAttempt === courseAttempt ? courseResult : null;
  const currentList = listResult?.queryKey === queryKey ? listResult : null;
  const courses = currentCourses?.courses;
  const activeCourses = useMemo(() => (courses ?? []).filter(({ isActive }) => isActive !== false), [courses]);
  const assignments = currentList?.assignments ?? [];
  const error = currentCourses?.error || currentList?.error;
  const loading = !currentCourses || !currentList;
  const canCreate = selectedCourse
    ? activeCourses.some(({ _id }) => _id === selectedCourse)
    : activeCourses.length > 0;
  const hasFilters = Boolean(selectedCourse || statusFilter !== "ALL" || q);
  const openNewAssignment = () => setFormModal({ open: true, assignment: null });

  return (
    <div className="lms-page">
      <Breadcrumb
        items={[
          { label: "Dashboard", to: "/instructor/dashboard" },
          { label: "Assignments & Grading" },
        ]}
      />

      <div className="lms-page-header">
        <div className="lms-page-header-left">
          <div className="lms-page-title-row">
            <h1>Assignments &amp; Grading</h1>
            {!loading && !error && <span className="lms-count-tag">{assignments.length}</span>}
          </div>
        </div>

        <Button
          variant="primary"
          size="md"
          icon={Plus}
          onClick={openNewAssignment}
          disabled={!canCreate}
        >
          Create Assignment
        </Button>
      </div>

      <SuccessBanner message={feedback} onDismiss={() => setFeedback("")} />

      <div className="lms-toolbar">
        <div className="lms-toolbar-group">
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

        <div className="lms-toolbar-controls">
          <div style={{ width: "200px" }}>
            <Select
              aria-label="Filter by course"
              value={selectedCourse}
              onChange={(event) => setSearchParams(event.target.value ? { courseId: event.target.value } : {})}
            >
              <option value="">All Courses</option>
              {(courses ?? []).map((c) => (
                <option key={c._id} value={c._id}>
                  {c.courseCode} — {c.courseName}
                </option>
              ))}
            </Select>
          </div>

          <WeekViewToggle allLabel="Ungrouped" byWeek={byWeek} onChange={setByWeek} />

          <div style={{ width: "220px" }}>
            <Input
              icon={Search}
              aria-label="Search assignments"
              placeholder="Search assignments..."
              value={searchQuery}
              maxLength={200}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {hasFilters && (
            <Button variant="secondary" size="sm" icon={RotateCcw} onClick={resetFilters}>
              Reset
            </Button>
          )}
        </div>
      </div>

      {error ? (
        <ErrorBanner
          message={error.message || "Failed to load assignments."}
          onRetry={() => {
            if (currentCourses?.error) setCourseAttempt((current) => current + 1);
            refreshAssignments();
          }}
        />
      ) : loading ? (
        <LoadingSpinner message="Loading assignments..." />
      ) : assignments.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={
            !courses?.length
              ? "No courses assigned"
              : hasFilters
                ? "No assignments match your filters"
                : "No assignments created yet"
          }
          description={
            !courses?.length
              ? "Assignments can be created for an assigned course."
              : hasFilters
                ? "Try adjusting your status tab, course selection, or search keyword."
                : undefined
          }
          actionLabel={hasFilters ? "Clear Filters" : canCreate ? "Create Assignment" : undefined}
          onAction={hasFilters ? resetFilters : canCreate ? openNewAssignment : undefined}
        />
      ) : (
        <WeekList
          key={JSON.stringify([selectedCourse, statusFilter, searchQuery.trim()])}
          items={assignments}
          byWeek={byWeek}
          singular="assignment"
          plural="assignments"
          expandAll={Boolean(searchQuery.trim()) || statusFilter !== "ALL"}
          unassignedHint={
            !searchQuery.trim() && statusFilter === "ALL"
              ? "Set Teaching week when creating or editing an assignment to organize it here."
              : undefined
          }
        >
          {(weekItems) => (
            <div className="lms-table-wrap">
              <table className="lms-table">
                <thead>
                  <tr>
                    <th>Assignment</th>
                    <th>Course</th>
                    <th>Due Date</th>
                    <th className="is-numeric">Max Score</th>
                    <th>Submissions</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {weekItems.map((assignment) => {
                    const isPastDue = new Date(assignment.dueDate) < new Date();

                    return (
                      <tr key={assignment._id}>
                        <td style={{ maxWidth: "360px" }}>
                          <Link
                            to={`/instructor/assignments/${assignment._id}`}
                            style={{ fontWeight: 600, fontSize: "14px", display: "block" }}
                          >
                            {assignment.title}
                          </Link>
                        </td>

                        <td style={{ whiteSpace: "nowrap" }}>
                          <span className="lms-course-code">
                            {assignment.courseId?.courseCode || "Course"}
                          </span>
                        </td>

                        <td className="tabular-nums" style={{ whiteSpace: "nowrap", fontSize: "13px" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                            {isPastDue ? (
                              <AlertCircle size={14} aria-hidden="true" />
                            ) : (
                              <Clock size={14} aria-hidden="true" />
                            )}
                            {formatDateTime(assignment.dueDate)}
                          </span>
                        </td>

                        <td className="is-numeric" style={{ whiteSpace: "nowrap", fontSize: "13px" }}>
                          {assignment.maxScore ?? 10} pts
                        </td>

                        <td className="tabular-nums" style={{ whiteSpace: "nowrap" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "13px", fontWeight: 600 }}>
                              {assignment.submissionCount ?? 0} / {assignment.enrolledCount ?? 0}
                            </span>
                            {assignment.ungradedCount > 0 ? (
                              <Badge
                                variant="PENDING"
                                label={`${assignment.ungradedCount} ungraded`}
                                size="sm"
                              />
                            ) : assignment.submissionCount > 0 ? (
                              <Badge variant="GRADED" label="All graded" size="sm" />
                            ) : null}
                          </div>
                        </td>

                        <td style={{ textAlign: "right" }}>
                          <div className="lms-row-actions">
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
                              disabled={assignment.courseId?.isActive === false}
                              onClick={() => setFormModal({ open: true, assignment })}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              icon={Trash2}
                              aria-label={`Delete ${assignment.title}`}
                              disabled={assignment.courseId?.isActive === false || assignment.submissionCount > 0}
                              title={assignment.submissionCount > 0 ? "Assignments with submissions cannot be deleted." : undefined}
                              onClick={() => {
                                setDeleteError("");
                                setDeleteTarget(assignment);
                              }}
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
        </WeekList>
      )}

      <AssignmentFormModal
        isOpen={formModal.open}
        onClose={() => setFormModal({ open: false, assignment: null })}
        assignment={formModal.assignment}
        courses={activeCourses}
        defaultCourseId={selectedCourse}
        onSave={handleSaveAssignment}
      />

      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Assignment"
        itemName={deleteTarget?.title}
        warningText="An assignment can only be deleted before students submit work."
        loading={deleting}
        error={deleteError}
      />
    </div>
  );
};
