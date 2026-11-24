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
import Quiz from '../src/models/Quiz.js';
import AuthRateLimit from '../src/models/AuthRateLimit.js';
import { migrateAuth } from '../src/scripts/migrateAuth.js';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'isolated-course-test-secret-with-at-least-32-bytes';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
const { app } = await import('../src/server.js');

let database;
const accounts = {};
const seededCourses = {};
const basePassword = 'Test-password-2026';

const post = (url) => request(app).post(url).set('X-LMS-Request', '1');
const patch = (url) => request(app).patch(url).set('X-LMS-Request', '1');

async function signIn(email, password = basePassword) {
  const response = await post('/api/auth/login').send({ email, password });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  return response.headers['set-cookie'][0].split(';')[0];
}

test.before(async () => {
  database = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    binary: { downloadDir: path.resolve('.cache/mongodb-binaries') },
  });
  await mongoose.connect(database.getUri(), { dbName: 'a03_course_isolated_test' });
  await User.createCollection();
  await User.createIndexes();
  await Course.createCollection();
  await Course.createIndexes();
  await Enrollment.createCollection();
  await Enrollment.createIndexes();
  await LearningMaterial.createCollection();
  await Assignment.createCollection();
  await Quiz.createCollection();
  await migrateAuth();

  const passwordHash = await bcrypt.hash(basePassword, 12);
  for (const role of ['Administrator', 'Instructor', 'Student']) {
    accounts[role] = await User.create({
      email: `${role.toLowerCase()}@courses.test`,
      fullName: `Primary ${role}`,
      role,
      passwordHash,
      isActive: true,
      mustChangePassword: false,
    });
  }

  seededCourses.se104 = await Course.create({
    courseCode: 'SE104',
    courseName: 'Software Engineering',
    description: 'Software development processes and UML.',
    isActive: true,
  });
  seededCourses.net301 = await Course.create({
    courseCode: 'NET301',
    courseName: 'Computer Networks',
    description: 'TCP/IP and routing fundamentals.',
    isActive: false,
  });
});

test.after(async () => {
  await mongoose.disconnect();
  await database?.stop();
});

test.beforeEach(async () => {
  await AuthRateLimit.deleteMany({});
});

test('enforces authentication, Administrator RBAC, mustChangePassword, CSRF header, and cache-control', async () => {
  assert.equal((await request(app).get('/api/admin/courses')).status, 401);
  assert.equal((await request(app).post('/api/admin/courses').send({})).status, 403);

  const studentCookie = await signIn(accounts.Student.email);
  const instructorCookie = await signIn(accounts.Instructor.email);
  for (const cookie of [studentCookie, instructorCookie]) {
    assert.equal((await request(app).get('/api/admin/courses').set('Cookie', cookie)).status, 403);
    assert.equal((await request(app).get(`/api/admin/courses/${seededCourses.se104._id}`).set('Cookie', cookie)).status, 403);
    assert.equal((await post('/api/admin/courses').set('Cookie', cookie).send({ code: 'CS101', name: 'Intro CS' })).status, 403);
    assert.equal((await patch(`/api/admin/courses/${seededCourses.se104._id}`).set('Cookie', cookie).send({ code: 'SE104', name: 'Changed' })).status, 403);
    assert.equal((await patch(`/api/admin/courses/${seededCourses.se104._id}/status`).set('Cookie', cookie).send({ isActive: false })).status, 403);
  }

  const tempAdmin = await User.create({
    email: 'temp-course-admin@courses.test',
    fullName: 'Temp Admin',
    role: 'Administrator',
    passwordHash: await bcrypt.hash(basePassword, 12),
    mustChangePassword: true,
  });
  const tempCookie = await signIn(tempAdmin.email);
  const tempRes = await request(app).get('/api/admin/courses').set('Cookie', tempCookie);
  assert.equal(tempRes.status, 403);
  assert.equal(tempRes.body.code, 'PASSWORD_CHANGE_REQUIRED');

  const adminCookie = await signIn(accounts.Administrator.email);
  const listRes = await request(app).get('/api/admin/courses').set('Cookie', adminCookie);
  assert.equal(listRes.status, 200);
  assert.equal(listRes.headers['cache-control'], 'no-store');
  await User.deleteOne({ _id: tempAdmin._id });
});

