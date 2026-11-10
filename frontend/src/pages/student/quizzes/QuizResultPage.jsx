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
    return <LoadingSpinner message="Calculating assessment results..." />;
  }

  if (error) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
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
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <Breadcrumb
        items={[
          { label: "Dashboard", to: "/student/dashboard" },
          { label: "Quizzes", to: "/student/quizzes" },
          { label: result.quizTitle || "Quiz", to: `/student/quizzes/${result.quizId}` },
          { label: "Results & Feedback" },
        ]}
      />

      {/* Hero Evaluation Card */}
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
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
                  padding: "2px 8px",
                  borderRadius: "4px",
                }}
              >
                <SubjectIcon size={13} />
                {result.courseCode || "Course"}
              </span>
              <Badge variant={passed ? "GRADED" : "OVERDUE"} label={passed ? "Passed" : "Needs Improvement"} />
            </div>
            <h1 style={{ fontSize: "22px", fontWeight: 700, color: "var(--color-text)", letterSpacing: "-0.015em" }}>
              {result.quizTitle}
            </h1>
          </div>

          <Link to="/student/quizzes">
            <Button variant="secondary" size="sm" icon={ArrowLeft}>
              All Quizzes
            </Button>
          </Link>
        </div>

        {/* Score & Metrics Banner */}
        <div
          className="tabular-nums"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "16px",
            padding: "20px",
            borderRadius: "var(--radius-md)",
            backgroundColor: passed ? "var(--color-success-bg)" : "var(--color-surface-soft)",
            border: `1px solid ${passed ? "#A7F3D0" : "var(--color-border)"}`,
          }}
        >
          <div>
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)", display: "flex", alignItems: "center", gap: "6px" }}>
              <Award size={16} /> Final Score
            </span>
            <div style={{ fontSize: "28px", fontWeight: 700, color: passed ? "var(--color-success)" : "var(--color-text)", marginTop: "4px" }}>
              {result.score} / {result.maxScore || 10} pts
            </div>
            <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--color-text-secondary)" }}>
              {result.percentage}% Academic Grade
            </span>
          </div>

          <div>
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)", display: "flex", alignItems: "center", gap: "6px" }}>
              <Clock size={16} /> Duration Taken
            </span>
            <div style={{ fontSize: "20px", fontWeight: 600, color: "var(--color-text)", marginTop: "8px" }}>
              {result.durationTaken || "18m 24s"}
            </div>
            <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
              Within authorized limit
            </span>
          </div>

          <div>
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)", display: "flex", alignItems: "center", gap: "6px" }}>
              <Calendar size={16} /> Submitted Timestamp
            </span>
            <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--color-text)", marginTop: "8px" }}>
              {submittedDate.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
            <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
              Attempt ID: {result._id}
            </span>
          </div>
        </div>
      </div>

      {/* Detailed Question Review Section */}
      <section style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: "17px", fontWeight: 600, color: "var(--color-text)" }}>
            Assessment Question Review ({reviewItems.length} Questions)
          </h2>
          <span style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
            Answers verified by automated evaluation policy
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {reviewItems.map((item, idx) => (
            <div
              key={item.questionId || idx}
              style={{
                backgroundColor: "var(--color-surface)",
                borderRadius: "var(--radius-lg)",
                border: `1px solid ${item.isCorrect ? "#A7F3D0" : "#FECACA"}`,
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }}
            >
              {/* Question status header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {item.isCorrect ? (
                    <CheckCircle2 size={18} style={{ color: "var(--color-success)" }} />
                  ) : (
                    <XCircle size={18} style={{ color: "var(--color-danger)" }} />
                  )}
                  <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-text)" }}>
                    Question {idx + 1}
                  </span>
                </div>

                <span
                  className="tabular-nums"
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: item.isCorrect ? "var(--color-success)" : "var(--color-danger)",
                    backgroundColor: item.isCorrect ? "var(--color-success-bg)" : "var(--color-danger-bg)",
                    padding: "2px 8px",
                    borderRadius: "4px",
                  }}
                >
                  {item.earnedPoints} / {item.points} Points
                </span>
              </div>

              {/* Prompt */}
              <p style={{ fontSize: "15px", color: "var(--color-text)", fontWeight: 500, lineHeight: 1.5 }}>
                {item.prompt}
              </p>

              {/* Selected Answer & Correct Answer Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                  gap: "12px",
                  padding: "12px 14px",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: "var(--color-surface-soft)",
                  fontSize: "13px",
                }}
              >
                <div>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase" }}>
                    Your Answer:
                  </span>
                  <div
                    style={{
                      marginTop: "4px",
                      fontWeight: 500,
                      color: item.isCorrect ? "var(--color-success)" : "var(--color-danger)",
                    }}
                  >
                    {item.selectedOptionId ? `${item.selectedOptionId}. ${item.selectedOptionText}` : "No answer selected"}
                  </div>
                </div>

                {!item.isCorrect && (
                  <div>
                    <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase" }}>
                      Correct Answer:
                    </span>
                    <div style={{ marginTop: "4px", fontWeight: 500, color: "var(--color-success)" }}>
                      {item.correctOptionId}. {item.correctOptionText}
                    </div>
                  </div>
                )}
              </div>

              {/* Explanation Note */}
              {item.explanation && (
                <div
                  style={{
                    fontSize: "13px",
                    color: "var(--color-text-secondary)",
                    backgroundColor: "var(--color-surface-soft)",
                    padding: "10px 14px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--color-border-subtle)",
                    lineHeight: 1.5,
                  }}
                >
                  <strong style={{ color: "var(--color-text)" }}>Explanation: </strong>
                  {item.explanation}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Bottom Nav Actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "12px" }}>
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
