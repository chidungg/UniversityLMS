import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import "dotenv/config";
import bcrypt from "bcryptjs";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { migrateAuth } from "../src/scripts/migrateAuth.js";
let isolatedDatabase;
const sessionToken = (response) => response.headers["set-cookie"]?.find((cookie) => cookie.startsWith("lms_session="))?.split(";")[0].slice("lms_session=".length);
import { app } from "../src/server.js";
import Course from "../src/models/Course.js";
import Enrollment from "../src/models/Enrollment.js";
import LearningMaterial from "../src/models/LearningMaterial.js";
import Assignment from "../src/models/Assignment.js";
import Submission from "../src/models/Submission.js";
import User from "../src/models/User.js";
import Announcement from "../src/models/Announcement.js";
import AnnouncementRead from "../src/models/AnnouncementRead.js";
import Quiz from "../src/models/Quiz.js";
import QuizAttempt from "../src/models/QuizAttempt.js";
import Message from "../src/models/Message.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let student01Token = "";
let student02Token = "";
let adminToken = "";
let student01Id = "";
let student02Id = "";
let instructorId = "";

let enrolledCourseId = "";
let unenrolledCourseId = "";
let unenrolledMaterialId = "";

let fixtureMaterialWithFileId = "";
let fixtureMaterialNoFileId = "";
let fixtureMaterialMissingFileId = "";
let fixtureMaterialTraversalId = "";

let fixtureOpenAssignmentId = "";
let fixtureOverdueAssignmentId = "";
let fixtureGradedZeroSubmissionId = "";
let student02SubmissionId = "";

let fixtureAnnouncementId = "";
let unenrolledAnnouncementId = "";

let fixtureAvailableQuizId = "";
let fixtureUpcomingQuizId = "";
let fixtureExpiredQuizId = "";
let unenrolledQuizId = "";
let completedAttemptId = "";

const tempTestDir = path.resolve(__dirname, "../uploads");
const tempOriginalFilePath = path.resolve(tempTestDir, "test_original_material.txt");

