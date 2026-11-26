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
  const [answers, setAnswers] = useState({});
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

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

  const isLowTime = remainingSeconds < 5 * 60;

  if (loading) {
    return <LoadingSpinner message="Preparing your quiz attempt..." />;
  }

  if (error) {
    return (
      <div className="lms-page">
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
      <div className="lms-page">
        <Breadcrumb
          items={[
            { label: "Dashboard", to: "/student/dashboard" },
            { label: "Quizzes", to: "/student/quizzes" },
            { label: "Quiz" },
          ]}
        />
        <ErrorBanner message="No questions available for this assessment." />
      </div>
    );
  }

  return (
    <div className="lms-page">
      <Breadcrumb
        items={[
          { label: "Dashboard", to: "/student/dashboard" },
          { label: "Quizzes", to: "/student/quizzes" },
          { label: quizData.title, to: `/student/quizzes/${quizId}` },
          { label: "Live Attempt" },
        ]}
      />

      <div className="lms-quiz-sticky">
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", minWidth: 0 }}>
          {quizData.course?.courseCode && (
            <span className="lms-course-code">{quizData.course.courseCode}</span>
          )}
          <h1 style={{ fontSize: "17px", margin: 0 }}>{quizData.title}</h1>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <div className={`lms-quiz-timer ${isLowTime ? "is-urgent" : ""}`}>
            <Clock size={15} aria-hidden="true" />
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

      {submitError && <ErrorBanner message={submitError} onRetry={handleFinalSubmit} />}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 270px",
          gap: "18px",
          alignItems: "start",
        }}
        className="quiz-take-layout"
      >
        <div className="lms-panel lms-panel-pad lms-form-stack" style={{ gap: "18px" }}>
          <div
            className="lms-card-head"
            style={{ paddingBottom: "12px", borderBottom: "1px solid var(--color-border-subtle)" }}
          >
            <span style={{ fontSize: "14px", fontWeight: 600 }}>
              Question {currentIndex + 1} of {questions.length}
            </span>
            <span className="lms-count-tag">{currentQuestion?.points || 2} Points</span>
          </div>

          <div style={{ fontSize: "15px", fontWeight: 500, lineHeight: 1.55 }}>
            {currentQuestion?.prompt}
          </div>

          <div className="lms-form-stack" style={{ gap: "8px" }}>
            {currentQuestion?.options?.map((option) => {
              const isSelected = answers[currentQuestion.id] === option.id;

              return (
                <label
                  key={option.id}
                  onClick={() => handleSelectOption(currentQuestion.id, option.id)}
                  className={`lms-quiz-option ${isSelected ? "is-selected" : ""}`}
                >
                  <input
                    type="radio"
                    name={`question_${currentQuestion.id}`}
                    value={option.id}
                    checked={isSelected}
                    onChange={() => handleSelectOption(currentQuestion.id, option.id)}
                    style={{ width: "16px", height: "16px", accentColor: "var(--accent-strong)", cursor: "pointer" }}
                  />
                  <span className="lms-quiz-option-tag">{option.id}</span>
                  <span style={{ fontSize: "14px", lineHeight: 1.45 }}>{option.text}</span>
                </label>
              );
            })}
          </div>

          <div className="lms-card-footer">
            <Button
              variant="secondary"
              size="sm"
              icon={ArrowLeft}
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
            >
              Previous
            </Button>

            {currentIndex < questions.length - 1 ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
              >
                Next Question <ArrowRight size={14} aria-hidden="true" />
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                icon={Send}
                onClick={() => setShowConfirmModal(true)}
              >
                Review &amp; Submit
              </Button>
            )}
          </div>
        </div>

        <aside className="lms-panel lms-panel-pad lms-form-stack" style={{ gap: "14px" }}>
          <div className="lms-card-head">
            <h2 style={{ fontSize: "14px", margin: 0 }}>Question Palette</h2>
            <span className="tabular-nums" style={{ fontSize: "12px", fontWeight: 500 }}>
              {answeredCount}/{questions.length} Answered
            </span>
          </div>

          <div
            style={{
              width: "100%",
              height: "6px",
              backgroundColor: "#E2E8F0",
              borderRadius: "2px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${(answeredCount / questions.length) * 100}%`,
                height: "100%",
                backgroundColor: "var(--accent-strong)",
                transition: "width 0.2s ease",
              }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "6px" }}>
            {questions.map((q, idx) => {
              const isAnswered = answers[q.id] !== undefined;
              const isCurrent = idx === currentIndex;

              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className="tabular-nums"
                  style={{
                    height: "34px",
                    borderRadius: "4px",
                    backgroundColor: isAnswered ? "var(--accent-soft)" : "#FFFFFF",
                    color: "#111111",
                    border: isCurrent
                      ? "2px solid var(--accent-strong)"
                      : isAnswered
                        ? "1px solid var(--accent-border)"
                        : "1px solid var(--color-border)",
                    fontSize: "13px",
                    fontWeight: isCurrent || isAnswered ? 700 : 500,
                    cursor: "pointer",
                  }}
                  title={`Question ${idx + 1}: ${isAnswered ? "Answered" : "Unanswered"}`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              fontSize: "12px",
              paddingTop: "10px",
              borderTop: "1px solid var(--color-border-subtle)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ width: "12px", height: "12px", borderRadius: "2px", backgroundColor: "var(--accent-soft)", border: "1px solid var(--accent-border)" }} />
              <span>Answered</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ width: "12px", height: "12px", borderRadius: "2px", backgroundColor: "#FFFFFF", border: "1px solid var(--color-border)" }} />
              <span>Unanswered</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ width: "12px", height: "12px", borderRadius: "2px", border: "2px solid var(--accent-strong)" }} />
              <span>Current Question</span>
            </div>
          </div>
        </aside>
      </div>

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
        <div className="lms-form-stack">
          <p style={{ fontSize: "14px", lineHeight: 1.5, margin: 0 }}>
            Are you sure you want to finalize your submission for <strong>&ldquo;{quizData.title}&rdquo;</strong>?
          </p>

          <div
            className="lms-info-box tabular-nums"
            style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}
          >
            <span>Total Questions: <strong>{questions.length}</strong></span>
            <span>Answered: <strong>{answeredCount}</strong></span>
            <span>Unanswered: <strong>{unansweredCount}</strong></span>
          </div>

          {unansweredCount > 0 && (
            <div className="lms-error-banner">
              <div className="lms-banner-content">
                <AlertTriangle size={16} aria-hidden="true" style={{ flexShrink: 0 }} />
                <span>
                  <strong>Warning:</strong> You have {unansweredCount} unanswered question
                  {unansweredCount > 1 ? "s" : ""}. Any unanswered questions will receive 0 points.
                </span>
              </div>
            </div>
          )}

          <p style={{ fontSize: "12px", margin: 0 }}>
            Once submitted, your answers cannot be modified.
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
