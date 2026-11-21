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
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <Breadcrumb items={[{ label: "Dashboard", to: "/student/dashboard" }, { label: "Search" }]} />

      {/* Header */}
      <div>
        <h1 style={{ fontSize: "22px", fontWeight: 700, color: "var(--color-text)", marginBottom: "4px" }}>
          Global Search
        </h1>
        <p style={{ fontSize: "14px", color: "var(--color-text-secondary)" }}>
          Find accessible courses, lecture materials, and assignments across your enrolled syllabus.
        </p>
      </div>

      {/* Search Input Box */}
      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          gap: "12px",
          alignItems: "center",
          backgroundColor: "var(--color-surface)",
          padding: "16px",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--color-border)",
        }}
      >
        <div style={{ flex: 1 }}>
          <Input
            icon={Search}
            placeholder="Type course name, lecture topic, or assignment title..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ height: "42px" }}
          />
        </div>
        <Button type="submit" variant="primary" size="md" icon={Search} loading={loading}>
          Search
        </Button>
      </form>

      {/* Error state */}
      {error && <ErrorBanner message={error} onRetry={() => performSearch(keyword, activeTab)} />}

      {/* When no query has been entered yet */}
      {!queryParam && !results && !loading && (
        <EmptyState
          icon={Search}
          title="Search your university coursework"
          description="Enter a keyword above to find courses, reading materials, and assignments you have permission to access."
        />
      )}

      {/* Loading state */}
      {loading && <LoadingSpinner message={`Searching for "${keyword}"...`} />}

      {/* Results Section */}
      {!loading && results && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Category Tabs */}
          <div
            className="tabular-nums"
            style={{
              display: "flex",
              gap: "8px",
              borderBottom: "1px solid var(--color-border)",
              paddingBottom: "8px",
              flexWrap: "wrap",
            }}
          >
            {[
              { id: "all", label: `All Results (${counts.total})` },
              { id: "courses", label: `Courses (${counts.courses})` },
              { id: "materials", label: `Materials (${counts.materials})` },
              { id: "assignments", label: `Assignments (${counts.assignments})` },
            ].map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabChange(tab.id)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "var(--radius-md)",
                    border: `1px solid ${active ? "var(--color-primary-700)" : "transparent"}`,
                    backgroundColor: active ? "var(--color-primary-100)" : "transparent",
                    color: active ? "var(--color-primary-700)" : "var(--color-text-secondary)",
                    fontWeight: active ? 600 : 500,
                    fontSize: "13px",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Zero matches state */}
          {counts.total === 0 ? (
            <EmptyState
              icon={FolderX}
              title="No matching results."
              description={`We couldn't find any courses, materials, or assignments matching "${queryParam}". Try checking your spelling or using a broader term.`}
              actionLabel="Clear Search"
              onAction={() => {
                setKeyword("");
                setSearchParams({});
                setResults(null);
              }}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              {/* Courses Results */}
              {(activeTab === "all" || activeTab === "courses") && coursesList.length > 0 && (
                <section style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <BookOpen size={18} style={{ color: "var(--color-primary-700)" }} />
                    <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--color-text)" }}>
                      Courses ({coursesList.length})
                    </h2>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "14px" }}>
                    {coursesList.map((course) => (
                      <div
                        key={course._id}
                        className="lms-card-interactive"
                        style={{
                          backgroundColor: "var(--color-surface)",
                          borderRadius: "var(--radius-md)",
                          border: "1px solid var(--color-border)",
                          padding: "16px",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          gap: "10px",
                        }}
                      >
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                            <span
                              style={{
                                fontSize: "12px",
                                fontWeight: 600,
                                color: "var(--color-primary-700)",
                                backgroundColor: "var(--color-primary-100)",
                                padding: "2px 6px",
                                borderRadius: "4px",
                              }}
                            >
                              {course.courseCode}
                            </span>
                            <Badge variant={course.isActive ? "ACTIVE" : "INACTIVE"} size="sm" />
                          </div>
                          <Link
                            to={`/student/courses/${course._id}`}
                            style={{ fontWeight: 600, fontSize: "15px", color: "var(--color-text)" }}
                          >
                            {course.courseName}
                          </Link>
                          <p style={{ fontSize: "13px", color: "var(--color-text-secondary)", marginTop: "4px", lineHeight: 1.4 }}>
                            {course.description || "No description available."}
                          </p>
                        </div>
                        <Link to={`/student/courses/${course._id}`}>
                          <Button variant="secondary" size="sm" icon={ArrowRight} style={{ width: "100%" }}>
                            View Course Details
                          </Button>
                        </Link>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Learning Materials Results */}
              {(activeTab === "all" || activeTab === "materials") && materialsList.length > 0 && (
                <section style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <FolderOpen size={18} style={{ color: "var(--color-primary-700)" }} />
                    <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--color-text)" }}>
                      Learning Materials ({materialsList.length})
                    </h2>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {materialsList.map((material) => (
                      <div
                        key={material._id}
                        className="lms-card-interactive"
                        style={{
                          backgroundColor: "var(--color-surface)",
                          borderRadius: "var(--radius-md)",
                          border: "1px solid var(--color-border)",
                          padding: "16px 20px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: "12px",
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1, minWidth: "260px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <Badge variant={material.type} size="sm" />
                            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-primary-700)" }}>
                              {material.courseId?.courseCode}
                            </span>
                          </div>
                          <Link
                            to={`/student/courses/${material.courseId?._id}/materials`}
                            style={{ fontWeight: 600, fontSize: "15px", color: "var(--color-text)" }}
                          >
                            {material.title}
                          </Link>
                          <p style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
                            {material.description || "No description provided."}
                          </p>
                        </div>
                        <Link to={`/student/courses/${material.courseId?._id}/materials`}>
                          <Button variant="outline" size="sm" icon={ArrowRight}>
                            View in Course
                          </Button>
                        </Link>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Assignments Results */}
              {(activeTab === "all" || activeTab === "assignments") && assignmentsList.length > 0 && (
                <section style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <FileText size={18} style={{ color: "var(--color-primary-700)" }} />
                    <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--color-text)" }}>
                      Assignments ({assignmentsList.length})
                    </h2>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {assignmentsList.map((assignment) => (
                      <div
                        key={assignment._id}
                        className="lms-card-interactive"
                        style={{
                          backgroundColor: "var(--color-surface)",
                          borderRadius: "var(--radius-md)",
                          border: "1px solid var(--color-border)",
                          padding: "16px 20px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: "12px",
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1, minWidth: "260px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 600,
                                color: "var(--color-primary-700)",
                                backgroundColor: "var(--color-primary-100)",
                                padding: "2px 6px",
                                borderRadius: "4px",
                              }}
                            >
                              {assignment.courseId?.courseCode}
                            </span>
                            <span className="tabular-nums" style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                              Due: {new Date(assignment.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <Link
                            to={`/student/assignments/${assignment._id}`}
                            style={{ fontWeight: 600, fontSize: "15px", color: "var(--color-text)" }}
                          >
                            {assignment.title}
                          </Link>
                          <p style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
                            {assignment.description || "No description provided."}
                          </p>
                        </div>
                        <Link to={`/student/assignments/${assignment._id}`}>
                          <Button variant="primary" size="sm" icon={ArrowRight}>
                            View Assignment
                          </Button>
                        </Link>
                      </div>
                    ))}
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
