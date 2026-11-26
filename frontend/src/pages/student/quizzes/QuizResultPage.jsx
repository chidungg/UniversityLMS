import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Award,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Calendar,
  BookOpen,
} from "lucide-react";
import { api } from "../../../services/api";
import { Breadcrumb } from "../../../components/ui/Breadcrumb";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { LoadingSpinner } from "../../../components/ui/LoadingSpinner";
import { ErrorBanner } from "../../../components/ui/ErrorBanner";
import { getCourseTheme } from "../../../utils/courseThemes";

export const QuizResultPage = () => {
  const { attemptId } = useParams();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchResult = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.getQuizResult(attemptId);
      if (res.status === "success") {
        setResult(res.data);
      }
    } catch (err) {
      setError(err.message || "Failed to load assessment results.");
    } finally {
      setLoading(false);
    }
  }, [attemptId]);

  useEffect(() => {
    fetchResult();
  }, [fetchResult]);

  if (loading) {
    return <LoadingSpinner message="Loading assessment results..." />;
  }

  if (error) {
    return (
      <div className="lms-page">
        <Breadcrumb
          items={[
            { label: "Dashboard", to: "/student/dashboard" },
            { label: "Quizzes", to: "/student/quizzes" },
            { label: "Assessment Results" },
          ]}
        />
        <ErrorBanner message={error} onRetry={fetchResult} />
      </div>
    );
  }

  if (!result) return null;

  const passed = result.passed !== undefined ? result.passed : result.percentage >= 50;
  const submittedDate = new Date(result.submittedAt);
  const reviewItems = result.detailedReview || [];
  const theme = getCourseTheme(result.courseCode);
  const SubjectIcon = theme.icon;

  return (
    <div className="lms-page">
      <Breadcrumb
        items={[
          { label: "Dashboard", to: "/student/dashboard" },
          { label: "Quizzes", to: "/student/quizzes" },
          { label: result.quizTitle || "Quiz", to: `/student/quizzes/${result.quizId}` },
          { label: "Results & Feedback" },
        ]}
      />

      <section className="lms-card lms-card-accent" style={{ gap: "18px", padding: "22px 24px" }}>
        <div className="lms-card-head" style={{ alignItems: "flex-start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span className="lms-course-code">
                <SubjectIcon size={13} aria-hidden="true" />
                {result.courseCode || "Course"}
              </span>
              <Badge variant={passed ? "PASSED" : "FAILED"} label={passed ? "Passed" : "Needs Improvement"} size="sm" />
            </div>
            <h1 style={{ margin: 0 }}>{result.quizTitle}</h1>
          </div>

          <Link to="/student/quizzes">
            <Button variant="secondary" size="sm" icon={ArrowLeft}>
              All Quizzes
            </Button>
          </Link>
        </div>

        <div className="lms-metric-strip">
          <div
            className="lms-metric-cell"
            style={{ backgroundColor: passed ? "var(--color-success-bg)" : "var(--color-surface-soft)" }}
          >
            <span className="lms-metric-label" style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
              <Award size={13} aria-hidden="true" /> Final Score
            </span>
            <span className="lms-metric-value">
              {result.score} / {result.maxScore || 10} pts
            </span>
            <span className="lms-metric-meta">{result.percentage}% Academic Grade</span>
          </div>

          <div className="lms-metric-cell">
            <span className="lms-metric-label" style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
              <Clock size={13} aria-hidden="true" /> Duration Taken
            </span>
            <span className="lms-metric-value" style={{ fontSize: "20px" }}>
              {result.durationTaken || "—"}
            </span>
          </div>

          <div className="lms-metric-cell">
            <span className="lms-metric-label" style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
              <Calendar size={13} aria-hidden="true" /> Submitted At
            </span>
            <span className="lms-metric-value" style={{ fontSize: "15px" }}>
              {submittedDate.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </div>
      </section>

      <section className="lms-section">
        <div className="lms-section-head">
          <h2>Assessment Question Review ({reviewItems.length} Questions)</h2>
        </div>

        <div className="lms-form-stack" style={{ gap: "12px" }}>
          {reviewItems.map((item, idx) => (
            <div
              key={item.questionId || idx}
              className={`lms-quiz-review-card ${item.isCorrect ? "is-correct" : "is-incorrect"}`}
            >
              <div className="lms-card-head">
                <div style={{ display: "inline-flex", alignItems: "center", gap: "7px" }}>
                  {item.isCorrect ? (
                    <CheckCircle2 size={16} aria-hidden="true" />
                  ) : (
                    <XCircle size={16} aria-hidden="true" />
                  )}
                  <span style={{ fontSize: "14px", fontWeight: 600 }}>Question {idx + 1}</span>
                </div>

                <span
                  className="lms-badge lms-badge--sm"
                  style={{
                    backgroundColor: item.isCorrect ? "var(--color-success-bg)" : "var(--color-danger-bg)",
                    border: `1px solid ${item.isCorrect ? "#86EFAC" : "#FCA5A5"}`,
                  }}
                >
                  {item.earnedPoints} / {item.points} Points
                </span>
              </div>

              <p style={{ fontSize: "15px", fontWeight: 500, lineHeight: 1.5, margin: 0 }}>
                {item.prompt}
              </p>

              <div className="lms-info-box lms-grid-form-2" style={{ padding: "10px 14px" }}>
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 600 }}>Your Answer</div>
                  <div style={{ marginTop: "2px", fontWeight: 500 }}>
                    {item.selectedOptionId
                      ? `${item.selectedOptionId}. ${item.selectedOptionText}`
                      : "No answer selected"}
                  </div>
                </div>

                {!item.isCorrect && (
                  <div>
                    <div style={{ fontSize: "12px", fontWeight: 600 }}>Correct Answer</div>
                    <div style={{ marginTop: "2px", fontWeight: 600 }}>
                      {item.correctOptionId}. {item.correctOptionText}
                    </div>
                  </div>
                )}
              </div>

              {item.explanation && (
                <div style={{ fontSize: "13px", lineHeight: 1.5 }}>
                  <strong>Explanation:</strong> {item.explanation}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
        <Link to="/student/quizzes">
          <Button variant="secondary" size="md" icon={ArrowLeft}>
            Back to All Quizzes
          </Button>
        </Link>

        <Link to="/student/dashboard">
          <Button variant="primary" size="md" icon={BookOpen}>
            Return to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
};
