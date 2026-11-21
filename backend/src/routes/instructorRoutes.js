import express from "express";
import { getAssignedCourses, getInstructorDashboard, getManagedCourse } from "../controllers/instructorCourseController.js";
import { authenticate, requireRole } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.use(authenticate, requireRole("Instructor"));
router.get("/dashboard", getInstructorDashboard);
router.get("/courses", getAssignedCourses);
router.get("/courses/:courseId", getManagedCourse);

export default router;
