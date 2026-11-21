import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Menu, LogOut } from "lucide-react";
import { useAuth } from "../../app/AuthContext";
import { Badge } from "../ui/Badge";

export const InstructorTopbar = ({ onToggleSidebar }) => {
  const navigate = useNavigate();
  const { user: instructor, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) {
      navigate(`/instructor/courses?q=${encodeURIComponent(q)}`);
    } else {
      navigate("/instructor/courses");
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header
      style={{
        height: "var(--topbar-height)",
        backgroundColor: "var(--color-surface)",
        borderBottom: "1px solid var(--color-border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        position: "sticky",
        top: 0,
        zIndex: 30,
      }}
    >
      {/* Left: Mobile hamburger & Quick course search */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px", flex: 1, maxWidth: "480px" }}>
        <button
          type="button"
          onClick={onToggleSidebar}
          className="mobile-hamburger"
          style={{
            display: "none",
            background: "transparent",
            border: "none",
            color: "var(--color-text)",
            cursor: "pointer",
            padding: "6px",
            borderRadius: "4px",
          }}
          aria-label="Toggle navigation"
        >
          <Menu size={22} />
        </button>

        <form onSubmit={handleSearchSubmit} style={{ width: "100%", position: "relative" }}>
          <Search
            size={16}
            style={{
              position: "absolute",
              left: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--color-text-muted)",
              pointerEvents: "none",
            }}
          />
          <input
            type="search"
            aria-label="Search assigned courses"
            placeholder="Search assigned courses by code or name..."
            value={searchQuery}
            maxLength={200}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              height: "36px",
              padding: "0 12px 0 36px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--color-border)",
              backgroundColor: "var(--color-page)",
              color: "var(--color-text)",
              fontSize: "13px",
              outline: "none",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "var(--color-primary-600)";
              e.target.style.backgroundColor = "var(--color-surface)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "var(--color-border)";
              e.target.style.backgroundColor = "var(--color-page)";
            }}
          />
        </form>
      </div>

      {/* Right: Instructor Account & Logout */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "50%",
              backgroundColor: "var(--color-primary-100)",
              color: "var(--color-primary-700)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 600,
              fontSize: "13px",
            }}
          >
            DM
          </div>
          <div className="topbar-user-info" style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text)", lineHeight: 1.2 }}>
              {instructor.fullName}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>{instructor.email}</span>
              <Badge variant="SUBMITTED" label="Instructor" size="sm" />
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          title="Log out"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 12px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--color-border)",
            backgroundColor: "transparent",
            color: "var(--color-text-secondary)",
            fontSize: "13px",
            fontWeight: 500,
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--color-danger-bg)";
            e.currentTarget.style.borderColor = "#FECACA";
            e.currentTarget.style.color = "var(--color-danger)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.borderColor = "var(--color-border)";
            e.currentTarget.style.color = "var(--color-text-secondary)";
          }}
        >
          <LogOut size={15} />
          <span className="logout-text">Log out</span>
        </button>
      </div>
    </header>
  );
};