test.before(async () => {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = 'student-regression-test-secret-at-least-32-bytes';
  isolatedDatabase = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { downloadDir: path.resolve('.cache/mongodb-binaries') } });
  await mongoose.connect(isolatedDatabase.getUri(), { dbName: 'student_regression_test' });
  for (const model of Object.values(mongoose.models)) await model.createCollection();
  await migrateAuth();
  const passwordHash = await bcrypt.hash('Bin2005.', 12);
  for (const [email, role, isActive] of [
    ['student01@lms-demo.test', 'Student', true], ['student02@lms-demo.test', 'Student', true],
    ['student18@lms-demo.test', 'Student', false], ['admin01@lms-demo.test', 'Administrator', true],
    ['instructor01@lms-demo.test', 'Instructor', true],
  ]) await User.create({ email, role, isActive, fullName: email.split('@')[0], passwordHash });
  const enrolled = await Course.create({ courseCode: 'TEST-ENROLLED', courseName: 'Test enrolled course' });
  const other = await Course.create({ courseCode: 'TEST-OTHER', courseName: 'Test other course' });
  for (const email of ['student01@lms-demo.test', 'student02@lms-demo.test']) {
    const student = await User.findOne({ email });
    await Enrollment.create({ studentId: student._id, courseId: enrolled._id });
  }
  await LearningMaterial.create({ courseId: other._id, title: 'Other course material', type: 'LectureNote' });

  // Create temporary test file for original download test
  if (!fs.existsSync(tempTestDir)) {
    fs.mkdirSync(tempTestDir, { recursive: true });
  }
  fs.writeFileSync(tempOriginalFilePath, "ORIGINAL_MATERIAL_CONTENT_TEST_VERIFICATION_2026", "utf-8");

  // Fetch student01 and student02 users
  const student01 = await User.findOne({ email: "student01@lms-demo.test" });
  student01Id = student01._id.toString();

  const student02 = await User.findOne({ email: "student02@lms-demo.test" });
  student02Id = student02._id.toString();

  // Find enrolled course for student01
  const enrollment01 = await Enrollment.findOne({ studentId: student01Id });
  enrolledCourseId = enrollment01.courseId.toString();

  // Find unenrolled course for student01
  const enrollments01 = await Enrollment.find({ studentId: student01Id });
  const enrolledIds = enrollments01.map((e) => e.courseId.toString());
  const unenrolledCourse = await Course.findOne({ _id: { $nin: enrolledIds }, isActive: true });
  unenrolledCourseId = unenrolledCourse._id.toString();

  // Find material in unenrolled course
  const unenrolledMaterial = await LearningMaterial.findOne({ courseId: unenrolledCourseId });
  if (unenrolledMaterial) {
    unenrolledMaterialId = unenrolledMaterial._id.toString();
  }

  // Create Fixture Materials for Student01's enrolled course
  const matWithFile = await LearningMaterial.create({
    courseId: enrolledCourseId,
    title: "TEST_FIXTURE_Material_With_File",
    description: "Material with valid original file attached",
    type: "LectureNote",
    fileUrl: "/uploads/test_original_material.txt",
  });
  fixtureMaterialWithFileId = matWithFile._id.toString();

  const matNoFile = await LearningMaterial.create({
    courseId: enrolledCourseId,
    title: "TEST_FIXTURE_Material_No_File",
    description: "Material without fileUrl",
    type: "LectureNote",
    fileUrl: null,
  });
  fixtureMaterialNoFileId = matNoFile._id.toString();

  const matMissingFile = await LearningMaterial.create({
    courseId: enrolledCourseId,
    title: "TEST_FIXTURE_Material_Missing_File",
    description: "Material with fileUrl pointing to non-existent file",
    type: "Attachment",
    fileUrl: "/uploads/non_existent_file_404.pdf",
  });
  fixtureMaterialMissingFileId = matMissingFile._id.toString();

  const matTraversal = await LearningMaterial.create({
    courseId: enrolledCourseId,
    title: "TEST_FIXTURE_Material_Traversal",
    description: "Material with traversal attack fileUrl",
    type: "Attachment",
    fileUrl: "/uploads/../../package.json",
  });
  fixtureMaterialTraversalId = matTraversal._id.toString();

  // Create Fixture Assignments
  const openAssignment = await Assignment.create({
    courseId: enrolledCourseId,
    title: "TEST_FIXTURE_Open_Assignment",
    description: "Assignment due in future for submission tests",
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days in future
    maxScore: 10,
  });
  fixtureOpenAssignmentId = openAssignment._id.toString();

  const overdueAssignment = await Assignment.create({
    courseId: enrolledCourseId,
    title: "TEST_FIXTURE_Overdue_Assignment",
    description: "Assignment due in past",
    dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    maxScore: 10,
  });
  fixtureOverdueAssignmentId = overdueAssignment._id.toString();

  // Create Fixture Submission with Grade 0
  const gradedZeroSub = await Submission.create({
    assignmentId: fixtureOverdueAssignmentId,
    studentId: student01Id,
    content: "[TEST] Submission evaluated with legitimate grade 0",
    grade: 0,
    feedback: "Incomplete requirements. Earned 0 points.",
    submittedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  });
  fixtureGradedZeroSubmissionId = gradedZeroSub._id.toString();

  // Find a submission by student02 for authorization tests
  const sub02 = await Submission.findOne({ studentId: student02Id });
  if (sub02) {
    student02SubmissionId = sub02._id.toString();
  }

  // Announcements fixtures
  const ann01 = await Announcement.create({
    courseId: enrolledCourseId,
    title: "TEST_FIXTURE_Announcement_Enrolled",
    content: "Welcome to the test announcement for enrolled course.",
  });
  fixtureAnnouncementId = ann01._id.toString();

  const unenrolledAnn = await Announcement.create({
    courseId: unenrolledCourseId,
    title: "TEST_FIXTURE_Announcement_Unenrolled",
    content: "Notice for unenrolled course.",
  });
  unenrolledAnnouncementId = unenrolledAnn._id.toString();

  // Quizzes fixtures
  const nowTime = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const availQuiz = await Quiz.create({
    courseId: enrolledCourseId,
    title: "TEST_FIXTURE_Quiz_Available",
    description: "Assessment open right now",
    startTime: new Date(nowTime - 1 * dayMs),
    endTime: new Date(nowTime + 5 * dayMs),
    timeLimit: 15,
    maxScore: 4,
    questions: [
      {
        id: "Q1",
        type: "single_choice",
        prompt: "Sample Question 1",
        options: [
          { id: "A", text: "Option A" },
          { id: "B", text: "Option B" },
        ],
        correctOptionId: "A",
        points: 2,
        explanation: "Option A is correct.",
      },
      {
        id: "Q2",
        type: "single_choice",
        prompt: "Sample Question 2",
        options: [
          { id: "A", text: "Option A" },
          { id: "B", text: "Option B" },
        ],
        correctOptionId: "B",
        points: 2,
        explanation: "Option B is correct.",
      },
    ],
  });
  fixtureAvailableQuizId = availQuiz._id.toString();

  const upQuiz = await Quiz.create({
    courseId: enrolledCourseId,
    title: "TEST_FIXTURE_Quiz_Upcoming",
    description: "Assessment starting next week",
    startTime: new Date(nowTime + 5 * dayMs),
    endTime: new Date(nowTime + 10 * dayMs),
    timeLimit: 20,
    questions: [],
  });
  fixtureUpcomingQuizId = upQuiz._id.toString();

  const expQuiz = await Quiz.create({
    courseId: enrolledCourseId,
    title: "TEST_FIXTURE_Quiz_Expired",
    description: "Assessment closed last week",
    startTime: new Date(nowTime - 10 * dayMs),
    endTime: new Date(nowTime - 5 * dayMs),
    timeLimit: 20,
    questions: [],
  });
  fixtureExpiredQuizId = expQuiz._id.toString();

  const unenrolledQ = await Quiz.create({
    courseId: unenrolledCourseId,
    title: "TEST_FIXTURE_Quiz_Unenrolled",
    description: "Quiz for unenrolled course",
    startTime: new Date(nowTime - 1 * dayMs),
    endTime: new Date(nowTime + 5 * dayMs),
    timeLimit: 20,
    questions: [],
  });
  unenrolledQuizId = unenrolledQ._id.toString();

  // Find Instructor for messaging tests
  const instructor = await User.findOne({ role: "Instructor", isActive: true });
  if (instructor) {
    instructorId = instructor._id.toString();
  }
});

test.after(async () => {
  // Clean up fixture records
  await LearningMaterial.deleteMany({ title: /^TEST_FIXTURE_/ });
  await Assignment.deleteMany({ title: /^TEST_FIXTURE_/ });
  await Submission.deleteMany({ content: /^\[TEST\]/ });
  await Submission.deleteMany({ assignmentId: fixtureOpenAssignmentId });
  await Announcement.deleteMany({ title: /^TEST_FIXTURE_/ });
  await AnnouncementRead.deleteMany({});
  await Quiz.deleteMany({ title: /^TEST_FIXTURE_/ });
  await QuizAttempt.deleteMany({ studentId: { $in: [student01Id, student02Id] } });
  await Message.deleteMany({ content: /^\[TEST\]/ });

  // Clean up temporary test file
  if (fs.existsSync(tempOriginalFilePath)) {
    try {
      fs.unlinkSync(tempOriginalFilePath);
    } catch {}
  }

  await mongoose.disconnect();
  await isolatedDatabase?.stop();
});

// ==========================================
// 1. System Health & Authentication Tests
// ==========================================
test("GET /api/health should return 200 and database connected", async () => {
  const res = await request(app).get("/api/health");
  assert.equal(res.status, 200);
  assert.equal(res.body.status, "success");
  assert.equal(res.body.database, "connected");
});

