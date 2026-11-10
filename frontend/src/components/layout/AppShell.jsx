import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export const AppShell = () => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        backgroundColor: "var(--color-page)",
      }}
    >
      {/* Sidebar */}
      <Sidebar
        isOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
      />

      {/* Main Column */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          height: "100%",
          overflow: "hidden",
        }}
      >
        <Topbar onToggleSidebar={() => setMobileSidebarOpen(true)} />

        <main
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "24px",
            backgroundColor: "var(--color-page)",
          }}
        >
          <div
            style={{
              maxWidth: "var(--content-max-width)",
              margin: "0 auto",
              width: "100%",
            }}
          >
            <Outlet />
          </div>
        </main>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .desktop-sidebar {
            display: none !important;
          }
          .mobile-hamburger {
            display: inline-flex !important;
          }
          .mobile-close-btn {
            display: inline-flex !important;
          }
          .topbar-user-info span:first-child {
            max-width: 110px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .logout-text {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};
