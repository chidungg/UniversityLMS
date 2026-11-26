// Isolated Communication browser-test server. Never connects to MONGO_URI.
import path from "node:path";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import User from "../models/User.js";
import Course from "../models/Course.js";
import Enrollment from "../models/Enrollment.js";
import Announcement from "../models/Announcement.js";
import AnnouncementRead from "../models/AnnouncementRead.js";
import Message from "../models/Message.js";
import { migrateAuth } from "./migrateAuth.js";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "communication-browser-test-secret-32-bytes";
process.env.CLIENT_ORIGIN = "http://127.0.0.1:4174";

const { app } = await import("../server.js");

const database = await MongoMemoryReplSet.create({
  replSet: { count: 1 },
});

await mongoose.connect(database.getUri(), { dbName: "communication_browser_test" });
for (const model of [User, Course, Enrollment, Announcement, AnnouncementRead, Message]) {
  await model.createCollection();
  await model.createIndexes();
}
await migrateAuth();

const passwordHash = await bcrypt.hash("CommBrowser2026!", 12);

const [instructorA, instructorB, studentEnrolled, studentOther] = await User.create([
  { email: "inst.a@comm-e2e.test", fullName: "Dr. Alan Turing", role: "Instructor", isActive: true, passwordHash },
  { email: "inst.b@comm-e2e.test", fullName: "Prof. Grace Hopper", role: "Instructor", isActive: true, passwordHash },
  { email: "student.a@comm-e2e.test", fullName: "Alice Enrolled", role: "Student", isActive: true, passwordHash },
  { email: "student.b@comm-e2e.test", fullName: "Bob Unenrolled", role: "Student", isActive: true, passwordHash },
]);

const [courseA, courseB, inactiveCourse] = await Course.create([
  {
    courseCode: "COMM-101",
    courseName: "Distributed Systems",
    description: "Active course for Communication E2E tests.",
    instructorId: instructorA._id,
    isActive: true,
  },
  {
    courseCode: "COMM-202",
    courseName: "Compiler Design",
    description: "Course taught by Instructor B.",
    instructorId: instructorB._id,
    isActive: true,
  },
  {
    courseCode: "COMM-099",
    courseName: "Archived Legacy Course",
    description: "Inactive course.",
    instructorId: instructorA._id,
    isActive: false,
  },
]);

await Enrollment.create([
  { courseId: courseA._id, studentId: studentEnrolled._id },
  { courseId: courseB._id, studentId: studentOther._id },
]);

const server = app.listen(5102, "127.0.0.1", () =>
  console.log("Isolated Communication E2E API ready on 5102")
);

async function stop() {
  server.close();
  await mongoose.disconnect();
  await database.stop();
  process.exit(0);
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
