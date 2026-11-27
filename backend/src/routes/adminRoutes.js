import express from 'express';
import { authenticate, requireRole } from '../middlewares/authMiddleware.js';
import { listRecoveryRequests, resolveRecoveryRequest } from '../controllers/passwordResetController.js';
import { getUsers, getUser, addUser, updateUser, changeUserStatus } from '../controllers/userController.js';
import { getCourses, getCourse, addCourse, updateCourse, changeCourseStatus } from '../controllers/adminCourseController.js';
import {
  getEnrollmentCourses,
  getCourseEnrollment,
  getEnrollmentCandidates,
  enrollStudent,
  unenrollStudent,
  assignInstructor,
  unassignInstructor,
} from '../controllers/enrollmentController.js';
import { rateLimit } from '../middlewares/authSecurity.js';
import { getAdminDashboard } from '../controllers/adminDashboardController.js';
import { getStatistics } from '../controllers/statisticController.js';
const router = express.Router();
router.use(authenticate, requireRole('Administrator'));
router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
router.get('/dashboard', getAdminDashboard);
router.get('/statistics', getStatistics);
router.get('/users', getUsers);
router.get('/users/:id', getUser);
router.post('/users', rateLimit('admin-user-write', 60), addUser);
router.patch('/users/:id', rateLimit('admin-user-write', 60), updateUser);
router.patch('/users/:id/status', rateLimit('admin-user-write', 60), changeUserStatus);
router.get('/courses', getCourses);
router.get('/courses/:id', getCourse);
router.post('/courses', rateLimit('admin-course-write', 60), addCourse);
router.patch('/courses/:id', rateLimit('admin-course-write', 60), updateCourse);
router.patch('/courses/:id/status', rateLimit('admin-course-write', 60), changeCourseStatus);
router.get('/enrollments/courses', getEnrollmentCourses);
router.get('/enrollments/courses/:courseId', getCourseEnrollment);
router.get('/enrollments/courses/:courseId/candidates', getEnrollmentCandidates);
router.post('/enrollments/courses/:courseId/students', rateLimit('admin-enrollment-write', 60), enrollStudent);
router.delete('/enrollments/courses/:courseId/students/:studentId', rateLimit('admin-enrollment-write', 60), unenrollStudent);
router.put('/enrollments/courses/:courseId/instructor', rateLimit('admin-enrollment-write', 60), assignInstructor);
router.delete('/enrollments/courses/:courseId/instructor', rateLimit('admin-enrollment-write', 60), unassignInstructor);
router.get('/recovery-requests', listRecoveryRequests);
router.patch('/recovery-requests/:id', rateLimit('admin-reset', 30), resolveRecoveryRequest);
export default router;
