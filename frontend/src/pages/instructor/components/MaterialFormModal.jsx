import { useState, useEffect } from "react";
import { Upload, FileText, X } from "lucide-react";
import { Modal } from "../../../components/ui/Modal";
import { Input } from "../../../components/ui/Input";
import { Textarea } from "../../../components/ui/Textarea";
import { Select } from "../../../components/ui/Select";
import { Button } from "../../../components/ui/Button";
import { ErrorBanner } from "../../../components/ui/ErrorBanner";
import { formatFileSize } from "./formatters";

const MATERIAL_TYPES = [
  { value: "LectureNote", label: "Lecture Note (Slides / PDF)" },
  { value: "Video", label: "Video Lesson" },
  { value: "Attachment", label: "Attachment / Lab Exercise" },
];

export const MaterialFormModal = ({
  isOpen,
  onClose,
  material,
  courses = [],
  defaultCourseId = "",
  onSave,
}) => {
  const isEditing = Boolean(material?._id);

  const [courseId, setCourseId] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState("LectureNote");
  const [description, setDescription] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (material) {
      setCourseId(material.courseId?._id || material.courseId || defaultCourseId || "");
      setTitle(material.title || "");
      setType(material.type || "LectureNote");
      setDescription(material.description || "");
      setFileUrl(material.fileUrl || "");
      setFileName(material.fileName || "");
      setFileSize(material.fileSize || null);
    } else {
      setCourseId(defaultCourseId || courses[0]?._id || "");
      setTitle("");
      setType("LectureNote");
      setDescription("");
      setFileUrl("");
      setFileName("");
      setFileSize(null);
    }
    setErrors({});
    setSubmitError("");
  }, [isOpen, material, courses, defaultCourseId]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, file: "File size exceeds 50 MB limit." }));
      return;
    }
    setFileName(file.name);
    setFileSize(file.size);
    setFileUrl(`/uploads/materials/${encodeURIComponent(file.name)}`);
    setErrors((prev) => ({ ...prev, file: "" }));
    if (!title.trim()) {
      setTitle(file.name.replace(/\.[^/.]+$/, ""));
    }
  };

  const validate = () => {
    const next = {};
    if (!courseId) next.courseId = "Select a course.";
    if (!title.trim()) next.title = "Material title is required.";
    if (!type) next.type = "Select a category.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    setSubmitError("");
    try {
      await onSave(
        {
          courseId,
          title: title.trim(),
          type,
          description: description.trim(),
          fileName: fileName || null,
          fileSize: fileSize || null,
          fileUrl: fileUrl.trim() || null,
        },
        material?._id
      );
      onClose();
    } catch (err) {
      setSubmitError(err.message || "Failed to save learning material.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Edit Learning Material" : "Upload Learning Material"}
      maxWidth="580px"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="material-form" variant="primary" size="sm" loading={saving}>
            {isEditing ? "Save Changes" : "Upload Material"}
          </Button>
        </>
      }
    >
      <form
        id="material-form"
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "16px" }}
      >
        {submitError && <ErrorBanner message={submitError} />}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <Select
            label="Course *"
            value={courseId}
            disabled={Boolean(defaultCourseId) && !isEditing}
            onChange={(e) => {
              setCourseId(e.target.value);
              if (errors.courseId) setErrors((prev) => ({ ...prev, courseId: "" }));
            }}
            error={errors.courseId}
          >
            <option value="">Select course...</option>
            {courses.map((c) => (
              <option key={c._id} value={c._id}>
                {c.courseCode} — {c.courseName}
              </option>
            ))}
          </Select>

          <Select
            label="Category *"
            value={type}
            onChange={(e) => setType(e.target.value)}
            options={MATERIAL_TYPES}
            error={errors.type}
          />
        </div>

        <Input
          label="Material Title *"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (errors.title) setErrors((prev) => ({ ...prev, title: "" }));
          }}
          error={errors.title}
          placeholder="e.g. Lecture 04 — Relational Algebra & Normalization"
        />

        <Textarea
          label="Description & Study Notes"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Summarize key concepts, reading instructions, or prerequisites..."
        />

        {/* File Picker */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontSize: "13px", fontWeight: 500, color: "var(--color-text)" }}>
            Attach File (Optional)
          </label>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              padding: "12px 14px",
              borderRadius: "var(--radius-md)",
              border: "1px dashed var(--color-input-border)",
              backgroundColor: "var(--color-page)",
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
              <Upload size={18} style={{ color: "var(--color-primary-700)", flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--color-text)" }}>
                  {fileName ? "Replace selected file" : "Choose a document, slide deck, or archive"}
                </div>
                <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                  PDF, PPTX, DOCX, MP4, ZIP, TXT · Max 50 MB
                </div>
              </div>
            </div>
            <input type="file" onChange={handleFileChange} style={{ display: "none" }} />
          </label>

          {fileName && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 12px",
                borderRadius: "var(--radius-sm)",
                backgroundColor: "var(--color-primary-50)",
                border: "1px solid var(--color-info-border)",
                fontSize: "13px",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                <FileText size={15} style={{ color: "var(--color-primary-700)", flexShrink: 0 }} />
                <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {fileName}
                </span>
                {fileSize ? (
                  <span style={{ color: "var(--color-text-muted)", fontSize: "12px" }}>
                    ({formatFileSize(fileSize)})
                  </span>
                ) : null}
              </span>
              <button
                type="button"
                aria-label="Remove attached file"
                onClick={() => {
                  setFileName("");
                  setFileSize(null);
                  setFileUrl("");
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--color-text-muted)",
                  padding: "2px",
                }}
              >
                <X size={14} />
              </button>
            </div>
          )}

          {errors.file && (
            <span style={{ fontSize: "12px", color: "var(--color-danger)" }} role="alert">
              {errors.file}
            </span>
          )}
        </div>

        <Input
          label="Resource Path / External URL (Optional)"
          value={fileUrl}
          onChange={(e) => setFileUrl(e.target.value)}
          placeholder="e.g. /uploads/materials/lecture04.pdf or https://..."
          helperText="Automatically populated when choosing a local file, or paste a video/document link."
        />
      </form>
    </Modal>
  );
};
