const variantStyles = {
  // Academic statuses — 100% black ink (#111111) on harmonious pastel surfaces
  SUBMITTED: {
    bg: "#E0F2FE",
    border: "#7DD3FC",
    dot: "#0284C7",
    label: "Submitted",
  },
  GRADED: {
    bg: "#DCFCE7",
    border: "#86EFAC",
    dot: "#16A34A",
    label: "Graded",
  },
  PENDING: {
    bg: "#FEF3C7",
    border: "#FCD34D",
    dot: "#D97706",
    label: "Not Submitted",
  },
  NOT_SUBMITTED: {
    bg: "#F4F4F5",
    border: "#D4D4D8",
    dot: "#71717A",
    label: "Not Submitted",
  },
  ON_TIME: {
    bg: "#DCFCE7",
    border: "#86EFAC",
    dot: "#16A34A",
    label: "On Time",
  },
  LATE: {
    bg: "#FEF3C7",
    border: "#FCD34D",
    dot: "#D97706",
    label: "Late",
  },
  NOT_ATTEMPTED: {
    bg: "#F4F4F5",
    border: "#D4D4D8",
    dot: "#71717A",
    label: "Not Attempted",
  },
  PASSED: {
    bg: "#DCFCE7",
    border: "#86EFAC",
    dot: "#16A34A",
    label: "Passed",
  },
  FAILED: {
    bg: "#FEE2E2",
    border: "#FCA5A5",
    dot: "#DC2626",
    label: "Needs Review",
  },
  OVERDUE: {
    bg: "#FEE2E2",
    border: "#FCA5A5",
    dot: "#DC2626",
    label: "Past Due",
  },
  // Material types
  LectureNote: {
    bg: "#DBEAFE",
    border: "#93C5FD",
    dot: "#2563EB",
    label: "Lecture Note",
  },
  Video: {
    bg: "#EDE9FE",
    border: "#C4B5FD",
    dot: "#7C3AED",
    label: "Video",
  },
  Attachment: {
    bg: "#CCFBF1",
    border: "#5EEAD4",
    dot: "#0D9488",
    label: "Attachment",
  },
  // Active states
  ACTIVE: {
    bg: "#DCFCE7",
    border: "#86EFAC",
    dot: "#16A34A",
    label: "Active",
  },
  INACTIVE: {
    bg: "#F4F4F5",
    border: "#D4D4D8",
    dot: "#71717A",
    label: "Inactive",
  },
  // Quiz Assessment states
  AVAILABLE: {
    bg: "#DCFCE7",
    border: "#86EFAC",
    dot: "#16A34A",
    label: "Available",
  },
  IN_PROGRESS: {
    bg: "#FEF3C7",
    border: "#FCD34D",
    dot: "#D97706",
    label: "In Progress",
  },
  COMPLETED: {
    bg: "#DCFCE7",
    border: "#86EFAC",
    dot: "#16A34A",
    label: "Completed",
  },
  UPCOMING: {
    bg: "#FEF3C7",
    border: "#FCD34D",
    dot: "#D97706",
    label: "Upcoming",
  },
  EXPIRED: {
    bg: "#FEE2E2",
    border: "#FCA5A5",
    dot: "#DC2626",
    label: "Closed",
  },
  // Communication states
  UNREAD: {
    bg: "#E0E7FF",
    border: "#A5B4FC",
    dot: "#4F46E5",
    label: "Unread",
  },
  READ: {
    bg: "#F4F4F5",
    border: "#D4D4D8",
    dot: "#71717A",
    label: "Read",
  },
  DEFAULT: {
    bg: "#F4F4F5",
    border: "#D4D4D8",
    dot: "#52525B",
    label: "",
  },
};

export const Badge = ({ variant = "DEFAULT", label, size = "md", showDot = true, className = "" }) => {
  const config = variantStyles[variant] || variantStyles.DEFAULT;
  const displayLabel = label || config.label || variant;

  return (
    <span
      className={`lms-badge lms-badge--${size} ${className}`.trim()}
      style={{
        backgroundColor: config.bg,
        color: "#111111",
        border: `1px solid ${config.border}`,
      }}
    >
      {showDot && config.dot && (
        <span
          className="lms-badge-dot"
          style={{ backgroundColor: config.dot }}
          aria-hidden="true"
        />
      )}
      <span>{displayLabel}</span>
    </span>
  );
};
