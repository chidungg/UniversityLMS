import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../../services/api";
import { AnnouncementDetailView } from "../../../features/communication/AnnouncementDetailView";

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

  return (
    <AnnouncementDetailView
      announcement={announcement}
      loading={loading}
      error={error}
      onRetry={fetchAnnouncement}
      breadcrumbs={[
        { label: "Dashboard", to: "/student/dashboard" },
        { label: "Announcements", to: "/student/announcements" },
        { label: "Announcement Details" },
      ]}
      backTo="/student/announcements"
      backLabel="Back to Announcements"
      courseWorkspacePath={
        announcement?.courseId?._id ? `/student/courses/${announcement.courseId._id}` : undefined
      }
      courseWorkspaceLabel="Go to Course Workspace"
    />
  );
};
