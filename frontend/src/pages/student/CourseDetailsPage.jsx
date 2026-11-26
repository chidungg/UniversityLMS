import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  FileText,
  FolderOpen,
  HelpCircle,
  Bell,
  ArrowRight,
  User,
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
      <div className="lms-page">
        <Breadcrumb
          items={[
            { label: "Dashboard", to: "/student/dashboard" },
            { label: "My Courses", to: "/student/courses" },
            { label: "Course" },
          ]}
        />
        <ErrorBanner message={error} onRetry={fetchCourse} />
      </div>
    );
  }

  if (!course) return null;

  const theme = getCourseTheme(course.courseCode);
  const SubjectIcon = theme.icon;

  return (
    <div className="lms-page">
      <Breadcrumb
        items={[
          { label: "Dashboard", to: "/student/dashboard" },
          { label: "My Courses", to: "/student/courses" },
          { label: course.courseCode },
        ]}
      />

      <section className="lms-card lms-card-accent" style={{ gap: "12px", padding: "20px 22px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span className="lms-course-code">
            <SubjectIcon size={13} aria-hidden="true" />
            {course.courseCode}
          </span>
          <Badge variant={course.isActive ? "ACTIVE" : "INACTIVE"} size="sm" />
        </div>

        <h1 style={{ margin: 0 }}>{course.courseName}</h1>

        {course.instructor && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
            <User size={14} aria-hidden="true" />
            <span>
              Instructor: <strong>{course.instructor}</strong>
            </span>
          </div>
        )}

        {course.description && (
          <p style={{ fontSize: "14px", lineHeight: 1.6, maxWidth: "75ch", margin: 0 }}>
            {course.description}
          </p>
        )}
      </section>

      <section className="lms-section">
        <h2>Course Modules</h2>
        <div className="lms-grid-cards">
          <div className="lms-card lms-card-accent">
            <div className="lms-section-title">
              <FolderOpen size={17} aria-hidden="true" />
              <h3 style={{ margin: 0 }}>Learning Materials</h3>
            </div>
            <p className="tabular-nums" style={{ fontSize: "13px", margin: 0 }}>
              <strong>{course.materialCount ?? 0}</strong> slides, readings, and study attachments.
            </p>
            <div className="lms-card-footer">
              <Link to={`/student/courses/${course._id}/materials`} style={{ width: "100%" }}>
                <Button variant="primary" size="sm" icon={ArrowRight} style={{ width: "100%" }}>
                  Access Materials
                </Button>
              </Link>
            </div>
          </div>

          <div className="lms-card lms-card-accent">
            <div className="lms-section-title">
              <FileText size={17} aria-hidden="true" />
              <h3 style={{ margin: 0 }}>Course Assignments</h3>
            </div>
            <p className="tabular-nums" style={{ fontSize: "13px", margin: 0 }}>
              <strong>{course.assignmentCount ?? 0}</strong> tasks, projects, and lab submissions.
            </p>
            <div className="lms-card-footer">
              <Link to={`/student/assignments?courseId=${course._id}`} style={{ width: "100%" }}>
                <Button variant="secondary" size="sm" icon={ArrowRight} style={{ width: "100%" }}>
                  View Assignments
                </Button>
              </Link>
            </div>
          </div>

          <div className="lms-card lms-card-accent">
            <div className="lms-section-title">
              <HelpCircle size={17} aria-hidden="true" />
              <h3 style={{ margin: 0 }}>Assessments &amp; Quizzes</h3>
            </div>
            <p style={{ fontSize: "13px", margin: 0 }}>
              Timed multiple-choice quizzes and review evaluations.
            </p>
            <div className="lms-card-footer">
              <Link to={`/student/quizzes?courseId=${course._id}`} style={{ width: "100%" }}>
                <Button variant="secondary" size="sm" icon={ArrowRight} style={{ width: "100%" }}>
                  View Quizzes
                </Button>
              </Link>
            </div>
          </div>

          <div className="lms-card lms-card-accent">
            <div className="lms-section-title">
              <Bell size={17} aria-hidden="true" />
              <h3 style={{ margin: 0 }}>Course Notices</h3>
            </div>
            <p style={{ fontSize: "13px", margin: 0 }}>
              Instructor bulletins, schedule updates, and exam notices.
            </p>
            <div className="lms-card-footer">
              <Link to={`/student/announcements?courseId=${course._id}`} style={{ width: "100%" }}>
                <Button variant="secondary" size="sm" icon={ArrowRight} style={{ width: "100%" }}>
                  View Notices
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
