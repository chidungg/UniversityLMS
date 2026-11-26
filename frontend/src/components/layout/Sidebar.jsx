import { Link, NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  HelpCircle,
  Bell,
  MessageSquare,
  Search,
  X,
} from "lucide-react";

const navItems = [
  { label: "Dashboard", to: "/student/dashboard", icon: LayoutDashboard },
  { label: "My Courses", to: "/student/courses", icon: BookOpen },
  { label: "Assignments", to: "/student/assignments", icon: FileText },
  { label: "Quizzes", to: "/student/quizzes", icon: HelpCircle },
  { label: "Announcements", to: "/student/announcements", icon: Bell },
  { label: "Messages", to: "/student/messages", icon: MessageSquare },
  { label: "Search", to: "/student/search", icon: Search },
];

export const Sidebar = ({ isOpen, onClose }) => {
  const sidebarContent = (
    <aside className="lms-sidebar" aria-label="Student workspace navigation">
      <div className="lms-sidebar-header">
        <Link to="/student/dashboard" className="lms-brand" onClick={onClose}>
          <span className="lms-brand-text">
            <strong className="lms-brand-title">University LMS</strong>
            <span className="lms-brand-role">Student Portal</span>
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

      <nav className="lms-sidebar-nav" aria-label="Academic navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) => `lms-nav-link ${isActive ? "is-active" : ""}`}
            >
              <Icon size={17} aria-hidden="true" />
              <span>{item.label}</span>
            </NavLink>
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
