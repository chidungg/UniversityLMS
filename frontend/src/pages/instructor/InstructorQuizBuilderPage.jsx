import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams, useNavigate, Link } from "react-router-dom";
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Copy,
  CheckCircle2,
  Save,
  ArrowLeft,
} from "lucide-react";
import { api } from "../../services/api";
import { Breadcrumb } from "../../components/ui/Breadcrumb";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Textarea } from "../../components/ui/Textarea";
import { Select } from "../../components/ui/Select";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { ErrorBanner } from "../../components/ui/ErrorBanner";
import { toLocalDateTimeInput } from "./components/formatters";

const OPTION_IDS = ["A", "B", "C", "D"];

const createEmptyQuestion = (index) => ({
  id: `Q${index + 1}`,
  type: "single_choice",
  prompt: "",
  points: 2,
  correctOptionId: "A",
  explanation: "",
  options: OPTION_IDS.map((id) => ({ id, text: "" })),
});

export const InstructorQuizBuilderPage = () => {
  const { quizId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isEditing = Boolean(quizId);
  const presetCourseId = searchParams.get("courseId") || "";

  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [saving, setSaving] = useState(false);

  // Form State
  const [courseId, setCourseId] = useState(presetCourseId);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [timeLimit, setTimeLimit] = useState("30");
  const [questions, setQuestions] = useState([createEmptyQuestion(0)]);
  const [fieldErrors, setFieldErrors] = useState({});

  const initForm = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const courseRes = await api.getInstructorCourses();
      const loadedCourses = courseRes.status === "success" ? courseRes.data : [];
      setCourses(loadedCourses);

      if (isEditing) {
        const quizRes = await api.getInstructorQuizDetails(quizId);
        if (quizRes.status === "success") {
          const q = quizRes.data;
          setCourseId(q.courseId?._id || q.courseId || "");
          setTitle(q.title || "");
          setDescription(q.description || "");
          setStartTime(toLocalDateTimeInput(q.startTime));
          setEndTime(toLocalDateTimeInput(q.endTime));
          setTimeLimit(String(q.timeLimit || 30));
          setQuestions(
            q.questions && q.questions.length > 0
              ? q.questions.map((item, idx) => ({
                  id: item.id || `Q${idx + 1}`,
                  type: item.type || "single_choice",
                  prompt: item.prompt || "",
                  points: item.points ?? 2,
                  correctOptionId: item.correctOptionId || "A",
                  explanation: item.explanation || "",
                  options:
                    item.options && item.options.length > 0
                      ? item.options.map((o) => ({ id: o.id, text: o.text }))
                      : OPTION_IDS.map((id) => ({ id, text: "" })),
                }))
              : [createEmptyQuestion(0)]
          );
        }
      } else {
        const now = new Date();
        const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        nextWeek.setHours(23, 59, 0, 0);
        setCourseId(presetCourseId || loadedCourses[0]?._id || "");
        setStartTime(toLocalDateTimeInput(now.toISOString()));
        setEndTime(toLocalDateTimeInput(nextWeek.toISOString()));
      }
    } catch (err) {
      setLoadError(err.message || "Failed to load quiz configuration.");
    } finally {
      setLoading(false);
    }
  }, [isEditing, quizId, presetCourseId]);

  useEffect(() => {
    initForm();
  }, [initForm]);

  const totalMaxScore = questions.reduce((sum, q) => sum + (Number(q.points) || 0), 0);

  const updateQuestionField = (qIndex, field, value) => {
    setQuestions((prev) =>
      prev.map((q, idx) => (idx === qIndex ? { ...q, [field]: value } : q))
    );
  };

  const updateOptionText = (qIndex, optId, text) => {
    setQuestions((prev) =>
      prev.map((q, idx) => {
        if (idx !== qIndex) return q;
        return {
          ...q,
          options: q.options.map((opt) => (opt.id === optId ? { ...opt, text } : opt)),
        };
      })
    );
  };

  const addQuestion = () => {
    setQuestions((prev) => [...prev, createEmptyQuestion(prev.length)]);
  };

  const duplicateQuestion = (qIndex) => {
    setQuestions((prev) => {
      const target = prev[qIndex];
      const copy = {
        ...target,
        id: `Q${Date.now()}_${prev.length + 1}`,
        options: target.options.map((o) => ({ ...o })),
      };
      const next = [...prev];
      next.splice(qIndex + 1, 0, copy);
      return next;
    });
  };

  const moveQuestion = (qIndex, direction) => {
    const targetIndex = qIndex + direction;
    if (targetIndex < 0 || targetIndex >= questions.length) return;
    setQuestions((prev) => {
      const next = [...prev];
      const [moved] = next.splice(qIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  };

  const removeQuestion = (qIndex) => {
    if (questions.length <= 1) return;
    setQuestions((prev) => prev.filter((_, idx) => idx !== qIndex));
  };

  const validate = () => {
    const errors = {};
    if (!courseId) errors.courseId = "Select a course.";
    if (!title.trim()) errors.title = "Quiz title is required.";
    if (!startTime) errors.startTime = "Start time is required.";
    if (!endTime) errors.endTime = "End time is required.";
    if (startTime && endTime && new Date(endTime) <= new Date(startTime)) {
      errors.endTime = "Closing time must be after opening time.";
    }
    if (!timeLimit || Number(timeLimit) < 1) {
      errors.timeLimit = "Time limit must be at least 1 minute.";
    }

    const qErrors = {};
    questions.forEach((q, idx) => {
      const itemErr = {};
      if (!q.prompt.trim()) itemErr.prompt = "Question prompt is required.";
      if (!q.points || Number(q.points) <= 0) itemErr.points = "Points must be > 0.";
      const emptyOpts = q.options.filter((o) => !o.text.trim());
      if (emptyOpts.length > 0) {
        itemErr.options = "All four answer options (A–D) must be filled in.";
      }
      if (!q.correctOptionId) itemErr.correctOptionId = "Select the correct option.";
      if (Object.keys(itemErr).length > 0) qErrors[idx] = itemErr;
    });

    if (Object.keys(qErrors).length > 0) errors.questions = qErrors;
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError("");
    if (!validate()) {
      setSubmitError("Please resolve the highlighted errors before saving the quiz.");
      return;
    }

    setSaving(true);
    try {
      const normalizedQuestions = questions.map((q, idx) => ({
        id: `Q${idx + 1}`,
        type: "single_choice",
        prompt: q.prompt.trim(),
        points: Number(q.points) || 2,
        correctOptionId: q.correctOptionId,
        explanation: q.explanation?.trim() || "",
        options: q.options.map((o) => ({ id: o.id, text: o.text.trim() })),
      }));

      const payload = {
        courseId,
        title: title.trim(),
        description: description.trim(),
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        timeLimit: Number(timeLimit),
        maxScore: totalMaxScore,
        questions: normalizedQuestions,
      };

      if (isEditing) {
        await api.updateQuiz(quizId, payload);
      } else {
        await api.createQuiz(payload);
      }
      navigate("/instructor/quizzes");
    } catch (err) {
      setSubmitError(err.message || "Failed to save quiz.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading quiz editor..." />;
  }

  if (loadError) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <Breadcrumb
          items={[
            { label: "Dashboard", to: "/instructor/dashboard" },
            { label: "Quizzes & Assessments", to: "/instructor/quizzes" },
            { label: isEditing ? "Edit Quiz" : "Create Quiz" },
          ]}
        />
        <ErrorBanner message={loadError} onRetry={initForm} />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px", paddingBottom: "32px" }}>
      <Breadcrumb
        items={[
          { label: "Dashboard", to: "/instructor/dashboard" },
          { label: "Quizzes & Assessments", to: "/instructor/quizzes" },
          { label: isEditing ? `Edit: ${title || "Quiz"}` : "Create Quiz" },
        ]}
      />

      {/* Page Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "16px",
          paddingBottom: "16px",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "var(--color-text)", marginBottom: "4px" }}>
            {isEditing ? "Edit Quiz & Questions" : "Create New Quiz"}
          </h1>
          <p style={{ fontSize: "14px", color: "var(--color-text-secondary)" }}>
            Configure assessment schedule, time limit, and single-choice questions with answer keys.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <Link to="/instructor/quizzes">
            <Button variant="secondary" size="md" icon={ArrowLeft}>
              Back to Quizzes
            </Button>
          </Link>
          <Button type="submit" variant="primary" size="md" icon={Save} loading={saving}>
            {isEditing ? "Save Changes" : "Publish Quiz"}
          </Button>
        </div>
      </div>

      {submitError && <ErrorBanner message={submitError} />}

      {/* Section 1: Quiz Configuration */}
      <section
        style={{
          backgroundColor: "var(--color-surface)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--color-border)",
          padding: "22px 24px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600 }}>1. Quiz Configuration</h2>
          <div className="tabular-nums" style={{ display: "flex", gap: "16px", fontSize: "13px", color: "var(--color-text-secondary)" }}>
            <span>
              <strong>{questions.length}</strong> {questions.length === 1 ? "Question" : "Questions"}
            </span>
            <span>•</span>
            <span>
              Total Score: <strong style={{ color: "var(--color-primary-700)" }}>{totalMaxScore} pts</strong>
            </span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "14px" }}>
          <Select
            label="Course *"
            value={courseId}
            onChange={(e) => {
              setCourseId(e.target.value);
              if (fieldErrors.courseId) setFieldErrors((p) => ({ ...p, courseId: "" }));
            }}
            error={fieldErrors.courseId}
          >
            <option value="">Select course...</option>
            {courses.map((c) => (
              <option key={c._id} value={c._id}>
                {c.courseCode} — {c.courseName}
              </option>
            ))}
          </Select>

          <Input
            label="Quiz Title *"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (fieldErrors.title) setFieldErrors((p) => ({ ...p, title: "" }));
            }}
            error={fieldErrors.title}
            placeholder="e.g. Quiz 3 — Functions & Recursion"
          />

          <Input
            label="Time Limit (Minutes) *"
            type="number"
            min="1"
            value={timeLimit}
            onChange={(e) => {
              setTimeLimit(e.target.value);
              if (fieldErrors.timeLimit) setFieldErrors((p) => ({ ...p, timeLimit: "" }));
            }}
            error={fieldErrors.timeLimit}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "14px" }}>
          <Input
            label="Opening Date & Time *"
            type="datetime-local"
            value={startTime}
            onChange={(e) => {
              setStartTime(e.target.value);
              if (fieldErrors.startTime) setFieldErrors((p) => ({ ...p, startTime: "" }));
            }}
            error={fieldErrors.startTime}
          />

          <Input
            label="Closing Date & Time *"
            type="datetime-local"
            value={endTime}
            onChange={(e) => {
              setEndTime(e.target.value);
              if (fieldErrors.endTime) setFieldErrors((p) => ({ ...p, endTime: "" }));
            }}
            error={fieldErrors.endTime}
          />
        </div>

        <Textarea
          label="Quiz Description & Instructions"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Outline exam coverage, rules, and academic integrity guidelines..."
        />
      </section>

      {/* Section 2: Question Editor */}
      <section style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 style={{ fontSize: "17px", fontWeight: 600 }}>2. Questions & Answer Keys ({questions.length})</h2>
            <p style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
              Select the radio button next to the correct answer for each single-choice question.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" icon={Plus} onClick={addQuestion}>
            Add Question
          </Button>
        </div>

        {questions.map((q, qIndex) => {
          const qErr = fieldErrors.questions?.[qIndex] || {};

          return (
            <div
              key={q.id || qIndex}
              style={{
                backgroundColor: "var(--color-surface)",
                borderRadius: "var(--radius-lg)",
                border: "1px solid var(--color-border)",
                padding: "20px 24px",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              {/* Question Header Controls */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "10px",
                  paddingBottom: "12px",
                  borderBottom: "1px solid var(--color-border-subtle)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span
                    className="tabular-nums"
                    style={{
                      fontSize: "12px",
                      fontWeight: 700,
                      padding: "3px 9px",
                      borderRadius: "4px",
                      backgroundColor: "var(--color-primary-100)",
                      color: "var(--color-primary-700)",
                    }}
                  >
                    Question {qIndex + 1}
                  </span>
                  <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                    Single Choice · {q.points || 0} pts
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={ArrowUp}
                    aria-label={`Move question ${qIndex + 1} up`}
                    disabled={qIndex === 0}
                    onClick={() => moveQuestion(qIndex, -1)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={ArrowDown}
                    aria-label={`Move question ${qIndex + 1} down`}
                    disabled={qIndex === questions.length - 1}
                    onClick={() => moveQuestion(qIndex, 1)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={Copy}
                    onClick={() => duplicateQuestion(qIndex)}
                  >
                    Duplicate
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={Trash2}
                    disabled={questions.length <= 1}
                    onClick={() => removeQuestion(qIndex)}
                    style={{ color: questions.length <= 1 ? "var(--color-text-muted)" : "var(--color-danger)" }}
                  >
                    Remove
                  </Button>
                </div>
              </div>

              {/* Prompt & Points */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 130px", gap: "14px", alignItems: "start" }}>
                <Textarea
                  label={`Question Prompt *`}
                  rows={2}
                  value={q.prompt}
                  onChange={(e) => updateQuestionField(qIndex, "prompt", e.target.value)}
                  error={qErr.prompt}
                  placeholder="Enter the question statement..."
                />
                <Input
                  label="Points *"
                  type="number"
                  min="1"
                  step="0.5"
                  value={q.points}
                  onChange={(e) => updateQuestionField(qIndex, "points", e.target.value)}
                  error={qErr.points}
                />
              </div>

              {/* Options A-D */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--color-text)" }}>
                    Answer Options (select the correct answer) *
                  </span>
                  {qErr.options && (
                    <span style={{ fontSize: "12px", color: "var(--color-danger)" }} role="alert">
                      {qErr.options}
                    </span>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "10px" }}>
                  {q.options.map((opt) => {
                    const isCorrect = q.correctOptionId === opt.id;
                    return (
                      <div
                        key={opt.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          padding: "8px 12px",
                          borderRadius: "var(--radius-sm)",
                          border: `1px solid ${isCorrect ? "var(--color-success)" : "var(--color-border)"}`,
                          backgroundColor: isCorrect ? "var(--color-success-bg)" : "var(--color-surface)",
                        }}
                      >
                        <input
                          type="radio"
                          name={`correct-opt-${qIndex}`}
                          aria-label={`Mark option ${opt.id} as correct answer for question ${qIndex + 1}`}
                          checked={isCorrect}
                          onChange={() => updateQuestionField(qIndex, "correctOptionId", opt.id)}
                          style={{ accentColor: "var(--color-success)", cursor: "pointer" }}
                        />
                        <span
                          style={{
                            fontSize: "13px",
                            fontWeight: 700,
                            color: isCorrect ? "var(--color-success)" : "var(--color-text-secondary)",
                            minWidth: "18px",
                          }}
                        >
                          {opt.id}.
                        </span>
                        <input
                          type="text"
                          aria-label={`Question ${qIndex + 1} Option ${opt.id}`}
                          value={opt.text}
                          onChange={(e) => updateOptionText(qIndex, opt.id, e.target.value)}
                          placeholder={`Option ${opt.id} text...`}
                          style={{
                            flex: 1,
                            border: "none",
                            background: "transparent",
                            fontSize: "13px",
                            color: "var(--color-text)",
                            outline: "none",
                          }}
                        />
                        {isCorrect && (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              fontSize: "11px",
                              fontWeight: 600,
                              color: "var(--color-success)",
                            }}
                          >
                            <CheckCircle2 size={13} />
                            Correct
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Explanation */}
              <Input
                label="Answer Explanation (Shown after student submits)"
                value={q.explanation}
                onChange={(e) => updateQuestionField(qIndex, "explanation", e.target.value)}
                placeholder="Explain why the selected answer is correct..."
              />
            </div>
          );
        })}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", paddingTop: "8px" }}>
          <Button type="button" variant="outline" size="md" icon={Plus} onClick={addQuestion}>
            Add Another Question
          </Button>

          <div style={{ display: "flex", gap: "10px" }}>
            <Link to="/instructor/quizzes">
              <Button variant="secondary" size="md">
                Cancel
              </Button>
            </Link>
            <Button type="submit" variant="primary" size="md" icon={Save} loading={saving}>
              {isEditing ? "Save Quiz Changes" : "Publish Quiz"}
            </Button>
          </div>
        </div>
      </section>
    </form>
  );
};
