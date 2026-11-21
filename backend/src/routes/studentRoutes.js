import express from "express";
import { authenticate, requireRole } from "../middlewares/authMiddleware.js";
import { handleSubmissionUpload } from "../middlewares/uploadMiddleware.js";
import {
  getDashboard,
  getAvailableCourses,
  getCourseDetails,
  getMaterials,
  getMaterial,
  downloadMaterial,
} from "../controllers/courseController.js";
import {
  getMyAssignments,
  getAssignmentDetails,
  submitAssignment,
  getSubmissionDetails,
} from "../controllers/assignmentController.js";
import { search } from "../controllers/searchController.js";
import {
  getQuizzes,
  getQuizDetails,
  startQuiz,
  submitQuiz,
  getQuizResult,
} from "../controllers/quizController.js";
import {
  getAnnouncements,
  getAnnouncementDetails,
} from "../controllers/announcementController.js";
import {
  getRecipients,
  getConversations,
  getMessagesWithUser,
  sendMessage,
} from "../controllers/messageController.js";

const router = express.Router();

// Enforce student role on all /api/student routes
router.use(authenticate, requireRole("Student"));

// S01: Course Management & Dashboard
router.get("/dashboard", getDashboard);
router.get("/courses", getAvailableCourses);
router.get("/courses/:courseId", getCourseDetails);
router.get("/courses/:courseId/materials", getMaterials);
router.get("/materials/:materialId", getMaterial);
router.get("/materials/:materialId/download", downloadMaterial);

// S02: Assignments & Submissions
router.get("/assignments", getMyAssignments);
router.get("/assignments/:assignmentId", getAssignmentDetails);
router.post(
  "/assignments/:assignmentId/submit",
  handleSubmissionUpload,
  submitAssignment
);
router.get("/submissions/:submissionId", getSubmissionDetails);

// S03: Quizzes Assessment
router.get("/quizzes", getQuizzes);
router.get("/quizzes/:quizId", getQuizDetails);
router.post("/quizzes/:quizId/start", startQuiz);
router.post("/quizzes/:quizId/submit", submitQuiz);
router.get("/quiz-attempts/:attemptId/result", getQuizResult);

// S04: Student Communication — Announcements
router.get("/announcements", getAnnouncements);
router.get("/announcements/:announcementId", getAnnouncementDetails);

// S04: Student Communication — Messaging
router.get("/recipients", getRecipients);
router.get("/messages/conversations", getConversations);
router.get("/messages/:userId", getMessagesWithUser);
router.post("/messages", sendMessage);

// S05: Search
router.get("/search", search);

export default router;