test("POST /api/auth/login with invalid credentials should return 401", async () => {
  const res = await request(app)
    .post("/api/auth/login")
    .set("X-LMS-Request", "1")
    .send({ email: "student01@lms-demo.test", password: "wrong_password" });
  assert.equal(res.status, 401);
  assert.equal(res.body.status, "error");
});

test("POST /api/auth/login with deactivated account should return 403", async () => {
  const res = await request(app)
    .post("/api/auth/login")
    .set("X-LMS-Request", "1")
    .send({ email: "student18@lms-demo.test", password: "Bin2005." });
  assert.equal(res.status, 403);
  assert.equal(res.body.code, "ACCOUNT_DISABLED");
});

test("POST /api/auth/login with valid Student01 credentials returns 200 & JWT", async () => {
  const res = await request(app)
    .post("/api/auth/login")
    .set("X-LMS-Request", "1")
    .send({ email: "student01@lms-demo.test", password: "Bin2005." });
  assert.equal(res.status, 200);
  assert.equal(res.body.status, "success");
  assert.ok(sessionToken(res));
  assert.equal(res.body.user.role, "Student");
  student01Token = sessionToken(res);
});

test("POST /api/auth/login with valid Student02 credentials returns 200 & JWT", async () => {
  const res = await request(app)
    .post("/api/auth/login")
    .set("X-LMS-Request", "1")
    .send({ email: "student02@lms-demo.test", password: "Bin2005." });
  assert.equal(res.status, 200);
  student02Token = sessionToken(res);
});

test("POST /api/auth/login with Administrator credentials", async () => {
  const res = await request(app)
    .post("/api/auth/login")
    .set("X-LMS-Request", "1")
    .send({ email: "admin01@lms-demo.test", password: "Bin2005." });
  assert.equal(res.status, 200);
  adminToken = sessionToken(res);
});

test("Access student routes without auth header returns 401", async () => {
  const res = await request(app).get("/api/student/dashboard");
  assert.equal(res.status, 401);
});

test("Access student routes with Administrator role returns 403", async () => {
  const res = await request(app)
    .get("/api/student/dashboard")
    .set("Authorization", `Bearer ${adminToken}`);
  assert.equal(res.status, 403);
});

test("GET /api/student/dashboard returns enrolled courses and stats", async () => {
  const res = await request(app)
    .get("/api/student/dashboard")
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.status, "success");
  assert.ok(Array.isArray(res.body.data.courses));
  assert.ok(res.body.data.stats);
});

// ==========================================
// 2. Module 2: Course Management Tests
// ==========================================
test("GET /api/student/courses lists enrolled courses", async () => {
  const res = await request(app)
    .get("/api/student/courses")
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.data));
  assert.ok(res.body.data.some((c) => c._id === enrolledCourseId));
  // Must NOT include unenrolled courses
  assert.ok(!res.body.data.some((c) => c._id === unenrolledCourseId));
});

test("GET /api/student/courses filter status (active, inactive, all)", async () => {
  const resActive = await request(app)
    .get("/api/student/courses?status=active")
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(resActive.status, 200);

  const resAll = await request(app)
    .get("/api/student/courses?status=all")
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(resAll.status, 200);

  const resInvalid = await request(app)
    .get("/api/student/courses?status=invalid_status")
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(resInvalid.status, 400);
  assert.match(resInvalid.body.message, /invalid status filter/i);
});

test("GET /api/student/courses search query q with special regex characters", async () => {
  const res = await request(app)
    .get("/api/student/courses?q=PRG(101)+*?[test]")
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.data));
});

test("GET /api/student/courses/:courseId returns details for enrolled course", async () => {
  const res = await request(app)
    .get(`/api/student/courses/${enrolledCourseId}`)
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.data._id, enrolledCourseId);
  assert.ok(res.body.data.courseCode);
  assert.ok(typeof res.body.data.materialCount === "number");
});

test("GET /api/student/courses/:courseId with invalid ID returns 400", async () => {
  const res = await request(app)
    .get("/api/student/courses/invalid_object_id")
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(res.status, 400);
  assert.match(res.body.message, /invalid course id/i);
});

test("GET /api/student/courses/:courseId with non-existent ID returns 403 or 404", async () => {
  const fakeId = new mongoose.Types.ObjectId().toString();
  const res = await request(app)
    .get(`/api/student/courses/${fakeId}`)
    .set("Authorization", `Bearer ${student01Token}`);
  // Since not enrolled, 403 is returned
  assert.equal(res.status, 403);
});

test("GET /api/student/courses/:courseId for unenrolled course returns 403 Forbidden", async () => {
  const res = await request(app)
    .get(`/api/student/courses/${unenrolledCourseId}`)
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(res.status, 403);
  assert.match(res.body.message, /not enrolled/i);
});

test("GET /api/student/courses/:courseId/materials lists course materials", async () => {
  const res = await request(app)
    .get(`/api/student/courses/${enrolledCourseId}/materials`)
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.data));
  assert.ok(res.body.data.some((m) => m._id === fixtureMaterialWithFileId));
});

test("GET /api/student/courses/:courseId/materials with type filter", async () => {
  const res = await request(app)
    .get(`/api/student/courses/${enrolledCourseId}/materials?type=LectureNote`)
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(res.status, 200);
  assert.ok(res.body.data.every((m) => m.type === "LectureNote"));
});

test("GET /api/student/courses/:courseId/materials for unenrolled course returns 403", async () => {
  const res = await request(app)
    .get(`/api/student/courses/${unenrolledCourseId}/materials`)
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(res.status, 403);
});

test("GET /api/student/materials/:materialId preview material details", async () => {
  const res = await request(app)
    .get(`/api/student/materials/${fixtureMaterialWithFileId}`)
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.data._id, fixtureMaterialWithFileId);
  assert.equal(res.body.data.title, "TEST_FIXTURE_Material_With_File");
});

