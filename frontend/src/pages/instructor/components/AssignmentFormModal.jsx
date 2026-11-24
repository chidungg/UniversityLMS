import { TeachingWeekField } from "../../../components/materials/TeachingWeekField";
import { titleWithWeek, weekTitleError } from "../../../utils/materialWeeks";
import { useState, useEffect } from "react";
import { Modal } from "../../../components/ui/Modal";
import { Input } from "../../../components/ui/Input";
import { Textarea } from "../../../components/ui/Textarea";
import { Select } from "../../../components/ui/Select";
import { Button } from "../../../components/ui/Button";
import { ErrorBanner } from "../../../components/ui/ErrorBanner";
import { toLocalDateTimeInput } from "./formatters";

export const AssignmentFormModal = ({
  isOpen,
  onClose,
  assignment,
  courses = [],
  defaultCourseId = "",
  onSave,
}) => {
  const isEditing = Boolean(assignment?._id);

  const [courseId, setCourseId] = useState("");
  const [title, setTitle] = useState("");
  const [selectedWeek, setSelectedWeek] = useState(null);
  const savedTitle = titleWithWeek(title, selectedWeek);
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [maxScore, setMaxScore] = useState("10");
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedWeek(null);
    if (assignment) {
      setCourseId(assignment.courseId?._id || assignment.courseId || defaultCourseId || "");
      setTitle(assignment.title || "");
      setDescription(assignment.description || "");
      setDueDate(toLocalDateTimeInput(assignment.dueDate));
      setMaxScore(String(assignment.maxScore ?? 10));
    } else {
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      nextWeek.setHours(23, 59, 0, 0);
      setCourseId(defaultCourseId || courses[0]?._id || "");
      setTitle("");
      setDescription("");
      setDueDate(toLocalDateTimeInput(nextWeek.toISOString()));
      setMaxScore("10");
    }
    setErrors({});
    setSubmitError("");
  }, [isOpen, assignment, courses, defaultCourseId]);

  const validate = () => {
    const next = {};
    if (!courseId) next.courseId = "Select a course.";
    if (!title.trim()) next.title = "Assignment title is required.";
    const titleError = weekTitleError(savedTitle, selectedWeek);
    if (titleError) next.title = titleError;
    if (!dueDate || !Number.isFinite(new Date(dueDate).getTime())) next.dueDate = "Enter a valid due date and time.";
    const parsedScore = Number(maxScore);
    if (!maxScore || !Number.isFinite(parsedScore) || parsedScore <= 0) {
      next.maxScore = "Maximum score must be greater than 0.";
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
      await onSave(
        {
          courseId,
          title: savedTitle,
          description: description.trim(),
          dueDate: new Date(dueDate).toISOString(),
          maxScore: Number(maxScore),
        },
        assignment?._id
      );
      onClose();
    } catch (err) {
      setSubmitError(err.message || "Failed to save assignment.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { if (!saving) onClose(); }}
      title={isEditing ? "Edit Assignment" : "Create Assignment"}
      maxWidth="600px"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="assignment-form" variant="primary" size="sm" loading={saving}>
            {isEditing ? "Save Changes" : "Create Assignment"}
          </Button>
        </>
      }
    >
      <form
        id="assignment-form"
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "16px" }}
      >
        {submitError && <ErrorBanner message={submitError} />}

        <Select
          label="Course *"
          value={courseId}
          disabled={saving || isEditing || Boolean(defaultCourseId)}
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

        <Input
          label="Assignment Title *"
          value={title}
          maxLength={200}
          onChange={(e) => {
            setTitle(e.target.value);
            if (errors.title) setErrors((prev) => ({ ...prev, title: "" }));
          }}
          error={errors.title}
          placeholder="e.g. Assignment 03 — Relational Algebra Workbench"
        />

        <TeachingWeekField title={title} week={selectedWeek} onChange={setSelectedWeek} disabled={saving} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 160px", gap: "12px" }}>
          <Input
            label="Due Date & Time *"
            type="datetime-local"
            value={dueDate}
            onChange={(e) => {
              setDueDate(e.target.value);
              if (errors.dueDate) setErrors((prev) => ({ ...prev, dueDate: "" }));
            }}
            error={errors.dueDate}
          />

          <Input
            label="Maximum Score *"
            type="number"
            min="0"
            step="any"
            value={maxScore}
            onChange={(e) => {
              setMaxScore(e.target.value);
              if (errors.maxScore) setErrors((prev) => ({ ...prev, maxScore: "" }));
            }}
            error={errors.maxScore}
          />
        </div>

        <Textarea
          label="Instructions & Requirements"
          rows={5}
          value={description}
          maxLength={5000}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe deliverables, formatting rules, grading rubric, and submission guidelines..."
        />
      </form>
    </Modal>
  );
};
