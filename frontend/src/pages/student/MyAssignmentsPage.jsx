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
import { Breadcrumb } from "../../components/ui/Breadcrumb";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorBanner } from "../../components/ui/ErrorBanner";
import { getCourseTheme } from "../../utils/courseThemes";

export const MyAssignmentsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCourseId = searchParams.get("courseId") || "";

  const [assignments, setAssignments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedCourse, setSelectedCourse] = useState(initialCourseId);
  const [statusFilter, setStatusFilter] = useState("ALL");
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
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <Breadcrumb items={[{ label: "Dashboard", to: "/student/dashboard" }, { label: "Assignments" }]} />

      {/* Header */}
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
            Coursework Assignments
          </h1>
          <p style={{ fontSize: "14px", color: "var(--color-text-secondary)" }}>
            Review tasks, track deadlines, submit solutions, and inspect instructor evaluations.
          </p>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: "var(--color-surface)",
          padding: "14px 16px",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--color-border)",
        }}
      >
        {/* Status Pill Tabs */}
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {[
            { id: "ALL", label: "All Tasks" },
            { id: "PENDING", label: "Action Needed" },
            { id: "SUBMITTED", label: "Submitted" },
            { id: "GRADED", label: "Graded" },
          ].map((tab) => (
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

        {/* Course Filter and Search */}
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ width: "200px" }}>
            <Select
              value={selectedCourse}
              onChange={(e) => {
                setSelectedCourse(e.target.value);
                setSearchParams(e.target.value ? { courseId: e.target.value } : {});
              }}
              style={{ height: "36px" }}
            >
              <option value="">All Enrolled Courses</option>
              {courses.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.courseCode} — {c.courseName}
                </option>
              ))}
            </Select>
          </div>

          <form onSubmit={handleSearchSubmit} style={{ width: "220px" }}>
            <Input
              icon={Search}
              placeholder="Search assignments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ height: "36px" }}
            />
          </form>
        </div>
      </div>

      {/* Content Area */}
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
              ? "No assignments matched your current filters. Try resetting the filters."
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
        <div
          style={{
            backgroundColor: "var(--color-surface)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--color-border)",
            overflow: "hidden",
          }}
        >
          {/* Table Header */}
          <div
            style={{
              padding: "12px 20px",
              backgroundColor: "var(--color-surface-soft)",
              borderBottom: "1px solid var(--color-border)",
              display: "grid",
              gridTemplateColumns: "minmax(260px, 2fr) 140px 170px 130px 140px 130px",
              gap: "12px",
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--color-text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
            className="assignments-table-header"
          >
            <span>Assignment</span>
            <span>Course</span>
            <span>Due Date</span>
            <span>Max Score</span>
            <span>Status</span>
            <span style={{ textAlign: "right" }}>Action</span>
          </div>

          {/* Table Rows */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            {assignments.map((assignment, index) => {
              const dueDate = new Date(assignment.dueDate);
              const isOverdue = dueDate < new Date() && assignment.status === "PENDING";
              const theme = getCourseTheme(assignment.courseId);
              const isGraded = assignment.status === "GRADED" && assignment.submission?.grade !== null;

              return (
                <div
                  key={assignment._id}
                  className="assignments-table-row lms-table-row"
                  style={{
                    padding: "16px 20px",
                    borderBottom:
                      index === assignments.length - 1 ? "none" : "1px solid var(--color-border-subtle)",
                    display: "grid",
                    gridTemplateColumns: "minmax(260px, 2fr) 140px 170px 130px 140px 130px",
                    gap: "12px",
                    alignItems: "center",
                  }}
                >
                  {/* Title (Clean, no multi-line cut-off description clutter!) */}
                  <div>
                    <Link
                      to={`/student/assignments/${assignment._id}`}
                      style={{
                        fontSize: "14px",
                        fontWeight: 600,
                        color: "var(--color-text)",
                        textDecoration: "none",
                        lineHeight: 1.35,
                      }}
                    >
                      {assignment.title}
                    </Link>
                  </div>

                  {/* Course Theme Tag */}
                  <div>
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
                  </div>

                  {/* Due Date with smart urgency tag */}
                  <div
                    className="tabular-nums"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "13px",
                      color: isOverdue ? "var(--color-danger)" : "var(--color-text)",
                      fontWeight: isOverdue ? 600 : 400,
                    }}
                  >
                    {isOverdue ? (
                      <AlertCircle size={15} style={{ color: "var(--color-danger)", flexShrink: 0 }} />
                    ) : (
                      <Clock size={15} style={{ color: "var(--color-text-muted)", flexShrink: 0 }} />
                    )}
                    <span>
                      {dueDate.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  {/* Max Score */}
                  <div className="tabular-nums" style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
                    {assignment.maxScore ?? 10} pts
                  </div>

                  {/* Status & Grade Pill */}
                  <div>
                    {isGraded ? (
                      <div
                        className="tabular-nums"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          backgroundColor: "var(--color-success-bg)",
                          border: "1px solid #A7F3D0",
                          color: "var(--color-success)",
                          fontSize: "12px",
                          fontWeight: 600,
                        }}
                      >
                        <CheckCircle2 size={13} />
                        <span>Score: {assignment.submission.grade}/{assignment.maxScore ?? 10}</span>
                      </div>
                    ) : (
                      <Badge variant={assignment.status} size="sm" />
                    )}
                  </div>

                  {/* Action CTA */}
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <Link to={`/student/assignments/${assignment._id}`}>
                      <Button
                        variant={assignment.status === "PENDING" ? "primary" : "outline"}
                        size="sm"
                      >
                        {assignment.status === "PENDING" ? "Submit" : "Details"}
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 960px) {
          .assignments-table-header {
            display: none !important;
          }
          .assignments-table-row {
            display: flex !important;
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 10px !important;
          }
          .assignments-table-row > div:last-child {
            width: 100%;
            justify-content: flex-start !important;
            margin-top: 4px;
          }
        }
      `}</style>
    </div>
  );
};
