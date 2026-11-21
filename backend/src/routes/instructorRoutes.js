import express from "express";
import {
  getAssignedCourses,
  getAssignedCourseStudents,
  getInstructorDashboard,
  getManagedCourse,
} from "../controllers/instructorCourseController.js";
import {
  createAssignment,
  deleteAssignment,
  downloadAssignmentSubmission,
  getAssignmentSubmission,
  getInstructorAssignment,
  gradeAssignmentSubmission,
  listInstructorAssignments,
  updateAssignment,
} from "../controllers/instructorAssignmentController.js";
import {
  authorizeMaterialChange,
  authorizeMaterialCreation,
  createMaterial,
  deleteMaterial,
  downloadInstructorMaterial,
  getInstructorMaterials,
  updateMaterial,
} from "../controllers/instructorMaterialController.js";
import { authenticate, requireRole } from "../middlewares/authMiddleware.js";
import {
  createQuiz,
  deleteQuiz,
  getInstructorQuiz,
  getInstructorQuizResults,
  listInstructorQuizzes,
  updateQuiz,
} from "../controllers/instructorQuizController.js";
import { uploadMaterialFile } from "../middlewares/materialUpload.js";

const router = express.Router();

router.use(authenticate, requireRole("Instructor"));
router.get("/dashboard", getInstructorDashboard);
router.get("/courses", getAssignedCourses);
router.get("/courses/:courseId", getManagedCourse);
router.get("/courses/:courseId/students", getAssignedCourseStudents);
router.get("/materials", getInstructorMaterials);
router.post("/courses/:courseId/materials", authorizeMaterialCreation, uploadMaterialFile, createMaterial);
router.get("/materials/:materialId/download", downloadInstructorMaterial);
router.put("/materials/:materialId", authorizeMaterialChange, uploadMaterialFile, updateMaterial);
router.delete("/materials/:materialId", authorizeMaterialChange, deleteMaterial);
router.get("/assignments", listInstructorAssignments);
router.post("/courses/:courseId/assignments", createAssignment);
router.get("/assignments/:assignmentId", getInstructorAssignment);
router.put("/assignments/:assignmentId", updateAssignment);
router.delete("/assignments/:assignmentId", deleteAssignment);
router.get("/assignments/:assignmentId/submissions/:submissionId", getAssignmentSubmission);
router.get("/assignments/:assignmentId/submissions/:submissionId/download", downloadAssignmentSubmission);
router.patch("/assignments/:assignmentId/submissions/:submissionId/grade", gradeAssignmentSubmission);
router.get("/quizzes", listInstructorQuizzes);
router.post("/courses/:courseId/quizzes", createQuiz);
router.get("/quizzes/:quizId", getInstructorQuiz);
router.put("/quizzes/:quizId", updateQuiz);
router.delete("/quizzes/:quizId", deleteQuiz);
router.get("/quizzes/:quizId/results", getInstructorQuizResults);

export default router;
