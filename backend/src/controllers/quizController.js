import mongoose from "mongoose";
import Quiz from "../models/Quiz.js";
import QuizAttempt from "../models/QuizAttempt.js";
import Course from "../models/Course.js";
import Enrollment from "../models/Enrollment.js";
import { authError } from "../config/auth.js";
import { quizAnswerReview, quizMaxScore, quizScoreSummary, questionPoints } from "../utils/quizScoring.js";
import { withQuizWrite } from "../utils/quizWrite.js";
import { isStudentEnrolled, getEnrolledCourseIds } from "./courseController.js";

// Helper: Determine quiz status for a student
export const calculateQuizStatus = (quiz, attempt, now = new Date()) => {
  if (attempt && attempt.submittedAt) {
    return "COMPLETED";
  }

  if (attempt && !attempt.submittedAt) {
    const timeLimitMs = quiz.timeLimit * 60 * 1000;
    const isWithinTimeLimit = now.getTime() <= new Date(attempt.startedAt).getTime() + timeLimitMs;
    const isWithinEndTime = now <= new Date(quiz.endTime);

    if (isWithinTimeLimit && isWithinEndTime) {
      return "IN_PROGRESS";
    }
    return "EXPIRED";
  }

  if (now < new Date(quiz.startTime)) {
    return "UPCOMING";
  }

  if (now > new Date(quiz.endTime)) {
    return "EXPIRED";
  }

  return "AVAILABLE";
};

// GET /api/student/quizzes
export const getQuizzes = async (req, res) => {
  try {
    const studentId = req.user._id;
    const { courseId, status } = req.query;

    const enrolledCourseIds = await getEnrolledCourseIds(studentId);
    if (enrolledCourseIds.length === 0) {
      return res.status(200).json({
        status: "success",
        data: [],
      });
    }

    const activeCourses = await Course.find({
      _id: { $in: enrolledCourseIds },
      isActive: true,
    }).select("_id");
    const activeCourseIds = activeCourses.map((c) => c._id);

    if (activeCourseIds.length === 0) {
      return res.status(200).json({
        status: "success",
        data: [],
      });
    }

    const query = { courseId: { $in: activeCourseIds } };

    if (courseId) {
      if (!mongoose.Types.ObjectId.isValid(courseId)) {
        return res.status(400).json({
          status: "error",
          message: "Invalid course ID format.",
        });
      }
      if (!activeCourseIds.some((id) => id.toString() === courseId)) {
        return res.status(403).json({
          status: "error",
          message: "You are not enrolled in the specified course or it is inactive.",
        });
      }
      query.courseId = courseId;
    }

    const quizzes = await Quiz.find(query)
      .populate("courseId", "courseCode courseName isActive")
      .sort({ startTime: -1 })
      .lean();

    const quizIds = quizzes.map((q) => q._id);
    const attempts = await QuizAttempt.find({
      quizId: { $in: quizIds },
      studentId,
    }).sort({ submittedAt: -1, startedAt: -1, _id: -1 }).lean();

    const attemptMap = new Map();
    attempts.forEach((att) => {
      const key = String(att.quizId);
      if (!attemptMap.has(key)) attemptMap.set(key, att);
    });

    const now = new Date();
    let enriched = quizzes.map((quiz) => {
      const attempt = attemptMap.get(quiz._id.toString()) || null;
      const computedStatus = calculateQuizStatus(quiz, attempt, now);

      return {
        _id: quiz._id,
        courseId: quiz.courseId,
        title: quiz.title,
        description: quiz.description,
        startTime: quiz.startTime,
        endTime: quiz.endTime,
        timeLimit: quiz.timeLimit,
        maxScore: quizMaxScore(quiz),
        questionCount: quiz.questions?.length || 0,
        status: computedStatus,
        attemptId: attempt ? attempt._id : null,
      };
    });

    if (status && status.toUpperCase() !== "ALL") {
      const upperStatus = status.toUpperCase();
      enriched = enriched.filter((q) => q.status === upperStatus);
    }

    return res.status(200).json({
      status: "success",
      data: enriched,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Failed to load quizzes: " + error.message,
    });
  }
};

