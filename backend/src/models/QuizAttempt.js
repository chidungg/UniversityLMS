import mongoose from "mongoose";

const { Schema } = mongoose;

const answerSchema = new Schema(
  {
    questionId: { type: String, required: true },
    selectedOptionId: { type: String, default: null },
  },
  { _id: false }
);

const quizAttemptSchema = new Schema(
  {
    quizId: { type: Schema.Types.ObjectId, ref: "Quiz", required: true },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    answers: [answerSchema],
    result: { type: Number, default: null }, // total score / points earned
    startedAt: { type: Date, default: Date.now },
    submittedAt: { type: Date, default: null },
  },
  { collection: "quizattempts", autoCreate: false, autoIndex: false }
);

quizAttemptSchema.index({ quizId: 1, studentId: 1 }, { name: "by_quiz_student" });

const QuizAttempt = mongoose.model("QuizAttempt", quizAttemptSchema);
export default QuizAttempt;
