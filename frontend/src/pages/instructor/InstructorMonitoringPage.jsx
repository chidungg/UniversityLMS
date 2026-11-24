import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  BookOpen,
  ClipboardList,
  RefreshCw,
  ShieldCheck,
  Table2,
  Users,
} from "lucide-react";
import { api } from "../../services/api";
import { Badge } from "../../components/ui/Badge";
import { Breadcrumb } from "../../components/ui/Breadcrumb";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorBanner } from "../../components/ui/ErrorBanner";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { Select } from "../../components/ui/Select";
import { GradebookTable } from "./components/GradebookTable";
import { LearningProgressPanel } from "./components/LearningProgressPanel";
import { StudentMonitoringModal } from "./components/StudentMonitoringModal";
import "./components/instructorMonitoring.css";

export const InstructorMonitoringPage = () => {
  const { courseId: routeCourseId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const viewParam = searchParams.get("view") === "progress" ? "progress" : "gradebook";
  const queryCourseId = searchParams.get("courseId") || "";

  const [courseResult, setCourseResult] = useState(null);
  const [courseRetry, setCourseRetry] = useState(0);
  const [monitorResult, setMonitorResult] = useState(null);
  const [monitorRetry, setMonitorRetry] = useState(0);
  const [inspectRecord, setInspectRecord] = useState(null);

  useEffect(() => {
    document.title = "Monitor Students | University LMS";
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    api.getInstructorCourses({}, { signal: controller.signal })
      .then(({ data }) => {
        if (!controller.signal.aborted) {
          setCourseResult({ retry: courseRetry, courses: Array.isArray(data) ? data : [] });
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setCourseResult({ retry: courseRetry, error });
        }
      });
    return () => controller.abort();
  }, [courseRetry]);

  const coursesLoading = courseResult?.retry !== courseRetry;
  const courses = useMemo(
    () => (coursesLoading ? [] : courseResult?.courses || []),
    [coursesLoading, courseResult]
  );
  const coursesError = coursesLoading ? null : courseResult?.error;

  const activeCourseId = useMemo(() => {
    if (routeCourseId) return routeCourseId;
    if (queryCourseId && courses.some((item) => item._id === queryCourseId)) return queryCourseId;
    const firstActive = courses.find((item) => item.isActive !== false);
    return firstActive?._id || courses[0]?._id || "";
  }, [routeCourseId, queryCourseId, courses]);

  const selectedCourseSummary = useMemo(
    () => courses.find((item) => item._id === activeCourseId) || null,
    [courses, activeCourseId]
  );

  const monitorKey = `${activeCourseId}::${viewParam}::${monitorRetry}`;

  useEffect(() => {
    if (!activeCourseId) return undefined;
    const controller = new AbortController();
    const requestFn =
      viewParam === "progress" ? api.getInstructorCourseProgress : api.getInstructorCourseGradebook;

    requestFn(activeCourseId, {}, { signal: controller.signal })
      .then(({ data }) => {
        if (!controller.signal.aborted) {
          setMonitorResult({ key: monitorKey, data });
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setMonitorResult({ key: monitorKey, error });
        }
      });

    return () => controller.abort();
  }, [activeCourseId, viewParam, monitorKey]);

  const monitoringLoading = Boolean(activeCourseId) && monitorResult?.key !== monitorKey;
  const monitoringData = monitoringLoading ? null : monitorResult?.data;
  const monitoringError = monitoringLoading ? null : monitorResult?.error;

  const handleSelectCourse = (nextCourseId) => {
    setInspectRecord(null);
    if (routeCourseId) {
      navigate(
        viewParam === "progress"
          ? `/instructor/courses/${nextCourseId}/students?view=progress`
          : `/instructor/courses/${nextCourseId}/students`
      );
      return;
    }
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("courseId", nextCourseId);
    setSearchParams(nextParams);
  };

  const handleSwitchView = (nextView) => {
    setInspectRecord(null);
    const nextParams = new URLSearchParams(searchParams);
    if (!routeCourseId && activeCourseId) nextParams.set("courseId", activeCourseId);
    if (nextView === "progress") nextParams.set("view", "progress");
    else nextParams.delete("view");
    setSearchParams(nextParams);
  };

  const panelReady = Boolean(
    !monitoringLoading &&
    !monitoringError &&
    monitoringData?.hasEnrolledStudents &&
    monitoringData?.hasAcademicData
  );
  const displayCourse = monitoringData?.course || selectedCourseSummary;

  return (
    <div className="mon-page">
      <Breadcrumb
        items={[
          { label: "Dashboard", to: "/instructor/dashboard" },
          { label: "Assigned Courses", to: "/instructor/courses" },
          ...(displayCourse
            ? [{ label: displayCourse.courseCode, to: `/instructor/courses/${displayCourse._id}` }]
            : []),
          { label: "Monitor Students" },
        ]}
      />

      <header className="mon-header">
        <div>
          <p className="mon-eyebrow">Instructor Workspace / Monitor Students</p>
          <h1>Monitor Students</h1>
          <p>Review course gradebook records and track assignment and quiz completion.</p>
        </div>

        <div className="mon-header-actions">
          {activeCourseId && (
            <Button
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              loading={monitoringLoading}
              onClick={() => setMonitorRetry((current) => current + 1)}
            >
              Refresh
            </Button>
          )}
        </div>
      </header>

      {coursesLoading && <LoadingSpinner message="Loading your assigned courses..." />}

      {coursesError && (
        <ErrorBanner
          message={coursesError.message || "Failed to load your assigned courses."}
          onRetry={() => setCourseRetry((current) => current + 1)}
        />
      )}

      {!coursesLoading && !coursesError && courses.length === 0 && (
        <EmptyState
          icon={BookOpen}
          title="No assigned courses yet"
          description="You do not have any assigned courses to monitor. Assigned courses will appear here once an administrator assigns them."
        />
      )}

      {!coursesLoading && !coursesError && courses.length > 0 && (
        <>
          <section className="mon-control-panel" aria-label="Course and monitoring view selection">
            <div className="mon-control-top">
              <Select
                id="monitor-course-select"
                label="Assigned Course"
                value={activeCourseId}
                options={courses.map((item) => ({
                  value: item._id,
                  label: `${item.courseCode} — ${item.courseName}${item.isActive === false ? " (Inactive)" : ""}`,
                }))}
                onChange={(event) => handleSelectCourse(event.target.value)}
              />

              {displayCourse && (
                <div className="mon-course-meta">
                  <Badge variant={displayCourse.isActive === false ? "INACTIVE" : "ACTIVE"} />
                  {selectedCourseSummary && (
                    <span className="mon-course-meta-text">
                      {selectedCourseSummary.enrolledCount ?? 0} enrolled ·{" "}
                      {selectedCourseSummary.assignmentCount ?? 0} assignments ·{" "}
                      {selectedCourseSummary.quizCount ?? 0} quizzes
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="mon-tabs-bar">
              <div className="mon-tablist" role="tablist" aria-label="Monitoring functions">
                <button
                  type="button"
                  role="tab"
                  id="monitoring-tab-gradebook"
                  aria-selected={viewParam === "gradebook"}
                  aria-controls={panelReady && viewParam === "gradebook" ? "monitoring-panel-gradebook" : undefined}
                  className={`lms-pill-tab ${viewParam === "gradebook" ? "active" : ""}`}
                  onClick={() => handleSwitchView("gradebook")}
                >
                  <Table2 size={15} aria-hidden="true" />
                  View Gradebook
                </button>
                <button
                  type="button"
                  role="tab"
                  id="monitoring-tab-progress"
                  aria-selected={viewParam === "progress"}
                  aria-controls={panelReady && viewParam === "progress" ? "monitoring-panel-progress" : undefined}
                  className={`lms-pill-tab ${viewParam === "progress" ? "active" : ""}`}
                  onClick={() => handleSwitchView("progress")}
                >
                  <Activity size={15} aria-hidden="true" />
                  Track Learning Progress
                </button>
              </div>

              {activeCourseId && (
                <Link className="mon-course-link" to={`/instructor/courses/${activeCourseId}`}>
                  Open Course Workspace
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              )}
            </div>
          </section>

          {monitoringLoading && (
            <LoadingSpinner
              message={
                viewParam === "progress"
                  ? "Loading student learning progress..."
                  : "Loading course gradebook..."
              }
            />
          )}

          {monitoringError && (
            <div style={{ display: "grid", gap: "12px" }}>
              <ErrorBanner
                message={monitoringError.message || "Unable to retrieve student monitoring data."}
                onRetry={
                  monitoringError.status === 404
                    ? undefined
                    : () => setMonitorRetry((current) => current + 1)
                }
              />
              {monitoringError.status === 404 && (
                <Link to="/instructor/courses" className="mon-course-link">
                  Back to Assigned Courses
                </Link>
              )}
            </div>
          )}

          {!monitoringLoading && !monitoringError && monitoringData && !monitoringData.hasEnrolledStudents && (
            <EmptyState
              icon={Users}
              title="No students enrolled in this course"
              description="No student gradebook or learning progress information is available until students are enrolled."
            />
          )}

          {!monitoringLoading &&
            !monitoringError &&
            monitoringData &&
            monitoringData.hasEnrolledStudents &&
            !monitoringData.hasAcademicData && (
              <div style={{ display: "grid", gap: "12px", justifyItems: "center" }}>
                <EmptyState
                  icon={ClipboardList}
                  title="No academic data available yet"
                  description={
                    monitoringData.emptyReason === "NO_ASSESSMENTS"
                      ? `${displayCourse?.courseCode || "This course"} has ${monitoringData.summary?.enrolledCount ?? 0} enrolled students, but no assignments or quizzes have been created yet.`
                      : `${displayCourse?.courseCode || "This course"} has ${monitoringData.summary?.enrolledCount ?? 0} enrolled students, with no assignment submissions or quiz attempts recorded yet.`
                  }
                />
                {activeCourseId && (
                  <Link className="mon-course-link" to={`/instructor/courses/${activeCourseId}`}>
                    Go to Course Management
                    <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                )}
              </div>
            )}

          {!monitoringLoading &&
            !monitoringError &&
            monitoringData &&
            monitoringData.hasEnrolledStudents &&
            monitoringData.hasAcademicData &&
            (viewParam === "progress" ? (
              <LearningProgressPanel
                key={`${activeCourseId}-progress`}
                data={monitoringData}
                onInspectStudent={setInspectRecord}
              />
            ) : (
              <GradebookTable
                key={`${activeCourseId}-gradebook`}
                data={monitoringData}
                onInspectStudent={setInspectRecord}
              />
            ))}
        </>
      )}

      <p className="mon-readonly-footer">
        <ShieldCheck size={15} aria-hidden="true" />
        Read-only academic monitoring view. Grade records and progress summaries reflect live submissions and quiz attempts without modifying data.
      </p>

      <StudentMonitoringModal
        record={inspectRecord}
        course={displayCourse}
        onClose={() => setInspectRecord(null)}
      />
    </div>
  );
};
