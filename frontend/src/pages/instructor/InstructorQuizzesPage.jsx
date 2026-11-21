import { useState, useEffect, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
  const initialCourseId = searchParams.get("courseId") || "";

  const [courses, setCourses] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  const [selectedCourse, setSelectedCourse] = useState(initialCourseId);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCourses = useCallback(async () => {
    try {
      const res = await api.getInstructorCourses();
      if (res.status === "success") {
        setCourses(res.data);
      }
    } catch {
      // Handled by main fetch
    }
  }, []);

  const fetchQuizzes = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (selectedCourse) params.courseId = selectedCourse;
      if (statusFilter !== "ALL") params.status = statusFilter;
      if (searchQuery.trim()) params.q = searchQuery.trim();

      const res = await api.getInstructorQuizzes(params);
      if (res.status === "success") {
        setQuizzes(res.data);
      }
    } catch (err) {
      setError(err.message || "Failed to load quizzes.");
    } finally {
      setLoading(false);
    }
  }, [selectedCourse, statusFilter, searchQuery]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  useEffect(() => {
    fetchQuizzes();
  }, [fetchQuizzes]);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteQuiz(deleteTarget._id);
      setFeedback(`Deleted quiz "${deleteTarget.title}".`);
      setDeleteTarget(null);
      await fetchQuizzes();
    } catch (err) {
      setError(err.message || "Failed to delete quiz.");
    } finally {
      setDeleting(false);
    }
  };

  const resetFilters = () => {
    setSelectedCourse("");
    setStatusFilter("ALL");
    setSearchQuery("");
    setSearchParams({});
  };

  const hasFilters = Boolean(selectedCourse || statusFilter !== "ALL" || searchQuery.trim());

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

        <Link to={selectedCourse ? `/instructor/quizzes/new?courseId=${selectedCourse}` : "/instructor/quizzes/new"}>
          <Button variant="primary" size="md" icon={Plus}>
            Create Quiz
          </Button>
        </Link>
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
              onChange={(e) => {
                setSelectedCourse(e.target.value);
                setSearchParams(e.target.value ? { courseId: e.target.value } : {});
              }}
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
      {loading ? (
        <LoadingSpinner message="Loading quizzes..." />
      ) : error ? (
        <ErrorBanner message={error} onRetry={fetchQuizzes} />
      ) : quizzes.length === 0 ? (
        <EmptyState
          icon={HelpCircle}
          title={hasFilters ? "No quizzes matched your filters" : "No quizzes created yet"}
          description={
            hasFilters
              ? "Try clearing your search, course filter, or status tab."
              : "Create your first online quiz with timed limits and automated scoring."
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
                      <strong>{quiz.attemptCount ?? 0}</strong> student attempts
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
                        Questions
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
                    onClick={() => setDeleteTarget(quiz)}
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
        warningText="All questions and recorded student quiz attempts for this assessment will be removed."
        loading={deleting}
      />
    </div>
  );
};
