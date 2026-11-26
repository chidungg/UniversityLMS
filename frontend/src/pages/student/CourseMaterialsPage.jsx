import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  FolderOpen,
  FileText,
  Video,
  Paperclip,
  Download,
  Eye,
  Search,
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
import { WeekList, WeekViewToggle } from "../../components/materials/MaterialList";
import { getCourseTheme } from "../../utils/courseThemes";
import { openMaterialResource } from "../../utils/materialDownloads";
import { getMaterialWeek } from "../../utils/materialWeeks";

const MATERIAL_TABS = [
  { label: "All Types", value: "all" },
  { label: "Lecture Notes", value: "LectureNote" },
  { label: "Videos", value: "Video" },
  { label: "Attachments", value: "Attachment" },
];

const getMaterialIcon = (type) => {
  switch (type) {
    case "LectureNote":
      return <FileText size={16} aria-hidden="true" />;
    case "Video":
      return <Video size={16} aria-hidden="true" />;
    case "Attachment":
      return <Paperclip size={16} aria-hidden="true" />;
    default:
      return <FolderOpen size={16} aria-hidden="true" />;
  }
};

export const CourseMaterialsPage = () => {
  const { courseId } = useParams();
  const [result, setResult] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [view, setView] = useState(null);

  const [previewMaterial, setPreviewMaterial] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadError, setDownloadError] = useState("");

  useEffect(() => {
    let ignore = false;
    api.getMaterials(courseId)
      .then(({ course, data }) => {
        if (!ignore) setResult({ courseId, attempt, course, materials: data });
      })
      .catch((error) => {
        if (!ignore) setResult({ courseId, attempt, error });
      });
    return () => { ignore = true; };
  }, [courseId, attempt]);

  const handleDownload = async (material) => {
    setDownloadingId(material._id);
    setDownloadError("");
    try {
      await openMaterialResource(material, api.downloadMaterialBlob);
    } catch (err) {
      setDownloadError("Download failed: " + err.message);
    } finally {
      setDownloadingId(null);
    }
  };

  const currentResult = result?.courseId === courseId && result?.attempt === attempt ? result : null;
  const { course, materials = [], error } = currentResult ?? {};
  const byWeek = view && view.courseId === courseId
    ? view.byWeek
    : materials.some((material) => getMaterialWeek(material.title) !== null);
  const searchTerm = searchQuery.trim().toLowerCase();
  const hasFilters = Boolean(searchTerm) || typeFilter !== "all";
  const filteredMaterials = materials.filter((material) => {
    if (typeFilter !== "all" && material.type !== typeFilter) return false;
    if (!searchTerm) return true;
    return (
      material.title.toLowerCase().includes(searchTerm) ||
      material.description?.toLowerCase().includes(searchTerm)
    );
  });
  const resetFilters = () => {
    setSearchQuery("");
    setTypeFilter("all");
  };

  const theme = getCourseTheme(course?.courseCode);
  const SubjectIcon = theme.icon;

  return (
    <div className="lms-page">
      <Breadcrumb
        items={[
          { label: "Dashboard", to: "/student/dashboard" },
          { label: "My Courses", to: "/student/courses" },
          { label: course?.courseCode || "Course", to: `/student/courses/${courseId}` },
          { label: "Learning Materials" },
        ]}
      />

      <div className="lms-page-header">
        <div className="lms-page-header-left">
          <div className="lms-page-title-row">
            {course && (
              <span className="lms-course-code">
                <SubjectIcon size={13} aria-hidden="true" />
                {course.courseCode}
              </span>
            )}
            <h1>Learning Materials</h1>
          </div>
        </div>

        <div className="lms-toolbar-group">
          {MATERIAL_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              className={`lms-pill-tab ${typeFilter === tab.value ? "active" : ""}`}
              onClick={() => setTypeFilter(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {downloadError && (
        <ErrorBanner message={downloadError} onRetry={() => setDownloadError("")} />
      )}

      <div className="lms-toolbar">
        <div style={{ flex: 1, minWidth: "min(240px, 100%)", maxWidth: "460px" }}>
          <Input
            icon={Search}
            aria-label="Search within course materials"
            placeholder="Search within course materials..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="lms-toolbar-controls">
          {materials.length > 0 && (
            <WeekViewToggle
              byWeek={byWeek}
              onChange={(nextByWeek) => setView({ courseId, byWeek: nextByWeek })}
            />
          )}

          {hasFilters && (
            <Button variant="secondary" size="sm" icon={RotateCcw} onClick={resetFilters}>
              Reset Filters
            </Button>
          )}
        </div>
      </div>

      {!currentResult ? (
        <LoadingSpinner message="Loading course materials..." />
      ) : error ? (
        <ErrorBanner
          message={error.message || "Failed to load learning materials."}
          onRetry={() => setAttempt((current) => current + 1)}
        />
      ) : filteredMaterials.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title={hasFilters ? "No matching materials found" : "No learning materials available yet"}
          description={
            hasFilters
              ? "No materials matched your filter query."
              : "The instructor has not uploaded materials for this course yet."
          }
          actionLabel={hasFilters ? "Clear Filters" : undefined}
          onAction={hasFilters ? resetFilters : undefined}
        />
      ) : (
        <WeekList
          key={JSON.stringify([courseId, typeFilter, searchTerm])}
          items={filteredMaterials}
          byWeek={byWeek}
          expandAll={hasFilters}
        >
          {(items) => (
            <div className="lms-table-wrap">
              <table className="lms-table">
                <thead>
                  <tr>
                    <th>Material Title</th>
                    <th>Category</th>
                    <th>Uploaded Date</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((material) => (
                    <tr key={material._id}>
                      <td style={{ maxWidth: "440px" }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                          <span style={{ marginTop: "2px", flexShrink: 0 }}>
                            {getMaterialIcon(material.type)}
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <button
                              type="button"
                              className="lms-title-btn"
                              onClick={() => setPreviewMaterial(material)}
                            >
                              {material.title}
                            </button>
                            {material.description && (
                              <p
                                style={{
                                  fontSize: "12px",
                                  margin: "2px 0 0",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {material.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td>
                        <Badge variant={material.type} size="sm" />
                      </td>

                      <td className="tabular-nums" style={{ whiteSpace: "nowrap", fontSize: "13px" }}>
                        {new Date(material.uploadedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>

                      <td style={{ textAlign: "right" }}>
                        <div className="lms-row-actions">
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </WeekList>
      )}

      {previewMaterial && (
        <Modal
          isOpen={Boolean(previewMaterial)}
          onClose={() => setPreviewMaterial(null)}
          title={previewMaterial.title}
          maxWidth="600px"
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
          <div className="lms-form-stack">
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <Badge variant={previewMaterial.type} size="sm" />
              <span className="tabular-nums" style={{ fontSize: "13px" }}>
                Uploaded on{" "}
                {new Date(previewMaterial.uploadedAt).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>

            {previewMaterial.description && (
              <div className="lms-info-box">
                <h4 style={{ fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>
                  Summary &amp; Learning Content
                </h4>
                <p style={{ fontSize: "14px", lineHeight: 1.6, whiteSpace: "pre-wrap", margin: 0 }}>
                  {previewMaterial.description}
                </p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
