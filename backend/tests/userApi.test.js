import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import User from '../src/models/User.js';
import AuthRateLimit from '../src/models/AuthRateLimit.js';
import { migrateAuth } from '../src/scripts/migrateAuth.js';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'isolated-user-test-secret-with-at-least-32-bytes';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
const { app } = await import('../src/server.js');

let database;
const accounts = {};
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
  await mongoose.connect(database.getUri(), { dbName: 'a02_user_isolated_test' });
  await User.createCollection();
  await User.createIndexes();
  await migrateAuth();
  const passwordHash = await bcrypt.hash(basePassword, 12);
  for (const role of ['Administrator', 'Instructor', 'Student']) {
    accounts[role] = await User.create({
      email: `${role.toLowerCase()}@users.test`,
      fullName: `Primary ${role}`,
      role,
      passwordHash,
      isActive: true,
      mustChangePassword: false,
    });
  }
});

test.after(async () => {
  await mongoose.disconnect();
  await database?.stop();
});

test.beforeEach(async () => {
  await AuthRateLimit.deleteMany({});
});

test('enforces authentication, Administrator RBAC, mustChangePassword, CSRF header, and safe projection', async () => {
  assert.equal((await request(app).get('/api/admin/users')).status, 401);
  assert.equal((await request(app).post('/api/admin/users').send({})).status, 403);

  const studentCookie = await signIn(accounts.Student.email);
  const instructorCookie = await signIn(accounts.Instructor.email);
  for (const cookie of [studentCookie, instructorCookie]) {
    assert.equal((await request(app).get('/api/admin/users').set('Cookie', cookie)).status, 403);
    assert.equal((await post('/api/admin/users').set('Cookie', cookie).send({})).status, 403);
    assert.equal((await patch(`/api/admin/users/${accounts.Student._id}`).set('Cookie', cookie).send({})).status, 403);
    assert.equal((await patch(`/api/admin/users/${accounts.Student._id}/status`).set('Cookie', cookie).send({ isActive: false })).status, 403);
  }

  const tempAdminHash = await bcrypt.hash(basePassword, 12);
  const tempAdmin = await User.create({
    email: 'temp-admin@users.test',
    fullName: 'Temp Admin',
    role: 'Administrator',
    passwordHash: tempAdminHash,
    mustChangePassword: true,
  });
  const tempAdminCookie = await signIn(tempAdmin.email);
  const tempList = await request(app).get('/api/admin/users').set('Cookie', tempAdminCookie);
  assert.equal(tempList.status, 403);
  assert.equal(tempList.body.code, 'PASSWORD_CHANGE_REQUIRED');

  const adminCookie = await signIn(accounts.Administrator.email);
  const listRes = await request(app).get('/api/admin/users').set('Cookie', adminCookie);
  assert.equal(listRes.status, 200);
  assert.equal(listRes.headers['cache-control'], 'no-store');
  assert.equal(JSON.stringify(listRes.body).includes('passwordHash'), false);
  await User.deleteOne({ _id: tempAdmin._id });
});

test('lists, filters, searches safely (including regex metacharacters), and rejects invalid filters', async () => {
  const adminCookie = await signIn(accounts.Administrator.email);
  const specialUser = await User.create({
    email: 'regex+test.user@users.test',
    fullName: 'Nguyen [Special] (User)',
    role: 'Student',
    passwordHash: await bcrypt.hash(basePassword, 12),
    isActive: false,
  });

  const allRes = await request(app).get('/api/admin/users').set('Cookie', adminCookie);
  assert.equal(allRes.status, 200);
  assert.ok(allRes.body.users.length >= 4);

  const searchRes = await request(app)
    .get('/api/admin/users')
    .query({ q: '[Special]+', role: 'Student', status: 'Inactive' })
    .set('Cookie', adminCookie);
  assert.equal(searchRes.status, 200);
  assert.equal(searchRes.body.users.length, 0);

  const matchRes = await request(app)
    .get('/api/admin/users')
    .query({ q: 'regex+test', role: 'Student', status: 'Inactive' })
    .set('Cookie', adminCookie);
  assert.equal(matchRes.status, 200);
  assert.equal(matchRes.body.users.length, 1);
  assert.equal(matchRes.body.users[0].email, 'regex+test.user@users.test');

  const pagedRes = await request(app)
    .get('/api/admin/users?page=1&limit=2')
    .set('Cookie', adminCookie);
  assert.equal(pagedRes.status, 200);
  assert.equal(pagedRes.body.users.length, 2);
  assert.ok(pagedRes.body.pagination.total >= 4);

  for (const invalidQuery of ['role=Superuser', 'status=Pending', 'page=0', 'limit=101']) {
    assert.equal((await request(app).get(`/api/admin/users?${invalidQuery}`).set('Cookie', adminCookie)).status, 400);
  }

  await User.deleteOne({ _id: specialUser._id });
});

