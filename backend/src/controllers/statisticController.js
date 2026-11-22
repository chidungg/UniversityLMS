import Course from '../models/Course.js';
import Enrollment from '../models/Enrollment.js';
import Assignment from '../models/Assignment.js';
import Submission from '../models/Submission.js';
import Quiz from '../models/Quiz.js';
import QuizAttempt from '../models/QuizAttempt.js';
import User from '../models/User.js';
import { authError } from '../config/auth.js';

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;
const VALID_STATUSES = ['all', 'Active', 'Inactive'];
const VALID_ACTIVITIES = ['all', 'enrollments', 'assignments', 'quizzes'];
const VALID_PERIODS = ['all', '7d', '30d', '90d'];
const PERIOD_DAYS = { '7d': 7, '30d': 30, '90d': 90 };

function round1(value) {
  return Math.round(value * 10) / 10;
}

function parseCriteria(query = {}) {
  const rawStatus = query.courseStatus === undefined || query.courseStatus === '' ? 'all' : query.courseStatus;
  const rawCourseId = query.courseId === undefined || query.courseId === '' ? 'all' : query.courseId;
  const rawActivity = query.activityType === undefined || query.activityType === '' ? 'all' : query.activityType;
  const rawPeriod = query.period === undefined || query.period === '' ? 'all' : query.period;

  if (
    typeof rawStatus !== 'string' ||
    typeof rawCourseId !== 'string' ||
    typeof rawActivity !== 'string' ||
    typeof rawPeriod !== 'string' ||
    !VALID_STATUSES.includes(rawStatus) ||
    !VALID_ACTIVITIES.includes(rawActivity) ||
    !VALID_PERIODS.includes(rawPeriod) ||
    (rawCourseId !== 'all' && !OBJECT_ID_RE.test(rawCourseId))
  ) {
    throw authError(400, 'VALIDATION', 'Invalid statistical filter criteria.');
  }

  const days = PERIOD_DAYS[rawPeriod] || null;
  const sinceDate = days ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : null;

  return {
    courseStatus: rawStatus,
    courseId: rawCourseId === 'all' ? null : rawCourseId,
    activityType: rawActivity,
    period: rawPeriod,
    sinceDate,
  };
}

async function getCourseData() {
  return Course.find({})
    .select('courseCode courseName isActive instructorId')
    .sort({ courseCode: 1, _id: 1 })
    .lean();
}

async function getEnrollmentData(courseIds, sinceDate) {
  if (!courseIds.length) return [];
  const filter = { courseId: { $in: courseIds } };
  if (sinceDate) filter.enrolledAt = { $gte: sinceDate };
  return Enrollment.find(filter).select('courseId studentId enrolledAt').lean();
}

async function getSubmissionData(courseIds, sinceDate) {
  if (!courseIds.length) return { assignments: [], submissions: [] };
  const assignments = await Assignment.find({ courseId: { $in: courseIds } })
    .select('_id courseId maxScore')
    .lean();
  if (!assignments.length) return { assignments: [], submissions: [] };

  const assignmentIds = assignments.map((assignment) => assignment._id);
  const filter = { assignmentId: { $in: assignmentIds } };
  if (sinceDate) filter.submittedAt = { $gte: sinceDate };
  const submissions = await Submission.find(filter)
    .select('assignmentId studentId grade submittedAt')
    .lean();
  return { assignments, submissions };
}

async function getQuizAttemptData(courseIds, sinceDate) {
  if (!courseIds.length) return { quizzes: [], quizAttempts: [] };
  const quizzes = await Quiz.find({ courseId: { $in: courseIds } })
    .select('_id courseId maxScore questions.points')
    .lean();
  if (!quizzes.length) return { quizzes: [], quizAttempts: [] };

  const quizIds = quizzes.map((quiz) => quiz._id);
  const filter = { quizId: { $in: quizIds } };
  if (sinceDate) {
    filter.$or = [
      { submittedAt: { $gte: sinceDate } },
      { submittedAt: null, startedAt: { $gte: sinceDate } },
    ];
  }
  const quizAttempts = await QuizAttempt.find(filter)
    .select('quizId studentId result startedAt submittedAt')
    .lean();
  return { quizzes, quizAttempts };
}

async function getInstructorMap(courses) {
  const instructorIds = [
    ...new Set(courses.map((course) => course.instructorId?.toString()).filter(Boolean)),
  ];
  if (!instructorIds.length) return new Map();

  const instructors = await User.find({ _id: { $in: instructorIds } })
    .select('fullName email isActive')
    .lean();
  return new Map(instructors.map((user) => [user._id.toString(), user]));
}

function quizMaxPoints(quiz) {
  if (Array.isArray(quiz.questions) && quiz.questions.length > 0) {
    return quiz.questions.reduce((sum, question) => sum + (Number(question?.points) > 0 ? Number(question.points) : 1), 0);
  }
  return Number(quiz.maxScore) > 0 ? Number(quiz.maxScore) : 10;
}

