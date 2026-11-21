import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { LoginPage } from "../pages/auth/LoginPage";
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

export const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Direct access to Student Workspace */}
        <Route path="/" element={<Navigate to="/student/dashboard" replace />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Student Workspace Routes */}
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

        {/* Fallback 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
};
