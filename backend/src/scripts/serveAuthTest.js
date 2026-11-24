// Isolated browser-test server. This entry point never connects to MONGO_URI.
import path from 'node:path';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import User from '../models/User.js';
import Course from '../models/Course.js';
import Enrollment from '../models/Enrollment.js';
import LearningMaterial from '../models/LearningMaterial.js';
import Assignment from '../models/Assignment.js';
import Submission from '../models/Submission.js';
import Quiz from '../models/Quiz.js';
import QuizAttempt from '../models/QuizAttempt.js';
import { migrateAuth } from './migrateAuth.js';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'browser-tests-only-32-byte-secret-not-for-deployment';
process.env.CLIENT_ORIGIN = 'http://127.0.0.1:4173';
const { app } = await import('../server.js');
const database = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { downloadDir: path.resolve('.cache/mongodb-binaries') } });
await mongoose.connect(database.getUri(), { dbName: 'a01_browser_test' });
await User.createCollection(); await User.createIndexes();
await Course.createCollection(); await Course.createIndexes();
await Enrollment.createCollection(); await Enrollment.createIndexes();
await LearningMaterial.createCollection(); await LearningMaterial.createIndexes();
await Assignment.createCollection(); await Assignment.createIndexes();
await Submission.createCollection(); await Submission.createIndexes();
await Quiz.createCollection(); await Quiz.createIndexes();
await QuizAttempt.createCollection(); await QuizAttempt.createIndexes();
await migrateAuth();
const passwordHash = await bcrypt.hash('Browser-test-2026', 12);
const seededUsers = {};
for (const role of ['Administrator', 'Instructor', 'Student']) {
  seededUsers[role] = await User.create({ email: `${role.toLowerCase()}@browser.test`, fullName: `Test ${role}`, role, passwordHash });
}
const [student2] = await User.create([
  { email: 'student2@browser.test', fullName: 'Second Student', role: 'Student', passwordHash, isActive: true },
  { email: 'inactive.student@browser.test', fullName: 'Inactive Student', role: 'Student', passwordHash, isActive: false },
]);
const [, , dbiCourse, , emptyMonitorCourse] = await Course.create([
  {
    courseCode: 'SE104',
    courseName: 'Software Engineering',
    description: 'Software development processes, requirements analysis, design and testing.',
    isActive: true,
  },
  {
    courseCode: 'NET301',
    courseName: 'Computer Networks',
    description: 'Network architecture, communication protocols and core networking concepts.',
    isActive: false,
  },
  {
    courseCode: 'DBI202',
    courseName: 'Database Systems',
    description: 'Relational data modeling, SQL and database design fundamentals.',
    isActive: true,
    instructorId: seededUsers.Instructor._id,
  },
  {
    courseCode: 'CS105',
    courseName: 'Data Structures',
    description: 'Trees, graphs, and algorithm analysis with zero enrollments yet.',
    isActive: true,
    instructorId: seededUsers.Instructor._id,
  },
  {
    courseCode: 'CS106',
    courseName: 'Operating Systems',
    description: 'Processes, scheduling, and concurrency with zero assessments yet.',
    isActive: true,
    instructorId: seededUsers.Instructor._id,
  },
]);
const dayMs = 24 * 60 * 60 * 1000;
const nowMs = Date.now();
await Enrollment.create([
  {
    courseId: dbiCourse._id,
    studentId: student2._id,
    enrolledAt: new Date(nowMs - 2 * dayMs),
  },
  {
    courseId: emptyMonitorCourse._id,
    studentId: student2._id,
    enrolledAt: new Date(nowMs - 2 * dayMs),
  },
]);
const [assignment1, assignment2] = await Assignment.create([
  {
    courseId: dbiCourse._id,
    title: 'ER Modeling Lab',
    description: 'Design normalized entity-relationship diagrams.',
    dueDate: new Date(nowMs + 7 * dayMs),
    maxScore: 10,
  },
  {
    courseId: dbiCourse._id,
    title: 'SQL Query Practice',
    description: 'Write analytical SQL queries using joins and aggregates.',
    dueDate: new Date(nowMs + 7 * dayMs),
    maxScore: 10,
  },
]);
await Submission.create([
  {
    assignmentId: assignment1._id,
    studentId: student2._id,
    content: 'ER diagram submitted.',
    grade: 8.5,
    feedback: 'Strong ER model.',
    submittedAt: new Date(nowMs - 2 * dayMs),
  },
  {
    assignmentId: assignment2._id,
    studentId: student2._id,
    content: 'SQL solutions submitted.',
    grade: null,
    submittedAt: new Date(nowMs - dayMs),
  },
]);
const quiz1 = await Quiz.create({
  courseId: dbiCourse._id,
  title: 'Relational Algebra Quiz',
  description: 'Core relational operations and normal forms.',
  startTime: new Date(nowMs - 3 * dayMs),
  endTime: new Date(nowMs + 7 * dayMs),
  timeLimit: 30,
  maxScore: 10,
  questions: [
    {
      id: 'q1',
      type: 'single_choice',
      prompt: 'Which normal form eliminates transitive dependencies?',
      options: [{ id: 'a', text: '1NF' }, { id: 'b', text: '3NF' }],
      correctOptionId: 'b',
      points: 5,
    },
    {
      id: 'q2',
      type: 'single_choice',
      prompt: 'Which SQL clause filters grouped rows?',
      options: [{ id: 'a', text: 'HAVING' }, { id: 'b', text: 'ORDER BY' }],
      correctOptionId: 'a',
      points: 5,
    },
  ],
});
await QuizAttempt.create({
  quizId: quiz1._id,
  studentId: student2._id,
  answers: [
    { questionId: 'q1', selectedOptionId: 'b' },
    { questionId: 'q2', selectedOptionId: 'a' },
  ],
  result: 8,
  startedAt: new Date(nowMs - dayMs),
  submittedAt: new Date(nowMs - dayMs),
});
const server = app.listen(5101, '127.0.0.1', () => console.log('Isolated A01 browser API ready on 5101'));
async function stop() { server.close(); await mongoose.disconnect(); await database.stop(); process.exit(0); }
process.on('SIGINT', stop); process.on('SIGTERM', stop);