test('lists, searches safely (including regex metacharacters), filters status, paginates, and rejects invalid query', async () => {
  const adminCookie = await signIn(accounts.Administrator.email);
  const specialCourse = await Course.create({
    courseCode: 'CS-101.A',
    courseName: 'Algorithms [Track+2] (Honors)',
    description: 'Complexity & graph theory fundamentals.',
    isActive: true,
  });

  const allRes = await request(app).get('/api/admin/courses').set('Cookie', adminCookie);
  assert.equal(allRes.status, 200);
  assert.ok(allRes.body.courses.length >= 3);

  const regexLiteralMiss = await request(app)
    .get('/api/admin/courses')
    .query({ q: '[Track+', status: 'Inactive' })
    .set('Cookie', adminCookie);
  assert.equal(regexLiteralMiss.status, 200);
  assert.equal(regexLiteralMiss.body.courses.length, 0);

  const searchRes = await request(app)
    .get('/api/admin/courses')
    .query({ q: '[Track+2]', status: 'Active' })
    .set('Cookie', adminCookie);
  assert.equal(searchRes.status, 200);
  assert.equal(searchRes.body.courses.length, 1);
  assert.equal(searchRes.body.courses[0].courseCode, 'CS-101.A');

  const paged = await request(app)
    .get('/api/admin/courses?page=1&limit=2')
    .set('Cookie', adminCookie);
  assert.equal(paged.status, 200);
  assert.equal(paged.body.courses.length, 2);
  assert.ok(paged.body.pagination.total >= 3);

  for (const invalid of ['status=Draft', 'page=0', 'limit=101']) {
    assert.equal((await request(app).get(`/api/admin/courses?${invalid}`).set('Cookie', adminCookie)).status, 400);
  }

  await Course.deleteOne({ _id: specialCourse._id });
});

test('gets course details with live academic counts and validates IDs', async () => {
  const adminCookie = await signIn(accounts.Administrator.email);
  const missingId = new mongoose.Types.ObjectId().toString();

  assert.equal((await request(app).get('/api/admin/courses/not-an-object-id').set('Cookie', adminCookie)).status, 400);
  assert.equal((await request(app).get(`/api/admin/courses/${missingId}`).set('Cookie', adminCookie)).status, 404);

  const enrollment = await Enrollment.create({ courseId: seededCourses.se104._id, studentId: accounts.Student._id });
  const material = await LearningMaterial.create({
    courseId: seededCourses.se104._id,
    title: 'Week 1 Slides',
    type: 'LectureNote',
    fileUrl: '/demo-assets/week1.pdf',
  });
  const assignment = await Assignment.create({
    courseId: seededCourses.se104._id,
    title: 'Lab 1',
    dueDate: new Date(Date.now() + 86400000),
    maxScore: 10,
  });
  const quiz = await Quiz.create({
    courseId: seededCourses.se104._id,
    title: 'Quiz 1',
    startTime: new Date(Date.now() - 3600000),
    endTime: new Date(Date.now() + 86400000),
    timeLimit: 20,
    questions: [
      {
        id: 'q1',
        prompt: 'Q1',
        options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }],
        correctOptionId: 'a',
      },
    ],
  });

  try {
    const detail = await request(app).get(`/api/admin/courses/${seededCourses.se104._id}`).set('Cookie', adminCookie);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.course.courseCode, 'SE104');
    assert.deepEqual(detail.body.course.counts, {
      enrollments: 1,
      materials: 1,
      assignments: 1,
      quizzes: 1,
    });
  } finally {
    await Promise.all([
      Enrollment.deleteOne({ _id: enrollment._id }),
      LearningMaterial.deleteOne({ _id: material._id }),
      Assignment.deleteOne({ _id: assignment._id }),
      Quiz.deleteOne({ _id: quiz._id }),
    ]);
  }
});

test('creates course with validation, case-insensitive duplicate code check, and uppercase normalization', async () => {
  const adminCookie = await signIn(accounts.Administrator.email);

  const missing = await post('/api/admin/courses').set('Cookie', adminCookie).send({});
  assert.equal(missing.status, 400);
  assert.equal(missing.body.code, 'VALIDATION');
  assert.ok(missing.body.fields.code);
  assert.ok(missing.body.fields.name);

  const badInputs = [
    { code: 'WEB 101', name: 'Web Dev' },
    { code: 'WEB!', name: 'Web Dev' },
    { code: 'A'.repeat(31), name: 'Web Dev' },
    { code: 'WEB101', name: ' '.repeat(5) },
    { code: 'WEB101', name: 'A'.repeat(201) },
    { code: 'WEB101', name: 'Web Dev', description: 'D'.repeat(501) },
    { code: { $ne: '' }, name: 'Web Dev' },
    { code: 'WEB101', name: 'Web Dev', description: { $gt: '' } },
  ];
  for (const payload of badInputs) {
    const res = await post('/api/admin/courses').set('Cookie', adminCookie).send(payload);
    assert.equal(res.status, 400, JSON.stringify(payload));
  }

  const duplicate = await post('/api/admin/courses').set('Cookie', adminCookie).send({
    courseCode: '  se104 ',
    courseName: 'Duplicate SE',
  });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.code, 'COURSE_EXISTS');
  assert.ok(duplicate.body.fields.code);

  const created = await post('/api/admin/courses').set('Cookie', adminCookie).send({
    courseCode: '  web101 ',
    courseName: '  Web Application Development ',
    description: '  Modern accessible web apps. ',
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.course.courseCode, 'WEB101');
  assert.equal(created.body.course.courseName, 'Web Application Development');
  assert.equal(created.body.course.description, 'Modern accessible web apps.');
  assert.equal(created.body.course.isActive, true);
  assert.equal(created.body.course.status, 'Active');
});

