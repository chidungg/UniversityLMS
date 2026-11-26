import { useState } from "react";
import { Outlet } from "react-router-dom";
import { InstructorSidebar } from "./InstructorSidebar";
import { InstructorTopbar } from "./InstructorTopbar";

export const InstructorShell = () => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="lms-workspace lms-portal-instructor lms-shell lms-shell-fixed">
      <a className="skip-link" href="#instructor-main">Skip to main content</a>

      <InstructorSidebar
        isOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
      />

      <div className="lms-main-column">
        <InstructorTopbar onToggleSidebar={() => setMobileSidebarOpen(true)} />

        <main id="instructor-main" tabIndex={-1} className="lms-main">
          <div className="lms-main-inner">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
