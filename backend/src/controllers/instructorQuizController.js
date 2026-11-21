import mongoose from "mongoose";
import { authError } from "../config/auth.js";
import Course from "../models/Course.js";
import Quiz from "../models/Quiz.js";
import QuizAttempt from "../models/QuizAttempt.js";
import User from "../models/User.js";
import { escapeRegex } from "../utils/helpers.js";
import { quizAnswerReview, quizMaxScore, quizScoreSummary, QUIZ_PASS_PERCENTAGE } from "../utils/quizScoring.js";
import { withQuizWrite } from "../utils/quizWrite.js";
import { findEnrolledStudents, requireAssignedCourse } from "./instructorCourseController.js";
import { calculateQuizStatus } from "./quizController.js";

const courseFields = "courseCode courseName isActive";
const statuses = ["ALL", "AVAILABLE", "UPCOMING", "EXPIRED"];
const timedFields = ["startTime", "endTime", "timeLimit", "questions"];

function requireQuizId(quizId) {
  if (!mongoose.isObjectIdOrHexString(quizId)) throw authError(400, "INVALID_QUIZ_ID", "Invalid quiz ID.");
}

async function quizCourse(quiz, instructorId, session = null) {
  const course = await Course.findOne({ _id: quiz.courseId, instructorId }).select(courseFields).session(session).lean();
  if (!course) throw authError(404, "QUIZ_NOT_FOUND", "Quiz not found.");
  return course;
}

function requireActiveCourse(course) {
  if (course.isActive === false) throw authError(409, "COURSE_INACTIVE", "This course is inactive.");
}

async function assignedQuiz(quizId, instructorId) {
  requireQuizId(quizId);
  const quiz = await Quiz.findById(quizId).lean();
  if (!quiz) throw authError(404, "QUIZ_NOT_FOUND", "Quiz not found.");
  return { quiz, course: await quizCourse(quiz, instructorId) };
}

function quizData(quiz, course, now = new Date()) {
  const { _id, title, description, startTime, endTime, timeLimit } = quiz;
  return {
    _id, courseId: course, title, description, startTime, endTime, timeLimit,
    maxScore: quizMaxScore(quiz), questionCount: quiz.questions?.length ?? 0,
    computedStatus: calculateQuizStatus(quiz, null, now),
  };
}

function quizMetadata(body, original) {
  const { title = original.title, description = original.description ?? "" } = body;
  if (typeof title !== "string" || !title.trim() || title.trim().length > 200) {
    throw authError(400, "INVALID_QUIZ_TITLE", "Enter a title of at most 200 characters.");
  }
  if (typeof description !== "string" || description.trim().length > 5000) {
    throw authError(400, "INVALID_QUIZ_DESCRIPTION", "Instructions must be at most 5000 characters.");
  }
  return { title: title.trim(), description: description.trim() };
}

function quizDate(value) {
  if (value instanceof Date) return value;
  return typeof value === "string" && /T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? new Date(value) : new Date(NaN);
}

function validText(value, max) {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= max;
}

function validateQuestions(questions) {
  if (!Array.isArray(questions) || !questions.length) {
    throw authError(400, "INVALID_QUIZ_QUESTIONS", "Add at least one question.");
  }
  const questionIds = new Set();
  return questions.map((question, index) => {
    const { id, type = "single_choice", prompt, points, options, correctOptionId, explanation = "" } = question ?? {};
    const invalid = (message) => authError(400, "INVALID_QUIZ_QUESTION", `Question ${index + 1}: ${message}`);
    if (!validText(id, 100) || questionIds.has(id.trim()) || type !== "single_choice" || !validText(prompt, 2000)) {
      throw invalid("Use a unique single-choice question with a prompt of at most 2000 characters.");
    }
    if (!Number.isFinite(points) || points <= 0) throw invalid("Points must be greater than zero.");
    if (!Array.isArray(options) || options.length < 2 || options.length > 10) {
      throw invalid("Enter between two and ten answer options.");
    }
    const optionIds = new Set();
    const normalizedOptions = options.map((option) => {
      const { id, text } = option ?? {};
      if (!validText(id, 30) || optionIds.has(id.trim()) || !validText(text, 1000)) {
        throw invalid("Each option must have a unique ID and text of at most 1000 characters.");
      }
      optionIds.add(id.trim());
      return { id: id.trim(), text: text.trim() };
    });
    if (typeof correctOptionId !== "string" || !optionIds.has(correctOptionId.trim())) {
      throw invalid("Select one of the available options as the correct answer.");
    }
    if (explanation !== null && (typeof explanation !== "string" || explanation.trim().length > 2000)) {
      throw invalid("Explanation must be at most 2000 characters.");
    }
    questionIds.add(id.trim());
    return { id: id.trim(), type, prompt: prompt.trim(), points, options: normalizedOptions, correctOptionId: correctOptionId.trim(), explanation: explanation?.trim() || null };
  });
}

