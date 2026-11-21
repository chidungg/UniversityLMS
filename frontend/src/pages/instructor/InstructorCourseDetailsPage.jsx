import { useState, useEffect } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowRight, FileText, FolderOpen, HelpCircle, Search, User, Users } from "lucide-react";
import { api } from "../../services/api";
import { Breadcrumb } from "../../components/ui/Breadcrumb";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorBanner } from "../../components/ui/ErrorBanner";
import { getCourseTheme } from "../../utils/courseThemes";
import { formatShortDate } from "./components/formatters";

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
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);

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
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <Breadcrumb items={[assignedCourses, { label: "Course Workspace" }]} />
        <ErrorBanner
          message={error?.message || "Failed to load course workspace."}
          onRetry={unavailable ? undefined : () => setRetry((current) => current + 1)}
        />
        <Link to={assignedCourses.to}>Back to Assigned Courses</Link>
      </div>
    );
  }

  const { course, managementOptions = [], students = [] } = data;
  const options = Object.entries(managementPages).filter(([id]) => managementOptions.includes(id));
  if (options.some(([id]) => id === tab)) {
    return <Navigate replace to={managementPages[tab].path(course._id)} />;
  }

  const theme = getCourseTheme(course);
  const SubjectIcon = theme.icon;
  const term = studentSearch.trim().toLowerCase();
  const filteredStudents = students.filter((student) =>
    [student.fullName, student.email, student.studentCode].some((value) => value?.toLowerCase().includes(term))
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <Breadcrumb items={[assignedCourses, { label: course.courseCode }]} />

      <section
        className="lms-course-card"
        style={{
          backgroundColor: "var(--color-surface)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--color-border)",
          borderTop: `4px solid ${theme.color}`,
          padding: "22px 24px",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <SubjectIcon size={16} color={theme.color} />
          <span style={{ color: theme.color, fontSize: "13px", fontWeight: 600 }}>{course.courseCode}</span>
          <Badge variant={course.isActive === false ? "INACTIVE" : "ACTIVE"} />
        </div>
        <h1 style={{ fontSize: "24px", fontWeight: 700, margin: 0 }}>{course.courseName}</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
          <User size={14} /> Instructor: <strong>{course.instructor}</strong>
        </div>
        {course.description && (
          <p style={{ fontSize: "14px", color: "var(--color-text-secondary)", margin: 0 }}>{course.description}</p>
        )}
        <div role="tablist" aria-label="Course information" style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
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
              onClick={() => {
                setSelectedStudent(null);
                setSearchParams(id === "students" ? { tab: id } : {});
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {!showRoster && (
        <section id="course-overview" role="tabpanel" aria-labelledby="course-tab-overview">
          <h2 style={{ fontSize: "17px", fontWeight: 600, marginBottom: "12px" }}>Manage Course</h2>
          {options.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: "12px" }}>
              {options.map(([id, { label, icon: Icon, count, path }]) => (
                <Link
                  key={id}
                  to={path(course._id)}
                  className="lms-course-card"
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: "10px",
                    padding: "16px",
                    color: "var(--color-text)",
                    textDecoration: "none",
                  }}
                >
                  <Icon size={18} aria-hidden="true" />
                  <span style={{ flex: 1 }}>{label}</span>
                  <span className="tabular-nums">{course[count]}</span>
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState icon={FolderOpen} title="Course management unavailable" description="This course is inactive." />
          )}
        </section>
      )}

      {showRoster && (
        <div id="course-students" role="tabpanel" aria-labelledby="course-tab-students" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h2 style={{ fontSize: "17px", fontWeight: 600 }}>Enrolled Student Roster</h2>
              <p style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
                {course.enrolledCount} students enrolled in {course.courseCode}.
              </p>
            </div>
            <div style={{ width: "260px" }}>
              <Input
                icon={Search}
                placeholder="Search student name, ID, email..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                style={{ height: "36px" }}
              />
            </div>
          </div>

          {!Array.isArray(data.students) ? (
            <EmptyState icon={Users} title="Student roster is unavailable" />
          ) : filteredStudents.length === 0 ? (
            <EmptyState
              icon={Users}
              title={studentSearch ? "No matching students" : "No students enrolled yet"}
              description={
                studentSearch
                  ? "No enrolled students matched your search term."
                  : "No students have been enrolled into this course by administration yet."
              }
              actionLabel={studentSearch ? "Clear Search" : undefined}
              onAction={studentSearch ? () => setStudentSearch("") : undefined}
            />
          ) : (
            <div style={{ backgroundColor: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ backgroundColor: "var(--color-surface-soft)", borderBottom: "1px solid var(--color-border)", fontSize: "12px", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase" }}>
                    <th style={{ padding: "12px 18px" }}>Student</th>
                    <th style={{ padding: "12px 16px" }}>Student ID</th>
                    <th style={{ padding: "12px 16px" }}>Enrolled Date</th>
                    <th style={{ padding: "12px 16px" }}>Assignments</th>
                    <th style={{ padding: "12px 16px" }}>Quizzes</th>
                    <th style={{ padding: "12px 16px" }}>Avg Score</th>
                    <th style={{ padding: "12px 18px", textAlign: "right" }}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((s, idx) => (
                    <tr key={s._id} className="lms-table-row" style={{ borderBottom: idx === filteredStudents.length - 1 ? "none" : "1px solid var(--color-border-subtle)" }}>
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--color-text)" }}>{s.fullName}</div>
                        <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>{s.email}</div>
                      </td>
                      <td className="tabular-nums" style={{ padding: "14px 16px", fontSize: "13px", color: "var(--color-text-secondary)" }}>
                        {s.studentCode || "—"}
                      </td>
                      <td className="tabular-nums" style={{ padding: "14px 16px", fontSize: "13px", color: "var(--color-text-muted)" }}>
                        {formatShortDate(s.enrolledAt)}
                      </td>
                      <td className="tabular-nums" style={{ padding: "14px 16px", fontSize: "13px" }}>
                        {s.assignmentsSubmitted} / {s.totalAssignments}
                      </td>
                      <td className="tabular-nums" style={{ padding: "14px 16px", fontSize: "13px" }}>
                        {s.quizzesCompleted} / {s.totalQuizzes}
                      </td>
                      <td className="tabular-nums" style={{ padding: "14px 16px", fontSize: "13px", fontWeight: 600 }}>
                        {s.averageScore !== null ? `${s.averageScore} / 10` : "—"}
                      </td>
                      <td style={{ padding: "14px 18px", textAlign: "right" }}>
                        <Button variant="outline" size="sm" onClick={() => setSelectedStudent(s)}>
                          View Summary
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Student Progress Modal */}
      <Modal
        isOpen={Boolean(selectedStudent)}
        onClose={() => setSelectedStudent(null)}
        title={selectedStudent ? `Student Summary — ${selectedStudent.fullName}` : "Student Summary"}
        maxWidth="600px"
        footer={
          <Button variant="secondary" size="sm" onClick={() => setSelectedStudent(null)}>
            Close
          </Button>
        }
      >
        {selectedStudent && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ padding: "12px 14px", borderRadius: "var(--radius-md)", backgroundColor: "var(--color-surface-soft)", border: "1px solid var(--color-border)" }}>
              <div style={{ fontWeight: 600, fontSize: "14px" }}>{selectedStudent.fullName}</div>
              <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                {selectedStudent.studentCode} · {selectedStudent.email} · Enrolled {formatShortDate(selectedStudent.enrolledAt)}
              </div>
            </div>

            <div>
              <h3 style={{ fontSize: "13px", fontWeight: 600, marginBottom: "8px" }}>Assignment Submissions</h3>
              {selectedStudent.submissions?.length === 0 ? (
                <p style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>No assignment submissions recorded in this course.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {selectedStudent.submissions.map((sub) => (
                    <div key={sub._id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)" }}>
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: 600 }}>{sub.assignmentTitle}</div>
                        <div className="tabular-nums" style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Submitted {formatShortDate(sub.submittedAt)}</div>
                      </div>
                      <span className="tabular-nums" style={{ fontSize: "13px", fontWeight: 600, color: sub.grade !== null ? "var(--color-success)" : "var(--color-warning)" }}>
                        {sub.grade !== null && sub.grade !== undefined ? `${sub.grade} / ${sub.maxScore}` : "Awaiting grading"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 style={{ fontSize: "13px", fontWeight: 600, marginBottom: "8px" }}>Quiz Attempts</h3>
              {selectedStudent.quizAttempts?.length === 0 ? (
                <p style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>No quiz attempts completed in this course.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {selectedStudent.quizAttempts.map((att) => (
                    <div key={att._id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)" }}>
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: 600 }}>{att.quizTitle}</div>
                        <div className="tabular-nums" style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Submitted {formatShortDate(att.submittedAt)}</div>
                      </div>
                      <span className="tabular-nums" style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-primary-700)" }}>
                        {att.score} / {att.maxScore} ({att.percentage}%)
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
