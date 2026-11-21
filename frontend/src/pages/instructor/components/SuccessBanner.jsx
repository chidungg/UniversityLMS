import { CheckCircle2, X } from "lucide-react";

export const SuccessBanner = ({ message, onDismiss }) => {
  if (!message) return null;

  return (
    <div
      role="status"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        padding: "12px 16px",
        borderRadius: "var(--radius-md)",
        backgroundColor: "var(--color-success-bg)",
        border: "1px solid #A7F3D0",
        color: "var(--color-success)",
        fontSize: "14px",
        fontWeight: 500,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
        <span>{message}</span>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          style={{
            background: "transparent",
            border: "none",
            color: "var(--color-success)",
            padding: "4px",
            display: "flex",
            alignItems: "center",
          }}
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
};
