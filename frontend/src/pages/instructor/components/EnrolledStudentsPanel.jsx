import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Search, Users } from "lucide-react";
import { api } from "../../../services/api";
import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorBanner } from "../../../components/ui/ErrorBanner";
import { Input } from "../../../components/ui/Input";
import { LoadingSpinner } from "../../../components/ui/LoadingSpinner";
import { formatShortDate } from "./formatters";

export function EnrolledStudentsPanel({ course }) {
  const [result, setResult] = useState(null);
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState("");
  const courseId = course._id;

  useEffect(() => {
    const controller = new AbortController();
    api.getInstructorCourseStudents(courseId, { signal: controller.signal })
      .then(({ data }) => {
        if (!Array.isArray(data)) throw new Error("Failed to load the student roster.");
        if (!controller.signal.aborted) setResult({ retry, students: data });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setResult({ retry, error });
      });
    return () => controller.abort();
  }, [courseId, retry]);

  const loading = result?.retry !== retry;
  const { students = [], error } = loading ? {} : result;
  const term = search.trim().toLowerCase();
  const filteredStudents = students.filter(({ fullName, email }) =>
    fullName.toLowerCase().includes(term) || email.toLowerCase().includes(term)
  );

  return (
    <section
      id="course-students"
      role="tabpanel"
      aria-labelledby="course-tab-students"
      className="lms-section"
    >
      <div className="lms-section-head">
        <div className="lms-page-title-row">
          <h2>Enrolled Student Roster</h2>
          {!loading && !error && (
            <span className="lms-count-tag">
              {course.courseCode} · {students.length} {students.length === 1 ? "student" : "students"}
            </span>
          )}
        </div>

        <div className="lms-toolbar-group">
          <Link
            to={`/instructor/courses/${course._id}/students`}
            className="lms-button lms-button--outline lms-button--sm"
          >
            Monitor Grades &amp; Progress
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
          {students.length > 0 && (
            <div style={{ width: "min(260px, 100%)" }}>
              <Input
                type="search"
                icon={Search}
                aria-label="Search enrolled students"
                placeholder="Search by name or email"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          )}
        </div>
      </div>

      {loading && <LoadingSpinner message="Loading enrolled students..." />}
      {error && (
        <ErrorBanner
          message={error.message || "Failed to load the student roster."}
          onRetry={error.status === 404 ? undefined : () => setRetry((current) => current + 1)}
        />
      )}
      {!loading && !error && students.length === 0 && (
        <EmptyState icon={Users} title="No students enrolled yet" />
      )}
      {students.length > 0 && filteredStudents.length === 0 && (
        <EmptyState
          icon={Users}
          title="No matching students"
          actionLabel="Clear Search"
          onAction={() => setSearch("")}
        />
      )}
      {filteredStudents.length > 0 && (
        <div className="lms-table-wrap">
          <table className="lms-table" aria-label="Enrolled students">
            <thead>
              <tr>
                <th scope="col">Student</th>
                <th scope="col">Email</th>
                <th scope="col">Enrolled Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student) => (
                <tr key={student._id}>
                  <td style={{ fontWeight: 600 }}>{student.fullName}</td>
                  <td>{student.email}</td>
                  <td className="tabular-nums" style={{ whiteSpace: "nowrap" }}>
                    {formatShortDate(student.enrolledAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
