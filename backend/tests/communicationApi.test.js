import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import request from "supertest";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { app } from "../src/server.js";
import { migrateAuth } from "../src/scripts/migrateAuth.js";
import User from "../src/models/User.js";
import Course from "../src/models/Course.js";
import Enrollment from "../src/models/Enrollment.js";
import Announcement from "../src/models/Announcement.js";
import AnnouncementRead from "../src/models/AnnouncementRead.js";
import Message from "../src/models/Message.js";

let isolatedDb;

const extractSessionCookie = (response) =>
  response.headers["set-cookie"]
    ?.find((cookie) => cookie.startsWith("lms_session="))
    ?.split(";")[0]
    .slice("lms_session=".length);

let instructorAToken = "";
let instructorBToken = "";
let studentEnrolledToken = "";
let studentOtherToken = "";
let adminToken = "";

let instructorA;
let instructorB;
let studentEnrolled;
let studentEnrolled2;
let studentOther;
let studentInactive;
let adminUser;

let courseA;
let courseB;
let inactiveCourseA;
let publishedAnnouncementId = "";
let inactiveAnnouncementId = "";

async function loginAs(email, password = "CommTest2026!") {
  const res = await request(app)
    .post("/api/auth/login")
    .set("X-LMS-Request", "1")
    .send({ email, password });
  assert.equal(res.status, 200, `Login failed for ${email}: ${res.body?.message}`);
  return extractSessionCookie(res);
}

test.before(async () => {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "communication-integration-test-secret-32b";

  isolatedDb = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    binary: { downloadDir: path.resolve(".cache/mongodb-binaries") },
  });

  await mongoose.connect(isolatedDb.getUri(), { dbName: "communication_api_test" });
  for (const model of Object.values(mongoose.models)) {
    await model.createCollection();
  }
  await migrateAuth();

  const passwordHash = await bcrypt.hash("CommTest2026!", 12);

  [
    instructorA,
    instructorB,
    studentEnrolled,
    studentEnrolled2,
    studentOther,
    studentInactive,
    adminUser,
  ] = await User.create([
    { email: "inst.a@comm.test", fullName: "Dr. Alan Turing", role: "Instructor", isActive: true, passwordHash },
    { email: "inst.b@comm.test", fullName: "Prof. Grace Hopper", role: "Instructor", isActive: true, passwordHash },
    { email: "stud.enrolled@comm.test", fullName: "Alice Enrolled", role: "Student", isActive: true, passwordHash },
    { email: "stud.enrolled2@comm.test", fullName: "Bob Enrolled", role: "Student", isActive: true, passwordHash },
    { email: "stud.other@comm.test", fullName: "Charlie Unenrolled", role: "Student", isActive: true, passwordHash },
    { email: "stud.inactive@comm.test", fullName: "Inactive Student", role: "Student", isActive: false, passwordHash },
    { email: "admin@comm.test", fullName: "System Admin", role: "Administrator", isActive: true, passwordHash },
  ]);

  [courseA, courseB, inactiveCourseA] = await Course.create([
    {
      courseCode: "COMM-101",
      courseName: "Distributed Systems",
      description: "Active course taught by Instructor A",
      instructorId: instructorA._id,
      isActive: true,
    },
    {
      courseCode: "COMM-202",
      courseName: "Compiler Design",
      description: "Active course taught by Instructor B",
      instructorId: instructorB._id,
      isActive: true,
    },
    {
      courseCode: "COMM-099",
      courseName: "Archived Legacy Systems",
      description: "Inactive course taught by Instructor A",
      instructorId: instructorA._id,
      isActive: false,
    },
  ]);

  await Enrollment.create([
    { courseId: courseA._id, studentId: studentEnrolled._id },
    { courseId: courseA._id, studentId: studentEnrolled2._id },
    { courseId: inactiveCourseA._id, studentId: studentEnrolled._id },
    { courseId: courseA._id, studentId: studentInactive._id },
    { courseId: courseB._id, studentId: studentOther._id },
  ]);

  const inactiveAnn = await Announcement.create({
    courseId: inactiveCourseA._id,
    title: "Archived Course Notice",
    content: "Should not be accessible when course is inactive.",
  });
  inactiveAnnouncementId = inactiveAnn._id.toString();

  instructorAToken = await loginAs("inst.a@comm.test");
  instructorBToken = await loginAs("inst.b@comm.test");
  studentEnrolledToken = await loginAs("stud.enrolled@comm.test");
  studentOtherToken = await loginAs("stud.other@comm.test");
  adminToken = await loginAs("admin@comm.test");
});

