import { useState, useEffect } from "react";
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
import { WeekList, WeekViewToggle } from "../../components/materials/MaterialList";
import { getMaterialWeek } from "../../utils/materialWeeks";
import { getCourseTheme } from "../../utils/courseThemes";
import { openMaterialResource } from "../../utils/materialDownloads";
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

  const [courseResult, setCourseResult] = useState(null);
  const [listResult, setListResult] = useState(null);
  const [courseAttempt, setCourseAttempt] = useState(0);
  const [listAttempt, setListAttempt] = useState(0);
  const [feedback, setFeedback] = useState("");

  const [selectedCourse, setSelectedCourse] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [byWeek, setByWeek] = useState(false);
  const courseId = routeCourseId || selectedCourse;
  const q = searchQuery.trim();
  const queryKey = JSON.stringify([courseId, typeFilter, q, listAttempt]);

  const [formModal, setFormModal] = useState({ open: false, material: null });
  const [previewMaterial, setPreviewMaterial] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [downloadError, setDownloadError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    api.getInstructorCourses({}, { signal: controller.signal })
      .then(({ data }) => {
        if (!controller.signal.aborted) setCourseResult({ courseAttempt, courses: data });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setCourseResult({ courseAttempt, error });
      });
    return () => controller.abort();
  }, [courseAttempt]);

  useEffect(() => {
    const controller = new AbortController();
    const params = {};
    if (courseId) params.courseId = courseId;
    if (typeFilter !== "all") params.type = typeFilter;
    if (q) params.q = q;

    api.getInstructorMaterials(params, { signal: controller.signal })
      .then(({ data }) => {
        if (!controller.signal.aborted) setListResult({ queryKey, materials: data });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setListResult({ queryKey, error });
      });
    return () => controller.abort();
  }, [courseId, q, queryKey, typeFilter]);

  const refreshList = () => setListAttempt((current) => current + 1);

  const handleSaveMaterial = async (payload, materialId) => {
    const result = materialId
      ? await api.updateMaterial(materialId, payload)
      : await api.createMaterial(payload);
    setFeedback(result.message);
    refreshList();
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await api.deleteMaterial(deleteTarget._id);
      setFeedback(`Deleted "${deleteTarget.title}".`);
      setDeleteTarget(null);
      refreshList();
    } catch (error) {
      setDeleteError(error.message || "Failed to delete material.");
    } finally {
      setDeleting(false);
    }
  };

  const showPreview = (material) => {
    setDownloadError("");
    setPreviewMaterial(material);
  };

  const handleDownload = async (material) => {
    setDownloading(true);
    setDownloadError("");
    try {
      await openMaterialResource(material, api.downloadInstructorMaterialBlob);
    } catch (error) {
      setDownloadError(error.message || "Failed to download material.");
    } finally {
      setDownloading(false);
    }
  };

  const resetFilters = () => {
    setTypeFilter("all");
    setSearchQuery("");
    if (!routeCourseId) setSelectedCourse("");
  };

  const currentCourses = courseResult?.courseAttempt === courseAttempt ? courseResult : null;
  const currentList = listResult?.queryKey === queryKey ? listResult : null;
  const courses = currentCourses?.courses ?? [];
  const materials = currentList?.materials ?? [];
  const loading = !currentCourses || !currentList;
  const error = currentCourses?.error || currentList?.error;
  const activeCourseObj = courses.find((course) => course._id === courseId);
  const activeCourses = courses.filter((course) => course.isActive !== false);
  const canUpload = courseId
    ? Boolean(activeCourseObj && activeCourseObj.isActive !== false)
    : activeCourses.length > 0;
  const openNewMaterial = () => setFormModal({ open: true, material: null });
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
          onClick={openNewMaterial}
          disabled={!canUpload}
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

          <WeekViewToggle byWeek={byWeek} onChange={setByWeek} />

          <div style={{ width: "230px" }}>
            <Input
              icon={Search}
              aria-label="Search materials"
              placeholder="Search materials..."
              value={searchQuery}
              maxLength={200}
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
      {byWeek && !loading && !error && canUpload && !q && typeFilter === "all" &&
        !materials.some((material) => getMaterialWeek(material.title) !== null) && (
        <section className="material-week-start">
          <div>
            <h2>Organize by teaching week</h2>
            <p>{materials.length
              ? "Choose Edit on a material below and enter its teaching week, or upload the first material for Week 01."
              : "Upload a material and choose the week students will study it."}</p>
          </div>
          <Button size="sm" variant="outline" icon={Plus} onClick={() => setFormModal({ open: true, material: null, week: "1" })}>
            Upload to Week 01
          </Button>
        </section>
      )}
      {error ? (
        <ErrorBanner
          message={error.message || "Failed to load learning materials."}
          onRetry={() => {
            if (currentCourses?.error) setCourseAttempt((current) => current + 1);
            refreshList();
          }}
        />
      ) : loading ? (
        <LoadingSpinner message="Loading learning materials..." />
      ) : materials.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title={courses.length === 0
            ? "No courses assigned"
            : hasFilters ? "No matching materials found" : "No learning materials uploaded yet"}
          description={
            courses.length === 0
              ? "New materials can be uploaded to an assigned course."
              : hasFilters ? "No materials matched your selected filters." : undefined
          }
          actionLabel={hasFilters ? "Clear Filters" : canUpload ? "Upload Material" : undefined}
          onAction={hasFilters ? resetFilters : canUpload ? openNewMaterial : undefined}
        />
      ) : (
        <WeekList items={materials} byWeek={byWeek} expandAll={Boolean(q) || typeFilter !== "all"}>
          {(items) => (
            <div className="material-list-table" style={{ overflowX: "auto" }}>
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
                  {items.map((material, idx) => {
                    const theme = getCourseTheme(material.courseId);
                    return (
                      <tr
                        key={material._id}
                        className="lms-table-row"
                        style={{
                          borderBottom: idx === items.length - 1 ? "none" : "1px solid var(--color-border-subtle)",
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
                                onClick={() => showPreview(material)}
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
                              onClick={() => showPreview(material)}
                            >
                              Preview
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              icon={Edit3}
                              disabled={material.courseId?.isActive === false}
                              onClick={() => setFormModal({ open: true, material })}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={Trash2}
                              aria-label={`Delete ${material.title}`}
                              disabled={material.courseId?.isActive === false}
                              onClick={() => {
                                setDeleteError("");
                                setDeleteTarget(material);
                              }}
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
        </WeekList>
      )}

      {formModal.open && (
        <MaterialFormModal
          onClose={() => setFormModal({ open: false, material: null })}
          material={formModal.material}
          courses={activeCourses}
          defaultCourseId={courseId}
          defaultWeek={formModal.week}
          lockCourse={Boolean(routeCourseId)}
          onSave={handleSaveMaterial}
        />
      )}

      <MaterialPreviewModal
        material={previewMaterial}
        onClose={() => { if (!downloading) setPreviewMaterial(null); }}
        onDownload={handleDownload}
        downloading={downloading}
        error={downloadError}
      />

      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Learning Material"
        itemName={deleteTarget?.title}
        warningText="Students enrolled in this course will no longer be able to view or download this resource."
        loading={deleting}
        error={deleteError}
      />
    </div>
  );
};
