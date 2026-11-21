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

  const baseStyles = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    fontWeight: 500,
    borderRadius: "var(--radius-md)",
    cursor: isDisabled ? "not-allowed" : "pointer",
    transition: "background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease, transform 0.08s ease",
    border: "1px solid transparent",
    textDecoration: "none",
    userSelect: "none",
  };

  const sizeStyles = {
    sm: { height: "32px", padding: "0 12px", fontSize: "13px" },
    md: { height: "40px", padding: "0 16px", fontSize: "14px" },
    lg: { height: "44px", padding: "0 20px", fontSize: "15px" },
  };

  const variantStyles = {
    primary: {
      backgroundColor: isDisabled ? "#93C5FD" : "var(--color-primary-700)",
      color: "#FFFFFF",
      borderColor: isDisabled ? "#93C5FD" : "var(--color-primary-700)",
    },
    secondary: {
      backgroundColor: "var(--color-surface-soft)",
      color: "var(--color-text)",
      borderColor: "var(--color-border)",
    },
    outline: {
      backgroundColor: "transparent",
      color: "var(--color-primary-700)",
      borderColor: "var(--color-border)",
    },
    danger: {
      backgroundColor: isDisabled ? "#FCA5A5" : "var(--color-danger)",
      color: "#FFFFFF",
      borderColor: isDisabled ? "#FCA5A5" : "var(--color-danger)",
    },
    ghost: {
      backgroundColor: "transparent",
      color: "var(--color-text)",
      borderColor: "transparent",
    },
  };

  return (
    <button
      type={type}
      disabled={isDisabled}
      onClick={onClick}
      style={{
        ...baseStyles,
        ...sizeStyles[size],
        ...variantStyles[variant],
        opacity: isDisabled && variant !== "primary" ? 0.6 : 1,
        ...style,
      }}
      className={`lms-button ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
      ) : Icon ? (
        <Icon size={16} />
      ) : null}
      {children}
    </button>
  );
};
