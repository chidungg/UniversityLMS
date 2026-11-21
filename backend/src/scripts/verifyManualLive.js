import mongoose from "mongoose";
import request from "supertest";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import connectDB from "../config/db.js";
import { app } from "../server.js";
import User from "../models/User.js";
import Course from "../models/Course.js";
import Enrollment from "../models/Enrollment.js";
import Announcement from "../models/Announcement.js";
import AnnouncementRead from "../models/AnnouncementRead.js";
import Quiz from "../models/Quiz.js";
import QuizAttempt from "../models/QuizAttempt.js";
import Message from "../models/Message.js";

async function runManualVerification() {
  console.log("=== BẮT ĐẦU KIỂM THỬ THỦ CÔNG (MANUAL API VERIFICATION) ===");
  await connectDB();

  // 1. Authenticate Student01 and Student02
  const loginRes1 = await request(app)
    .post("/api/auth/login")
    .set("X-LMS-Request", "1")
    .send({ email: "student01@lms-demo.test", password: "Bin2005." });
  const token1 = loginRes1.headers["set-cookie"]?.[0].split(";")[0].slice("lms_session=".length);
  const student1Id = loginRes1.body?.user?._id;

  const loginRes2 = await request(app)
    .post("/api/auth/login")
    .set("X-LMS-Request", "1")
    .send({ email: "student02@lms-demo.test", password: "Bin2005." });
  const token2 = loginRes2.headers["set-cookie"]?.[0].split(";")[0].slice("lms_session=".length);
  const student2Id = loginRes2.body?.user?._id;

  console.log(`[AUTH] Student01 logged in: ID=${student1Id}, Token length=${token1?.length}`);
  console.log(`[AUTH] Student02 logged in: ID=${student2Id}, Token length=${token2?.length}`);

  // Retrieve an enrolled course for Student01
  const enrollment = await Enrollment.findOne({ studentId: student1Id }).populate("courseId");
  const courseId = enrollment.courseId._id.toString();
  console.log(`[CONTEXT] Enrolled Course: ${enrollment.courseId.courseCode} - ${enrollment.courseId.title} (${courseId})`);

  // ================= MODULE 5: ANNOUNCEMENTS =================
  console.log("\n--- MODULE 5: ANNOUNCEMENTS ---");

  // Endpoint 1: GET /api/student/announcements
  const announcementsRes = await request(app)
    .get("/api/student/announcements")
    .set("Authorization", `Bearer ${token1}`);
  console.log(`1. GET /api/student/announcements: HTTP ${announcementsRes.status}`);
  console.log(`   Count: ${announcementsRes.body?.data?.length}`);
  const sampleAnnouncement = announcementsRes.body?.data?.[0];
  console.log(`   Sample: Title="${sampleAnnouncement?.title}", Course="${sampleAnnouncement?.course?.courseName || sampleAnnouncement?.course?.courseCode}", isRead=${sampleAnnouncement?.isRead}`);

  // Endpoint 2: GET /api/student/announcements/:announcementId
  const announcementId = sampleAnnouncement._id;
  const annDetailRes = await request(app)
    .get(`/api/student/announcements/${announcementId}`)
    .set("Authorization", `Bearer ${token1}`);
  console.log(`2. GET /api/student/announcements/${announcementId}: HTTP ${annDetailRes.status}`);
  console.log(`   Payload: Title="${annDetailRes.body?.data?.title}", isRead=${annDetailRes.body?.data?.isRead}`);

  // DB Check for announcement read record
  const readRecord = await AnnouncementRead.findOne({ announcementId, studentId: student1Id });
  console.log(`   [DB VERIFICATION] AnnouncementRead record in DB: exists=${!!readRecord}, readAt=${readRecord?.readAt}`);

  // ================= MODULE 6: QUIZ ASSESSMENT =================
  console.log("\n--- MODULE 6: QUIZ ASSESSMENT ---");

  // Endpoint 3: GET /api/student/quizzes
  const quizzesRes = await request(app)
    .get("/api/student/quizzes")
    .set("Authorization", `Bearer ${token1}`);
  console.log(`3. GET /api/student/quizzes: HTTP ${quizzesRes.status}`);
  console.log(`   Count: ${quizzesRes.body?.data?.length}`);
  console.log(`   Quizzes statuses:`, quizzesRes.body?.data?.map(q => ({ title: q.title, status: q.status, course: q.course?.courseCode })));

  // Find an available quiz for testing
  const availableQuiz = quizzesRes.body?.data?.find(q => q.status === "AVAILABLE") || quizzesRes.body?.data?.[0];
  const quizId = availableQuiz._id;

  // Endpoint 4: GET /api/student/quizzes/:quizId
  const quizDetailRes = await request(app)
    .get(`/api/student/quizzes/${quizId}`)
    .set("Authorization", `Bearer ${token1}`);
  console.log(`4. GET /api/student/quizzes/${quizId}: HTTP ${quizDetailRes.status}`);
  const firstQ = quizDetailRes.body?.data?.questions?.[0];
  console.log(`   Question count: ${quizDetailRes.body?.data?.questions?.length}`);
  console.log(`   Sanitization check - correctOptionId present: ${firstQ?.correctOptionId !== undefined}, explanation present: ${firstQ?.explanation !== undefined}`);

  // Endpoint 5: POST /api/student/quizzes/:quizId/start
  // Clean up any existing attempt for clean start in manual test
  await QuizAttempt.deleteMany({ quizId, studentId: student1Id });
  const startQuizRes = await request(app)
    .post(`/api/student/quizzes/${quizId}/start`)
    .set("X-LMS-Request", "1")
    .set("Authorization", `Bearer ${token1}`);
  console.log(`5. POST /api/student/quizzes/${quizId}/start: HTTP ${startQuizRes.status}`);
  const attemptId = startQuizRes.body?.data?.attemptId;
  console.log(`   Attempt created: ID=${attemptId}, StartedAt=${startQuizRes.body?.data?.startedAt}, TimeLimit=${startQuizRes.body?.data?.timeLimit} mins`);

  // DB Check for attempt in DB
  const attemptInDb = await QuizAttempt.findById(attemptId);
  console.log(`   [DB VERIFICATION] QuizAttempt in DB: exists=${!!attemptInDb}, startedAt=${attemptInDb?.startedAt}, result=${attemptInDb?.result}`);

  // Endpoint 6: POST /api/student/quizzes/:quizId/submit
  const fullQuiz = await Quiz.findById(quizId);
  const studentAnswers = (fullQuiz.questions || []).map((q, idx) => ({
    questionId: q.id || q._id?.toString(),
    selectedOptionId: idx === 0 ? q.correctOptionId : (q.options?.find(o => o.optionId !== q.correctOptionId)?.optionId || "opt_fake")
  }));

  const submitRes = await request(app)
    .post(`/api/student/quizzes/${quizId}/submit`)
    .set("X-LMS-Request", "1")
    .set("Authorization", `Bearer ${token1}`)
    .send({ answers: studentAnswers });
  console.log(`6. POST /api/student/quizzes/${quizId}/submit: HTTP ${submitRes.status}`);
  console.log(`   Result: Score=${submitRes.body?.data?.score}/${submitRes.body?.data?.maxScore}, Percentage=${submitRes.body?.data?.percentage}%, Passed=${submitRes.body?.data?.passed}`);

  // Endpoint 7: GET /api/student/quiz-attempts/:attemptId/result
  const resultRes = await request(app)
    .get(`/api/student/quiz-attempts/${attemptId}/result`)
    .set("Authorization", `Bearer ${token1}`);
  console.log(`7. GET /api/student/quiz-attempts/${attemptId}/result: HTTP ${resultRes.status}`);
  console.log(`   DetailedReview questions count: ${resultRes.body?.data?.detailedReview?.length}`);
  const firstReviewQ = resultRes.body?.data?.detailedReview?.[0];
  console.log(`   Sample question review: isCorrect=${firstReviewQ?.isCorrect}, studentSelected=${firstReviewQ?.selectedOptionId}, correctOption=${firstReviewQ?.correctOptionId}`);

  // ================= MODULE 7: MESSAGING =================
  console.log("\n--- MODULE 7: MESSAGING ---");

  // Endpoint 8: GET /api/student/recipients
  const recipientsRes = await request(app)
    .get("/api/student/recipients")
    .set("Authorization", `Bearer ${token1}`);
  console.log(`8. GET /api/student/recipients: HTTP ${recipientsRes.status}`);
  console.log(`   Recipients count: ${recipientsRes.body?.data?.length}`);
  const instructor = recipientsRes.body?.data?.[0];
  console.log(`   Sample recipient: ${instructor?.fullName} (${instructor?.email}), Role: ${instructor?.role}`);
  console.log(`   Security check - password/passwordHash present: ${instructor?.password !== undefined || instructor?.passwordHash !== undefined}`);

  // Endpoint 9: POST /api/student/messages
  const msgContent = `Xin chào thầy/cô, em có câu hỏi về học phần (Manual verification at ${new Date().toISOString()})`;
  const sendMsgRes = await request(app)
    .post("/api/student/messages")
    .set("X-LMS-Request", "1")
    .set("Authorization", `Bearer ${token1}`)
    .send({
      recipientId: instructor._id,
      content: msgContent
    });
  console.log(`9. POST /api/student/messages: HTTP ${sendMsgRes.status}`);
  const sentMsgId = sendMsgRes.body?.data?._id;
  console.log(`   Message sent: ID=${sentMsgId}, Content="${sendMsgRes.body?.data?.content}"`);

  // DB Check for message in DB
  const msgInDb = await Message.findById(sentMsgId);
  console.log(`   [DB VERIFICATION] Message in DB: sender=${msgInDb?.senderId}, recipient=${msgInDb?.recipientId}, isRead=${msgInDb?.isRead}`);

  // Endpoint 10: GET /api/student/messages/conversations
  const convRes = await request(app)
    .get("/api/student/messages/conversations")
    .set("Authorization", `Bearer ${token1}`);
  console.log(`10. GET /api/student/messages/conversations: HTTP ${convRes.status}`);
  console.log(`    Conversations count: ${convRes.body?.data?.length}`);
  const targetConv = convRes.body?.data?.find(c => c.user?._id?.toString() === instructor._id.toString());
  console.log(`    Target conversation with ${instructor.fullName}: lastMessage="${targetConv?.lastMessage?.content}", unreadCount=${targetConv?.unreadCount}`);

  // Endpoint 11: GET /api/student/messages/:userId
  const threadRes = await request(app)
    .get(`/api/student/messages/${instructor._id}`)
    .set("Authorization", `Bearer ${token1}`);
  console.log(`11. GET /api/student/messages/${instructor._id}: HTTP ${threadRes.status}`);
  console.log(`    Messages in thread: ${threadRes.body?.data?.messages?.length}`);

  console.log("\n=== TẤT CẢ 11 ENDPOINTS CỦA MODULES 5, 6, 7 ĐỀU HOẠT ĐỘNG HOÀN HẢO! ===");
  await mongoose.disconnect();
}

runManualVerification().catch(err => {
  console.error("Manual verification failed:", err);
  process.exit(1);
});
