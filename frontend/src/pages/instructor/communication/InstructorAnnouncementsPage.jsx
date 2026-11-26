import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Search,
  Plus,
  Calendar,
  ArrowRight,
  RotateCcw,
  Megaphone,
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

const formatPublishedAt = (value) => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

export const InstructorAnnouncementsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCourseId = searchParams.get("courseId") || "";

  const [announcements, setAnnouncements] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedCourse, setSelectedCourse] = useState(initialCourseId);
  const [searchQuery, setSearchQuery] = useState("");
  const requestSeq = useRef(0);

  const fetchAssignedCourses = useCallback(async () => {
    try {
      const res = await api.getInstructorCourses();
      if (res.status === "success") {
        setCourses(res.data || []);
      }
    } catch {
      // Non-fatal if course filter list fails; main announcement error banner handles visibility
    }
  }, []);

  const fetchAnnouncements = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (selectedCourse) params.courseId = selectedCourse;
      if (searchQuery.trim()) params.q = searchQuery.trim();

      const res = await api.getInstructorAnnouncements(params);
      if (seq !== requestSeq.current) return;
      if (res.status === "success") {
        setAnnouncements(res.data || []);
      }
    } catch (err) {
      if (seq !== requestSeq.current) return;
      setError(err.message || "Failed to load announcements.");
    } finally {
      if (seq === requestSeq.current) {
        setLoading(false);
      }
    }
  }, [selectedCourse, searchQuery]);

  useEffect(() => {
    fetchAssignedCourses();
  }, [fetchAssignedCourses]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const hasActiveCourses = courses.some((c) => c.isActive !== false);
  const createHref = selectedCourse
    ? `/instructor/announcements/new?courseId=${encodeURIComponent(selectedCourse)}`
    : "/instructor/announcements/new";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <Breadcrumb
        items={[
          { label: "Dashboard", to: "/instructor/dashboard" },
          { label: "Announcements" },
        ]}
      />

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
              margin: "0 0 4px 0",
            }}
          >
            Course Announcements
          </h1>
          <p style={{ fontSize: "14px", color: "var(--color-text-secondary)", margin: 0 }}>
            Publish and review announcements for students enrolled in your assigned courses.
          </p>
        </div>

        <Link to={createHref}>
          <Button variant="primary" size="md" icon={Plus}>
            Create Announcement
          </Button>
        </Link>
      </div>

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
        <div style={{ flex: 1, minWidth: "240px" }}>
          <Input
            icon={Search}
            aria-label="Search announcements"
            placeholder="Search announcements by title or content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div style={{ width: "260px", maxWidth: "100%" }}>
          <Select
            aria-label="Filter by assigned course"
            value={selectedCourse}
            onChange={(e) => {
              const value = e.target.value;
              setSelectedCourse(value);
              setSearchParams(value ? { courseId: value } : {});
            }}
          >
            <option value="">All Assigned Courses</option>
            {courses.map((c) => (
              <option key={c._id} value={c._id}>
                {c.courseCode} — {c.courseName}
                {c.isActive === false ? " (Inactive)" : ""}
              </option>
            ))}
          </Select>
        </div>

        {(searchQuery || selectedCourse) && (
          <Button
            variant="secondary"
            size="md"
            icon={RotateCcw}
            onClick={() => {
              setSearchQuery("");
              setSelectedCourse("");
              setSearchParams({});
            }}
          >
            Reset
          </Button>
        )}
      </div>

      {loading ? (
        <LoadingSpinner message="Loading course announcements..." />
      ) : error ? (
        <ErrorBanner message={error} onRetry={fetchAnnouncements} />
      ) : announcements.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No announcements found"
          description={
            searchQuery || selectedCourse
              ? "No announcements matched your current filters. Try clearing your filters or selecting another course."
              : hasActiveCourses
              ? "You have not published any announcements yet. Create one to notify enrolled students."
              : "No announcements are available for your assigned courses."
          }
          actionLabel={
            searchQuery || selectedCourse
              ? "Clear Filters"
              : undefined
          }
          onAction={
            searchQuery || selectedCourse
              ? () => {
                  setSearchQuery("");
                  setSelectedCourse("");
                  setSearchParams({});
                }
              : undefined
          }
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {announcements.map((ann) => {
            const courseCode = ann.courseId?.courseCode || "Course";
            const theme = getCourseTheme(courseCode);
            const SubjectIcon = theme.icon;

            return (
              <article
                key={ann._id}
                className="lms-course-card"
                style={{
                  backgroundColor: "var(--color-surface)",
                  borderRadius: "var(--radius-lg)",
                  border: "1px solid var(--color-border)",
                  borderTop: `3px solid ${theme.color}`,
                  padding: "16px 20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "8px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
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
                        padding: "2px 8px",
                        borderRadius: "4px",
                      }}
                    >
                      <SubjectIcon size={13} aria-hidden="true" />
                      {courseCode}
                    </span>

                    {ann.courseId?.isActive === false && <Badge variant="INACTIVE" size="sm" />}

                    <span
                      className="tabular-nums"
                      style={{
                        fontSize: "12px",
                        color: "var(--color-text-muted)",
                        display: "flex",
                        alignItems: "center",
                        gap: "5px",
                      }}
                    >
                      <Calendar size={13} aria-hidden="true" />
                      {formatPublishedAt(ann.createdAt)}
                    </span>
                  </div>
                </div>

                <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--color-text)", margin: 0 }}>
                  <Link
                    to={`/instructor/announcements/${ann._id}`}
                    style={{ color: "var(--color-text)", textDecoration: "none" }}
                  >
                    {ann.title}
                  </Link>
                </h2>

                <p
                  style={{
                    fontSize: "13.5px",
                    color: "var(--color-text-secondary)",
                    lineHeight: 1.55,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    margin: 0,
                  }}
                >
                  {ann.content}
                </p>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingTop: "10px",
                    borderTop: "1px solid var(--color-border-subtle)",
                    flexWrap: "wrap",
                    gap: "8px",
                  }}
                >
                  <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                    Course: {ann.courseId?.courseName || "Assigned Course"}
                  </span>

                  <Link to={`/instructor/announcements/${ann._id}`}>
                    <Button variant="outline" size="sm" icon={ArrowRight}>
                      View Announcement
                    </Button>
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
