import mongoose from "mongoose";
import path from "node:path";
import { stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { authError } from "../config/auth.js";
import Assignment from "../models/Assignment.js";
import Course from "../models/Course.js";
import Enrollment from "../models/Enrollment.js";
import Submission from "../models/Submission.js";
import User from "../models/User.js";
import { withAssignmentWrite } from "../utils/assignmentWrite.js";
import { escapeRegex, resolveSafeFilePath } from "../utils/helpers.js";
import { findEnrolledStudents, requireAssignedCourse } from "./instructorCourseController.js";

const courseFields = "courseCode courseName isActive";
const assignmentFields = "courseId title description dueDate createdAt maxScore";
const listStatuses = ["ALL", "NEEDS_GRADING", "OPEN", "PAST_DUE"];
const submissionRoots = ["uploads", "demo-assets"].map((dir) => fileURLToPath(new URL(`../../${dir}`, import.meta.url)));

function requireId(value, field) {
  if (!mongoose.isObjectIdOrHexString(value)) throw authError(400, `INVALID_${field.toUpperCase()}_ID`, `Invalid ${field} ID.`);
}

async function assignedCourse(assignment, instructorId, session = null) {
  const course = await Course.findOne({ _id: assignment.courseId, instructorId }).select(courseFields).session(session).lean();
  if (!course) throw authError(404, "ASSIGNMENT_NOT_FOUND", "Assignment not found.");
  return course;
}

function requireActiveCourse(course) {
  if (course.isActive === false) throw authError(409, "COURSE_INACTIVE", "This course is inactive.");
}

function assignmentData(assignment, course) {
  const { _id, title, description, dueDate, createdAt, maxScore } = assignment;
  return { _id, courseId: course, title, description, dueDate, createdAt, maxScore: maxScore ?? 10 };
}

function submissionData(submission) {
  const { _id, content, fileUrl, fileName, fileSize, grade, feedback, submittedAt, __v } = submission;
  return { _id, content, hasFile: Boolean(fileUrl), fileName, fileSize, grade: grade ?? null, feedback, submittedAt, revision: __v ?? 0 };
}

function submissionSummary(submission) {
  const { content, feedback: _feedback, ...summary } = submissionData(submission);
  return { ...summary, preview: content?.slice(0, 160) };
}

function validateAssignment(body, original = {}) {
  const { title = original.title, description = original.description ?? "", dueDate = original.dueDate, maxScore = original.maxScore ?? 10 } = body;
  if (typeof title !== "string" || !title.trim() || title.trim().length > 200) {
    throw authError(400, "INVALID_ASSIGNMENT_TITLE", "Enter a title of at most 200 characters.");
  }
  if (typeof description !== "string" || description.trim().length > 5000) {
    throw authError(400, "INVALID_ASSIGNMENT_DESCRIPTION", "Instructions must be at most 5000 characters.");
  }
  const deadline = typeof dueDate === "string" && /T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(dueDate) ? new Date(dueDate) : dueDate;
  if (!(deadline instanceof Date) || !Number.isFinite(deadline.getTime())) {
    throw authError(400, "INVALID_ASSIGNMENT_DEADLINE", "Enter a valid due date and time with a timezone.");
  }
  if (!Number.isFinite(maxScore) || maxScore <= 0) {
    throw authError(400, "INVALID_ASSIGNMENT_MAX_SCORE", "Maximum score must be greater than zero.");
  }
  return { title: title.trim(), description: description.trim(), dueDate: deadline, maxScore };
}

async function getAssignedAssignment(assignmentId, instructorId) {
  requireId(assignmentId, "assignment");
  const assignment = await Assignment.findById(assignmentId).select(assignmentFields).lean();
  if (!assignment) throw authError(404, "ASSIGNMENT_NOT_FOUND", "Assignment not found.");
  return { assignment, course: await assignedCourse(assignment, instructorId) };
}

export async function listInstructorAssignments(req, res) {
  const { courseId, q = "", status = "ALL" } = req.query;
  if (typeof q !== "string" || q.length > 200 || !listStatuses.includes(status)) {
    throw authError(400, "INVALID_ASSIGNMENT_FILTER", "Invalid assignment search or status filter.");
  }
  const courses = courseId === undefined
    ? await Course.find({ instructorId: req.user._id }).select(courseFields).lean()
    : [await requireAssignedCourse(courseId, req.user._id, courseFields)];
  const courseById = new Map(courses.map((course) => [String(course._id), course]));
  const courseIds = courses.map(({ _id }) => _id);
  const filter = { courseId: { $in: courseIds } };
  if (status === "OPEN") filter.dueDate = { $gte: new Date() };
  if (status === "PAST_DUE") filter.dueDate = { $lt: new Date() };
  if (q.trim()) {
    const term = new RegExp(escapeRegex(q.trim()), "i");
    const matchingCourses = courses.filter(({ courseCode }) => term.test(courseCode));
    filter.$or = [{ title: term }, { description: term }, { courseId: { $in: matchingCourses.map(({ _id }) => _id) } }];
  }
  const assignments = await Assignment.find(filter).select(assignmentFields).sort({ dueDate: -1, _id: -1 }).lean();
  if (!assignments.length) return res.json({ status: "success", data: [] });
  const [enrollmentCounts, submissionCounts] = await Promise.all([
    Enrollment.aggregate([{ $match: { courseId: { $in: courseIds } } }, { $group: { _id: "$courseId", count: { $sum: 1 } } }]),
    Submission.aggregate([
      { $match: { assignmentId: { $in: assignments.map(({ _id }) => _id) } } },
      { $sort: { submittedAt: -1, _id: -1 } },
      { $group: { _id: { assignmentId: "$assignmentId", studentId: "$studentId" }, grade: { $first: "$grade" } } },
      { $group: {
        _id: "$_id.assignmentId", submissionCount: { $sum: 1 },
        gradedCount: { $sum: { $cond: [{ $isNumber: "$grade" }, 1, 0] } },
      } },
    ]),
  ]);
  const enrollments = new Map(enrollmentCounts.map(({ _id, count }) => [String(_id), count]));
  const counts = new Map(submissionCounts.map((count) => [String(count._id), count]));
  const data = assignments.map((assignment) => {
    const courseKey = String(assignment.courseId);
    const { submissionCount = 0, gradedCount = 0 } = counts.get(String(assignment._id)) ?? {};
    return {
      ...assignmentData(assignment, courseById.get(courseKey)),
      enrolledCount: enrollments.get(courseKey) ?? 0, submissionCount, gradedCount, ungradedCount: submissionCount - gradedCount,
    };
  });
  res.json({ status: "success", data: status === "NEEDS_GRADING" ? data.filter((item) => item.ungradedCount > 0) : data });
}

export async function getInstructorAssignment(req, res) {
  const { assignment, course } = await getAssignedAssignment(req.params.assignmentId, req.user._id);
  const [enrolled, submissions] = await Promise.all([
    findEnrolledStudents(course._id),
    Submission.find({ assignmentId: assignment._id }).sort({ submittedAt: -1, _id: -1 }).lean(),
  ]);
  const latestByStudent = new Map();
  for (const submission of submissions) {
    const studentKey = String(submission.studentId);
    if (!latestByStudent.has(studentKey)) latestByStudent.set(studentKey, submission);
  }
  const enrolledIds = new Set(enrolled.map(({ _id }) => String(_id)));
  const historicalIds = [...latestByStudent.keys()].filter((studentId) => !enrolledIds.has(studentId));
  const historical = historicalIds.length
    ? await User.find({ _id: { $in: historicalIds }, role: "Student" }).select("fullName email").sort({ fullName: 1, _id: 1 }).lean()
    : [];
  const knownIds = new Set(historical.map(({ _id }) => String(_id)));
  const unavailable = historicalIds.filter((studentId) => !knownIds.has(studentId))
    .map((_id) => ({ _id, fullName: "Student account unavailable", email: "" }));
  const rosterSubmissions = [...enrolled, ...historical, ...unavailable].map((student) => {
    const submission = latestByStudent.get(String(student._id));
    return {
      student,
      submission: submission ? submissionSummary(submission) : null,
      status: submission ? (submission.grade == null ? "SUBMITTED" : "GRADED") : "NOT_SUBMITTED",
      isLate: Boolean(submission && submission.submittedAt > assignment.dueDate),
    };
  });
  res.json({ status: "success", data: { assignment: { ...assignmentData(assignment, course), enrolledCount: enrolled.length }, rosterSubmissions } });
}

async function getAssignedSubmission(req) {
  const { assignmentId, submissionId } = req.params;
  requireId(submissionId, "submission");
  const { assignment } = await getAssignedAssignment(assignmentId, req.user._id);
  const submission = await Submission.findOne({ _id: submissionId, assignmentId: assignment._id }).lean();
  if (!submission) throw authError(404, "SUBMISSION_NOT_FOUND", "Submission not found.");
  return submission;
}

export async function getAssignmentSubmission(req, res) {
  res.json({ status: "success", data: submissionData(await getAssignedSubmission(req)) });
}

export async function createAssignment(req, res) {
  const course = await requireAssignedCourse(req.params.courseId, req.user._id, courseFields);
  requireActiveCourse(course);
  const assignment = await Assignment.create({ ...validateAssignment(req.body ?? {}), courseId: course._id });
  res.status(201).json({ status: "success", message: "Assignment created successfully.", data: assignmentData(assignment, course) });
}

function writeAssignedAssignment(req, write) {
  const { assignmentId } = req.params;
  requireId(assignmentId, "assignment");
  return withAssignmentWrite(assignmentId, async (assignment, session) => {
    const course = await assignedCourse(assignment, req.user._id, session);
    requireActiveCourse(course);
    return write(assignment, course, session);
  });
}

export async function updateAssignment(req, res) {
  const data = await writeAssignedAssignment(req, async (assignment, course, session) => {
    const changes = validateAssignment(req.body ?? {}, assignment);
    if (changes.maxScore < (assignment.maxScore ?? 10)
      && await Submission.exists({ assignmentId: assignment._id, grade: { $gt: changes.maxScore } }).session(session)) {
      throw authError(409, "ASSIGNMENT_MAX_SCORE_CONFLICT", "The maximum score cannot be below a grade already recorded.");
    }
    await Assignment.updateOne({ _id: assignment._id }, { $set: changes }, { session, runValidators: true });
    return assignmentData({ ...assignment, ...changes }, course);
  });
  res.json({ status: "success", message: "Assignment updated successfully.", data });
}

export async function deleteAssignment(req, res) {
  await writeAssignedAssignment(req, async (assignment, _course, session) => {
    if (await Submission.exists({ assignmentId: assignment._id }).session(session)) {
      throw authError(409, "ASSIGNMENT_HAS_SUBMISSIONS", "An assignment with submissions cannot be deleted.");
    }
    await Assignment.deleteOne({ _id: assignment._id }, { session });
  });
  res.status(204).end();
}

export async function gradeAssignmentSubmission(req, res) {
  const { submissionId } = req.params;
  const { grade, feedback = "", revision } = req.body ?? {};
  requireId(submissionId, "submission");
  if (!Number.isFinite(grade) || grade < 0 || typeof feedback !== "string" || feedback.trim().length > 5000) {
    throw authError(400, "INVALID_SUBMISSION_GRADE", "Enter a nonnegative score and feedback of at most 5000 characters.");
  }
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw authError(400, "INVALID_SUBMISSION_REVISION", "Reload the submission before grading.");
  }
  const data = await writeAssignedAssignment(req, async (assignment, _course, session) => {
    if (grade > (assignment.maxScore ?? 10)) {
      throw authError(400, "GRADE_OUT_OF_RANGE", `Grade must be between 0 and ${assignment.maxScore ?? 10}.`);
    }
    const filter = { _id: submissionId, assignmentId: assignment._id };
    const submission = await Submission.findOne(filter).session(session).lean();
    if (!submission) throw authError(404, "SUBMISSION_NOT_FOUND", "Submission not found.");
    if ((submission.__v ?? 0) !== revision) {
      throw authError(409, "SUBMISSION_CHANGED", "This submission changed. Reload it before saving the grade.");
    }
    const graded = await Submission.findOneAndUpdate(filter, { $set: { grade, feedback: feedback.trim() }, $inc: { __v: 1 } },
      { session, returnDocument: "after", runValidators: true }).lean();
    return submissionData(graded);
  });
  res.json({ status: "success", data });
}

export async function downloadAssignmentSubmission(req, res) {
  const submission = await getAssignedSubmission(req);
  const fileUrl = submission.fileUrl?.replace(/\\/g, "/");
  if (!fileUrl) throw authError(404, "SUBMISSION_FILE_NOT_FOUND", "No file is attached to this submission.");
  const file = resolveSafeFilePath(fileUrl, submissionRoots);
  const insideSubmissionRoot = file.isAllowed && submissionRoots.some((root) => file.resolvedPath.startsWith(path.join(root, "submissions") + path.sep));
  const fileInfo = insideSubmissionRoot && await stat(file.resolvedPath).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  });
  if (!fileInfo || !fileInfo.isFile()) {
    throw authError(404, "SUBMISSION_FILE_NOT_FOUND", "The attached file could not be found.");
  }
  return res.download(file.resolvedPath, submission.fileName || path.basename(file.resolvedPath), { headers: { "X-Content-Type-Options": "nosniff" } });
}
