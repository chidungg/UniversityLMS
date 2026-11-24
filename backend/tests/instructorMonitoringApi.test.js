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
import LearningMaterial from '../src/models/LearningMaterial.js';
import Assignment from '../src/models/Assignment.js';
import Submission from '../src/models/Submission.js';
import Quiz from '../src/models/Quiz.js';
import QuizAttempt from '../src/models/QuizAttempt.js';
import AuthRateLimit from '../src/models/AuthRateLimit.js';
import { migrateAuth } from '../src/scripts/migrateAuth.js';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'isolated-instructor-monitoring-secret-with-at-least-32-bytes';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
const { app } = await import('../src/server.js');

let database;
const accounts = {};
const courses = {};
const basePassword = 'Test-password-2026';

const post = (url) => request(app).post(url).set('X-LMS-Request', '1');

async function signIn(email, password = basePassword) {
  const response = await post('/api/auth/login').send({ email, password });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  return response.headers['set-cookie'][0].split(';')[0];
}

async function collectionCounts() {
  const [users, courseCount, enrollments, materials, assignments, submissions, quizzes, quizAttempts] = await Promise.all([
    User.countDocuments(),
    Course.countDocuments(),
    Enrollment.countDocuments(),
    LearningMaterial.countDocuments(),
    Assignment.countDocuments(),
    Submission.countDocuments(),
    Quiz.countDocuments(),
    QuizAttempt.countDocuments(),
  ]);
  return { users, courseCount, enrollments, materials, assignments, submissions, quizzes, quizAttempts };
}