test("GET /api/student/materials/:materialId for unenrolled material returns 403", async () => {
  if (!unenrolledMaterialId) return;
  const res = await request(app)
    .get(`/api/student/materials/${unenrolledMaterialId}`)
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(res.status, 403);
});

test("GET /api/student/materials/:materialId with invalid ID returns 400", async () => {
  const res = await request(app)
    .get("/api/student/materials/not_a_valid_id")
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(res.status, 400);
});

test("GET /api/student/materials/:materialId/download when no file attached returns 404", async () => {
  const res = await request(app)
    .get(`/api/student/materials/${fixtureMaterialNoFileId}/download`)
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(res.status, 404);
  assert.match(res.body.message, /no original file/i);
});

test("GET /api/student/materials/:materialId/download downloads original file and verifies content", async () => {
  const res = await request(app)
    .get(`/api/student/materials/${fixtureMaterialWithFileId}/download`)
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(res.status, 200);
  assert.ok(res.headers["content-disposition"].includes("attachment"));
  assert.ok(res.headers["content-disposition"].includes("test_original_material.txt"));
  assert.equal(res.text, "ORIGINAL_MATERIAL_CONTENT_TEST_VERIFICATION_2026");
});

test("GET /api/student/materials/:materialId/download file missing on server returns 404", async () => {
  const res = await request(app)
    .get(`/api/student/materials/${fixtureMaterialMissingFileId}/download`)
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(res.status, 404);
  assert.match(res.body.message, /could not be found on the server/i);
});

test("GET /api/student/materials/:materialId/download path traversal attempt returns 400", async () => {
  const res = await request(app)
    .get(`/api/student/materials/${fixtureMaterialTraversalId}/download`)
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(res.status, 400);
  assert.match(res.body.message, /invalid file location/i);
});

test("GET /api/student/materials/:materialId/download unenrolled material returns 403", async () => {
  if (!unenrolledMaterialId) return;
  const res = await request(app)
    .get(`/api/student/materials/${unenrolledMaterialId}/download`)
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(res.status, 403);
});

// ==========================================
// 3. Module 3: Assignment Management Tests
// ==========================================
test("GET /api/student/assignments returns assignments for enrolled courses with status", async () => {
  const res = await request(app)
    .get("/api/student/assignments")
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.data));
  assert.ok(res.body.data.length > 0);
  assert.ok(res.body.data.some((a) => a._id === fixtureOpenAssignmentId));
  const openItem = res.body.data.find((a) => a._id === fixtureOpenAssignmentId);
  assert.equal(openItem.status, "PENDING");
});

test("GET /api/student/assignments filter by courseId and status", async () => {
  const resCourse = await request(app)
    .get(`/api/student/assignments?courseId=${enrolledCourseId}`)
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(resCourse.status, 200);

  const resStatus = await request(app)
    .get("/api/student/assignments?status=PENDING")
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(resStatus.status, 200);
  assert.ok(resStatus.body.data.every((a) => a.status === "PENDING"));

  const resInvalidStatus = await request(app)
    .get("/api/student/assignments?status=INVALID_STATUS_CODE")
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(resInvalidStatus.status, 400);

  const resUnenrolledCourse = await request(app)
    .get(`/api/student/assignments?courseId=${unenrolledCourseId}`)
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(resUnenrolledCourse.status, 403);
});

test("GET /api/student/assignments search q with regex special chars", async () => {
  const res = await request(app)
    .get("/api/student/assignments?q=Comprehensive*+?()[test]")
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.data));
});

test("GET /api/student/assignments/:assignmentId details", async () => {
  const res = await request(app)
    .get(`/api/student/assignments/${fixtureOpenAssignmentId}`)
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.data._id, fixtureOpenAssignmentId);
  assert.equal(res.body.data.status, "PENDING");
});

test("GET /api/student/assignments/:assignmentId invalid format returns 400", async () => {
  const res = await request(app)
    .get("/api/student/assignments/invalid_assignment_id")
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(res.status, 400);
});

test("GET /api/student/assignments/:assignmentId non-existent returns 404", async () => {
  const fakeId = new mongoose.Types.ObjectId().toString();
  const res = await request(app)
    .get(`/api/student/assignments/${fakeId}`)
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(res.status, 404);
});

test("POST /api/student/assignments/:assignmentId/submit empty submission fails validation", async () => {
  const res = await request(app)
    .post(`/api/student/assignments/${fixtureOpenAssignmentId}/submit`)
    .set("X-LMS-Request", "1")
    .set("Authorization", `Bearer ${student01Token}`)
    .send({ content: "" });
  assert.equal(res.status, 400);
  assert.match(res.body.message, /content or an attached file/i);
});

test("POST /api/student/assignments/:assignmentId/submit to overdue assignment returns 400", async () => {
  const res = await request(app)
    .post(`/api/student/assignments/${fixtureOverdueAssignmentId}/submit`)
    .set("X-LMS-Request", "1")
    .set("Authorization", `Bearer ${student01Token}`)
    .send({ content: "Attempting to submit late work." });
  assert.equal(res.status, 400);
  assert.match(res.body.message, /deadline for this assignment has passed/i);
});

test("POST /api/student/assignments/:assignmentId/submit with text only returns 201", async () => {
  const res = await request(app)
    .post(`/api/student/assignments/${fixtureOpenAssignmentId}/submit`)
    .set("X-LMS-Request", "1")
    .set("Authorization", `Bearer ${student01Token}`)
    .send({ content: "[TEST] Initial text-only submission." });
  assert.equal(res.status, 201);
  assert.equal(res.body.status, "success");
  assert.equal(res.body.data.content, "[TEST] Initial text-only submission.");
  assert.equal(res.body.data.fileUrl, null);
});

