import { useState, useEffect } from "react";
import { Modal } from "../../../components/ui/Modal";
import { Input } from "../../../components/ui/Input";
import { Textarea } from "../../../components/ui/Textarea";
import { Select } from "../../../components/ui/Select";
import { Button } from "../../../components/ui/Button";
import { ErrorBanner } from "../../../components/ui/ErrorBanner";

export const CourseEditModal = ({ isOpen, onClose, course, onSave }) => {
  const [courseName, setCourseName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState("true");
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && course) {
      setCourseName(course.courseName || "");
      setDescription(course.description || "");
      setIsActive(course.isActive ? "true" : "false");
      setErrors({});
      setSubmitError("");
    }
  }, [isOpen, course]);

  const validate = () => {
    const next = {};
    if (!courseName.trim()) {
      next.courseName = "Course name is required.";
    } else if (courseName.trim().length > 150) {
      next.courseName = "Course name must be 150 characters or fewer.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    setSubmitError("");
    try {
      await onSave(course._id, {
        courseName: courseName.trim(),
        description: description.trim(),
        isActive: isActive === "true",
      });
      onClose();
    } catch (err) {
      setSubmitError(err.message || "Failed to update course details.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={course ? `Edit Course Info — ${course.courseCode}` : "Edit Course Info"}
      maxWidth="560px"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="course-edit-form" variant="primary" size="sm" loading={saving}>
            Save Changes
          </Button>
        </>
      }
    >
      <form
        id="course-edit-form"
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "16px" }}
      >
        {submitError && <ErrorBanner message={submitError} />}

        <Input
          label="Course Code"
          value={course?.courseCode || ""}
          disabled
          helperText="Course codes are managed by academic administration."
          style={{ backgroundColor: "var(--color-surface-soft)", color: "var(--color-text-muted)" }}
        />

        <Input
          label="Course Name *"
          value={courseName}
          onChange={(e) => {
            setCourseName(e.target.value);
            if (errors.courseName) setErrors((prev) => ({ ...prev, courseName: "" }));
          }}
          error={errors.courseName}
          placeholder="e.g. Programming Techniques"
        />

        <Select
          label="Course Status"
          value={isActive}
          onChange={(e) => setIsActive(e.target.value)}
          options={[
            { value: "true", label: "Active — Visible to enrolled students" },
            { value: "false", label: "Inactive — Archived / Hidden" },
          ]}
        />

        <Textarea
          label="Course Description & Syllabus Overview"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Outline learning objectives, topics covered, and grading policies..."
        />
      </form>
    </Modal>
  );
};
