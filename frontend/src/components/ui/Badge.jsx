const variantStyles = {
  // Academic statuses
  SUBMITTED: {
    bg: "#EAF3FA",
    color: "#155E95",
    border: "#BAE6FD",
    dot: "#155E95",
    label: "Submitted",
  },
  GRADED: {
    bg: "#ECFDF5",
    color: "#0F5132",
    border: "#A7F3D0",
    dot: "#157347",
    label: "Graded",
  },
  PENDING: {
    bg: "#F1F5F9",
    color: "#334155",
    border: "#E2E8F0",
    dot: "#64748B",
    label: "Not Submitted",
  },
  OVERDUE: {
    bg: "#FEF2F2",
    color: "#991B1B",
    border: "#FECACA",
    dot: "#B42318",
    label: "Past Due",
  },
  // Material types
  LectureNote: {
    bg: "#EFF6FF",
    color: "#1E40AF",
    border: "#BFDBFE",
    dot: "#2563EB",
    label: "Lecture Note",
  },
  Video: {
    bg: "#F5F3FF",
    color: "#5B21B6",
    border: "#DDD6FE",
    dot: "#7C3AED",
    label: "Video",
  },
  Attachment: {
    bg: "#F0FDF4",
    color: "#166534",
    border: "#BBF7D0",
    dot: "#16A34A",
    label: "Attachment",
  },
  // Active states
  ACTIVE: {
    bg: "#ECFDF5",
    color: "#0F5132",
    border: "#A7F3D0",
    dot: "#157347",
    label: "Active",
  },
  INACTIVE: {
    bg: "#F1F5F9",
    color: "#475569",
    border: "#E2E8F0",
    dot: "#94A3B8",
    label: "Inactive",
  },
  // Quiz Assessment states
  AVAILABLE: {
    bg: "#ECFDF5",
    color: "#065F46",
    border: "#A7F3D0",
    dot: "#059669",
    label: "Available",
  },
  IN_PROGRESS: {
    bg: "#FFFBEB",
    color: "#92400E",
    border: "#FDE68A",
    dot: "#D97706",
    label: "In Progress",
  },
  COMPLETED: {
    bg: "#EFF6FF",
    color: "#1E40AF",
    border: "#BFDBFE",
    dot: "#2563EB",
    label: "Completed",
  },
  UPCOMING: {
    bg: "#F8FAFC",
    color: "#475569",
    border: "#CBD5E1",
    dot: "#64748B",
    label: "Upcoming",
  },
  EXPIRED: {
    bg: "#FEF2F2",
    color: "#991B1B",
    border: "#FECACA",
    dot: "#DC2626",
    label: "Closed",
  },
  // Communication states
  UNREAD: {
    bg: "#EEF2FF",
    color: "#3730A3",
    border: "#C7D2FE",
    dot: "#4F46E5",
    label: "Unread",
  },
  READ: {
    bg: "#F8FAFC",
    color: "#64748B",
    border: "#E2E8F0",
    dot: "#94A3B8",
    label: "Read",
  },
  DEFAULT: {
    bg: "#F1F5F9",
    color: "#1F2937",
    border: "#E2E8F0",
    dot: "#64748B",
    label: "",
  },
};

export const Badge = ({ variant = "DEFAULT", label, size = "md", showDot = true, className = "" }) => {
  const config = variantStyles[variant] || variantStyles.DEFAULT;
  const displayLabel = label || config.label || variant;

  const sizeStyle =
    size === "sm"
      ? { fontSize: "11px", padding: "2px 7px", gap: "5px" }
      : { fontSize: "12px", padding: "3px 9px", gap: "6px" };

  return (
    <span
      className={`lms-badge ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontWeight: 500,
        borderRadius: "4px",
        lineHeight: 1.2,
        backgroundColor: config.bg,
        color: config.color,
        border: `1px solid ${config.border}`,
        whiteSpace: "nowrap",
        fontVariantNumeric: "tabular-nums",
        ...sizeStyle,
      }}
    >
      {showDot && config.dot && (
        <span
          style={{
            width: "5px",
            height: "5px",
            borderRadius: "50%",
            backgroundColor: config.dot,
            flexShrink: 0,
          }}
          aria-hidden="true"
        />
      )}
      <span>{displayLabel}</span>
    </span>
  );
};
