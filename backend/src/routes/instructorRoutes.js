import express from "express";
import {
  getAssignedCourses,
  getAssignedCourseStudents,
  getInstructorDashboard,
  getManagedCourse,
} from "../controllers/instructorCourseController.js";
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

export default router;
