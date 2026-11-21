import { Loader2 } from "lucide-react";

export const LoadingSpinner = ({ message = "Loading content...", size = 28 }) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 16px",
        gap: "12px",
        color: "var(--color-text-muted)",
      }}
    >
      <Loader2
        size={size}
        style={{
          animation: "spin 1s linear infinite",
          color: "var(--color-primary-700)",
        }}
      />
      <span style={{ fontSize: "14px", fontWeight: 500 }}>{message}</span>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
