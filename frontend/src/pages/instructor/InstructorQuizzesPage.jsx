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
import { WeekList, WeekViewToggle } from "../../components/materials/MaterialList";
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
  const [byWeek, setByWeek] = useState(false);
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
  const canCreate = courses.some(
    (course) => course.isActive !== false && (!selectedCourse || course._id === selectedCourse)
  );
  const hasFilters = Boolean(selectedCourse || statusFilter !== "ALL" || q);

  return (
    <div className="lms-page">
      <Breadcrumb
        items={[
          { label: "Dashboard", to: "/instructor/dashboard" },
          { label: "Quizzes & Assessments" },
        ]}
      />

      <div className="lms-page-header">
        <div className="lms-page-header-left">
          <div className="lms-page-title-row">
            <h1>Quizzes &amp; Assessments</h1>
            {!loading && !error && <span className="lms-count-tag">{quizzes.length}</span>}
          </div>
        </div>

        {canCreate ? (
          <Link to={selectedCourse ? `/instructor/quizzes/new?courseId=${selectedCourse}` : "/instructor/quizzes/new"}>
            <Button variant="primary" size="md" icon={Plus}>
              Create Quiz
            </Button>
          </Link>
        ) : (
          <Button variant="primary" size="md" icon={Plus} disabled>
            Create Quiz
          </Button>
        )}
      </div>

      <SuccessBanner message={feedback} onDismiss={() => setFeedback("")} />

      <div className="lms-toolbar">
        <div className="lms-toolbar-group">
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

        <div className="lms-toolbar-controls">
          <div style={{ width: "200px" }}>
            <Select
              aria-label="Filter by course"
              value={selectedCourse}
              onChange={(event) => setSearchParams(event.target.value ? { courseId: event.target.value } : {})}
            >
              <option value="">All Courses</option>
              {courses.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.courseCode} — {c.courseName}
                </option>
              ))}
            </Select>
          </div>

          <WeekViewToggle allLabel="Ungrouped" byWeek={byWeek} onChange={setByWeek} />

          <div style={{ width: "220px" }}>
            <Input
              icon={Search}
              aria-label="Search quizzes"
              placeholder="Search quizzes..."
              value={searchQuery}
              maxLength={200}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {hasFilters && (
            <Button variant="secondary" size="sm" icon={RotateCcw} onClick={resetFilters}>
              Reset
            </Button>
          )}
        </div>
      </div>

      {error ? (
        <ErrorBanner
          message={error.message || "Failed to load quizzes."}
          onRetry={() => {
            if (currentCourses?.error) setCourseAttempt((current) => current + 1);
            refreshQuizzes();
          }}
        />
      ) : loading ? (
        <LoadingSpinner message="Loading quizzes..." />
      ) : quizzes.length === 0 ? (
        <EmptyState
          icon={HelpCircle}
          title={
            !courses.length
              ? "No courses assigned"
              : hasFilters
                ? "No quizzes matched your filters"
                : "No quizzes created yet"
          }
          description={
            !courses.length
              ? "Quizzes can be created for an assigned course."
              : hasFilters
                ? "Try clearing your search, course filter, or status tab."
                : undefined
          }
          actionLabel={hasFilters ? "Clear Filters" : undefined}
          onAction={hasFilters ? resetFilters : undefined}
        />
      ) : (
        <WeekList
          key={JSON.stringify([selectedCourse, statusFilter, searchQuery.trim()])}
          items={quizzes}
          byWeek={byWeek}
          singular="quiz"
          plural="quizzes"
          expandAll={Boolean(searchQuery.trim()) || statusFilter !== "ALL"}
          unassignedHint={
            !searchQuery.trim() && statusFilter === "ALL"
              ? "Set Teaching week when creating or editing a quiz to organize it here."
              : undefined
          }
        >
          {(weekItems) => (
            <div className="lms-grid-cards-wide lms-week-cards">
              {weekItems.map((quiz) => {
                const theme = getCourseTheme(quiz.courseId);
                const SubjectIcon = theme.icon;

                return (
                  <article key={quiz._id} className="lms-card lms-card-accent lms-card-clickable">
                    <div className="lms-card-head">
                      <span className="lms-course-code">
                        <SubjectIcon size={13} aria-hidden="true" />
                        {quiz.courseId?.courseCode || "Course"}
                      </span>
                      <Badge variant={quiz.computedStatus} size="sm" />
                    </div>

                    <h2 className="lms-card-title">
                      <Link to={`/instructor/quizzes/${quiz._id}/edit`}>{quiz.title}</Link>
                    </h2>

                    {quiz.description && <p className="lms-clamp-2">{quiz.description}</p>}

                    <div className="lms-card-stats">
                      <span>
                        <Clock size={13} aria-hidden="true" />
                        {quiz.timeLimit} mins limit
                      </span>
                      <span>
                        <HelpCircle size={13} aria-hidden="true" />
                        {quiz.questionCount} questions
                      </span>
                      <span>
                        <Award size={13} aria-hidden="true" />
                        {quiz.maxScore ?? 10} pts total
                      </span>
                      <span>
                        <Calendar size={13} aria-hidden="true" />
                        Closes {formatShortDate(quiz.endTime)}
                      </span>
                    </div>

                    <div
                      className="tabular-nums"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        fontSize: "12px",
                        flexWrap: "wrap",
                        gap: "8px",
                      }}
                    >
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                        <Users size={13} aria-hidden="true" />
                        <strong>{quiz.attemptCount ?? 0}</strong> submitted attempts
                      </span>
                      {quiz.avgScore !== null && (
                        <span>
                          Avg: <strong>{quiz.avgScore} / {quiz.maxScore ?? 10}</strong>
                        </span>
                      )}
                    </div>

                    <div className="lms-card-footer">
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
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
                        variant="danger"
                        size="sm"
                        icon={Trash2}
                        aria-label={`Delete ${quiz.title}`}
                        disabled={quiz.hasAttempts || quiz.courseId?.isActive === false}
                        title={quiz.hasAttempts ? "A quiz with attempts cannot be deleted." : undefined}
                        onClick={() => {
                          setDeleteError("");
                          setDeleteTarget(quiz);
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </WeekList>
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
