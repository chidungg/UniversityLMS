import { Link } from "react-router-dom";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { formatDateTime, formatShortDate } from "./formatters";

function assignmentStatusBadge(entry) {
  if (entry.status === "GRADED") return <Badge variant="GRADED" size="sm" />;
  if (entry.status === "SUBMITTED") return <Badge variant="SUBMITTED" label="Needs Grading" size="sm" />;
  if (entry.isPastDue) return <Badge variant="OVERDUE" label="Past Due" size="sm" />;
  return <Badge variant="NOT_SUBMITTED" size="sm" />;
}

export function StudentMonitoringModal({ record, course, onClose }) {
  const isOpen = Boolean(record);
  const student = record?.student;
  const assignments = record?.assignmentGrades || record?.assignmentItems || [];
  const quizzes = record?.quizGrades || record?.quizItems || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={student ? `Academic Record · ${student.fullName}` : "Student Academic Record"}
      maxWidth="780px"
      footer={
        <Button variant="secondary" size="sm" onClick={onClose}>
          Close
        </Button>
      }
    >
      {record && (
        <div className="mon-modal-body">
          <div className="mon-modal-identity">
            <div>
              <strong>{student.fullName}</strong>
              <span>
                {student.email}
                {student.enrolledAt ? ` · Enrolled ${formatShortDate(student.enrolledAt)}` : ""}
              </span>
            </div>
            {course && (
              <span className="lms-course-code">
                {course.courseCode} · {course.courseName}
              </span>
            )}
          </div>

          <section className="mon-modal-section" aria-label="Assignment records">
            <h3>Assignments ({assignments.length})</h3>
            {assignments.length === 0 ? (
              <p className="mon-cell-muted">No assignments have been created in this course yet.</p>
            ) : (
              <div className="mon-modal-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Assignment</th>
                      <th scope="col">Status</th>
                      <th scope="col">Score</th>
                      <th scope="col">Submitted</th>
                      <th scope="col">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.map((item) => (
                      <tr key={item.assignmentId}>
                        <td>
                          <strong>{item.title}</strong>
                          {item.dueDate && (
                            <span className="mon-breakdown-note">Due {formatDateTime(item.dueDate)}</span>
                          )}
                          {item.feedback && (
                            <span className="mon-breakdown-note">Feedback: {item.feedback}</span>
                          )}
                        </td>
                        <td>
                          <div className="mon-cell-stack">
                            {assignmentStatusBadge(item)}
                            {item.isLate && <span className="mon-flag-warning">Submitted late</span>}
                          </div>
                        </td>
                        <td>
                          {item.grade !== null ? (
                            <span className="mon-score-line">
                              {item.grade} / {item.maxScore} <small>({item.percentage}%)</small>
                            </span>
                          ) : (
                            <span className="mon-cell-muted">— / {item.maxScore}</span>
                          )}
                        </td>
                        <td>{item.submittedAt ? formatDateTime(item.submittedAt) : "—"}</td>
                        <td>
                          <Link
                            to={`/instructor/assignments/${item.assignmentId}`}
                            className="lms-link"
                            onClick={onClose}
                          >
                            Review
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="mon-modal-section" aria-label="Quiz records">
            <h3>Quizzes ({quizzes.length})</h3>
            {quizzes.length === 0 ? (
              <p className="mon-cell-muted">No quizzes have been created in this course yet.</p>
            ) : (
              <div className="mon-modal-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Quiz</th>
                      <th scope="col">Status</th>
                      <th scope="col">Score</th>
                      <th scope="col">Submitted</th>
                      <th scope="col">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quizzes.map((item) => (
                      <tr key={item.quizId}>
                        <td>
                          <strong>{item.title}</strong>
                          {item.endTime && (
                            <span className="mon-breakdown-note">Closes {formatDateTime(item.endTime)}</span>
                          )}
                        </td>
                        <td>
                          <div className="mon-cell-stack">
                            <Badge variant={item.status} size="sm" />
                            {item.passed === true && <Badge variant="PASSED" size="sm" />}
                            {item.passed === false && <Badge variant="FAILED" size="sm" />}
                          </div>
                        </td>
                        <td>
                          {item.score !== null ? (
                            <span className="mon-score-line">
                              {item.score} / {item.maxScore} <small>({item.percentage}%)</small>
                            </span>
                          ) : (
                            <span className="mon-cell-muted">— / {item.maxScore}</span>
                          )}
                        </td>
                        <td>{item.submittedAt ? formatDateTime(item.submittedAt) : "—"}</td>
                        <td>
                          <Link
                            to={`/instructor/quizzes/${item.quizId}/results`}
                            className="lms-link"
                            onClick={onClose}
                          >
                            Results
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}
