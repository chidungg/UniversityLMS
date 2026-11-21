import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import User from '../src/models/User.js';
import AuthSession from '../src/models/AuthSession.js';
import AuthRateLimit from '../src/models/AuthRateLimit.js';
import PasswordResetRequest from '../src/models/PasswordResetRequest.js';
import Course from '../src/models/Course.js';
import Enrollment from '../src/models/Enrollment.js';
import LearningMaterial from '../src/models/LearningMaterial.js';
import { migrateAuth } from '../src/scripts/migrateAuth.js';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'isolated-test-secret-with-at-least-32-bytes';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
const { app } = await import('../src/server.js');
let database;
const accounts = {};
const originalPassword = 'Test-password-2026';
const post = (url) => request(app).post(url).set('X-LMS-Request', '1');
const patch = (url) => request(app).patch(url).set('X-LMS-Request', '1');
async function signIn(role, password = originalPassword) {
  const response = await post('/api/auth/login').send({ email: accounts[role].email, password });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  return response.headers['set-cookie'][0].split(';')[0];
}
test.before(async () => {
  database = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { downloadDir: path.resolve('.cache/mongodb-binaries') } });
  // Explicit local URI; never use MONGO_URI/.env or the project's database.
  await mongoose.connect(database.getUri(), { dbName: 'a01_isolated_test' });
  await User.createCollection(); await User.createIndexes(); await migrateAuth();
  const passwordHash = await bcrypt.hash(originalPassword, 12);
  for (const role of ['Administrator', 'Instructor', 'Student']) accounts[role] = await User.create({ email: `${role.toLowerCase()}@a01.test`, fullName: `Test ${role}`, role, passwordHash });
});
test.after(async () => { await mongoose.disconnect(); await database?.stop(); });
test.beforeEach(async () => { await AuthRateLimit.deleteMany({}); });

test('login uses HttpOnly cookie, canonical schema and never exposes credentials', async () => {
  for (const role of Object.keys(accounts)) {
    const response = await post('/api/auth/login').send({ email: ` ${accounts[role].email.toUpperCase()} `, password: originalPassword });
    assert.equal(response.status, 200);
    assert.equal(response.body.user.role, role);
    assert.equal(response.body.user._id, accounts[role]._id.toString());
    assert.equal(response.body.token, undefined); assert.equal(response.body.user.passwordHash, undefined);
    assert.match(response.headers['set-cookie'][0], /HttpOnly/); assert.match(response.headers['set-cookie'][0], /SameSite=Lax/);
    assert.equal(response.headers['cache-control'], 'no-store');
    const me = await request(app).get('/api/auth/me').set('Cookie', response.headers['set-cookie'][0].split(';')[0]);
    assert.equal(me.status, 200); assert.equal(me.body.user.role, role);
  }
});
test('rejects malformed credentials, incorrect password, missing/expired/legacy JWT', async () => {
  assert.equal((await post('/api/auth/login').send({ email: { $ne: '' }, password: [] })).status, 400);
  assert.equal((await post('/api/auth/login').send({ email: accounts.Student.email, password: 'wrong' })).status, 401);
  assert.equal((await request(app).get('/api/auth/me')).status, 401);
  for (const token of [jwt.sign({ id: accounts.Student._id }, process.env.JWT_SECRET), jwt.sign({ sub: accounts.Student._id.toString(), sid: new mongoose.Types.ObjectId().toString() }, process.env.JWT_SECRET, { expiresIn: -1, issuer: 'university-lms', audience: 'university-lms' })]) {
    assert.equal((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`)).status, 401);
  }
});
test('logout revokes only the current session including replay via Bearer', async () => {
  const first = await signIn('Student'); const second = await signIn('Student');
  assert.equal((await post('/api/auth/logout').set('Cookie', first)).status, 204);
  assert.equal((await request(app).get('/api/auth/me').set('Cookie', first)).status, 401);
  assert.equal((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${first.split('=')[1]}`)).status, 401);
  assert.equal((await request(app).get('/api/auth/me').set('Cookie', second)).status, 200);
});
test('enforces roles and reads current role/account status from DB', async () => {
  const student = await signIn('Student'); const instructor = await signIn('Instructor');
  for (const cookie of [student, instructor]) assert.equal((await request(app).get('/api/admin/recovery-requests').set('Cookie', cookie)).status, 403);
  assert.equal((await request(app).get('/api/instructor/classes').set('Cookie', student)).status, 403);
  await User.updateOne({ _id: accounts.Instructor._id }, { role: 'Student' });
  assert.equal((await request(app).get('/api/instructor/classes').set('Cookie', instructor)).status, 403);
  await User.updateOne({ _id: accounts.Instructor._id }, { role: 'Instructor', isActive: false });
  assert.equal((await request(app).get('/api/auth/me').set('Cookie', instructor)).body.code, 'ACCOUNT_DISABLED');
  assert.equal((await post('/api/auth/login').send({ email: accounts.Instructor.email, password: originalPassword })).body.code, 'ACCOUNT_DISABLED');
  await User.updateOne({ _id: accounts.Instructor._id }, { isActive: true });
});

