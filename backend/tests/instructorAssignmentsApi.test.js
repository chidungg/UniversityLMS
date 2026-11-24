import test from "node:test";
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import request from "supertest";
import { app } from "../src/server.js";
import { credentialDigest } from "../src/config/auth.js";
import Assignment from "../src/models/Assignment.js";
import AuthSession from "../src/models/AuthSession.js";
import Course from "../src/models/Course.js";
import Enrollment from "../src/models/Enrollment.js";
import Submission from "../src/models/Submission.js";
import User from "../src/models/User.js";

const id = () => new mongoose.Types.ObjectId();
const sameId = (left, right) => String(left) === String(right);
const query = (value) => ({
  select() { return this; },
  sort() { return this; },
  session() { return this; },
  lean: async () => value,
});

test("I04 manages assignments and grades actual Student submissions", async (t) => {
  const previousSecret = process.env.JWT_SECRET;
  const secret = "i04-isolated-test-secret-with-32-bytes";
  process.env.JWT_SECRET = secret;
  t.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });

  const buildUser = (role, fullName) => ({ _id: id(), fullName, email: "fixture@i04.test", role, isActive: true, passwordHash: "fixture-hash" });
  const instructor = buildUser("Instructor", "Instructor");
  const other = buildUser("Instructor", "Other Instructor");
  const student = buildUser("Student", "Submitted Student");
  const waiting = buildUser("Student", "Waiting Student");
  const accounts = [instructor, other, student, waiting];
  const course = { _id: id(), courseCode: "I04", isActive: true, instructorId: instructor._id };
  const assignments = new Map();
  const submissions = new Map();
  const session = {};
  const sessionId = id();
  const savedFiles = new Set();
  t.after(async () => Promise.all([...savedFiles].map((file) => rm(file, { force: true }))));

  t.mock.method(mongoose.connection, "transaction", async (action) => {
    const before = [...assignments];
    try {
      return await action(session);
    } catch (error) {
      assignments.clear();
      for (const [key, value] of before) assignments.set(key, value);
      throw error;
    }
  });
  t.mock.method(User, "findById", (value) => ({ select: async () => accounts.find(({ _id }) => sameId(_id, value)) }));
  t.mock.method(User, "find", (filter) => query(accounts.filter((account) => account.role === filter.role && filter._id.$in.some((value) => sameId(value, account._id)))));
  t.mock.method(AuthSession, "findOne", () => ({ select: async () => ({ credentialDigest: credentialDigest(instructor.passwordHash) }) }));
  t.mock.method(Course, "findOne", (filter) => query(sameId(filter._id, course._id) && sameId(filter.instructorId, instructor._id) ? course : null));
  t.mock.method(Course, "find", ({ instructorId }) => query(sameId(instructorId, instructor._id) ? [course] : []));
  t.mock.method(Enrollment, "find", () => query([student, waiting].map(({ _id }) => ({ studentId: _id }))));
  t.mock.method(Enrollment, "exists", ({ studentId, courseId }) => ({ session: async (active) => active === session && sameId(studentId, student._id) && sameId(courseId, course._id) }));
  t.mock.method(Enrollment, "findOne", async () => true);
  t.mock.method(Enrollment, "aggregate", async () => [{ _id: course._id, count: 2 }]);

  t.mock.method(Assignment, "create", async (fields) => {
    const doc = new Assignment(fields);
    await doc.validate();
    assignments.set(String(doc._id), doc.toObject());
    return doc;
  });
  t.mock.method(Assignment, "find", ({ courseId }) => query([...assignments.values()].filter((item) => courseId.$in.some((value) => sameId(value, item.courseId)))));
  t.mock.method(Assignment, "findById", (assignmentId) => {
    const assignment = assignments.get(String(assignmentId));
    return { ...query(assignment), populate: () => query(assignment && { ...assignment, courseId: course }) };
  });
  t.mock.method(Assignment, "findOneAndUpdate", ({ _id }, update, options) => {
    assert.equal(options.session, session);
    const assignment = assignments.get(String(_id));
    if (!assignment) return query(null);
    const locked = { ...assignment, __v: (assignment.__v ?? 0) + update.$inc.__v };
    assignments.set(String(_id), locked);
    return query(locked);
  });
  t.mock.method(Assignment, "updateOne", async ({ _id }, { $set }) => assignments.set(String(_id), { ...assignments.get(String(_id)), ...$set }));
  t.mock.method(Assignment, "deleteOne", async ({ _id }, options) => {
    assert.equal(options.session, session);
    return assignments.delete(String(_id));
  });

  const matchingSubmissions = (filter) => [...submissions.values()].filter((submission) =>
    (!filter._id || sameId(filter._id, submission._id))
    && (!filter.assignmentId || sameId(filter.assignmentId, submission.assignmentId))
    && (!filter.studentId || sameId(filter.studentId, submission.studentId))
    && (!filter.grade || submission.grade > filter.grade.$gt)
  );
  t.mock.method(Submission, "find", (filter) => query(matchingSubmissions(filter)));
  t.mock.method(Submission, "findOne", (filter) => query(matchingSubmissions(filter)[0]));
  t.mock.method(Submission, "exists", (filter) => ({ session: async () => matchingSubmissions(filter)[0] }));
  t.mock.method(Submission, "aggregate", async () => []);
  t.mock.method(Submission.prototype, "save", async function (options) {
    assert.equal(options.session, session);
    this.__v = 0;
    await this.validate();
    if (this.fileUrl) savedFiles.add(new URL(`..${this.fileUrl}`, import.meta.url));
    submissions.set(String(this._id), this.toObject());
    return this;
  });
  t.mock.method(Submission, "findOneAndUpdate", (filter, update, options) => {
    assert.equal(options.session, session);
    const before = matchingSubmissions(filter)[0];
    if (!before) return query(null);
    const updated = { ...before, ...update.$set, __v: (before.__v ?? 0) + update.$inc.__v };
    submissions.set(String(updated._id), updated);
    return query(updated);
  });

  function api(method, url, user = instructor) {
    const token = jwt.sign({ sub: String(user._id), sid: String(sessionId) }, secret, {
      algorithm: "HS256", issuer: "university-lms", audience: "university-lms", expiresIn: "5m",
    });
    return request(app)[method](`/api${url}`).set("Authorization", `Bearer ${token}`).set("X-LMS-Request", "1");
  }

  const createUrl = `/instructor/courses/${course._id}/assignments`;
  const dueDate = new Date(Date.now() + 3600000).toISOString();
  assert.equal((await api("post", createUrl, other).send({ dueDate, title: "Foreign" })).status, 404);
  assert.equal((await api("post", createUrl).send({ title: "Invalid date", dueDate: "yesterday" })).status, 400);
  const created = await api("post", createUrl).send({ title: "Algorithms worksheet", dueDate, maxScore: 10 });
  assert.equal(created.status, 201);
  const assignmentId = created.body.data._id;
  const assignmentUrl = `/instructor/assignments/${assignmentId}`;
  const studentUrl = `/student/assignments/${assignmentId}`;
  assert.equal((await api("get", assignmentUrl, other)).status, 404);
  assert.equal((await api("get", assignmentUrl, student)).status, 403);
  assert.equal((await api("get", "/instructor/assignments", other)).body.data.length, 0);
  const initial = await api("get", assignmentUrl);
  assert.equal(initial.status, 200);
  assert.ok(initial.body.data.rosterSubmissions.every((row) => row.status === "NOT_SUBMITTED"));
  assert.equal((await api("patch", `${assignmentUrl}/submissions/${id()}/grade`).send({ grade: 0, revision: 0 })).status, 404);

  const submitted = await api("post", `${studentUrl}/submit`, student).field("content", "Original solution")
    .attach("file", Buffer.from("Original submission bytes"), "solution.txt");
  assert.equal(submitted.status, 201, JSON.stringify(submitted.body));
  const submissionUrl = `${assignmentUrl}/submissions/${submitted.body.data._id}`;
  const detail = await api("get", submissionUrl);
  assert.equal(detail.body.data.content, "Original solution");
  assert.equal((await api("get", `${submissionUrl}/download`)).text, "Original submission bytes");
  assert.equal((await api("get", `${submissionUrl}/download`, other)).status, 404);
  assert.equal((await api("delete", assignmentUrl)).body.code, "ASSIGNMENT_HAS_SUBMISSIONS");
  assert.equal((await api("patch", `${submissionUrl}/grade`).send({ grade: 11, revision: 0 })).status, 400);

  const graded = await api("patch", `${submissionUrl}/grade`).send({ grade: 0, feedback: "Please review", revision: 0 });
  assert.equal(graded.status, 200);
  assert.equal(graded.body.data.grade, 0);
  assert.equal((await api("patch", `${submissionUrl}/grade`).send({ grade: 7, revision: 0 })).body.code, "SUBMISSION_CHANGED");
  const studentView = await api("get", studentUrl, student);
  assert.equal(studentView.body.data.status, "GRADED");
  assert.equal(studentView.body.data.submission.feedback, "Please review");
  assert.equal((await api("post", `${studentUrl}/submit`, student).send({ content: "Try again" })).status, 400);
  assert.equal((await api("patch", `${submissionUrl}/grade`).send({ grade: 8, revision: 1 })).status, 200);
  assert.equal((await api("put", assignmentUrl).send({ maxScore: 7 })).body.code, "ASSIGNMENT_MAX_SCORE_CONFLICT");
  assert.equal((await api("put", assignmentUrl).send({ title: "Updated worksheet" })).status, 200);

  const empty = await api("post", createUrl).send({ title: "No submission", dueDate });
  const emptyUrl = `/instructor/assignments/${empty.body.data._id}`;
  assert.equal((await api("delete", emptyUrl)).status, 204);
  assert.equal((await api("get", emptyUrl)).status, 404);
});