test.after(async () => {
  await mongoose.disconnect();
  await isolatedDb?.stop();
});

// ============================================================================
// AUTHENTICATION & ROLE GUARD TESTS
// ============================================================================

test("Unauthenticated and wrong-role requests to Communication endpoints are rejected", async () => {
  const unauthStudent = await request(app).get("/api/student/announcements");
  assert.equal(unauthStudent.status, 401);

  const unauthInstructor = await request(app).get("/api/instructor/announcements");
  assert.equal(unauthInstructor.status, 401);

  const studentOnInstructor = await request(app)
    .get("/api/instructor/announcements")
    .set("Authorization", `Bearer ${studentEnrolledToken}`);
  assert.equal(studentOnInstructor.status, 403);

  const instructorOnStudent = await request(app)
    .get("/api/student/announcements")
    .set("Authorization", `Bearer ${instructorAToken}`);
  assert.equal(instructorOnStudent.status, 403);

  const adminOnInstructorMsg = await request(app)
    .get("/api/instructor/messages/conversations")
    .set("Authorization", `Bearer ${adminToken}`);
  assert.equal(adminOnInstructorMsg.status, 403);
});

// ============================================================================
// ANNOUNCEMENTS: INSTRUCTOR I06 -> STUDENT S04
// ============================================================================

test("Instructor A publishes announcement for assigned active Course A and persists in MongoDB", async () => {
  const res = await request(app)
    .post(`/api/instructor/courses/${courseA._id}/announcements`)
    .set("X-LMS-Request", "1")
    .set("Authorization", `Bearer ${instructorAToken}`)
    .send({
      title: "  Midterm Schedule Update  ",
      content: "  Midterm exam will take place on Monday at 09:00 AM in Room B204.  ",
    });

  assert.equal(res.status, 201);
  assert.equal(res.body.status, "success");
  assert.equal(res.body.data.title, "Midterm Schedule Update");
  assert.equal(res.body.data.content, "Midterm exam will take place on Monday at 09:00 AM in Room B204.");
  assert.equal(res.body.data.courseId._id, courseA._id.toString());
  assert.equal(res.body.data.author.fullName, "Dr. Alan Turing");
  publishedAnnouncementId = res.body.data._id;

  const saved = await Announcement.findById(publishedAnnouncementId).lean();
  assert.ok(saved);
  assert.equal(saved.title, "Midterm Schedule Update");
});

