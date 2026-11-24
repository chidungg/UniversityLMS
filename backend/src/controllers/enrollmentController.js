import mongoose from 'mongoose';
import Course from '../models/Course.js';
import Enrollment from '../models/Enrollment.js';
import User from '../models/User.js';
import { authError } from '../config/auth.js';
import { escapeRegex } from '../utils/helpers.js';

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

const userSummaryDto = (user) => ({
  id: user._id.toString(),
  _id: user._id.toString(),
  name: user.fullName,
  fullName: user.fullName,
  email: user.email,
  role: user.role,
  isActive: Boolean(user.isActive),
  status: user.isActive ? 'Active' : 'Inactive',
});

const courseSummaryDto = (course, enrolledCount = 0, instructor = null) => ({
  id: course._id.toString(),
  _id: course._id.toString(),
  code: course.courseCode,
  courseCode: course.courseCode,
  name: course.courseName,
  courseName: course.courseName,
  description: course.description || '',
  isActive: Boolean(course.isActive),
  status: course.isActive ? 'Active' : 'Inactive',
  instructorId: course.instructorId ? course.instructorId.toString() : null,
  instructor: instructor ? userSummaryDto(instructor) : null,
  enrolledCount,
});

const enrollmentRowDto = (enrollment, student = null) => ({
  id: enrollment._id.toString(),
  courseId: enrollment.courseId.toString(),
  studentId: enrollment.studentId.toString(),
  enrolledAt: enrollment.enrolledAt || null,
  student: student ? userSummaryDto(student) : null,
});

function duplicateEnrollmentError(studentName, courseCode, cause) {
  const err = authError(409, 'ALREADY_ENROLLED', `${studentName} is already enrolled in ${courseCode}.`);
  if (cause) err.cause = cause;
  return err;
}

export async function getEnrollmentCourses(req, res) {
  const [courses, countRows] = await Promise.all([
    Course.find({})
      .select('courseCode courseName description isActive instructorId')
      .sort({ courseCode: 1, _id: 1 })
      .lean(),
    Enrollment.aggregate([{ $group: { _id: '$courseId', count: { $sum: 1 } } }]),
  ]);

  const countMap = new Map(countRows.map((entry) => [entry._id.toString(), entry.count]));
  const instructorIds = [...new Set(courses.map((course) => course.instructorId?.toString()).filter(Boolean))];
  const instructors = instructorIds.length
    ? await User.find({ _id: { $in: instructorIds } })
        .select('fullName email role isActive')
        .lean()
    : [];
  const instructorMap = new Map(instructors.map((user) => [user._id.toString(), user]));

  res.json({
    status: 'success',
    courses: courses.map((course) => {
      const id = course._id.toString();
      const instructor = course.instructorId ? instructorMap.get(course.instructorId.toString()) || null : null;
      return courseSummaryDto(course, countMap.get(id) || 0, instructor);
    }),
  });
}

export async function getCourseEnrollment(req, res) {
  const { courseId } = req.params;
  if (!OBJECT_ID_RE.test(courseId)) {
    throw authError(400, 'VALIDATION', 'Invalid course ID.');
  }

  const course = await Course.findById(courseId)
    .select('courseCode courseName description isActive instructorId')
    .lean();
  if (!course) {
    throw authError(404, 'COURSE_NOT_FOUND', 'Course not found.');
  }

  const enrollments = await Enrollment.find({ courseId: course._id })
    .sort({ enrolledAt: -1, _id: -1 })
    .lean();

  const userIds = [
    ...new Set([
      ...(course.instructorId ? [course.instructorId.toString()] : []),
      ...enrollments.map((entry) => entry.studentId.toString()),
    ]),
  ];
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } })
        .select('fullName email role isActive')
        .lean()
    : [];
  const userMap = new Map(users.map((user) => [user._id.toString(), user]));
  const instructorDoc = course.instructorId ? userMap.get(course.instructorId.toString()) || null : null;

  res.json({
    status: 'success',
    course: courseSummaryDto(course, enrollments.length, instructorDoc),
    instructor: instructorDoc ? userSummaryDto(instructorDoc) : null,
    enrollments: enrollments.map((entry) =>
      enrollmentRowDto(entry, userMap.get(entry.studentId.toString()) || null),
    ),
  });
}

