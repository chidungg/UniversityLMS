import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Search, Menu, LogOut, ChevronRight, User as UserIcon } from "lucide-react";
import { useAuth } from "../../app/AuthContext";
import { Badge } from "../ui/Badge";

export const Topbar = ({ onToggleSidebar }) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  const isSearchPage = pathname.startsWith("/student/search");
  const displayName = user?.fullName?.trim() || "Student Account";
  const initials =
    displayName
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "";

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/student/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

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

        {isSearchPage ? (
          <nav className="lms-topbar-breadcrumb" aria-label="Workspace location">
            <Link to="/student/dashboard">Student Portal</Link>
            <ChevronRight size={14} aria-hidden="true" />
            <span aria-current="page">Search</span>
          </nav>
        ) : (
          <form onSubmit={handleSearchSubmit} className="lms-topbar-search">
            <Search size={15} className="lms-topbar-search-icon" aria-hidden="true" />
            <input
              type="search"
              aria-label="Search courses, materials, assignments"
              placeholder="Search courses, materials, assignments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </form>
        )}
      </div>

      <div className="lms-topbar-right">
        <div className="lms-topbar-user">
          <span className="lms-avatar" aria-hidden="true">
            {initials || <UserIcon size={15} />}
          </span>
          <div className="lms-topbar-user-info">
            <span className="lms-topbar-user-name">{displayName}</span>
            <div className="lms-topbar-user-meta">
              {user?.email && <span>{user.email}</span>}
              <Badge variant="DEFAULT" label="Student" size="sm" showDot={false} />
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