test("POST /api/student/assignments/:assignmentId/submit resubmission with file updates submission", async () => {
  const testUploadFile = path.resolve(tempTestDir, "test_code_solution.py");
  fs.writeFileSync(testUploadFile, "print('Hello LMS submission')\n", "utf-8");

  const res = await request(app)
    .post(`/api/student/assignments/${fixtureOpenAssignmentId}/submit`)
    .set("X-LMS-Request", "1")
    .set("Authorization", `Bearer ${student01Token}`)
    .field("content", "[TEST] Updated submission with Python code file.")
    .attach("file", testUploadFile);

  if (fs.existsSync(testUploadFile)) {
    try {
      fs.unlinkSync(testUploadFile);
    } catch {}
  }

  assert.equal(res.status, 200); // Updated existing submission
  assert.equal(res.body.status, "success");
  assert.match(res.body.message, /updated successfully/i);
  assert.equal(res.body.data.content, "[TEST] Updated submission with Python code file.");
  assert.ok(res.body.data.fileUrl.startsWith("/uploads/submissions/"));
});

test("POST /api/student/assignments/:assignmentId/submit unsupported file type (.exe) returns 400", async () => {
  const exeFile = path.resolve(tempTestDir, "dangerous_script.exe");
  fs.writeFileSync(exeFile, "BINARY_DATA_FAKE_EXE", "utf-8");

  const res = await request(app)
    .post(`/api/student/assignments/${fixtureOpenAssignmentId}/submit`)
    .set("X-LMS-Request", "1")
    .set("Authorization", `Bearer ${student01Token}`)
    .attach("file", exeFile);

  if (fs.existsSync(exeFile)) {
    try {
      fs.unlinkSync(exeFile);
    } catch {}
  }

  assert.equal(res.status, 400);
  assert.match(res.body.message, /unsupported file type/i);
});

test("POST /api/student/assignments/:assignmentId/submit resubmitting already graded assignment returns 400", async () => {
  const res = await request(app)
    .post(`/api/student/assignments/${fixtureOverdueAssignmentId}/submit`)
    .set("X-LMS-Request", "1")
    .set("Authorization", `Bearer ${student01Token}`)
    .send({ content: "Attempting to change a graded submission." });
  assert.equal(res.status, 400);
  // Rejection triggered either by deadline or already graded
  assert.ok(res.body.status === "error");
});

test("POST /api/student/assignments/:assignmentId/submit empty 0-byte file returns 400", async () => {
  const emptyFile = path.resolve(tempTestDir, "empty_solution.txt");
  fs.writeFileSync(emptyFile, "", "utf-8");

  const res = await request(app)
    .post(`/api/student/assignments/${fixtureOpenAssignmentId}/submit`)
    .set("X-LMS-Request", "1")
    .set("Authorization", `Bearer ${student01Token}`)
    .attach("file", emptyFile);

  if (fs.existsSync(emptyFile)) {
    try { fs.unlinkSync(emptyFile); } catch {}
  }

  assert.equal(res.status, 400);
  assert.match(res.body.message, /file is empty/i);
});

test("POST /api/student/assignments/:assignmentId/submit for unenrolled assignment returns 403", async () => {
  const unenrolledAssignment = await Assignment.findOne({ courseId: unenrolledCourseId });
  if (unenrolledAssignment) {
    const res = await request(app)
      .post(`/api/student/assignments/${unenrolledAssignment._id}/submit`)
    .set("X-LMS-Request", "1")
      .set("Authorization", `Bearer ${student01Token}`)
      .send({ content: "Unauthorized attempt" });
    assert.equal(res.status, 403);
  }
});

test("POST /api/student/assignments/:assignmentId/submit for non-existent assignment returns 404", async () => {
  const fakeId = new mongoose.Types.ObjectId().toString();
  const res = await request(app)
    .post(`/api/student/assignments/${fakeId}/submit`)
    .set("X-LMS-Request", "1")
    .set("Authorization", `Bearer ${student01Token}`)
    .send({ content: "Submitting to non-existent assignment" });
  assert.equal(res.status, 404);
});

test("POST /api/student/assignments/:assignmentId/submit cleans up uploaded file on validation error", async () => {
  const validFile = path.resolve(tempTestDir, "temp_to_cleanup.txt");
  fs.writeFileSync(validFile, "Valid content that should be removed because deadline passed", "utf-8");

  const uploadsSubmissionsDir = path.resolve(__dirname, "../uploads/submissions");
  const filesBefore = fs.existsSync(uploadsSubmissionsDir) ? fs.readdirSync(uploadsSubmissionsDir) : [];

  const res = await request(app)
    .post(`/api/student/assignments/${fixtureOverdueAssignmentId}/submit`)
    .set("X-LMS-Request", "1")
    .set("Authorization", `Bearer ${student01Token}`)
    .attach("file", validFile);

  if (fs.existsSync(validFile)) {
    try { fs.unlinkSync(validFile); } catch {}
  }

  assert.equal(res.status, 400);

  // Verify that the file was NOT left orphaned in uploads/submissions
  const filesAfter = fs.existsSync(uploadsSubmissionsDir) ? fs.readdirSync(uploadsSubmissionsDir) : [];
  assert.equal(filesAfter.length, filesBefore.length);
});

test("GET /api/student/submissions/:submissionId with invalid ID returns 400", async () => {
  const res = await request(app)
    .get("/api/student/submissions/invalid_submission_id")
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(res.status, 400);
});

test("GET /api/student/submissions/:submissionId retrieves submission with legitimate grade 0", async () => {
  const res = await request(app)
    .get(`/api/student/submissions/${fixtureGradedZeroSubmissionId}`)
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.status, "success");
  assert.equal(res.body.data._id, fixtureGradedZeroSubmissionId);
  // Grade 0 must be preserved as number 0, not null or undefined
  assert.equal(res.body.data.grade, 0);
  assert.equal(res.body.data.feedback, "Incomplete requirements. Earned 0 points.");
});

