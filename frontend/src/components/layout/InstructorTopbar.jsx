import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, LogOut, ChevronRight } from "lucide-react";
import { useAuth } from "../../app/AuthContext";
import { Badge } from "../ui/Badge";

function getInstructorSectionLabel(pathname) {
  if (pathname.startsWith("/instructor/monitoring") || pathname.endsWith("/students")) return "Monitor Students";
  if (pathname.startsWith("/instructor/materials") || pathname.endsWith("/materials")) return "Learning Materials";
  if (pathname.startsWith("/instructor/assignments")) return "Assignments & Grading";
  if (pathname.startsWith("/instructor/quizzes")) return "Quizzes & Assessments";
  if (pathname.startsWith("/instructor/announcements")) return "Announcements";
  if (pathname.startsWith("/instructor/messages")) return "Messages";
  if (pathname.startsWith("/instructor/courses") || pathname.startsWith("/instructor/classes")) return "Assigned Courses";
  return "Dashboard";
}

export const InstructorTopbar = ({ onToggleSidebar }) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user: instructor, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  const displayName = instructor?.fullName?.trim() || "Instructor";
  const displayEmail = instructor?.email || "";
  const initials =
    displayName
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "IN";

  const sectionLabel = getInstructorSectionLabel(pathname);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError("");
    try {
      await logout();
      navigate("/login");
    } catch (err) {
      setLogoutError(err.message || "Unable to sign out. Please try again.");
      setLoggingOut(false);
    }
  };

  return (
    <header className="lms-topbar">
      <div className="lms-topbar-left">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="lms-mobile-toggle"
          aria-label="Toggle navigation"
        >
          <Menu size={18} />
        </button>

        <nav className="lms-topbar-breadcrumb" aria-label="Workspace location">
          <Link to="/instructor/dashboard">Instructor Portal</Link>
          <ChevronRight size={14} aria-hidden="true" />
          <span aria-current="page">{sectionLabel}</span>
        </nav>
      </div>

      <div className="lms-topbar-right">
        <div className="lms-topbar-user">
          <span className="lms-avatar" aria-hidden="true">{initials}</span>
          <div className="lms-topbar-user-info">
            <span className="lms-topbar-user-name">{displayName}</span>
            <div className="lms-topbar-user-meta">
              {displayEmail && <span>{displayEmail}</span>}
              <Badge variant="DEFAULT" label="Instructor" size="sm" showDot={false} />
            </div>
          </div>
        </div>

        <span className="lms-topbar-divider" aria-hidden="true" />

        <Link className="lms-topbar-link" to="/change-password">
          Change password
        </Link>

        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          aria-label={loggingOut ? "Signing out…" : "Log out"}
          className="lms-topbar-logout"
        >
          <LogOut size={15} aria-hidden="true" />
          <span>{loggingOut ? "Signing out…" : "Log out"}</span>
        </button>

        {logoutError && (
          <span role="alert" className="lms-topbar-error">
            {logoutError}
          </span>
        )}
      </div>
    </header>
  );
};