function processSummaries({
  totalSystemCourses,
  filteredCourses,
  instructorMap,
  enrollments,
  assignments,
  submissions,
  quizzes,
  quizAttempts,
  criteria,
}) {
  const breakdownMap = new Map();
  let activeCourses = 0;
  let assignedInstructor = 0;

  for (const course of filteredCourses) {
    const id = course._id.toString();
    const instructor = course.instructorId ? instructorMap.get(course.instructorId.toString()) || null : null;
    if (course.isActive) activeCourses += 1;
    if (course.instructorId) assignedInstructor += 1;

    breakdownMap.set(id, {
      courseId: id,
      courseCode: course.courseCode,
      courseName: course.courseName,
      isActive: Boolean(course.isActive),
      status: course.isActive ? 'Active' : 'Inactive',
      instructorName: instructor ? instructor.fullName : course.instructorId ? 'Instructor unavailable' : 'Not assigned',
      enrollments: 0,
      assignmentsCount: 0,
      submissionsTotal: 0,
      submissionsGraded: 0,
      submissionsPending: 0,
      averageAssignmentPct: null,
      quizzesCount: 0,
      quizAttemptsTotal: 0,
      quizAttemptsCompleted: 0,
      averageQuizPct: null,
      quizPassRatePct: null,
      _assignmentPctSum: 0,
      _assignmentPctCount: 0,
      _quizPctSum: 0,
      _quizPctCount: 0,
      _quizPassedCount: 0,
    });
  }

  const uniqueStudents = new Set();
  for (const enrollment of enrollments) {
    const cid = enrollment.courseId.toString();
    if (enrollment.studentId) uniqueStudents.add(enrollment.studentId.toString());
    const row = breakdownMap.get(cid);
    if (row) row.enrollments += 1;
  }

  const assignmentMap = new Map();
  for (const assignment of assignments) {
    const cid = assignment.courseId.toString();
    const maxScore = Number(assignment.maxScore) > 0 ? Number(assignment.maxScore) : 10;
    assignmentMap.set(assignment._id.toString(), { courseId: cid, maxScore });
    const row = breakdownMap.get(cid);
    if (row) row.assignmentsCount += 1;
  }

  let submissionsGraded = 0;
  let submissionsPending = 0;
  let submissionPctSum = 0;
  let submissionPctCount = 0;

  for (const submission of submissions) {
    const meta = assignmentMap.get(submission.assignmentId.toString());
    if (!meta) continue;
    const row = breakdownMap.get(meta.courseId);
    if (row) row.submissionsTotal += 1;

    if (typeof submission.grade === 'number' && Number.isFinite(submission.grade)) {
      submissionsGraded += 1;
      if (row) row.submissionsGraded += 1;
      if (meta.maxScore > 0) {
        const pct = Math.min(100, Math.max(0, (submission.grade / meta.maxScore) * 100));
        submissionPctSum += pct;
        submissionPctCount += 1;
        if (row) {
          row._assignmentPctSum += pct;
          row._assignmentPctCount += 1;
        }
      }
    } else {
      submissionsPending += 1;
      if (row) row.submissionsPending += 1;
    }
  }

  const quizMap = new Map();
  for (const quiz of quizzes) {
    const cid = quiz.courseId.toString();
    const maxPoints = quizMaxPoints(quiz);
    quizMap.set(quiz._id.toString(), { courseId: cid, maxPoints });
    const row = breakdownMap.get(cid);
    if (row) row.quizzesCount += 1;
  }

  let quizCompleted = 0;
  let quizInProgress = 0;
  let quizPassed = 0;
  let quizScoredCount = 0;
  let quizPctSum = 0;

  for (const attempt of quizAttempts) {
    const meta = quizMap.get(attempt.quizId.toString());
    if (!meta) continue;
    const row = breakdownMap.get(meta.courseId);
    if (row) row.quizAttemptsTotal += 1;

    if (attempt.submittedAt) {
      quizCompleted += 1;
      if (row) row.quizAttemptsCompleted += 1;

      if (typeof attempt.result === 'number' && Number.isFinite(attempt.result) && meta.maxPoints > 0) {
        const pct = Math.min(100, Math.max(0, (attempt.result / meta.maxPoints) * 100));
        quizPctSum += pct;
        quizScoredCount += 1;
        if (pct >= 50) {
          quizPassed += 1;
          if (row) row._quizPassedCount += 1;
        }
        if (row) {
          row._quizPctSum += pct;
          row._quizPctCount += 1;
        }
      }
    } else {
      quizInProgress += 1;
    }
  }

  let coursesWithEnrollments = 0;
  const courseBreakdown = [...breakdownMap.values()].map((row) => {
    if (row.enrollments > 0) coursesWithEnrollments += 1;
    return {
      courseId: row.courseId,
      courseCode: row.courseCode,
      courseName: row.courseName,
      isActive: row.isActive,
      status: row.status,
      instructorName: row.instructorName,
      enrollments: row.enrollments,
      assignmentsCount: row.assignmentsCount,
      submissionsTotal: row.submissionsTotal,
      submissionsGraded: row.submissionsGraded,
      submissionsPending: row.submissionsPending,
      averageAssignmentPct: row._assignmentPctCount > 0 ? round1(row._assignmentPctSum / row._assignmentPctCount) : null,
      quizzesCount: row.quizzesCount,
      quizAttemptsTotal: row.quizAttemptsTotal,
      quizAttemptsCompleted: row.quizAttemptsCompleted,
      averageQuizPct: row._quizPctCount > 0 ? round1(row._quizPctSum / row._quizPctCount) : null,
      quizPassRatePct: row._quizPctCount > 0 ? round1((row._quizPassedCount / row._quizPctCount) * 100) : null,
    };
  });

  const courseTotal = filteredCourses.length;
  const summary = {
    courses: {
      total: courseTotal,
      active: activeCourses,
      inactive: courseTotal - activeCourses,
      assignedInstructor,
      unassignedInstructor: courseTotal - assignedInstructor,
    },
    enrollments: {
      total: enrollments.length,
      uniqueStudents: uniqueStudents.size,
      coursesWithEnrollments,
      averagePerCourse: courseTotal > 0 ? round1(enrollments.length / courseTotal) : 0,
    },
    submissions: {
      assignmentsTotal: assignments.length,
      total: submissions.length,
      graded: submissionsGraded,
      pendingGrading: submissionsPending,
      averageScorePct: submissionPctCount > 0 ? round1(submissionPctSum / submissionPctCount) : null,
    },
    quizAttempts: {
      quizzesTotal: quizzes.length,
      total: quizAttempts.length,
      completed: quizCompleted,
      inProgress: quizInProgress,
      passed: quizPassed,
      passRatePct: quizScoredCount > 0 ? round1((quizPassed / quizScoredCount) * 100) : null,
      averageScorePct: quizScoredCount > 0 ? round1(quizPctSum / quizScoredCount) : null,
    },
  };

  let noDataReason = null;
  if (totalSystemCourses === 0) {
    noDataReason = 'empty_system';
  } else if (courseTotal === 0) {
    noDataReason = 'no_matching_courses';
  } else if (criteria.activityType === 'enrollments' && summary.enrollments.total === 0) {
    noDataReason = 'no_enrollment_data';
  } else if (criteria.activityType === 'assignments' && summary.submissions.total === 0) {
    noDataReason = 'no_submission_data';
  } else if (criteria.activityType === 'quizzes' && summary.quizAttempts.total === 0) {
    noDataReason = 'no_quiz_data';
  } else if (
    criteria.period !== 'all' &&
    summary.enrollments.total === 0 &&
    summary.submissions.total === 0 &&
    summary.quizAttempts.total === 0
  ) {
    noDataReason = 'no_period_activity';
  }

  return {
    summary,
    courseBreakdown,
    hasData: noDataReason === null,
    noDataReason,
  };
}