function quizConfiguration(body, original) {
  const startTime = quizDate(body.startTime ?? original.startTime);
  const endTime = quizDate(body.endTime ?? original.endTime);
  if (!(startTime < endTime)) throw authError(400, "INVALID_QUIZ_SCHEDULE", "The closing time must be after the opening time.");
  const timeLimit = body.timeLimit ?? original.timeLimit;
  if (!Number.isSafeInteger(timeLimit) || timeLimit < 1) {
    throw authError(400, "INVALID_QUIZ_TIME_LIMIT", "Enter a time limit of at least one whole minute.");
  }
  const questions = validateQuestions(body.questions ?? original.questions);
  const maxScore = quizMaxScore({ questions });
  if (!Number.isFinite(maxScore)) throw authError(400, "INVALID_QUIZ_SCORE", "The total score is too large.");
  return { startTime, endTime, timeLimit, questions, maxScore };
}

export async function listInstructorQuizzes(req, res) {
  const { courseId, q = "", status = "ALL" } = req.query;
  if (typeof q !== "string" || q.length > 200 || !statuses.includes(status)) {
    throw authError(400, "INVALID_QUIZ_FILTER", "Invalid quiz search or status filter.");
  }
  const courses = courseId === undefined
    ? await Course.find({ instructorId: req.user._id }).select(courseFields).lean()
    : [await requireAssignedCourse(courseId, req.user._id, courseFields)];
  const courseById = new Map(courses.map((course) => [String(course._id), course]));
  const filter = { courseId: { $in: courses.map(({ _id }) => _id) } };
  const now = new Date();
  if (status === "UPCOMING") filter.startTime = { $gt: now };
  if (status === "EXPIRED") filter.endTime = { $lt: now };
  if (status === "AVAILABLE") {
    filter.startTime = { $lte: now };
    filter.endTime = { $gte: now };
  }
  if (q.trim()) {
    const term = new RegExp(escapeRegex(q.trim()), "i");
    const matchingCourses = courses.filter(({ courseCode }) => term.test(courseCode));
    filter.$or = [{ title: term }, { description: term }, { courseId: { $in: matchingCourses.map(({ _id }) => _id) } }];
  }

  const quizzes = await Quiz.find(filter).select("courseId title description startTime endTime timeLimit questions.points")
    .sort({ startTime: -1, _id: -1 }).lean();
  if (!quizzes.length) return res.json({ status: "success", data: [] });
  const counts = await QuizAttempt.aggregate([
    { $match: { quizId: { $in: quizzes.map(({ _id }) => _id) } } },
    { $sort: { submittedAt: -1, startedAt: -1, _id: -1 } },
    { $group: { _id: { quizId: "$quizId", studentId: "$studentId" }, submittedAt: { $first: "$submittedAt" }, result: { $first: "$result" } } },
    { $group: {
      _id: "$_id.quizId",
      attemptCount: { $sum: { $cond: [{ $eq: [{ $type: "$submittedAt" }, "date"] }, 1, 0] } },
      avgScore: { $avg: { $cond: [{ $eq: [{ $type: "$submittedAt" }, "date"] }, { $ifNull: ["$result", 0] }, null] } },
    } },
  ]);
  const byQuiz = new Map(counts.map((row) => [String(row._id), row]));
  res.json({ status: "success", data: quizzes.map((quiz) => {
    const count = byQuiz.get(String(quiz._id));
    return {
      ...quizData(quiz, courseById.get(String(quiz.courseId)), now),
      hasAttempts: Boolean(count), attemptCount: count?.attemptCount ?? 0,
      avgScore: count?.avgScore == null ? null : Number(count.avgScore.toFixed(1)),
    };
  }) });
}

export async function getInstructorQuiz(req, res) {
  const { quiz, course } = await assignedQuiz(req.params.quizId, req.user._id);
  const hasAttempts = Boolean(await QuizAttempt.exists({ quizId: quiz._id }));
  res.json({ status: "success", data: { ...quizData(quiz, course), hasAttempts, questions: quiz.questions } });
}

export async function createQuiz(req, res) {
  const course = await requireAssignedCourse(req.params.courseId, req.user._id, courseFields);
  requireActiveCourse(course);
  const body = req.body ?? {};
  const quiz = await Quiz.create({ courseId: course._id, ...quizMetadata(body, {}), ...quizConfiguration(body, {}) });
  res.status(201).json({ status: "success", message: "Quiz created successfully.", data: quizData(quiz, course) });
}

