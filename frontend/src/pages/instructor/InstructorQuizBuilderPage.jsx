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
import { TeachingWeekField } from "../../components/materials/TeachingWeekField";
import { titleWithWeek, weekTitleError } from "../../utils/materialWeeks";
import { Breadcrumb } from "../../components/ui/Breadcrumb";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Textarea } from "../../components/ui/Textarea";
import { Select } from "../../components/ui/Select";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { ErrorBanner } from "../../components/ui/ErrorBanner";
import { toLocalDateTimeInput } from "./components/formatters";

const OPTION_IDS = ["A", "B", "C", "D"];

const newQuestionId = () =>
  `q-${Array.from(crypto.getRandomValues(new Uint32Array(2)), (part) => part.toString(36)).join("-")}`;

const createEmptyQuestion = () => ({
  id: newQuestionId(),
  type: "single_choice",
  prompt: "",
  points: 2,
  correctOptionId: "",
  explanation: "",
  options: OPTION_IDS.map((id) => ({ id, text: "" })),
});

export function InstructorQuizBuilderPage() {
  const { quizId } = useParams();
  const [searchParams] = useSearchParams();
  const presetCourseId = searchParams.get("courseId") || "";
  return <QuizEditor key={quizId ?? `new:${presetCourseId}`} quizId={quizId} presetCourseId={presetCourseId} />;
}