test.before(async () => {
  database = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    binary: { downloadDir: path.resolve('.cache/mongodb-binaries') },
  });
  await mongoose.connect(database.getUri(), { dbName: 'i06_monitoring_isolated_test' });
  await Promise.all([
    User.createCollection(),
    Course.createCollection(),
    Enrollment.createCollection(),
    LearningMaterial.createCollection(),
    Assignment.createCollection(),
    Submission.createCollection(),
    Quiz.createCollection(),
    QuizAttempt.createCollection(),
  ]);
  await Promise.all([
    User.createIndexes(),
    Course.createIndexes(),
    Enrollment.createIndexes(),
    LearningMaterial.createIndexes(),
    Assignment.createIndexes(),
    Submission.createIndexes(),
    Quiz.createIndexes(),
    QuizAttempt.createIndexes(),
  ]);
  await migrateAuth();

  const passwordHash = await bcrypt.hash(basePassword, 12);
  accounts.instructor1 = await User.create({ email: 'inst1@mon.test', fullName: 'Dr. Lan Nguyen', role: 'Instructor', passwordHash });
  accounts.instructor2 = await User.create({ email: 'inst2@mon.test', fullName: 'Dr. Huy Tran', role: 'Instructor', passwordHash });
  accounts.mustChangeInstructor = await User.create({
    email: 'tempinst@mon.test',
    fullName: 'Temp Instructor',
    role: 'Instructor',
    passwordHash,
    mustChangePassword: true,
  });
  accounts.admin = await User.create({ email: 'admin@mon.test', fullName: 'Admin User', role: 'Administrator', passwordHash });
  accounts.student1 = await User.create({ email: 'alice@mon.test', fullName: 'Alice Nguyen', role: 'Student', passwordHash });
  accounts.student2 = await User.create({ email: 'binh@mon.test', fullName: 'Binh Tran', role: 'Student', passwordHash });
  accounts.student3 = await User.create({ email: 'chi@mon.test', fullName: 'Chi Le', role: 'Student', passwordHash });

  const dayMs = 24 * 60 * 60 * 1000;
  const nowMs = Date.now();

  // Course 1: Full academic data for Gradebook & Learning Progress
  courses.full = await Course.create({
    courseCode: 'SE104',
    courseName: 'Software Engineering',
    description: 'Core SE concepts.',
    isActive: true,
    instructorId: accounts.instructor1._id,
  });

  // Course 2: Enrolled student, NO academic data (Exception 6.1)
  courses.noData = await Course.create({
    courseCode: 'CS201',
    courseName: 'Algorithms',
    description: 'No assessments yet.',
    isActive: true,
    instructorId: accounts.instructor1._id,
  });

  // Course 3: Enrolled student + assignment, NO submissions/attempts yet (Exception 6.1)
  courses.noRecords = await Course.create({
    courseCode: 'CS202',
    courseName: 'Databases',
    description: 'No student work recorded.',
    isActive: true,
    instructorId: accounts.instructor1._id,
  });

  // Course 4: Zero enrollments (Exception 3.1)
  courses.empty = await Course.create({
    courseCode: 'CS105',
    courseName: 'Empty Seminar',
    description: 'No enrolled students.',
    isActive: true,
    instructorId: accounts.instructor1._id,
  });

  // Course 5: Owned by another instructor (ownership enforcement)
  courses.other = await Course.create({
    courseCode: 'OTHER101',
    courseName: 'Other Course',
    description: 'Assigned to instructor2.',
    isActive: true,
    instructorId: accounts.instructor2._id,
  });

  await Enrollment.create([
    { courseId: courses.full._id, studentId: accounts.student1._id, enrolledAt: new Date(nowMs - 10 * dayMs) },
    { courseId: courses.full._id, studentId: accounts.student2._id, enrolledAt: new Date(nowMs - 9 * dayMs) },
    { courseId: courses.full._id, studentId: accounts.student3._id, enrolledAt: new Date(nowMs - 8 * dayMs) },
    { courseId: courses.noData._id, studentId: accounts.student1._id, enrolledAt: new Date(nowMs - 5 * dayMs) },
    { courseId: courses.noRecords._id, studentId: accounts.student1._id, enrolledAt: new Date(nowMs - 5 * dayMs) },
  ]);

  await LearningMaterial.create({
    courseId: courses.full._id,
    title: 'Week 1 Lecture',
    type: 'LectureNote',
  });

  // 2 Assignments in SE104: A1 open, A2 past due
  const [a1, a2] = await Assignment.create([
    { courseId: courses.full._id, title: 'Lab 01', dueDate: new Date(nowMs + 5 * dayMs), maxScore: 10 },
    { courseId: courses.full._id, title: 'Lab 02', dueDate: new Date(nowMs - 1 * dayMs), maxScore: 10 },
  ]);
  await Assignment.create({
    courseId: courses.noRecords._id,
    title: 'Lab Zero',
    dueDate: new Date(nowMs + 5 * dayMs),
    maxScore: 10,
  });

  // Alice: graded on Lab 01 (8.5/10), ungraded on Lab 02 (submitted 1h after dueDate -> LATE)
  // Binh: graded on Lab 01 (6/10), missing Lab 02 (past due!)
  // Chi: no submissions
  await Submission.create([
    {
      assignmentId: a1._id,
      studentId: accounts.student1._id,
      content: 'Alice lab 1',
      grade: 8.5,
      feedback: 'Clear modular design.',
      submittedAt: new Date(nowMs - 2 * dayMs),
    },
    {
      assignmentId: a2._id,
      studentId: accounts.student1._id,
      content: 'Alice lab 2 late',
      grade: null,
      submittedAt: new Date(nowMs - 12 * 60 * 60 * 1000),
    },
    {
      assignmentId: a1._id,
      studentId: accounts.student2._id,
      content: 'Binh lab 1',
      grade: 6,
      feedback: 'Needs edge-case handling.',
      submittedAt: new Date(nowMs - 2 * dayMs),
    },
  ]);

  // 2 Quizzes in SE104: Q1 active, Q2 expired
  const [q1, q2] = await Quiz.create([
    {
      courseId: courses.full._id,
      title: 'Quiz 1 — Requirements',
      startTime: new Date(nowMs - 3 * dayMs),
      endTime: new Date(nowMs + 5 * dayMs),
      timeLimit: 30,
      maxScore: 10,
      questions: [
        { id: 'q1a', prompt: 'Q1', options: [{ id: '1', text: 'A' }, { id: '2', text: 'B' }], correctOptionId: '2', points: 5 },
        { id: 'q1b', prompt: 'Q2', options: [{ id: '1', text: 'A' }, { id: '2', text: 'B' }], correctOptionId: '1', points: 5 },
      ],
    },
    {
      courseId: courses.full._id,
      title: 'Quiz 2 — Modeling',
      startTime: new Date(nowMs - 7 * dayMs),
      endTime: new Date(nowMs - 1 * dayMs),
      timeLimit: 30,
      maxScore: 10,
      questions: [
        { id: 'q2a', prompt: 'Q1', options: [{ id: '1', text: 'A' }, { id: '2', text: 'B' }], correctOptionId: '1', points: 10 },
      ],
    },
  ]);

  // Alice: Q1 completed 8/10 (80%, passed), Q2 completed 10/10 (100%, passed)
  // Binh: Q1 in-progress (not submitted), Q2 completed 4/10 (40%, failed!)
  // Chi: no quiz attempts
  await QuizAttempt.create([
    {
      quizId: q1._id,
      studentId: accounts.student1._id,
      answers: [{ questionId: 'q1a', selectedOptionId: '2' }],
      result: 8,
      startedAt: new Date(nowMs - 2 * dayMs),
      submittedAt: new Date(nowMs - 2 * dayMs),
    },
    {
      quizId: q2._id,
      studentId: accounts.student1._id,
      answers: [{ questionId: 'q2a', selectedOptionId: '1' }],
      result: 10,
      startedAt: new Date(nowMs - 3 * dayMs),
      submittedAt: new Date(nowMs - 3 * dayMs),
    },
    {
      quizId: q1._id,
      studentId: accounts.student2._id,
      answers: [],
      result: null,
      startedAt: new Date(nowMs - 5 * 60 * 1000),
      submittedAt: null,
    },
    {
      quizId: q2._id,
      studentId: accounts.student2._id,
      answers: [{ questionId: 'q2a', selectedOptionId: '2' }],
      result: 4,
      startedAt: new Date(nowMs - 2 * dayMs),
      submittedAt: new Date(nowMs - 2 * dayMs),
    },
  ]);
});