function writeAssignedQuiz(req, write) {
  const { quizId } = req.params;
  requireQuizId(quizId);
  return withQuizWrite(quizId, async (quiz, session) => {
    const course = await quizCourse(quiz, req.user._id, session);
    requireActiveCourse(course);
    const hasAttempts = Boolean(await QuizAttempt.exists({ quizId: quiz._id }).session(session));
    return write(quiz, course, session, hasAttempts);
  });
}

export async function updateQuiz(req, res) {
  const data = await writeAssignedQuiz(req, async (quiz, course, session, hasAttempts) => {
    const body = req.body ?? {};
    const changes = quizMetadata(body, quiz);
    if (timedFields.some((field) => Object.hasOwn(body, field))) {
      if (hasAttempts) throw authError(409, "QUIZ_ATTEMPTS_STARTED", "Quiz questions, schedule and time limit are locked after the first attempt. Reload to edit the title or description.");
      Object.assign(changes, quizConfiguration(body, quiz));
    }
    await Quiz.updateOne({ _id: quiz._id }, { $set: changes }, { session, runValidators: true });
    return quizData({ ...quiz, ...changes }, course);
  });
  res.json({ status: "success", message: "Quiz updated successfully.", data });
}

export async function deleteQuiz(req, res) {
  await writeAssignedQuiz(req, async (quiz, _course, session, hasAttempts) => {
    if (hasAttempts) throw authError(409, "QUIZ_HAS_ATTEMPTS", "A quiz with attempts cannot be deleted.");
    await Quiz.deleteOne({ _id: quiz._id }, { session });
  });
  res.status(204).end();
}

function completedAttempt(quiz, attempt) {
  const elapsed = (attempt.submittedAt - attempt.startedAt) / 1000;
  const duration = Number.isFinite(elapsed) && attempt.startedAt ? Math.max(0, Math.floor(elapsed)) : null;
  const detailedReview = quizAnswerReview(quiz, attempt.answers).map((item) => ({
    ...item,
    questionId: item.id,
    selectedOptionText: item.options?.find(({ id }) => id === item.selectedOptionId)?.text,
    correctOptionText: item.options?.find(({ id }) => id === item.correctOptionId)?.text,
  }));
  return {
    _id: attempt._id, startedAt: attempt.startedAt, submittedAt: attempt.submittedAt,
    ...quizScoreSummary(quiz, attempt.result ?? 0), detailedReview,
    durationTaken: duration === null ? null : `${Math.floor(duration / 60)}m ${duration % 60}s`,
  };
}

export async function getInstructorQuizResults(req, res) {
  const { quiz, course } = await assignedQuiz(req.params.quizId, req.user._id);
  const [enrolled, attempts] = await Promise.all([
    findEnrolledStudents(course._id),
    QuizAttempt.find({ quizId: quiz._id }).sort({ submittedAt: -1, startedAt: -1, _id: -1 }).lean(),
  ]);
  const attemptByStudent = new Map();
  for (const attempt of attempts) {
    const studentId = String(attempt.studentId);
    if (!attemptByStudent.has(studentId)) attemptByStudent.set(studentId, attempt);
  }
  const enrolledIds = new Set(enrolled.map(({ _id }) => String(_id)));
  const historyIds = [...attemptByStudent.keys()].filter((id) => !enrolledIds.has(id));
  const history = historyIds.length
    ? await User.find({ _id: { $in: historyIds }, role: "Student" }).select("fullName email").sort({ fullName: 1, _id: 1 }).lean()
    : [];
  const knownIds = new Set(history.map(({ _id }) => String(_id)));
  const unavailable = historyIds.filter((id) => !knownIds.has(id)).map((_id) => ({ _id, fullName: "Student account unavailable", email: "" }));
  const now = new Date();
  const rosterAttempts = [...enrolled, ...history, ...unavailable].map((student) => {
    const attempt = attemptByStudent.get(String(student._id));
    return {
      student,
      status: attempt ? calculateQuizStatus(quiz, attempt, now) : "NOT_ATTEMPTED",
      attempt: attempt?.submittedAt ? completedAttempt(quiz, attempt) : null,
    };
  });
  const results = rosterAttempts.flatMap(({ attempt }) => attempt ? [attempt] : []);
  const passedCount = results.filter(({ passed }) => passed).length;
  const summary = {
    totalEnrolled: enrolled.length, totalAttempts: results.length,
    avgScore: results.length ? Number((results.reduce((total, { score }) => total + score, 0) / results.length).toFixed(1)) : null,
    highestScore: results.reduce((highest, { score }) => highest === null ? score : Math.max(highest, score), null),
    passRate: results.length ? Math.round(passedCount / results.length * 100) : null,
    passThreshold: QUIZ_PASS_PERCENTAGE,
  };
  res.json({ status: "success", data: { quiz: { ...quizData(quiz, course, now), hasAttempts: Boolean(attempts.length) }, summary, rosterAttempts } });
}
