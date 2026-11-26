import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export const AppShell = () => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="lms-workspace lms-portal-student lms-shell lms-shell-fixed">
      <a className="skip-link" href="#student-main">Skip to main content</a>

      <Sidebar
        isOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
      />

      <div className="lms-main-column">
        <Topbar onToggleSidebar={() => setMobileSidebarOpen(true)} />

        <main id="student-main" tabIndex={-1} className="lms-main">
          <div className="lms-main-inner">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