test.after(async () => {
  await mongoose.disconnect();
  await database?.stop();
});

test.beforeEach(async () => {
  await AuthRateLimit.deleteMany({});
});

test('enforces authentication, Instructor RBAC, course ownership, read-only post-condition, and safe projection', async () => {
  const id = String(courses.full._id);

  assert.equal((await request(app).get(`/api/instructor/courses/${id}/monitoring/gradebook`)).status, 401);
  assert.equal((await request(app).get(`/api/instructor/courses/${id}/monitoring/progress`)).status, 401);

  const studentCookie = await signIn('alice@mon.test');
  assert.equal((await request(app).get(`/api/instructor/courses/${id}/monitoring/gradebook`).set('Cookie', studentCookie)).status, 403);

  const adminCookie = await signIn('admin@mon.test');
  assert.equal((await request(app).get(`/api/instructor/courses/${id}/monitoring/progress`).set('Cookie', adminCookie)).status, 403);

  const tempInstCookie = await signIn('tempinst@mon.test');
  assert.equal((await request(app).get(`/api/instructor/courses/${id}/monitoring/gradebook`).set('Cookie', tempInstCookie)).status, 403);

  const inst1Cookie = await signIn('inst1@mon.test');
  const badIdRes = await request(app).get('/api/instructor/courses/not-valid/monitoring/gradebook').set('Cookie', inst1Cookie);
  assert.equal(badIdRes.status, 400);
  assert.equal(badIdRes.body.code, 'INVALID_COURSE_ID');

  const otherCourseRes = await request(app)
    .get(`/api/instructor/courses/${courses.other._id}/monitoring/gradebook`)
    .set('Cookie', inst1Cookie);
  assert.equal(otherCourseRes.status, 404);
  assert.equal(otherCourseRes.body.code, 'COURSE_UNAVAILABLE');

  const before = await collectionCounts();
  const [gradeRes, progRes] = await Promise.all([
    request(app).get(`/api/instructor/courses/${id}/monitoring/gradebook`).set('Cookie', inst1Cookie),
    request(app).get(`/api/instructor/courses/${id}/monitoring/progress`).set('Cookie', inst1Cookie),
  ]);
  assert.equal(gradeRes.status, 200);
  assert.equal(progRes.status, 200);
  assert.equal(gradeRes.headers['cache-control'], 'no-store');
  assert.equal(progRes.headers['cache-control'], 'no-store');

  const serialized = JSON.stringify([gradeRes.body, progRes.body]);
  assert.equal(serialized.includes('passwordHash'), false);
  assert.equal(serialized.includes('correctOptionId'), false);

  assert.deepEqual(await collectionCounts(), before);
});

