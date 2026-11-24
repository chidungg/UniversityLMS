import mongoose from "mongoose";
import { authError } from "../config/auth.js";
import Quiz from "../models/Quiz.js";

export function withQuizWrite(quizId, write) {
  return mongoose.connection.transaction(async (session) => {
    // Student attempt writes and Instructor edits share a write lock on the quiz document.
    const quiz = await Quiz.findOneAndUpdate(
      { _id: quizId }, { $inc: { __v: 1 } }, { session, returnDocument: "after" }
    ).lean();
    if (!quiz) throw authError(404, "QUIZ_NOT_FOUND", "Quiz not found.");
    return write(quiz, session);
  });
}
