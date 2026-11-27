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
import PasswordResetRequest from '../src/models/PasswordResetRequest.js';
import LearningMaterial from '../src/models/LearningMaterial.js';
import Assignment from '../src/models/Assignment.js';
import Quiz from '../src/models/Quiz.js';
import AuthRateLimit from '../src/models/AuthRateLimit.js';
import { migrateAuth } from '../src/scripts/migrateAuth.js';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'isolated-admin-dashboard-test-secret-with-32-bytes';
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
    Quiz.deleteMany({}),
    Assignment.deleteMany({}),
    LearningMaterial.deleteMany({}),
    Enrollment.deleteMany({}),
    Course.deleteMany({}),
    PasswordResetRequest.deleteMany({}),
  ]);

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const [dbi202, se104, alg201, net301] = await Course.create([
    {
      courseCode: 'DBI202',
      courseName: 'Database Systems',
      description: 'Relational data modeling and SQL.',
      isActive: true,
      instructorId: accounts.instructorActive._id,
    },
    {
      courseCode: 'SE104',
      courseName: 'Software Engineering',
      description: 'Requirements and architecture.',
      isActive: true,
    },
    {
      courseCode: 'ALG201',
      courseName: 'Algorithms',
      description: 'Graph and dynamic programming.',
      isActive: true,
    },
    {
      courseCode: 'NET301',
      courseName: 'Computer Networks',
      description: 'Protocols and routing.',
      isActive: false,
    },
  ]);

  seededCourses.dbi202 = dbi202;
  seededCourses.se104 = se104;
  seededCourses.alg201 = alg201;
  seededCourses.net301 = net301;

  await Enrollment.create([
    { courseId: dbi202._id, studentId: accounts.student1._id, enrolledAt: new Date(now - 2 * dayMs) },
    { courseId: dbi202._id, studentId: accounts.student2._id, enrolledAt: new Date(now - dayMs) },
    { courseId: se104._id, studentId: accounts.student1._id, enrolledAt: new Date(now - dayMs) },
  ]);

  await LearningMaterial.create([
    { courseId: dbi202._id, title: 'Week 1 Slides', type: 'LectureNote' },
    { courseId: dbi202._id, title: 'Normalization Video', type: 'Video' },
  ]);

  await Assignment.create({
    courseId: dbi202._id,
    title: 'ER Modeling Lab',
    dueDate: new Date(now + 7 * dayMs),
    maxScore: 10,
  });

  await Quiz.create({
    courseId: dbi202._id,
    title: 'SQL Basics Quiz',
    startTime: new Date(now - dayMs),
    endTime: new Date(now + 7 * dayMs),
    timeLimit: 20,
    maxScore: 10,
    questions: [
      {
        id: 'q1',
        prompt: 'Which clause filters rows?',
        options: [
          { id: 'a', text: 'WHERE' },
          { id: 'b', text: 'ORDER BY' },
        ],
        correctOptionId: 'a',
        points: 10,
      },
    ],
  });

  await PasswordResetRequest.create([
    {
      email: accounts.student2.email,
      note: 'Locked out before lab',
      status: 'Pending',
      submittedAt: new Date(now - 1000),
      accountId: accounts.student2._id,
    },
    {
      email: 'unknown@dash.test',
      note: 'Need help accessing account',
      status: 'Pending',
      submittedAt: new Date(now - 60000),
      accountId: null,
    },
    {
      email: accounts.student1.email,
      note: 'Resolved previously',
      status: 'Completed',
      submittedAt: new Date(now - 2 * dayMs),
      reviewedAt: new Date(now - dayMs),
      reviewedBy: accounts.admin._id,
      accountId: accounts.student1._id,
    },
    {
      email: accounts.studentInactive.email,
      note: 'Rejected request',
      status: 'Rejected',
      submittedAt: new Date(now - 3 * dayMs),
      reviewedAt: new Date(now - 2 * dayMs),
      reviewedBy: accounts.admin._id,
      accountId: accounts.studentInactive._id,
    },
  ]);
}

async function collectionCounts() {
  const [users, courses, enrollments, resets, materials, assignments, quizzes] = await Promise.all([
    User.countDocuments(),
    Course.countDocuments(),
    Enrollment.countDocuments(),
    PasswordResetRequest.countDocuments(),
    LearningMaterial.countDocuments(),
    Assignment.countDocuments(),
    Quiz.countDocuments(),
  ]);
  return { users, courses, enrollments, resets, materials, assignments, quizzes };
}

