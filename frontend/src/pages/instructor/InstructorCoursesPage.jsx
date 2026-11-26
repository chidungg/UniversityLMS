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
    <div className="lms-page">
      <Breadcrumb
        items={[
          { label: "Dashboard", to: "/instructor/dashboard" },
          { label: "Assigned Courses" },
        ]}
      />

      <div className="lms-page-header">
        <div className="lms-page-header-left">
          <div className="lms-page-title-row">
            <h1>Assigned Courses</h1>
            {!loading && !error && <span className="lms-count-tag">{courses.length}</span>}
          </div>
        </div>

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
      </div>

      <div className="lms-toolbar">
        <div style={{ flex: 1, minWidth: "240px", maxWidth: "460px" }}>
          <Input
            icon={Search}
            aria-label="Filter assigned courses"
            placeholder="Search by course code, title, or keyword..."
            value={searchQuery}
            maxLength={200}
            onChange={(e) => setSearchParams(e.target.value ? { q: e.target.value } : {}, { replace: true })}
          />
        </div>

        <div className="lms-toolbar-controls">
          {hasFilters && (
            <Button variant="secondary" size="sm" icon={RotateCcw} onClick={clearFilters}>
              Reset
            </Button>
          )}

          <div className="lms-view-toggle">
            <button
              type="button"
              aria-label="Grid view"
              className={viewMode === "grid" ? "is-active" : ""}
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid size={14} aria-hidden="true" />
              Grid
            </button>
            <button
              type="button"
              aria-label="Table view"
              className={viewMode === "table" ? "is-active" : ""}
              onClick={() => setViewMode("table")}
            >
              <List size={14} aria-hidden="true" />
              Table
            </button>
          </div>
        </div>
      </div>

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
        <div className="lms-grid-cards-wide">
          {courses.map((course) => {
            const theme = getCourseTheme(course);
            const ThemeIcon = theme.icon;

            return (
              <article key={course._id} className="lms-card lms-card-accent lms-card-clickable">
                <div className="lms-card-head">
                  <span className="lms-course-code">
                    <ThemeIcon size={13} aria-hidden="true" />
                    {course.courseCode}
                  </span>
                  <Badge variant={course.isActive === false ? "INACTIVE" : "ACTIVE"} size="sm" />
                </div>

                <h2 className="lms-card-title">
                  <Link to={`/instructor/courses/${course._id}`}>{course.courseName}</Link>
                </h2>

                {course.description && <p className="lms-clamp-2">{course.description}</p>}

                <div className="lms-card-stats">
                  <span>
                    <Users size={13} aria-hidden="true" />
                    {course.enrolledCount ?? 0} Students
                  </span>
                  <span>
                    <FolderOpen size={13} aria-hidden="true" />
                    {course.materialCount ?? 0} Materials
                  </span>
                  <span>
                    <FileText size={13} aria-hidden="true" />
                    {course.assignmentCount ?? 0} Assignments
                  </span>
                  <span>
                    <HelpCircle size={13} aria-hidden="true" />
                    {course.quizCount ?? 0} Quizzes
                  </span>
                </div>

                <div className="lms-card-footer" style={{ justifyContent: "flex-end" }}>
                  <Link
                    to={`/instructor/courses/${course._id}`}
                    className="lms-button lms-button--outline lms-button--sm"
                  >
                    Open Workspace <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="lms-table-wrap">
          <table className="lms-table">
            <thead>
              <tr>
                <th>Course</th>
                <th className="is-numeric">Students</th>
                <th className="is-numeric">Materials</th>
                <th className="is-numeric">Assignments</th>
                <th className="is-numeric">Quizzes</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((course) => (
                <tr key={course._id}>
                  <td>
                    <div style={{ marginBottom: "2px" }}>
                      <span className="lms-course-code">{course.courseCode}</span>
                    </div>
                    <Link
                      to={`/instructor/courses/${course._id}`}
                      style={{ fontWeight: 600, fontSize: "14px" }}
                    >
                      {course.courseName}
                    </Link>
                  </td>
                  <td className="is-numeric">{course.enrolledCount ?? 0}</td>
                  <td className="is-numeric">{course.materialCount ?? 0}</td>
                  <td className="is-numeric">{course.assignmentCount ?? 0}</td>
                  <td className="is-numeric">{course.quizCount ?? 0}</td>
                  <td>
                    <Badge variant={course.isActive === false ? "INACTIVE" : "ACTIVE"} size="sm" />
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <Link
                      to={`/instructor/courses/${course._id}`}
                      className="lms-button lms-button--outline lms-button--sm"
                    >
                      Open Workspace
                    </Link>
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
