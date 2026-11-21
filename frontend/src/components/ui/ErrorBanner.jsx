import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "./Button";

export const ErrorBanner = ({
  message = "Something went wrong. Please try again.",
  onRetry,
  className = "",
}) => {
  return (
    <div
      role="alert"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        padding: "12px 16px",
        borderRadius: "var(--radius-md)",
        backgroundColor: "var(--color-danger-bg)",
        border: "1px solid #FECACA",
        color: "var(--color-danger)",
        fontSize: "14px",
      }}
      className={`lms-error-banner ${className}`}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <AlertCircle size={18} style={{ flexShrink: 0 }} />
        <span>{message}</span>
      </div>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          icon={RefreshCw}
          style={{
            borderColor: "var(--color-danger)",
            color: "var(--color-danger)",
            backgroundColor: "#FFFFFF",
          }}
        >
          Retry
        </Button>
      )}
    </div>
  );
};
