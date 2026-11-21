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
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
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
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <Breadcrumb
        items={[
          { label: "Dashboard", to: "/student/dashboard" },
          { label: "Quizzes", to: "/student/quizzes" },
          { label: quiz.title },
        ]}
      />

      {/* Main Container */}
      <div
        className="lms-course-card"
        style={{
          backgroundColor: "var(--color-surface)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--color-border)",
          borderTop: `3px solid ${theme.color}`,
          padding: "28px 24px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        {/* Header Strip */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: theme.badgeColor,
                  backgroundColor: theme.badgeBg,
                  border: `1px solid ${theme.border}`,
                  padding: "3px 8px",
                  borderRadius: "4px",
                }}
              >
                <SubjectIcon size={13} />
                {quiz.courseId?.courseCode || "Course"} — {quiz.courseId?.courseName}
              </span>
              <Badge variant={quiz.status} />
            </div>
            <h1 style={{ fontSize: "22px", fontWeight: 700, color: "var(--color-text)", letterSpacing: "-0.015em" }}>
              {quiz.title}
            </h1>
          </div>

          <Link to="/student/quizzes">
            <Button variant="secondary" size="sm" icon={ArrowLeft}>
              Back to Quizzes
            </Button>
          </Link>
        </div>

        {/* Metadata Parameters Strip */}
        <div
          className="tabular-nums"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "14px",
            padding: "16px",
            backgroundColor: "var(--color-surface-soft)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--color-border-subtle)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ fontSize: "12px", color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
              <Clock size={14} /> Time Allotted
            </span>
            <span style={{ fontSize: "16px", fontWeight: 600, color: "var(--color-text)" }}>
              {quiz.timeLimit} Minutes
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ fontSize: "12px", color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
              <HelpCircle size={14} /> Questions
            </span>
            <span style={{ fontSize: "16px", fontWeight: 600, color: "var(--color-text)" }}>
              {quiz.questionCount || quiz.questions?.length || 5} Questions
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ fontSize: "12px", color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
              <Award size={14} /> Maximum Score
            </span>
            <span style={{ fontSize: "16px", fontWeight: 600, color: "var(--color-text)" }}>
              {quiz.maxScore || 10} Points
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ fontSize: "12px", color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
              <Calendar size={14} /> Submission Deadline
            </span>
            <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-text)" }}>
              {endDate.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </div>

        {/* Overview & Description */}
        <div style={{ maxWidth: "72ch" }}>
          <h2 style={{ fontSize: "15px", fontWeight: 600, color: "var(--color-text)", marginBottom: "8px" }}>
            Assessment Description & Topics
          </h2>
          <p style={{ fontSize: "14px", color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
            {quiz.description || "This quiz evaluates core competencies covered in the lecture series and practice lab worksheets."}
          </p>
        </div>

        {/* Attempt Rules and Academic Guidelines */}
        <div
          style={{
            padding: "16px 20px",
            borderRadius: "var(--radius-md)",
            border: "1px solid #BAE6FD",
            backgroundColor: "#F0F9FF",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--color-primary-700)" }}>
            <ShieldCheck size={18} />
            <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-primary-700)" }}>
              Standard Assessment Instructions & Policies
            </h3>
          </div>

          <ul style={{ paddingLeft: "20px", fontSize: "13px", color: "#0C4A6E", lineHeight: 1.6, display: "flex", flexDirection: "column", gap: "4px" }}>
            <li>The assessment timer begins counting down the moment you start your attempt.</li>
            <li>You can navigate between questions freely using the question palette bar.</li>
            <li>Make sure all questions are answered before submitting; you will receive a confirmation check prior to finalization.</li>
            <li>Once submitted, your attempt will be graded and recorded under your academic transcript.</li>
          </ul>
        </div>

        {/* Status and Action Section */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "14px",
            paddingTop: "16px",
            borderTop: "1px solid var(--color-border)",
          }}
        >
          <div>
            {quiz.status === "COMPLETED" && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--color-success)", fontSize: "14px", fontWeight: 500 }}>
                <CheckCircle2 size={18} />
                <span>You have already completed this quiz.</span>
              </div>
            )}
            {quiz.status === "UPCOMING" && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--color-text-secondary)", fontSize: "14px" }}>
                <Calendar size={18} />
                <span>This quiz opens on {startDate.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}.</span>
              </div>
            )}
            {quiz.status === "EXPIRED" && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--color-danger)", fontSize: "14px" }}>
                <AlertTriangle size={18} />
                <span>The assessment window has expired. Submissions are no longer accepted.</span>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
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
      </div>
    </div>
  );
};