export async function getEnrollmentCandidates(req, res) {
  const { courseId } = req.params;
  if (!OBJECT_ID_RE.test(courseId)) {
    throw authError(400, 'VALIDATION', 'Invalid course ID.');
  }

  const { type = 'student', q = '', limit = '50' } = req.query;
  const limitStr = typeof limit === 'string' || typeof limit === 'number' ? String(limit) : '';
  const limitNum = /^\d+$/.test(limitStr) ? Number(limitStr) : 0;
  if (
    typeof type !== 'string' ||
    !['student', 'instructor'].includes(type) ||
    typeof q !== 'string' ||
    q.length > 254 ||
    limitNum < 1 ||
    limitNum > 100
  ) {
    throw authError(400, 'VALIDATION', 'Invalid candidate search parameters.');
  }

  const course = await Course.findById(courseId).select('_id instructorId').lean();
  if (!course) {
    throw authError(404, 'COURSE_NOT_FOUND', 'Course not found.');
  }

  const targetRole = type === 'instructor' ? 'Instructor' : 'Student';
  const trimmedQuery = q.trim();
  const userFilter = trimmedQuery
    ? {
        $or: [
          { fullName: { $regex: escapeRegex(trimmedQuery), $options: 'i' } },
          { email: { $regex: escapeRegex(trimmedQuery), $options: 'i' } },
        ],
      }
    : { role: targetRole };

  const [matchedUsers, enrolledRows] = await Promise.all([
    User.find(userFilter)
      .select('fullName email role isActive')
      .sort({ fullName: 1, _id: 1 })
      .limit(200)
      .lean(),
    type === 'student'
      ? Enrollment.find({ courseId: course._id }).select('studentId').lean()
      : Promise.resolve([]),
  ]);

  const enrolledSet = new Set(enrolledRows.map((entry) => entry.studentId.toString()));
  const currentInstructorId = course.instructorId ? course.instructorId.toString() : '';

  const annotated = matchedUsers
    .map((user) => {
      const uid = user._id.toString();
      const isTargetRole = user.role === targetRole;
      const isActive = Boolean(user.isActive);
      const alreadyEnrolled = type === 'student' && enrolledSet.has(uid);
      const isCurrent = type === 'instructor' && currentInstructorId === uid;
      const eligible = isTargetRole && isActive && !alreadyEnrolled && !isCurrent;
      let reason = '';
      if (alreadyEnrolled) reason = 'ALREADY_ENROLLED';
      else if (isCurrent) reason = 'ALREADY_ASSIGNED';
      else if (!isTargetRole) reason = 'INVALID_ROLE';
      else if (!isActive) reason = 'INACTIVE';

      return {
        user: userSummaryDto(user),
        eligible,
        alreadyEnrolled,
        isCurrent,
        isTargetRole,
        isActive,
        reason,
      };
    })
    .sort((a, b) => {
      if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
      const aExisting = a.alreadyEnrolled || a.isCurrent;
      const bExisting = b.alreadyEnrolled || b.isCurrent;
      if (aExisting !== bExisting) return aExisting ? -1 : 1;
      return a.user.fullName.localeCompare(b.user.fullName, 'en', { sensitivity: 'base' });
    });

  res.json({
    status: 'success',
    candidates: annotated.slice(0, limitNum),
    total: annotated.length,
  });
}

export async function enrollStudent(req, res) {
  const { courseId } = req.params;
  const studentId = req.body?.studentId;
  if (!OBJECT_ID_RE.test(courseId) || typeof studentId !== 'string' || !OBJECT_ID_RE.test(studentId)) {
    throw authError(400, 'VALIDATION', 'Valid course ID and student ID are required.');
  }

  let createdEnrollment;
  let enrolledStudent;
  await mongoose.connection.transaction(async (session) => {
    const course = await Course.findById(courseId).select('courseCode isActive').session(session);
    if (!course) {
      throw authError(404, 'COURSE_NOT_FOUND', 'Course not found.');
    }
    if (!course.isActive) {
      throw authError(409, 'INACTIVE_COURSE', 'This course is inactive. Activate it before enrolling students.');
    }

    const student = await User.findById(studentId).select('fullName email role isActive').session(session);
    if (!student) {
      throw authError(404, 'USER_NOT_FOUND', 'User not found.');
    }
    if (student.role !== 'Student') {
      throw authError(400, 'INVALID_STUDENT', 'Invalid enrollment. Only Student accounts can be enrolled.');
    }
    if (!student.isActive) {
      throw authError(
        409,
        'INACTIVE_STUDENT',
        'Invalid enrollment. Activate this student account before enrolling them.',
      );
    }

    const existing = await Enrollment.findOne({ courseId: course._id, studentId: student._id })
      .select('_id')
      .session(session)
      .lean();
    if (existing) {
      throw duplicateEnrollmentError(student.fullName, course.courseCode);
    }

    try {
      const [created] = await Enrollment.create([{ courseId: course._id, studentId: student._id }], { session });
      createdEnrollment = created;
      enrolledStudent = student;
    } catch (error) {
      if (error?.code === 11000) {
        throw duplicateEnrollmentError(student.fullName, course.courseCode, error);
      }
      throw error;
    }
  });

  res.status(201).json({
    status: 'success',
    enrollment: enrollmentRowDto(createdEnrollment, enrolledStudent),
    student: userSummaryDto(enrolledStudent),
    message: 'Student enrolled successfully.',
  });
}

