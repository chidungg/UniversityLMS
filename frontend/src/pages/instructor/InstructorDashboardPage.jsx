import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  Users,
  Clock,
  HelpCircle,
  FileText,
  ArrowRight,
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
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* 1. Header */}
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
              Welcome back, {instructor.fullName || "Instructor"}
            </h1>
          </div>
          <p style={{ fontSize: "14px", color: "var(--color-text-secondary)" }}>
            Teaching Overview · You are assigned to {stats.assignedCourses ?? courses.length} active courses across {stats.uniqueStudents ?? 0} students.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
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

      {/* 2. Needs Grading Attention Strip */}
      {pendingSubmissions.length > 0 && (
        <div
          style={{
            backgroundColor: "var(--color-primary-50)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--color-info-border)",
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "16px",
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
              <ClipboardCheck size={20} />
            </div>
            <div>
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "var(--color-primary-700)",
                  marginBottom: "2px",
                }}
              >
                Grading Queue
              </div>
              <h2 style={{ fontSize: "15px", fontWeight: 600, color: "var(--color-text)" }}>
                {stats.pendingGrading} student {stats.pendingGrading === 1 ? "submission is" : "submissions are"} awaiting review and grading.
              </h2>
            </div>
          </div>

          <Link to={`/instructor/assignments/${pendingSubmissions[0].assignmentId}`}>
            <Button variant="primary" size="sm" icon={ArrowRight}>
              Review Submissions
            </Button>
          </Link>
        </div>
      )}

      {/* 3. Metric Status Strip */}
      <div
        className="tabular-nums"
        style={{
          backgroundColor: "var(--color-surface)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--color-border)",
          padding: "16px 24px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
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
              {stats.assignedCourses ?? 0}
            </div>
            <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Active Courses</div>
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
            <Users size={20} />
          </div>
          <div>
            <div style={{ fontSize: "22px", fontWeight: 700, color: "var(--color-text)", lineHeight: 1.2 }}>
              {stats.uniqueStudents ?? 0}
            </div>
            <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Enrolled Students</div>
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
              {stats.pendingGrading ?? 0}
            </div>
            <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Awaiting Grading</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "8px",
              backgroundColor: "#EEF2FF",
              color: "#4338CA",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <HelpCircle size={20} />
          </div>
          <div>
            <div style={{ fontSize: "22px", fontWeight: 700, color: "var(--color-text)", lineHeight: 1.2 }}>
              {stats.activeQuizzes ?? 0}
            </div>
            <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Open Quizzes</div>
          </div>
        </div>
      </div>

      {/* 4. Assigned Courses Grid */}
      <section style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <BookOpen size={18} style={{ color: "var(--color-primary-700)" }} />
            <h2 style={{ fontSize: "17px", fontWeight: 600, color: "var(--color-text)" }}>
              My Assigned Courses
            </h2>
          </div>
          <Link to="/instructor/courses" style={{ fontSize: "13px", fontWeight: 500 }}>
            View all courses
          </Link>
        </div>

        {courses.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="No assigned courses"
            description="You have not been assigned to any courses yet. Contact academic administration to update your teaching assignments."
          />
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(min(320px, 100%), 1fr))",
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
                      <Badge variant={course.isActive === false ? "INACTIVE" : "ACTIVE"} size="sm" />
                    </div>

                    <h3
                      style={{
                        fontSize: "16px",
                        fontWeight: 600,
                        color: "var(--color-text)",
                        lineHeight: 1.35,
                        marginBottom: "10px",
                      }}
                    >
                      <Link
                        to={`/instructor/courses/${course._id}`}
                        style={{ color: "var(--color-text)", textDecoration: "none" }}
                      >
                        {course.courseName}
                      </Link>
                    </h3>

                    <div
                      className="tabular-nums"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "10px",
                        fontSize: "12px",
                        color: "var(--color-text-muted)",
                      }}
                    >
                      <span>{course.enrolledCount ?? 0} Students</span>
                      <span>•</span>
                      <span>{course.materialCount ?? 0} Materials</span>
                      <span>•</span>
                      <span>{course.assignmentCount ?? 0} Assignments</span>
                    </div>

                    {course.pendingGradingCount > 0 && (
                      <div
                        style={{
                          marginTop: "10px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          backgroundColor: "var(--color-warning-bg)",
                          color: "var(--color-warning)",
                          fontSize: "12px",
                          fontWeight: 500,
                        }}
                      >
                        <Clock size={12} />
                        <span>{course.pendingGradingCount} awaiting grading</span>
                      </div>
                    )}
                  </div>

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
                      to={`/instructor/courses/${course._id}`}
                      style={{ fontSize: "13px", fontWeight: 600, color: theme.color }}
                    >
                      Manage Course
                    </Link>

                    <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "12px" }}>
                      <Link
                        to={`/instructor/courses/${course._id}?tab=materials`}
                        style={{ color: "var(--color-text-secondary)" }}
                      >
                        Materials
                      </Link>
                      <Link
                        to={`/instructor/courses/${course._id}?tab=students`}
                        style={{ color: "var(--color-text-secondary)" }}
                      >
                        Roster
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 5. Two-Column Activity Split */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          gap: "24px",
          alignItems: "start",
        }}
      >
        {/* Left: Submissions Awaiting Review */}
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
              <ClipboardCheck size={17} style={{ color: "var(--color-primary-700)" }} />
              <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--color-text)" }}>
                Submissions Awaiting Grading
              </h2>
            </div>
            <Link to="/instructor/assignments" style={{ fontSize: "13px", fontWeight: 500 }}>
              View all
            </Link>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            {pendingSubmissions.length === 0 ? (
              <div style={{ padding: "32px 20px", textAlign: "center", color: "var(--color-text-muted)", fontSize: "13px" }}>
                All student submissions have been graded.
              </div>
            ) : (
              pendingSubmissions.slice(0, 5).map((sub) => {
                const theme = getCourseTheme(sub.course);
                return (
                  <div
                    key={sub._id}
                    className="lms-feed-item"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "12px",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px", flexWrap: "wrap" }}>
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
                          {sub.course?.courseCode || "Course"}
                        </span>
                        <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text)" }}>
                          {sub.student?.fullName}
                        </span>
                        {sub.isLate && <Badge variant="LATE" size="sm" />}
                      </div>

                      <div
                        style={{
                          fontSize: "13px",
                          color: "var(--color-text-secondary)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {sub.assignmentTitle}
                      </div>
                      <div className="tabular-nums" style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "2px" }}>
                        Submitted {formatDateTime(sub.submittedAt)}
                      </div>
                    </div>

                    <Link to={`/instructor/assignments/${sub.assignmentId}`}>
                      <Button variant="primary" size="sm">
                        Grade
                      </Button>
                    </Link>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Course Assessment Schedule */}
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
              <Calendar size={17} style={{ color: "var(--color-primary-700)" }} />
              <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--color-text)" }}>
                Assessment Windows & Deadlines
              </h2>
            </div>
            <Link to="/instructor/quizzes" style={{ fontSize: "13px", fontWeight: 500 }}>
              Manage quizzes
            </Link>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            {upcomingSchedule.length === 0 ? (
              <div style={{ padding: "32px 20px", textAlign: "center", color: "var(--color-text-muted)", fontSize: "13px" }}>
                No upcoming deadlines or quiz windows.
              </div>
            ) : (
              upcomingSchedule.map((item) => {
                const theme = getCourseTheme(item.course);
                return (
                  <div
                    key={`${item.kind}-${item.id}`}
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
                          {item.course?.courseCode}
                        </span>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 600,
                            color: "var(--color-text-muted)",
                          }}
                        >
                          {item.kind === "ASSIGNMENT" ? "Assignment Due" : "Quiz Closes"} · {formatShortDate(item.date)}
                        </span>
                      </div>
                      <Link
                        to={item.to}
                        style={{
                          fontSize: "14px",
                          fontWeight: 600,
                          color: "var(--color-text)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          display: "block",
                        }}
                      >
                        {item.title}
                      </Link>
                      <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>{item.meta}</span>
                    </div>

                    <Link to={item.to}>
                      <Button variant="outline" size="sm">
                        Open
                      </Button>
                    </Link>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
