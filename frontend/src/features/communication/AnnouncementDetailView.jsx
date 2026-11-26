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
      <div className="lms-page">
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
    <div className="lms-page">
      <Breadcrumb items={[...breadcrumbs.slice(0, -1), { label: announcement.title }]} />

      <article className="lms-card lms-card-accent" style={{ gap: "18px", padding: "24px" }}>
        <div className="lms-card-head" style={{ alignItems: "flex-start" }}>
          <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span className="lms-course-code">
                <SubjectIcon size={13} aria-hidden="true" />
                {announcement.courseId?.courseCode || "Course"} — {announcement.courseId?.courseName}
              </span>
              {announcement.courseId?.isActive === false && <Badge variant="INACTIVE" size="sm" />}
            </div>
            <h1 style={{ margin: 0, wordBreak: "break-word" }}>{announcement.title}</h1>
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
          className="lms-info-box tabular-nums"
          style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap", padding: "10px 14px" }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <User size={14} aria-hidden="true" />
            <span>
              Published by <strong>{announcement.author?.fullName || "Course Instructor"}</strong>
            </span>
          </span>
          <span aria-hidden="true">·</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <Calendar size={14} aria-hidden="true" />
            <span>{formattedDate}</span>
          </span>
        </div>

        <div
          style={{
            fontSize: "15px",
            lineHeight: 1.75,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            maxWidth: "74ch",
          }}
        >
          {announcement.content}
        </div>

        {courseWorkspacePath && (
          <div className="lms-card-footer" style={{ justifyContent: "flex-end" }}>
            <Link to={courseWorkspacePath}>
              <Button variant="primary" size="sm" icon={BookOpen}>
                {courseWorkspaceLabel}
              </Button>
            </Link>
          </div>
        )}
      </article>
    </div>
  );
};