test("GET /api/student/submissions/:submissionId attempting to view another student's submission returns 403", async () => {
  if (!student02SubmissionId) return;
  const res = await request(app)
    .get(`/api/student/submissions/${student02SubmissionId}`)
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(res.status, 403);
  assert.match(res.body.message, /permission to view this submission/i);
});

test("GET /api/student/submissions/:submissionId non-existent submission returns 404", async () => {
  const fakeId = new mongoose.Types.ObjectId().toString();
  const res = await request(app)
    .get(`/api/student/submissions/${fakeId}`)
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(res.status, 404);
});

// ==========================================
// 4. Module 4: Search Tests
// ==========================================
test("GET /api/student/search with empty query returns 400 error", async () => {
  const res = await request(app)
    .get("/api/student/search?q=")
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(res.status, 400);
  assert.equal(res.body.status, "error");
  assert.match(res.body.message, /keyword is required/i);
});

test("GET /api/student/search with whitespace only query returns 400 error", async () => {
  const res = await request(app)
    .get("/api/student/search?q=%20%20%20")
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(res.status, 400);
  assert.match(res.body.message, /keyword is required/i);
});

test("GET /api/student/search with query exceeding 100 characters returns 400", async () => {
  const longQuery = "a".repeat(101);
  const res = await request(app)
    .get(`/api/student/search?q=${longQuery}`)
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(res.status, 400);
  assert.match(res.body.message, /maximum allowed length/i);
});

test("GET /api/student/search with invalid category returns 400", async () => {
  const res = await request(app)
    .get("/api/student/search?q=Data&category=invalid_category")
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(res.status, 400);
  assert.match(res.body.message, /invalid search category/i);
});

test("GET /api/student/search across all categories with valid keyword", async () => {
  const res = await request(app)
    .get("/api/student/search?q=Programming")
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.status, "success");
  assert.ok(res.body.data.counts);
  assert.ok(typeof res.body.data.counts.total === "number");
  assert.ok(Array.isArray(res.body.data.courses));
  assert.ok(Array.isArray(res.body.data.materials));
  assert.ok(Array.isArray(res.body.data.assignments));
});

test("GET /api/student/search specific category: courses", async () => {
  const res = await request(app)
    .get("/api/student/search?q=Program&category=courses")
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.data.courses));
  assert.equal(res.body.data.materials.length, 0);
  assert.equal(res.body.data.assignments.length, 0);
  assert.equal(res.body.data.counts.materials, 0);
  assert.equal(res.body.data.counts.assignments, 0);
});

test("GET /api/student/search specific category: materials", async () => {
  const res = await request(app)
    .get("/api/student/search?q=Variables&category=materials")
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.courses.length, 0);
  assert.ok(Array.isArray(res.body.data.materials));
});

test("GET /api/student/search specific category: assignments", async () => {
  const res = await request(app)
    .get("/api/student/search?q=Student&category=assignments")
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.courses.length, 0);
  assert.equal(res.body.data.materials.length, 0);
  assert.ok(Array.isArray(res.body.data.assignments));
});

test("GET /api/student/search case-insensitive matching", async () => {
  const resLower = await request(app)
    .get("/api/student/search?q=program")
    .set("Authorization", `Bearer ${student01Token}`);
  const resUpper = await request(app)
    .get("/api/student/search?q=PROGRAM")
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(resLower.status, 200);
  assert.equal(resUpper.status, 200);
  assert.equal(resLower.body.data.counts.total, resUpper.body.data.counts.total);
});

test("GET /api/student/search safe regex handling with special characters", async () => {
  const res = await request(app)
    .get("/api/student/search?q=C%2B%2B*()[]%3F^$%20demo")
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.status, "success");
  assert.equal(res.body.data.counts.total, 0);
});

test("GET /api/student/search does not leak information from unenrolled courses", async () => {
  // Database Systems (DEMO-DB201) is not enrolled by student01
  const res = await request(app)
    .get("/api/student/search?q=Database%20Systems")
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(res.status, 200);
  // Ensure no courses with code DEMO-DB201 are returned
  assert.ok(!res.body.data.courses.some((c) => c.courseCode === "DEMO-DB201"));
});

test("GET /api/student/search does not return inactive courses", async () => {
  const res = await request(app)
    .get("/api/student/search?q=Archived")
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(res.status, 200);
  assert.ok(!res.body.data.courses.some((c) => c.courseCode === "DEMO-OLD099"));
});

// ==========================================
// 5. Module 5: Student Announcements Tests
// ==========================================
test("GET /api/student/announcements returns announcements for enrolled courses", async () => {
  const res = await request(app)
    .get("/api/student/announcements")
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.status, "success");
  assert.ok(Array.isArray(res.body.data));
  assert.ok(res.body.data.some((a) => a._id === fixtureAnnouncementId));
  // Must not include announcements from unenrolled courses
  assert.ok(!res.body.data.some((a) => a._id === unenrolledAnnouncementId));
});

test("GET /api/student/announcements filter by courseId and keyword q", async () => {
  const resCourse = await request(app)
    .get(`/api/student/announcements?courseId=${enrolledCourseId}`)
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(resCourse.status, 200);
  assert.ok(resCourse.body.data.every((a) => a.courseId._id === enrolledCourseId));

  const resQ = await request(app)
    .get("/api/student/announcements?q=Enrolled")
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(resQ.status, 200);
  assert.ok(resQ.body.data.some((a) => a._id === fixtureAnnouncementId));

  const resRegex = await request(app)
    .get("/api/student/announcements?q=Enrolled*+?()[]")
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(resRegex.status, 200);

  const resUnenrolled = await request(app)
    .get(`/api/student/announcements?courseId=${unenrolledCourseId}`)
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(resUnenrolled.status, 403);

  const resInvalidCourse = await request(app)
    .get("/api/student/announcements?courseId=invalid_id")
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(resInvalidCourse.status, 400);
});

