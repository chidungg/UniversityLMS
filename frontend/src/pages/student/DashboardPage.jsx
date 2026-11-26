import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  FileText,
  Clock,
  ArrowRight,
  Bell,
  AlertCircle,
  FolderOpen,
} from "lucide-react";
import { useAuth } from "../../app/AuthContext";
import { api } from "../../services/api";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorBanner } from "../../components/ui/ErrorBanner";
import { getCourseTheme } from "../../utils/courseThemes";

export const DashboardPage = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeAnnouncement, setActiveAnnouncement] = useState(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.getDashboard();
      if (res.status === "success") {
        setData(res.data);
      }
    } catch (err) {
      setError(err.message || "Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (loading) {
    return <LoadingSpinner message="Loading your student workspace..." />;
  }

  if (error) {
    return <ErrorBanner message={error} onRetry={fetchDashboard} />;
  }

  const {
    courses = [],
    upcomingAssignments = [],
    recentAnnouncements = [],
    stats = {},
  } = data || {};

  const nextPriorityTask = upcomingAssignments.find((a) => a.status === "PENDING");

  return (
    <div className="lms-page">
      <div className="lms-page-header">
        <div className="lms-page-header-left">
          <h1>Welcome back, {user?.fullName || "Student"}</h1>
        </div>

        <div className="lms-page-actions">
          <Link to="/student/assignments">
            <Button variant="secondary" size="sm" icon={FileText}>
              All Assignments
            </Button>
          </Link>
          <Link to="/student/courses">
            <Button variant="primary" size="sm" icon={BookOpen}>
              My Courses
            </Button>
          </Link>
        </div>
      </div>

      {nextPriorityTask && (
        <div
          className="lms-card lms-card-accent"
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "14px",
            padding: "14px 18px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span className="lms-course-code">
                {nextPriorityTask.courseId?.courseCode || "Course"}
              </span>
              <span style={{ fontSize: "12px", fontWeight: 600 }}>Next Due Assignment</span>
            </div>
            <h2 style={{ fontSize: "15px", margin: 0 }}>{nextPriorityTask.title}</h2>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <span
              className="tabular-nums"
              style={{ fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "5px" }}
            >
              <Clock size={14} aria-hidden="true" />
              Due{" "}
              {new Date(nextPriorityTask.dueDate).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <Link to={`/student/assignments/${nextPriorityTask._id}`}>
              <Button variant="primary" size="sm" icon={ArrowRight}>
                Submit Now
              </Button>
            </Link>
          </div>
        </div>
      )}

      <div className="lms-metric-strip">
        <div className="lms-metric-cell">
          <span className="lms-metric-label">Enrolled Courses</span>
          <span className="lms-metric-value">{stats.totalCourses ?? courses.length}</span>
        </div>
        <div className="lms-metric-cell">
          <span className="lms-metric-label">Pending Assignments</span>
          <span className="lms-metric-value">{stats.pendingAssignments ?? 0}</span>
        </div>
        <div className="lms-metric-cell">
          <span className="lms-metric-label">Completed Submissions</span>
          <span className="lms-metric-value">{stats.submittedAssignments ?? 0}</span>
        </div>
      </div>

      <section className="lms-section">
        <div className="lms-section-head">
          <div className="lms-section-title">
            <BookOpen size={17} aria-hidden="true" />
            <h2>My Enrolled Courses</h2>
          </div>
          <Link to="/student/courses" className="lms-link" style={{ fontSize: "13px" }}>
            View all courses
          </Link>
        </div>

        {courses.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="No enrolled courses"
            description="You are not currently enrolled in any courses."
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
                    <Badge variant={course.isActive ? "ACTIVE" : "INACTIVE"} size="sm" />
                  </div>

                  <h3 className="lms-card-title">
                    <Link to={`/student/courses/${course._id}`}>{course.courseName}</Link>
                  </h3>

                  <div className="lms-card-meta">
                    <span>{course.materialCount ?? 0} Materials</span>
                    <span>·</span>
                    <span>{course.assignmentCount ?? 0} Assignments</span>
                  </div>

                  <div className="lms-card-footer">
                    <Link
                      to={`/student/courses/${course._id}`}
                      className="lms-link"
                      style={{ fontSize: "13px", fontWeight: 600 }}
                    >
                      Enter Course
                    </Link>

                    <Link
                      to={`/student/courses/${course._id}/materials`}
                      className="lms-link"
                      style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "12px" }}
                    >
                      Materials <ArrowRight size={13} aria-hidden="true" />
                    </Link>
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
              <Clock size={16} aria-hidden="true" />
              <h2>Upcoming Deadlines</h2>
            </div>
            <Link to="/student/assignments" className="lms-link" style={{ fontSize: "13px" }}>
              View all
            </Link>
          </div>

          <div className="lms-feed-list">
            {upcomingAssignments.length === 0 ? (
              <div className="lms-feed-empty">All caught up. No pending assignments.</div>
            ) : (
              upcomingAssignments.slice(0, 4).map((assignment) => {
                const dueDate = new Date(assignment.dueDate);
                const isOverdue = dueDate < new Date() && assignment.status === "PENDING";

                return (
                  <div key={assignment._id} className="lms-feed-row">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px", flexWrap: "wrap" }}>
                        <span className="lms-course-code">
                          {assignment.courseId?.courseCode || "Course"}
                        </span>
                        <span
                          className="tabular-nums"
                          style={{
                            fontSize: "12px",
                            fontWeight: isOverdue ? 600 : 400,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          {isOverdue && <AlertCircle size={12} aria-hidden="true" />}
                          {isOverdue ? "Past Due" : "Due"}{" "}
                          {dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      </div>

                      <Link
                        to={`/student/assignments/${assignment._id}`}
                        style={{
                          fontSize: "14px",
                          fontWeight: 600,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          display: "block",
                        }}
                      >
                        {assignment.title}
                      </Link>
                    </div>

                    <Link to={`/student/assignments/${assignment._id}`}>
                      <Button
                        variant={assignment.status === "PENDING" ? "primary" : "outline"}
                        size="sm"
                      >
                        {assignment.status === "PENDING" ? "Submit" : "Details"}
                      </Button>
                    </Link>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="lms-panel">
          <div className="lms-panel-header">
            <div className="lms-section-title">
              <Bell size={16} aria-hidden="true" />
              <h2>Latest Announcements</h2>
            </div>
            <Link to="/student/announcements" className="lms-link" style={{ fontSize: "13px" }}>
              View all
            </Link>
          </div>

          <div className="lms-feed-list">
            {recentAnnouncements.length === 0 ? (
              <div className="lms-feed-empty">No recent announcements.</div>
            ) : (
              recentAnnouncements.slice(0, 4).map((ann) => (
                <button
                  key={ann._id}
                  type="button"
                  className="lms-feed-row"
                  style={{
                    width: "100%",
                    border: "none",
                    borderBottom: "1px solid var(--color-border-subtle)",
                    background: "transparent",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                  onClick={() => setActiveAnnouncement(ann)}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
                      <span className="lms-course-code">{ann.courseId?.courseCode}</span>
                      <span className="tabular-nums" style={{ fontSize: "12px" }}>
                        {new Date(ann.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>

                    <div style={{ fontSize: "14px", fontWeight: 600, marginBottom: "2px" }}>
                      {ann.title}
                    </div>

                    <p
                      style={{
                        fontSize: "12px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        margin: 0,
                      }}
                    >
                      {ann.content}
                    </p>
                  </div>

                  <ArrowRight size={15} aria-hidden="true" style={{ flexShrink: 0 }} />
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {activeAnnouncement && (
        <Modal
          isOpen={Boolean(activeAnnouncement)}
          onClose={() => setActiveAnnouncement(null)}
          title={activeAnnouncement.title}
          maxWidth="620px"
          footer={
            <Button variant="secondary" size="sm" onClick={() => setActiveAnnouncement(null)}>
              Close
            </Button>
          }
        >
          <div className="lms-form-stack">
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", fontSize: "12px" }}>
              <span className="lms-course-code">{activeAnnouncement.courseId?.courseCode}</span>
              <span className="tabular-nums">
                {new Date(activeAnnouncement.createdAt).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>

            <p style={{ fontSize: "14px", lineHeight: 1.65, whiteSpace: "pre-wrap", margin: 0 }}>
              {activeAnnouncement.content}
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
};
