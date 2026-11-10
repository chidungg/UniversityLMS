import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  User,
  BookOpen,
} from "lucide-react";
import { api } from "../../../services/api";
import { Breadcrumb } from "../../../components/ui/Breadcrumb";
import { Button } from "../../../components/ui/Button";
import { LoadingSpinner } from "../../../components/ui/LoadingSpinner";
import { ErrorBanner } from "../../../components/ui/ErrorBanner";
import { getCourseTheme } from "../../../utils/courseThemes";

export const AnnouncementDetailsPage = () => {
  const { announcementId } = useParams();
  const [announcement, setAnnouncement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchAnnouncement = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.getAnnouncementDetails(announcementId);
      if (res.status === "success") {
        setAnnouncement(res.data);
      }
    } catch (err) {
      setError(err.message || "Failed to load announcement details.");
    } finally {
      setLoading(false);
    }
  }, [announcementId]);

  useEffect(() => {
    fetchAnnouncement();
  }, [fetchAnnouncement]);

  if (loading) {
    return <LoadingSpinner message="Loading announcement..." />;
  }

  if (error) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <Breadcrumb
          items={[
            { label: "Dashboard", to: "/student/dashboard" },
            { label: "Announcements", to: "/student/announcements" },
            { label: "Announcement Details" },
          ]}
        />
        <ErrorBanner message={error} onRetry={fetchAnnouncement} />
      </div>
    );
  }

  if (!announcement) return null;

  const pubDate = new Date(announcement.createdAt);
  const theme = getCourseTheme(announcement.courseId?.courseCode);
  const SubjectIcon = theme.icon;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <Breadcrumb
        items={[
          { label: "Dashboard", to: "/student/dashboard" },
          { label: "Announcements", to: "/student/announcements" },
          { label: announcement.title },
        ]}
      />

      <article
        className="lms-course-card"
        style={{
          backgroundColor: "var(--color-surface)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--color-border)",
          borderTop: `3px solid ${theme.color}`,
          padding: "32px 28px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        {/* Header Action Strip */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
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
                {announcement.courseId?.courseCode || "Course"} — {announcement.courseId?.courseName}
              </span>
            </div>
            <h1 style={{ fontSize: "24px", fontWeight: 700, color: "var(--color-text)", lineHeight: 1.3, letterSpacing: "-0.015em" }}>
              {announcement.title}
            </h1>
          </div>

          <Link to="/student/announcements">
            <Button variant="secondary" size="sm" icon={ArrowLeft}>
              Back to Announcements
            </Button>
          </Link>
        </div>

        {/* Metadata info strip */}
        <div
          className="tabular-nums"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            flexWrap: "wrap",
            padding: "12px 16px",
            backgroundColor: "var(--color-surface-soft)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--color-border-subtle)",
            fontSize: "13px",
            color: "var(--color-text-secondary)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <User size={15} style={{ color: "var(--color-text-muted)" }} />
            <span>
              Published by <strong>{announcement.author?.fullName || "Course Instructor"}</strong>
            </span>
          </div>

          <span>•</span>

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Calendar size={15} style={{ color: "var(--color-text-muted)" }} />
            <span>
              {pubDate.toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </div>

        {/* Announcement Body */}
        <div
          style={{
            fontSize: "15px",
            color: "var(--color-text)",
            lineHeight: 1.75,
            whiteSpace: "pre-wrap",
            maxWidth: "72ch",
            paddingTop: "8px",
          }}
        >
          {announcement.content}
        </div>

        {/* Bottom context navigation */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
            paddingTop: "20px",
            borderTop: "1px solid var(--color-border-subtle)",
            marginTop: "16px",
          }}
        >
          <Link to="/student/announcements">
            <Button variant="secondary" size="sm" icon={ArrowLeft}>
              All Announcements
            </Button>
          </Link>

          {announcement.courseId?._id && (
            <Link to={`/student/courses/${announcement.courseId._id}`}>
              <Button variant="primary" size="sm" icon={BookOpen}>
                Go to Course Workspace
              </Button>
            </Link>
          )}
        </div>
      </article>
    </div>
  );
};
