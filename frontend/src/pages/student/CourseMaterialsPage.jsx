import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  FolderOpen,
  FileText,
  Video,
  Paperclip,
  Download,
  Eye,
  Search,
  FileCheck,
  RotateCcw,
} from "lucide-react";
import { api } from "../../services/api";
import { Breadcrumb } from "../../components/ui/Breadcrumb";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorBanner } from "../../components/ui/ErrorBanner";
import { getCourseTheme } from "../../utils/courseThemes";

const MATERIAL_TABS = [
  { label: "All Types", value: "all" },
  { label: "Lecture Notes", value: "LectureNote" },
  { label: "Videos", value: "Video" },
  { label: "Attachments", value: "Attachment" },
];

export const CourseMaterialsPage = () => {
  const { courseId } = useParams();
  const [course, setCourse] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal preview state (ST04)
  const [previewMaterial, setPreviewMaterial] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadError, setDownloadError] = useState("");

  const fetchMaterials = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (typeFilter !== "all") params.type = typeFilter;
      const res = await api.getMaterials(courseId, params);
      if (res.status === "success") {
        setCourse(res.course);
        setMaterials(res.data);
      }
    } catch (err) {
      setError(err.message || "Failed to load learning materials.");
    } finally {
      setLoading(false);
    }
  }, [courseId, typeFilter]);

  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  const handleDownload = async (material) => {
    setDownloadingId(material._id);
    setDownloadError("");
    try {
      const blob = await api.downloadMaterialBlob(material._id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeTitle = (material.title || "material").replace(/[^a-zA-Z0-9_-]/g, "_");
      a.download = `${safeTitle}.txt`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setDownloadError("Download failed: " + err.message);
    } finally {
      setDownloadingId(null);
    }
  };

  const filteredMaterials = materials.filter((m) => {
    if (!searchQuery.trim()) return true;
    const term = searchQuery.toLowerCase();
    return (
      m.title.toLowerCase().includes(term) ||
      (m.description && m.description.toLowerCase().includes(term))
    );
  });

  const getMaterialIcon = (type) => {
    switch (type) {
      case "LectureNote":
        return <FileText size={18} style={{ color: "var(--color-primary-700)" }} />;
      case "Video":
        return <Video size={18} style={{ color: "#7C3AED" }} />;
      case "Attachment":
        return <Paperclip size={18} style={{ color: "var(--color-success)" }} />;
      default:
        return <FolderOpen size={18} />;
    }
  };

  const theme = getCourseTheme(course?.courseCode);
  const SubjectIcon = theme.icon;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <Breadcrumb
        items={[
          { label: "Dashboard", to: "/student/dashboard" },
          { label: "My Courses", to: "/student/courses" },
          { label: course?.courseCode || "Course", to: `/student/courses/${courseId}` },
          { label: "Learning Materials" },
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
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            {course && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: theme.badgeColor,
                  backgroundColor: theme.badgeBg,
                  border: `1px solid ${theme.border}`,
                  padding: "2px 8px",
                  borderRadius: "4px",
                }}
              >
                <SubjectIcon size={12} />
                {course.courseCode}
              </span>
            )}
            <h1 style={{ fontSize: "22px", fontWeight: 700, color: "var(--color-text)", margin: 0 }}>
              Learning Materials
            </h1>
          </div>
          <p style={{ fontSize: "14px", color: "var(--color-text-secondary)" }}>
            Access lecture slides, reading materials, lab instructions, and recorded lessons for {course?.courseName || "this course"}.
          </p>
        </div>

        {/* Type Pill Tabs */}
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {MATERIAL_TABS.map((tab) => {
            const active = typeFilter === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                className={`lms-pill-tab ${active ? "active" : ""}`}
                onClick={() => setTypeFilter(tab.value)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {downloadError && (
        <ErrorBanner message={downloadError} onRetry={() => setDownloadError("")} />
      )}

      {/* Filter and Search Bar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          backgroundColor: "var(--color-surface)",
          padding: "14px 16px",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--color-border)",
        }}
      >
        <div style={{ flex: 1, minWidth: "260px" }}>
          <Input
            icon={Search}
            placeholder="Search within course materials..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {(searchQuery || typeFilter !== "all") && (
          <Button
            variant="secondary"
            size="md"
            icon={RotateCcw}
            onClick={() => {
              setSearchQuery("");
              setTypeFilter("all");
            }}
          >
            Reset Filters
          </Button>
        )}
      </div>

      {/* Content Area */}
      {loading ? (
        <LoadingSpinner message="Loading course materials..." />
      ) : error ? (
        <ErrorBanner message={error} onRetry={fetchMaterials} />
      ) : filteredMaterials.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title={searchQuery ? "No matching materials found" : "No learning materials available yet"}
          description={
            searchQuery
              ? "No materials matched your filter query. Try another keyword or clear the filter."
              : "The instructor has not uploaded materials for this course yet."
          }
          actionLabel={searchQuery ? "Clear Search" : undefined}
          onAction={() => setSearchQuery("")}
        />
      ) : (
        <div
          style={{
            backgroundColor: "var(--color-surface)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--color-border)",
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)",
          }}
        >
          <div
            style={{
              padding: "12px 20px",
              backgroundColor: "var(--color-surface-soft)",
              borderBottom: "1px solid var(--color-border)",
              display: "grid",
              gridTemplateColumns: "minmax(240px, 2fr) 140px 140px 180px",
              gap: "12px",
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--color-text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
            className="materials-table-header"
          >
            <span>Material Title</span>
            <span>Category</span>
            <span>Uploaded Date</span>
            <span style={{ textAlign: "right" }}>Actions</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            {filteredMaterials.map((material, index) => (
              <div
                key={material._id}
                className="materials-table-row lms-table-row"
                style={{
                  padding: "14px 20px",
                  borderBottom:
                    index === filteredMaterials.length - 1 ? "none" : "1px solid var(--color-border-subtle)",
                  display: "grid",
                  gridTemplateColumns: "minmax(240px, 2fr) 140px 140px 180px",
                  gap: "12px",
                  alignItems: "center",
                }}
              >
                {/* Title & Description Snippet */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                  <div style={{ marginTop: "2px", flexShrink: 0 }}>
                    {getMaterialIcon(material.type)}
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => setPreviewMaterial(material)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "var(--color-text)",
                        fontWeight: 600,
                        fontSize: "14px",
                        cursor: "pointer",
                        textAlign: "left",
                        padding: 0,
                      }}
                      onMouseEnter={(e) => (e.target.style.color = "var(--color-primary-700)")}
                      onMouseLeave={(e) => (e.target.style.color = "var(--color-text)")}
                    >
                      {material.title}
                    </button>
                    <p
                      style={{
                        fontSize: "12px",
                        color: "var(--color-text-secondary)",
                        marginTop: "2px",
                        display: "-webkit-box",
                        WebkitLineClamp: 1,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        margin: 0,
                      }}
                    >
                      {material.description || "No description provided."}
                    </p>
                  </div>
                </div>

                {/* Type */}
                <div>
                  <Badge variant={material.type} size="sm" />
                </div>

                {/* Date */}
                <div className="tabular-nums" style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>
                  {new Date(material.uploadedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </div>

                {/* Actions */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={Eye}
                    onClick={() => setPreviewMaterial(material)}
                  >
                    Preview
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={Download}
                    loading={downloadingId === material._id}
                    onClick={() => handleDownload(material)}
                  >
                    Download
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ST04: Material Preview Modal */}
      {previewMaterial && (
        <Modal
          isOpen={!!previewMaterial}
          onClose={() => setPreviewMaterial(null)}
          title={previewMaterial.title}
          maxWidth="640px"
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setPreviewMaterial(null)}>
                Close
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={Download}
                loading={downloadingId === previewMaterial._id}
                onClick={() => handleDownload(previewMaterial)}
              >
                Download Material
              </Button>
            </>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <Badge variant={previewMaterial.type} />
              <span style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>
                Uploaded on{" "}
                {new Date(previewMaterial.uploadedAt).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>

            <div
              style={{
                backgroundColor: "var(--color-surface-soft)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-border)",
                padding: "16px",
              }}
            >
              <h4 style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text)", marginBottom: "8px" }}>
                Summary & Learning Content:
              </h4>
              <p style={{ fontSize: "14px", color: "var(--color-text)", lineHeight: 1.6, whiteSpace: "pre-wrap", margin: 0 }}>
                {previewMaterial.description || "No full text description has been attached for this learning resource."}
              </p>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "12px",
                borderRadius: "var(--radius-sm)",
                backgroundColor: "var(--color-primary-100)",
                color: "var(--color-primary-700)",
                fontSize: "13px",
              }}
            >
              <FileCheck size={18} style={{ flexShrink: 0 }} />
              <span>
                You can download the full study document directly to your device for offline reading.
              </span>
            </div>
          </div>
        </Modal>
      )}

      <style>{`
        @media (max-width: 768px) {
          .materials-table-header {
            display: none !important;
          }
          .materials-table-row {
            display: flex !important;
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 10px !important;
          }
          .materials-table-row > div:last-child {
            width: 100%;
            justify-content: flex-start !important;
          }
        }
      `}</style>
    </div>
  );
};
