import express from "express";
import { authenticate, requireRole } from "../middlewares/authMiddleware.js";
import { uploadSubmissionFile } from "../middlewares/uploadMiddleware.js";
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

const router = express.Router();

// Enforce student role on all /api/student routes
router.use(authenticate, requireRole("Student"));

// S01 & Dashboard
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
  uploadSubmissionFile.single("file"),
  submitAssignment
);
router.get("/submissions/:submissionId", getSubmissionDetails);

// S05: Search
router.get("/search", search);

export default router;