test('updates course with validation, duplicate check, and preserves ID and isActive status', async () => {
  const adminCookie = await signIn(accounts.Administrator.email);
  const missingId = new mongoose.Types.ObjectId().toString();

  assert.equal((await patch('/api/admin/courses/bad-id').set('Cookie', adminCookie).send({ code: 'X1', name: 'X' })).status, 400);
  assert.equal((await patch(`/api/admin/courses/${missingId}`).set('Cookie', adminCookie).send({ code: 'X1', name: 'X' })).status, 404);

  const invalid = await patch(`/api/admin/courses/${seededCourses.net301._id}`)
    .set('Cookie', adminCookie)
    .send({ code: 'bad code', name: '' });
  assert.equal(invalid.status, 400);
  assert.ok(invalid.body.fields.code);
  assert.ok(invalid.body.fields.name);

  const stillOriginal = await Course.findById(seededCourses.net301._id).lean();
  assert.equal(stillOriginal.courseCode, 'NET301');

  const duplicate = await patch(`/api/admin/courses/${seededCourses.net301._id}`)
    .set('Cookie', adminCookie)
    .send({ code: 'se104', name: 'Collision Test' });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.code, 'COURSE_EXISTS');

  const updated = await patch(`/api/admin/courses/${seededCourses.net301._id}`)
    .set('Cookie', adminCookie)
    .send({
      courseCode: ' net302 ',
      courseName: 'Computer Networks II',
      description: 'Updated routing and transport syllabus.',
    });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.course.id, seededCourses.net301._id.toString());
  assert.equal(updated.body.course.courseCode, 'NET302');
  assert.equal(updated.body.course.courseName, 'Computer Networks II');
  assert.equal(updated.body.course.isActive, false);

  // Restore NET301 for clarity
  await patch(`/api/admin/courses/${seededCourses.net301._id}`)
    .set('Cookie', adminCookie)
    .send({ courseCode: 'NET301', courseName: 'Computer Networks', description: 'TCP/IP and routing fundamentals.' });
});

test('changes course status and enforces immediate student visibility effect', async () => {
  const adminCookie = await signIn(accounts.Administrator.email);
  const studentCookie = await signIn(accounts.Student.email);
  const missingId = new mongoose.Types.ObjectId().toString();

  assert.equal((await patch('/api/admin/courses/bad-id/status').set('Cookie', adminCookie).send({ isActive: false })).status, 400);
  assert.equal((await patch(`/api/admin/courses/${missingId}/status`).set('Cookie', adminCookie).send({ isActive: false })).status, 404);
  assert.equal((await patch(`/api/admin/courses/${seededCourses.se104._id}/status`).set('Cookie', adminCookie).send({})).status, 400);
  assert.equal(
    (await patch(`/api/admin/courses/${seededCourses.se104._id}/status`).set('Cookie', adminCookie).send({ isActive: true, status: 'Inactive' })).status,
    400,
  );

  const enrollment = await Enrollment.create({ courseId: seededCourses.se104._id, studentId: accounts.Student._id });
  const beforeDeactivate = await request(app).get('/api/student/courses').set('Cookie', studentCookie);
  assert.equal(beforeDeactivate.status, 200);
  assert.ok(beforeDeactivate.body.data.some((c) => c.courseCode === 'SE104'));

  const deactivated = await patch(`/api/admin/courses/${seededCourses.se104._id}/status`)
    .set('Cookie', adminCookie)
    .send({ isActive: false });
  assert.equal(deactivated.status, 200);
  assert.equal(deactivated.body.course.isActive, false);
  assert.equal(deactivated.body.course.status, 'Inactive');

  const afterDeactivate = await request(app).get('/api/student/courses').set('Cookie', studentCookie);
  assert.equal(afterDeactivate.status, 200);
  assert.equal(afterDeactivate.body.data.some((c) => c.courseCode === 'SE104'), false);

  const reactivated = await patch(`/api/admin/courses/${seededCourses.se104._id}/status`)
    .set('Cookie', adminCookie)
    .send({ status: 'Active' });
  assert.equal(reactivated.status, 200);
  assert.equal(reactivated.body.course.isActive, true);
  assert.equal(reactivated.body.course.status, 'Active');

  const afterActivate = await request(app).get('/api/student/courses').set('Cookie', studentCookie);
  assert.equal(afterActivate.status, 200);
  assert.ok(afterActivate.body.data.some((c) => c.courseCode === 'SE104'));

  await Enrollment.deleteOne({ _id: enrollment._id });
});