test("Instructor announcement validation rejects empty, oversized, invalid courseId, other instructor's course, and inactive course", async () => {
  const emptyTitle = await request(app)
    .post(`/api/instructor/courses/${courseA._id}/announcements`)
    .set("X-LMS-Request", "1")
    .set("Authorization", `Bearer ${instructorAToken}`)
    .send({ title: "   ", content: "Valid content" });
  assert.equal(emptyTitle.status, 400);

  const emptyContent = await request(app)
    .post(`/api/instructor/courses/${courseA._id}/announcements`)
    .set("X-LMS-Request", "1")
    .set("Authorization", `Bearer ${instructorAToken}`)
    .send({ title: "Valid title", content: "   " });
  assert.equal(emptyContent.status, 400);

  const longTitle = await request(app)
    .post(`/api/instructor/courses/${courseA._id}/announcements`)
    .set("X-LMS-Request", "1")
    .set("Authorization", `Bearer ${instructorAToken}`)
    .send({ title: "T".repeat(201), content: "Valid content" });
  assert.equal(longTitle.status, 400);

  const longContent = await request(app)
    .post(`/api/instructor/courses/${courseA._id}/announcements`)
    .set("X-LMS-Request", "1")
    .set("Authorization", `Bearer ${instructorAToken}`)
    .send({ title: "Valid title", content: "C".repeat(5001) });
  assert.equal(longContent.status, 400);

  const invalidCourse = await request(app)
    .post("/api/instructor/courses/not-an-id/announcements")
    .set("X-LMS-Request", "1")
    .set("Authorization", `Bearer ${instructorAToken}`)
    .send({ title: "Valid title", content: "Valid content" });
  assert.equal(invalidCourse.status, 400);

  const otherCourse = await request(app)
    .post(`/api/instructor/courses/${courseB._id}/announcements`)
    .set("X-LMS-Request", "1")
    .set("Authorization", `Bearer ${instructorAToken}`)
    .send({ title: "Unauthorized", content: "Should fail" });
  assert.equal(otherCourse.status, 403);

  const inactiveCourse = await request(app)
    .post(`/api/instructor/courses/${inactiveCourseA._id}/announcements`)
    .set("X-LMS-Request", "1")
    .set("Authorization", `Bearer ${instructorAToken}`)
    .send({ title: "Inactive", content: "Should fail" });
  assert.equal(inactiveCourse.status, 409);
});

test("Instructor lists and views own announcements, and cannot view another instructor's announcement", async () => {
  const listRes = await request(app)
    .get(`/api/instructor/announcements?courseId=${courseA._id}&q=Midterm`)
    .set("Authorization", `Bearer ${instructorAToken}`);
  assert.equal(listRes.status, 200);
  assert.equal(listRes.body.data.length, 1);
  assert.equal(listRes.body.data[0]._id, publishedAnnouncementId);

  const detailRes = await request(app)
    .get(`/api/instructor/announcements/${publishedAnnouncementId}`)
    .set("Authorization", `Bearer ${instructorAToken}`);
  assert.equal(detailRes.status, 200);
  assert.equal(detailRes.body.data.title, "Midterm Schedule Update");

  const otherInstRes = await request(app)
    .get(`/api/instructor/announcements/${publishedAnnouncementId}`)
    .set("Authorization", `Bearer ${instructorBToken}`);
  assert.equal(otherInstRes.status, 403);

  const otherCourseList = await request(app)
    .get(`/api/instructor/announcements?courseId=${courseB._id}`)
    .set("Authorization", `Bearer ${instructorAToken}`);
  assert.equal(otherCourseList.status, 403);
});

