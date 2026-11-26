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
    <div className="lms-page">
      <Breadcrumb
        items={[
          { label: "Dashboard", to: "/instructor/dashboard" },
          { label: "Announcements" },
        ]}
      />

      <div className="lms-page-header">
        <div className="lms-page-header-left">
          <div className="lms-page-title-row">
            <h1>Course Announcements</h1>
            {!loading && !error && <span className="lms-count-tag">{announcements.length}</span>}
          </div>
        </div>

        <Link to={createHref}>
          <Button variant="primary" size="md" icon={Plus}>
            Create Announcement
          </Button>
        </Link>
      </div>

      <div className="lms-toolbar">
        <div style={{ flex: 1, minWidth: "240px", maxWidth: "460px" }}>
          <Input
            icon={Search}
            aria-label="Search announcements"
            placeholder="Search announcements by title or content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="lms-toolbar-controls">
          <div style={{ width: "240px", maxWidth: "100%" }}>
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
              size="sm"
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
              ? "No announcements matched your current filters."
              : hasActiveCourses
                ? "You have not published any announcements yet."
                : "No announcements are available for your assigned courses."
          }
          actionLabel={searchQuery || selectedCourse ? "Clear Filters" : undefined}
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
        <div className="lms-section" style={{ gap: "12px" }}>
          {announcements.map((ann) => {
            const courseCode = ann.courseId?.courseCode || "Course";
            const theme = getCourseTheme(courseCode);
            const SubjectIcon = theme.icon;

            return (
              <article key={ann._id} className="lms-announcement-card">
                <div className="lms-card-head">
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span className="lms-course-code">
                      <SubjectIcon size={13} aria-hidden="true" />
                      {courseCode}
                      {ann.courseId?.courseName ? ` — ${ann.courseId.courseName}` : ""}
                    </span>
                    {ann.courseId?.isActive === false && <Badge variant="INACTIVE" size="sm" />}
                  </div>

                  <span
                    className="tabular-nums"
                    style={{ fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "5px" }}
                  >
                    <Calendar size={13} aria-hidden="true" />
                    {formatPublishedAt(ann.createdAt)}
                  </span>
                </div>

                <h2 className="lms-card-title" style={{ margin: 0 }}>
                  <Link to={`/instructor/announcements/${ann._id}`}>{ann.title}</Link>
                </h2>

                <p className="lms-clamp-2">{ann.content}</p>

                <div className="lms-card-footer" style={{ justifyContent: "flex-end" }}>
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
