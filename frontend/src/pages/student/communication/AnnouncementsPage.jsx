import { useState, useEffect, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Search,
  FolderX,
  Calendar,
  User,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import { api } from "../../../services/api";
import { Breadcrumb } from "../../../components/ui/Breadcrumb";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Modal } from "../../../components/ui/Modal";
import { LoadingSpinner } from "../../../components/ui/LoadingSpinner";
import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorBanner } from "../../../components/ui/ErrorBanner";
import { getCourseTheme } from "../../../utils/courseThemes";

export const AnnouncementsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCourseId = searchParams.get("courseId") || "";

  const [announcements, setAnnouncements] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedCourse, setSelectedCourse] = useState(initialCourseId);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeAnnouncement, setActiveAnnouncement] = useState(null);

  const fetchEnrolledCourses = useCallback(async () => {
    try {
      const res = await api.getCourses();
      if (res.status === "success") {
        setCourses(res.data);
      }
    } catch (err) {
      console.error("Failed to load courses:", err);
    }
  }, []);

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (selectedCourse) params.courseId = selectedCourse;
      if (searchQuery.trim()) params.q = searchQuery.trim();

      const res = await api.getAnnouncements(params);
      if (res.status === "success") {
        setAnnouncements(res.data);
      }
    } catch (err) {
      setError(err.message || "Failed to load announcements.");
    } finally {
      setLoading(false);
    }
  }, [selectedCourse, searchQuery]);

  useEffect(() => {
    fetchEnrolledCourses();
  }, [fetchEnrolledCourses]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const handleOpenAnnouncement = async (announcement) => {
    setActiveAnnouncement(announcement);
    // Mark as read in state
    setAnnouncements((prev) =>
      prev.map((a) => (a._id === announcement._id ? { ...a, isRead: true } : a))
    );
    try {
      await api.getAnnouncementDetails(announcement._id);
    } catch {
      // safe fallback
    }
  };

  const displayedAnnouncements = announcements.filter((a) => {
    if (unreadOnly && a.isRead) return false;
    return true;
  });

  const unreadCount = announcements.filter((a) => !a.isRead).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <Breadcrumb
        items={[
          { label: "Dashboard", to: "/student/dashboard" },
          { label: "Announcements" },
        ]}
      />

      {/* Header */}
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
            Course Announcements & Notices
          </h1>
          <p style={{ fontSize: "14px", color: "var(--color-text-secondary)" }}>
            Official notices, examination guidelines, and lecture schedule updates from your instructors.
          </p>
        </div>

        {/* Status Pill Tabs */}
        <div style={{ display: "flex", gap: "6px" }}>
          <button
            type="button"
            className={`lms-pill-tab ${!unreadOnly ? "active" : ""}`}
            onClick={() => setUnreadOnly(false)}
          >
            All Notices ({announcements.length})
          </button>
          <button
            type="button"
            className={`lms-pill-tab ${unreadOnly ? "active" : ""}`}
            onClick={() => setUnreadOnly(true)}
          >
            Unread ({unreadCount})
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
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
        <div style={{ flex: 1, minWidth: "260px" }}>
          <Input
            icon={Search}
            placeholder="Search notices by title or content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

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

        {(searchQuery || selectedCourse || unreadOnly) && (
          <Button
            variant="secondary"
            size="md"
            icon={RotateCcw}
            onClick={() => {
              setSearchQuery("");
              setSelectedCourse("");
              setUnreadOnly(false);
              setSearchParams({});
            }}
          >
            Reset
          </Button>
        )}
      </div>

      {/* Content Area */}
      {loading ? (
        <LoadingSpinner message="Loading course announcements..." />
      ) : error ? (
        <ErrorBanner message={error} onRetry={fetchAnnouncements} />
      ) : displayedAnnouncements.length === 0 ? (
        <EmptyState
          icon={FolderX}
          title={unreadOnly ? "No unread announcements" : "No announcements found"}
          description={
            unreadOnly
              ? "You are all caught up! Switch to 'All Notices' to review past announcements."
              : searchQuery || selectedCourse
              ? "No announcements matched your current filters. Try selecting another course or clearing your search query."
              : "No announcements have been posted for your enrolled courses yet."
          }
          actionLabel={unreadOnly ? "Show All Notices" : searchQuery || selectedCourse ? "Clear Filters" : undefined}
          onAction={() => {
            if (unreadOnly) {
              setUnreadOnly(false);
            } else {
              setSearchQuery("");
              setSelectedCourse("");
              setSearchParams({});
            }
          }}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {displayedAnnouncements.map((ann) => {
            const date = new Date(ann.createdAt);
            const courseCode = ann.courseId?.courseCode || ann.courseCode;
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
                  borderTop: !ann.isRead ? `3px solid ${theme.color}` : "1px solid var(--color-border)",
                  padding: "16px 20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  transition: "border-color 0.15s ease, box-shadow 0.15s ease",
                }}
              >
                {/* Meta row: Course tag, author, date & unread badge */}
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
                      <SubjectIcon size={13} />
                      {courseCode || "Course"}
                    </span>

                    <span
                      style={{
                        fontSize: "12px",
                        color: "var(--color-text-secondary)",
                        display: "flex",
                        alignItems: "center",
                        gap: "5px",
                      }}
                    >
                      <User size={13} style={{ color: "var(--color-text-muted)" }} />
                      {ann.author?.fullName || "Course Instructor"}
                    </span>

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
                      <Calendar size={13} />
                      {date.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  {!ann.isRead && <Badge variant="UNREAD" size="sm" />}
                </div>

                {/* Title */}
                <h2
                  style={{
                    fontSize: "16px",
                    fontWeight: 600,
                    color: "var(--color-text)",
                    lineHeight: 1.35,
                    margin: 0,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleOpenAnnouncement(ann)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--color-text)",
                      fontWeight: 600,
                      fontSize: "16px",
                      cursor: "pointer",
                      textAlign: "left",
                      padding: 0,
                    }}
                    onMouseEnter={(e) => (e.target.style.color = "var(--color-primary-700)")}
                    onMouseLeave={(e) => (e.target.style.color = "var(--color-text)")}
                  >
                    {ann.title}
                  </button>
                </h2>

                {/* Content snippet */}
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

                {/* Action Row */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingTop: "10px",
                    borderTop: "1px solid var(--color-border-subtle)",
                  }}
                >
                  <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                    Course: {ann.courseId?.courseName || "Academic Curriculum"}
                  </span>

                  <div style={{ display: "flex", gap: "8px" }}>
                    <Button
                      variant="outline"
                      size="sm"
                      icon={ArrowRight}
                      onClick={() => handleOpenAnnouncement(ann)}
                    >
                      Read Full Announcement
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Full Reading Modal (ST13 in-dialog reading) */}
      {activeAnnouncement && (
        <Modal
          isOpen={!!activeAnnouncement}
          onClose={() => setActiveAnnouncement(null)}
          title={activeAnnouncement.title}
          maxWidth="680px"
          footer={
            <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
              <Link to={`/student/announcements/${activeAnnouncement._id}`}>
                <span style={{ fontSize: "13px", color: "var(--color-primary-700)", fontWeight: 500 }}>
                  Open Standalone Page
                </span>
              </Link>
              <Button variant="secondary" size="sm" onClick={() => setActiveAnnouncement(null)}>
                Close
              </Button>
            </div>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div
              className="tabular-nums"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                flexWrap: "wrap",
                padding: "10px 14px",
                borderRadius: "var(--radius-sm)",
                backgroundColor: "var(--color-surface-soft)",
                border: "1px solid var(--color-border-subtle)",
                fontSize: "12px",
                color: "var(--color-text-secondary)",
              }}
            >
              <span style={{ fontWeight: 600, color: "var(--color-primary-700)" }}>
                {activeAnnouncement.courseId?.courseCode || "Course"} — {activeAnnouncement.courseId?.courseName}
              </span>
              <span>•</span>
              <span>By {activeAnnouncement.author?.fullName || "Course Instructor"}</span>
              <span>•</span>
              <span>
                {new Date(activeAnnouncement.createdAt).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>

            <div
              style={{
                fontSize: "14px",
                color: "var(--color-text)",
                lineHeight: 1.7,
                whiteSpace: "pre-wrap",
                maxWidth: "70ch",
              }}
            >
              {activeAnnouncement.content}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
