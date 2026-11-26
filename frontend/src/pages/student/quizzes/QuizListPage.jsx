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
import { WeekList, WeekViewToggle } from "../../../components/materials/MaterialList";
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
  const [byWeek, setByWeek] = useState(false);
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
    <div className="lms-page">
      <Breadcrumb
        items={[
          { label: "Dashboard", to: "/student/dashboard" },
          { label: "Quizzes & Assessments" },
        ]}
      />

      <div className="lms-page-header">
        <div className="lms-page-header-left">
          <div className="lms-page-title-row">
            <h1>Course Quizzes &amp; Assessments</h1>
            {!loading && !error && <span className="lms-count-tag">{quizzes.length}</span>}
          </div>
        </div>

        <div className="lms-toolbar-group">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`lms-pill-tab ${statusFilter === tab.id ? "active" : ""}`}
              onClick={() => setStatusFilter(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="lms-toolbar">
        <form onSubmit={handleSearchSubmit} style={{ flex: 1, minWidth: "220px", maxWidth: "420px" }}>
          <Input
            icon={Search}
            aria-label="Search quizzes"
            placeholder="Search quizzes by title or keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </form>

        <div className="lms-toolbar-controls">
          <div style={{ width: "220px" }}>
            <Select
              aria-label="Filter by course"
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

          <WeekViewToggle allLabel="Ungrouped" byWeek={byWeek} onChange={setByWeek} />

          {(searchQuery || selectedCourse || statusFilter !== "ALL") && (
            <Button
              variant="secondary"
              size="sm"
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
      </div>

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
              ? "No quizzes matched your selected filters."
              : "No quizzes are scheduled for your enrolled courses."
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
        <WeekList
          key={JSON.stringify([selectedCourse, statusFilter, searchQuery.trim()])}
          items={quizzes}
          byWeek={byWeek}
          singular="quiz"
          plural="quizzes"
          expandAll={Boolean(searchQuery.trim()) || statusFilter !== "ALL"}
        >
          {(weekItems) => (
            <div className="lms-grid-cards-wide lms-week-cards">
              {weekItems.map((quiz) => {
                const endDate = new Date(quiz.endTime);
                const startDate = new Date(quiz.startTime);
                const isClosingSoon =
                  quiz.status === "AVAILABLE" &&
                  endDate.getTime() - startDate.getTime() < 72 * 60 * 60 * 1000;

                const courseCode = quiz.courseId?.courseCode || quiz.courseCode;
                const theme = getCourseTheme(courseCode);
                const SubjectIcon = theme.icon;

                return (
                  <article key={quiz._id} className="lms-card lms-card-accent lms-card-clickable">
                    <div className="lms-card-head">
                      <span className="lms-course-code">
                        <SubjectIcon size={13} aria-hidden="true" />
                        {courseCode || "Course"}
                      </span>
                      <Badge variant={quiz.status} size="sm" />
                    </div>

                    <h2 className="lms-card-title">
                      <Link
                        to={
                          quiz.status === "COMPLETED" && quiz.attemptId
                            ? `/student/quiz-attempts/${quiz.attemptId}/result`
                            : `/student/quizzes/${quiz._id}`
                        }
                      >
                        {quiz.title}
                      </Link>
                    </h2>

                    {quiz.description && <p className="lms-clamp-2">{quiz.description}</p>}

                    <div className="lms-card-stats">
                      <span>
                        <Clock size={13} aria-hidden="true" />
                        {quiz.timeLimit} mins limit
                      </span>
                      <span>
                        <HelpCircle size={13} aria-hidden="true" />
                        {quiz.questions?.length || quiz.questionCount || 5} questions
                      </span>
                      <span>
                        <Award size={13} aria-hidden="true" />
                        {quiz.maxScore || 10} pts total
                      </span>
                      <span>
                        <Calendar size={13} aria-hidden="true" />
                        {quiz.status === "UPCOMING"
                          ? `Opens ${startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                          : `Closes ${endDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                      </span>
                    </div>

                    {isClosingSoon && (
                      <div>
                        <span className="lms-tag-warning">
                          <AlertCircle size={12} aria-hidden="true" />
                          Closes soon
                        </span>
                      </div>
                    )}

                    <div className="lms-card-footer">
                      <Link to={`/student/quizzes/${quiz._id}`} className="lms-link" style={{ fontSize: "13px" }}>
                        Instructions
                      </Link>
                      <div>{getStatusAction(quiz)}</div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </WeekList>
      )}
    </div>
  );
};
