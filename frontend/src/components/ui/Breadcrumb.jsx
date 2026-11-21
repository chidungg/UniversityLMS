import { Fragment } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

export const Breadcrumb = ({ items = [] }) => {
  if (!items || items.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        fontSize: "13px",
        color: "var(--color-text-muted)",
        marginBottom: "12px",
        flexWrap: "wrap",
      }}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <Fragment key={index}>
            {index > 0 && (
              <ChevronRight size={14} style={{ color: "var(--color-text-muted)", flexShrink: 0 }} />
            )}
            {isLast || !item.to ? (
              <span
                style={{
                  color: isLast ? "var(--color-text)" : "var(--color-text-secondary)",
                  fontWeight: isLast ? 600 : 400,
                  maxWidth: "260px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                aria-current={isLast ? "page" : undefined}
              >
                {item.label}
              </span>
            ) : (
              <Link
                to={item.to}
                style={{
                  color: "var(--color-text-secondary)",
                  textDecoration: "none",
                }}
                onMouseEnter={(e) => (e.target.style.color = "var(--color-primary-700)")}
                onMouseLeave={(e) => (e.target.style.color = "var(--color-text-secondary)")}
              >
                {item.label}
              </Link>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
};
