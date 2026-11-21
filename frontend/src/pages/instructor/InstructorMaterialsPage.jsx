import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  FolderOpen,
  FileText,
  Video,
  Paperclip,
  Eye,
  Edit3,
  Trash2,
  Plus,
  Search,
  RotateCcw,
} from "lucide-react";
import { api } from "../../services/api";
import { Breadcrumb } from "../../components/ui/Breadcrumb";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorBanner } from "../../components/ui/ErrorBanner";
import { getCourseTheme } from "../../utils/courseThemes";
import { MaterialFormModal } from "./components/MaterialFormModal";
import { MaterialPreviewModal } from "./components/MaterialPreviewModal";
import { ConfirmDeleteModal } from "./components/ConfirmDeleteModal";
import { SuccessBanner } from "./components/SuccessBanner";
import { formatShortDate, formatFileSize } from "./components/formatters";

const MATERIAL_TABS = [
  { label: "All Types", value: "all" },
  { label: "Lecture Notes", value: "LectureNote" },
  { label: "Videos", value: "Video" },
  { label: "Attachments", value: "Attachment" },
];

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

export const InstructorMaterialsPage = () => {
  const { courseId: routeCourseId } = useParams();

  const [courses, setCourses] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  const [selectedCourse, setSelectedCourse] = useState(routeCourseId || "");
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [formModal, setFormModal] = useState({ open: false, material: null });
  const [previewMaterial, setPreviewMaterial] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    setSelectedCourse(routeCourseId || "");
  }, [routeCourseId]);

  const fetchCourses = useCallback(async () => {
    try {
      const res = await api.getInstructorCourses();
      if (res.status === "success") {
        setCourses(res.data);
      }
    } catch {
      // Handled gracefully
    }
  }, []);

  const fetchMaterials = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      const activeCourseId = routeCourseId || selectedCourse;
      if (activeCourseId) params.courseId = activeCourseId;
      if (typeFilter !== "all") params.type = typeFilter;
      if (searchQuery.trim()) params.q = searchQuery.trim();

      const res = await api.getInstructorMaterials(params);
      if (res.status === "success") {
        setMaterials(res.data);
      }
    } catch (err) {
      setError(err.message || "Failed to load learning materials.");
    } finally {
      setLoading(false);
    }
  }, [routeCourseId, selectedCourse, typeFilter, searchQuery]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  const handleSaveMaterial = async (payload, materialId) => {
    if (materialId) {
      const res = await api.updateMaterial(materialId, payload);
      setFeedback(res.message || "Material updated successfully.");
    } else {
      const res = await api.createMaterial(payload);
      setFeedback(res.message || "Material uploaded successfully.");
    }
    await fetchMaterials();
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteMaterial(deleteTarget._id);
      setFeedback(`Deleted "${deleteTarget.title}".`);
      setDeleteTarget(null);
      await fetchMaterials();
    } catch (err) {
      setError(err.message || "Failed to delete material.");
    } finally {
      setDeleting(false);
    }
  };

  const handleDownload = async (material) => {
    setDownloading(true);
    try {
      const blob = await api.downloadMaterialBlob(material._id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeTitle = (material.title || "material").replace(/[^a-zA-Z0-9_-]/g, "_");
      a.download = material.fileName || `${safeTitle}.txt`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError("Download failed: " + err.message);
    } finally {
      setDownloading(false);
    }
  };

  const resetFilters = () => {
    setTypeFilter("all");
    setSearchQuery("");
    if (!routeCourseId) setSelectedCourse("");
  };

  const activeCourseObj = courses.find((c) => c._id === (routeCourseId || selectedCourse));
  const hasFilters = Boolean(
    searchQuery.trim() || typeFilter !== "all" || (!routeCourseId && selectedCourse)
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <Breadcrumb
        items={
          routeCourseId
            ? [
                { label: "Dashboard", to: "/instructor/dashboard" },
                { label: "Assigned Courses", to: "/instructor/courses" },
                { label: activeCourseObj?.courseCode || "Course", to: `/instructor/courses/${routeCourseId}` },
                { label: "Learning Materials" },
              ]
            : [
                { label: "Dashboard", to: "/instructor/dashboard" },
                { label: "Learning Materials" },
              ]
        }
      />

      {/* Page Header */}
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
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "var(--color-text)", marginBottom: "4px" }}>
            Learning Materials
          </h1>
          <p style={{ fontSize: "14px", color: "var(--color-text-secondary)" }}>
            Upload, organize, edit, and remove lecture notes, video lessons, and lab attachments for your courses.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          icon={Plus}
          onClick={() => setFormModal({ open: true, material: null })}
        >
          Upload Material
        </Button>
      </div>

      <SuccessBanner message={feedback} onDismiss={() => setFeedback("")} />

      {/* Filter Bar */}
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
        {/* Type Tabs */}
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
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

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          {!routeCourseId && (
            <div style={{ width: "210px" }}>
              <Select
                aria-label="Filter by course"
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                style={{ height: "36px" }}
              >
                <option value="">All Courses</option>
                {courses.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.courseCode} — {c.courseName}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div style={{ width: "230px" }}>
            <Input
              icon={Search}
              placeholder="Search materials..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ height: "36px" }}
            />
          </div>

          {hasFilters && (
            <Button variant="secondary" size="sm" icon={RotateCcw} onClick={resetFilters}>
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Materials Table */}
      {loading ? (
        <LoadingSpinner message="Loading learning materials..." />
      ) : error ? (
        <ErrorBanner message={error} onRetry={fetchMaterials} />
      ) : materials.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title={hasFilters ? "No matching materials found" : "No learning materials uploaded yet"}
          description={
            hasFilters
              ? "No materials matched your selected course, category, or keyword."
              : "Upload lecture slides, videos, or lab sheets so enrolled students can access them."
          }
          actionLabel={hasFilters ? "Clear Filters" : "Upload Material"}
          onAction={hasFilters ? resetFilters : () => setFormModal({ open: true, material: null })}
        />
      ) : (
        <div
          style={{
            backgroundColor: "var(--color-surface)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--color-border)",
            overflowX: "auto",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr
                style={{
                  backgroundColor: "var(--color-surface-soft)",
                  borderBottom: "1px solid var(--color-border)",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "var(--color-text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                <th style={{ padding: "12px 18px" }}>Material Title</th>
                <th style={{ padding: "12px 16px" }}>Course</th>
                <th style={{ padding: "12px 16px" }}>Category</th>
                <th style={{ padding: "12px 16px" }}>Uploaded</th>
                <th style={{ padding: "12px 18px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((material, idx) => {
                const theme = getCourseTheme(material.courseId);
                return (
                  <tr
                    key={material._id}
                    className="lms-table-row"
                    style={{
                      borderBottom: idx === materials.length - 1 ? "none" : "1px solid var(--color-border-subtle)",
                    }}
                  >
                    <td style={{ padding: "14px 18px", maxWidth: "420px" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                        <div style={{ marginTop: "2px", flexShrink: 0 }}>
                          {getMaterialIcon(material.type)}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <button
                            type="button"
                            onClick={() => setPreviewMaterial(material)}
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "var(--color-text)",
                              fontWeight: 600,
                              fontSize: "14px",
                              textAlign: "left",
                              padding: 0,
                            }}
                          >
                            {material.title}
                          </button>
                          <p
                            style={{
                              fontSize: "12px",
                              color: "var(--color-text-secondary)",
                              marginTop: "2px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {material.description || "No description provided."}
                          </p>
                          {material.fileName && (
                            <span style={{ fontSize: "11px", color: "var(--color-primary-700)", fontWeight: 500 }}>
                              {material.fileName}
                              {material.fileSize ? ` (${formatFileSize(material.fileSize)})` : ""}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: 700,
                          color: theme.color,
                          backgroundColor: theme.colorLight,
                          padding: "2px 8px",
                          borderRadius: "4px",
                        }}
                      >
                        {material.courseId?.courseCode || "Course"}
                      </span>
                    </td>

                    <td style={{ padding: "14px 16px" }}>
                      <Badge variant={material.type} size="sm" />
                    </td>

                    <td className="tabular-nums" style={{ padding: "14px 16px", fontSize: "13px", color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>
                      {formatShortDate(material.uploadedAt)}
                    </td>

                    <td style={{ padding: "14px 18px" }}>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px" }}>
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
                          icon={Edit3}
                          onClick={() => setFormModal({ open: true, material })}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Trash2}
                          aria-label={`Delete ${material.title}`}
                          onClick={() => setDeleteTarget(material)}
                          style={{ color: "var(--color-danger)" }}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <MaterialFormModal
        isOpen={formModal.open}
        onClose={() => setFormModal({ open: false, material: null })}
        material={formModal.material}
        courses={courses}
        defaultCourseId={routeCourseId || selectedCourse}
        onSave={handleSaveMaterial}
      />

      <MaterialPreviewModal
        material={previewMaterial}
        onClose={() => setPreviewMaterial(null)}
        onDownload={handleDownload}
        downloading={downloading}
      />

      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Learning Material"
        itemName={deleteTarget?.title}
        warningText="Students enrolled in this course will no longer be able to view or download this resource."
        loading={deleting}
      />
    </div>
  );
};