test("GET /api/student/announcements/:announcementId details & marks read", async () => {
  const res = await request(app)
    .get(`/api/student/announcements/${fixtureAnnouncementId}`)
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.status, "success");
  assert.equal(res.body.data._id, fixtureAnnouncementId);
  assert.equal(res.body.data.isRead, true);
});

test("GET /api/student/announcements/:announcementId read status isolation between students", async () => {
  // student01 read it in previous test, but student02 has not read it
  const res = await request(app)
    .get("/api/student/announcements")
    .set("Authorization", `Bearer ${student02Token}`);
  assert.equal(res.status, 200);
  const annForStudent02 = res.body.data.find((a) => a._id === fixtureAnnouncementId);
  if (annForStudent02) {
    assert.equal(annForStudent02.isRead, false);
  }
});

test("GET /api/student/announcements/:announcementId invalid & missing ID", async () => {
  const resInvalid = await request(app)
    .get("/api/student/announcements/invalid_announcement_id")
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(resInvalid.status, 400);

  const fakeId = new mongoose.Types.ObjectId().toString();
  const resMissing = await request(app)
    .get(`/api/student/announcements/${fakeId}`)
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(resMissing.status, 404);
});

test("GET /api/student/announcements/:announcementId for unenrolled course returns 403", async () => {
  const res = await request(app)
    .get(`/api/student/announcements/${unenrolledAnnouncementId}`)
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(res.status, 403);
});

// ==========================================
// 6. Module 6: Student Quiz Assessment Tests
// ==========================================
test("GET /api/student/quizzes lists enrolled quizzes with calculated status", async () => {
  const res = await request(app)
    .get("/api/student/quizzes")
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.data));
  assert.ok(res.body.data.some((q) => q._id === fixtureAvailableQuizId));
  const availQ = res.body.data.find((q) => q._id === fixtureAvailableQuizId);
  assert.equal(availQ.status, "AVAILABLE");

  const upQ = res.body.data.find((q) => q._id === fixtureUpcomingQuizId);
  assert.equal(upQ.status, "UPCOMING");

  const expQ = res.body.data.find((q) => q._id === fixtureExpiredQuizId);
  assert.equal(expQ.status, "EXPIRED");

  // Must not include quizzes from unenrolled courses
  assert.ok(!res.body.data.some((q) => q._id === unenrolledQuizId));
});

test("GET /api/student/quizzes filter by courseId and status", async () => {
  const resCourse = await request(app)
    .get(`/api/student/quizzes?courseId=${enrolledCourseId}`)
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(resCourse.status, 200);
  assert.ok(resCourse.body.data.every((q) => q.courseId._id === enrolledCourseId));

  const resStatus = await request(app)
    .get("/api/student/quizzes?status=AVAILABLE")
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(resStatus.status, 200);
  assert.ok(resStatus.body.data.every((q) => q.status === "AVAILABLE"));

  const resUnenrolled = await request(app)
    .get(`/api/student/quizzes?courseId=${unenrolledCourseId}`)
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(resUnenrolled.status, 403);
});

test("GET /api/student/quizzes/:quizId returns quiz details hiding correct answers", async () => {
  const res = await request(app)
    .get(`/api/student/quizzes/${fixtureAvailableQuizId}`)
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.data._id, fixtureAvailableQuizId);
  assert.ok(Array.isArray(res.body.data.questions));
  assert.ok(res.body.data.questions.length > 0);

  // CRITICAL SECURITY: Ensure answer key is NOT leaked
  for (const q of res.body.data.questions) {
    assert.equal(q.correctOptionId, undefined);
    assert.equal(q.explanation, undefined);
    assert.ok(q.prompt);
    assert.ok(Array.isArray(q.options));
  }
});

test("GET /api/student/quizzes/:quizId invalid & unenrolled access", async () => {
  const resInvalid = await request(app)
    .get("/api/student/quizzes/invalid_quiz_id")
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(resInvalid.status, 400);

  const resUnenrolled = await request(app)
    .get(`/api/student/quizzes/${unenrolledQuizId}`)
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(resUnenrolled.status, 403);
});

test("POST /api/student/quizzes/:quizId/start cannot start upcoming or expired quiz", async () => {
  const resUpcoming = await request(app)
    .post(`/api/student/quizzes/${fixtureUpcomingQuizId}/start`)
    .set("X-LMS-Request", "1")
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(resUpcoming.status, 400);
  assert.match(resUpcoming.body.message, /not opened yet/i);

  const resExpired = await request(app)
    .post(`/api/student/quizzes/${fixtureExpiredQuizId}/start`)
    .set("X-LMS-Request", "1")
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(resExpired.status, 400);
  assert.match(resExpired.body.message, /already closed/i);
});

test("POST /api/student/quizzes/:quizId/start valid available quiz returns 201 with safe questions", async () => {
  const res = await request(app)
    .post(`/api/student/quizzes/${fixtureAvailableQuizId}/start`)
    .set("X-LMS-Request", "1")
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(res.status, 201);
  assert.equal(res.body.status, "success");
  assert.ok(res.body.data.attemptId);
  assert.ok(res.body.data.startedAt);
  assert.ok(Array.isArray(res.body.data.questions));

  // Security check: questions in start response must also hide answer key
  for (const q of res.body.data.questions) {
    assert.equal(q.correctOptionId, undefined);
    assert.equal(q.explanation, undefined);
  }
});

test("POST /api/student/quizzes/:quizId/submit auto-grades answers and returns score", async () => {
  // Submit answers: Q1 -> A (correct: 2 pts), Q2 -> B (correct: 2 pts) = 4/4 (100%)
  const res = await request(app)
    .post(`/api/student/quizzes/${fixtureAvailableQuizId}/submit`)
    .set("X-LMS-Request", "1")
    .set("Authorization", `Bearer ${student01Token}`)
    .send({
      answers: {
        Q1: "A",
        Q2: "B",
      },
    });

  assert.equal(res.status, 200);
  assert.equal(res.body.status, "success");
  assert.equal(res.body.data.score, 4);
  assert.equal(res.body.data.maxScore, 4);
  assert.equal(res.body.data.percentage, 100);
  assert.equal(res.body.data.passed, true);
  completedAttemptId = res.body.data._id || res.body.data.attemptId;
});

