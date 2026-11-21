import { useState, useEffect } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import {
  HelpCircle,
  Clock,
  Award,
  Calendar,
  Search,
  Plus,
  Edit3,
  BarChart2,
  Trash2,
  RotateCcw,
  Users,
} from "lucide-react";
import { api } from "../../services/api";
import { Breadcrumb } from "../../components/ui/Breadcrumb";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorBanner } from "../../components/ui/ErrorBanner";
import { getCourseTheme } from "../../utils/courseThemes";
import { ConfirmDeleteModal } from "./components/ConfirmDeleteModal";
import { SuccessBanner } from "./components/SuccessBanner";
import { formatShortDate } from "./components/formatters";

const STATUS_TABS = [
  { id: "ALL", label: "All Quizzes" },
  { id: "AVAILABLE", label: "Available" },
  { id: "UPCOMING", label: "Upcoming" },
  { id: "EXPIRED", label: "Closed" },
];

export const InstructorQuizzesPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const selectedCourse = searchParams.get("courseId") || "";
  const [courseResult, setCourseResult] = useState(null);
  const [listResult, setListResult] = useState(null);
  const [courseAttempt, setCourseAttempt] = useState(0);
  const [listAttempt, setListAttempt] = useState(0);
  const [feedback, setFeedback] = useState(location.state?.quizMessage || "");

  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const q = searchQuery.trim();
  const queryKey = JSON.stringify([selectedCourse, statusFilter, q, listAttempt]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    api.getInstructorCourses({}, { signal: controller.signal })
      .then(({ data }) => {
        if (!controller.signal.aborted) setCourseResult({ courseAttempt, courses: data });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setCourseResult({ courseAttempt, error });
      });
    return () => controller.abort();
  }, [courseAttempt]);

  useEffect(() => {
    const controller = new AbortController();
    const params = {};
    if (selectedCourse) params.courseId = selectedCourse;
    if (statusFilter !== "ALL") params.status = statusFilter;
    if (q) params.q = q;
    api.getInstructorQuizzes(params, { signal: controller.signal })
      .then(({ data }) => {
        if (!controller.signal.aborted) setListResult({ queryKey, quizzes: data });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setListResult({ queryKey, error });
      });
    return () => controller.abort();
  }, [selectedCourse, statusFilter, q, queryKey]);

  const refreshQuizzes = () => setListAttempt((current) => current + 1);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await api.deleteQuiz(deleteTarget._id);
      setFeedback(`Deleted quiz "${deleteTarget.title}".`);
      setDeleteTarget(null);
      refreshQuizzes();
    } catch (error) {
      setDeleteError(error.message || "Failed to delete quiz.");
      if (error.code === "QUIZ_HAS_ATTEMPTS") refreshQuizzes();
    } finally {
      setDeleting(false);
    }
  };

  const resetFilters = () => {
    setStatusFilter("ALL");
    setSearchQuery("");
    setSearchParams({});
  };

  const currentCourses = courseResult?.courseAttempt === courseAttempt ? courseResult : null;
  const currentList = listResult?.queryKey === queryKey ? listResult : null;
  const courses = currentCourses?.courses ?? [];
  const quizzes = currentList?.quizzes ?? [];
  const error = currentCourses?.error || currentList?.error;
  const loading = !currentCourses || !currentList;
  const canCreate = courses.some((course) => course.isActive !== false && (!selectedCourse || course._id === selectedCourse));
  const hasFilters = Boolean(selectedCourse || statusFilter !== "ALL" || q);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <Breadcrumb
        items={[
          { label: "Dashboard", to: "/instructor/dashboard" },
          { label: "Quizzes & Assessments" },
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
            Quizzes & Assessments
          </h1>
          <p style={{ fontSize: "14px", color: "var(--color-text-secondary)" }}>
            Build timed multiple-choice quizzes, manage question banks, and review student attempt results.
          </p>
        </div>

        {canCreate ? (
          <Link to={selectedCourse ? `/instructor/quizzes/new?courseId=${selectedCourse}` : "/instructor/quizzes/new"}>
            <Button variant="primary" size="md" icon={Plus}>Create Quiz</Button>
          </Link>
        ) : (
          <Button variant="primary" size="md" icon={Plus} disabled>Create Quiz</Button>
        )}
      </div>

      <SuccessBanner message={feedback} onDismiss={() => setFeedback("")} />

      {/* Filter Bar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          backgroundColor: "var(--color-surface)",
          padding: "14px 16px",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--color-border)",
        }}
      >
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`lms-pill-tab ${statusFilter === tab.id ? "active" : ""}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ width: "210px" }}>
            <Select
              aria-label="Filter by course"
              value={selectedCourse}
              onChange={(event) => setSearchParams(event.target.value ? { courseId: event.target.value } : {})}
              style={{ height: "36px" }}
            >
              <option value="">All Courses</option>
              {courses.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.courseCode} — {c.courseName}
                </option>
              ))}
            </Select>
          </div>

          <div style={{ width: "230px" }}>
            <Input
              icon={Search}
              placeholder="Search quizzes..."
              value={searchQuery}
              maxLength={200}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ height: "36px" }}
            />
          </div>

          {hasFilters && (
            <Button variant="secondary" size="sm" icon={RotateCcw} onClick={resetFilters}>
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Quiz Grid */}
      {error ? (
        <ErrorBanner message={error.message || "Failed to load quizzes."} onRetry={() => {
          if (currentCourses?.error) setCourseAttempt((current) => current + 1);
          refreshQuizzes();
        }} />
      ) : loading ? (
        <LoadingSpinner message="Loading quizzes..." />
      ) : quizzes.length === 0 ? (
        <EmptyState
          icon={HelpCircle}
          title={!courses.length ? "No courses assigned" : hasFilters ? "No quizzes matched your filters" : "No quizzes created yet"}
          description={
            !courses.length ? "Quizzes can be created for an assigned course."
              : hasFilters ? "Try clearing your search, course filter, or status tab." : undefined
          }
          actionLabel={hasFilters ? "Clear Filters" : undefined}
          onAction={hasFilters ? resetFilters : undefined}
        />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
            gap: "18px",
          }}
        >
          {quizzes.map((quiz) => {
            const theme = getCourseTheme(quiz.courseId);
            const SubjectIcon = theme.icon;

            return (
              <div
                key={quiz._id}
                className="lms-course-card"
                style={{
                  backgroundColor: "var(--color-surface)",
                  borderRadius: "var(--radius-lg)",
                  border: "1px solid var(--color-border)",
                  borderTop: `3px solid ${theme.color}`,
                  padding: "18px 20px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "14px",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
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
                      {quiz.courseId?.courseCode || "Course"}
                    </span>
                    <Badge variant={quiz.computedStatus} size="sm" />
                  </div>

                  <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--color-text)", marginBottom: "6px", lineHeight: 1.35 }}>
                    <Link to={`/instructor/quizzes/${quiz._id}/edit`} style={{ color: "var(--color-text)", textDecoration: "none" }}>
                      {quiz.title}
                    </Link>
                  </h2>

                  <p
                    style={{
                      fontSize: "13px",
                      color: "var(--color-text-secondary)",
                      lineHeight: 1.45,
                      display: "-webkit-box",
                      WebkitLineClamp: 1,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      marginBottom: "12px",
                    }}
                  >
                    {quiz.description || "No description provided."}
                  </p>

                  {/* Metadata Box */}
                  <div
                    className="tabular-nums"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "8px",
                      padding: "10px 12px",
                      borderRadius: "var(--radius-sm)",
                      backgroundColor: "var(--color-surface-soft)",
                      border: "1px solid var(--color-border-subtle)",
                      fontSize: "12px",
                      color: "var(--color-text)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Clock size={13} style={{ color: "var(--color-text-muted)" }} />
                      <span>{quiz.timeLimit} mins limit</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <HelpCircle size={13} style={{ color: "var(--color-text-muted)" }} />
                      <span>{quiz.questionCount} questions</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Award size={13} style={{ color: "var(--color-text-muted)" }} />
                      <span>{quiz.maxScore ?? 10} pts total</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Calendar size={13} style={{ color: "var(--color-text-muted)" }} />
                      <span>Closes {formatShortDate(quiz.endTime)}</span>
                    </div>
                  </div>

                  {/* Attempts Summary */}
                  <div
                    className="tabular-nums"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginTop: "10px",
                      fontSize: "12px",
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                      <Users size={13} style={{ color: "var(--color-primary-700)" }} />
                      <strong>{quiz.attemptCount ?? 0}</strong> submitted attempts
                    </span>
                    {quiz.avgScore !== null && (
                      <span>
                        Avg: <strong>{quiz.avgScore} / {quiz.maxScore ?? 10}</strong>
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer Actions */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "8px",
                    paddingTop: "12px",
                    borderTop: "1px solid var(--color-border-subtle)",
                  }}
                >
                  <div style={{ display: "flex", gap: "6px" }}>
                    <Link to={`/instructor/quizzes/${quiz._id}/edit`}>
                      <Button variant="outline" size="sm" icon={Edit3}>
                        {quiz.courseId?.isActive === false ? "View Questions" : "Edit Quiz"}
                      </Button>
                    </Link>
                    <Link to={`/instructor/quizzes/${quiz._id}/results`}>
                      <Button variant="primary" size="sm" icon={BarChart2}>
                        Results
                      </Button>
                    </Link>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Trash2}
                    aria-label={`Delete ${quiz.title}`}
                    disabled={quiz.hasAttempts || quiz.courseId?.isActive === false}
                    title={quiz.hasAttempts ? "A quiz with attempts cannot be deleted." : undefined}
                    onClick={() => {
                      setDeleteError("");
                      setDeleteTarget(quiz);
                    }}
                    style={{ color: "var(--color-danger)" }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Quiz"
        itemName={deleteTarget?.title}
        warningText="A quiz can only be deleted before students start an attempt."
        loading={deleting}
        error={deleteError}
      />
    </div>
  );
};
