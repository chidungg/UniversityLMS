import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import request from "supertest";
import { app } from "../src/server.js";
import { credentialDigest } from "../src/config/auth.js";
import AuthSession from "../src/models/AuthSession.js";
import Course from "../src/models/Course.js";
import Enrollment from "../src/models/Enrollment.js";
import Quiz from "../src/models/Quiz.js";
import QuizAttempt from "../src/models/QuizAttempt.js";
import User from "../src/models/User.js";

const id = () => new mongoose.Types.ObjectId();
const sameId = (a, b) => String(a) === String(b);
const query = (value) => ({
  select() { return this; },
  sort() { return this; },
  session() { return this; },
  lean: async () => value,
});

test("I05 edits quizzes before attempts and reports stored Student results", async (t) => {
  const previousSecret = process.env.JWT_SECRET;
  const secret = "i05-isolated-test-secret-with-32-bytes";
  process.env.JWT_SECRET = secret;
  t.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });

  const account = (role) => ({ _id: id(), fullName: role, email: "quiz@i05.test", role, isActive: true, passwordHash: "fixture-hash" });
  const owner = account("Instructor");
  const other = account("Instructor");
  const student = account("Student");
  const waiting = account("Student");
  const accounts = [owner, other, student, waiting];
  const course = { _id: id(), courseCode: "I05", courseName: "Quiz Management", isActive: true, instructorId: owner._id };
  const quizzes = new Map();
  const attempts = new Map();
  const session = {};
  const sessionId = id();

  t.mock.method(mongoose.connection, "transaction", async (action) => {
    const before = [...quizzes];
    try {
      return await action(session);
    } catch (error) {
      quizzes.clear();
      for (const [key, value] of before) quizzes.set(key, value);
      throw error;
    }
  });
  t.mock.method(User, "findById", (key) => ({ select: async () => accounts.find(({ _id }) => sameId(key, _id)) }));
  t.mock.method(AuthSession, "findOne", () => ({ select: async () => ({ credentialDigest: credentialDigest(owner.passwordHash) }) }));
  t.mock.method(User, "find", (filter) => query(accounts.filter((user) => user.role === filter.role && filter._id.$in.some((key) => sameId(key, user._id)))));
  t.mock.method(Course, "findById", (key) => query(sameId(key, course._id) ? course : null));
  t.mock.method(Course, "findOne", (filter) => query(sameId(filter._id, course._id) && sameId(filter.instructorId, owner._id) ? course : null));
  t.mock.method(Course, "find", ({ instructorId }) => query(sameId(instructorId, owner._id) ? [course] : []));
  t.mock.method(Enrollment, "findOne", async () => true);
  t.mock.method(Enrollment, "find", () => query([student, waiting].map(({ _id }) => ({ studentId: _id }))));
  t.mock.method(Enrollment, "exists", ({ studentId, courseId }) => ({ session: async (active) => active === session && sameId(courseId, course._id) && [student, waiting].some(({ _id }) => sameId(studentId, _id)) }));

  t.mock.method(Quiz, "find", ({ courseId }) => query([...quizzes.values()].filter((quiz) => courseId.$in.some((key) => sameId(key, quiz.courseId)))));
  t.mock.method(Quiz, "findById", (key) => {
    const quiz = quizzes.get(String(key));
    return { ...query(quiz), populate: () => query(quiz && { ...quiz, courseId: course }) };
  });
  t.mock.method(Quiz, "create", async (fields) => {
    const quiz = new Quiz(fields);
    await quiz.validate();
    quizzes.set(String(quiz._id), quiz.toObject());
    return quiz;
  });
  t.mock.method(Quiz, "findOneAndUpdate", ({ _id }, update, options) => {
    assert.equal(options.session, session);
    const current = quizzes.get(String(_id));
    if (!current) return query(null);
    const locked = { ...current, __v: (current.__v ?? 0) + update.$inc.__v };
    quizzes.set(String(_id), locked);
    return query(locked);
  });
  t.mock.method(Quiz, "updateOne", async ({ _id }, { $set }, options) => {
    assert.equal(options.session, session);
    quizzes.set(String(_id), { ...quizzes.get(String(_id)), ...$set });
  });
  t.mock.method(Quiz, "deleteOne", async ({ _id }, options) => {
    assert.equal(options.session, session);
    return quizzes.delete(String(_id));
  });

  const byQuiz = (quizId) => [...attempts.values()].filter((attempt) => sameId(quizId, attempt.quizId));
  t.mock.method(QuizAttempt, "find", ({ quizId }) => query(byQuiz(quizId)));
  t.mock.method(QuizAttempt, "findOne", ({ quizId, studentId }) => query(byQuiz(quizId).find((attempt) => sameId(studentId, attempt.studentId))));
  t.mock.method(QuizAttempt, "findById", (key) => ({
    populate: async () => {
      const attempt = attempts.get(String(key));
      return attempt && { ...attempt, quizId: { ...quizzes.get(String(attempt.quizId)), courseId: course } };
    },
  }));
  t.mock.method(QuizAttempt, "exists", ({ quizId }) => ({
    session: async () => byQuiz(quizId)[0],
    then: (resolve, reject) => Promise.resolve(byQuiz(quizId)[0]).then(resolve, reject),
  }));
  t.mock.method(QuizAttempt, "aggregate", async () => []);
  t.mock.method(QuizAttempt.prototype, "save", async function (options) {
    assert.equal(options.session, session);
    await this.validate();
    attempts.set(String(this._id), this.toObject());
    return this;
  });
  t.mock.method(QuizAttempt, "updateOne", async ({ _id }, { $set }, options) => {
    assert.equal(options.session, session);
    attempts.set(String(_id), { ...attempts.get(String(_id)), ...$set });
  });

  function api(method, url, user = owner) {
    const token = jwt.sign({ sub: String(user._id), sid: String(sessionId) }, secret, {
      algorithm: "HS256", issuer: "university-lms", audience: "university-lms", expiresIn: "5m",
    });
    return request(app)[method](`/api${url}`).set("Authorization", `Bearer ${token}`).set("X-LMS-Request", "1");
  }

  const question = { id: "Q1", prompt: "Choose the correct answer", points: 3, correctOptionId: "B", explanation: "Because B is correct", options: [{ id: "A", text: "Wrong" }, { id: "B", text: "Right" }] };
  const config = {
    title: "First quiz", startTime: new Date(Date.now() - 60000).toISOString(),
    endTime: new Date(Date.now() + 3600000).toISOString(), timeLimit: 10, maxScore: 999,
    questions: [question, { ...question, id: "Q2", points: 2 }],
  };
  const createUrl = `/instructor/courses/${course._id}/quizzes`;
  assert.equal((await api("post", createUrl, other).send(config)).status, 404);
  assert.equal((await api("post", createUrl, student).send(config)).status, 403);
  assert.equal((await api("post", createUrl).send({ ...config, questions: [question, question] })).status, 400);
  assert.equal((await api("post", createUrl).send({ ...config, questions: [{ ...question, correctOptionId: "X" }] })).status, 400);
  assert.equal((await api("post", createUrl).send({ ...config, endTime: config.startTime })).status, 400);

  const created = await api("post", createUrl).send(config);
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.data.maxScore, 5);
  const quizId = created.body.data._id;
  const instructorUrl = `/instructor/quizzes/${quizId}`;
  const studentUrl = `/student/quizzes/${quizId}`;
  assert.equal((await api("get", `${instructorUrl}/results`, other)).status, 404);
  assert.equal((await api("get", `${instructorUrl}/results`)).body.data.summary.avgScore, null);
  assert.equal((await api("get", instructorUrl)).body.data.questions[0].correctOptionId, "B");
  const questions = [{ ...question, prompt: "Updated prompt" }];
  const updated = await api("put", instructorUrl).send({ questions });
  assert.equal(updated.body.data.questionCount, 1);
  assert.equal(updated.body.data.maxScore, 3);

  const studentDetails = await api("get", studentUrl, student);
  assert.equal(studentDetails.body.data.maxScore, 3);
  assert.equal(studentDetails.body.data.questions[0].explanation, undefined);
  const started = await api("post", `${studentUrl}/start`, student);
  assert.equal(started.status, 201, JSON.stringify(started.body));
  assert.equal(started.body.data.questions[0].correctOptionId, undefined);
  assert.equal((await api("post", `${studentUrl}/start`, student)).body.data.attemptId, started.body.data.attemptId);
  assert.equal((await api("post", `${studentUrl}/start`, waiting)).status, 201);
  assert.equal((await api("put", instructorUrl).send({ questions })).body.code, "QUIZ_ATTEMPTS_STARTED");
  assert.equal((await api("delete", instructorUrl)).body.code, "QUIZ_HAS_ATTEMPTS");
  assert.equal((await api("put", instructorUrl).send({ title: "Edited title" })).status, 200);

  const submitted = await api("post", `${studentUrl}/submit`, student).send({ answers: { Q1: "A" } });
  assert.equal(submitted.status, 200, JSON.stringify(submitted.body));
  assert.equal(submitted.body.data.score, 0);
  assert.equal((await api("post", `${studentUrl}/submit`, student).send({ answers: { Q1: "B" } })).status, 400);
  const studentResult = await api("get", `/student/quiz-attempts/${started.body.data.attemptId}/result`, student);
  const results = await api("get", `${instructorUrl}/results`);
  assert.equal(results.status, 200);
  assert.equal(results.body.data.summary.totalAttempts, 1);
  assert.equal(results.body.data.summary.avgScore, 0);
  assert.equal(results.body.data.summary.passRate, 0);
  const completed = results.body.data.rosterAttempts.find((row) => row.status === "COMPLETED").attempt;
  const unfinished = results.body.data.rosterAttempts.find((row) => row.status === "IN_PROGRESS");
  assert.equal(unfinished.attempt, null);
  assert.equal(completed.maxScore, studentResult.body.data.maxScore);
  assert.equal(completed.score, studentResult.body.data.score);
  assert.equal(completed.detailedReview[0].correctOptionText, "Right");

  const empty = await api("post", createUrl).send({ ...config, title: "No attempts" });
  assert.equal((await api("delete", `/instructor/quizzes/${empty.body.data._id}`)).status, 204);
});
