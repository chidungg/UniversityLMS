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

  const activeCount = courses.filter((c) => c.isActive).length;
  const inactiveCount = courses.length - activeCount;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <Breadcrumb items={[{ label: "Dashboard", to: "/student/dashboard" }, { label: "My Courses" }]} />

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
            My Enrolled Courses
          </h1>
          <p style={{ fontSize: "14px", color: "var(--color-text-secondary)" }}>
            Review registered syllabus modules, lecture materials, and coursework assignments.
          </p>
        </div>
      </div>

      {/* Filter and Tab Bar */}
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
            { id: "all", label: `All Courses (${courses.length})` },
            { id: "active", label: `Active (${activeCount})` },
            { id: "inactive", label: `Inactive (${inactiveCount})` },
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

        {/* Search */}
        <form onSubmit={handleSearchSubmit} style={{ width: "280px" }}>
          <Input
            icon={Search}
            placeholder="Search by code or title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ height: "36px" }}
          />
        </form>
      </div>

      {/* Content Area */}
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
              ? "No enrolled courses matched your search query. Try another term or clear the filter."
              : "You are not enrolled in any courses yet. Please contact your academic department."
          }
          actionLabel={searchQuery || statusFilter !== "all" ? "Reset Filters" : undefined}
          onAction={() => {
            setSearchQuery("");
            setStatusFilter("all");
            api.getCourses({ q: "", status: "all" }).then((res) => setCourses(res.data));
          }}
        />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
            gap: "20px",
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
                  padding: "22px 20px 18px 20px",
                  justifyContent: "space-between",
                  gap: "16px",
                }}
              >
                {/* Top Subject Color Accent Line */}
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
                  {/* Subject Tag & Status Badge */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div
                        style={{
                          width: "30px",
                          height: "30px",
                          borderRadius: "8px",
                          backgroundColor: theme.colorLight,
                          color: theme.color,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <ThemeIcon size={16} />
                      </div>
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: 700,
                          color: theme.color,
                          letterSpacing: "0.03em",
                        }}
                      >
                        {course.courseCode}
                      </span>
                    </div>

                    <Badge variant={course.isActive ? "ACTIVE" : "INACTIVE"} size="sm" />
                  </div>

                  {/* Course Title */}
                  <h3
                    style={{
                      fontSize: "17px",
                      fontWeight: 600,
                      color: "var(--color-text)",
                      lineHeight: 1.35,
                      marginBottom: "8px",
                    }}
                  >
                    <Link
                      to={`/student/courses/${course._id}`}
                      style={{ color: "var(--color-text)", textDecoration: "none" }}
                    >
                      {course.courseName}
                    </Link>
                  </h3>

                  {/* Concise Course Focus Note */}
                  <p
                    style={{
                      fontSize: "13px",
                      color: "var(--color-text-secondary)",
                      lineHeight: 1.45,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      marginBottom: "14px",
                    }}
                  >
                    {course.description || "Core undergraduate syllabus curriculum."}
                  </p>

                  {/* Syllabus Stats Pill */}
                  <div
                    className="tabular-nums"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      fontSize: "12px",
                      color: "var(--color-text-muted)",
                      backgroundColor: "var(--color-surface-soft)",
                      padding: "8px 12px",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--color-border-subtle)",
                    }}
                  >
                    <span>{course.materialCount ?? 0} Materials</span>
                    <span>•</span>
                    <span>{course.assignmentCount ?? 0} Assignments</span>
                  </div>
                </div>

                {/* Card Action Bar */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    paddingTop: "12px",
                    borderTop: "1px solid var(--color-border-subtle)",
                  }}
                >
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
