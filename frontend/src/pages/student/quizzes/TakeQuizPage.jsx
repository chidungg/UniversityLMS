import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Clock,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Send,
} from "lucide-react";
import { api } from "../../../services/api";
import { Breadcrumb } from "../../../components/ui/Breadcrumb";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { LoadingSpinner } from "../../../components/ui/LoadingSpinner";
import { ErrorBanner } from "../../../components/ui/ErrorBanner";

export const TakeQuizPage = () => {
  const { quizId } = useParams();
  const navigate = useNavigate();

  const [quizData, setQuizData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({}); // { [questionId]: optionId }
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Countdown timer state
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const timerRef = useRef(null);

  const fetchAttemptData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.startQuiz(quizId);
      if (res.status === "success") {
        setQuizData(res.data);
        const limitMinutes = res.data.timeLimit || 30;
        setRemainingSeconds(limitMinutes * 60);
      }
    } catch (err) {
      setError(err.message || "Failed to load quiz questions.");
    } finally {
      setLoading(false);
    }
  }, [quizId]);

  useEffect(() => {
    fetchAttemptData();
  }, [fetchAttemptData]);

  // Submit Handler
  const handleFinalSubmit = useCallback(async () => {
    if (submitting) return;
    setShowConfirmModal(false);
    setSubmitting(true);
    setSubmitError("");

    try {
      const res = await api.submitQuiz(quizId, answers);
      if (res.status === "success" && res.data) {
        navigate(`/student/quiz-attempts/${res.data._id}/result`);
      }
    } catch (err) {
      setSubmitError(err.message || "Failed to submit quiz. Please try again.");
      setSubmitting(false);
    }
  }, [quizId, answers, submitting, navigate]);

  // Countdown timer ticker
  useEffect(() => {
    if (!quizData || remainingSeconds <= 0) return;

    timerRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleFinalSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [quizData, remainingSeconds, handleFinalSubmit]);

  const questions = quizData?.questions || [];
  const currentQuestion = questions[currentIndex];

  const handleSelectOption = (questionId, optionId) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: optionId,
    }));
  };

  const answeredCount = Object.keys(answers).length;
  const unansweredCount = questions.length - answeredCount;

  const formatTimer = (totalSecs) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const isLowTime = remainingSeconds < 5 * 60; // less than 5 mins

  if (loading) {
    return <LoadingSpinner message="Preparing your quiz attempt environment..." />;
  }

  if (error) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <Breadcrumb
          items={[
            { label: "Dashboard", to: "/student/dashboard" },
            { label: "Quizzes", to: "/student/quizzes" },
            { label: "Take Quiz" },
          ]}
        />
        <ErrorBanner message={error} onRetry={fetchAttemptData} />
      </div>
    );
  }

  if (!quizData || questions.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <Breadcrumb items={[{ label: "Dashboard", to: "/student/dashboard" }, { label: "Quizzes", to: "/student/quizzes" }, { label: "Quiz" }]} />
        <ErrorBanner message="No questions available for this assessment." />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <Breadcrumb
        items={[
          { label: "Dashboard", to: "/student/dashboard" },
          { label: "Quizzes", to: "/student/quizzes" },
          { label: quizData.title, to: `/student/quizzes/${quizId}` },
          { label: "Live Attempt" },
        ]}
      />

      {/* Top Banner: Quiz Title, Timer & Submit */}
      <div
        style={{
          backgroundColor: "var(--color-surface)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--color-border)",
          padding: "16px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
          position: "sticky",
          top: "var(--topbar-height)",
          zIndex: 20,
          boxShadow: "0 2px 4px rgba(0, 0, 0, 0.03)",
        }}
      >
        <div>
          <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-primary-700)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            {quizData.course?.courseCode || "Course"} Assessment
          </span>
          <h1 style={{ fontSize: "18px", fontWeight: 700, color: "var(--color-text)", marginTop: "2px" }}>
            {quizData.title}
          </h1>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          {/* Countdown Timer Widget */}
          <div
            className="tabular-nums"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 14px",
              borderRadius: "var(--radius-md)",
              backgroundColor: isLowTime ? "var(--color-danger-bg)" : "var(--color-surface-soft)",
              border: `1px solid ${isLowTime ? "#FECACA" : "var(--color-border)"}`,
              color: isLowTime ? "var(--color-danger)" : "var(--color-text)",
              fontWeight: 600,
              fontSize: "14px",
            }}
          >
            <Clock size={16} />
            <span>Time Left: {formatTimer(remainingSeconds)}</span>
          </div>

          <Button
            variant="primary"
            size="sm"
            icon={Send}
            onClick={() => setShowConfirmModal(true)}
            loading={submitting}
          >
            Submit Quiz
          </Button>
        </div>
      </div>

      {submitError && (
        <ErrorBanner message={submitError} onRetry={handleFinalSubmit} />
      )}

      {/* Main Two-Column Take Layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 280px",
          gap: "20px",
          alignItems: "start",
        }}
        className="quiz-take-layout"
      >
        {/* Left: Current Question Area */}
        <div
          style={{
            backgroundColor: "var(--color-surface)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--color-border)",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
          }}
        >
          {/* Question Header & Point Value */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingBottom: "14px",
              borderBottom: "1px solid var(--color-border-subtle)",
            }}
          >
            <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-text)" }}>
              Question {currentIndex + 1} of {questions.length}
            </span>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--color-primary-700)",
                backgroundColor: "var(--color-primary-100)",
                padding: "2px 8px",
                borderRadius: "4px",
              }}
            >
              {currentQuestion?.points || 2} Points
            </span>
          </div>

          {/* Prompt */}
          <div style={{ fontSize: "16px", fontWeight: 500, color: "var(--color-text)", lineHeight: 1.5 }}>
            {currentQuestion?.prompt}
          </div>

          {/* Options Radios */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "4px" }}>
            {currentQuestion?.options?.map((option) => {
              const isSelected = answers[currentQuestion.id] === option.id;

              return (
                <label
                  key={option.id}
                  onClick={() => handleSelectOption(currentQuestion.id, option.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "14px 16px",
                    borderRadius: "var(--radius-md)",
                    border: `1px solid ${isSelected ? "var(--color-primary-700)" : "var(--color-border)"}`,
                    backgroundColor: isSelected ? "var(--color-primary-100)" : "var(--color-surface)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  className="lms-card-interactive"
                >
                  <input
                    type="radio"
                    name={`question_${currentQuestion.id}`}
                    value={option.id}
                    checked={isSelected}
                    onChange={() => handleSelectOption(currentQuestion.id, option.id)}
                    style={{
                      width: "18px",
                      height: "18px",
                      accentColor: "var(--color-primary-700)",
                      cursor: "pointer",
                    }}
                  />
                  <span
                    style={{
                      width: "24px",
                      height: "24px",
                      borderRadius: "50%",
                      backgroundColor: isSelected ? "var(--color-primary-700)" : "var(--color-surface-soft)",
                      color: isSelected ? "#FFFFFF" : "var(--color-text-secondary)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "12px",
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    {option.id}
                  </span>
                  <span style={{ fontSize: "14px", color: "var(--color-text)", lineHeight: 1.4 }}>
                    {option.text}
                  </span>
                </label>
              );
            })}
          </div>

          {/* Navigation Controls: Prev / Next / Submit */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingTop: "18px",
              marginTop: "8px",
              borderTop: "1px solid var(--color-border-subtle)",
            }}
          >
            <Button
              variant="secondary"
              size="sm"
              icon={ArrowLeft}
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
            >
              Previous
            </Button>

            <div style={{ display: "flex", gap: "10px" }}>
              {currentIndex < questions.length - 1 ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                >
                  Next Question <ArrowRight size={14} style={{ marginLeft: "4px" }} />
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  icon={Send}
                  onClick={() => setShowConfirmModal(true)}
                >
                  Review & Submit
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar: Question Palette & Overview */}
        <aside
          style={{
            backgroundColor: "var(--color-surface)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--color-border)",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-text)" }}>
              Question Palette
            </h3>
            <span className="tabular-nums" style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
              {answeredCount}/{questions.length} Answered
            </span>
          </div>

          {/* Progress bar */}
          <div
            style={{
              width: "100%",
              height: "6px",
              backgroundColor: "var(--color-border-subtle)",
              borderRadius: "3px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${(answeredCount / questions.length) * 100}%`,
                height: "100%",
                backgroundColor: "var(--color-primary-700)",
                transition: "width 0.25s ease",
              }}
            />
          </div>

          {/* Question Grid Buttons */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: "8px",
            }}
          >
            {questions.map((q, idx) => {
              const isAnswered = answers[q.id] !== undefined;
              const isCurrent = idx === currentIndex;

              let bg = "var(--color-surface-soft)";
              let color = "var(--color-text)";
              let border = "1px solid var(--color-border)";

              if (isCurrent) {
                border = "2px solid var(--color-primary-700)";
              }

              if (isAnswered) {
                bg = "var(--color-primary-100)";
                color = "var(--color-primary-700)";
                border = `1px solid ${isCurrent ? "var(--color-primary-700)" : "var(--color-primary-600)"}`;
              }

              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className="tabular-nums"
                  style={{
                    height: "36px",
                    borderRadius: "var(--radius-sm)",
                    backgroundColor: bg,
                    color,
                    border,
                    fontSize: "13px",
                    fontWeight: isCurrent || isAnswered ? 600 : 500,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  title={`Question ${idx + 1}: ${isAnswered ? "Answered" : "Unanswered"}`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              fontSize: "12px",
              color: "var(--color-text-secondary)",
              paddingTop: "12px",
              borderTop: "1px solid var(--color-border-subtle)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "12px", height: "12px", borderRadius: "3px", backgroundColor: "var(--color-primary-100)", border: "1px solid var(--color-primary-600)" }} />
              <span>Answered</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "12px", height: "12px", borderRadius: "3px", backgroundColor: "var(--color-surface-soft)", border: "1px solid var(--color-border)" }} />
              <span>Unanswered</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "12px", height: "12px", borderRadius: "3px", border: "2px solid var(--color-primary-700)" }} />
              <span>Current Question</span>
            </div>
          </div>
        </aside>
      </div>

      {/* Submission Confirmation Modal */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Confirm Quiz Submission"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowConfirmModal(false)}
              disabled={submitting}
            >
              Return to Quiz
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Send}
              onClick={handleFinalSubmit}
              loading={submitting}
            >
              Submit Assessment Now
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <p style={{ fontSize: "14px", color: "var(--color-text)", lineHeight: 1.5 }}>
            Are you sure you want to finalize your submission for <strong>"{quizData.title}"</strong>?
          </p>

          <div
            className="tabular-nums"
            style={{
              padding: "12px 16px",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--color-surface-soft)",
              border: "1px solid var(--color-border)",
              fontSize: "13px",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>Total Questions: <strong>{questions.length}</strong></span>
            <span>Answered: <strong>{answeredCount}</strong></span>
            <span>Unanswered: <strong>{unansweredCount}</strong></span>
          </div>

          {unansweredCount > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "12px 14px",
                borderRadius: "var(--radius-sm)",
                backgroundColor: "var(--color-danger-bg)",
                border: "1px solid #FECACA",
                color: "var(--color-danger)",
                fontSize: "13px",
              }}
            >
              <AlertTriangle size={18} style={{ flexShrink: 0 }} />
              <span>
                <strong>Warning:</strong> You have {unansweredCount} unanswered question{unansweredCount > 1 ? "s" : ""}. Any unanswered questions will receive 0 points upon submission.
              </span>
            </div>
          )}

          <p style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
            Once submitted, your answers cannot be modified. Your score and feedback will be generated according to the course assessment policy.
          </p>
        </div>
      </Modal>

      <style>{`
        @media (max-width: 860px) {
          .quiz-take-layout {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};
