/**
 * Seed Quiz Data for University LMS Development & Testing
 *
 * Idempotent seed script: uses $setOnInsert to create sample quizzes without
 * overwriting or mutating any existing records in MongoDB.
 *
 * Usage:
 *   node --env-file=.env src/scripts/seedQuizData.js
 */

import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import Course from "../models/Course.js";
import Quiz from "../models/Quiz.js";

async function seedQuizzes() {
  await connectDB();
  console.log("Checking and seeding sample quiz data...");

  const courses = await Course.find({ isActive: true }).lean();
  if (courses.length === 0) {
    console.log("No active courses found. Aborting quiz seed.");
    await mongoose.disconnect();
    return;
  }

  const courseMap = new Map();
  courses.forEach((c) => courseMap.set(c.courseCode, c._id));

  const prg101Id = courseMap.get("DEMO-PRG101") || courses[0]._id;
  const db201Id = courseMap.get("DEMO-DB201") || courses[0]._id;
  const web301Id = courseMap.get("DEMO-WEB301") || courses[0]._id;

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const sampleQuizzes = [
    {
      courseId: prg101Id,
      title: "Quiz 2 — Control Flow and Iteration",
      description: "Evaluates condition branching, for/while loops, and nested logic constructs.",
      startTime: new Date(now - 2 * dayMs), // Started 2 days ago
      endTime: new Date(now + 5 * dayMs),   // Closes in 5 days (AVAILABLE)
      timeLimit: 20,
      maxScore: 6,
      questions: [
        {
          id: "Q1",
          type: "single_choice",
          prompt: "Which statement skips the current loop iteration and proceeds to the next?",
          options: [
            { id: "A", text: "break" },
            { id: "B", text: "continue" },
            { id: "C", text: "return" },
            { id: "D", text: "exit" },
          ],
          correctOptionId: "B",
          points: 2,
          explanation: "'continue' terminates execution of statements in the current iteration and continues with the next.",
        },
        {
          id: "Q2",
          type: "single_choice",
          prompt: "What will a while loop do if its initial condition evaluates to false?",
          options: [
            { id: "A", text: "Execute once" },
            { id: "B", text: "Never execute the loop body" },
            { id: "C", text: "Throw an error" },
            { id: "D", text: "Execute indefinitely" },
          ],
          correctOptionId: "B",
          points: 2,
          explanation: "A while loop tests the condition before executing the body; if false, it never executes.",
        },
        {
          id: "Q3",
          type: "single_choice",
          prompt: "Which construct is best suited to match a variable against multiple discrete constant values?",
          options: [
            { id: "A", text: "switch" },
            { id: "B", text: "while" },
            { id: "C", text: "try-catch" },
            { id: "D", text: "ternary" },
          ],
          correctOptionId: "A",
          points: 2,
          explanation: "The switch statement evaluates an expression and matches it to a case clause.",
        },
      ],
    },
    {
      courseId: db201Id,
      title: "Quiz 2 — SQL Joins and Aggregation",
      description: "Upcoming assessment on INNER/OUTER JOINs and GROUP BY clauses.",
      startTime: new Date(now + 3 * dayMs), // Starts in 3 days (UPCOMING)
      endTime: new Date(now + 10 * dayMs),
      timeLimit: 25,
      maxScore: 4,
      questions: [
        {
          id: "Q1",
          type: "single_choice",
          prompt: "Which join returns all records from the left table and matched records from the right?",
          options: [
            { id: "A", text: "INNER JOIN" },
            { id: "B", text: "LEFT JOIN" },
            { id: "C", text: "CROSS JOIN" },
            { id: "D", text: "RIGHT JOIN" },
          ],
          correctOptionId: "B",
          points: 2,
          explanation: "LEFT JOIN returns all rows from the left table and matched records from the right table.",
        },
        {
          id: "Q2",
          type: "single_choice",
          prompt: "Which clause is used to filter groups created by GROUP BY?",
          options: [
            { id: "A", text: "WHERE" },
            { id: "B", text: "HAVING" },
            { id: "C", text: "ORDER BY" },
            { id: "D", text: "LIMIT" },
          ],
          correctOptionId: "B",
          points: 2,
          explanation: "HAVING is applied after grouping to filter aggregated results.",
        },
      ],
    },
    {
      courseId: web301Id,
      title: "Quiz 1 — HTTP Protocol and RESTful Concepts",
      description: "Past assessment evaluating knowledge of HTTP methods and status codes.",
      startTime: new Date(now - 14 * dayMs), // Ended 7 days ago (EXPIRED)
      endTime: new Date(now - 7 * dayMs),
      timeLimit: 15,
      maxScore: 4,
      questions: [
        {
          id: "Q1",
          type: "single_choice",
          prompt: "Which HTTP status code signifies that a requested resource was created successfully?",
          options: [
            { id: "A", text: "200 OK" },
            { id: "B", text: "201 Created" },
            { id: "C", text: "204 No Content" },
            { id: "D", text: "301 Moved" },
          ],
          correctOptionId: "B",
          points: 2,
          explanation: "201 Created indicates the request has been fulfilled and a new resource has been created.",
        },
        {
          id: "Q2",
          type: "single_choice",
          prompt: "Which HTTP method should be used to partially update an existing resource?",
          options: [
            { id: "A", text: "GET" },
            { id: "B", text: "POST" },
            { id: "C", text: "PATCH" },
            { id: "D", text: "PUT" },
          ],
          correctOptionId: "C",
          points: 2,
          explanation: "PATCH applies partial modifications to a resource.",
        },
      ],
    },
  ];

  let insertedCount = 0;
  for (const qData of sampleQuizzes) {
    const res = await Quiz.updateOne(
      { courseId: qData.courseId, title: qData.title },
      { $setOnInsert: qData },
      { upsert: true }
    );
    if (res.upsertedCount > 0) {
      insertedCount++;
    }
  }

  console.log(`Quiz seed completed. ${insertedCount} new sample quizzes inserted.`);
  await mongoose.disconnect();
}

// Run directly
seedQuizzes().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
