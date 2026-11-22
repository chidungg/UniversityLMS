import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import User from '../src/models/User.js';
import Course from '../src/models/Course.js';
import Enrollment from '../src/models/Enrollment.js';
import Assignment from '../src/models/Assignment.js';
import Submission from '../src/models/Submission.js';
import Quiz from '../src/models/Quiz.js';
import QuizAttempt from '../src/models/QuizAttempt.js';
import AuthRateLimit from '../src/models/AuthRateLimit.js';
import { migrateAuth } from '../src/scripts/migrateAuth.js';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'isolated-statistics-test-secret-with-at-least-32-bytes';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
const { app } = await import('../src/server.js');

let database;
const accounts = {};
const seededCourses = {};
const basePassword = 'Test-password-2026';

const post = (url) => request(app).post(url).set('X-LMS-Request', '1');

async function signIn(email, password = basePassword) {
  const response = await post('/api/auth/login').send({ email, password });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  return response.headers['set-cookie'][0].split(';')[0];
}

async function seedDataset() {
  await Promise.all([
    QuizAttempt.deleteMany({}),
    Quiz.deleteMany({}),
    Submission.deleteMany({}),
    Assignment.deleteMany({}),
    Enrollment.deleteMany({}),
    Course.deleteMany({}),
  ]);

  const dayMs = 24 * 60 * 60 * 1000;
  const recentDate = new Date(Date.now() - 2 * dayMs);
  const oldDate = new Date(Date.now() - 45 * dayMs);

  seededCourses.se104 = await Course.create({
    courseCode: 'SE104',
    courseName: 'Software Engineering',
    description: 'Software design processes.',
    isActive: true,
    instructorId: accounts.instructor._id,
  });
  seededCourses.dbi202 = await Course.create({
    courseCode: 'DBI202',
    courseName: 'Database Systems',
    description: 'SQL and modeling.',
    isActive: true,
  });
  seededCourses.net301 = await Course.create({
    courseCode: 'NET301',
    courseName: 'Computer Networks',
    description: 'Protocols and routing.',
    isActive: false,
  });

  await Enrollment.create([
    { courseId: seededCourses.se104._id, studentId: accounts.student1._id, enrolledAt: recentDate },
    { courseId: seededCourses.se104._id, studentId: accounts.student2._id, enrolledAt: recentDate },
    { courseId: seededCourses.dbi202._id, studentId: accounts.student1._id, enrolledAt: oldDate },
  ]);

  const [a1, a2] = await Assignment.create([
    {
      courseId: seededCourses.se104._id,
      title: 'Requirements Spec',
      dueDate: new Date(Date.now() + 7 * dayMs),
      maxScore: 10,
    },
    {
      courseId: seededCourses.dbi202._id,
      title: 'Schema Design',
      dueDate: new Date(Date.now() + 7 * dayMs),
      maxScore: 20,
    },
  ]);

  await Submission.create([
    { assignmentId: a1._id, studentId: accounts.student1._id, content: 'Done 1', grade: 9, submittedAt: recentDate },
    { assignmentId: a1._id, studentId: accounts.student2._id, content: 'Done 2', grade: null, submittedAt: recentDate },
    { assignmentId: a2._id, studentId: accounts.student1._id, content: 'Old 1', grade: 14, submittedAt: oldDate },
  ]);

  const q1 = await Quiz.create({
    courseId: seededCourses.se104._id,
    title: 'SE Quiz 1',
    startTime: oldDate,
    endTime: new Date(Date.now() + 7 * dayMs),
    timeLimit: 20,
    maxScore: 10,
    questions: [
      { id: 'q1', prompt: 'Q1', options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], correctOptionId: 'a', points: 5 },
      { id: 'q2', prompt: 'Q2', options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], correctOptionId: 'b', points: 5 },
    ],
  });

  await QuizAttempt.create([
    {
      quizId: q1._id,
      studentId: accounts.student1._id,
      answers: [{ questionId: 'q1', selectedOptionId: 'a' }],
      result: 8,
      startedAt: recentDate,
      submittedAt: recentDate,
    },
    {
      quizId: q1._id,
      studentId: accounts.student2._id,
      answers: [],
      result: null,
      startedAt: recentDate,
      submittedAt: null,
    },
  ]);
}

async function collectionCounts() {
  const [users, courses, enrollments, assignments, submissions, quizzes, quizAttempts] = await Promise.all([
    User.countDocuments(),
    Course.countDocuments(),
    Enrollment.countDocuments(),
    Assignment.countDocuments(),
    Submission.countDocuments(),
    Quiz.countDocuments(),
    QuizAttempt.countDocuments(),
  ]);
  return { users, courses, enrollments, assignments, submissions, quizzes, quizAttempts };
}

