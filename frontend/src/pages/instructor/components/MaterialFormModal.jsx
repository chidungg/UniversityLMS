import { useRef, useState } from "react";
import { Modal } from "../../../components/ui/Modal";
import { Input } from "../../../components/ui/Input";
import { Textarea } from "../../../components/ui/Textarea";
import { Select } from "../../../components/ui/Select";
import { Button } from "../../../components/ui/Button";
import { ErrorBanner } from "../../../components/ui/ErrorBanner";
import { externalMaterialUrl } from "../../../utils/materialDownloads";
import { formatFileSize } from "./formatters";

const MATERIAL_TYPES = [
  { value: "LectureNote", label: "Lecture Note (Slides / PDF)" },
  { value: "Video", label: "Video Lesson" },
  { value: "Attachment", label: "Attachment / Lab Exercise" },
];
const ACCEPTED_FILES = ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.md,.mp4,.webm,.mov,.png,.jpg,.jpeg,.gif,.webp,.zip,.rar,.7z";

export function MaterialFormModal({ onClose, material, courses, defaultCourseId = "", lockCourse, onSave }) {
  const isEditing = Boolean(material);
  const [courseId, setCourseId] = useState(material?.courseId?._id || defaultCourseId || courses[0]?._id || "");
  const [title, setTitle] = useState(material?.title ?? "");
  const [type, setType] = useState(material?.type ?? "LectureNote");
  const [description, setDescription] = useState(material?.description ?? "");
  const [fileUrl, setFileUrl] = useState("");
  const [file, setFile] = useState(null);
  const fileInput = useRef(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const clearFile = () => {
    fileInput.current.value = "";
    setFile(null);
  };

  const handleFileChange = (event) => {
    const selected = event.target.files?.[0];
    if (!selected) {
      setFile(null);
      return;
    }
    if (!selected.size || selected.size > 50 * 1024 * 1024) {
      clearFile();
      setError("Choose a nonempty file of up to 50 MB.");
      return;
    }
    setError("");
    setFile(selected);
    if (!title.trim()) setTitle(selected.name.replace(/\.[^/.]+$/, "").slice(0, 200));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!courseId || !title.trim()) {
      setError("Select a course and enter a material title.");
      return;
    }
    const link = fileUrl.trim();
    if ((file && link) || (!isEditing && !file && !link)) {
      setError("Attach a file or enter a resource link.");
      return;
    }
    if (link && !externalMaterialUrl(link)) {
      setError("Enter a valid HTTP or HTTPS resource link.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({ courseId, title: title.trim(), type, description: description.trim(), file, fileUrl: link }, material?._id);
      onClose();
    } catch (requestError) {
      setError(requestError.message || "Failed to save learning material.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={() => { if (!saving) onClose(); }}
      title={isEditing ? "Edit Learning Material" : "Upload Learning Material"}
      maxWidth="580px"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form="material-form" size="sm" loading={saving}>
            {isEditing ? "Save Changes" : "Upload Material"}
          </Button>
        </>
      }
    >
      <form id="material-form" onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {error && <ErrorBanner message={error} />}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 195px), 1fr))", gap: "12px" }}>
          <Select label="Course *" value={courseId} disabled={saving || lockCourse || isEditing} onChange={(event) => setCourseId(event.target.value)}>
            <option value="">Select course...</option>
            {courses.map((course) => (
              <option key={course._id} value={course._id}>{course.courseCode} — {course.courseName}</option>
            ))}
          </Select>
          <Select
            label="Category *"
            value={type}
            options={MATERIAL_TYPES}
            disabled={saving}
            onChange={(event) => setType(event.target.value)}
          />
        </div>
        <Input label="Material Title *" value={title} maxLength={200} disabled={saving} onChange={(event) => setTitle(event.target.value)} />
        <Textarea label="Description & Study Notes" rows={3} value={description} maxLength={5000} disabled={saving} onChange={(event) => setDescription(event.target.value)} />

        {isEditing && material.fileUrl && (
          <p style={{ fontSize: "13px", color: "var(--color-text-secondary)", overflowWrap: "anywhere", margin: 0 }}>
            Current resource: {material.fileName || externalMaterialUrl(material.fileUrl) || "Attached file"}. Leave both fields blank to keep it.
          </p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label htmlFor="material-file" style={{ fontSize: "13px", fontWeight: 500 }}>Attach File</label>
          <input id="material-file" ref={fileInput} type="file" accept={ACCEPTED_FILES} disabled={saving} onChange={handleFileChange} aria-describedby="material-file-help" />
          <span id="material-file-help" style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
            Documents, images, videos, and archives up to 50 MB.
          </span>
          {file && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
              <span style={{ fontSize: "13px", overflowWrap: "anywhere" }}>{file.name} ({formatFileSize(file.size)})</span>
              <Button variant="secondary" size="sm" onClick={clearFile} disabled={saving}>Remove selected file</Button>
            </div>
          )}
        </div>
        <Input
          label="External URL"
          type="url"
          value={fileUrl}
          maxLength={2048}
          placeholder="https://..."
          disabled={saving}
          onChange={(event) => setFileUrl(event.target.value)}
        />
      </form>
    </Modal>
  );
}
