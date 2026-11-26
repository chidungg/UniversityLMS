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
    <div className="lms-field">
      {label && (
        <label htmlFor={textareaId} className="lms-field-label">
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        rows={rows}
        style={style}
        className={`lms-textarea ${error ? "has-error" : ""} ${className}`.trim()}
        {...props}
      />
      {error ? (
        <span className="lms-field-error" role="alert">
          {error}
        </span>
      ) : helperText ? (
        <span className="lms-field-helper">{helperText}</span>
      ) : null}
    </div>
  );
};
