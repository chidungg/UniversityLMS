import { authError } from "../config/auth.js";
import Assignment from "../models/Assignment.js";
import LearningMaterial from "../models/LearningMaterial.js";
import Quiz from "../models/Quiz.js";
import QuizAttempt from "../models/QuizAttempt.js";
import Submission from "../models/Submission.js";
import { quizMaxScore, QUIZ_PASS_PERCENTAGE } from "../utils/quizScoring.js";
import { findEnrolledStudents, requireAssignedCourse } from "./instructorCourseController.js";
import { calculateQuizStatus } from "./quizController.js";

const courseFields = "courseCode courseName description isActive";
const PROGRESS_STATUSES = ["ALL", "ON_TRACK", "NEEDS_ATTENTION", "NO_ACTIVITY"];

const round1 = (value) => Math.round(value * 10) / 10;

function effectiveQuizMaxScore(quiz) {
  const fromQuestions = quizMaxScore(quiz);
  if (fromQuestions > 0) return fromQuestions;
  return Number(quiz.maxScore) > 0 ? Number(quiz.maxScore) : 10;
}

function validateSearch(q) {
  if (typeof q !== "string" || q.length > 200) {
    throw authError(400, "INVALID_MONITORING_FILTER", "Invalid student monitoring filter.");
  }
  return q.trim().toLowerCase();
}

function validateProgressFilters(query = {}) {
  const term = validateSearch(query.q ?? "");
  const status = query.status ?? "ALL";
  if (typeof status !== "string" || !PROGRESS_STATUSES.includes(status)) {
    throw authError(400, "INVALID_MONITORING_FILTER", "Invalid student monitoring filter.");
  }
  return { term, status };
}

function matchesSearch(student, term) {
  if (!term) return true;
  return (
    student.fullName.toLowerCase().includes(term) ||
    student.email.toLowerCase().includes(term)
  );
}

async function settleAll(promises) {
  const results = await Promise.allSettled(promises);
  const failure = results.find((entry) => entry.status === "rejected");
  if (failure) throw failure.reason;
  return results.map((entry) => entry.value);
}

async function loadCourseMonitoringContext(courseId, instructorId) {
  try {
    const course = await requireAssignedCourse(courseId, instructorId, courseFields);
    const [students, assignments, quizzes, materialCount] = await settleAll([
      findEnrolledStudents(course._id),
      Assignment.find({ courseId: course._id })
        .select("title dueDate maxScore createdAt")
        .sort({ dueDate: 1, _id: 1 })
        .lean(),
      Quiz.find({ courseId: course._id })
        .select("title startTime endTime timeLimit maxScore questions.id questions.points")
        .sort({ startTime: 1, _id: 1 })
        .lean(),
      LearningMaterial.countDocuments({ courseId: course._id }),
    ]);

    if (students.length === 0) {
      return {
        course,
        students,
        assignments,
        quizzes,
        materialCount,
        submissions: [],
        attempts: [],
        latestSubmissionByKey: new Map(),
        latestAttemptByKey: new Map(),
      };
    }

    const studentIds = students.map(({ _id }) => _id);
    const assignmentIds = assignments.map(({ _id }) => _id);
    const quizIds = quizzes.map(({ _id }) => _id);

    const [submissions, attempts] = await settleAll([
      assignmentIds.length
        ? Submission.find({ assignmentId: { $in: assignmentIds }, studentId: { $in: studentIds } })
            .select("assignmentId studentId grade feedback submittedAt")
            .sort({ submittedAt: -1, _id: -1 })
            .lean()
        : Promise.resolve([]),
      quizIds.length
        ? QuizAttempt.find({ quizId: { $in: quizIds }, studentId: { $in: studentIds } })
            .select("quizId studentId result startedAt submittedAt")
            .sort({ submittedAt: -1, startedAt: -1, _id: -1 })
            .lean()
        : Promise.resolve([]),
    ]);

    const latestSubmissionByKey = new Map();
    for (const submission of submissions) {
      const key = `${submission.assignmentId}::${submission.studentId}`;
      if (!latestSubmissionByKey.has(key)) latestSubmissionByKey.set(key, submission);
    }

    const latestAttemptByKey = new Map();
    for (const attempt of attempts) {
      const key = `${attempt.quizId}::${attempt.studentId}`;
      if (!latestAttemptByKey.has(key)) latestAttemptByKey.set(key, attempt);
    }

    return {
      course,
      students,
      assignments,
      quizzes,
      materialCount,
      submissions,
      attempts,
      latestSubmissionByKey,
      latestAttemptByKey,
    };
  } catch (err) {
    if (err?.statusCode) throw err;
    const wrapped = authError(
      500,
      "MONITORING_RETRIEVAL_FAILED",
      "Unable to retrieve student monitoring data. Please try again."
    );
    wrapped.cause = err;
    throw wrapped;
  }
}

