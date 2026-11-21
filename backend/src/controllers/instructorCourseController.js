import mongoose from "mongoose";
import { authError } from "../config/auth.js";
import Assignment from "../models/Assignment.js";
import Course from "../models/Course.js";
import Enrollment from "../models/Enrollment.js";
import LearningMaterial from "../models/LearningMaterial.js";
import Quiz from "../models/Quiz.js";
import Submission from "../models/Submission.js";
import User from "../models/User.js";
import { escapeRegex } from "../utils/helpers.js";

const courseFields = "courseCode courseName description isActive";
const managementOptions = ["materials", "assignments", "quizzes"];
const courseCounts = {
  enrolledCount: Enrollment,
  materialCount: LearningMaterial,
  assignmentCount: Assignment,
  quizCount: Quiz,
};

function findAssignedCourses(filter) {
  return Course.find(filter).select(courseFields).sort({ courseCode: 1, _id: 1 }).lean();
}

async function addCourseCounts(courses) {
  if (courses.length === 0) return courses;

  const courseIds = courses.map((course) => course._id);
  const counts = await Promise.all(
    Object.entries(courseCounts).map(async ([field, Model]) => {
      const rows = await Model.aggregate([
        { $match: { courseId: { $in: courseIds } } },
        { $group: { _id: "$courseId", count: { $sum: 1 } } },
      ]);
      return [field, new Map(rows.map(({ _id, count }) => [String(_id), count]))];
    })
  );

  return courses.map((course) => ({
    ...course,
    ...Object.fromEntries(counts.map(([field, byCourse]) => [field, byCourse.get(String(course._id)) ?? 0])),
  }));
}

export async function getAssignedCourses(req, res) {
  const { q = "", status = "all" } = req.query;
  if (typeof q !== "string" || q.length > 200 || !["all", "active", "inactive"].includes(status)) {
    throw authError(400, "INVALID_COURSE_FILTER", "Invalid course search or status filter.");
  }

  const filter = { instructorId: req.user._id };
  if (status === "active") filter.isActive = { $ne: false };
  if (status === "inactive") filter.isActive = false;
  if (q.trim()) {
    const term = new RegExp(escapeRegex(q.trim()), "i");
    filter.$or = [{ courseCode: term }, { courseName: term }, { description: term }];
  }

  const courses = await findAssignedCourses(filter);
  res.json({ status: "success", data: await addCourseCounts(courses) });
}

export async function getInstructorDashboard(req, res) {
  const courses = await addCourseCounts(await findAssignedCourses({ instructorId: req.user._id }));
  const courseIds = courses.map(({ _id }) => _id);
  const courseRefs = new Map(courses.map(({ _id, courseCode, courseName }) => [String(_id), { _id, courseCode, courseName }]));
  const now = new Date();
  const [studentIds, assignments, quizzes] = await Promise.all([
    Enrollment.distinct("studentId", { courseId: { $in: courseIds } }),
    Assignment.find({ courseId: { $in: courseIds } }).select("courseId title dueDate maxScore").lean(),
    Quiz.find({ courseId: { $in: courseIds }, endTime: { $gte: now } })
      .select("courseId title startTime endTime timeLimit")
      .lean(),
  ]);

  const assignmentById = new Map(assignments.map((assignment) => [String(assignment._id), assignment]));
  const pendingFilter = { assignmentId: { $in: assignments.map(({ _id }) => _id) }, grade: null };
  const [pendingByAssignment, recentSubmissions] = await Promise.all([
    Submission.aggregate([{ $match: pendingFilter }, { $group: { _id: "$assignmentId", count: { $sum: 1 } } }]),
    Submission.find(pendingFilter).sort({ submittedAt: -1, _id: -1 }).limit(5)
      .select("assignmentId studentId submittedAt").populate("studentId", "fullName").lean(),
  ]);
  const pendingByCourse = new Map();
  for (const { _id, count } of pendingByAssignment) {
    const courseId = String(assignmentById.get(String(_id)).courseId);
    pendingByCourse.set(courseId, (pendingByCourse.get(courseId) ?? 0) + count);
  }

  const pendingSubmissions = recentSubmissions.map(({ _id, assignmentId, studentId, submittedAt }) => {
    const assignment = assignmentById.get(String(assignmentId));
    return {
      _id, assignmentId, submittedAt,
      student: studentId,
      assignmentTitle: assignment.title,
      course: courseRefs.get(String(assignment.courseId)),
      isLate: submittedAt > assignment.dueDate,
    };
  });

  const upcomingSchedule = [
    ...assignments.filter(({ dueDate }) => dueDate >= now).map((assignment) => ({
      id: assignment._id, kind: "ASSIGNMENT", title: assignment.title, date: assignment.dueDate,
      course: courseRefs.get(String(assignment.courseId)), meta: `Max ${assignment.maxScore ?? 10} pts`,
      to: `/instructor/assignments/${assignment._id}`,
    })),
    ...quizzes.map((quiz) => ({
      id: quiz._id, kind: "QUIZ", title: quiz.title, date: quiz.endTime,
      course: courseRefs.get(String(quiz.courseId)), meta: `${quiz.timeLimit} mins`,
      to: `/instructor/quizzes/${quiz._id}/results`,
    })),
  ].sort((a, b) => a.date - b.date).slice(0, 6);

  res.json({
    status: "success",
    data: {
      instructor: { fullName: req.user.fullName },
      courses: courses.map((course) => ({ ...course, pendingGradingCount: pendingByCourse.get(String(course._id)) ?? 0 })),
      pendingSubmissions,
      upcomingSchedule,
      stats: {
        assignedCourses: courses.filter(({ isActive }) => isActive !== false).length,
        uniqueStudents: studentIds.length,
        pendingGrading: pendingByAssignment.reduce((total, { count }) => total + count, 0),
        activeQuizzes: quizzes.filter(({ startTime }) => startTime <= now).length,
      },
    },
  });
}

export async function requireAssignedCourse(courseId, instructorId, fields = "_id") {
  if (!mongoose.isObjectIdOrHexString(courseId)) {
    throw authError(400, "INVALID_COURSE_ID", "Invalid course ID.");
  }

  const course = await Course.findOne({ _id: courseId, instructorId }).select(fields).lean();
  if (!course) {
    throw authError(404, "COURSE_UNAVAILABLE", "This course is no longer available to you.");
  }
  return course;
}

export async function getManagedCourse(req, res) {
  const course = await requireAssignedCourse(req.params.courseId, req.user._id, courseFields);
  const [summary] = await addCourseCounts([course]);
  res.json({
    status: "success",
    data: {
      course: { ...summary, instructor: req.user.fullName },
      managementOptions: course.isActive === false ? [] : managementOptions,
    },
  });
}

export async function getAssignedCourseStudents(req, res) {
  const course = await requireAssignedCourse(req.params.courseId, req.user._id, "_id");
  const enrollments = await Enrollment.find({ courseId: course._id }).select("studentId enrolledAt -_id").lean();
  if (enrollments.length === 0) return res.json({ status: "success", data: [] });

  const enrollmentByStudent = new Map(enrollments.map((enrollment) => [String(enrollment.studentId), enrollment]));
  const students = await User.find({
    _id: { $in: enrollments.map(({ studentId }) => studentId) },
    role: "Student",
  }).select("fullName email").sort({ fullName: 1, _id: 1 }).lean();

  res.json({
    status: "success",
    data: students.map(({ _id, fullName, email }) => ({
      _id,
      fullName,
      email,
      enrolledAt: enrollmentByStudent.get(String(_id)).enrolledAt ?? null,
    })),
  });
}
