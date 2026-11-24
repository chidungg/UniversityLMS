import test from "node:test";
import assert from "node:assert/strict";
import { access, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import request from "supertest";
import { app } from "../src/server.js";
import { credentialDigest } from "../src/config/auth.js";
import AuthSession from "../src/models/AuthSession.js";
import Course from "../src/models/Course.js";
import Enrollment from "../src/models/Enrollment.js";
import LearningMaterial from "../src/models/LearningMaterial.js";
import User from "../src/models/User.js";
import { materialStorageDir, removeStoredMaterial } from "../src/utils/materialStorage.js";

const id = () => new mongoose.Types.ObjectId();
const matchesId = (left, right) => String(left) === String(right);
const query = (data) => ({
  select() { return this; },
  sort() { return this; },
  lean: async () => data,
});

test("I03 stores, replaces, downloads and deletes material files with course authorization", async (t) => {
  const previousSecret = process.env.JWT_SECRET;
  const secret = "i03-isolated-test-secret-with-32-bytes";
  process.env.JWT_SECRET = secret;
  const accounts = ["Instructor", "Instructor", "Student", "Student"].map((role) => ({
    _id: id(), role, isActive: true, passwordHash: "isolated-test-hash",
  }));
  const [owner, other, student, unenrolled] = accounts;
  const course = { _id: id(), instructorId: owner._id, isActive: true, courseCode: "I03" };
  const sessionId = id();
  const materials = new Map();
  const cleanup = new Set();
  t.after(async () => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
    await Promise.all([...cleanup].map(removeStoredMaterial));
  });

  t.mock.method(User, "findById", (userId) => ({ select: async () => accounts.find((user) => matchesId(user._id, userId)) }));
  t.mock.method(AuthSession, "findOne", () => ({ select: async () => ({ credentialDigest: credentialDigest(owner.passwordHash) }) }));
  t.mock.method(Course, "findOne", (filter) => query(
    matchesId(filter._id, course._id) && matchesId(filter.instructorId, owner._id) ? course : null
  ));
  t.mock.method(Course, "find", (filter) => query(matchesId(filter.instructorId, owner._id) ? [course] : []));
  t.mock.method(Enrollment, "findOne", async ({ studentId, courseId }) => matchesId(studentId, student._id) && matchesId(courseId, course._id));
  t.mock.method(LearningMaterial.prototype, "save", async function () {
    await this.validate();
    this.__v = 0;
    const material = this.toObject();
    if (material.storageKey) cleanup.add(material.storageKey);
    materials.set(String(material._id), material);
    return this;
  });
  t.mock.method(LearningMaterial, "findById", (materialId) => {
    const material = materials.get(String(materialId));
    return {
      ...query(material),
      populate: () => query(material && { ...material, courseId: course }),
    };
  });
  t.mock.method(LearningMaterial, "find", ({ courseId }) => query(
    [...materials.values()].filter((material) => courseId.$in.some((id) => matchesId(id, material.courseId)))
  ));
  t.mock.method(LearningMaterial, "findOneAndUpdate", ({ _id, __v }, changes) => {
    const current = materials.get(String(_id));
    if (current?.__v !== __v || changes.$set.title === "Conflict") return query(null);
    const updated = { ...current, ...changes.$set, __v: __v + changes.$inc.__v };
    if (changes.$unset?.storageKey) delete updated.storageKey;
    if (updated.storageKey) cleanup.add(updated.storageKey);
    materials.set(String(_id), updated);
    return query(updated);
  });
  t.mock.method(LearningMaterial, "findOneAndDelete", ({ _id, __v }) => {
    const material = materials.get(String(_id));
    if (material?.__v !== __v) return query(null);
    materials.delete(String(_id));
    return query(material);
  });

  function call(method, url, user = owner) {
    const token = jwt.sign({ sub: String(user._id), sid: String(sessionId) }, secret, {
      algorithm: "HS256", issuer: "university-lms", audience: "university-lms", expiresIn: "5m",
    });
    return request(app)[method](url).set("Authorization", `Bearer ${token}`).set("X-LMS-Request", "1");
  }

  const createUrl = `/api/instructor/courses/${course._id}/materials`;
  const upload = (role, title, filename) => call("post", createUrl, role)
    .field("title", title).field("type", "Attachment").attach("file", Buffer.from("original bytes"), filename);
  assert.equal((await upload(other, "Foreign", "file.txt")).status, 404);
  assert.equal((await upload(student, "Student", "file.txt")).status, 403);
  assert.equal((await upload(owner, "Wrong format", "file.exe")).status, 400);
  assert.equal((await call("post", createUrl).send({ title: "Invalid URL", type: "Video", fileUrl: "file:///local" })).status, 400);
  assert.equal((await call("post", createUrl).send({ title: "Missing resource", type: "Video" })).status, 400);

  const created = await upload(owner, "Worksheet", "Bài tập.txt");
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const material = created.body.data;
  const apiPath = `/api/instructor/materials/${material._id}`;
  const originalKey = materials.get(material._id).storageKey;
  assert.equal(material.fileName, "Bài tập.txt");
  assert.equal(material.fileSize, Buffer.byteLength("original bytes"));
  assert.equal(Object.hasOwn(material, "storageKey"), false);
  assert.equal((await request(app).get(`${apiPath}/download`)).status, 401);
  assert.equal((await call("get", `/uploads/${originalKey}`)).status, 404);
  assert.equal((await call("get", `${apiPath}/download`, other)).status, 404);
  assert.equal((await call("get", material.fileUrl, unenrolled)).status, 403);
  assert.equal((await call("get", material.fileUrl, student)).text, "original bytes");
  assert.equal((await call("get", `${apiPath}/download`)).text, "original bytes");
  assert.deepEqual((await call("get", "/api/instructor/materials", other)).body.data, []);
  assert.equal((await call("get", `/api/instructor/materials?courseId=${course._id}`)).body.data[0]._id, material._id);

  const beforeConflict = await readdir(materialStorageDir);
  const oversized = await call("post", createUrl).field("title", "Oversized").field("type", "Attachment")
    .attach("file", Buffer.alloc(50 * 1024 * 1024 + 1), "oversized.txt");
  assert.equal(oversized.status, 413);
  const conflict = await call("put", apiPath).field("title", "Conflict").attach("file", Buffer.from("discard"), "discard.txt");
  assert.equal(conflict.status, 409);
  assert.deepEqual((await readdir(materialStorageDir)).sort(), beforeConflict.sort());
  assert.equal((await call("get", material.fileUrl, student)).text, "original bytes");

  const edited = await call("put", apiPath).send({ title: "Metadata only" });
  assert.equal(edited.status, 200);
  assert.equal(materials.get(material._id).storageKey, originalKey);
  const replaced = await call("put", apiPath).attach("file", Buffer.from("replacement bytes"), "replacement.txt");
  assert.equal(replaced.status, 200);
  await assert.rejects(access(path.join(materialStorageDir, originalKey)), { code: "ENOENT" });
  assert.equal((await call("get", material.fileUrl, student)).text, "replacement bytes");
  const replacementKey = materials.get(material._id).storageKey;

  const linked = await call("put", apiPath).send({ fileUrl: "https://example.com/lecture" });
  assert.equal(linked.status, 200);
  const redirect = await call("get", `/api/student/materials/${material._id}/download`, student);
  assert.equal(redirect.status, 302);
  assert.equal(redirect.headers.location, "https://example.com/lecture");
  await assert.rejects(access(path.join(materialStorageDir, replacementKey)), { code: "ENOENT" });

  assert.equal((await call("delete", apiPath, other)).status, 404);
  assert.equal((await call("delete", apiPath)).status, 204);
  assert.equal((await call("get", `/api/student/materials/${material._id}/download`, student)).status, 404);
  assert.deepEqual((await call("get", "/api/instructor/materials")).body.data, []);

  const legacyId = id();
  const legacyName = `i03-test-${legacyId}.txt`;
  const legacyPath = fileURLToPath(new URL(`../uploads/${legacyName}`, import.meta.url));
  await writeFile(legacyPath, "legacy bytes", { flag: "wx" });
  t.after(() => rm(legacyPath, { force: true }));
  materials.set(String(legacyId), { _id: legacyId, courseId: course._id, fileUrl: `/uploads/${legacyName}` });
  const legacyResponse = await call("get", `/api/student/materials/${legacyId}/download`, student);
  assert.equal(legacyResponse.status, 200);
  assert.equal(legacyResponse.text, "legacy bytes");
  assert.match(legacyResponse.headers["content-disposition"], new RegExp(legacyName));
});
