import { useState, useEffect, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Send, BookX } from "lucide-react";
import { api } from "../../../services/api";
import { Breadcrumb } from "../../../components/ui/Breadcrumb";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Textarea } from "../../../components/ui/Textarea";
import { LoadingSpinner } from "../../../components/ui/LoadingSpinner";
import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorBanner } from "../../../components/ui/ErrorBanner";
import { SuccessBanner } from "../components/SuccessBanner";

const MAX_TITLE_LENGTH = 200;
const MAX_CONTENT_LENGTH = 5000;

export const InstructorCreateAnnouncementPage = () => {
  const [searchParams] = useSearchParams();
  const requestedCourseId = searchParams.get("courseId") || "";

  const [courses, setCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [courseId, setCourseId] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [publishedAnnouncement, setPublishedAnnouncement] = useState(null);

  const loadAssignedCourses = useCallback(async () => {
    setLoadingCourses(true);
    setLoadError("");
    try {
      const res = await api.getInstructorCourses();
      if (res.status === "success") {
        const list = res.data || [];
        setCourses(list);

        const active = list.filter((c) => c.isActive !== false);
        const requestedActive = active.find((c) => String(c._id) === String(requestedCourseId));
        if (requestedActive) {
          setCourseId(requestedActive._id);
        } else if (active.length === 1) {
          setCourseId(active[0]._id);
        }
      }
    } catch (err) {
      setLoadError(err.message || "Failed to load your assigned courses.");
    } finally {
      setLoadingCourses(false);
    }
  }, [requestedCourseId]);

  useEffect(() => {
    loadAssignedCourses();
  }, [loadAssignedCourses]);

  const activeCourses = courses.filter((c) => c.isActive !== false);

  const validate = () => {
    const errors = {};
    const selectedCourse = courses.find((c) => String(c._id) === String(courseId));

    if (!courseId) {
      errors.courseId = "Please select an assigned course.";
    } else if (!selectedCourse || selectedCourse.isActive === false) {
      errors.courseId = "Announcements can only be published to an active assigned course.";
    }

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      errors.title = "Announcement title is required.";
    } else if (trimmedTitle.length > MAX_TITLE_LENGTH) {
      errors.title = `Announcement title cannot exceed ${MAX_TITLE_LENGTH} characters.`;
    }

    const trimmedContent = content.trim();
    if (!trimmedContent) {
      errors.content = "Announcement content cannot be empty.";
    } else if (trimmedContent.length > MAX_CONTENT_LENGTH) {
      errors.content = `Announcement content cannot exceed ${MAX_CONTENT_LENGTH} characters.`;
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitError("");
    setPublishedAnnouncement(null);

    if (!validate()) return;

    setSubmitting(true);
    try {
      const res = await api.publishInstructorAnnouncement({
        courseId,
        title: title.trim(),
        content: content.trim(),
      });

      if (res.status === "success") {
        setPublishedAnnouncement(res.data);
        setTitle("");
        setContent("");
        setFieldErrors({});
      }
    } catch (err) {
      setSubmitError(err.message || "Failed to publish announcement.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="lms-page" style={{ maxWidth: "760px" }}>
      <Breadcrumb
        items={[
          { label: "Dashboard", to: "/instructor/dashboard" },
          { label: "Announcements", to: "/instructor/announcements" },
          { label: "Create Announcement" },
        ]}
      />

      <div className="lms-page-header">
        <div className="lms-page-header-left">
          <h1>Create Course Announcement</h1>
        </div>

        <Link to="/instructor/announcements">
          <Button variant="secondary" size="sm" icon={ArrowLeft}>
            Back to Announcements
          </Button>
        </Link>
      </div>

      {loadingCourses ? (
        <LoadingSpinner message="Loading assigned courses..." />
      ) : loadError ? (
        <ErrorBanner message={loadError} onRetry={loadAssignedCourses} />
      ) : activeCourses.length === 0 ? (
        <EmptyState
          icon={BookX}
          title="No active courses available"
          description="You can only publish announcements for active courses assigned to you."
        />
      ) : (
        <section className="lms-panel lms-panel-pad lms-form-stack">
          {publishedAnnouncement && (
            <div className="lms-form-stack" style={{ gap: "10px" }}>
              <SuccessBanner
                message={`Announcement "${publishedAnnouncement.title}" published successfully to ${publishedAnnouncement.courseId?.courseCode || "course"}.`}
                onDismiss={() => setPublishedAnnouncement(null)}
              />
              <div className="lms-page-actions">
                <Link to={`/instructor/announcements/${publishedAnnouncement._id}`}>
                  <Button variant="primary" size="sm">
                    View Published Announcement
                  </Button>
                </Link>
                <Link to="/instructor/announcements">
                  <Button variant="secondary" size="sm">
                    Return to Announcements
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {submitError && <ErrorBanner message={submitError} />}

          <form onSubmit={handleSubmit} noValidate className="lms-form-stack">
            <Select
              id="announcement-course"
              label="Target Course"
              value={courseId}
              error={fieldErrors.courseId}
              onChange={(e) => {
                setCourseId(e.target.value);
                if (fieldErrors.courseId) setFieldErrors((prev) => ({ ...prev, courseId: "" }));
              }}
            >
              <option value="">-- Select an Active Course --</option>
              {courses.map((c) => (
                <option key={c._id} value={c._id} disabled={c.isActive === false}>
                  {c.courseCode} — {c.courseName}
                  {c.isActive === false ? " (Inactive)" : ""}
                </option>
              ))}
            </Select>

            <Input
              id="announcement-title"
              label="Announcement Title"
              placeholder="e.g., Week 05 Lab Room Change & Midterm Guidelines"
              value={title}
              error={fieldErrors.title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (fieldErrors.title) setFieldErrors((prev) => ({ ...prev, title: "" }));
              }}
              helperText={`${title.trim().length} / ${MAX_TITLE_LENGTH} characters`}
            />

            <Textarea
              id="announcement-content"
              label="Announcement Content"
              rows={7}
              placeholder="Write instructions, schedule updates, or examination details..."
              value={content}
              error={fieldErrors.content}
              onChange={(e) => {
                setContent(e.target.value);
                if (fieldErrors.content) setFieldErrors((prev) => ({ ...prev, content: "" }));
              }}
              helperText={`${content.trim().length} / ${MAX_CONTENT_LENGTH} characters`}
            />

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "8px",
                paddingTop: "10px",
                borderTop: "1px solid var(--color-border-subtle)",
              }}
            >
              <Link to="/instructor/announcements">
                <Button type="button" variant="secondary" size="md" disabled={submitting}>
                  Cancel
                </Button>
              </Link>
              <Button
                type="submit"
                variant="primary"
                size="md"
                icon={Send}
                loading={submitting}
                disabled={submitting}
              >
                Publish Announcement
              </Button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
};
