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
    <div className="lms-field">
      {label && (
        <label htmlFor={selectId} className="lms-field-label">
          {label}
        </label>
      )}
      <select
        id={selectId}
        style={style}
        className={`lms-select ${error ? "has-error" : ""} ${className}`.trim()}
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
        <span className="lms-field-error" role="alert">
          {error}
        </span>
      ) : helperText ? (
        <span className="lms-field-helper">{helperText}</span>
      ) : null}
    </div>
  );
};
