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
      return <FileText size={16} aria-hidden="true" />;
    case "Video":
      return <Video size={16} aria-hidden="true" />;
    case "Attachment":
      return <Paperclip size={16} aria-hidden="true" />;
    default:
      return <FolderOpen size={16} aria-hidden="true" />;
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
    <div className="lms-page">
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

      <div className="lms-page-header">
        <div className="lms-page-header-left">
          <div className="lms-page-title-row">
            <h1>Learning Materials</h1>
            {!loading && !error && <span className="lms-count-tag">{materials.length}</span>}
          </div>
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

      <div className="lms-toolbar">
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

        <div className="lms-toolbar-controls">
          {!routeCourseId && (
            <div style={{ width: "200px" }}>
              <Select
                aria-label="Filter by course"
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
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

          <div style={{ width: "220px" }}>
            <Input
              icon={Search}
              aria-label="Search materials"
              placeholder="Search materials..."
              value={searchQuery}
              maxLength={200}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {hasFilters && (
            <Button variant="secondary" size="sm" icon={RotateCcw} onClick={resetFilters}>
              Reset
            </Button>
          )}
        </div>
      </div>

      {byWeek && !loading && !error && canUpload && !q && typeFilter === "all" &&
        !materials.some((material) => getMaterialWeek(material.title) !== null) && (
        <section className="material-week-start">
          <div>
            <h2>Organize by teaching week</h2>
            <p>
              {materials.length
                ? "Edit a material below to assign a teaching week, or upload to Week 01."
                : "Upload a material and set its teaching week."}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            icon={Plus}
            onClick={() => setFormModal({ open: true, material: null, week: "1" })}
          >
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
          title={
            courses.length === 0
              ? "No courses assigned"
              : hasFilters
                ? "No matching materials found"
                : "No learning materials uploaded yet"
          }
          description={
            courses.length === 0
              ? "New materials can be uploaded to an assigned course."
              : hasFilters
                ? "No materials matched your selected filters."
                : undefined
          }
          actionLabel={hasFilters ? "Clear Filters" : canUpload ? "Upload Material" : undefined}
          onAction={hasFilters ? resetFilters : canUpload ? openNewMaterial : undefined}
        />
      ) : (
        <WeekList items={materials} byWeek={byWeek} expandAll={Boolean(q) || typeFilter !== "all"}>
          {(items) => (
            <div className="lms-table-wrap">
              <table className="lms-table">
                <thead>
                  <tr>
                    <th>Material Title</th>
                    {!routeCourseId && <th>Course</th>}
                    <th>Category</th>
                    <th>Uploaded</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((material) => (
                    <tr key={material._id}>
                      <td style={{ maxWidth: "420px" }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                          <span style={{ marginTop: "2px", flexShrink: 0 }}>
                            {getMaterialIcon(material.type)}
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <button
                              type="button"
                              className="lms-title-btn"
                              onClick={() => showPreview(material)}
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
                            {material.fileName && (
                              <span style={{ fontSize: "12px", fontWeight: 500, display: "block", marginTop: "2px" }}>
                                {material.fileName}
                                {material.fileSize ? ` (${formatFileSize(material.fileSize)})` : ""}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {!routeCourseId && (
                        <td style={{ whiteSpace: "nowrap" }}>
                          <span className="lms-course-code">
                            {material.courseId?.courseCode || "Course"}
                          </span>
                        </td>
                      )}

                      <td>
                        <Badge variant={material.type} size="sm" />
                      </td>

                      <td className="tabular-nums" style={{ whiteSpace: "nowrap", fontSize: "13px" }}>
                        {formatShortDate(material.uploadedAt)}
                      </td>

                      <td style={{ textAlign: "right" }}>
                        <div className="lms-row-actions">
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
                            variant="danger"
                            size="sm"
                            icon={Trash2}
                            aria-label={`Delete ${material.title}`}
                            disabled={material.courseId?.isActive === false}
                            onClick={() => {
                              setDeleteError("");
                              setDeleteTarget(material);
                            }}
                          >
                            Delete
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