test("Enrolled student retrieves newly published announcement and records isolated read status; non-enrolled student & inactive course blocked", async () => {
  // Enrolled student sees announcement unread initially, does NOT see inactive course announcement
  const listBefore = await request(app)
    .get("/api/student/announcements")
    .set("Authorization", `Bearer ${studentEnrolledToken}`);
  assert.equal(listBefore.status, 200);
  const found = listBefore.body.data.find((a) => a._id === publishedAnnouncementId);
  assert.ok(found);
  assert.equal(found.isRead, false);
  assert.equal(found.author?.fullName, "Dr. Alan Turing");
  assert.ok(!listBefore.body.data.some((a) => a._id === inactiveAnnouncementId));

  // Inactive course detail is consistently forbidden (403)
  const inactiveDetail = await request(app)
    .get(`/api/student/announcements/${inactiveAnnouncementId}`)
    .set("Authorization", `Bearer ${studentEnrolledToken}`);
  assert.equal(inactiveDetail.status, 403);

  // Non-enrolled student cannot access Course A announcement
  const unenrolledList = await request(app)
    .get("/api/student/announcements")
    .set("Authorization", `Bearer ${studentOtherToken}`);
  assert.equal(unenrolledList.status, 200);
  assert.ok(!unenrolledList.body.data.some((a) => a._id === publishedAnnouncementId));

  const unenrolledDetail = await request(app)
    .get(`/api/student/announcements/${publishedAnnouncementId}`)
    .set("Authorization", `Bearer ${studentOtherToken}`);
  assert.equal(unenrolledDetail.status, 403);

  // Enrolled student opens detail -> AnnouncementRead persisted
  const readRes = await request(app)
    .get(`/api/student/announcements/${publishedAnnouncementId}`)
    .set("Authorization", `Bearer ${studentEnrolledToken}`);
  assert.equal(readRes.status, 200);
  assert.equal(readRes.body.data.isRead, true);

  const readRecord = await AnnouncementRead.findOne({
    announcementId: publishedAnnouncementId,
    studentId: studentEnrolled._id,
  }).lean();
  assert.ok(readRecord);

  // Second enrolled student still sees isRead = false
  const student2Token = await loginAs("stud.enrolled2@comm.test");
  const listStudent2 = await request(app)
    .get("/api/student/announcements")
    .set("Authorization", `Bearer ${student2Token}`);
  const found2 = listStudent2.body.data.find((a) => a._id === publishedAnnouncementId);
  assert.ok(found2);
  assert.equal(found2.isRead, false);
});

// ============================================================================
// MESSAGING: BIDIRECTIONAL STUDENT <-> INSTRUCTOR
// ============================================================================

test("Recipients are scoped to active shared courses without exposing sensitive fields", async () => {
  const studRecRes = await request(app)
    .get("/api/student/recipients")
    .set("Authorization", `Bearer ${studentEnrolledToken}`);
  assert.equal(studRecRes.status, 200);
  assert.equal(studRecRes.body.data.length, 1);
  assert.equal(studRecRes.body.data[0]._id, instructorA._id.toString());
  assert.equal(studRecRes.body.data[0].passwordHash, undefined);
  assert.ok(studRecRes.body.data[0].courses.some((c) => c.includes("COMM-101")));

  // Instructor A sees active enrolled students (Alice & Bob), NOT Charlie (Course B) or Inactive Student
  const instRecRes = await request(app)
    .get("/api/instructor/recipients")
    .set("Authorization", `Bearer ${instructorAToken}`);
  assert.equal(instRecRes.status, 200);
  const instRecipientIds = instRecRes.body.data.map((u) => u._id);
  assert.ok(instRecipientIds.includes(studentEnrolled._id.toString()));
  assert.ok(instRecipientIds.includes(studentEnrolled2._id.toString()));
  assert.ok(!instRecipientIds.includes(studentOther._id.toString()));
  assert.ok(!instRecipientIds.includes(studentInactive._id.toString()));
  for (const r of instRecRes.body.data) {
    assert.equal(r.passwordHash, undefined);
  }
});

