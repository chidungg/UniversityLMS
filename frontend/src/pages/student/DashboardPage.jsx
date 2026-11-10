import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  FileText,
  Clock,
  ArrowRight,
  Bell,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
  Sparkles,
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

  // Find highest priority pending assignment
  const nextPriorityTask = upcomingAssignments.find(
    (a) => a.status === "PENDING"
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* 1. Header & Academic Welcome */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "16px",
          paddingBottom: "18px",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <h1
              style={{
                fontSize: "24px",
                fontWeight: 700,
                color: "var(--color-text)",
                letterSpacing: "-0.015em",
              }}
            >
              Welcome back, {user?.fullName || "Student"}
            </h1>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--color-primary-700)",
                backgroundColor: "var(--color-primary-100)",
                padding: "2px 8px",
                borderRadius: "12px",
              }}
            >
              Fall 2026
            </span>
          </div>
          <p style={{ fontSize: "14px", color: "var(--color-text-secondary)" }}>
            Academic Term Overview · You are enrolled in {courses.length} active courses.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
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

      {/* 2. Priority Focus Task Banner (Progressive Priority) */}
      {nextPriorityTask && (
        <div
          style={{
            backgroundColor: "var(--color-surface)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid #BAE6FD",
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "16px",
            background: "linear-gradient(to right, #F8FAFC, #FFFFFF)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "10px",
                backgroundColor: "var(--color-primary-100)",
                color: "var(--color-primary-700)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Sparkles size={20} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "var(--color-primary-700)",
                  }}
                >
                  Priority Task
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "var(--color-text-muted)",
                  }}
                >
                  {nextPriorityTask.courseId?.courseCode || "Course"}
                </span>
              </div>
              <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--color-text)" }}>
                {nextPriorityTask.title}
              </h3>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div
              className="tabular-nums"
              style={{
                fontSize: "12px",
                color: "var(--color-text-secondary)",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Clock size={14} style={{ color: "var(--color-primary-700)" }} />
              <span>
                Due {new Date(nextPriorityTask.dueDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <Link to={`/student/assignments/${nextPriorityTask._id}`}>
              <Button variant="primary" size="sm" icon={ArrowRight}>
                Submit Now
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* 3. Streamlined Metric Status Strip */}
      <div
        className="tabular-nums"
        style={{
          backgroundColor: "var(--color-surface)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--color-border)",
          padding: "16px 24px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "24px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "8px",
              backgroundColor: "#EAF3FA",
              color: "var(--color-primary-700)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <BookOpen size={20} />
          </div>
          <div>
            <div style={{ fontSize: "22px", fontWeight: 700, color: "var(--color-text)", lineHeight: 1.2 }}>
              {stats.totalCourses ?? courses.length}
            </div>
            <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Enrolled Courses</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "8px",
              backgroundColor: "var(--color-warning-bg)",
              color: "var(--color-warning)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Clock size={20} />
          </div>
          <div>
            <div style={{ fontSize: "22px", fontWeight: 700, color: "var(--color-text)", lineHeight: 1.2 }}>
              {stats.pendingAssignments ?? 0}
            </div>
            <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Pending Assignments</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "8px",
              backgroundColor: "var(--color-success-bg)",
              color: "var(--color-success)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CheckCircle2 size={20} />
          </div>
          <div>
            <div style={{ fontSize: "22px", fontWeight: 700, color: "var(--color-text)", lineHeight: 1.2 }}>
              {stats.submittedAssignments ?? 0}
            </div>
            <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Completed Submissions</div>
          </div>
        </div>
      </div>

      {/* 4. Enrolled Courses (Distinct Subject Visual Cards - No Nested Cards) */}
      <section style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <BookOpen size={18} style={{ color: "var(--color-primary-700)" }} />
            <h2 style={{ fontSize: "17px", fontWeight: 600, color: "var(--color-text)" }}>
              My Enrolled Courses
            </h2>
          </div>
          <Link to="/student/courses" style={{ fontSize: "13px", fontWeight: 500 }}>
            View all courses
          </Link>
        </div>

        {courses.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="No enrolled courses"
            description="You are not currently enrolled in any academic courses."
          />
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: "18px",
            }}
          >
            {courses.slice(0, 6).map((course) => {
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
                  {/* Subtle Top Subject Border Accent */}
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
                    {/* Top Row: Course Code badge + Active pill */}
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
                        <span
                          style={{
                            fontSize: "12px",
                            fontWeight: 700,
                            color: theme.color,
                            letterSpacing: "0.02em",
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
                        fontSize: "16px",
                        fontWeight: 600,
                        color: "var(--color-text)",
                        lineHeight: 1.35,
                        marginBottom: "12px",
                      }}
                    >
                      <Link
                        to={`/student/courses/${course._id}`}
                        style={{ color: "var(--color-text)", textDecoration: "none" }}
                      >
                        {course.courseName}
                      </Link>
                    </h3>

                    {/* Metadata counters */}
                    <div
                      className="tabular-nums"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        fontSize: "12px",
                        color: "var(--color-text-muted)",
                      }}
                    >
                      <span>{course.materialCount ?? 0} Materials</span>
                      <span>•</span>
                      <span>{course.assignmentCount ?? 0} Assignments</span>
                    </div>
                  </div>

                  {/* Action Link bar */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingTop: "12px",
                      borderTop: "1px solid var(--color-border-subtle)",
                    }}
                  >
                    <Link
                      to={`/student/courses/${course._id}`}
                      style={{ fontSize: "13px", fontWeight: 600, color: theme.color }}
                    >
                      Enter Course
                    </Link>

                    <Link
                      to={`/student/courses/${course._id}/materials`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        fontSize: "12px",
                        color: "var(--color-text-secondary)",
                      }}
                    >
                      Materials <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 5. Two-Column Activity Split: Upcoming Tasks & Recent Announcements */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          gap: "24px",
          alignItems: "start",
        }}
      >
        {/* Left Column: Upcoming Deadlines Queue */}
        <div
          style={{
            backgroundColor: "var(--color-surface)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--color-border)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--color-border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Clock size={17} style={{ color: "var(--color-primary-700)" }} />
              <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--color-text)" }}>
                Upcoming Deadlines
              </h2>
            </div>
            <Link to="/student/assignments" style={{ fontSize: "13px", fontWeight: 500 }}>
              View all
            </Link>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            {upcomingAssignments.length === 0 ? (
              <div style={{ padding: "32px 20px", textAlign: "center", color: "var(--color-text-muted)", fontSize: "13px" }}>
                All caught up! No pending assignments.
              </div>
            ) : (
              upcomingAssignments.slice(0, 4).map((assignment) => {
                const dueDate = new Date(assignment.dueDate);
                const isOverdue = dueDate < new Date() && assignment.status === "PENDING";
                const theme = getCourseTheme(assignment.courseId);

                return (
                  <div
                    key={assignment._id}
                    className="lms-feed-item"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "12px",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            color: theme.color,
                            backgroundColor: theme.colorLight,
                            padding: "1px 6px",
                            borderRadius: "4px",
                          }}
                        >
                          {assignment.courseId?.courseCode || "Course"}
                        </span>
                        <div
                          className="tabular-nums"
                          style={{
                            fontSize: "12px",
                            color: isOverdue ? "var(--color-danger)" : "var(--color-text-muted)",
                            fontWeight: isOverdue ? 600 : 400,
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          {isOverdue && <AlertCircle size={12} />}
                          <span>
                            {isOverdue ? "Past Due" : "Due"} {dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        </div>
                      </div>

                      <Link
                        to={`/student/assignments/${assignment._id}`}
                        style={{
                          fontSize: "14px",
                          fontWeight: 600,
                          color: "var(--color-text)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          display: "block",
                          lineHeight: 1.3,
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

        {/* Right Column: Recent Announcements Feed */}
        <div
          style={{
            backgroundColor: "var(--color-surface)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--color-border)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--color-border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Bell size={17} style={{ color: "var(--color-primary-700)" }} />
              <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--color-text)" }}>
                Latest Announcements
              </h2>
            </div>
            <Link to="/student/announcements" style={{ fontSize: "13px", fontWeight: 500 }}>
              View all
            </Link>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            {recentAnnouncements.length === 0 ? (
              <div style={{ padding: "32px 20px", textAlign: "center", color: "var(--color-text-muted)", fontSize: "13px" }}>
                No recent announcements.
              </div>
            ) : (
              recentAnnouncements.slice(0, 4).map((ann) => {
                const theme = getCourseTheme(ann.courseId);

                return (
                  <div
                    key={ann._id}
                    className="lms-feed-item"
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: "12px",
                      cursor: "pointer",
                    }}
                    onClick={() => setActiveAnnouncement(ann)}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            color: theme.color,
                            backgroundColor: theme.colorLight,
                            padding: "1px 6px",
                            borderRadius: "4px",
                          }}
                        >
                          {ann.courseId?.courseCode}
                        </span>
                        <span className="tabular-nums" style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
                          {new Date(ann.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      </div>

                      <h4
                        style={{
                          fontSize: "13px",
                          fontWeight: 600,
                          color: "var(--color-text)",
                          marginBottom: "2px",
                        }}
                      >
                        {ann.title}
                      </h4>

                      <p
                        style={{
                          fontSize: "12px",
                          color: "var(--color-text-secondary)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {ann.content}
                      </p>
                    </div>

                    <ArrowRight size={15} style={{ color: "var(--color-text-muted)", marginTop: "12px", flexShrink: 0 }} />
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Announcement Modal Viewer */}
      {activeAnnouncement && (
        <Modal
          isOpen={!!activeAnnouncement}
          onClose={() => setActiveAnnouncement(null)}
          title={activeAnnouncement.title}
          maxWidth="640px"
          footer={
            <Button variant="secondary" size="sm" onClick={() => setActiveAnnouncement(null)}>
              Close
            </Button>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "12px", color: "var(--color-text-secondary)" }}>
              <span style={{ fontWeight: 600, color: "var(--color-primary-700)" }}>
                {activeAnnouncement.courseId?.courseCode}
              </span>
              <span>•</span>
              <span>
                {new Date(activeAnnouncement.createdAt).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>

            <p style={{ fontSize: "14px", color: "var(--color-text)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
              {activeAnnouncement.content}
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
};
