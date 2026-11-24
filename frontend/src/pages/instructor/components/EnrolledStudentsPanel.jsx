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
    <section id="course-students" role="tabpanel" aria-labelledby="course-tab-students" style={{ display: "grid", gap: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ fontSize: "17px", fontWeight: 600 }}>Enrolled Student Roster</h2>
          {!loading && !error && (
            <p style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
              {course.courseCode} · {students.length} {students.length === 1 ? "student" : "students"}
            </p>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <Link
            to={`/instructor/courses/${course._id}/students`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              height: "36px",
              padding: "0 12px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--color-border)",
              backgroundColor: "var(--color-surface)",
              fontSize: "13px",
              fontWeight: 500,
              color: "var(--color-primary-700)",
              textDecoration: "none",
            }}
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
      {!loading && !error && students.length === 0 && <EmptyState icon={Users} title="No students enrolled yet" />}
      {students.length > 0 && filteredStudents.length === 0 && (
        <EmptyState icon={Users} title="No matching students" actionLabel="Clear Search" onAction={() => setSearch("")} />
      )}
      {filteredStudents.length > 0 && (
        <div style={{ backgroundColor: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", overflowX: "auto" }}>
          <table aria-label="Enrolled students" style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ backgroundColor: "var(--color-surface-soft)", fontSize: "12px", color: "var(--color-text-muted)" }}>
                <th scope="col" style={{ padding: "12px 16px" }}>Student</th>
                <th scope="col" style={{ padding: "12px 16px" }}>Email</th>
                <th scope="col" style={{ padding: "12px 16px" }}>Enrolled Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student) => (
                <tr key={student._id} className="lms-table-row" style={{ borderTop: "1px solid var(--color-border-subtle)", fontSize: "13px" }}>
                  <td style={{ padding: "14px 16px", fontWeight: 600 }}>{student.fullName}</td>
                  <td style={{ padding: "14px 16px" }}>{student.email}</td>
                  <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>{formatShortDate(student.enrolledAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
