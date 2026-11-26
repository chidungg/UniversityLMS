import { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  Clock,
  HelpCircle,
  Award,
  Calendar,
  AlertTriangle,
  PlayCircle,
  CheckCircle2,
  ArrowLeft,
  ShieldCheck,
} from "lucide-react";
import { api } from "../../../services/api";
import { Breadcrumb } from "../../../components/ui/Breadcrumb";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { LoadingSpinner } from "../../../components/ui/LoadingSpinner";
import { ErrorBanner } from "../../../components/ui/ErrorBanner";
import { getCourseTheme } from "../../../utils/courseThemes";

export const QuizInstructionsPage = () => {
  const { quizId } = useParams();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);

  const fetchQuiz = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.getQuizDetails(quizId);
      if (res.status === "success") {
        setQuiz(res.data);
      }
    } catch (err) {
      setError(err.message || "Failed to load quiz details.");
    } finally {
      setLoading(false);
    }
  }, [quizId]);

  useEffect(() => {
    fetchQuiz();
  }, [fetchQuiz]);

  const handleStartQuiz = async () => {
    setStarting(true);
    try {
      await api.startQuiz(quizId);
      navigate(`/student/quizzes/${quizId}/attempt`);
    } catch (err) {
      setError(err.message || "Failed to start quiz attempt.");
      setStarting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading quiz instructions..." />;
  }

  if (error) {
    return (
      <div className="lms-page">
        <Breadcrumb
          items={[
            { label: "Dashboard", to: "/student/dashboard" },
            { label: "Quizzes", to: "/student/quizzes" },
            { label: "Instructions" },
          ]}
        />
        <ErrorBanner message={error} onRetry={fetchQuiz} />
      </div>
    );
  }

  if (!quiz) return null;

  const startDate = new Date(quiz.startTime);
  const endDate = new Date(quiz.endTime);
  const isOpen = quiz.status === "AVAILABLE" || quiz.status === "IN_PROGRESS";
  const theme = getCourseTheme(quiz.courseId?.courseCode);
  const SubjectIcon = theme.icon;

  return (
    <div className="lms-page">
      <Breadcrumb
        items={[
          { label: "Dashboard", to: "/student/dashboard" },
          { label: "Quizzes", to: "/student/quizzes" },
          { label: quiz.title },
        ]}
      />

      <section className="lms-card lms-card-accent" style={{ gap: "18px", padding: "22px 24px" }}>
        <div className="lms-card-head" style={{ alignItems: "flex-start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span className="lms-course-code">
                <SubjectIcon size={13} aria-hidden="true" />
                {quiz.courseId?.courseCode || "Course"} — {quiz.courseId?.courseName}
              </span>
              <Badge variant={quiz.status} size="sm" />
            </div>
            <h1 style={{ margin: 0 }}>{quiz.title}</h1>
          </div>

          <Link to="/student/quizzes">
            <Button variant="secondary" size="sm" icon={ArrowLeft}>
              Back to Quizzes
            </Button>
          </Link>
        </div>

        <div className="lms-metric-strip">
          <div className="lms-metric-cell">
            <span className="lms-metric-label" style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
              <Clock size={13} aria-hidden="true" /> Time Allotted
            </span>
            <span className="lms-metric-value" style={{ fontSize: "18px" }}>
              {quiz.timeLimit} Minutes
            </span>
          </div>

          <div className="lms-metric-cell">
            <span className="lms-metric-label" style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
              <HelpCircle size={13} aria-hidden="true" /> Questions
            </span>
            <span className="lms-metric-value" style={{ fontSize: "18px" }}>
              {quiz.questionCount || quiz.questions?.length || 5} Questions
            </span>
          </div>

          <div className="lms-metric-cell">
            <span className="lms-metric-label" style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
              <Award size={13} aria-hidden="true" /> Maximum Score
            </span>
            <span className="lms-metric-value" style={{ fontSize: "18px" }}>
              {quiz.maxScore || 10} Points
            </span>
          </div>

          <div className="lms-metric-cell">
            <span className="lms-metric-label" style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
              <Calendar size={13} aria-hidden="true" /> Submission Deadline
            </span>
            <span className="lms-metric-value" style={{ fontSize: "15px" }}>
              {endDate.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </div>

        {quiz.description && (
          <div style={{ maxWidth: "72ch" }}>
            <h2 style={{ fontSize: "14px", marginBottom: "6px" }}>Description</h2>
            <p style={{ fontSize: "14px", lineHeight: 1.6, margin: 0 }}>{quiz.description}</p>
          </div>
        )}

        <div className="lms-info-box">
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <ShieldCheck size={16} aria-hidden="true" />
            <h3 style={{ fontSize: "14px", margin: 0 }}>Assessment Rules</h3>
          </div>
          <ul style={{ paddingLeft: "18px", margin: 0, fontSize: "13px", lineHeight: 1.6, display: "grid", gap: "4px" }}>
            <li>The timer starts as soon as you begin your attempt.</li>
            <li>Use the question palette to jump between questions before submitting.</li>
            <li>Once submitted, your answers are graded immediately and cannot be changed.</li>
          </ul>
        </div>

        <div className="lms-card-footer">
          <div>
            {quiz.status === "COMPLETED" && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "7px", fontSize: "13px", fontWeight: 500 }}>
                <CheckCircle2 size={16} aria-hidden="true" />
                You have already completed this quiz.
              </span>
            )}
            {quiz.status === "UPCOMING" && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "7px", fontSize: "13px" }}>
                <Calendar size={16} aria-hidden="true" />
                Opens on{" "}
                {startDate.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                .
              </span>
            )}
            {quiz.status === "EXPIRED" && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "7px", fontSize: "13px", fontWeight: 500 }}>
                <AlertTriangle size={16} aria-hidden="true" />
                This assessment window has closed.
              </span>
            )}
          </div>

          <div className="lms-page-actions">
            {quiz.status === "COMPLETED" && quiz.attemptId && (
              <Link to={`/student/quiz-attempts/${quiz.attemptId}/result`}>
                <Button variant="primary" size="md" icon={Award}>
                  Review Assessment Results
                </Button>
              </Link>
            )}

            {isOpen && (
              <Button
                variant="primary"
                size="md"
                icon={PlayCircle}
                loading={starting}
                onClick={handleStartQuiz}
              >
                {quiz.status === "IN_PROGRESS" ? "Resume Quiz Attempt" : "Start Quiz Attempt"}
              </Button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
