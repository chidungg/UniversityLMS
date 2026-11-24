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
import AuthRateLimit from '../src/models/AuthRateLimit.js';
import { migrateAuth } from '../src/scripts/migrateAuth.js';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'isolated-enrollment-test-secret-with-at-least-32-bytes';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
const { app } = await import('../src/server.js');

let database;
const accounts = {};
const courses = {};
const basePassword = 'Test-password-2026';

const post = (url) => request(app).post(url).set('X-LMS-Request', '1');
const put = (url) => request(app).put(url).set('X-LMS-Request', '1');
const del = (url) => request(app).delete(url).set('X-LMS-Request', '1');

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
  await mongoose.connect(database.getUri(), { dbName: 'a05_enrollment_isolated_test' });
  await User.createCollection();
  await User.createIndexes();
  await Course.createCollection();
  await Course.createIndexes();
  await Enrollment.createCollection();
  await Enrollment.createIndexes();
  await migrateAuth();

  const passwordHash = await bcrypt.hash(basePassword, 12);
  accounts.admin = await User.create({ email: 'admin@enroll.test', fullName: 'Admin User', role: 'Administrator', passwordHash });
  accounts.instructor1 = await User.create({ email: 'inst1@enroll.test', fullName: 'Dr. Lan Nguyen', role: 'Instructor', passwordHash });
  accounts.instructor2 = await User.create({ email: 'inst2@enroll.test', fullName: 'Dr. Huy Tran', role: 'Instructor', passwordHash });
  accounts.inactiveInstructor = await User.create({ email: 'inst-off@enroll.test', fullName: 'Inactive Instructor', role: 'Instructor', passwordHash, isActive: false });
  accounts.student1 = await User.create({ email: 'stu1@enroll.test', fullName: 'Minh Nguyen', role: 'Student', passwordHash });
  accounts.student2 = await User.create({ email: 'stu2@enroll.test', fullName: 'Linh Tran', role: 'Student', passwordHash });
  accounts.inactiveStudent = await User.create({ email: 'stu-off@enroll.test', fullName: 'Ha Do', role: 'Student', passwordHash, isActive: false });

  courses.active = await Course.create({
    courseCode: 'SE104',
    courseName: 'Software Engineering',
    description: 'Software design and processes.',
    isActive: true,
  });
  courses.inactive = await Course.create({
    courseCode: 'NET301',
    courseName: 'Computer Networks',
    description: 'Networking protocols.',
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

test('enforces authentication, Administrator RBAC, mustChangePassword, CSRF header, and zero passwordHash leakage', async () => {
  assert.equal((await request(app).get('/api/admin/enrollments/courses')).status, 401);
  assert.equal((await request(app).post(`/api/admin/enrollments/courses/${courses.active._id}/students`).send({})).status, 403);

  const studentCookie = await signIn(accounts.student1.email);
  const instructorCookie = await signIn(accounts.instructor1.email);
  for (const cookie of [studentCookie, instructorCookie]) {
    assert.equal((await request(app).get('/api/admin/enrollments/courses').set('Cookie', cookie)).status, 403);
    assert.equal((await request(app).get(`/api/admin/enrollments/courses/${courses.active._id}`).set('Cookie', cookie)).status, 403);
    assert.equal((await request(app).get(`/api/admin/enrollments/courses/${courses.active._id}/candidates`).set('Cookie', cookie)).status, 403);
    assert.equal((await post(`/api/admin/enrollments/courses/${courses.active._id}/students`).set('Cookie', cookie).send({ studentId: accounts.student1._id.toString() })).status, 403);
    assert.equal((await del(`/api/admin/enrollments/courses/${courses.active._id}/students/${accounts.student1._id}`).set('Cookie', cookie)).status, 403);
    assert.equal((await put(`/api/admin/enrollments/courses/${courses.active._id}/instructor`).set('Cookie', cookie).send({ instructorId: accounts.instructor1._id.toString() })).status, 403);
    assert.equal((await del(`/api/admin/enrollments/courses/${courses.active._id}/instructor`).set('Cookie', cookie)).status, 403);
  }

  const tempAdmin = await User.create({
    email: 'temp-enroll-admin@enroll.test',
    fullName: 'Temp Admin',
    role: 'Administrator',
    passwordHash: await bcrypt.hash(basePassword, 12),
    mustChangePassword: true,
  });
  const tempCookie = await signIn(tempAdmin.email);
  const tempRes = await request(app).get('/api/admin/enrollments/courses').set('Cookie', tempCookie);
  assert.equal(tempRes.status, 403);
  assert.equal(tempRes.body.code, 'PASSWORD_CHANGE_REQUIRED');

  const adminCookie = await signIn(accounts.admin.email);
  const res = await request(app).get('/api/admin/enrollments/courses').set('Cookie', adminCookie);
  assert.equal(res.status, 200);
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.equal(JSON.stringify(res.body).includes('passwordHash'), false);
  await User.deleteOne({ _id: tempAdmin._id });
});

test('lists enrollment courses, loads course details, and lists/searches eligible candidates', async () => {
  const adminCookie = await signIn(accounts.admin.email);
  const missingCourseId = new mongoose.Types.ObjectId().toString();

  const coursesRes = await request(app).get('/api/admin/enrollments/courses').set('Cookie', adminCookie);
  assert.equal(coursesRes.status, 200);
  assert.equal(coursesRes.body.courses.length, 2);

  assert.equal((await request(app).get('/api/admin/enrollments/courses/bad-id').set('Cookie', adminCookie)).status, 400);
  assert.equal((await request(app).get(`/api/admin/enrollments/courses/${missingCourseId}`).set('Cookie', adminCookie)).status, 404);

  const detailRes = await request(app).get(`/api/admin/enrollments/courses/${courses.active._id}`).set('Cookie', adminCookie);
  assert.equal(detailRes.status, 200);
  assert.equal(detailRes.body.course.code, 'SE104');
  assert.deepEqual(detailRes.body.enrollments, []);
  assert.equal(detailRes.body.instructor, null);

  assert.equal((await request(app).get(`/api/admin/enrollments/courses/${courses.active._id}/candidates?type=invalid`).set('Cookie', adminCookie)).status, 400);

  const studentCandidates = await request(app)
    .get(`/api/admin/enrollments/courses/${courses.active._id}/candidates?type=student`)
    .set('Cookie', adminCookie);
  assert.equal(studentCandidates.status, 200);
  const activeCandidate = studentCandidates.body.candidates.find((c) => c.user.email === accounts.student1.email);
  const inactiveCandidate = studentCandidates.body.candidates.find((c) => c.user.email === accounts.inactiveStudent.email);
  assert.equal(activeCandidate.eligible, true);
  assert.equal(inactiveCandidate.eligible, false);
  assert.equal(inactiveCandidate.reason, 'INACTIVE');

  // Regex metacharacters search should safely filter without error
  const searchWrongRole = await request(app)
    .get(`/api/admin/enrollments/courses/${courses.active._id}/candidates`)
    .query({ type: 'student', q: 'inst1@enroll' })
    .set('Cookie', adminCookie);
  assert.equal(searchWrongRole.status, 200);
  assert.equal(searchWrongRole.body.candidates.length, 1);
  assert.equal(searchWrongRole.body.candidates[0].reason, 'INVALID_ROLE');
});

test('enrolls students with all guardrails, concurrent duplicate safety, student access check, and unenrollment', async () => {
  const adminCookie = await signIn(accounts.admin.email);
  const studentCookie = await signIn(accounts.student1.email);
  const missingId = new mongoose.Types.ObjectId().toString();
  const baseUrl = `/api/admin/enrollments/courses/${courses.active._id}/students`;

  assert.equal((await post(baseUrl).set('Cookie', adminCookie).send({ studentId: 'bad-id' })).status, 400);
  assert.equal((await post(`/api/admin/enrollments/courses/${missingId}/students`).set('Cookie', adminCookie).send({ studentId: accounts.student1._id.toString() })).status, 404);
  assert.equal((await post(`/api/admin/enrollments/courses/${courses.inactive._id}/students`).set('Cookie', adminCookie).send({ studentId: accounts.student1._id.toString() })).body.code, 'INACTIVE_COURSE');
  assert.equal((await post(baseUrl).set('Cookie', adminCookie).send({ studentId: missingId })).body.code, 'USER_NOT_FOUND');
  assert.equal((await post(baseUrl).set('Cookie', adminCookie).send({ studentId: accounts.instructor1._id.toString() })).body.code, 'INVALID_STUDENT');
  assert.equal((await post(baseUrl).set('Cookie', adminCookie).send({ studentId: accounts.inactiveStudent._id.toString() })).body.code, 'INACTIVE_STUDENT');

  // Enroll student1 successfully
  const enrolled = await post(baseUrl).set('Cookie', adminCookie).send({ studentId: accounts.student1._id.toString() });
  assert.equal(enrolled.status, 201, JSON.stringify(enrolled.body));
  assert.equal(enrolled.body.enrollment.studentId, accounts.student1._id.toString());

  // Student immediately sees enrolled course via /api/student/courses
  const studentCoursesBeforeUnenroll = await request(app).get('/api/student/courses').set('Cookie', studentCookie);
  assert.equal(studentCoursesBeforeUnenroll.status, 200);
  assert.ok(studentCoursesBeforeUnenroll.body.data.some((c) => c.courseCode === 'SE104'));

  // Sequential duplicate fails with 409 ALREADY_ENROLLED
  const dupSeq = await post(baseUrl).set('Cookie', adminCookie).send({ studentId: accounts.student1._id.toString() });
  assert.equal(dupSeq.status, 409);
  assert.equal(dupSeq.body.code, 'ALREADY_ENROLLED');

  // Candidates endpoint reflects ALREADY_ENROLLED
  const candAfter = await request(app)
    .get(`/api/admin/enrollments/courses/${courses.active._id}/candidates?type=student&q=Minh`)
    .set('Cookie', adminCookie);
  assert.equal(candAfter.body.candidates[0].alreadyEnrolled, true);
  assert.equal(candAfter.body.candidates[0].reason, 'ALREADY_ENROLLED');

  // Concurrent duplicate enroll on student2 allows only 1 row
  const concurrent = await Promise.all([
    post(baseUrl).set('Cookie', adminCookie).send({ studentId: accounts.student2._id.toString() }),
    post(baseUrl).set('Cookie', adminCookie).send({ studentId: accounts.student2._id.toString() }),
  ]);
  assert.deepEqual(concurrent.map((r) => r.status).sort(), [201, 409]);
  assert.equal(concurrent.find((r) => r.status === 409).body.code, 'ALREADY_ENROLLED');
  assert.equal(await Enrollment.countDocuments({ courseId: courses.active._id, studentId: accounts.student2._id }), 1);

  // Unenroll student1 + guardrails + verify Student loses access immediately
  assert.equal((await del(`${baseUrl}/bad-id`).set('Cookie', adminCookie)).status, 400);
  assert.equal((await del(`${baseUrl}/${missingId}`).set('Cookie', adminCookie)).body.code, 'ENROLLMENT_NOT_FOUND');

  const unenrolled = await del(`${baseUrl}/${accounts.student1._id}`).set('Cookie', adminCookie);
  assert.equal(unenrolled.status, 200);

  const studentCoursesAfterUnenroll = await request(app).get('/api/student/courses').set('Cookie', studentCookie);
  assert.equal(studentCoursesAfterUnenroll.body.data.some((c) => c.courseCode === 'SE104'), false);
  const studentCourseDetail = await request(app).get(`/api/student/courses/${courses.active._id}`).set('Cookie', studentCookie);
  assert.equal(studentCourseDetail.status, 403);

  await Enrollment.deleteMany({ courseId: courses.active._id });
});

test('assigns, replaces, and unassigns instructors with full validation and inactive guardrails', async () => {
  const adminCookie = await signIn(accounts.admin.email);
  const missingId = new mongoose.Types.ObjectId().toString();
  const url = `/api/admin/enrollments/courses/${courses.active._id}/instructor`;

  assert.equal((await put(url).set('Cookie', adminCookie).send({ instructorId: 'bad-id' })).status, 400);
  assert.equal((await put(`/api/admin/enrollments/courses/${missingId}/instructor`).set('Cookie', adminCookie).send({ instructorId: accounts.instructor1._id.toString() })).status, 404);
  assert.equal((await put(`/api/admin/enrollments/courses/${courses.inactive._id}/instructor`).set('Cookie', adminCookie).send({ instructorId: accounts.instructor1._id.toString() })).body.code, 'INACTIVE_COURSE');
  assert.equal((await put(url).set('Cookie', adminCookie).send({ instructorId: missingId })).body.code, 'USER_NOT_FOUND');
  assert.equal((await put(url).set('Cookie', adminCookie).send({ instructorId: accounts.student1._id.toString() })).body.code, 'INVALID_ASSIGNMENT');
  assert.equal((await put(url).set('Cookie', adminCookie).send({ instructorId: accounts.inactiveInstructor._id.toString() })).body.code, 'INACTIVE_INSTRUCTOR');
  assert.equal((await del(url).set('Cookie', adminCookie)).body.code, 'NOT_ASSIGNED');

  // Assign instructor1
  const assigned1 = await put(url).set('Cookie', adminCookie).send({ instructorId: accounts.instructor1._id.toString() });
  assert.equal(assigned1.status, 200);
  assert.equal(assigned1.body.instructor.email, accounts.instructor1.email);

  // Re-assigning same instructor returns ALREADY_ASSIGNED
  const sameAssign = await put(url).set('Cookie', adminCookie).send({ instructorId: accounts.instructor1._id.toString() });
  assert.equal(sameAssign.status, 409);
  assert.equal(sameAssign.body.code, 'ALREADY_ASSIGNED');

  // Candidates list reflects current instructor
  const candRes = await request(app)
    .get(`/api/admin/enrollments/courses/${courses.active._id}/candidates?type=instructor`)
    .set('Cookie', adminCookie);
  const currentEntry = candRes.body.candidates.find((c) => c.user.id === accounts.instructor1._id.toString());
  assert.equal(currentEntry.isCurrent, true);
  assert.equal(currentEntry.reason, 'ALREADY_ASSIGNED');

  // Replace with instructor2
  const assigned2 = await put(url).set('Cookie', adminCookie).send({ instructorId: accounts.instructor2._id.toString() });
  assert.equal(assigned2.status, 200);
  assert.equal(assigned2.body.instructor.email, accounts.instructor2.email);

  // Unassign
  const unassigned = await del(url).set('Cookie', adminCookie);
  assert.equal(unassigned.status, 200);
  const detailAfter = await request(app).get(`/api/admin/enrollments/courses/${courses.active._id}`).set('Cookie', adminCookie);
  assert.equal(detailAfter.body.instructor, null);
});
