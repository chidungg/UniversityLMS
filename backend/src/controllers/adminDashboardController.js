import User from '../models/User.js';
import Course from '../models/Course.js';
import Enrollment from '../models/Enrollment.js';
import PasswordResetRequest from '../models/PasswordResetRequest.js';
import LearningMaterial from '../models/LearningMaterial.js';
import Assignment from '../models/Assignment.js';
import Quiz from '../models/Quiz.js';
import { authError } from '../config/auth.js';

function summarizeCountsByCourse(rows) {
  const byCourse = new Map();
  let total = 0;

  for (const row of rows) {
    if (!row?._id) continue;
    const count = Number(row.count) || 0;
    byCourse.set(row._id.toString(), count);
    total += count;
  }

  return { byCourse, total };
}

function summarizeUsers(users) {
  const userById = new Map();
  const counts = {
    total: users.length,
    active: 0,
    students: 0,
    activeStudents: 0,
    instructors: 0,
    activeInstructors: 0,
    administrators: 0,
  };

  for (const user of users) {
    userById.set(user._id.toString(), user);
    const active = Boolean(user.isActive);
    if (active) counts.active += 1;

    if (user.role === 'Student') {
      counts.students += 1;
      if (active) counts.activeStudents += 1;
    } else if (user.role === 'Instructor') {
      counts.instructors += 1;
      if (active) counts.activeInstructors += 1;
    } else if (user.role === 'Administrator') {
      counts.administrators += 1;
    }
  }

  return { userById, counts };
}

function summarizeEnrollments(enrollments) {
  const byCourse = new Map();
  const uniqueStudents = new Set();

  for (const entry of enrollments) {
    if (entry.studentId) uniqueStudents.add(entry.studentId.toString());
    if (!entry.courseId) continue;
    const courseId = entry.courseId.toString();
    byCourse.set(courseId, (byCourse.get(courseId) || 0) + 1);
  }

  return {
    byCourse,
    total: enrollments.length,
    uniqueStudents: uniqueStudents.size,
  };
}

export async function getAdminDashboard(req, res, next) {
  let users;
  let courses;
  let enrollments;
  let pendingResetDocs;
  let materialRows;
  let assignmentRows;
  let quizRows;

  try {
    [
      users,
      courses,
      enrollments,
      pendingResetDocs,
      materialRows,
      assignmentRows,
      quizRows,
    ] = await Promise.all([
      User.find({}).select('fullName email role isActive').lean(),
      Course.find({})
        .select('courseCode courseName description isActive instructorId')
        .sort({ courseCode: 1, _id: 1 })
        .lean(),
      Enrollment.find({}).select('courseId studentId').lean(),
      PasswordResetRequest.find({ status: 'Pending' })
        .select('email note submittedAt accountId')
        .sort({ submittedAt: -1, _id: -1 })
        .lean(),
      LearningMaterial.aggregate([{ $group: { _id: '$courseId', count: { $sum: 1 } } }]),
      Assignment.aggregate([{ $group: { _id: '$courseId', count: { $sum: 1 } } }]),
      Quiz.aggregate([{ $group: { _id: '$courseId', count: { $sum: 1 } } }]),
    ]);
  } catch (err) {
    const wrapped = authError(
      500,
      'DASHBOARD_RETRIEVAL_FAILED',
      'Unable to load dashboard data. Please try again.',
    );
    wrapped.cause = err;
    return next(wrapped);
  }

  const { userById, counts: userCounts } = summarizeUsers(users);
  const enrollmentSummary = summarizeEnrollments(enrollments);
  const materialCounts = summarizeCountsByCourse(materialRows);
  const assignmentCounts = summarizeCountsByCourse(assignmentRows);
  const quizCounts = summarizeCountsByCourse(quizRows);

  let activeCourses = 0;
  let unassignedActive = 0;
  let unenrolledActive = 0;
  const unassignedCourses = [];

  const mappedCourses = courses.map((course) => {
    const id = course._id.toString();
    const isActive = Boolean(course.isActive);
    const instructorDoc = course.instructorId
      ? userById.get(course.instructorId.toString()) || null
      : null;
    const instructor = instructorDoc
      ? {
          id: instructorDoc._id.toString(),
          fullName: instructorDoc.fullName,
          email: instructorDoc.email,
          isActive: Boolean(instructorDoc.isActive),
        }
      : null;

    const enrolledCount = enrollmentSummary.byCourse.get(id) || 0;
    const materialCount = materialCounts.byCourse.get(id) || 0;
    const assignmentCount = assignmentCounts.byCourse.get(id) || 0;
    const quizCount = quizCounts.byCourse.get(id) || 0;

    if (isActive) {
      activeCourses += 1;
      if (!instructor) {
        unassignedActive += 1;
        unassignedCourses.push({
          id,
          code: course.courseCode,
          name: course.courseName,
          enrolledCount,
        });
      }
      if (enrolledCount === 0) {
        unenrolledActive += 1;
      }
    }

    return {
      id,
      code: course.courseCode,
      name: course.courseName,
      description: course.description || '',
      isActive,
      status: isActive ? 'Active' : 'Inactive',
      instructor,
      enrolledCount,
      counts: {
        enrollments: enrolledCount,
        materials: materialCount,
        assignments: assignmentCount,
        quizzes: quizCount,
      },
    };
  });

  const pendingResets = pendingResetDocs.slice(0, 5).map((doc) => ({
    id: doc._id.toString(),
    email: doc.email,
    note: doc.note || '',
    submittedAt: doc.submittedAt || null,
    hasAccount: Boolean(doc.accountId),
  }));

  return res.status(200).json({
    summary: {
      users: userCounts,
      courses: {
        total: mappedCourses.length,
        active: activeCourses,
        inactive: mappedCourses.length - activeCourses,
        unassignedActive,
        unenrolledActive,
      },
      enrollments: {
        total: enrollmentSummary.total,
        uniqueStudents: enrollmentSummary.uniqueStudents,
      },
      pendingPasswordResets: pendingResetDocs.length,
      assessments: {
        materials: materialCounts.total,
        assignments: assignmentCounts.total,
        quizzes: quizCounts.total,
      },
    },
    courses: mappedCourses,
    attention: {
      unassignedCourses,
      pendingResets,
      totalCount: unassignedCourses.length + pendingResetDocs.length,
    },
    generatedAt: new Date().toISOString(),
  });
}
