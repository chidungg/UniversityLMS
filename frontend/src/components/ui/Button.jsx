import { Loader2 } from "lucide-react";

export const Button = ({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  icon: Icon,
  type = "button",
  onClick,
  className = "",
  style = {},
  ...props
}) => {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      onClick={onClick}
      style={style}
      className={`lms-button lms-button--${variant} lms-button--${size} ${className}`.trim()}
      {...props}
    >
      {loading ? (
        <Loader2 size={15} className="lms-button-spin" aria-hidden="true" />
      ) : Icon ? (
        <Icon size={15} aria-hidden="true" />
      ) : null}
      {children}
    </button>
  );
};
