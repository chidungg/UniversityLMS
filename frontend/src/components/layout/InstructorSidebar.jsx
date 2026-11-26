import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  BookOpen,
  FolderOpen,
  FileText,
  HelpCircle,
  Bell,
  MessageSquare,
  BarChart3,
  X,
} from "lucide-react";

const navItems = [
  {
    label: "Dashboard",
    to: "/instructor/dashboard",
    icon: LayoutDashboard,
    isActive: (p) => p === "/instructor" || p === "/instructor/dashboard",
  },
  {
    label: "Assigned Courses",
    to: "/instructor/courses",
    icon: BookOpen,
    isActive: (p) =>
      (p.startsWith("/instructor/courses") || p.startsWith("/instructor/classes")) &&
      !p.endsWith("/materials") &&
      !p.endsWith("/students"),
  },
  {
    label: "Learning Materials",
    to: "/instructor/materials",
    icon: FolderOpen,
    isActive: (p) => p.startsWith("/instructor/materials") || p.endsWith("/materials"),
  },
  {
    label: "Assignments & Grading",
    to: "/instructor/assignments",
    icon: FileText,
    isActive: (p) => p.startsWith("/instructor/assignments"),
  },
  {
    label: "Quizzes & Assessments",
    to: "/instructor/quizzes",
    icon: HelpCircle,
    isActive: (p) => p.startsWith("/instructor/quizzes"),
  },
  {
    label: "Announcements",
    to: "/instructor/announcements",
    icon: Bell,
    isActive: (p) => p.startsWith("/instructor/announcements"),
  },
  {
    label: "Messages",
    to: "/instructor/messages",
    icon: MessageSquare,
    isActive: (p) => p.startsWith("/instructor/messages"),
  },
  {
    label: "Monitor Students",
    to: "/instructor/monitoring",
    icon: BarChart3,
    isActive: (p) => p.startsWith("/instructor/monitoring") || p.endsWith("/students"),
  },
];

export const InstructorSidebar = ({ isOpen, onClose }) => {
  const { pathname } = useLocation();

  const sidebarContent = (
    <aside className="lms-sidebar" aria-label="Instructor workspace navigation">
      <div className="lms-sidebar-header">
        <Link to="/instructor/dashboard" className="lms-brand" onClick={onClose}>
          <span className="lms-brand-text">
            <strong className="lms-brand-title">University LMS</strong>
            <span className="lms-brand-role">Instructor Portal</span>
          </span>
        </Link>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="lms-mobile-close"
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <nav className="lms-sidebar-nav" aria-label="Teaching modules">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.isActive(pathname);
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={`lms-nav-link ${active ? "is-active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={17} aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );

  return (
    <>
      <div className="lms-desktop-sidebar">{sidebarContent}</div>

      {isOpen && (
        <div className="lms-drawer-overlay" role="presentation" onClick={onClose}>
          <div className="lms-drawer-panel" onClick={(e) => e.stopPropagation()}>
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
