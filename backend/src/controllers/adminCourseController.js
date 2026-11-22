import mongoose from 'mongoose';
import Course from '../models/Course.js';
import Enrollment from '../models/Enrollment.js';
import LearningMaterial from '../models/LearningMaterial.js';
import Assignment from '../models/Assignment.js';
import Quiz from '../models/Quiz.js';
import { authError } from '../config/auth.js';
import { escapeRegex } from '../utils/helpers.js';

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;
const COURSE_CODE_RE = /^[A-Z0-9][A-Z0-9._-]{0,29}$/;
const MAX_CODE_LENGTH = 30;
const MAX_NAME_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 500;

const courseDto = (course, counts) => ({
  id: course._id.toString(),
  _id: course._id.toString(),
  courseCode: course.courseCode,
  code: course.courseCode,
  courseName: course.courseName,
  name: course.courseName,
  description: course.description || '',
  isActive: Boolean(course.isActive),
  status: course.isActive ? 'Active' : 'Inactive',
  ...(counts ? { counts } : {}),
});

function duplicateCodeError(cause) {
  const err = authError(
    409,
    'COURSE_EXISTS',
    'A course with this code already exists.',
    { code: 'This course code is already in use. Enter a different code.' },
  );
  if (cause) err.cause = cause;
  return err;
}

function validateCourseData(body) {
  const fields = {};
  const rawCode = body?.courseCode !== undefined ? body.courseCode : body?.code;
  const trimmedCode = typeof rawCode === 'string' ? rawCode.trim().toUpperCase() : '';
  if (!trimmedCode) {
    fields.code = 'Enter a course code.';
  } else if (trimmedCode.length > MAX_CODE_LENGTH) {
    fields.code = `Use ${MAX_CODE_LENGTH} characters or fewer.`;
  } else if (!COURSE_CODE_RE.test(trimmedCode)) {
    fields.code = 'Use letters, numbers, hyphens, underscores, or dots only.';
  }

  const rawName = body?.courseName !== undefined ? body.courseName : body?.name;
  const courseName = typeof rawName === 'string' ? rawName.trim() : '';
  if (!courseName) {
    fields.name = 'Enter a course name.';
  } else if (courseName.length > MAX_NAME_LENGTH) {
    fields.name = `Use ${MAX_NAME_LENGTH} characters or fewer.`;
  }

  let description = '';
  if (body?.description !== undefined) {
    if (typeof body.description !== 'string') {
      fields.description = 'Description must be text.';
    } else {
      description = body.description.trim();
      if (description.length > MAX_DESCRIPTION_LENGTH) {
        fields.description = `Keep the description to ${MAX_DESCRIPTION_LENGTH} characters or fewer.`;
      }
    }
  }

  if (Object.keys(fields).length > 0) {
    throw authError(400, 'VALIDATION', 'Please check the entered course information.', fields);
  }

  return { courseCode: trimmedCode, courseName, description };
}

function parseTargetStatus(body) {
  const hasIsActive = body && Object.hasOwn(body, 'isActive') && body.isActive !== undefined;
  const hasStatus = body && Object.hasOwn(body, 'status') && body.status !== undefined;
  if (!hasIsActive && !hasStatus) {
    throw authError(400, 'VALIDATION', 'Please specify a valid course status.');
  }
  if (hasIsActive && typeof body.isActive !== 'boolean') {
    throw authError(400, 'VALIDATION', 'Invalid course active flag.');
  }
  if (hasStatus && (typeof body.status !== 'string' || !['Active', 'Inactive'].includes(body.status))) {
    throw authError(400, 'VALIDATION', 'Status must be Active or Inactive.');
  }
  if (hasIsActive && hasStatus && body.isActive !== (body.status === 'Active')) {
    throw authError(400, 'VALIDATION', 'Conflicting course status values provided.');
  }
  return hasIsActive ? body.isActive : body.status === 'Active';
}

async function findCourseByCode(courseCode, excludeId, session) {
  const filter = {
    courseCode: { $regex: `^${escapeRegex(courseCode)}$`, $options: 'i' },
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  };
  const query = Course.findOne(filter).select('_id').lean();
  if (session) query.session(session);
  return query;
}

