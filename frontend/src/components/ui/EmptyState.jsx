import { FolderX } from "lucide-react";
import { Button } from "./Button";

export const EmptyState = ({
  icon: Icon = FolderX,
  title = "No data found",
  description = "There are no records to display at this moment.",
  actionLabel,
  onAction,
}) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
        textAlign: "center",
        backgroundColor: "var(--color-surface)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-border)",
        maxWidth: "600px",
        margin: "0 auto",
      }}
    >
      <div
        style={{
          width: "48px",
          height: "48px",
          borderRadius: "50%",
          backgroundColor: "var(--color-primary-100)",
          color: "var(--color-primary-700)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "16px",
        }}
      >
        <Icon size={24} />
      </div>
      <h3
        style={{
          fontSize: "16px",
          fontWeight: 600,
          color: "var(--color-text)",
          marginBottom: "6px",
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontSize: "14px",
          color: "var(--color-text-secondary)",
          maxWidth: "420px",
          marginBottom: actionLabel ? "20px" : "0",
          lineHeight: 1.5,
        }}
      >
        {description}
      </p>
      {actionLabel && onAction && (
        <Button variant="primary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
