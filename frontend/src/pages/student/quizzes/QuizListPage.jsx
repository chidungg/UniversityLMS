import { useState, useEffect, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Clock,
  HelpCircle,
  Award,
  Calendar,
  Search,
  FolderX,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import { api } from "../../../services/api";
import { Breadcrumb } from "../../../components/ui/Breadcrumb";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { LoadingSpinner } from "../../../components/ui/LoadingSpinner";
import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorBanner } from "../../../components/ui/ErrorBanner";
import { getCourseTheme } from "../../../utils/courseThemes";

const STATUS_TABS = [
  { id: "ALL", label: "All Quizzes" },
  { id: "AVAILABLE", label: "Available Now" },
  { id: "IN_PROGRESS", label: "In Progress" },
  { id: "COMPLETED", label: "Completed" },
  { id: "UPCOMING", label: "Upcoming" },
  { id: "EXPIRED", label: "Closed" },
];

export const QuizListPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCourseId = searchParams.get("courseId") || "";

  const [quizzes, setQuizzes] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedCourse, setSelectedCourse] = useState(initialCourseId);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchEnrolledCourses = useCallback(async () => {
    try {
      const res = await api.getCourses();
      if (res.status === "success") {
        setCourses(res.data);
      }
    } catch (err) {
      console.error("Failed to load courses for filter:", err);
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

      const res = await api.getQuizzes(params);
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
    fetchEnrolledCourses();
  }, [fetchEnrolledCourses]);

  useEffect(() => {
    fetchQuizzes();
  }, [fetchQuizzes]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchQuizzes();
  };

  const getStatusAction = (quiz) => {
    switch (quiz.status) {
      case "AVAILABLE":
        return (
          <Link to={`/student/quizzes/${quiz._id}`}>
            <Button variant="primary" size="sm" icon={ArrowRight}>
              Start Quiz
            </Button>
          </Link>
        );
      case "IN_PROGRESS":
        return (
          <Link to={`/student/quizzes/${quiz._id}/attempt`}>
            <Button variant="primary" size="sm" icon={Clock}>
              Resume Quiz
            </Button>
          </Link>
        );
      case "COMPLETED":
        return (
          <Link to={`/student/quiz-attempts/${quiz.attemptId || "latest"}/result`}>
            <Button variant="outline" size="sm" icon={CheckCircle2}>
              View Results
            </Button>
          </Link>
        );
      case "UPCOMING":
        return (
          <Link to={`/student/quizzes/${quiz._id}`}>
            <Button variant="secondary" size="sm">
              View Rules
            </Button>
          </Link>
        );
      case "EXPIRED":
        return (
          <Button variant="secondary" size="sm" disabled>
            Closed
          </Button>
        );
      default:
        return (
          <Link to={`/student/quizzes/${quiz._id}`}>
            <Button variant="secondary" size="sm">
              Details
            </Button>
          </Link>
        );
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <Breadcrumb
        items={[
          { label: "Dashboard", to: "/student/dashboard" },
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
          <h1
            style={{
              fontSize: "22px",
              fontWeight: 700,
              color: "var(--color-text)",
              marginBottom: "4px",
            }}
          >
            Course Quizzes & Assessments
          </h1>
          <p style={{ fontSize: "14px", color: "var(--color-text-secondary)" }}>
            Review assessment windows, complete timed quizzes, and inspect graded evaluations.
          </p>
        </div>

        {/* Quick Filter Tabs */}
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {STATUS_TABS.map((tab) => {
            const isActive = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                className={`lms-pill-tab ${isActive ? "active" : ""}`}
                onClick={() => setStatusFilter(tab.id)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          alignItems: "center",
          backgroundColor: "var(--color-surface)",
          padding: "14px 16px",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--color-border)",
        }}
      >
        <form onSubmit={handleSearchSubmit} style={{ flex: 1, minWidth: "240px" }}>
          <Input
            icon={Search}
            placeholder="Search quizzes by title or keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </form>

        <div style={{ width: "240px" }}>
          <Select
            value={selectedCourse}
            onChange={(e) => {
              setSelectedCourse(e.target.value);
              setSearchParams(e.target.value ? { courseId: e.target.value } : {});
            }}
          >
            <option value="">All Enrolled Courses</option>
            {courses.map((c) => (
              <option key={c._id} value={c._id}>
                {c.courseCode} — {c.courseName}
              </option>
            ))}
          </Select>
        </div>

        {(searchQuery || selectedCourse || statusFilter !== "ALL") && (
          <Button
            variant="secondary"
            size="md"
            icon={RotateCcw}
            onClick={() => {
              setSearchQuery("");
              setSelectedCourse("");
              setStatusFilter("ALL");
              setSearchParams({});
            }}
          >
            Reset
          </Button>
        )}
      </div>

      {/* Content Area */}
      {loading ? (
        <LoadingSpinner message="Loading course quizzes..." />
      ) : error ? (
        <ErrorBanner message={error} onRetry={fetchQuizzes} />
      ) : quizzes.length === 0 ? (
        <EmptyState
          icon={FolderX}
          title="No quizzes found"
          description={
            searchQuery || selectedCourse || statusFilter !== "ALL"
              ? "No quizzes matched your selected filters. Try clearing your search or status filter."
              : "There are currently no quizzes scheduled for your enrolled courses."
          }
          actionLabel={searchQuery || selectedCourse || statusFilter !== "ALL" ? "Clear Filters" : undefined}
          onAction={() => {
            setSearchQuery("");
            setSelectedCourse("");
            setStatusFilter("ALL");
            setSearchParams({});
          }}
        />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))",
            gap: "18px",
          }}
        >
          {quizzes.map((quiz) => {
            const endDate = new Date(quiz.endTime);
            const startDate = new Date(quiz.startTime);
            const isClosingSoon =
              quiz.status === "AVAILABLE" &&
              endDate.getTime() - startDate.getTime() < 72 * 60 * 60 * 1000;

            const courseCode = quiz.courseId?.courseCode || quiz.courseCode;
            const theme = getCourseTheme(courseCode);
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
                  {/* Card Header: Subject Pill & Status Badge */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "10px",
                    }}
                  >
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
                      {courseCode || "Course"}
                    </span>
                    <Badge variant={quiz.status} size="sm" />
                  </div>

                  {/* Title */}
                  <h3
                    style={{
                      fontSize: "16px",
                      fontWeight: 600,
                      color: "var(--color-text)",
                      marginBottom: "6px",
                      lineHeight: 1.35,
                    }}
                  >
                    <Link
                      to={
                        quiz.status === "COMPLETED" && quiz.attemptId
                          ? `/student/quiz-attempts/${quiz.attemptId}/result`
                          : `/student/quizzes/${quiz._id}`
                      }
                      style={{ color: "var(--color-text)", textDecoration: "none" }}
                    >
                      {quiz.title}
                    </Link>
                  </h3>

                  {/* Concise Single-Line Description / Topic */}
                  {quiz.description && (
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
                      {quiz.description}
                    </p>
                  )}

                  {/* Scannable Metadata Specs Strip */}
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
                      <span>{quiz.questions?.length || quiz.questionCount || 5} questions</span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Award size={13} style={{ color: "var(--color-text-muted)" }} />
                      <span>{quiz.maxScore || 10} pts total</span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Calendar size={13} style={{ color: "var(--color-text-muted)" }} />
                      <span>
                        {quiz.status === "UPCOMING"
                          ? `Opens ${startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                          : `Closes ${endDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                      </span>
                    </div>
                  </div>

                  {/* Urgency Alert */}
                  {isClosingSoon && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        marginTop: "10px",
                        padding: "6px 10px",
                        borderRadius: "4px",
                        backgroundColor: "var(--color-warning-bg)",
                        color: "var(--color-warning)",
                        fontSize: "12px",
                        fontWeight: 500,
                      }}
                    >
                      <AlertCircle size={13} />
                      <span>Closes within 48 hours · Complete soon</span>
                    </div>
                  )}
                </div>

                {/* Footer Action */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingTop: "12px",
                    borderTop: "1px solid var(--color-border-subtle)",
                  }}
                >
                  <Link
                    to={`/student/quizzes/${quiz._id}`}
                    style={{ fontSize: "13px", fontWeight: 500, color: "var(--color-primary-700)" }}
                  >
                    Instructions
                  </Link>

                  <div>{getStatusAction(quiz)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