export async function getCourses(req, res) {
  const { q = '', status, page = '1', limit = '100' } = req.query;
  const validStatus = status === undefined || status === '' || (typeof status === 'string' && ['Active', 'Inactive'].includes(status));
  const pageStr = typeof page === 'string' || typeof page === 'number' ? String(page) : '';
  const limitStr = typeof limit === 'string' || typeof limit === 'number' ? String(limit) : '';
  const pageNum = /^\d+$/.test(pageStr) ? Number(pageStr) : 0;
  const limitNum = /^\d+$/.test(limitStr) ? Number(limitStr) : 0;

  if (
    typeof q !== 'string' ||
    q.length > 254 ||
    !validStatus ||
    pageNum < 1 ||
    pageNum > 100000 ||
    limitNum < 1 ||
    limitNum > 100
  ) {
    throw authError(400, 'VALIDATION', 'Invalid course catalog filter parameters.');
  }

  const trimmedQuery = q.trim();
  const filter = {
    ...(status ? { isActive: status === 'Active' } : {}),
    ...(trimmedQuery
      ? {
          $or: [
            { courseCode: { $regex: escapeRegex(trimmedQuery), $options: 'i' } },
            { courseName: { $regex: escapeRegex(trimmedQuery), $options: 'i' } },
            { description: { $regex: escapeRegex(trimmedQuery), $options: 'i' } },
          ],
        }
      : {}),
  };

  const [records, total] = await Promise.all([
    Course.find(filter)
      .select('courseCode courseName description isActive')
      .sort({ courseCode: 1, _id: 1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
    Course.countDocuments(filter),
  ]);

  res.json({
    status: 'success',
    courses: records.map((record) => courseDto(record)),
    pagination: { page: pageNum, limit: limitNum, total },
  });
}

export async function getCourse(req, res) {
  if (!OBJECT_ID_RE.test(req.params.id)) {
    throw authError(400, 'VALIDATION', 'Invalid course ID.');
  }
  const record = await Course.findById(req.params.id)
    .select('courseCode courseName description isActive')
    .lean();
  if (!record) {
    throw authError(404, 'NOT_FOUND', 'Course not found.');
  }

  const [enrollments, materials, assignments, quizzes] = await Promise.all([
    Enrollment.countDocuments({ courseId: record._id }),
    LearningMaterial.countDocuments({ courseId: record._id }),
    Assignment.countDocuments({ courseId: record._id }),
    Quiz.countDocuments({ courseId: record._id }),
  ]);

  res.json({
    status: 'success',
    course: courseDto(record, { enrollments, materials, assignments, quizzes }),
  });
}

export async function addCourse(req, res) {
  const { courseCode, courseName, description } = validateCourseData(req.body);

  const duplicate = await findCourseByCode(courseCode);
  if (duplicate) {
    throw duplicateCodeError();
  }

  let created;
  try {
    created = await Course.create({
      courseCode,
      courseName,
      description,
      isActive: true,
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw duplicateCodeError(error);
    }
    throw error;
  }

  res.status(201).json({
    status: 'success',
    course: courseDto(created),
    message: 'Course created successfully.',
  });
}

export async function updateCourse(req, res) {
  if (!OBJECT_ID_RE.test(req.params.id)) {
    throw authError(400, 'VALIDATION', 'Invalid course ID.');
  }
  const { courseCode, courseName, description } = validateCourseData(req.body);

  let updated;
  await mongoose.connection.transaction(async (session) => {
    const existing = await Course.findById(req.params.id).session(session);
    if (!existing) {
      throw authError(404, 'NOT_FOUND', 'Course not found.');
    }

    const duplicate = await findCourseByCode(courseCode, existing._id, session);
    if (duplicate) {
      throw duplicateCodeError();
    }

    existing.courseCode = courseCode;
    existing.courseName = courseName;
    existing.description = description;
    try {
      updated = await existing.save({ session });
    } catch (error) {
      if (error?.code === 11000) {
        throw duplicateCodeError(error);
      }
      throw error;
    }
  });

  res.json({
    status: 'success',
    course: courseDto(updated),
    message: 'Course updated successfully.',
  });
}

export async function changeCourseStatus(req, res) {
  if (!OBJECT_ID_RE.test(req.params.id)) {
    throw authError(400, 'VALIDATION', 'Invalid course ID.');
  }
  const nextIsActive = parseTargetStatus(req.body);

  let updated;
  await mongoose.connection.transaction(async (session) => {
    const existing = await Course.findById(req.params.id).session(session);
    if (!existing) {
      throw authError(404, 'NOT_FOUND', 'Course not found.');
    }
    existing.isActive = nextIsActive;
    updated = await existing.save({ session });
  });

  res.json({
    status: 'success',
    course: courseDto(updated),
    message: nextIsActive ? 'Course activated successfully.' : 'Course deactivated successfully.',
  });
}
