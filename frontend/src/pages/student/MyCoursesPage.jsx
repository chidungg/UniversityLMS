import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Search, ArrowRight, FolderX } from "lucide-react";
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

export const MyCoursesPage = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.getCourses({ q: searchQuery, status: statusFilter });
      if (res.status === "success") {
        setCourses(res.data);
      }
    } catch (err) {
      setError(err.message || "Failed to load enrolled courses.");
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchCourses();
  };

  return (
    <div className="lms-page">
      <Breadcrumb items={[{ label: "Dashboard", to: "/student/dashboard" }, { label: "My Courses" }]} />

      <div className="lms-page-header">
        <div className="lms-page-header-left">
          <div className="lms-page-title-row">
            <h1>My Enrolled Courses</h1>
            {!loading && !error && <span className="lms-count-tag">{courses.length}</span>}
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

        <form onSubmit={handleSearchSubmit} style={{ width: "min(280px, 100%)" }}>
          <Input
            icon={Search}
            aria-label="Search courses"
            placeholder="Search by code or title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </form>
      </div>

      {loading ? (
        <LoadingSpinner message="Loading your courses..." />
      ) : error ? (
        <ErrorBanner message={error} onRetry={fetchCourses} />
      ) : courses.length === 0 ? (
        <EmptyState
          icon={FolderX}
          title={searchQuery ? "No matching courses found" : "No enrolled courses"}
          description={
            searchQuery
              ? "No enrolled courses matched your search query."
              : "You are not enrolled in any courses yet."
          }
          actionLabel={searchQuery || statusFilter !== "all" ? "Reset Filters" : undefined}
          onAction={() => {
            setSearchQuery("");
            setStatusFilter("all");
            api.getCourses({ q: "", status: "all" }).then((res) => setCourses(res.data));
          }}
        />
      ) : (
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
                  <Badge variant={course.isActive ? "ACTIVE" : "INACTIVE"} size="sm" />
                </div>

                <h2 className="lms-card-title">
                  <Link to={`/student/courses/${course._id}`}>{course.courseName}</Link>
                </h2>

                {course.description && <p className="lms-clamp-2">{course.description}</p>}

                <div className="lms-info-box tabular-nums" style={{ padding: "8px 12px", fontSize: "12px" }}>
                  {course.materialCount ?? 0} Materials · {course.assignmentCount ?? 0} Assignments
                </div>

                <div className="lms-card-footer">
                  <Link to={`/student/courses/${course._id}`} style={{ flex: 1 }}>
                    <Button variant="primary" size="sm" style={{ width: "100%" }}>
                      Enter Course
                    </Button>
                  </Link>
                  <Link to={`/student/courses/${course._id}/materials`}>
                    <Button variant="secondary" size="sm" icon={ArrowRight}>
                      Materials
                    </Button>
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
