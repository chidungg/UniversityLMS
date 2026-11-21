import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import AuthenticationPage from "../features/auth/AuthenticationPage";
import { ProtectedRoute, HomeRedirect, InstructorEntry } from "../features/auth/SessionControls";
import { DashboardPage } from "../pages/student/DashboardPage";
import { MyCoursesPage } from "../pages/student/MyCoursesPage";
import { CourseDetailsPage } from "../pages/student/CourseDetailsPage";
import { CourseMaterialsPage } from "../pages/student/CourseMaterialsPage";
import { MyAssignmentsPage } from "../pages/student/MyAssignmentsPage";
import { AssignmentDetailsPage } from "../pages/student/AssignmentDetailsPage";
import { QuizListPage } from "../pages/student/quizzes/QuizListPage";
import { QuizInstructionsPage } from "../pages/student/quizzes/QuizInstructionsPage";
import { TakeQuizPage } from "../pages/student/quizzes/TakeQuizPage";
import { QuizResultPage } from "../pages/student/quizzes/QuizResultPage";
import { AnnouncementsPage } from "../pages/student/communication/AnnouncementsPage";
import { AnnouncementDetailsPage } from "../pages/student/communication/AnnouncementDetailsPage";
import { MessagesPage } from "../pages/student/communication/MessagesPage";
import { GlobalSearchPage } from "../pages/student/GlobalSearchPage";
import { NotFoundPage } from "../pages/NotFoundPage";

// Admin Workspace & Error Pages (từ nhánh Phuc)
import AdminDashboard from "../features/admin/AdminDashboard";
import UserManagement from "../features/admin/users/UserManagement";
import CourseManagement from "../features/admin/courses/CourseManagement";
import ClassManagement from "../features/admin/classes/ClassManagement";
import EnrollmentManagement from "../features/admin/enrollments/EnrollmentManagement";
import PasswordResetManagement from "../features/admin/password-resets/PasswordResetManagement";
import ForbiddenPage from "../features/errors/ForbiddenPage";

export const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Direct access to Student Workspace */}
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/login" element={<AuthenticationPage key="login" />} />
        <Route path="/forgot-password" element={<AuthenticationPage key="recovery" recovery />} />
        <Route path="/support" element={<Navigate to="/forgot-password" replace />} />
        <Route element={<ProtectedRoute allowPasswordChange />}><Route path="/change-password" element={<AuthenticationPage key="change" changePassword />} /></Route>
        <Route element={<ProtectedRoute roles={["Instructor"]} />}><Route path="/instructor/classes" element={<InstructorEntry />} /></Route>

        {/* Student Workspace Routes */}
        <Route element={<ProtectedRoute roles={["Student"]} />}>
        <Route path="/student" element={<AppShell />}>
          <Route index element={<Navigate to="/student/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="courses" element={<MyCoursesPage />} />
          <Route path="courses/:courseId" element={<CourseDetailsPage />} />
          <Route path="courses/:courseId/materials" element={<CourseMaterialsPage />} />
          <Route path="assignments" element={<MyAssignmentsPage />} />
          <Route path="assignments/:assignmentId" element={<AssignmentDetailsPage />} />

          {/* S03: Quiz Assessment Routes */}
          <Route path="quizzes" element={<QuizListPage />} />
          <Route path="quizzes/:quizId" element={<QuizInstructionsPage />} />
          <Route path="quizzes/:quizId/attempt" element={<TakeQuizPage />} />
          <Route path="quiz-attempts/:attemptId/result" element={<QuizResultPage />} />

          {/* S04: Student Communication Routes */}
          <Route path="announcements" element={<AnnouncementsPage />} />
          <Route path="announcements/:announcementId" element={<AnnouncementDetailsPage />} />
          <Route path="messages" element={<MessagesPage />} />
          <Route path="messages/:userId" element={<MessagesPage />} />

          {/* S05: Search */}
          <Route path="search" element={<GlobalSearchPage />} />
        </Route>

        </Route>
        {/* Admin Workspace Routes */}
        <Route element={<ProtectedRoute roles={["Administrator"]} />}>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/statistics" element={<AdminDashboard />} />
        <Route path="/admin/users" element={<UserManagement />} />
        <Route path="/admin/courses" element={<CourseManagement />} />
        <Route path="/admin/classes" element={<ClassManagement />} />
        <Route path="/admin/enrollments" element={<EnrollmentManagement />} />
        <Route path="/admin/password-resets" element={<PasswordResetManagement />} />

        </Route>
        {/* Error Pages */}
        <Route path="/403" element={<ForbiddenPage />} />
        <Route path="/forbidden" element={<ForbiddenPage />} />
        <Route path="/404" element={<NotFoundPage />} />
        <Route path="/not-found" element={<NotFoundPage />} />

        {/* Fallback 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
};