function buildAssignmentEntry(assignment, submission, now) {
  const maxScore = Number(assignment.maxScore) > 0 ? Number(assignment.maxScore) : 10;
  const graded = Boolean(submission && typeof submission.grade === "number" && Number.isFinite(submission.grade));
  const percentage = graded ? round1(Math.min(100, Math.max(0, (submission.grade / maxScore) * 100))) : null;
  const status = submission ? (graded ? "GRADED" : "SUBMITTED") : "NOT_SUBMITTED";
  const isLate = Boolean(submission?.submittedAt && assignment.dueDate && new Date(submission.submittedAt) > new Date(assignment.dueDate));
  const isPastDue = Boolean(!submission && assignment.dueDate && new Date(assignment.dueDate) < now);

  return {
    assignmentId: String(assignment._id),
    title: assignment.title,
    maxScore,
    dueDate: assignment.dueDate ?? null,
    submissionId: submission ? String(submission._id) : null,
    status,
    isLate,
    isPastDue,
    grade: graded ? submission.grade : null,
    percentage,
    feedback: graded && submission.feedback ? submission.feedback : null,
    submittedAt: submission?.submittedAt ?? null,
  };
}

function buildQuizEntry(quiz, attempt, now) {
  const maxScore = effectiveQuizMaxScore(quiz);
  const status = attempt ? calculateQuizStatus(quiz, attempt, now) : "NOT_ATTEMPTED";
  const completed = Boolean(attempt?.submittedAt);
  const score = completed && typeof attempt.result === "number" && Number.isFinite(attempt.result) ? attempt.result : null;
  const percentage = score !== null && maxScore > 0 ? round1(Math.min(100, Math.max(0, (score / maxScore) * 100))) : null;
  const passed = percentage !== null ? percentage >= QUIZ_PASS_PERCENTAGE : null;

  return {
    quizId: String(quiz._id),
    title: quiz.title,
    maxScore,
    startTime: quiz.startTime ?? null,
    endTime: quiz.endTime ?? null,
    attemptId: attempt ? String(attempt._id) : null,
    status,
    score,
    percentage,
    passed,
    startedAt: attempt?.startedAt ?? null,
    submittedAt: attempt?.submittedAt ?? null,
  };
}