test.before(async () => {
  database = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    binary: { downloadDir: path.resolve('.cache/mongodb-binaries') },
  });
  await mongoose.connect(database.getUri(), { dbName: 'a06_statistics_isolated_test' });
  await Promise.all([
    User.createCollection(),
    Course.createCollection(),
    Enrollment.createCollection(),
    Assignment.createCollection(),
    Submission.createCollection(),
    Quiz.createCollection(),
    QuizAttempt.createCollection(),
  ]);
  await Promise.all([
    User.createIndexes(),
    Course.createIndexes(),
    Enrollment.createIndexes(),
    Assignment.createIndexes(),
    Submission.createIndexes(),
    Quiz.createIndexes(),
    QuizAttempt.createIndexes(),
  ]);
  await migrateAuth();

  const passwordHash = await bcrypt.hash(basePassword, 12);
  accounts.admin = await User.create({ email: 'admin@stat.test', fullName: 'Stat Admin', role: 'Administrator', passwordHash });
  accounts.mustChangeAdmin = await User.create({
    email: 'tempadmin@stat.test',
    fullName: 'Temp Admin',
    role: 'Administrator',
    passwordHash,
    mustChangePassword: true,
  });
  accounts.instructor = await User.create({ email: 'inst@stat.test', fullName: 'Dr. Stat Instructor', role: 'Instructor', passwordHash });
  accounts.student1 = await User.create({ email: 'stu1@stat.test', fullName: 'Student One', role: 'Student', passwordHash });
  accounts.student2 = await User.create({ email: 'stu2@stat.test', fullName: 'Student Two', role: 'Student', passwordHash });
});

test.after(async () => {
  await mongoose.disconnect();
  await database?.stop();
});

test.beforeEach(async () => {
  await AuthRateLimit.deleteMany({});
  await seedDataset();
});

test('enforces authentication, Administrator RBAC, no-store header, mustChangePassword, and read-only post-condition', async () => {
  const unauth = await request(app).get('/api/admin/statistics');
  assert.equal(unauth.status, 401);

  const studentCookie = await signIn('stu1@stat.test');
  const studentRes = await request(app).get('/api/admin/statistics').set('Cookie', studentCookie);
  assert.equal(studentRes.status, 403);

  const instructorCookie = await signIn('inst@stat.test');
  const instructorRes = await request(app).get('/api/admin/statistics').set('Cookie', instructorCookie);
  assert.equal(instructorRes.status, 403);

  const tempAdminCookie = await signIn('tempadmin@stat.test');
  const tempAdminRes = await request(app).get('/api/admin/statistics').set('Cookie', tempAdminCookie);
  assert.equal(tempAdminRes.status, 403);

  const beforeCounts = await collectionCounts();
  const adminCookie = await signIn('admin@stat.test');
  const adminRes = await request(app).get('/api/admin/statistics').set('Cookie', adminCookie);
  assert.equal(adminRes.status, 200);
  assert.equal(adminRes.headers['cache-control'], 'no-store');
  assert.equal(JSON.stringify(adminRes.body).includes('passwordHash'), false);

  const afterCounts = await collectionCounts();
  assert.deepEqual(afterCounts, beforeCounts);
});

test('computes accurate system-wide summary and per-course breakdown (Main Flow)', async () => {
  const adminCookie = await signIn('admin@stat.test');
  const res = await request(app).get('/api/admin/statistics').set('Cookie', adminCookie);
  assert.equal(res.status, 200);
  assert.equal(res.body.meta.hasData, true);
  assert.equal(res.body.meta.noDataReason, null);
  assert.equal(res.body.meta.totalSystemCourses, 3);

  assert.deepEqual(res.body.summary.courses, {
    total: 3,
    active: 2,
    inactive: 1,
    assignedInstructor: 1,
    unassignedInstructor: 2,
  });
  assert.deepEqual(res.body.summary.enrollments, {
    total: 3,
    uniqueStudents: 2,
    coursesWithEnrollments: 2,
    averagePerCourse: 1,
  });
  // Graded: 9/10 (90%) and 14/20 (70%) -> average 80%
  assert.deepEqual(res.body.summary.submissions, {
    assignmentsTotal: 2,
    total: 3,
    graded: 2,
    pendingGrading: 1,
    averageScorePct: 80,
  });
  // Completed scored quiz attempts: 8/10 (80%, passed)
  assert.deepEqual(res.body.summary.quizAttempts, {
    quizzesTotal: 1,
    total: 2,
    completed: 1,
    inProgress: 1,
    passed: 1,
    passRatePct: 100,
    averageScorePct: 80,
  });

  const se = res.body.courseBreakdown.find((c) => c.courseCode === 'SE104');
  assert.equal(se.instructorName, 'Dr. Stat Instructor');
  assert.equal(se.enrollments, 2);
  assert.equal(se.submissionsTotal, 2);
  assert.equal(se.submissionsGraded, 1);
  assert.equal(se.submissionsPending, 1);
  assert.equal(se.averageAssignmentPct, 90);
  assert.equal(se.quizAttemptsTotal, 2);
  assert.equal(se.quizAttemptsCompleted, 1);
  assert.equal(se.averageQuizPct, 80);
  assert.equal(se.quizPassRatePct, 100);

  const dbi = res.body.courseBreakdown.find((c) => c.courseCode === 'DBI202');
  assert.equal(dbi.averageAssignmentPct, 70);
  assert.equal(dbi.instructorName, 'Not assigned');
});