function QuizEditor({ quizId, presetCourseId }) {
  const navigate = useNavigate();
  const isEditing = Boolean(quizId);

  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [saving, setSaving] = useState(false);
  const [hasAttempts, setHasAttempts] = useState(false);
  const [refreshRequired, setRefreshRequired] = useState(false);

  const [courseId, setCourseId] = useState(presetCourseId);
  const [title, setTitle] = useState("");
  const [selectedWeek, setSelectedWeek] = useState(null);
  const savedTitle = titleWithWeek(title, selectedWeek);
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [timeLimit, setTimeLimit] = useState("30");
  const [questions, setQuestions] = useState(() => [createEmptyQuestion()]);
  const [fieldErrors, setFieldErrors] = useState({});

  const initForm = useCallback(async (signal) => {
    setLoading(true);
    setLoadError("");
    setSubmitError("");
    setRefreshRequired(false);
    try {
      if (isEditing) {
        const { data: quiz } = await api.getInstructorQuizDetails(quizId, { signal });
        if (signal?.aborted) return;
        setCourses([quiz.courseId]);
        setCourseId(quiz.courseId._id);
        setHasAttempts(quiz.hasAttempts);
        setTitle(quiz.title);
        setDescription(quiz.description ?? "");
        setStartTime(toLocalDateTimeInput(quiz.startTime));
        setEndTime(toLocalDateTimeInput(quiz.endTime));
        setTimeLimit(String(quiz.timeLimit));
        setQuestions(
          quiz.questions.length
            ? quiz.questions.map((question) => ({
                ...question,
                explanation: question.explanation ?? "",
              }))
            : [createEmptyQuestion()]
        );
      } else {
        const { data } = await api.getInstructorCourses({ status: "active" }, { signal });
        if (signal?.aborted) return;
        const activeCourses = data.filter((course) => course.isActive !== false);
        setCourses(activeCourses);
        setCourseId(
          presetCourseId
            ? activeCourses.find((course) => course._id === presetCourseId)?._id || ""
            : activeCourses[0]?._id || ""
        );
        setHasAttempts(false);
        const now = new Date();
        const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        nextWeek.setHours(23, 59, 0, 0);
        setStartTime(toLocalDateTimeInput(now.toISOString()));
        setEndTime(toLocalDateTimeInput(nextWeek.toISOString()));
      }
      setSelectedWeek(null);
      setFieldErrors({});
    } catch (error) {
      if (!signal?.aborted) setLoadError(error.message || "Failed to load quiz configuration.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [isEditing, quizId, presetCourseId]);

  useEffect(() => {
    const controller = new AbortController();
    initForm(controller.signal);
    return () => controller.abort();
  }, [initForm]);

  const writableCourse = courses.some((course) => course._id === courseId && course.isActive !== false);
  const configLocked = hasAttempts || !writableCourse;
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
    setQuestions((prev) => [...prev, createEmptyQuestion()]);
  };

  const duplicateQuestion = (qIndex) => {
    setQuestions((prev) => {
      const target = prev[qIndex];
      const copy = {
        ...target,
        id: newQuestionId(),
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
    if (!writableCourse) errors.courseId = "Select an active assigned course.";
    if (!title.trim()) errors.title = "Quiz title is required.";
    const titleError = weekTitleError(savedTitle, selectedWeek);
    if (titleError) errors.title = titleError;
    if (hasAttempts) {
      setFieldErrors(errors);
      return Object.keys(errors).length === 0;
    }

    const starts = new Date(startTime);
    const ends = new Date(endTime);
    if (!Number.isFinite(starts.getTime())) errors.startTime = "Enter a valid opening time.";
    if (!Number.isFinite(ends.getTime())) errors.endTime = "Enter a valid closing time.";
    if (ends <= starts) errors.endTime = "Closing time must be after opening time.";
    if (!Number.isSafeInteger(Number(timeLimit)) || Number(timeLimit) < 1) {
      errors.timeLimit = "Enter a time limit of at least one whole minute.";
    }

    const qErrors = {};
    questions.forEach((question, index) => {
      const itemErrors = {};
      if (!question.prompt.trim()) itemErrors.prompt = "Question prompt is required.";
      if (!Number.isFinite(Number(question.points)) || Number(question.points) <= 0) {
        itemErrors.points = "Points must be greater than zero.";
      }
      if (question.options.some((option) => !option.text.trim())) {
        itemErrors.options = "Fill in all answer options.";
      }
      if (!question.options.some((option) => option.id === question.correctOptionId)) {
        itemErrors.correctOptionId = "Select the correct option.";
      }
      if (Object.keys(itemErrors).length) qErrors[index] = itemErrors;
    });
    if (Object.keys(qErrors).length) errors.questions = qErrors;
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving || refreshRequired) return;
    setSubmitError("");
    if (!validate()) {
      setSubmitError("Please resolve the highlighted errors before saving the quiz.");
      return;
    }

    setSaving(true);
    try {
      const payload = { title: savedTitle, description: description.trim() };
      if (!hasAttempts) {
        Object.assign(payload, {
          startTime: new Date(startTime).toISOString(),
          endTime: new Date(endTime).toISOString(),
          timeLimit: Number(timeLimit),
          questions: questions.map((question) => ({
            id: question.id,
            type: "single_choice",
            prompt: question.prompt.trim(),
            points: Number(question.points),
            correctOptionId: question.correctOptionId,
            explanation: question.explanation.trim(),
            options: question.options.map(({ id, text }) => ({ id, text: text.trim() })),
          })),
        });
      }
      const response = isEditing
        ? await api.updateQuiz(quizId, payload)
        : await api.createQuiz({ ...payload, courseId });
      navigate(`/instructor/quizzes?courseId=${encodeURIComponent(courseId)}`, {
        state: { quizMessage: response.message },
      });
    } catch (error) {
      setSubmitError(error.message || "Failed to save quiz.");
      setRefreshRequired(error.code === "QUIZ_ATTEMPTS_STARTED");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading quiz editor..." />;
  }

  if (loadError) {
    return (
      <div className="lms-page">
        <Breadcrumb
          items={[
            { label: "Dashboard", to: "/instructor/dashboard" },
            { label: "Quizzes & Assessments", to: "/instructor/quizzes" },
            { label: isEditing ? "Edit Quiz" : "Create Quiz" },
          ]}
        />
        <ErrorBanner message={loadError} onRetry={() => initForm()} />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="lms-page" style={{ paddingBottom: "28px" }}>
      <Breadcrumb
        items={[
          { label: "Dashboard", to: "/instructor/dashboard" },
          { label: "Quizzes & Assessments", to: "/instructor/quizzes" },
          { label: isEditing ? `Edit: ${title || "Quiz"}` : "Create Quiz" },
        ]}
      />

      <div className="lms-page-header">
        <div className="lms-page-header-left">
          <h1>{isEditing ? "Edit Quiz & Questions" : "Create New Quiz"}</h1>
        </div>

        <div className="lms-page-actions">
          <Link to="/instructor/quizzes">
            <Button variant="secondary" size="md" icon={ArrowLeft}>
              Back to Quizzes
            </Button>
          </Link>
          <Button
            type="submit"
            variant="primary"
            size="md"
            icon={Save}
            loading={saving}
            disabled={!writableCourse || refreshRequired}
          >
            {isEditing ? "Save Changes" : "Publish Quiz"}
          </Button>
        </div>
      </div>

      {submitError && (
        <ErrorBanner message={submitError} onRetry={refreshRequired ? () => initForm() : undefined} />
      )}
      {!writableCourse && (
        <div className="lms-notice-banner">
          {isEditing ? "This course is inactive." : "Select an active assigned course to publish a quiz."}
        </div>
      )}
      {hasAttempts && writableCourse && (
        <div className="lms-notice-banner">
          Questions, schedule, and time limit are locked after the first attempt. You can still edit the title and description.
        </div>
      )}

      <section className="lms-panel lms-panel-pad lms-form-stack">
        <div className="lms-section-head">
          <h2>1. Quiz Configuration</h2>
          <div className="tabular-nums" style={{ display: "flex", gap: "12px", fontSize: "13px" }}>
            <span>
              <strong>{questions.length}</strong> {questions.length === 1 ? "Question" : "Questions"}
            </span>
            <span>·</span>
            <span>
              Total Score: <strong>{totalMaxScore} pts</strong>
            </span>
          </div>
        </div>

        <div className="lms-grid-form-2">
          <Select
            label="Course *"
            value={courseId}
            disabled={isEditing || saving}
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
            maxLength={200}
            disabled={!writableCourse || saving}
            onChange={(e) => {
              setTitle(e.target.value);
              if (fieldErrors.title) setFieldErrors((p) => ({ ...p, title: "" }));
            }}
            error={fieldErrors.title}
            placeholder="e.g. Quiz 3 — Functions & Recursion"
          />

          <TeachingWeekField
            title={title}
            week={selectedWeek}
            onChange={setSelectedWeek}
            disabled={!writableCourse || saving}
          />

          <Input
            label="Time Limit (Minutes) *"
            type="number"
            min="1"
            value={timeLimit}
            disabled={configLocked || saving}
            onChange={(e) => {
              setTimeLimit(e.target.value);
              if (fieldErrors.timeLimit) setFieldErrors((p) => ({ ...p, timeLimit: "" }));
            }}
            error={fieldErrors.timeLimit}
          />
        </div>

        <div className="lms-grid-form-2">
          <Input
            label="Opening Date & Time *"
            type="datetime-local"
            value={startTime}
            disabled={configLocked || saving}
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
            disabled={configLocked || saving}
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
          maxLength={5000}
          disabled={!writableCourse || saving}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Outline exam coverage and rules..."
        />
      </section>

      <fieldset
        disabled={configLocked || saving}
        className="lms-section"
        style={{ border: 0, padding: 0, margin: 0, minWidth: 0, gap: "14px" }}
      >
        <div className="lms-section-head">
          <h2>2. Questions &amp; Answer Keys ({questions.length})</h2>
          <Button type="button" variant="outline" size="sm" icon={Plus} onClick={addQuestion}>
            Add Question
          </Button>
        </div>

        {questions.map((q, qIndex) => {
          const qErr = fieldErrors.questions?.[qIndex] || {};

          return (
            <div key={q.id || qIndex} className="lms-panel lms-panel-pad lms-form-stack">
              <div
                className="lms-card-head"
                style={{ paddingBottom: "10px", borderBottom: "1px solid var(--color-border-subtle)" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span className="lms-course-code">Question {qIndex + 1}</span>
                  <span className="tabular-nums" style={{ fontSize: "12px" }}>
                    Single Choice · {q.points || 0} pts
                  </span>
                </div>

                <div className="lms-row-actions">
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
                    variant="danger"
                    size="sm"
                    icon={Trash2}
                    disabled={questions.length <= 1}
                    onClick={() => removeQuestion(qIndex)}
                  >
                    Remove
                  </Button>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) 130px",
                  gap: "12px",
                  alignItems: "start",
                }}
              >
                <Textarea
                  label="Question Prompt *"
                  rows={2}
                  id={`prompt-${q.id}`}
                  value={q.prompt}
                  maxLength={2000}
                  onChange={(e) => updateQuestionField(qIndex, "prompt", e.target.value)}
                  error={qErr.prompt}
                  placeholder="Enter the question statement..."
                />
                <Input
                  label="Points *"
                  type="number"
                  min="1"
                  step="any"
                  value={q.points}
                  onChange={(e) => updateQuestionField(qIndex, "points", e.target.value)}
                  error={qErr.points}
                />
              </div>

              <div className="lms-field" style={{ gap: "8px" }}>
                <div className="lms-card-head">
                  <span className="lms-field-label">Answer Options (select the correct answer) *</span>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {qErr.options && (
                      <span className="lms-field-error" role="alert">
                        {qErr.options}
                      </span>
                    )}
                    {qErr.correctOptionId && (
                      <span className="lms-field-error" role="alert">
                        {qErr.correctOptionId}
                      </span>
                    )}
                  </div>
                </div>

                <div className="lms-grid-form-2">
                  {q.options.map((opt) => {
                    const isCorrect = q.correctOptionId === opt.id;
                    return (
                      <div
                        key={opt.id}
                        className={`lms-quiz-option ${isCorrect ? "is-selected" : ""}`}
                        style={{ padding: "7px 10px" }}
                      >
                        <input
                          type="radio"
                          name={`correct-opt-${qIndex}`}
                          aria-label={`Mark option ${opt.id} as correct answer for question ${qIndex + 1}`}
                          checked={isCorrect}
                          onChange={() => updateQuestionField(qIndex, "correctOptionId", opt.id)}
                          style={{ accentColor: "var(--accent-strong)", cursor: "pointer" }}
                        />
                        <span style={{ fontSize: "13px", fontWeight: 700, minWidth: "18px" }}>
                          {opt.id}.
                        </span>
                        <input
                          type="text"
                          aria-label={`Question ${qIndex + 1} Option ${opt.id}`}
                          value={opt.text}
                          maxLength={1000}
                          onChange={(e) => updateOptionText(qIndex, opt.id, e.target.value)}
                          placeholder={`Option ${opt.id} text...`}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            border: "none",
                            background: "transparent",
                            fontSize: "13px",
                            color: "#111111",
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
                              fontWeight: 700,
                              whiteSpace: "nowrap",
                            }}
                          >
                            <CheckCircle2 size={13} aria-hidden="true" />
                            Correct
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <Input
                label="Answer Explanation (Shown after student submits)"
                id={`explanation-${q.id}`}
                value={q.explanation}
                maxLength={2000}
                onChange={(e) => updateQuestionField(qIndex, "explanation", e.target.value)}
                placeholder="Explain why the selected answer is correct..."
              />
            </div>
          );
        })}

        <Button
          type="button"
          variant="outline"
          size="md"
          icon={Plus}
          onClick={addQuestion}
          style={{ alignSelf: "flex-start" }}
        >
          Add Another Question
        </Button>
      </fieldset>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
        <Link to="/instructor/quizzes">
          <Button variant="secondary" size="md">
            Cancel
          </Button>
        </Link>
        <Button
          type="submit"
          variant="primary"
          size="md"
          icon={Save}
          loading={saving}
          disabled={!writableCourse || refreshRequired}
        >
          {isEditing ? "Save Quiz Changes" : "Publish Quiz"}
        </Button>
      </div>
    </form>
  );
}