// GET /api/student/quizzes/:quizId
export const getQuizDetails = async (req, res) => {
  try {
    const studentId = req.user._id;
    const { quizId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(quizId)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid quiz ID format.",
      });
    }

    const quiz = await Quiz.findById(quizId)
      .populate("courseId", "courseCode courseName isActive")
      .lean();

    if (!quiz) {
      return res.status(404).json({
        status: "error",
        message: "Quiz not found.",
      });
    }

    if (!quiz.courseId) {
      return res.status(404).json({
        status: "error",
        message: "Associated course not found.",
      });
    }

    const enrolled = await isStudentEnrolled(studentId, quiz.courseId._id);
    if (!enrolled) {
      return res.status(403).json({
        status: "error",
        message: "You do not have permission to access this quiz.",
      });
    }

    const attempt = await QuizAttempt.findOne({ quizId, studentId }).sort({ submittedAt: -1, startedAt: -1, _id: -1 }).lean();
    const computedStatus = calculateQuizStatus(quiz, attempt);

    // Security: sanitize questions to prevent answer key disclosure
    const safeQuestions = (quiz.questions || []).map((q) => ({
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      options: q.options,
      points: q.points,
    }));

    return res.status(200).json({
      status: "success",
      data: {
        _id: quiz._id,
        courseId: quiz.courseId,
        title: quiz.title,
        description: quiz.description,
        startTime: quiz.startTime,
        endTime: quiz.endTime,
        timeLimit: quiz.timeLimit,
        maxScore: quizMaxScore(quiz),
        questionCount: safeQuestions.length,
        status: computedStatus,
        attemptId: attempt ? attempt._id : null,
        questions: safeQuestions,
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Failed to load quiz details: " + error.message,
    });
  }
};

async function studentQuizWrite(req, action) {
  const { quizId } = req.params;
  const studentId = req.user._id;
  if (!mongoose.isObjectIdOrHexString(quizId)) throw authError(400, "INVALID_QUIZ_ID", "Invalid quiz ID format.");

  return withQuizWrite(quizId, async (quiz, session) => {
    const course = await Course.findById(quiz.courseId).select("courseCode courseName isActive").session(session).lean();
    if (!course) throw authError(404, "QUIZ_NOT_FOUND", "Associated course not found.");
    if (course.isActive === false || !(await Enrollment.exists({ studentId, courseId: course._id }).session(session))) {
      throw authError(403, "QUIZ_FORBIDDEN", "You do not have permission to take this quiz.");
    }
    const attempt = await QuizAttempt.findOne({ quizId: quiz._id, studentId })
      .sort({ submittedAt: -1, startedAt: -1, _id: -1 }).session(session).lean();
    return action({ quiz, course, studentId, session, attempt });
  });
}

// POST /api/student/quizzes/:quizId/start
export const startQuiz = async (req, res) => {
  const data = await studentQuizWrite(req, async ({ quiz, course, studentId, session, attempt }) => {
    const now = new Date();
    if (now < quiz.startTime) throw authError(400, "QUIZ_NOT_OPEN", "This quiz has not opened yet.");
    if (now > quiz.endTime) throw authError(400, "QUIZ_CLOSED", "This quiz has already closed.");
    if (attempt?.submittedAt) throw authError(400, "QUIZ_ALREADY_SUBMITTED", "You have already completed this quiz.");
    if (attempt && calculateQuizStatus(quiz, attempt, now) === "EXPIRED") {
      throw authError(400, "QUIZ_ATTEMPT_EXPIRED", "The time limit for this quiz has expired.");
    }

    const activeAttempt = attempt
      ?? await new QuizAttempt({ quizId: quiz._id, studentId, startedAt: now, answers: [] }).save({ session });
    return {
      attemptId: activeAttempt._id,
      quizId: quiz._id,
      title: quiz.title,
      course,
      timeLimit: quiz.timeLimit,
      startedAt: activeAttempt.startedAt,
      questions: (quiz.questions ?? []).map(({ id, type, prompt, options, points }) => ({ id, type, prompt, options, points })),
    };
  });
  res.status(201).json({ status: "success", message: "Quiz attempt started successfully.", data });
};

