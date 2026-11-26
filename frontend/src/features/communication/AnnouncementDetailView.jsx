import { Link } from "react-router-dom";
import { ArrowLeft, Calendar, User, BookOpen } from "lucide-react";
import { Breadcrumb } from "../../components/ui/Breadcrumb";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { ErrorBanner } from "../../components/ui/ErrorBanner";
import { getCourseTheme } from "../../utils/courseThemes";

export const AnnouncementDetailView = ({
  announcement,
  loading,
  error,
  onRetry,
  breadcrumbs,
  backTo,
  backLabel = "Back to Announcements",
  courseWorkspacePath,
  courseWorkspaceLabel = "Go to Course Workspace",
}) => {
  if (loading) {
    return <LoadingSpinner message="Loading announcement..." />;
  }

  if (error) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <Breadcrumb items={breadcrumbs} />
        <ErrorBanner message={error} onRetry={onRetry} />
        {backTo && (
          <div>
            <Link to={backTo}>
              <Button variant="secondary" size="sm" icon={ArrowLeft}>
                {backLabel}
              </Button>
            </Link>
          </div>
        )}
      </div>
    );
  }

  if (!announcement) return null;

  const pubDate = new Date(announcement.createdAt);
  const theme = getCourseTheme(announcement.courseId?.courseCode);
  const SubjectIcon = theme.icon;
  const formattedDate = Number.isFinite(pubDate.getTime())
    ? new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(pubDate)
    : "Unknown date";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <Breadcrumb items={[...breadcrumbs.slice(0, -1), { label: announcement.title }]} />

      <article
        className="lms-course-card"
        style={{
          backgroundColor: "var(--color-surface)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--color-border)",
          borderTop: `3px solid ${theme.color}`,
          padding: "28px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
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
                <SubjectIcon size={13} aria-hidden="true" />
                {announcement.courseId?.courseCode || "Course"} — {announcement.courseId?.courseName}
              </span>
              {announcement.courseId?.isActive === false && (
                <Badge variant="INACTIVE" size="sm" />
              )}
            </div>
            <h1
              style={{
                fontSize: "24px",
                fontWeight: 700,
                color: "var(--color-text)",
                lineHeight: 1.3,
                letterSpacing: "-0.015em",
                margin: 0,
                wordBreak: "break-word",
              }}
            >
              {announcement.title}
            </h1>
          </div>

          {backTo && (
            <Link to={backTo}>
              <Button variant="secondary" size="sm" icon={ArrowLeft}>
                {backLabel}
              </Button>
            </Link>
          )}
        </div>

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
            <User size={15} style={{ color: "var(--color-text-muted)" }} aria-hidden="true" />
            <span>
              Published by <strong>{announcement.author?.fullName || "Course Instructor"}</strong>
            </span>
          </div>

          <span aria-hidden="true">•</span>

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Calendar size={15} style={{ color: "var(--color-text-muted)" }} aria-hidden="true" />
            <span>{formattedDate}</span>
          </div>
        </div>

        <div
          style={{
            fontSize: "15px",
            color: "var(--color-text)",
            lineHeight: 1.75,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            maxWidth: "72ch",
            paddingTop: "8px",
          }}
        >
          {announcement.content}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
            paddingTop: "20px",
            borderTop: "1px solid var(--color-border-subtle)",
            marginTop: "8px",
          }}
        >
          {backTo && (
            <Link to={backTo}>
              <Button variant="secondary" size="sm" icon={ArrowLeft}>
                All Announcements
              </Button>
            </Link>
          )}

          {courseWorkspacePath && (
            <Link to={courseWorkspacePath}>
              <Button variant="primary" size="sm" icon={BookOpen}>
                {courseWorkspaceLabel}
              </Button>
            </Link>
          )}
        </div>
      </article>
    </div>
  );
};
