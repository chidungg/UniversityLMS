import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  Clock,
  FileText,
  ClipboardCheck,
  Calendar,
  FolderOpen,
  Plus,
} from "lucide-react";
import { api } from "../../services/api";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorBanner } from "../../components/ui/ErrorBanner";
import { getCourseTheme } from "../../utils/courseThemes";
import { formatDateTime, formatShortDate } from "./components/formatters";

export const InstructorDashboardPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.getInstructorDashboard();
      if (res.status === "success") {
        setData(res.data);
      }
    } catch (err) {
      setError(err.message || "Failed to load instructor dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (loading) {
    return <LoadingSpinner message="Loading instructor workspace..." />;
  }

  if (error) {
    return <ErrorBanner message={error} onRetry={fetchDashboard} />;
  }

  const {
    instructor = {},
    courses = [],
    pendingSubmissions = [],
    upcomingSchedule = [],
    stats = {},
  } = data || {};

  return (
    <div className="lms-page">
      <div className="lms-page-header">
        <div className="lms-page-header-left">
          <h1>Welcome back, {instructor.fullName || "Instructor"}</h1>
        </div>

        <div className="lms-page-actions">
          <Link to="/instructor/quizzes/new">
            <Button variant="secondary" size="sm" icon={Plus}>
              New Quiz
            </Button>
          </Link>
          <Link to="/instructor/assignments">
            <Button variant="secondary" size="sm" icon={FileText}>
              Assignments
            </Button>
          </Link>
          <Link to="/instructor/courses">
            <Button variant="primary" size="sm" icon={BookOpen}>
              Assigned Courses
            </Button>
          </Link>
        </div>
      </div>

      <div className="lms-metric-strip">
        <div className="lms-metric-cell">
          <span className="lms-metric-label">Active Courses</span>
          <span className="lms-metric-value">{stats.assignedCourses ?? 0}</span>
        </div>
        <div className="lms-metric-cell">
          <span className="lms-metric-label">Enrolled Students</span>
          <span className="lms-metric-value">{stats.uniqueStudents ?? 0}</span>
        </div>
        <div className="lms-metric-cell">
          <span className="lms-metric-label">Awaiting Grading</span>
          <span className="lms-metric-value">{stats.pendingGrading ?? 0}</span>
        </div>
        <div className="lms-metric-cell">
          <span className="lms-metric-label">Open Quizzes</span>
          <span className="lms-metric-value">{stats.activeQuizzes ?? 0}</span>
        </div>
      </div>

      <section className="lms-section">
        <div className="lms-section-head">
          <div className="lms-section-title">
            <BookOpen size={17} aria-hidden="true" />
            <h2>My Assigned Courses</h2>
          </div>
          <Link to="/instructor/courses" className="lms-link" style={{ fontSize: "13px" }}>
            View all courses
          </Link>
        </div>

        {courses.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="No assigned courses"
            description="You have not been assigned to any courses yet."
          />
        ) : (
          <div className="lms-grid-cards">
            {courses.slice(0, 6).map((course) => {
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

                  <h3 className="lms-card-title">
                    <Link to={`/instructor/courses/${course._id}`}>{course.courseName}</Link>
                  </h3>

                  <div className="lms-card-meta">
                    <span>{course.enrolledCount ?? 0} Students</span>
                    <span>·</span>
                    <span>{course.materialCount ?? 0} Materials</span>
                    <span>·</span>
                    <span>{course.assignmentCount ?? 0} Assignments</span>
                  </div>

                  {course.pendingGradingCount > 0 && (
                    <div>
                      <span className="lms-tag-warning">
                        <Clock size={12} aria-hidden="true" />
                        {course.pendingGradingCount} awaiting grading
                      </span>
                    </div>
                  )}

                  <div className="lms-card-footer">
                    <Link
                      to={`/instructor/courses/${course._id}`}
                      className="lms-link"
                      style={{ fontSize: "13px", fontWeight: 600 }}
                    >
                      Manage Course
                    </Link>

                    <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "12px" }}>
                      <Link to={`/instructor/courses/${course._id}?tab=materials`} className="lms-link">
                        Materials
                      </Link>
                      <Link to={`/instructor/courses/${course._id}?tab=students`} className="lms-link">
                        Roster
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <div className="lms-grid-2">
        <div className="lms-panel">
          <div className="lms-panel-header">
            <div className="lms-section-title">
              <ClipboardCheck size={16} aria-hidden="true" />
              <h2>Submissions Awaiting Grading</h2>
            </div>
            <Link to="/instructor/assignments" className="lms-link" style={{ fontSize: "13px" }}>
              View all
            </Link>
          </div>

          <div className="lms-feed-list">
            {pendingSubmissions.length === 0 ? (
              <div className="lms-feed-empty">All student submissions have been graded.</div>
            ) : (
              pendingSubmissions.slice(0, 5).map((sub) => (
                <div key={sub._id} className="lms-feed-row">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px", flexWrap: "wrap" }}>
                      <span className="lms-course-code">{sub.course?.courseCode || "Course"}</span>
                      <span style={{ fontSize: "13px", fontWeight: 600 }}>{sub.student?.fullName}</span>
                      {sub.isLate && <Badge variant="LATE" size="sm" />}
                    </div>
                    <div
                      style={{
                        fontSize: "13px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {sub.assignmentTitle}
                    </div>
                    <div className="tabular-nums" style={{ fontSize: "12px", marginTop: "2px" }}>
                      Submitted {formatDateTime(sub.submittedAt)}
                    </div>
                  </div>

                  <Link to={`/instructor/assignments/${sub.assignmentId}`}>
                    <Button variant="primary" size="sm">
                      Grade
                    </Button>
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="lms-panel">
          <div className="lms-panel-header">
            <div className="lms-section-title">
              <Calendar size={16} aria-hidden="true" />
              <h2>Assessment Windows &amp; Deadlines</h2>
            </div>
            <Link to="/instructor/quizzes" className="lms-link" style={{ fontSize: "13px" }}>
              Manage quizzes
            </Link>
          </div>

          <div className="lms-feed-list">
            {upcomingSchedule.length === 0 ? (
              <div className="lms-feed-empty">No upcoming deadlines or quiz windows.</div>
            ) : (
              upcomingSchedule.map((item) => (
                <div key={`${item.kind}-${item.id}`} className="lms-feed-row">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px", flexWrap: "wrap" }}>
                      <span className="lms-course-code">{item.course?.courseCode}</span>
                      <span style={{ fontSize: "12px", fontWeight: 500 }}>
                        {item.kind === "ASSIGNMENT" ? "Assignment Due" : "Quiz Closes"} · {formatShortDate(item.date)}
                      </span>
                    </div>
                    <Link
                      to={item.to}
                      style={{
                        fontSize: "14px",
                        fontWeight: 600,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        display: "block",
                      }}
                    >
                      {item.title}
                    </Link>
                    {item.meta && <span style={{ fontSize: "12px" }}>{item.meta}</span>}
                  </div>

                  <Link to={item.to}>
                    <Button variant="outline" size="sm">
                      Open
                    </Button>
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