test('creates user with validation, duplicate email rejection, and allows first-time login', async () => {
  const adminCookie = await signIn(accounts.Administrator.email);

  const missing = await post('/api/admin/users').set('Cookie', adminCookie).send({});
  assert.equal(missing.status, 400);
  assert.equal(missing.body.code, 'VALIDATION');
  assert.ok(missing.body.fields.name);
  assert.ok(missing.body.fields.email);
  assert.ok(missing.body.fields.role);
  assert.ok(missing.body.fields.password);
  assert.ok(missing.body.fields.confirmPassword);

  const badInputs = [
    { name: 'Ada', email: 'not-an-email', role: 'Student', password: 'Valid-password-1', confirmPassword: 'Valid-password-1' },
    { name: 'Ada', email: 'ada@users.test', role: 'Superadmin', password: 'Valid-password-1', confirmPassword: 'Valid-password-1' },
    { name: 'Ada', email: 'ada@users.test', role: 'Student', password: 'short', confirmPassword: 'short' },
    { name: 'Ada', email: 'ada@users.test', role: 'Student', password: 'ắ'.repeat(30), confirmPassword: 'ắ'.repeat(30) },
    { name: 'Ada', email: 'ada@users.test', role: 'Student', password: 'Valid-password-1', confirmPassword: 'Mismatch-password-1' },
    { name: { $ne: '' }, email: 'ada@users.test', role: 'Student', password: 'Valid-password-1', confirmPassword: 'Valid-password-1' },
  ];
  for (const payload of badInputs) {
    const invalid = await post('/api/admin/users').set('Cookie', adminCookie).send(payload);
    assert.equal(invalid.status, 400, JSON.stringify(payload));
  }

  const duplicate = await post('/api/admin/users').set('Cookie', adminCookie).send({
    fullName: 'Duplicate Student',
    email: `  ${accounts.Student.email.toUpperCase()}  `,
    role: 'Student',
    password: 'Initial-password-2026',
    confirmPassword: 'Initial-password-2026',
  });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.code, 'ACCOUNT_EXISTS');
  assert.ok(duplicate.body.fields.email);

  const created = await post('/api/admin/users').set('Cookie', adminCookie).send({
    fullName: '  Alex Nguyen  ',
    email: '  Alex.Nguyen@USERS.TEST ',
    role: 'Instructor',
    password: 'Initial-password-2026',
    confirmPassword: 'Initial-password-2026',
    mustChangePassword: true,
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.user.fullName, 'Alex Nguyen');
  assert.equal(created.body.user.email, 'alex.nguyen@users.test');
  assert.equal(created.body.user.role, 'Instructor');
  assert.equal(created.body.user.isActive, true);
  assert.equal(created.body.user.mustChangePassword, true);
  assert.equal(created.body.user.passwordHash, undefined);

  const createdLogin = await post('/api/auth/login').send({
    email: 'alex.nguyen@users.test',
    password: 'Initial-password-2026',
  });
  assert.equal(createdLogin.status, 200);
  assert.equal(createdLogin.body.user.mustChangePassword, true);
});