test("Bidirectional messaging: Student -> Instructor -> Student, unread counts, and read-on-open", async () => {
  // Student sends message to Instructor A (even if client tries to spoof senderId in body, server uses req.user._id)
  const send1 = await request(app)
    .post("/api/student/messages")
    .set("X-LMS-Request", "1")
    .set("Authorization", `Bearer ${studentEnrolledToken}`)
    .send({
      senderId: studentOther._id.toString(),
      recipientId: instructorA._id.toString(),
      content: "Hello Dr. Turing, is the midterm open book?",
    });
  assert.equal(send1.status, 201);
  assert.equal(send1.body.data.senderId, studentEnrolled._id.toString());
  assert.equal(send1.body.data.isRead, false);

  // Student sends second message
  const send2 = await request(app)
    .post("/api/student/messages")
    .set("X-LMS-Request", "1")
    .set("Authorization", `Bearer ${studentEnrolledToken}`)
    .send({
      recipientId: instructorA._id.toString(),
      content: "Also, will sample questions be posted?",
    });
  assert.equal(send2.status, 201);

  // Instructor sees conversation with unreadCount === 2 and latest message
  const instConvsBefore = await request(app)
    .get("/api/instructor/messages/conversations")
    .set("Authorization", `Bearer ${instructorAToken}`);
  assert.equal(instConvsBefore.status, 200);
  const aliceConv = instConvsBefore.body.data.find((c) => c.user._id === studentEnrolled._id.toString());
  assert.ok(aliceConv);
  assert.equal(aliceConv.unreadCount, 2);
  assert.equal(aliceConv.lastMessage.content, "Also, will sample questions be posted?");

  // Instructor opens thread -> incoming messages marked as read in DB
  const instThread = await request(app)
    .get(`/api/instructor/messages/${studentEnrolled._id}`)
    .set("Authorization", `Bearer ${instructorAToken}`);
  assert.equal(instThread.status, 200);
  assert.equal(instThread.body.data.messages.length, 2);
  assert.ok(instThread.body.data.messages.every((m) => m.isRead === true));

  const unreadInDb = await Message.countDocuments({
    senderId: studentEnrolled._id,
    recipientId: instructorA._id,
    isRead: false,
  });
  assert.equal(unreadInDb, 0);

  // Instructor replies to Student
  const replyRes = await request(app)
    .post("/api/instructor/messages")
    .set("X-LMS-Request", "1")
    .set("Authorization", `Bearer ${instructorAToken}`)
    .send({
      recipientId: studentEnrolled._id.toString(),
      content: "Closed book, and yes, I will share sample problems tomorrow.",
    });
  assert.equal(replyRes.status, 201);
  assert.equal(replyRes.body.data.senderId, instructorA._id.toString());
  assert.equal(replyRes.body.data.isRead, false);

  // Student sees unreadCount === 1
  const studConvsBefore = await request(app)
    .get("/api/student/messages/conversations")
    .set("Authorization", `Bearer ${studentEnrolledToken}`);
  const instConv = studConvsBefore.body.data.find((c) => c.user._id === instructorA._id.toString());
  assert.ok(instConv);
  assert.equal(instConv.unreadCount, 1);
  assert.equal(instConv.lastMessage.content, "Closed book, and yes, I will share sample problems tomorrow.");

  // Student opens thread -> reply marked read
  const studThread = await request(app)
    .get(`/api/student/messages/${instructorA._id}`)
    .set("Authorization", `Bearer ${studentEnrolledToken}`);
  assert.equal(studThread.status, 200);
  assert.equal(studThread.body.data.messages.length, 3);
  assert.ok(studThread.body.data.messages.every((m) => m.isRead === true));

  const studConvsAfter = await request(app)
    .get("/api/student/messages/conversations")
    .set("Authorization", `Bearer ${studentEnrolledToken}`);
  const instConvAfter = studConvsAfter.body.data.find((c) => c.user._id === instructorA._id.toString());
  assert.equal(instConvAfter.unreadCount, 0);
});

test("Instructor initiates a new conversation with another eligible student and conversations sort chronologically", async () => {
  await new Promise((r) => setTimeout(r, 15));
  const initRes = await request(app)
    .post("/api/instructor/messages")
    .set("X-LMS-Request", "1")
    .set("Authorization", `Bearer ${instructorAToken}`)
    .send({
      recipientId: studentEnrolled2._id.toString(),
      content: "Hi Bob, please check your lab submission.",
    });
  assert.equal(initRes.status, 201);

  const convsRes = await request(app)
    .get("/api/instructor/messages/conversations")
    .set("Authorization", `Bearer ${instructorAToken}`);
  assert.equal(convsRes.status, 200);
  assert.equal(convsRes.body.data.length, 2);
  assert.equal(convsRes.body.data[0].user._id, studentEnrolled2._id.toString());
  assert.equal(convsRes.body.data[1].user._id, studentEnrolled._id.toString());
});

