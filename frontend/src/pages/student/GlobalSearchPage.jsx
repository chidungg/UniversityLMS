import { useState, useEffect, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  Search,
  BookOpen,
  FolderOpen,
  FileText,
  ArrowRight,
  FolderX,
} from "lucide-react";
import { api } from "../../services/api";
import { Breadcrumb } from "../../components/ui/Breadcrumb";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorBanner } from "../../components/ui/ErrorBanner";

export const GlobalSearchPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryParam = searchParams.get("q") || "";
  const categoryParam = searchParams.get("category") || "all";

  const [keyword, setKeyword] = useState(queryParam);
  const [activeTab, setActiveTab] = useState(categoryParam);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const performSearch = useCallback(async (term, category) => {
    if (!term || !term.trim()) {
      setResults(null);
      setError("");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await api.search({ q: term.trim(), category });
      if (res.status === "success") {
        setResults(res.data);
      }
    } catch (err) {
      setError(err.message || "Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setKeyword(queryParam);
    setActiveTab(categoryParam);
    if (queryParam) {
      performSearch(queryParam, categoryParam);
    } else {
      setResults(null);
    }
  }, [queryParam, categoryParam, performSearch]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!keyword.trim()) {
      setError("Please enter a keyword to search.");
      return;
    }
    setSearchParams({ q: keyword.trim(), category: activeTab });
  };

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    if (keyword.trim()) {
      setSearchParams({ q: keyword.trim(), category: newTab });
    }
  };

  const counts = results?.counts || { courses: 0, materials: 0, assignments: 0, total: 0 };
  const coursesList = results?.courses || [];
  const materialsList = results?.materials || [];
  const assignmentsList = results?.assignments || [];

  return (
    <div className="lms-page">
      <Breadcrumb items={[{ label: "Dashboard", to: "/student/dashboard" }, { label: "Search" }]} />

      <div className="lms-page-header">
        <div className="lms-page-header-left">
          <h1>Global Search</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="lms-toolbar">
        <div style={{ flex: 1, minWidth: "240px" }}>
          <Input
            icon={Search}
            aria-label="Global search"
            placeholder="Search courses, materials, or assignments..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>
        <Button type="submit" variant="primary" size="md" icon={Search} loading={loading}>
          Search
        </Button>
      </form>

      {error && <ErrorBanner message={error} onRetry={() => performSearch(keyword, activeTab)} />}

      {!queryParam && !results && !loading && (
        <EmptyState
          icon={Search}
          title="Search your university coursework"
          description="Enter a keyword above to find courses, materials, and assignments."
        />
      )}

      {loading && <LoadingSpinner message={`Searching for "${keyword}"...`} />}

      {!loading && results && (
        <div className="lms-section" style={{ gap: "16px" }}>
          <div
            className="tabular-nums"
            style={{
              display: "flex",
              gap: "6px",
              borderBottom: "1px solid var(--color-border)",
              paddingBottom: "10px",
              flexWrap: "wrap",
            }}
          >
            {[
              { id: "all", label: `All Results (${counts.total})` },
              { id: "courses", label: `Courses (${counts.courses})` },
              { id: "materials", label: `Materials (${counts.materials})` },
              { id: "assignments", label: `Assignments (${counts.assignments})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={`lms-pill-tab ${activeTab === tab.id ? "active" : ""}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {counts.total === 0 ? (
            <EmptyState
              icon={FolderX}
              title="No matching results."
              description={`No courses, materials, or assignments matched "${queryParam}".`}
              actionLabel="Clear Search"
              onAction={() => {
                setKeyword("");
                setSearchParams({});
                setResults(null);
              }}
            />
          ) : (
            <div className="lms-section" style={{ gap: "20px" }}>
              {(activeTab === "all" || activeTab === "courses") && coursesList.length > 0 && (
                <section className="lms-section">
                  <div className="lms-section-title">
                    <BookOpen size={17} aria-hidden="true" />
                    <h2>Courses ({coursesList.length})</h2>
                  </div>
                  <div className="lms-grid-cards">
                    {coursesList.map((course) => (
                      <article key={course._id} className="lms-card lms-card-accent lms-card-clickable">
                        <div className="lms-card-head">
                          <span className="lms-course-code">{course.courseCode}</span>
                          <Badge variant={course.isActive ? "ACTIVE" : "INACTIVE"} size="sm" />
                        </div>
                        <Link to={`/student/courses/${course._id}`} className="lms-card-title">
                          {course.courseName}
                        </Link>
                        {course.description && <p className="lms-clamp-2">{course.description}</p>}
                        <div className="lms-card-footer">
                          <Link to={`/student/courses/${course._id}`} style={{ width: "100%" }}>
                            <Button variant="secondary" size="sm" icon={ArrowRight} style={{ width: "100%" }}>
                              View Course Details
                            </Button>
                          </Link>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              )}

              {(activeTab === "all" || activeTab === "materials") && materialsList.length > 0 && (
                <section className="lms-section">
                  <div className="lms-section-title">
                    <FolderOpen size={17} aria-hidden="true" />
                    <h2>Learning Materials ({materialsList.length})</h2>
                  </div>
                  <div className="lms-panel">
                    <div className="lms-feed-list">
                      {materialsList.map((material) => (
                        <div key={material._id} className="lms-feed-row">
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" }}>
                              <Badge variant={material.type} size="sm" />
                              {material.courseId?.courseCode && (
                                <span className="lms-course-code">{material.courseId.courseCode}</span>
                              )}
                            </div>
                            <Link
                              to={`/student/courses/${material.courseId?._id}/materials`}
                              style={{ fontWeight: 600, fontSize: "14px", display: "block" }}
                            >
                              {material.title}
                            </Link>
                            {material.description && (
                              <p className="lms-clamp-2" style={{ marginTop: "2px" }}>
                                {material.description}
                              </p>
                            )}
                          </div>
                          <Link to={`/student/courses/${material.courseId?._id}/materials`}>
                            <Button variant="outline" size="sm" icon={ArrowRight}>
                              View in Course
                            </Button>
                          </Link>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {(activeTab === "all" || activeTab === "assignments") && assignmentsList.length > 0 && (
                <section className="lms-section">
                  <div className="lms-section-title">
                    <FileText size={17} aria-hidden="true" />
                    <h2>Assignments ({assignmentsList.length})</h2>
                  </div>
                  <div className="lms-panel">
                    <div className="lms-feed-list">
                      {assignmentsList.map((assignment) => (
                        <div key={assignment._id} className="lms-feed-row">
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" }}>
                              <span className="lms-course-code">{assignment.courseId?.courseCode}</span>
                              <span className="tabular-nums" style={{ fontSize: "12px" }}>
                                Due:{" "}
                                {new Date(assignment.dueDate).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                            <Link
                              to={`/student/assignments/${assignment._id}`}
                              style={{ fontWeight: 600, fontSize: "14px", display: "block" }}
                            >
                              {assignment.title}
                            </Link>
                            {assignment.description && (
                              <p className="lms-clamp-2" style={{ marginTop: "2px" }}>
                                {assignment.description}
                              </p>
                            )}
                          </div>
                          <Link to={`/student/assignments/${assignment._id}`}>
                            <Button variant="primary" size="sm" icon={ArrowRight}>
                              View Assignment
                            </Button>
                          </Link>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
