export const Select = ({
  label,
  error,
  helperText,
  id,
  options = [],
  children,
  className = "",
  style = {},
  ...props
}) => {
  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%" }}>
      {label && (
        <label
          htmlFor={selectId}
          style={{
            fontSize: "13px",
            fontWeight: 500,
            color: "var(--color-text)",
          }}
        >
          {label}
        </label>
      )}
      <select
        id={selectId}
        style={{
          width: "100%",
          height: "40px",
          padding: "0 12px",
          borderRadius: "var(--radius-sm)",
          border: `1px solid ${error ? "var(--color-danger)" : "var(--color-border)"}`,
          backgroundColor: "var(--color-surface)",
          color: "var(--color-text)",
          fontSize: "14px",
          outline: "none",
          cursor: "pointer",
          transition: "border-color 0.15s ease, box-shadow 0.15s ease",
          ...style,
        }}
        className={`lms-select ${className}`}
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
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
        {children}
      </select>
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
