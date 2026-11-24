import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  BookOpen,
  FolderOpen,
  FileText,
  HelpCircle,
  BarChart3,
  GraduationCap,
  X,
} from "lucide-react";

export const InstructorSidebar = ({ isOpen, onClose }) => {
  const navItems = [
    { label: "Dashboard", to: "/instructor/dashboard", icon: LayoutDashboard },
    { label: "Assigned Courses", to: "/instructor/courses", icon: BookOpen },
    { label: "Learning Materials", to: "/instructor/materials", icon: FolderOpen },
    { label: "Assignments & Grading", to: "/instructor/assignments", icon: FileText },
    { label: "Quizzes & Assessments", to: "/instructor/quizzes", icon: HelpCircle },
    { label: "Monitor Students", to: "/instructor/monitoring", icon: BarChart3 },
  ];

  const sidebarContent = (
    <aside
      aria-label="Instructor workspace navigation"
      style={{
        width: "var(--sidebar-width)",
        backgroundColor: "var(--color-surface)",
        borderRight: "1px solid var(--color-border)",
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      {/* Brand Header */}
      <div
        style={{
          height: "var(--topbar-height)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 20px",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "6px",
              backgroundColor: "var(--color-primary-700)",
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <GraduationCap size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "15px", color: "var(--color-primary-700)", lineHeight: 1.2 }}>
              University LMS
            </div>
            <div style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>Instructor Portal</div>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="mobile-close-btn"
            style={{
              display: "none",
              background: "transparent",
              border: "none",
              color: "var(--color-text-muted)",
              cursor: "pointer",
              padding: "4px",
            }}
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Nav List */}
      <nav
        aria-label="Teaching modules"
        style={{ padding: "16px 12px", display: "flex", flexDirection: "column", gap: "4px", flex: 1, overflowY: "auto" }}
      >
        <div
          style={{
            fontSize: "11px",
            fontWeight: 600,
            color: "var(--color-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            padding: "8px 12px",
          }}
        >
          Teaching Workspace
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              style={({ isActive }) => ({
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "10px 14px",
                borderRadius: "var(--radius-sm)",
                fontSize: "14px",
                fontWeight: isActive ? 600 : 500,
                color: isActive ? "var(--color-primary-700)" : "var(--color-text)",
                backgroundColor: isActive ? "var(--color-primary-100)" : "transparent",
                borderLeft: isActive ? "3px solid var(--color-primary-700)" : "3px solid transparent",
                textDecoration: "none",
                transition: "all 0.15s ease",
              })}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}

      </nav>
    </aside>
  );

  return (
    <>
      <div className="desktop-sidebar" style={{ height: "100%", flexShrink: 0 }}>
        {sidebarContent}
      </div>

      {isOpen && (
        <div
          className="mobile-drawer-overlay"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 40,
            backgroundColor: "rgba(15, 23, 42, 0.45)",
            backdropFilter: "blur(2px)",
          }}
          onClick={onClose}
        >
          <div
            style={{ width: "var(--sidebar-width)", height: "100%" }}
            onClick={(e) => e.stopPropagation()}
          >
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
