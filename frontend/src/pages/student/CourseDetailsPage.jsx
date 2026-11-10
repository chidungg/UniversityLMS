import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  FileText,
  FolderOpen,
  HelpCircle,
  Bell,
  ArrowRight,
  User,
  GraduationCap,
} from "lucide-react";
import { api } from "../../services/api";
import { Breadcrumb } from "../../components/ui/Breadcrumb";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { ErrorBanner } from "../../components/ui/ErrorBanner";
import { getCourseTheme } from "../../utils/courseThemes";

export const CourseDetailsPage = () => {
  const { courseId } = useParams();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchCourse = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.getCourseDetails(courseId);
      if (res.status === "success") {
        setCourse(res.data);
      }
    } catch (err) {
      setError(err.message || "Failed to load course details.");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    fetchCourse();
  }, [fetchCourse]);

  if (loading) {
    return <LoadingSpinner message="Loading course information..." />;
  }

  if (error) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <Breadcrumb items={[{ label: "Dashboard", to: "/student/dashboard" }, { label: "My Courses", to: "/student/courses" }, { label: "Course" }]} />
        <ErrorBanner message={error} onRetry={fetchCourse} />
      </div>
    );
  }

  if (!course) return null;

  const theme = getCourseTheme(course.courseCode);
  const SubjectIcon = theme.icon;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <Breadcrumb
        items={[
          { label: "Dashboard", to: "/student/dashboard" },
          { label: "My Courses", to: "/student/courses" },
          { label: course.courseCode },
        ]}
      />

      {/* Course Banner Hero Card */}
      <div
        className="lms-course-card"
        style={{
          backgroundColor: "var(--color-surface)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--color-border)",
          borderTop: `4px solid ${theme.color}`,
          padding: "24px 28px",
          display: "flex",
          flexDirection: "column",
          gap: "18px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: theme.badgeColor,
                  backgroundColor: theme.badgeBg,
                  border: `1px solid ${theme.border}`,
                  padding: "3px 10px",
                  borderRadius: "4px",
                }}
              >
                <SubjectIcon size={14} />
                {course.courseCode}
              </span>
              <Badge variant={course.isActive ? "ACTIVE" : "INACTIVE"} />
            </div>

            <h1 style={{ fontSize: "24px", fontWeight: 700, color: "var(--color-text)", marginBottom: "8px", letterSpacing: "-0.015em" }}>
              {course.courseName}
            </h1>

            <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap", fontSize: "13px", color: "var(--color-text-secondary)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <User size={14} style={{ color: "var(--color-text-muted)" }} />
                <span>Instructor: <strong>{course.instructor || "Dr. Faculty Lead"}</strong></span>
              </span>
              <span>•</span>
              <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <GraduationCap size={14} style={{ color: "var(--color-text-muted)" }} />
                <span>Semester: Fall 2026 (3 Credits)</span>
              </span>
            </div>
          </div>
        </div>

        <div style={{ maxWidth: "75ch" }}>
          <h2 style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-text)", marginBottom: "6px" }}>
            Course Overview & Learning Objectives
          </h2>
          <p style={{ fontSize: "14px", color: "var(--color-text-secondary)", lineHeight: 1.65 }}>
            {course.description || "No extended syllabus description has been provided for this course."}
          </p>
        </div>

        {/* Quick Resource Actions */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "16px",
            marginTop: "8px",
            paddingTop: "20px",
            borderTop: "1px solid var(--color-border)",
          }}
        >
          {/* Learning Materials Portal Card */}
          <div
            className="lms-course-card"
            style={{
              padding: "16px 18px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-border)",
              backgroundColor: "var(--color-surface)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              gap: "14px",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--color-primary-700)", marginBottom: "6px" }}>
                <FolderOpen size={18} />
                <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--color-text)" }}>
                  Learning Materials
                </h3>
              </div>
              <p style={{ fontSize: "13px", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
                <span className="tabular-nums font-semibold">{course.materialCount ?? 0}</span> lecture slide sets, lab assignments, and study attachments.
              </p>
            </div>
            <Link to={`/student/courses/${course._id}/materials`}>
              <Button variant="primary" size="sm" icon={ArrowRight} style={{ width: "100%" }}>
                Access Materials
              </Button>
            </Link>
          </div>

          {/* Assignments Portal Card */}
          <div
            className="lms-course-card"
            style={{
              padding: "16px 18px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-border)",
              backgroundColor: "var(--color-surface)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              gap: "14px",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--color-primary-700)", marginBottom: "6px" }}>
                <FileText size={18} />
                <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--color-text)" }}>
                  Course Assignments
                </h3>
              </div>
              <p style={{ fontSize: "13px", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
                <span className="tabular-nums font-semibold">{course.assignmentCount ?? 0}</span> topic tasks, project deliverables, and lab submissions.
              </p>
            </div>
            <Link to={`/student/assignments?courseId=${course._id}`}>
              <Button variant="secondary" size="sm" icon={ArrowRight} style={{ width: "100%" }}>
                View Assignments
              </Button>
            </Link>
          </div>

          {/* Quizzes Portal Card */}
          <div
            className="lms-course-card"
            style={{
              padding: "16px 18px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-border)",
              backgroundColor: "var(--color-surface)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              gap: "14px",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--color-primary-700)", marginBottom: "6px" }}>
                <HelpCircle size={18} />
                <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--color-text)" }}>
                  Assessments & Quizzes
                </h3>
              </div>
              <p style={{ fontSize: "13px", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
                Timed multiple-choice evaluations and periodic review quizzes.
              </p>
            </div>
            <Link to={`/student/quizzes?courseId=${course._id}`}>
              <Button variant="secondary" size="sm" icon={ArrowRight} style={{ width: "100%" }}>
                View Quizzes
              </Button>
            </Link>
          </div>

          {/* Announcements Portal Card */}
          <div
            className="lms-course-card"
            style={{
              padding: "16px 18px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-border)",
              backgroundColor: "var(--color-surface)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              gap: "14px",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--color-primary-700)", marginBottom: "6px" }}>
                <Bell size={18} />
                <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--color-text)" }}>
                  Course Notices
                </h3>
              </div>
              <p style={{ fontSize: "13px", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
                Official instructor bulletins, syllabus updates, and exam dates.
              </p>
            </div>
            <Link to={`/student/announcements?courseId=${course._id}`}>
              <Button variant="secondary" size="sm" icon={ArrowRight} style={{ width: "100%" }}>
                View Notices
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