test('5.1 View Gradebook returns student grade matrix, pending/late states, averages, and search filtering', async () => {
  const inst1Cookie = await signIn('inst1@mon.test');
  const res = await request(app)
    .get(`/api/instructor/courses/${courses.full._id}/monitoring/gradebook`)
    .set('Cookie', inst1Cookie);

  assert.equal(res.status, 200);
  const { data } = res.body;
  assert.equal(data.hasEnrolledStudents, true);
  assert.equal(data.hasAcademicData, true);
  assert.equal(data.emptyReason, null);
  assert.equal(data.summary.enrolledCount, 3);
  assert.equal(data.summary.gradedSubmissions, 2);
  assert.equal(data.summary.pendingGrading, 1);
  assert.equal(data.summary.completedQuizAttempts, 3);
  // Class graded assignments: 85% and 60% -> avg 72.5%
  assert.equal(data.summary.classAssignmentAvgPct, 72.5);
  // Class completed quizzes: 80%, 100%, 40% -> avg 73.3%, passRate 67%
  assert.equal(data.summary.classQuizAvgPct, 73.3);
  assert.equal(data.summary.quizPassRatePct, 67);

  const alice = data.rows.find((row) => row.student.email === 'alice@mon.test');
  const aliceLab1 = alice.assignmentGrades.find((item) => item.title === 'Lab 01');
  const aliceLab2 = alice.assignmentGrades.find((item) => item.title === 'Lab 02');
  const aliceQuiz1 = alice.quizGrades.find((item) => item.title === 'Quiz 1 — Requirements');
  const aliceQuiz2 = alice.quizGrades.find((item) => item.title === 'Quiz 2 — Modeling');
  assert.equal(aliceLab1.status, 'GRADED');
  assert.equal(aliceLab1.grade, 8.5);
  assert.equal(aliceLab1.percentage, 85);
  assert.equal(aliceLab1.feedback, 'Clear modular design.');
  assert.equal(aliceLab2.status, 'SUBMITTED');
  assert.equal(aliceLab2.grade, null);
  assert.equal(aliceLab2.isLate, true);
  assert.equal(aliceQuiz1.score, 8);
  assert.equal(aliceQuiz1.passed, true);
  assert.equal(aliceQuiz2.score, 10);
  assert.equal(alice.summary.assignmentAveragePct, 85);
  assert.equal(alice.summary.quizAveragePct, 90);
  // Scored items: 85, 80, 100 -> 265 / 3 = 88.3
  assert.equal(alice.summary.overallAveragePct, 88.3);

  const binh = data.rows.find((row) => row.student.email === 'binh@mon.test');
  const binhLab2 = binh.assignmentGrades.find((item) => item.title === 'Lab 02');
  const binhQuiz1 = binh.quizGrades.find((item) => item.title === 'Quiz 1 — Requirements');
  const binhQuiz2 = binh.quizGrades.find((item) => item.title === 'Quiz 2 — Modeling');
  assert.equal(binhLab2.status, 'NOT_SUBMITTED');
  assert.equal(binhLab2.isPastDue, true);
  assert.equal(binhQuiz1.status, 'IN_PROGRESS');
  assert.equal(binhQuiz1.score, null);
  assert.equal(binhQuiz2.passed, false);

  const chi = data.rows.find((row) => row.student.email === 'chi@mon.test');
  assert.equal(chi.summary.gradedItemsCount, 0);
  assert.equal(chi.summary.overallAveragePct, null);

  // Filter by search query keeps summary course-wide while filtering rows
  const searchRes = await request(app)
    .get(`/api/instructor/courses/${courses.full._id}/monitoring/gradebook?q=binh`)
    .set('Cookie', inst1Cookie);
  assert.equal(searchRes.status, 200);
  assert.equal(searchRes.body.data.rows.length, 1);
  assert.equal(searchRes.body.data.rows[0].student.email, 'binh@mon.test');
  assert.equal(searchRes.body.data.summary.enrolledCount, 3);
  assert.equal(searchRes.body.data.summary.filteredCount, 1);
});

test('5.2 Track Learning Progress returns factual completion, attention statuses, filters, and rejects bad filters', async () => {
  const inst1Cookie = await signIn('inst1@mon.test');
  const res = await request(app)
    .get(`/api/instructor/courses/${courses.full._id}/monitoring/progress`)
    .set('Cookie', inst1Cookie);

  assert.equal(res.status, 200);
  const { data } = res.body;
  assert.equal(data.summary.enrolledCount, 3);
  assert.equal(data.summary.materialCount, 1);
  assert.equal(data.summary.trackedItemsTotal, 4);
  assert.equal(data.summary.studentsOnTrack, 1);
  assert.equal(data.summary.studentsNeedingAttention, 1);
  assert.equal(data.summary.studentsWithNoActivity, 1);

  const alice = data.rows.find((row) => row.student.email === 'alice@mon.test');
  assert.equal(alice.progress.assignmentsSubmitted, 2);
  assert.equal(alice.progress.assignmentsLate, 1);
  assert.equal(alice.progress.quizzesCompleted, 2);
  assert.equal(alice.progress.trackedItemsCompleted, 4);
  assert.equal(alice.progress.completionRatePct, 100);
  assert.equal(alice.progress.attentionStatus, 'ON_TRACK');
  assert.ok(alice.progress.lastActivityAt);

  const binh = data.rows.find((row) => row.student.email === 'binh@mon.test');
  assert.equal(binh.progress.assignmentsMissingPastDue, 1);
  assert.equal(binh.progress.quizzesInProgress, 1);
  assert.equal(binh.progress.attentionStatus, 'NEEDS_ATTENTION');

  const chi = data.rows.find((row) => row.student.email === 'chi@mon.test');
  assert.equal(chi.progress.trackedItemsCompleted, 0);
  assert.equal(chi.progress.completionRatePct, 0);
  assert.equal(chi.progress.lastActivityAt, null);
  assert.equal(chi.progress.attentionStatus, 'NO_ACTIVITY');

  // Filter by status=NEEDS_ATTENTION
  const attentionRes = await request(app)
    .get(`/api/instructor/courses/${courses.full._id}/monitoring/progress?status=NEEDS_ATTENTION`)
    .set('Cookie', inst1Cookie);
  assert.equal(attentionRes.status, 200);
  assert.equal(attentionRes.body.data.rows.length, 1);
  assert.equal(attentionRes.body.data.rows[0].student.email, 'binh@mon.test');

  const badStatus = await request(app)
    .get(`/api/instructor/courses/${courses.full._id}/monitoring/progress?status=UNKNOWN`)
    .set('Cookie', inst1Cookie);
  assert.equal(badStatus.status, 400);
  assert.equal(badStatus.body.code, 'INVALID_MONITORING_FILTER');
});

