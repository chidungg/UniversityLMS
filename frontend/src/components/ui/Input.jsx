export const Input = ({
  label,
  error,
  helperText,
  icon: Icon,
  id,
  className = "",
  style = {},
  ...props
}) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  return (
    <div className="lms-field">
      {label && (
        <label htmlFor={inputId} className="lms-field-label">
          {label}
        </label>
      )}
      <div className="lms-input-wrap">
        {Icon && (
          <span className="lms-input-icon" aria-hidden="true">
            <Icon size={15} />
          </span>
        )}
        <input
          id={inputId}
          style={style}
          className={`lms-input ${Icon ? "has-icon" : ""} ${error ? "has-error" : ""} ${className}`.trim()}
          {...props}
        />
      </div>
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