test("POST /api/student/quizzes/:quizId/submit to already completed quiz returns 400", async () => {
  const res = await request(app)
    .post(`/api/student/quizzes/${fixtureAvailableQuizId}/submit`)
    .set("X-LMS-Request", "1")
    .set("Authorization", `Bearer ${student01Token}`)
    .send({ answers: { Q1: "B" } });
  assert.equal(res.status, 400);
  assert.match(res.body.message, /already been submitted/i);
});

test("GET /api/student/quiz-attempts/:attemptId/result returns score and review", async () => {
  const res = await request(app)
    .get(`/api/student/quiz-attempts/${completedAttemptId}/result`)
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.status, "success");
  assert.equal(res.body.data.score, 4);
  assert.equal(res.body.data.maxScore, 4);
  assert.equal(res.body.data.percentage, 100);
  assert.ok(Array.isArray(res.body.data.detailedReview));
  assert.equal(res.body.data.detailedReview.length, 2);
  assert.equal(res.body.data.detailedReview[0].isCorrect, true);
  assert.equal(res.body.data.detailedReview[0].correctOptionId, "A");
});

test("GET /api/student/quiz-attempts/:attemptId/result cross-student access returns 403", async () => {
  // student02 attempting to view student01's completed attempt
  const res = await request(app)
    .get(`/api/student/quiz-attempts/${completedAttemptId}/result`)
    .set("Authorization", `Bearer ${student02Token}`);
  assert.equal(res.status, 403);
  assert.match(res.body.message, /permission to view this quiz result/i);
});

// ==========================================
// 7. Module 7: Student Messaging Tests
// ==========================================
test("GET /api/student/recipients returns instructor recipients without passwords", async () => {
  const res = await request(app)
    .get("/api/student/recipients")
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.data));
  assert.ok(res.body.data.length > 0);
  // Ensure no password hashes are exposed
  for (const r of res.body.data) {
    assert.equal(r.passwordHash, undefined);
    assert.notEqual(r._id, student01Id);
    assert.ok(r.fullName);
    assert.ok(r.role);
  }
});

test("POST /api/student/messages sends message to instructor", async () => {
  const res = await request(app)
    .post("/api/student/messages")
    .set("X-LMS-Request", "1")
    .set("Authorization", `Bearer ${student01Token}`)
    .send({
      recipientId: instructorId,
      content: "[TEST] Hello Instructor, I have a question about the assignment.",
    });

  assert.equal(res.status, 201);
  assert.equal(res.body.status, "success");
  assert.equal(res.body.data.senderId, student01Id);
  assert.equal(res.body.data.recipientId, instructorId);
  assert.equal(res.body.data.content, "[TEST] Hello Instructor, I have a question about the assignment.");
  assert.equal(res.body.data.isRead, false);
});

test("POST /api/student/messages empty content or invalid recipient returns 400", async () => {
  const resEmpty = await request(app)
    .post("/api/student/messages")
    .set("X-LMS-Request", "1")
    .set("Authorization", `Bearer ${student01Token}`)
    .send({ recipientId: instructorId, content: "   " });
  assert.equal(resEmpty.status, 400);

  const resSelf = await request(app)
    .post("/api/student/messages")
    .set("X-LMS-Request", "1")
    .set("Authorization", `Bearer ${student01Token}`)
    .send({ recipientId: student01Id, content: "[TEST] Message to self" });
  assert.equal(resSelf.status, 400);

  const resMissing = await request(app)
    .post("/api/student/messages")
    .set("X-LMS-Request", "1")
    .set("Authorization", `Bearer ${student01Token}`)
    .send({ content: "[TEST] Missing recipient" });
  assert.equal(resMissing.status, 400);

  const fakeId = new mongoose.Types.ObjectId().toString();
  const resFake = await request(app)
    .post("/api/student/messages")
    .set("X-LMS-Request", "1")
    .set("Authorization", `Bearer ${student01Token}`)
    .send({ recipientId: fakeId, content: "[TEST] To fake user" });
  assert.equal(resFake.status, 404);
});

test("GET /api/student/messages/conversations lists conversations with unread counts", async () => {
  const res = await request(app)
    .get("/api/student/messages/conversations")
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.data));
  assert.ok(res.body.data.length > 0);
  const conv = res.body.data.find((c) => c.user._id === instructorId);
  assert.ok(conv);
  assert.ok(conv.lastMessage);
  assert.ok(typeof conv.unreadCount === "number");
});

test("GET /api/student/messages/:userId retrieves messages and marks incoming as read", async () => {
  // Seed an incoming unread message from instructor to student01
  await Message.create({
    senderId: instructorId,
    recipientId: student01Id,
    content: "[TEST] Hello student, here is the answer to your question.",
    isRead: false,
    sentAt: new Date(),
  });

  const res = await request(app)
    .get(`/api/student/messages/${instructorId}`)
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(res.status, 200);
  assert.ok(res.body.data.recipient);
  assert.ok(Array.isArray(res.body.data.messages));
  assert.ok(res.body.data.messages.length >= 2);

  // Verify the incoming message was marked as read
  const incoming = res.body.data.messages.find((m) => m.senderId === instructorId);
  if (incoming) {
    assert.equal(incoming.isRead, true);
  }
});

test("GET /api/student/messages/:userId invalid & self checks", async () => {
  const resInvalid = await request(app)
    .get("/api/student/messages/invalid_user_id")
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(resInvalid.status, 400);

  const resSelf = await request(app)
    .get(`/api/student/messages/${student01Id}`)
    .set("Authorization", `Bearer ${student01Token}`);
  assert.equal(resSelf.status, 400);
});
