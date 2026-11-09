# Admin dashboard

English-only desktop frontend at `/admin` (alias `/admin/dashboard`). Follow the supplied sidebar/topbar/overview reference, with the existing Be Vietnam Pro font and shared tokens. Sidebar is 248px, main content is at most 1280px plus gutters. Use a restrained solid navy introduction, academic summary counts, class table, quick links and assignment/enrollment attention items. No AI metrics, decorative charts, department management or unimplemented notification system.

Data is a small explicitly labeled fictional fixture. Metrics and attention items are derived from users, courses, classes and enrollment records, not independent invented totals. Sample enrollment uses classId only as a provisional frontend model; the actual backend contract remains TBD. Refresh illustrates loading and offline/retry feedback without making a backend request.

Courses, Classes, Enrollment and Statistics offer read-only sample tables within the same shell. User Management now has a dedicated interactive frontend; see `user-management.md`. The dashboard reads its saved sample users on navigation. Class review uses the existing accessible Dialog component. Search filters by class code/course name and provides a no-results state and clear action. The account disclosure identifies the preview and allows returning to sign-in. Exit preview does not claim to invalidate a real session.

These routes display only fixtures and are not a production authentication or authorization boundary. Connect server-verified sessions and RBAC before supplying live admin data. Existing login, recovery and error pages remain in place.
