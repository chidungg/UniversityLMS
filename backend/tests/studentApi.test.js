import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import "dotenv/config";
import connectDB from "../src/config/db.js";
import { app } from "../src/server.js";

let studentToken = "";
let adminToken = "";
let enrolledCourseId = "";
let enrolledAssignmentId = "";
let materialId = "";
let createdSubmissionId = "";

test.before(async () => {
  process.env.NODE_ENV = "test";
  await connectDB();
});

test.after(async () => {
  await mongoose.disconnect();
});

test("GET /api/health should return 200 and database connected", async () => {
  const res = await request(app).get("/api/health");
  assert.equal(res.status, 200);
  assert.equal(res.body.status, "success");
  assert.equal(res.body.database, "connected");
  assert.equal(res.body.dbName, "UniversityLMS");
});

test("POST /api/auth/login with invalid credentials should return 401", async () => {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email: "student01@lms-demo.test", password: "wrong_password" });
  assert.equal(res.status, 401);
  assert.equal(res.body.status, "error");
});

test("POST /api/auth/login with deactivated account should return 403", async () => {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email: "student18@lms-demo.test", password: "Bin2005." });
  assert.equal(res.status, 403);
  assert.match(res.body.message, /inactive/i);
});

test("POST /api/auth/login with valid Student credentials should return 200 and JWT token", async () => {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email: "student01@lms-demo.test", password: "Bin2005." });
  assert.equal(res.status, 200);
  assert.equal(res.body.status, "success");
  assert.ok(res.body.token);
  assert.equal(res.body.user.role, "Student");
  studentToken = res.body.token;
});

test("POST /api/auth/login with Administrator credentials", async () => {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email: "admin01@lms-demo.test", password: "Bin2005." });
  assert.equal(res.status, 200);
  assert.equal(res.body.user.role, "Administrator");
  adminToken = res.body.token;
});

test("Access student routes without auth header should return 401", async () => {
  const res = await request(app).get("/api/student/dashboard");
  assert.equal(res.status, 401);
});

test("Access student routes with Administrator role should return 403 Forbidden", async () => {
  const res = await request(app)
    .get("/api/student/dashboard")
    .set("Authorization", `Bearer ${adminToken}`);
  assert.equal(res.status, 403);
});

// S01 Tests
test("GET /api/student/dashboard returns enrolled courses, upcoming assignments, and stats", async () => {
  const res = await request(app)
    .get("/api/student/dashboard")
    .set("Authorization", `Bearer ${studentToken}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.status, "success");
  assert.ok(Array.isArray(res.body.data.courses));
  assert.ok(res.body.data.courses.length > 0);
  assert.ok(res.body.data.stats);
  assert.ok(res.body.data.stats.totalCourses > 0);
  enrolledCourseId = res.body.data.courses[0]._id.toString();
});

test("GET /api/student/courses lists enrolled courses with optional search", async () => {
  const res = await request(app)
    .get("/api/student/courses")
    .set("Authorization", `Bearer ${studentToken}`);
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.data));
  assert.ok(res.body.data.some((c) => c._id === enrolledCourseId));

  // Search filter
  const searchRes = await request(app)
    .get("/api/student/courses?q=PRG101")
    .set("Authorization", `Bearer ${studentToken}`);
  assert.equal(searchRes.status, 200);
  assert.ok(searchRes.body.data.length >= 1);
});

test("GET /api/student/courses/:courseId returns course details for enrolled course", async () => {
  const res = await request(app)
    .get(`/api/student/courses/${enrolledCourseId}`)
    .set("Authorization", `Bearer ${studentToken}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.data._id, enrolledCourseId);
  assert.ok(res.body.data.courseCode);
});

test("GET /api/student/courses/:courseId/materials lists course materials", async () => {
  const res = await request(app)
    .get(`/api/student/courses/${enrolledCourseId}/materials`)
    .set("Authorization", `Bearer ${studentToken}`);
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.data));
  if (res.body.data.length > 0) {
    materialId = res.body.data[0]._id.toString();
  }
});

test("GET /api/student/materials/:materialId preview & download", async () => {
  if (!materialId) return;

  const res = await request(app)
    .get(`/api/student/materials/${materialId}`)
    .set("Authorization", `Bearer ${studentToken}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.data._id, materialId);

  // Download
  const dlRes = await request(app)
    .get(`/api/student/materials/${materialId}/download`)
    .set("Authorization", `Bearer ${studentToken}`);
  assert.equal(dlRes.status, 200);
  assert.ok(dlRes.headers["content-disposition"].includes("attachment"));
});

// S02 Tests
test("GET /api/student/assignments returns assignments for enrolled courses with status", async () => {
  const res = await request(app)
    .get("/api/student/assignments")
    .set("Authorization", `Bearer ${studentToken}`);
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.data));
  assert.ok(res.body.data.length > 0);
  assert.ok(res.body.data[0].status);

  // Find an assignment that is not yet graded
  const availableAssignment = res.body.data.find(
    (a) => !a.submission || (a.submission.grade === null && a.submission.grade === undefined)
  );
  if (availableAssignment) {
    enrolledAssignmentId = availableAssignment._id.toString();
  } else {
    enrolledAssignmentId = res.body.data[0]._id.toString();
  }
});

test("GET /api/student/assignments/:assignmentId details", async () => {
  const res = await request(app)
    .get(`/api/student/assignments/${enrolledAssignmentId}`)
    .set("Authorization", `Bearer ${studentToken}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.data._id, enrolledAssignmentId);
});

test("POST /api/student/assignments/:assignmentId/submit empty submission fails validation", async () => {
  const res = await request(app)
    .post(`/api/student/assignments/${enrolledAssignmentId}/submit`)
    .set("Authorization", `Bearer ${studentToken}`)
    .send({ content: "" });
  assert.equal(res.status, 400);
  assert.match(res.body.message, /content or an attached file/i);
});

test("POST /api/student/assignments/:assignmentId/submit with valid text or file", async () => {
  // Let's find an assignment that isn't graded yet or create one for test
  const res = await request(app)
    .post(`/api/student/assignments/${enrolledAssignmentId}/submit`)
    .set("Authorization", `Bearer ${studentToken}`)
    .send({ content: "Automated test submission content for verification." });

  // If already graded, 400 is expected and compliant with AC; if not graded, 200/201 is returned
  if (res.status === 400) {
    assert.match(res.body.message, /already been graded/i);
  } else {
    assert.ok(res.status === 200 || res.status === 201);
    assert.ok(res.body.data._id);
    createdSubmissionId = res.body.data._id.toString();
  }
});

// S05 Tests
test("GET /api/student/search with empty query returns 400 error", async () => {
  const res = await request(app)
    .get("/api/student/search?q=")
    .set("Authorization", `Bearer ${studentToken}`);
  assert.equal(res.status, 400);
  assert.equal(res.body.status, "error");
  assert.match(res.body.message, /keyword is required/i);
});

test("GET /api/student/search with valid keyword returns scoped results", async () => {
  const res = await request(app)
    .get("/api/student/search?q=Data")
    .set("Authorization", `Bearer ${studentToken}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.status, "success");
  assert.ok(res.body.data.counts);
  assert.ok(typeof res.body.data.counts.total === "number");
  assert.ok(Array.isArray(res.body.data.courses));
  assert.ok(Array.isArray(res.body.data.materials));
  assert.ok(Array.isArray(res.body.data.assignments));
});