test('supports Alternate Flow 4.1 filtering and rejects invalid statistical criteria', async () => {
  const adminCookie = await signIn('admin@stat.test');

  // Filter by Active status & 7d period (excludes old DBI202 enrollment/submission, keeps recent SE104)
  const filteredRes = await request(app)
    .get('/api/admin/statistics?courseStatus=Active&period=7d')
    .set('Cookie', adminCookie);
  assert.equal(filteredRes.status, 200);
  assert.equal(filteredRes.body.summary.courses.total, 2);
  assert.equal(filteredRes.body.summary.enrollments.total, 2);
  assert.equal(filteredRes.body.summary.submissions.total, 2);
  assert.equal(filteredRes.body.summary.submissions.averageScorePct, 90);
  assert.equal(filteredRes.body.filters.courses.length, 3);

  // Filter by specific courseId + activityType
  const singleCourseRes = await request(app)
    .get(`/api/admin/statistics?courseId=${seededCourses.dbi202._id.toString()}&activityType=assignments`)
    .set('Cookie', adminCookie);
  assert.equal(singleCourseRes.status, 200);
  assert.equal(singleCourseRes.body.courseBreakdown.length, 1);
  assert.equal(singleCourseRes.body.courseBreakdown[0].courseCode, 'DBI202');
  assert.equal(singleCourseRes.body.summary.submissions.averageScorePct, 70);

  // Invalid criteria rejected with 400 VALIDATION
  for (const qs of [
    'courseStatus=Archived',
    'activityType=discussions',
    'period=365d',
    'courseId=not-an-object-id',
  ]) {
    const bad = await request(app).get(`/api/admin/statistics?${qs}`).set('Cookie', adminCookie);
    assert.equal(bad.status, 400, `Expected 400 for ${qs}`);
    assert.equal(bad.body.code, 'VALIDATION');
  }
});

test('handles Exception Flow 2.1 (No Data Available) and Exception Flow 2.2 (Data Retrieval Failed)', async () => {
  const adminCookie = await signIn('admin@stat.test');

  // 2.1 No matching enrollments on Inactive courses
  const noEnrollRes = await request(app)
    .get('/api/admin/statistics?courseStatus=Inactive&activityType=enrollments')
    .set('Cookie', adminCookie);
  assert.equal(noEnrollRes.status, 200);
  assert.equal(noEnrollRes.body.meta.hasData, false);
  assert.equal(noEnrollRes.body.meta.noDataReason, 'no_enrollment_data');

  // 2.1 Conflicting courseStatus + courseId -> no matching courses
  const noMatchRes = await request(app)
    .get(`/api/admin/statistics?courseStatus=Inactive&courseId=${seededCourses.se104._id.toString()}`)
    .set('Cookie', adminCookie);
  assert.equal(noMatchRes.status, 200);
  assert.equal(noMatchRes.body.meta.hasData, false);
  assert.equal(noMatchRes.body.meta.noDataReason, 'no_matching_courses');

  // 2.1 No activity within last 7d on DBI202 (seeded 45d ago)
  const noPeriodRes = await request(app)
    .get(`/api/admin/statistics?courseId=${seededCourses.dbi202._id.toString()}&period=7d`)
    .set('Cookie', adminCookie);
  assert.equal(noPeriodRes.status, 200);
  assert.equal(noPeriodRes.body.meta.hasData, false);
  assert.equal(noPeriodRes.body.meta.noDataReason, 'no_period_activity');

  // 2.2 Simulated database retrieval failure returns safe 500 without leaking raw stack/error message
  const originalFind = Course.find;
  Course.find = () => {
    throw new Error('Simulated DB failure: secret connection string');
  };
  try {
    const failRes = await request(app).get('/api/admin/statistics').set('Cookie', adminCookie);
    assert.equal(failRes.status, 500);
    assert.equal(failRes.body.status, 'error');
    assert.equal(failRes.body.code, 'STATISTICS_RETRIEVAL_FAILED');
    assert.equal(JSON.stringify(failRes.body).includes('Simulated DB failure'), false);
    assert.equal(JSON.stringify(failRes.body).includes('secret connection string'), false);
  } finally {
    Course.find = originalFind;
  }

  // 2.1 Empty system (no courses at all)
  await Course.deleteMany({});
  const emptySystemRes = await request(app).get('/api/admin/statistics').set('Cookie', adminCookie);
  assert.equal(emptySystemRes.status, 200);
  assert.equal(emptySystemRes.body.meta.hasData, false);
  assert.equal(emptySystemRes.body.meta.noDataReason, 'empty_system');
});
