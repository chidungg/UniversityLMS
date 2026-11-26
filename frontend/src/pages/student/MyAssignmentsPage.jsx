import { useState, useEffect, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Clock,
  Search,
  FolderX,
  AlertCircle,
  CheckCircle2,
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

const STATUS_TABS = [
  { id: "ALL", label: "All Tasks" },
  { id: "PENDING", label: "Action Needed" },
  { id: "SUBMITTED", label: "Submitted" },
  { id: "GRADED", label: "Graded" },
];

export const MyAssignmentsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCourseId = searchParams.get("courseId") || "";

  const [assignments, setAssignments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedCourse, setSelectedCourse] = useState(initialCourseId);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [byWeek, setByWeek] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchEnrolledCourses = useCallback(async () => {
    try {
      const res = await api.getCourses();
      if (res.status === "success") {
        setCourses(res.data);
      }
    } catch (err) {
      console.error("Failed to load courses for filter:", err);
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

      const res = await api.getAssignments(params);
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
    fetchEnrolledCourses();
  }, [fetchEnrolledCourses]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchAssignments();
  };

  return (
    <div className="lms-page">
      <Breadcrumb items={[{ label: "Dashboard", to: "/student/dashboard" }, { label: "Assignments" }]} />

      <div className="lms-page-header">
        <div className="lms-page-header-left">
          <div className="lms-page-title-row">
            <h1>Coursework Assignments</h1>
            {!loading && !error && <span className="lms-count-tag">{assignments.length}</span>}
          </div>
        </div>
      </div>

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
              onChange={(e) => {
                setSelectedCourse(e.target.value);
                setSearchParams(e.target.value ? { courseId: e.target.value } : {});
              }}
            >
              <option value="">All Enrolled Courses</option>
              {courses.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.courseCode} — {c.courseName}
                </option>
              ))}
            </Select>
          </div>

          <WeekViewToggle allLabel="Ungrouped" byWeek={byWeek} onChange={setByWeek} />

          <form onSubmit={handleSearchSubmit} style={{ width: "220px" }}>
            <Input
              icon={Search}
              aria-label="Search assignments"
              placeholder="Search assignments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </form>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner message="Loading assignments..." />
      ) : error ? (
        <ErrorBanner message={error} onRetry={fetchAssignments} />
      ) : assignments.length === 0 ? (
        <EmptyState
          icon={FolderX}
          title="No assignments found"
          description={
            searchQuery || selectedCourse || statusFilter !== "ALL"
              ? "No assignments matched your current filters."
              : "No assignments have been posted for your enrolled courses."
          }
          actionLabel={searchQuery || selectedCourse || statusFilter !== "ALL" ? "Clear Filters" : undefined}
          onAction={() => {
            setSearchQuery("");
            setSelectedCourse("");
            setStatusFilter("ALL");
            setSearchParams({});
            api.getAssignments().then((res) => setAssignments(res.data));
          }}
        />
      ) : (
        <WeekList
          key={JSON.stringify([selectedCourse, statusFilter, searchQuery.trim()])}
          items={assignments}
          byWeek={byWeek}
          singular="assignment"
          plural="assignments"
          expandAll={Boolean(searchQuery.trim()) || statusFilter !== "ALL"}
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
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {weekItems.map((assignment) => {
                    const dueDate = new Date(assignment.dueDate);
                    const isOverdue = dueDate < new Date() && assignment.status === "PENDING";
                    const isGraded = assignment.status === "GRADED" && assignment.submission?.grade !== null;

                    return (
                      <tr key={assignment._id}>
                        <td style={{ maxWidth: "360px" }}>
                          <Link
                            to={`/student/assignments/${assignment._id}`}
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

                        <td
                          className="tabular-nums"
                          style={{ whiteSpace: "nowrap", fontSize: "13px", fontWeight: isOverdue ? 600 : 400 }}
                        >
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                            {isOverdue ? (
                              <AlertCircle size={14} aria-hidden="true" />
                            ) : (
                              <Clock size={14} aria-hidden="true" />
                            )}
                            {dueDate.toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </td>

                        <td className="is-numeric" style={{ whiteSpace: "nowrap", fontSize: "13px" }}>
                          {assignment.maxScore ?? 10} pts
                        </td>

                        <td style={{ whiteSpace: "nowrap" }}>
                          {isGraded ? (
                            <span
                              className="lms-badge lms-badge--sm"
                              style={{
                                backgroundColor: "var(--color-success-bg)",
                                border: "1px solid #86EFAC",
                              }}
                            >
                              <CheckCircle2 size={12} aria-hidden="true" />
                              Score: {assignment.submission.grade}/{assignment.maxScore ?? 10}
                            </span>
                          ) : (
                            <Badge variant={assignment.status} size="sm" />
                          )}
                        </td>

                        <td style={{ textAlign: "right" }}>
                          <Link to={`/student/assignments/${assignment._id}`}>
                            <Button
                              variant={assignment.status === "PENDING" ? "primary" : "outline"}
                              size="sm"
                            >
                              {assignment.status === "PENDING" ? "Submit" : "Details"}
                            </Button>
                          </Link>
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
    </div>
  );
};
