import mongoose from "mongoose";
import Quiz from "../models/Quiz.js";
import QuizAttempt from "../models/QuizAttempt.js";
import Course from "../models/Course.js";
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
    }).lean();

    const attemptMap = new Map();
    attempts.forEach((att) => {
      attemptMap.set(att.quizId.toString(), att);
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
        maxScore: quiz.maxScore || (quiz.questions || []).reduce((acc, q) => acc + (q.points || 1), 0),
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

    const attempt = await QuizAttempt.findOne({ quizId, studentId }).lean();
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
        maxScore: quiz.maxScore || safeQuestions.reduce((acc, q) => acc + (q.points || 1), 0),
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

// POST /api/student/quizzes/:quizId/start
export const startQuiz = async (req, res) => {
  try {
    const studentId = req.user._id;
    const { quizId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(quizId)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid quiz ID format.",
      });
    }

    const quiz = await Quiz.findById(quizId).populate("courseId", "courseCode courseName isActive");
    if (!quiz) {
      return res.status(404).json({
        status: "error",
        message: "Quiz not found.",
      });
    }

    const enrolled = await isStudentEnrolled(studentId, quiz.courseId._id);
    if (!enrolled) {
      return res.status(403).json({
        status: "error",
        message: "You do not have permission to take this quiz.",
      });
    }

    const now = new Date();
    if (now < new Date(quiz.startTime)) {
      return res.status(400).json({
        status: "error",
        message: "This quiz has not opened yet.",
      });
    }

    if (now > new Date(quiz.endTime)) {
      return res.status(400).json({
        status: "error",
        message: "This quiz has already closed.",
      });
    }

    let attempt = await QuizAttempt.findOne({ quizId, studentId });

    if (attempt) {
      if (attempt.submittedAt) {
        return res.status(400).json({
          status: "error",
          message: "You have already completed this quiz.",
        });
      }

      // Check if current in-progress attempt has expired
      const timeLimitMs = quiz.timeLimit * 60 * 1000;
      if (now.getTime() > new Date(attempt.startedAt).getTime() + timeLimitMs) {
        return res.status(400).json({
          status: "error",
          message: "The time limit for this quiz has expired.",
        });
      }
    } else {
      attempt = new QuizAttempt({
        quizId,
        studentId,
        startedAt: now,
        answers: [],
      });
      await attempt.save();
    }

    const safeQuestions = (quiz.questions || []).map((q) => ({
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      options: q.options,
      points: q.points,
    }));

    return res.status(201).json({
      status: "success",
      message: "Quiz attempt started successfully.",
      data: {
        attemptId: attempt._id,
        quizId: quiz._id,
        title: quiz.title,
        course: quiz.courseId,
        timeLimit: quiz.timeLimit,
        startedAt: attempt.startedAt,
        questions: safeQuestions,
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Failed to start quiz: " + error.message,
    });
  }
};

// POST /api/student/quizzes/:quizId/submit
export const submitQuiz = async (req, res) => {
  try {
    const studentId = req.user._id;
    const { quizId } = req.params;
    const { answers } = req.body;

    if (!mongoose.Types.ObjectId.isValid(quizId)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid quiz ID format.",
      });
    }

    const quiz = await Quiz.findById(quizId).populate("courseId", "courseCode courseName");
    if (!quiz) {
      return res.status(404).json({
        status: "error",
        message: "Quiz not found.",
      });
    }

    const enrolled = await isStudentEnrolled(studentId, quiz.courseId._id);
    if (!enrolled) {
      return res.status(403).json({
        status: "error",
        message: "You do not have permission to submit this quiz.",
      });
    }

    const attempt = await QuizAttempt.findOne({ quizId, studentId });
    if (!attempt) {
      return res.status(400).json({
        status: "error",
        message: "No active quiz attempt found. Please start the quiz first.",
      });
    }

    if (attempt.submittedAt) {
      return res.status(400).json({
        status: "error",
        message: "This quiz attempt has already been submitted and graded.",
      });
    }

    const now = new Date();
    // Timing check on server with 60-second network grace window
    const timeLimitMs = (quiz.timeLimit * 60 + 60) * 1000;
    const timeElapsed = now.getTime() - new Date(attempt.startedAt).getTime();

    if (now.getTime() > new Date(quiz.endTime).getTime() + 60000 || timeElapsed > timeLimitMs) {
      attempt.submittedAt = now;
      attempt.result = 0;
      await attempt.save();

      return res.status(400).json({
        status: "error",
        message: "The time limit for this quiz has expired. Submission rejected.",
      });
    }

    // Normalize answers
    const answerMap = new Map();
    if (Array.isArray(answers)) {
      answers.forEach((a) => {
        if (a && a.questionId) {
          answerMap.set(a.questionId, a.selectedOptionId);
        }
      });
    } else if (answers && typeof answers === "object") {
      Object.entries(answers).forEach(([qId, optId]) => {
        answerMap.set(qId, optId);
      });
    }

    let score = 0;
    let totalPoints = 0;
    const normalizedAnswers = [];

    for (const q of quiz.questions || []) {
      const qPoints = q.points || 1;
      totalPoints += qPoints;
      const selected = answerMap.get(q.id) || null;

      normalizedAnswers.push({
        questionId: q.id,
        selectedOptionId: selected,
      });

      if (selected && selected === q.correctOptionId) {
        score += qPoints;
      }
    }

    attempt.answers = normalizedAnswers;
    attempt.result = score;
    attempt.submittedAt = now;
    await attempt.save();

    const percentage = totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0;
    const passed = percentage >= 50;

    return res.status(200).json({
      status: "success",
      message: "Quiz submitted successfully.",
      data: {
        _id: attempt._id,
        attemptId: attempt._id,
        quizId: quiz._id,
        quizTitle: quiz.title,
        courseCode: quiz.courseId?.courseCode,
        courseName: quiz.courseId?.courseName,
        score,
        maxScore: totalPoints,
        percentage,
        passed,
        submittedAt: now,
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Failed to submit quiz: " + error.message,
    });
  }
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
    const answerMap = new Map();
    (attempt.answers || []).forEach((a) => {
      answerMap.set(a.questionId, a.selectedOptionId);
    });

    let totalPoints = 0;
    const detailedReview = (quiz.questions || []).map((q) => {
      const qPoints = q.points || 1;
      totalPoints += qPoints;
      const selectedOptionId = answerMap.get(q.id) || null;
      const isCorrect = selectedOptionId === q.correctOptionId;

      return {
        id: q.id,
        prompt: q.prompt,
        type: q.type,
        options: q.options,
        selectedOptionId,
        correctOptionId: q.correctOptionId,
        points: qPoints,
        earnedPoints: isCorrect ? qPoints : 0,
        isCorrect,
        explanation: q.explanation || null,
      };
    });

    const score = attempt.result !== null && attempt.result !== undefined ? attempt.result : 0;
    const percentage = totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0;
    const passed = percentage >= 50;

    return res.status(200).json({
      status: "success",
      data: {
        _id: attempt._id,
        quizId: quiz._id,
        quizTitle: quiz.title,
        courseCode: quiz.courseId?.courseCode,
        courseName: quiz.courseId?.courseName,
        score,
        maxScore: totalPoints,
        percentage,
        passed,
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