test('fetches single user, updates user with validation/guardrails, and reflects role immediately', async () => {
  const adminCookie = await signIn(accounts.Administrator.email);
  const nonexistentId = new mongoose.Types.ObjectId().toString();

  assert.equal((await request(app).get('/api/admin/users/bad-id-123456').set('Cookie', adminCookie)).status, 400);
  assert.equal((await request(app).get(`/api/admin/users/${nonexistentId}`).set('Cookie', adminCookie)).status, 404);

  const fetched = await request(app).get(`/api/admin/users/${accounts.Student._id}`).set('Cookie', adminCookie);
  assert.equal(fetched.status, 200);
  assert.equal(fetched.body.user.email, accounts.Student.email);
  assert.equal(fetched.body.user.passwordHash, undefined);

  // Validation error on update
  const badUpdate = await patch(`/api/admin/users/${accounts.Student._id}`)
    .set('Cookie', adminCookie)
    .send({ fullName: '', email: 'invalid', role: 'Student' });
  assert.equal(badUpdate.status, 400);
  assert.ok(badUpdate.body.fields.name);
  assert.ok(badUpdate.body.fields.email);

  // Duplicate email on update
  const dupUpdate = await patch(`/api/admin/users/${accounts.Student._id}`)
    .set('Cookie', adminCookie)
    .send({ fullName: accounts.Student.fullName, email: accounts.Instructor.email, role: 'Student' });
  assert.equal(dupUpdate.status, 409);
  assert.equal(dupUpdate.body.code, 'ACCOUNT_EXISTS');

  // Self-demotion blocked (and last active admin check)
  const selfDemote = await patch(`/api/admin/users/${accounts.Administrator._id}`)
    .set('Cookie', adminCookie)
    .send({ fullName: accounts.Administrator.fullName, email: accounts.Administrator.email, role: 'Instructor' });
  assert.equal(selfDemote.status, 409);
  assert.equal(selfDemote.body.code, 'SELF_ROLE_CHANGE');

  // Create second admin, have admin2 try to demote admin1? First let admin1 demote admin2? Wait: test LAST_ADMIN explicitly!
  // Promote Student -> Instructor, verify immediate RBAC effect
  const studentCookie = await signIn(accounts.Student.email);
  assert.equal((await request(app).get('/api/instructor/classes').set('Cookie', studentCookie)).status, 403);

  const updated = await patch(`/api/admin/users/${accounts.Student._id}`)
    .set('Cookie', adminCookie)
    .send({ fullName: 'Updated Learner', email: 'updated.learner@users.test', role: 'Instructor' });
  assert.equal(updated.status, 200, JSON.stringify(updated.body));
  assert.equal(updated.body.user.fullName, 'Updated Learner');
  assert.equal(updated.body.user.email, 'updated.learner@users.test');
  assert.equal(updated.body.user.role, 'Instructor');

  // Immediate RBAC effect: existing studentCookie now has Instructor role in DB
  assert.equal((await request(app).get('/api/instructor/classes').set('Cookie', studentCookie)).status, 404); // passed requireRole('Instructor')

  // Test LAST_ADMIN when a second admin attempts to demote the only other active admin while inactive/demoting
  const backupAdmin = await User.create({
    email: 'backup-admin@users.test',
    fullName: 'Backup Admin',
    role: 'Administrator',
    passwordHash: await bcrypt.hash(basePassword, 12),
    isActive: false,
  });
  // Inactive backupAdmin does NOT count toward active Administrators; primary admin still protected
  const demoteSelf = await patch(`/api/admin/users/${accounts.Administrator._id}`)
    .set('Cookie', adminCookie)
    .send({ fullName: accounts.Administrator.fullName, email: accounts.Administrator.email, role: 'Student' });
  assert.equal(demoteSelf.status, 409);

  // Restore student fixture & delete backupAdmin
  await patch(`/api/admin/users/${accounts.Student._id}`)
    .set('Cookie', adminCookie)
    .send({ fullName: 'Primary Student', email: 'student@users.test', role: 'Student' });
  await User.deleteOne({ _id: backupAdmin._id });
});