test.before(async () => {
  database = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    binary: { downloadDir: path.resolve('.cache/mongodb-binaries') },
  });
  await mongoose.connect(database.getUri(), { dbName: 'admin_dashboard_api_test' });
  await Promise.all([
    User.createCollection(),
    Course.createCollection(),
    Enrollment.createCollection(),
    PasswordResetRequest.createCollection(),
    LearningMaterial.createCollection(),
    Assignment.createCollection(),
    Quiz.createCollection(),
  ]);
  await Promise.all([
    User.createIndexes(),
    Course.createIndexes(),
    Enrollment.createIndexes(),
    PasswordResetRequest.createIndexes(),
    LearningMaterial.createIndexes(),
    Assignment.createIndexes(),
    Quiz.createIndexes(),
  ]);
  await migrateAuth();

  const passwordHash = await bcrypt.hash(basePassword, 12);
  accounts.admin = await User.create({
    email: 'admin@dash.test',
    fullName: 'Dashboard Admin',
    role: 'Administrator',
    passwordHash,
  });
  accounts.mustChangeAdmin = await User.create({
    email: 'tempadmin@dash.test',
    fullName: 'Temp Admin',
    role: 'Administrator',
    passwordHash,
    mustChangePassword: true,
  });
  accounts.instructorActive = await User.create({
    email: 'inst1@dash.test',
    fullName: 'Dr. Active Instructor',
    role: 'Instructor',
    passwordHash,
    isActive: true,
  });
  accounts.instructorInactive = await User.create({
    email: 'inst2@dash.test',
    fullName: 'Dr. Inactive Instructor',
    role: 'Instructor',
    passwordHash,
    isActive: false,
  });
  accounts.student1 = await User.create({
    email: 'stu1@dash.test',
    fullName: 'Student One',
    role: 'Student',
    passwordHash,
    isActive: true,
  });
  accounts.student2 = await User.create({
    email: 'stu2@dash.test',
    fullName: 'Student Two',
    role: 'Student',
    passwordHash,
    isActive: true,
  });
  accounts.studentInactive = await User.create({
    email: 'stu3@dash.test',
    fullName: 'Student Inactive',
    role: 'Student',
    passwordHash,
    isActive: false,
  });
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
  const unauth = await request(app).get('/api/admin/dashboard');
  assert.equal(unauth.status, 401);

  const studentCookie = await signIn('stu1@dash.test');
  const studentRes = await request(app).get('/api/admin/dashboard').set('Cookie', studentCookie);
  assert.equal(studentRes.status, 403);

  const instructorCookie = await signIn('inst1@dash.test');
  const instructorRes = await request(app).get('/api/admin/dashboard').set('Cookie', instructorCookie);
  assert.equal(instructorRes.status, 403);

  const tempAdminCookie = await signIn('tempadmin@dash.test');
  const tempAdminRes = await request(app).get('/api/admin/dashboard').set('Cookie', tempAdminCookie);
  assert.equal(tempAdminRes.status, 403);

  const beforeCounts = await collectionCounts();
  const adminCookie = await signIn('admin@dash.test');
  const res = await request(app).get('/api/admin/dashboard').set('Cookie', adminCookie);
  assert.equal(res.status, 200);
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.equal(JSON.stringify(res.body).includes('passwordHash'), false);

  const afterCounts = await collectionCounts();
  assert.deepEqual(afterCounts, beforeCounts);
});