test('handles Exception Flows 3.1 (No Students Enrolled), 6.1 (No Academic Data), and 6.2 (Data Retrieval Failed)', async () => {
  const inst1Cookie = await signIn('inst1@mon.test');

  // 3.1 No Students Enrolled
  const emptyGrade = await request(app)
    .get(`/api/instructor/courses/${courses.empty._id}/monitoring/gradebook`)
    .set('Cookie', inst1Cookie);
  assert.equal(emptyGrade.status, 200);
  assert.equal(emptyGrade.body.data.hasEnrolledStudents, false);
  assert.equal(emptyGrade.body.data.emptyReason, 'NO_STUDENTS_ENROLLED');

  const emptyProgress = await request(app)
    .get(`/api/instructor/courses/${courses.empty._id}/monitoring/progress`)
    .set('Cookie', inst1Cookie);
  assert.equal(emptyProgress.status, 200);
  assert.equal(emptyProgress.body.data.hasEnrolledStudents, false);
  assert.equal(emptyProgress.body.data.emptyReason, 'NO_STUDENTS_ENROLLED');

  // 6.1 No assessments created yet
  const noDataGrade = await request(app)
    .get(`/api/instructor/courses/${courses.noData._id}/monitoring/gradebook`)
    .set('Cookie', inst1Cookie);
  assert.equal(noDataGrade.status, 200);
  assert.equal(noDataGrade.body.data.hasEnrolledStudents, true);
  assert.equal(noDataGrade.body.data.hasAcademicData, false);
  assert.equal(noDataGrade.body.data.emptyReason, 'NO_ASSESSMENTS');

  // 6.1 Assessment exists, zero submissions / quiz attempts recorded
  const noRecordsGrade = await request(app)
    .get(`/api/instructor/courses/${courses.noRecords._id}/monitoring/gradebook`)
    .set('Cookie', inst1Cookie);
  assert.equal(noRecordsGrade.status, 200);
  assert.equal(noRecordsGrade.body.data.hasAcademicData, false);
  assert.equal(noRecordsGrade.body.data.emptyReason, 'NO_GRADE_RECORDS');

  const noRecordsProgress = await request(app)
    .get(`/api/instructor/courses/${courses.noRecords._id}/monitoring/progress`)
    .set('Cookie', inst1Cookie);
  assert.equal(noRecordsProgress.status, 200);
  assert.equal(noRecordsProgress.body.data.hasAcademicData, false);
  assert.equal(noRecordsProgress.body.data.emptyReason, 'NO_PROGRESS_RECORDS');

  // 6.2 Simulated DB retrieval failure returns safe 500 without leaking raw message
  const originalFind = Assignment.find;
  Assignment.find = () => ({
    select() { return this; },
    sort() { return this; },
    lean: () => Promise.reject(new Error('Simulated internal monitoring failure')),
  });
  try {
    const failRes = await request(app)
      .get(`/api/instructor/courses/${courses.full._id}/monitoring/gradebook`)
      .set('Cookie', inst1Cookie);
    assert.equal(failRes.status, 500);
    assert.equal(failRes.body.code, 'MONITORING_RETRIEVAL_FAILED');
    assert.equal(JSON.stringify(failRes.body).includes('Simulated internal monitoring failure'), false);
  } finally {
    Assignment.find = originalFind;
  }
});