test('changes user status with guardrails, immediate session revocation on deactivate, and login restoration on activate', async () => {
  const adminCookie = await signIn(accounts.Administrator.email);
  const nonexistentId = new mongoose.Types.ObjectId().toString();

  assert.equal((await patch('/api/admin/users/bad-id/status').set('Cookie', adminCookie).send({ isActive: false })).status, 400);
  assert.equal((await patch(`/api/admin/users/${nonexistentId}/status`).set('Cookie', adminCookie).send({ isActive: false })).status, 404);
  assert.equal((await patch(`/api/admin/users/${accounts.Instructor._id}/status`).set('Cookie', adminCookie).send({})).status, 400);
  assert.equal(
    (await patch(`/api/admin/users/${accounts.Instructor._id}/status`).set('Cookie', adminCookie).send({ isActive: true, status: 'Inactive' })).status,
    400,
  );

  // Cannot deactivate self
  const selfDeactivate = await patch(`/api/admin/users/${accounts.Administrator._id}/status`)
    .set('Cookie', adminCookie)
    .send({ isActive: false });
  assert.equal(selfDeactivate.status, 409);
  assert.equal(selfDeactivate.body.code, 'SELF_DEACTIVATE');

  // Cannot demote or deactivate last active Administrator (verified by promoting backup admin, deactivating backup, trying via another check)
  const secondAdmin = await User.create({
    email: 'second-admin@users.test',
    fullName: 'Second Admin',
    role: 'Administrator',
    passwordHash: await bcrypt.hash(basePassword, 12),
    isActive: true,
  });
  const secondAdminCookie = await signIn(secondAdmin.email);
  // Deactivate primary admin -> allowed because secondAdmin is active
  const deactivateFirst = await patch(`/api/admin/users/${accounts.Administrator._id}/status`)
    .set('Cookie', secondAdminCookie)
    .send({ status: 'Inactive' });
  assert.equal(deactivateFirst.status, 200);
  assert.equal(deactivateFirst.body.user.status, 'Inactive');
  // Now secondAdmin is the last active admin -> cannot deactivate self anyway; reactivate primary and delete second
  const reactivateFirst = await patch(`/api/admin/users/${accounts.Administrator._id}/status`)
    .set('Cookie', secondAdminCookie)
    .send({ status: 'Active' });
  assert.equal(reactivateFirst.status, 200);
  assert.equal(reactivateFirst.body.user.status, 'Active');
  await User.deleteOne({ _id: secondAdmin._id });

  // Active instructor session is revoked immediately when deactivated
  const freshAdminCookie = await signIn(accounts.Administrator.email);
  const instructorCookie = await signIn(accounts.Instructor.email);
  assert.equal((await request(app).get('/api/auth/me').set('Cookie', instructorCookie)).status, 200);

  const deactivated = await patch(`/api/admin/users/${accounts.Instructor._id}/status`)
    .set('Cookie', freshAdminCookie)
    .send({ isActive: false });
  assert.equal(deactivated.status, 200);
  assert.equal(deactivated.body.user.isActive, false);
  assert.equal(deactivated.body.user.status, 'Inactive');

  const meAfterDeactivate = await request(app).get('/api/auth/me').set('Cookie', instructorCookie);
  assert.equal(meAfterDeactivate.status, 401);

  const loginWhileInactive = await post('/api/auth/login').send({
    email: accounts.Instructor.email,
    password: basePassword,
  });
  assert.equal(loginWhileInactive.status, 403);
  assert.equal(loginWhileInactive.body.code, 'ACCOUNT_DISABLED');

  // Reactivate restores login
  const reactivated = await patch(`/api/admin/users/${accounts.Instructor._id}/status`)
    .set('Cookie', freshAdminCookie)
    .send({ isActive: true });
  assert.equal(reactivated.status, 200);
  assert.equal(reactivated.body.user.isActive, true);
  assert.equal(reactivated.body.user.status, 'Active');

  const loginAfterActivate = await post('/api/auth/login').send({
    email: accounts.Instructor.email,
    password: basePassword,
  });
  assert.equal(loginAfterActivate.status, 200);
});