export async function unenrollStudent(req, res) {
  const { courseId, studentId } = req.params;
  if (!OBJECT_ID_RE.test(courseId) || !OBJECT_ID_RE.test(studentId)) {
    throw authError(400, 'VALIDATION', 'Valid course ID and student ID are required.');
  }

  await mongoose.connection.transaction(async (session) => {
    const course = await Course.findById(courseId).select('_id').session(session);
    if (!course) {
      throw authError(404, 'COURSE_NOT_FOUND', 'Course not found.');
    }

    const deleted = await Enrollment.findOneAndDelete({ courseId: course._id, studentId }).session(session);
    if (!deleted) {
      throw authError(404, 'ENROLLMENT_NOT_FOUND', 'This student is not currently enrolled in the course.');
    }
  });

  res.json({
    status: 'success',
    message: 'Student unenrolled successfully.',
  });
}

export async function assignInstructor(req, res) {
  const { courseId } = req.params;
  const instructorId = req.body?.instructorId;
  if (!OBJECT_ID_RE.test(courseId) || typeof instructorId !== 'string' || !OBJECT_ID_RE.test(instructorId)) {
    throw authError(400, 'VALIDATION', 'Valid course ID and instructor ID are required.');
  }

  let assignedInstructor;
  await mongoose.connection.transaction(async (session) => {
    const course = await Course.findById(courseId).select('courseCode isActive instructorId').session(session);
    if (!course) {
      throw authError(404, 'COURSE_NOT_FOUND', 'Course not found.');
    }
    if (!course.isActive) {
      throw authError(409, 'INACTIVE_COURSE', 'This course is inactive. Activate it before assigning an instructor.');
    }

    const instructor = await User.findById(instructorId).select('fullName email role isActive').session(session);
    if (!instructor) {
      throw authError(404, 'USER_NOT_FOUND', 'User not found.');
    }
    if (instructor.role !== 'Instructor') {
      throw authError(
        400,
        'INVALID_ASSIGNMENT',
        'Invalid assignment. Only accounts with the Instructor role can be assigned.',
      );
    }
    if (!instructor.isActive) {
      throw authError(
        409,
        'INACTIVE_INSTRUCTOR',
        'Invalid assignment. Activate this instructor account before assigning them.',
      );
    }
    if (course.instructorId && course.instructorId.equals(instructor._id)) {
      throw authError(409, 'ALREADY_ASSIGNED', `${instructor.fullName} is already assigned to ${course.courseCode}.`);
    }

    course.instructorId = instructor._id;
    await course.save({ session });
    assignedInstructor = instructor;
  });

  res.json({
    status: 'success',
    instructor: userSummaryDto(assignedInstructor),
    message: 'Instructor assigned successfully.',
  });
}

export async function unassignInstructor(req, res) {
  const { courseId } = req.params;
  if (!OBJECT_ID_RE.test(courseId)) {
    throw authError(400, 'VALIDATION', 'Invalid course ID.');
  }

  await mongoose.connection.transaction(async (session) => {
    const course = await Course.findById(courseId).select('instructorId').session(session);
    if (!course) {
      throw authError(404, 'COURSE_NOT_FOUND', 'Course not found.');
    }
    if (!course.instructorId) {
      throw authError(409, 'NOT_ASSIGNED', 'No instructor is currently assigned to this course.');
    }
    course.instructorId = null;
    await course.save({ session });
  });

  res.json({
    status: 'success',
    message: 'Instructor unassigned successfully.',
  });
}