export async function getStatistics(req, res) {
  const criteria = parseCriteria(req.query);

  let allCourses;
  let filteredCourses;
  let enrollments;
  let submissionData;
  let quizAttemptData;
  let instructorMap;

  try {
    allCourses = await getCourseData();
    filteredCourses = allCourses.filter((course) => {
      if (criteria.courseStatus !== 'all') {
        const courseState = course.isActive ? 'Active' : 'Inactive';
        if (courseState !== criteria.courseStatus) return false;
      }
      if (criteria.courseId && course._id.toString() !== criteria.courseId) {
        return false;
      }
      return true;
    });

    const filteredCourseIds = filteredCourses.map((course) => course._id);
    [enrollments, submissionData, quizAttemptData, instructorMap] = await Promise.all([
      getEnrollmentData(filteredCourseIds, criteria.sinceDate),
      getSubmissionData(filteredCourseIds, criteria.sinceDate),
      getQuizAttemptData(filteredCourseIds, criteria.sinceDate),
      getInstructorMap(filteredCourses),
    ]);
  } catch (err) {
    const wrapped = authError(500, 'STATISTICS_RETRIEVAL_FAILED', 'Unable to retrieve statistical data. Please try again.');
    wrapped.cause = err;
    throw wrapped;
  }

  const { summary, courseBreakdown, hasData, noDataReason } = processSummaries({
    totalSystemCourses: allCourses.length,
    filteredCourses,
    instructorMap,
    enrollments,
    assignments: submissionData.assignments,
    submissions: submissionData.submissions,
    quizzes: quizAttemptData.quizzes,
    quizAttempts: quizAttemptData.quizAttempts,
    criteria,
  });

  res.json({
    status: 'success',
    summary,
    courseBreakdown,
    filters: {
      applied: {
        courseStatus: criteria.courseStatus,
        courseId: criteria.courseId || 'all',
        activityType: criteria.activityType,
        period: criteria.period,
      },
      courses: allCourses.map((course) => ({
        id: course._id.toString(),
        code: course.courseCode,
        name: course.courseName,
        status: course.isActive ? 'Active' : 'Inactive',
      })),
    },
    meta: {
      generatedAt: new Date().toISOString(),
      totalSystemCourses: allCourses.length,
      hasData,
      noDataReason,
    },
  });
}