test('aggregates live user, course, enrollment, assessment, and attention metrics accurately', async () => {
  const adminCookie = await signIn('admin@dash.test');
  const res = await request(app).get('/api/admin/dashboard').set('Cookie', adminCookie);
  assert.equal(res.status, 200);
  assert.equal(Number.isNaN(Date.parse(res.body.generatedAt)), false);

  assert.deepEqual(res.body.summary, {
    users: {
      total: 7,
      active: 5,
      students: 3,
      activeStudents: 2,
      instructors: 2,
      activeInstructors: 1,
      administrators: 2,
    },
    courses: {
      total: 4,
      active: 3,
      inactive: 1,
      unassignedActive: 2,
      unenrolledActive: 1,
    },
    enrollments: {
      total: 3,
      uniqueStudents: 2,
    },
    pendingPasswordResets: 2,
    assessments: {
      materials: 2,
      assignments: 1,
      quizzes: 1,
    },
  });

  assert.deepEqual(
    res.body.courses.map((course) => course.code),
    ['ALG201', 'DBI202', 'NET301', 'SE104'],
  );

  const dbi = res.body.courses.find((course) => course.code === 'DBI202');
  assert.deepEqual(dbi, {
    id: seededCourses.dbi202._id.toString(),
    code: 'DBI202',
    name: 'Database Systems',
    description: 'Relational data modeling and SQL.',
    isActive: true,
    status: 'Active',
    instructor: {
      id: accounts.instructorActive._id.toString(),
      fullName: 'Dr. Active Instructor',
      email: 'inst1@dash.test',
      isActive: true,
    },
    enrolledCount: 2,
    counts: {
      enrollments: 2,
      materials: 2,
      assignments: 1,
      quizzes: 1,
    },
  });

  const se = res.body.courses.find((course) => course.code === 'SE104');
  assert.equal(se.instructor, null);
  assert.equal(se.enrolledCount, 1);

  assert.equal(res.body.attention.totalCount, 4);
  assert.deepEqual(
    res.body.attention.unassignedCourses.map((c) => ({ code: c.code, enrolledCount: c.enrolledCount })),
    [
      { code: 'ALG201', enrolledCount: 0 },
      { code: 'SE104', enrolledCount: 1 },
    ],
  );
  assert.equal(res.body.attention.pendingResets.length, 2);
  assert.equal(res.body.attention.pendingResets[0].email, 'stu2@dash.test');
  assert.equal(res.body.attention.pendingResets[0].hasAccount, true);
  assert.equal(res.body.attention.pendingResets[1].email, 'unknown@dash.test');
  assert.equal(res.body.attention.pendingResets[1].hasAccount, false);

  // Add 4 more Pending requests to verify list is capped at 5 while totals stay exact
  await PasswordResetRequest.create([
    { email: 'p3@dash.test', status: 'Pending' },
    { email: 'p4@dash.test', status: 'Pending' },
    { email: 'p5@dash.test', status: 'Pending' },
    { email: 'p6@dash.test', status: 'Pending' },
  ]);
  const cappedRes = await request(app).get('/api/admin/dashboard').set('Cookie', adminCookie);
  assert.equal(cappedRes.status, 200);
  assert.equal(cappedRes.body.summary.pendingPasswordResets, 6);
  assert.equal(cappedRes.body.attention.pendingResets.length, 5);
  assert.equal(cappedRes.body.attention.totalCount, 8);
});

test('handles empty academic dataset and simulated database retrieval failure cleanly', async () => {
  const adminCookie = await signIn('admin@dash.test');

  await Promise.all([
    Quiz.deleteMany({}),
    Assignment.deleteMany({}),
    LearningMaterial.deleteMany({}),
    Enrollment.deleteMany({}),
    Course.deleteMany({}),
    PasswordResetRequest.deleteMany({}),
  ]);

  const emptyRes = await request(app).get('/api/admin/dashboard').set('Cookie', adminCookie);
  assert.equal(emptyRes.status, 200);
  assert.deepEqual(emptyRes.body.summary.courses, {
    total: 0,
    active: 0,
    inactive: 0,
    unassignedActive: 0,
    unenrolledActive: 0,
  });
  assert.deepEqual(emptyRes.body.summary.enrollments, { total: 0, uniqueStudents: 0 });
  assert.equal(emptyRes.body.summary.pendingPasswordResets, 0);
  assert.deepEqual(emptyRes.body.summary.assessments, { materials: 0, assignments: 0, quizzes: 0 });
  assert.deepEqual(emptyRes.body.courses, []);
  assert.deepEqual(emptyRes.body.attention, {
    unassignedCourses: [],
    pendingResets: [],
    totalCount: 0,
  });

  const originalFind = Course.find;
  Course.find = () => {
    throw new Error('Simulated DB failure: secret mongo uri');
  };
  try {
    const failRes = await request(app).get('/api/admin/dashboard').set('Cookie', adminCookie);
    assert.equal(failRes.status, 500);
    assert.equal(failRes.body.status, 'error');
    assert.equal(failRes.body.code, 'DASHBOARD_RETRIEVAL_FAILED');
    assert.equal(JSON.stringify(failRes.body).includes('Simulated DB failure'), false);
    assert.equal(JSON.stringify(failRes.body).includes('secret mongo uri'), false);
  } finally {
    Course.find = originalFind;
  }
});
