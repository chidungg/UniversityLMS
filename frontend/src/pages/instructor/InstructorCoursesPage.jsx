import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Search,
  BookOpen,
  Users,
  FolderOpen,
  FileText,
  HelpCircle,
  LayoutGrid,
  List,
  RotateCcw,
  ArrowRight,
} from "lucide-react";
import { api } from "../../services/api";
import { Breadcrumb } from "../../components/ui/Breadcrumb";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorBanner } from "../../components/ui/ErrorBanner";
import { getCourseTheme } from "../../utils/courseThemes";

const STATUS_TABS = [
  { id: "all", label: "All Courses" },
  { id: "active", label: "Active" },
  { id: "inactive", label: "Inactive" },
];

export const InstructorCoursesPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get("q") || "";
  const q = searchQuery.trim();
  const [result, setResult] = useState(null);
  const [retry, setRetry] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState("grid");
  const queryKey = JSON.stringify([statusFilter, q, retry]);

  useEffect(() => {
    const controller = new AbortController();
    const params = {};
    if (statusFilter !== "all") params.status = statusFilter;
    if (q) params.q = q;

    api.getInstructorCourses(params, { signal: controller.signal })
      .then(({ data }) => {
        if (!controller.signal.aborted) setResult({ queryKey, courses: data });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setResult({ queryKey, error });
      });
    return () => controller.abort();
  }, [q, queryKey, statusFilter]);

  const clearFilters = () => {
    setStatusFilter("all");
    setSearchParams({});
  };

  const loading = result?.queryKey !== queryKey;
  const { courses = [], error } = loading ? {} : result;
  const hasFilters = Boolean(q || statusFilter !== "all");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <Breadcrumb
        items={[
          { label: "Dashboard", to: "/instructor/dashboard" },
          { label: "Assigned Courses" },
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
            Assigned Courses
          </h1>
          <p style={{ fontSize: "14px", color: "var(--color-text-secondary)" }}>
            Open an assigned course to manage its materials, assignments, and quizzes.
          </p>
        </div>

        {/* Status Pill Tabs */}
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
      </div>

      {/* Search & View Switcher Bar */}
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
        <div style={{ flex: 1, minWidth: "240px" }}>
          <Input
            icon={Search}
            aria-label="Filter assigned courses"
            placeholder="Search by course code, title, or syllabus keyword..."
            value={searchQuery}
            maxLength={200}
            onChange={(e) => setSearchParams(e.target.value ? { q: e.target.value } : {}, { replace: true })}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {hasFilters && (
            <Button variant="secondary" size="sm" icon={RotateCcw} onClick={clearFilters}>
              Reset
            </Button>
          )}

          <div
            style={{
              display: "inline-flex",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--color-border)",
              overflow: "hidden",
            }}
          >
            <button
              type="button"
              aria-label="Grid view"
              onClick={() => setViewMode("grid")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 10px",
                border: "none",
                fontSize: "12px",
                fontWeight: 500,
                backgroundColor: viewMode === "grid" ? "var(--color-primary-100)" : "var(--color-surface)",
                color: viewMode === "grid" ? "var(--color-primary-700)" : "var(--color-text-secondary)",
              }}
            >
              <LayoutGrid size={14} />
              Grid
            </button>
            <button
              type="button"
              aria-label="Table view"
              onClick={() => setViewMode("table")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 10px",
                border: "none",
                borderLeft: "1px solid var(--color-border)",
                fontSize: "12px",
                fontWeight: 500,
                backgroundColor: viewMode === "table" ? "var(--color-primary-100)" : "var(--color-surface)",
                color: viewMode === "table" ? "var(--color-primary-700)" : "var(--color-text-secondary)",
              }}
            >
              <List size={14} />
              Table
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <LoadingSpinner message="Loading assigned courses..." />
      ) : error ? (
        <ErrorBanner
          message={error.message || "Failed to load assigned courses."}
          onRetry={() => setRetry((current) => current + 1)}
        />
      ) : courses.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={hasFilters ? "No matching courses found" : "No courses assigned"}
          description={
            hasFilters
              ? "No courses matched your current search or status filter."
              : "You do not have any courses assigned yet."
          }
          actionLabel={hasFilters ? "Clear Filters" : undefined}
          onAction={hasFilters ? clearFilters : undefined}
        />
      ) : viewMode === "grid" ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(min(340px, 100%), 1fr))",
            gap: "18px",
          }}
        >
          {courses.map((course) => {
            const theme = getCourseTheme(course);
            const ThemeIcon = theme.icon;

            return (
              <div
                key={course._id}
                className="lms-course-card"
                style={{
                  backgroundColor: "var(--color-surface)",
                  padding: "20px",
                  gap: "14px",
                  justifyContent: "space-between",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: "3px",
                    backgroundColor: theme.color,
                  }}
                />

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div
                        style={{
                          width: "28px",
                          height: "28px",
                          borderRadius: "6px",
                          backgroundColor: theme.colorLight,
                          color: theme.color,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <ThemeIcon size={16} />
                      </div>
                      <span style={{ fontSize: "12px", fontWeight: 700, color: theme.color }}>
                        {course.courseCode}
                      </span>
                    </div>
                    <Badge variant={course.isActive === false ? "INACTIVE" : "ACTIVE"} size="sm" />
                  </div>

                  <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--color-text)", marginBottom: "6px" }}>
                    <Link to={`/instructor/courses/${course._id}`} style={{ color: "var(--color-text)", textDecoration: "none" }}>
                      {course.courseName}
                    </Link>
                  </h2>

                  <p
                    style={{
                      fontSize: "13px",
                      color: "var(--color-text-secondary)",
                      lineHeight: 1.5,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      marginBottom: "14px",
                    }}
                  >
                    {course.description || "No syllabus description provided."}
                  </p>

                  {/* Metrics Grid */}
                  <div
                    className="tabular-nums"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "8px",
                      padding: "10px 12px",
                      borderRadius: "var(--radius-sm)",
                      backgroundColor: "var(--color-surface-soft)",
                      border: "1px solid var(--color-border-subtle)",
                      fontSize: "12px",
                      color: "var(--color-text)",
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Users size={13} style={{ color: "var(--color-text-muted)" }} />
                      {course.enrolledCount ?? 0} Students
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <FolderOpen size={13} style={{ color: "var(--color-text-muted)" }} />
                      {course.materialCount ?? 0} Materials
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <FileText size={13} style={{ color: "var(--color-text-muted)" }} />
                      {course.assignmentCount ?? 0} Assignments
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <HelpCircle size={13} style={{ color: "var(--color-text-muted)" }} />
                      {course.quizCount ?? 0} Quizzes
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: "8px",
                    paddingTop: "12px",
                    borderTop: "1px solid var(--color-border-subtle)",
                  }}
                >
                  <Link to={`/instructor/courses/${course._id}`}>
                    Open Workspace <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
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
                <th style={{ padding: "12px 16px" }}>Course</th>
                <th style={{ padding: "12px 16px" }}>Students</th>
                <th style={{ padding: "12px 16px" }}>Materials</th>
                <th style={{ padding: "12px 16px" }}>Assignments</th>
                <th style={{ padding: "12px 16px" }}>Quizzes</th>
                <th style={{ padding: "12px 16px" }}>Status</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((course, idx) => (
                <tr
                  key={course._id}
                  className="lms-table-row"
                  style={{
                    borderBottom: idx === courses.length - 1 ? "none" : "1px solid var(--color-border-subtle)",
                  }}
                >
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ fontWeight: 700, fontSize: "12px", color: "var(--color-primary-700)" }}>
                      {course.courseCode}
                    </div>
                    <Link
                      to={`/instructor/courses/${course._id}`}
                      style={{ fontWeight: 600, fontSize: "14px", color: "var(--color-text)" }}
                    >
                      {course.courseName}
                    </Link>
                  </td>
                  <td className="tabular-nums" style={{ padding: "14px 16px", fontSize: "13px" }}>
                    {course.enrolledCount ?? 0}
                  </td>
                  <td className="tabular-nums" style={{ padding: "14px 16px", fontSize: "13px" }}>
                    {course.materialCount ?? 0}
                  </td>
                  <td className="tabular-nums" style={{ padding: "14px 16px", fontSize: "13px" }}>
                    {course.assignmentCount ?? 0}
                  </td>
                  <td className="tabular-nums" style={{ padding: "14px 16px", fontSize: "13px" }}>
                    {course.quizCount ?? 0}
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <Badge variant={course.isActive === false ? "INACTIVE" : "ACTIVE"} size="sm" />
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                      <Link to={`/instructor/courses/${course._id}`}>Open Workspace</Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
};