export async function getCourseGradebook(req, res) {
  const term = validateSearch(req.query.q ?? "");
  const ctx = await loadCourseMonitoringContext(req.params.courseId, req.user._id);
  const { course, students, assignments, quizzes, submissions, attempts, latestSubmissionByKey, latestAttemptByKey } = ctx;

  if (students.length === 0) {
    return res.json({
      status: "success",
      data: {
        course,
        hasEnrolledStudents: false,
        hasAcademicData: false,
        emptyReason: "NO_STUDENTS_ENROLLED",
        summary: {
          enrolledCount: 0,
          filteredCount: 0,
          assignmentCount: assignments.length,
          quizCount: quizzes.length,
          gradedSubmissions: 0,
          pendingGrading: 0,
          completedQuizAttempts: 0,
          classAssignmentAvgPct: null,
          classQuizAvgPct: null,
          quizPassRatePct: null,
        },
        assignments: [],
        quizzes: [],
        rows: [],
      },
    });
  }

  const now = new Date();
  let totalGradedSubmissions = 0;
  let totalPendingGrading = 0;
  let totalCompletedQuizAttempts = 0;
  let totalPassedQuizAttempts = 0;
  let classAssignmentPctSum = 0;
  let classQuizPctSum = 0;

  const assignmentStats = new Map(
    assignments.map((a) => [String(a._id), { scoreSum: 0, pctSum: 0, gradedCount: 0, submittedCount: 0 }])
  );
  const quizStats = new Map(
    quizzes.map((q) => [String(q._id), { scoreSum: 0, pctSum: 0, completedCount: 0, passedCount: 0 }])
  );

  const allRows = students.map((student) => {
    const sid = String(student._id);
    const assignmentGrades = assignments.map((assignment) => {
      const submission = latestSubmissionByKey.get(`${assignment._id}::${sid}`) || null;
      const entry = buildAssignmentEntry(assignment, submission, now);
      const colStat = assignmentStats.get(entry.assignmentId);

      if (entry.status !== "NOT_SUBMITTED") colStat.submittedCount += 1;
      if (entry.status === "SUBMITTED") totalPendingGrading += 1;
      if (entry.status === "GRADED") {
        totalGradedSubmissions += 1;
        classAssignmentPctSum += entry.percentage;
        colStat.gradedCount += 1;
        colStat.scoreSum += entry.grade;
        colStat.pctSum += entry.percentage;
      }
      return entry;
    });

    const quizGrades = quizzes.map((quiz) => {
      const attempt = latestAttemptByKey.get(`${quiz._id}::${sid}`) || null;
      const entry = buildQuizEntry(quiz, attempt, now);
      const colStat = quizStats.get(entry.quizId);

      if (entry.score !== null) {
        totalCompletedQuizAttempts += 1;
        classQuizPctSum += entry.percentage;
        colStat.completedCount += 1;
        colStat.scoreSum += entry.score;
        colStat.pctSum += entry.percentage;
        if (entry.passed) {
          totalPassedQuizAttempts += 1;
          colStat.passedCount += 1;
        }
      }
      return entry;
    });

    const gradedAssignments = assignmentGrades.filter((item) => item.percentage !== null);
    const submittedAssignments = assignmentGrades.filter((item) => item.status !== "NOT_SUBMITTED");
    const scoredQuizzes = quizGrades.filter((item) => item.percentage !== null);
    const passedQuizzes = scoredQuizzes.filter((item) => item.passed);
    const allScored = [...gradedAssignments, ...scoredQuizzes];

    const assignmentAveragePct = gradedAssignments.length
      ? round1(gradedAssignments.reduce((sum, item) => sum + item.percentage, 0) / gradedAssignments.length)
      : null;
    const quizAveragePct = scoredQuizzes.length
      ? round1(scoredQuizzes.reduce((sum, item) => sum + item.percentage, 0) / scoredQuizzes.length)
      : null;
    const overallAveragePct = allScored.length
      ? round1(allScored.reduce((sum, item) => sum + item.percentage, 0) / allScored.length)
      : null;

    return {
      student: {
        _id: sid,
        fullName: student.fullName,
        email: student.email,
        enrolledAt: student.enrolledAt ?? null,
      },
      assignmentGrades,
      quizGrades,
      summary: {
        gradedAssignmentsCount: gradedAssignments.length,
        submittedAssignmentsCount: submittedAssignments.length,
        assignmentAveragePct,
        completedQuizzesCount: scoredQuizzes.length,
        passedQuizzesCount: passedQuizzes.length,
        quizAveragePct,
        overallAveragePct,
        gradedItemsCount: allScored.length,
      },
    };
  });

  const assignmentColumns = assignments.map((assignment) => {
    const id = String(assignment._id);
    const stat = assignmentStats.get(id);
    const maxScore = Number(assignment.maxScore) > 0 ? Number(assignment.maxScore) : 10;
    return {
      _id: id,
      title: assignment.title,
      dueDate: assignment.dueDate ?? null,
      maxScore,
      submittedCount: stat.submittedCount,
      gradedCount: stat.gradedCount,
      avgScore: stat.gradedCount ? round1(stat.scoreSum / stat.gradedCount) : null,
      avgPercentage: stat.gradedCount ? round1(stat.pctSum / stat.gradedCount) : null,
    };
  });

  const quizColumns = quizzes.map((quiz) => {
    const id = String(quiz._id);
    const stat = quizStats.get(id);
    return {
      _id: id,
      title: quiz.title,
      startTime: quiz.startTime ?? null,
      endTime: quiz.endTime ?? null,
      maxScore: effectiveQuizMaxScore(quiz),
      completedCount: stat.completedCount,
      avgScore: stat.completedCount ? round1(stat.scoreSum / stat.completedCount) : null,
      avgPercentage: stat.completedCount ? round1(stat.pctSum / stat.completedCount) : null,
      passRate: stat.completedCount ? Math.round((stat.passedCount / stat.completedCount) * 100) : null,
    };
  });

  const totalAssessments = assignments.length + quizzes.length;
  const hasAnyRecord = submissions.length > 0 || attempts.length > 0;
  const emptyReason = totalAssessments === 0 ? "NO_ASSESSMENTS" : !hasAnyRecord ? "NO_GRADE_RECORDS" : null;
  const filteredRows = allRows.filter(({ student }) => matchesSearch(student, term));

  res.json({
    status: "success",
    data: {
      course,
      hasEnrolledStudents: true,
      hasAcademicData: emptyReason === null,
      emptyReason,
      summary: {
        enrolledCount: students.length,
        filteredCount: filteredRows.length,
        assignmentCount: assignments.length,
        quizCount: quizzes.length,
        gradedSubmissions: totalGradedSubmissions,
        pendingGrading: totalPendingGrading,
        completedQuizAttempts: totalCompletedQuizAttempts,
        classAssignmentAvgPct: totalGradedSubmissions ? round1(classAssignmentPctSum / totalGradedSubmissions) : null,
        classQuizAvgPct: totalCompletedQuizAttempts ? round1(classQuizPctSum / totalCompletedQuizAttempts) : null,
        quizPassRatePct: totalCompletedQuizAttempts
          ? Math.round((totalPassedQuizAttempts / totalCompletedQuizAttempts) * 100)
          : null,
      },
      assignments: assignmentColumns,
      quizzes: quizColumns,
      rows: filteredRows,
    },
  });
}

