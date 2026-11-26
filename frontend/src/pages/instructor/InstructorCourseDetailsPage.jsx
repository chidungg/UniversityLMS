import { useState, useEffect } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowRight, FileText, FolderOpen, HelpCircle, User } from "lucide-react";
import { api } from "../../services/api";
import { Breadcrumb } from "../../components/ui/Breadcrumb";
import { Badge } from "../../components/ui/Badge";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorBanner } from "../../components/ui/ErrorBanner";
import { getCourseTheme } from "../../utils/courseThemes";
import { EnrolledStudentsPanel } from "./components/EnrolledStudentsPanel";

const assignedCourses = { label: "Assigned Courses", to: "/instructor/courses" };
const managementPages = {
  materials: {
    label: "Learning Materials",
    icon: FolderOpen,
    count: "materialCount",
    path: (id) => `/instructor/courses/${id}/materials`,
  },
  assignments: {
    label: "Assignments & Grading",
    icon: FileText,
    count: "assignmentCount",
    path: (id) => `/instructor/assignments?courseId=${id}`,
  },
  quizzes: {
    label: "Quizzes & Assessments",
    icon: HelpCircle,
    count: "quizCount",
    path: (id) => `/instructor/quizzes?courseId=${id}`,
  },
};

export const InstructorCourseDetailsPage = () => {
  const { courseId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab");
  const showRoster = tab === "students";
  const [result, setResult] = useState(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api.getInstructorCourseDetails(courseId, { signal: controller.signal })
      .then(({ data }) => {
        if (!controller.signal.aborted) setResult({ courseId, retry, data });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setResult({ courseId, retry, error });
      });
    return () => controller.abort();
  }, [courseId, retry]);

  if (!result || result.courseId !== courseId || result.retry !== retry) {
    return <LoadingSpinner message="Loading course workspace..." />;
  }

  const { data, error } = result;
  if (error || !data?.course) {
    const unavailable = error?.status === 404;
    return (
      <div className="lms-page">
        <Breadcrumb items={[assignedCourses, { label: "Course Workspace" }]} />
        <ErrorBanner
          message={error?.message || "Failed to load course workspace."}
          onRetry={unavailable ? undefined : () => setRetry((current) => current + 1)}
        />
        <div>
          <Link to={assignedCourses.to} className="lms-link">
            Back to Assigned Courses
          </Link>
        </div>
      </div>
    );
  }

  const { course, managementOptions = [] } = data;
  const options = Object.entries(managementPages).filter(([id]) => managementOptions.includes(id));
  if (options.some(([id]) => id === tab)) {
    return <Navigate replace to={managementPages[tab].path(course._id)} />;
  }

  const theme = getCourseTheme(course);
  const SubjectIcon = theme.icon;

  return (
    <div className="lms-page">
      <Breadcrumb items={[assignedCourses, { label: course.courseCode }]} />

      <section className="lms-card lms-card-accent" style={{ gap: "12px", padding: "20px 22px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span className="lms-course-code">
            <SubjectIcon size={13} aria-hidden="true" />
            {course.courseCode}
          </span>
          <Badge variant={course.isActive === false ? "INACTIVE" : "ACTIVE"} size="sm" />
        </div>

        <h1 style={{ margin: 0 }}>{course.courseName}</h1>

        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
          <User size={14} aria-hidden="true" />
          <span>
            Instructor: <strong>{course.instructor}</strong>
          </span>
        </div>

        {course.description && (
          <p style={{ fontSize: "14px", lineHeight: 1.55, margin: 0 }}>{course.description}</p>
        )}

        <div
          role="tablist"
          aria-label="Course information"
          style={{
            display: "flex",
            gap: "6px",
            flexWrap: "wrap",
            paddingTop: "8px",
            borderTop: "1px solid var(--color-border-subtle)",
          }}
        >
          {[
            { id: "overview", label: "Overview", selected: !showRoster },
            { id: "students", label: "Enrolled Students", selected: showRoster },
          ].map(({ id, label, selected }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`course-${id}`}
              id={`course-tab-${id}`}
              className={`lms-pill-tab ${selected ? "active" : ""}`}
              onClick={() => setSearchParams(id === "students" ? { tab: id } : {})}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {!showRoster && (
        <section id="course-overview" role="tabpanel" aria-labelledby="course-tab-overview" className="lms-section">
          <h2>Manage Course</h2>
          {options.length > 0 ? (
            <div className="lms-grid-cards">
              {options.map(([id, { label, icon: Icon, count, path }]) => (
                <Link key={id} to={path(course._id)} className="lms-nav-tile">
                  <Icon size={17} aria-hidden="true" />
                  <span style={{ flex: 1 }}>{label}</span>
                  <span className="lms-count-tag">{course[count] ?? 0}</span>
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={FolderOpen}
              title="Course management unavailable"
              description="This course is inactive."
            />
          )}
        </section>
      )}

      {showRoster && <EnrolledStudentsPanel key={course._id} course={course} />}
    </div>
  );
};