test("Messaging authorization and validation reject ineligible recipients, self, inactive users, invalid IDs, empty & oversized messages", async () => {
  // Student cannot message Instructor B (not enrolled in Course B)
  const ineligibleInst = await request(app)
    .post("/api/student/messages")
    .set("X-LMS-Request", "1")
    .set("Authorization", `Bearer ${studentEnrolledToken}`)
    .send({ recipientId: instructorB._id.toString(), content: "Hello" });
  assert.equal(ineligibleInst.status, 403);

  // Student cannot message another student or admin
  const peerMsg = await request(app)
    .post("/api/student/messages")
    .set("X-LMS-Request", "1")
    .set("Authorization", `Bearer ${studentEnrolledToken}`)
    .send({ recipientId: studentEnrolled2._id.toString(), content: "Peer message" });
  assert.equal(peerMsg.status, 403);

  const adminMsg = await request(app)
    .post("/api/student/messages")
    .set("X-LMS-Request", "1")
    .set("Authorization", `Bearer ${studentEnrolledToken}`)
    .send({ recipientId: adminUser._id.toString(), content: "Admin message" });
  assert.equal(adminMsg.status, 403);

  // Instructor A cannot message Charlie (Course B) or inactive student
  const ineligibleStud = await request(app)
    .post("/api/instructor/messages")
    .set("X-LMS-Request", "1")
    .set("Authorization", `Bearer ${instructorAToken}`)
    .send({ recipientId: studentOther._id.toString(), content: "Hi Charlie" });
  assert.equal(ineligibleStud.status, 403);

  const inactiveStud = await request(app)
    .post("/api/instructor/messages")
    .set("X-LMS-Request", "1")
    .set("Authorization", `Bearer ${instructorAToken}`)
    .send({ recipientId: studentInactive._id.toString(), content: "Hi Inactive" });
  assert.equal(inactiveStud.status, 400);

  // Instructor B cannot read Instructor A's conversation with Alice
  const unauthorizedRead = await request(app)
    .get(`/api/instructor/messages/${studentEnrolled._id}`)
    .set("Authorization", `Bearer ${instructorBToken}`);
  assert.equal(unauthorizedRead.status, 403);

  // Self, invalid ID, nonexistent ID, empty content, >2000 chars
  const selfMsg = await request(app)
    .post("/api/instructor/messages")
    .set("X-LMS-Request", "1")
    .set("Authorization", `Bearer ${instructorAToken}`)
    .send({ recipientId: instructorA._id.toString(), content: "Self" });
  assert.equal(selfMsg.status, 400);

  const badId = await request(app)
    .post("/api/instructor/messages")
    .set("X-LMS-Request", "1")
    .set("Authorization", `Bearer ${instructorAToken}`)
    .send({ recipientId: "invalid-id", content: "Test" });
  assert.equal(badId.status, 400);

  const missingId = new mongoose.Types.ObjectId().toString();
  const notFound = await request(app)
    .post("/api/instructor/messages")
    .set("X-LMS-Request", "1")
    .set("Authorization", `Bearer ${instructorAToken}`)
    .send({ recipientId: missingId, content: "Test" });
  assert.equal(notFound.status, 404);

  const emptyMsg = await request(app)
    .post("/api/instructor/messages")
    .set("X-LMS-Request", "1")
    .set("Authorization", `Bearer ${instructorAToken}`)
    .send({ recipientId: studentEnrolled._id.toString(), content: "   " });
  assert.equal(emptyMsg.status, 400);

  const longMsg = await request(app)
    .post("/api/instructor/messages")
    .set("X-LMS-Request", "1")
    .set("Authorization", `Bearer ${instructorAToken}`)
    .send({ recipientId: studentEnrolled._id.toString(), content: "M".repeat(2001) });
  assert.equal(longMsg.status, 400);
});