test('I01 lists and opens only courses assigned to the authenticated instructor', async () => {
  const cookie = await signIn('Instructor');
  const studentCookie = await signIn('Student');
  const other = await User.create({
    email: 'other-instructor@a01.test', fullName: 'Other Instructor', role: 'Instructor',
    passwordHash: await bcrypt.hash(originalPassword, 12),
  });
  const get = (path, session = cookie) => request(app).get(`/api/instructor${path}`).set('Cookie', session);

  assert.deepEqual((await get('/courses')).body.data, []);
  assert.equal((await get('/courses', studentCookie)).status, 403);
  assert.equal((await request(app).get('/api/instructor/courses')).status, 401);

  const [assigned, inactive, foreign, legacy] = await Course.create([
    { courseCode: 'I01-A', courseName: 'Algorithms (Lab)', instructorId: accounts.Instructor._id },
    { courseCode: 'I01-B', courseName: 'Previous Term', instructorId: accounts.Instructor._id, isActive: false },
    { courseCode: 'I01-C', courseName: 'Algorithms (Lab)', instructorId: other._id },
    { courseCode: 'I01-D', courseName: 'Unassigned Course' },
  ]);
  await Enrollment.create({ courseId: assigned._id, studentId: accounts.Student._id });
  await LearningMaterial.create({ courseId: assigned._id, title: 'Lab notes', type: 'LectureNote' });

  const list = await get(`/courses?status=active&q=${encodeURIComponent('(lab)')}&instructorId=${other._id}`);
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.data.map(({ _id }) => _id), [String(assigned._id)]);
  assert.equal(list.body.data[0].enrolledCount, 1);
  assert.equal(list.body.data[0].materialCount, 1);

  const detail = await get(`/courses/${assigned._id}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.data.course.instructor, accounts.Instructor.fullName);
  assert.deepEqual(detail.body.data.managementOptions, ['materials', 'assignments', 'quizzes']);
  assert.deepEqual((await get(`/courses/${inactive._id}`)).body.data.managementOptions, []);
  for (const unavailable of [foreign._id, legacy._id, new mongoose.Types.ObjectId()]) {
    assert.equal((await get(`/courses/${unavailable}`)).status, 404);
  }
  assert.equal((await get('/courses/not-an-id')).status, 400);
  assert.equal((await get('/courses?status=invalid')).status, 400);

  const dashboard = await get('/dashboard');
  assert.equal(dashboard.status, 200);
  assert.deepEqual(dashboard.body.data.courses.map(({ _id }) => _id), [String(assigned._id), String(inactive._id)]);
  assert.equal(dashboard.body.data.stats.uniqueStudents, 1);

  await Course.updateOne({ _id: assigned._id }, { $set: { instructorId: other._id } });
  assert.equal((await get(`/courses/${assigned._id}`)).status, 404);
});

test('I02 returns only students enrolled in the selected assigned course', async () => {
  const instructor = await signIn('Instructor');
  const student = await signIn('Student');
  const [assigned, empty, foreign] = await Course.create([
    { courseCode: 'I02-A', courseName: 'Assigned with enrollment', instructorId: accounts.Instructor._id },
    { courseCode: 'I02-B', courseName: 'Assigned without enrollment', instructorId: accounts.Instructor._id },
    { courseCode: 'I02-C', courseName: 'Assigned to another instructor', instructorId: new mongoose.Types.ObjectId() },
  ]);
  const enrolledAt = new Date('2026-09-12T00:00:00.000Z');
  await Enrollment.create([
    { courseId: assigned._id, studentId: accounts.Student._id, enrolledAt },
    { courseId: assigned._id, studentId: accounts.Administrator._id },
    { courseId: assigned._id, studentId: new mongoose.Types.ObjectId() },
    { courseId: foreign._id, studentId: accounts.Student._id },
  ]);
  const roster = (courseId) => request(app).get(`/api/instructor/courses/${courseId}/students`);

  assert.equal((await roster(assigned._id)).status, 401);
  assert.equal((await roster(assigned._id).set('Cookie', student)).status, 403);
  assert.equal((await roster(foreign._id).set('Cookie', instructor)).status, 404);
  assert.equal((await roster('invalid').set('Cookie', instructor)).status, 400);
  assert.deepEqual((await roster(empty._id).set('Cookie', instructor)).body.data, []);

  const response = await roster(assigned._id).set('Cookie', instructor);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data, [{
    _id: String(accounts.Student._id),
    fullName: accounts.Student.fullName,
    email: accounts.Student.email,
    enrolledAt: enrolledAt.toISOString(),
  }]);

  await Course.updateOne({ _id: assigned._id }, { $unset: { instructorId: 1 } });
  assert.equal((await roster(assigned._id).set('Cookie', instructor)).status, 404);
});

test('blocks cross-site mutations and enforces persisted rate limits', async () => {
  assert.equal((await request(app).post('/api/auth/login').send({})).status, 403);
  assert.equal((await post('/api/auth/login').set('Origin', 'https://untrusted.test').send({})).status, 403);
  const preflight = await request(app).options('/api/auth/login').set('Origin', 'https://untrusted.test');
  assert.equal(preflight.headers['access-control-allow-origin'], undefined);
  for (let i = 0; i < 10; i++) assert.equal((await post('/api/auth/recovery-requests').send({ email: 'unknown@a01.test' })).status, 202);
  const limited = await post('/api/auth/recovery-requests').send({ email: 'unknown@a01.test' });
  assert.equal(limited.status, 429); assert.ok(limited.headers['retry-after']);
});
test('recovery is generic, deduplicated and queryable only by Admin', async () => {
  const [known, unknown, duplicate] = await Promise.all([accounts.Student.email, 'missing@a01.test', accounts.Student.email].map((email) => post('/api/auth/recovery-requests').send({ email, note: 'Verify in person' })));
  assert.equal(known.status, 202); assert.deepEqual(known.body, unknown.body); assert.deepEqual(known.body, duplicate.body);
  assert.equal(await PasswordResetRequest.countDocuments({ email: accounts.Student.email, status: 'Pending' }), 1);
  const admin = await signIn('Administrator');
  const list = await request(app).get('/api/admin/recovery-requests?status=Pending&limit=1&page=1').set('Cookie', admin);
  assert.equal(list.status, 200); assert.equal(list.body.requests.length, 1); assert.ok(list.body.pagination.total >= 2);
  assert.equal(JSON.stringify(list.body).includes('passwordHash'), false);
  assert.equal((await request(app).get('/api/admin/recovery-requests?limit=100000').set('Cookie', admin)).status, 400);
});
test('Admin reset is atomic, audited, revokes old sessions and forces password change', async () => {
  const oldCookie = await signIn('Student'); const admin = await signIn('Administrator');
  await post('/api/auth/recovery-requests').send({ email: accounts.Student.email });
  const pending = await PasswordResetRequest.findOne({ email: accounts.Student.email, status: 'Pending' });
  const url = `/api/admin/recovery-requests/${pending._id}`;
  const body = { action: 'complete', verified: true, password: 'Temporary-pass-2026', confirmPassword: 'Temporary-pass-2026', resolutionNote: 'Identity verified in person' };
  assert.equal((await patch(url).set('Cookie', admin).send({ ...body, verified: false })).status, 400);
  assert.equal((await patch(url).set('Cookie', admin).send({ ...body, password: 'ắ'.repeat(30), confirmPassword: 'ắ'.repeat(30) })).status, 400);
  const responses = await Promise.all([patch(url).set('Cookie', admin).send(body), patch(url).set('Cookie', admin).send(body)]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
  const resolved = await PasswordResetRequest.findById(pending._id);
  assert.equal(resolved.status, 'Completed'); assert.equal(resolved.reviewedBy.toString(), accounts.Administrator._id.toString());
  assert.equal((await request(app).get('/api/auth/me').set('Cookie', oldCookie)).status, 401);
  assert.equal((await post('/api/auth/login').send({ email: accounts.Student.email, password: originalPassword })).status, 401);
  const temporaryCookie = await signIn('Student', body.password);
  assert.equal((await request(app).get('/api/auth/me').set('Cookie', temporaryCookie)).body.user.mustChangePassword, true);
  assert.equal((await request(app).get('/api/student/courses').set('Cookie', temporaryCookie)).body.code, 'PASSWORD_CHANGE_REQUIRED');
  const changed = await post('/api/auth/change-password').set('Cookie', temporaryCookie).send({ currentPassword: body.password, password: 'Private-password-2026', confirmPassword: 'Private-password-2026' });
  assert.equal(changed.status, 200);
  assert.equal((await request(app).get('/api/auth/me').set('Cookie', temporaryCookie)).status, 401);
  const newCookie = await signIn('Student', 'Private-password-2026');
  assert.equal((await request(app).get('/api/auth/me').set('Cookie', newCookie)).body.user.mustChangePassword, false);
});
test('reject preserves credentials; reset cannot target unknown, inactive, or self account', async () => {
  const admin = await signIn('Administrator');
  for (const [email, code] of [['missing@a01.test', 'UNMATCHED_ACCOUNT'], [accounts.Administrator.email, 'SELF_RESET'], [accounts.Instructor.email, 'ACCOUNT_DISABLED']]) {
    await post('/api/auth/recovery-requests').send({ email });
    if (email === accounts.Instructor.email) await User.updateOne({ _id: accounts.Instructor._id }, { isActive: false });
    const pending = await PasswordResetRequest.findOne({ email, status: 'Pending' });
    const url = `/api/admin/recovery-requests/${pending._id}`;
    const result = await patch(url).set('Cookie', admin).send({ action: 'complete', verified: true, password: 'Temporary-pass-2026', confirmPassword: 'Temporary-pass-2026' });
    assert.equal(result.body.code, code);
    assert.equal((await patch(url).set('Cookie', admin).send({ action: 'reject', resolutionNote: '' })).status, 400);
    assert.equal((await patch(url).set('Cookie', admin).send({ action: 'reject', resolutionNote: 'Identity could not be verified' })).status, 200);
    assert.equal((await patch(url).set('Cookie', admin).send({ action: 'reject', resolutionNote: 'Repeat' })).status, 409);
  }
  await User.updateOne({ _id: accounts.Instructor._id }, { isActive: true });
  await signIn('Instructor');
});
test('session expiry is enforced before TTL cleanup', async () => {
  const cookie = await signIn('Instructor');
  await AuthSession.updateMany({ userId: accounts.Instructor._id }, { expiresAt: new Date(Date.now() - 1000) });
  assert.equal((await request(app).get('/api/auth/me').set('Cookie', cookie)).status, 401);
});
test('reset supports Instructor and another Administrator, not only Student', async () => {
  const admin = await signIn('Administrator');
  for (const role of ['Instructor', 'Administrator']) {
    const email = `second-${role.toLowerCase()}@a01.test`;
    await User.create({ email, role, fullName: `Second ${role}`, passwordHash: await bcrypt.hash(originalPassword, 12) });
    await post('/api/auth/recovery-requests').send({ email });
    const pending = await PasswordResetRequest.findOne({ email, status: 'Pending' });
    const result = await patch(`/api/admin/recovery-requests/${pending._id}`).set('Cookie', admin).send({ action: 'complete', verified: true, password: 'Role-reset-password', confirmPassword: 'Role-reset-password' });
    assert.equal(result.status, 200);
    const login = await post('/api/auth/login').send({ email, password: 'Role-reset-password' });
    assert.equal(login.status, 200); assert.equal(login.body.user.role, role); assert.equal(login.body.user.mustChangePassword, true);
  }
});