function answersByQuestion(answers) {
  if (Array.isArray(answers)) {
    return new Map(answers.filter((answer) => answer?.questionId).map(({ questionId, selectedOptionId }) => [questionId, selectedOptionId]));
  }
  return new Map(answers && typeof answers === "object" ? Object.entries(answers) : []);
}

// POST /api/student/quizzes/:quizId/submit
export const submitQuiz = async (req, res) => {
  const result = await studentQuizWrite(req, async ({ quiz, course, session, attempt }) => {
    if (!attempt) throw authError(400, "QUIZ_ATTEMPT_REQUIRED", "No active quiz attempt found. Please start the quiz first.");
    if (attempt.submittedAt) {
      throw authError(400, "QUIZ_ALREADY_SUBMITTED", "This quiz attempt has already been submitted and graded.");
    }
    const now = new Date();
    // Preserve the Student quiz's 60-second submission grace period.
    const expired = now.getTime() > quiz.endTime.getTime() + 60_000
      || now.getTime() - attempt.startedAt.getTime() > (quiz.timeLimit * 60 + 60) * 1000;
    if (expired) {
      await QuizAttempt.updateOne({ _id: attempt._id }, { $set: { submittedAt: now, result: 0 } }, { session });
      return { expired: true };
    }

    const answerMap = answersByQuestion(req.body?.answers);
    let score = 0;
    const answers = (quiz.questions ?? []).map((question) => {
      const selected = answerMap.get(question.id);
      const selectedOptionId = question.options?.some(({ id }) => id === selected) ? selected : null;
      if (selectedOptionId === question.correctOptionId) score += questionPoints(question);
      return { questionId: question.id, selectedOptionId };
    });
    await QuizAttempt.updateOne(
      { _id: attempt._id }, { $set: { answers, result: score, submittedAt: now } }, { session, runValidators: true }
    );
    return {
      data: {
        _id: attempt._id,
        attemptId: attempt._id,
        quizId: quiz._id,
        quizTitle: quiz.title,
        courseCode: course.courseCode,
        courseName: course.courseName,
        ...quizScoreSummary(quiz, score),
        submittedAt: now,
      },
    };
  });

  if (result.expired) {
    throw authError(400, "QUIZ_ATTEMPT_EXPIRED", "The time limit for this quiz has expired. Submission rejected.");
  }
  res.json({ status: "success", message: "Quiz submitted successfully.", data: result.data });
};

// GET /api/student/quiz-attempts/:attemptId/result
export const getQuizResult = async (req, res) => {
  try {
    const studentId = req.user._id;
    const { attemptId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(attemptId)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid attempt ID format.",
      });
    }

    const attempt = await QuizAttempt.findById(attemptId).populate({
      path: "quizId",
      populate: { path: "courseId", select: "courseCode courseName" },
    });

    if (!attempt) {
      return res.status(404).json({
        status: "error",
        message: "Quiz attempt result not found.",
      });
    }

    if (attempt.studentId.toString() !== studentId.toString()) {
      return res.status(403).json({
        status: "error",
        message: "You do not have permission to view this quiz result.",
      });
    }

    if (!attempt.submittedAt) {
      return res.status(400).json({
        status: "error",
        message: "This quiz attempt has not been submitted yet.",
      });
    }

    const quiz = attempt.quizId;
    if (!quiz) {
      return res.status(404).json({ status: "error", message: "Associated quiz not found." });
    }
    const detailedReview = quizAnswerReview(quiz, attempt.answers);
    const summary = quizScoreSummary(quiz, attempt.result ?? 0);

    return res.status(200).json({
      status: "success",
      data: {
        _id: attempt._id,
        quizId: quiz._id,
        quizTitle: quiz.title,
        courseCode: quiz.courseId?.courseCode,
        courseName: quiz.courseId?.courseName,
        ...summary,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
        detailedReview,
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Failed to load quiz result: " + error.message,
    });
  }
};
