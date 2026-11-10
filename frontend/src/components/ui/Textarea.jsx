export const Textarea = ({
  label,
  error,
  helperText,
  id,
  rows = 4,
  className = "",
  style = {},
  ...props
}) => {
  const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%" }}>
      {label && (
        <label
          htmlFor={textareaId}
          style={{
            fontSize: "13px",
            fontWeight: 500,
            color: "var(--color-text)",
          }}
        >
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        rows={rows}
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: "var(--radius-sm)",
          border: `1px solid ${error ? "var(--color-danger)" : "var(--color-border)"}`,
          backgroundColor: "var(--color-surface)",
          color: "var(--color-text)",
          fontSize: "14px",
          outline: "none",
          resize: "vertical",
          lineHeight: 1.5,
          fontFamily: "inherit",
          transition: "border-color 0.15s ease, box-shadow 0.15s ease",
          ...style,
        }}
        className={`lms-textarea ${className}`}
        onFocus={(e) => {
          e.target.style.borderColor = error ? "var(--color-danger)" : "var(--color-primary-600)";
          e.target.style.boxShadow = error
            ? "0 0 0 3px rgba(180, 35, 24, 0.12)"
            : "0 0 0 3px rgba(21, 94, 149, 0.12)";
        }}
        onBlur={(e) => {
          e.target.style.borderColor = error ? "var(--color-danger)" : "var(--color-border)";
          e.target.style.boxShadow = "none";
        }}
        {...props}
      />
      {error ? (
        <span style={{ fontSize: "12px", color: "var(--color-danger)" }} role="alert">
          {error}
        </span>
      ) : helperText ? (
        <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>{helperText}</span>
      ) : null}
    </div>
  );
};
