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
  const [modalError, setModalError] = useState("");

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
    setModalError("");
    setActiveAnnouncement(announcement);
    try {
      const res = await api.getAnnouncementDetails(announcement._id);
      if (res.status === "success" && res.data) {
        const merged = { ...announcement, ...res.data, isRead: true };
        setActiveAnnouncement(merged);
        setAnnouncements((prev) =>
          prev.map((a) => (a._id === announcement._id ? { ...a, isRead: true } : a))
        );
      }
    } catch (err) {
      setModalError(err.message || "Failed to record read status for this announcement.");
    }
  };

  const displayedAnnouncements = announcements.filter((a) => {
    if (unreadOnly && a.isRead) return false;
    return true;
  });

  const unreadCount = announcements.filter((a) => !a.isRead).length;

  return (
    <div className="lms-page">
      <Breadcrumb
        items={[
          { label: "Dashboard", to: "/student/dashboard" },
          { label: "Announcements" },
        ]}
      />

      <div className="lms-page-header">
        <div className="lms-page-header-left">
          <h1>Course Announcements &amp; Notices</h1>
        </div>

        <div className="lms-toolbar-group">
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

      <div className="lms-toolbar">
        <div style={{ flex: 1, minWidth: "240px", maxWidth: "460px" }}>
          <Input
            icon={Search}
            aria-label="Search notices"
            placeholder="Search notices by title or content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="lms-toolbar-controls">
          <div style={{ width: "240px" }}>
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

          {(searchQuery || selectedCourse || unreadOnly) && (
            <Button
              variant="secondary"
              size="sm"
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
      </div>

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
              ? "Switch to 'All Notices' to review past announcements."
              : searchQuery || selectedCourse
                ? "No announcements matched your current filters."
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
        <div className="lms-section" style={{ gap: "12px" }}>
          {displayedAnnouncements.map((ann) => {
            const date = new Date(ann.createdAt);
            const courseCode = ann.courseId?.courseCode || ann.courseCode;
            const theme = getCourseTheme(courseCode);
            const SubjectIcon = theme.icon;

            return (
              <article
                key={ann._id}
                className={`lms-announcement-card ${!ann.isRead ? "is-unread" : ""}`}
              >
                <div className="lms-card-head">
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    <span className="lms-course-code">
                      <SubjectIcon size={13} aria-hidden="true" />
                      {courseCode || "Course"}
                      {ann.courseId?.courseName ? ` — ${ann.courseId.courseName}` : ""}
                    </span>

                    <span style={{ fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                      <User size={13} aria-hidden="true" />
                      {ann.author?.fullName || "Course Instructor"}
                    </span>

                    <span
                      className="tabular-nums"
                      style={{ fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "5px" }}
                    >
                      <Calendar size={13} aria-hidden="true" />
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

                <h2 style={{ fontSize: "16px", margin: 0 }}>
                  <button
                    type="button"
                    className="lms-title-btn"
                    style={{ fontSize: "16px" }}
                    onClick={() => handleOpenAnnouncement(ann)}
                  >
                    {ann.title}
                  </button>
                </h2>

                <p className="lms-clamp-2">{ann.content}</p>

                <div className="lms-card-footer" style={{ justifyContent: "flex-end" }}>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={ArrowRight}
                    onClick={() => handleOpenAnnouncement(ann)}
                  >
                    Read Full Announcement
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {activeAnnouncement && (
        <Modal
          isOpen={Boolean(activeAnnouncement)}
          onClose={() => setActiveAnnouncement(null)}
          title={activeAnnouncement.title}
          maxWidth="660px"
          footer={
            <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center", gap: "12px" }}>
              <Link to={`/student/announcements/${activeAnnouncement._id}`} className="lms-link" style={{ fontSize: "13px" }}>
                Open Standalone Page
              </Link>
              <Button variant="secondary" size="sm" onClick={() => setActiveAnnouncement(null)}>
                Close
              </Button>
            </div>
          }
        >
          <div className="lms-form-stack">
            {modalError && <ErrorBanner message={modalError} />}

            <div
              className="lms-info-box tabular-nums"
              style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", padding: "10px 14px", fontSize: "12px" }}
            >
              <span className="lms-course-code">
                {activeAnnouncement.courseId?.courseCode || "Course"} — {activeAnnouncement.courseId?.courseName}
              </span>
              <span>By {activeAnnouncement.author?.fullName || "Course Instructor"}</span>
              <span>·</span>
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