export async function getCourseLearningProgress(req, res) {
  const { term, status: statusFilter } = validateProgressFilters(req.query);
  const ctx = await loadCourseMonitoringContext(req.params.courseId, req.user._id);
  const { course, students, assignments, quizzes, materialCount, submissions, attempts, latestSubmissionByKey, latestAttemptByKey } = ctx;
  const trackedItemsTotal = assignments.length + quizzes.length;

  if (students.length === 0) {
    return res.json({
      status: "success",
      data: {
        course,
        hasEnrolledStudents: false,
        hasAcademicData: false,
        emptyReason: "NO_STUDENTS_ENROLLED",
        summary: {
          enrolledCount: 0,
          filteredCount: 0,
          assignmentCount: assignments.length,
          quizCount: quizzes.length,
          materialCount,
          trackedItemsTotal,
          studentsOnTrack: 0,
          studentsNeedingAttention: 0,
          studentsWithNoActivity: 0,
          totalSubmittedAssignments: 0,
          totalCompletedQuizzes: 0,
        },
        rows: [],
      },
    });
  }

  const now = new Date();
  let studentsOnTrack = 0;
  let studentsNeedingAttention = 0;
  let studentsWithNoActivity = 0;
  let totalSubmittedAssignments = 0;
  let totalCompletedQuizzes = 0;

  const allRows = students.map((student) => {
    const sid = String(student._id);
    let assignmentsSubmitted = 0;
    let assignmentsGraded = 0;
    let assignmentsPendingGrading = 0;
    let assignmentsLate = 0;
    let assignmentsMissingPastDue = 0;
    let lastTimestamp = null;

    const bumpTimestamp = (value) => {
      if (!value) return;
      const ms = new Date(value).getTime();
      if (!Number.isFinite(ms)) return;
      if (lastTimestamp === null || ms > lastTimestamp) lastTimestamp = ms;
    };

    const assignmentItems = assignments.map((assignment) => {
      const submission = latestSubmissionByKey.get(`${assignment._id}::${sid}`) || null;
      const entry = buildAssignmentEntry(assignment, submission, now);
      if (entry.status !== "NOT_SUBMITTED") {
        assignmentsSubmitted += 1;
        bumpTimestamp(entry.submittedAt);
      }
      if (entry.status === "GRADED") assignmentsGraded += 1;
      if (entry.status === "SUBMITTED") assignmentsPendingGrading += 1;
      if (entry.isLate) assignmentsLate += 1;
      if (entry.isPastDue) assignmentsMissingPastDue += 1;
      return entry;
    });

    let quizzesCompleted = 0;
    let quizzesInProgress = 0;
    let quizzesPassed = 0;
    let quizzesMissedExpired = 0;

    const quizItems = quizzes.map((quiz) => {
      const attempt = latestAttemptByKey.get(`${quiz._id}::${sid}`) || null;
      const entry = buildQuizEntry(quiz, attempt, now);
      if (attempt) bumpTimestamp(entry.submittedAt || entry.startedAt);
      if (entry.status === "COMPLETED") {
        quizzesCompleted += 1;
        if (entry.passed) quizzesPassed += 1;
      } else if (entry.status === "IN_PROGRESS") {
        quizzesInProgress += 1;
      } else if (entry.status === "EXPIRED") {
        quizzesMissedExpired += 1;
      }
      return entry;
    });

    totalSubmittedAssignments += assignmentsSubmitted;
    totalCompletedQuizzes += quizzesCompleted;

    const trackedItemsCompleted = assignmentsSubmitted + quizzesCompleted;
    const completionRatePct = trackedItemsTotal > 0 ? Math.round((trackedItemsCompleted / trackedItemsTotal) * 100) : null;

    let attentionStatus = "NO_DATA";
    if (trackedItemsTotal > 0) {
      if (trackedItemsCompleted === 0 && quizzesInProgress === 0) {
        attentionStatus = "NO_ACTIVITY";
        studentsWithNoActivity += 1;
      } else if (
        assignmentsMissingPastDue > 0 ||
        quizzesMissedExpired > 0 ||
        (quizzesCompleted > 0 && quizzesPassed < quizzesCompleted)
      ) {
        attentionStatus = "NEEDS_ATTENTION";
        studentsNeedingAttention += 1;
      } else {
        attentionStatus = "ON_TRACK";
        studentsOnTrack += 1;
      }
    }

    return {
      student: {
        _id: sid,
        fullName: student.fullName,
        email: student.email,
        enrolledAt: student.enrolledAt ?? null,
      },
      progress: {
        assignmentsTotal: assignments.length,
        assignmentsSubmitted,
        assignmentsGraded,
        assignmentsPendingGrading,
        assignmentsLate,
        assignmentsMissingPastDue,
        quizzesTotal: quizzes.length,
        quizzesCompleted,
        quizzesInProgress,
        quizzesPassed,
        quizzesMissedExpired,
        trackedItemsTotal,
        trackedItemsCompleted,
        completionRatePct,
        lastActivityAt: lastTimestamp !== null ? new Date(lastTimestamp).toISOString() : null,
        attentionStatus,
      },
      assignmentItems,
      quizItems,
    };
  });

  const emptyReason = trackedItemsTotal === 0
    ? "NO_ASSESSMENTS"
    : (submissions.length === 0 && attempts.length === 0)
      ? "NO_PROGRESS_RECORDS"
      : null;

  const filteredRows = allRows.filter((row) => {
    if (!matchesSearch(row.student, term)) return false;
    if (statusFilter !== "ALL" && row.progress.attentionStatus !== statusFilter) return false;
    return true;
  });

  res.json({
    status: "success",
    data: {
      course,
      hasEnrolledStudents: true,
      hasAcademicData: emptyReason === null,
      emptyReason,
      summary: {
        enrolledCount: students.length,
        filteredCount: filteredRows.length,
        assignmentCount: assignments.length,
        quizCount: quizzes.length,
        materialCount,
        trackedItemsTotal,
        studentsOnTrack,
        studentsNeedingAttention,
        studentsWithNoActivity,
        totalSubmittedAssignments,
        totalCompletedQuizzes,
      },
      rows: filteredRows,
    },
  });
}
