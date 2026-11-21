import mongoose from "mongoose";

const { Schema } = mongoose;

const questionOptionSchema = new Schema(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
  },
  { _id: false }
);

const questionSchema = new Schema(
  {
    id: { type: String, required: true },
    type: { type: String, default: "single_choice" },
    prompt: { type: String, required: true },
    options: [questionOptionSchema],
    correctOptionId: { type: String, required: true },
    points: { type: Number, default: 2 },
    explanation: { type: String, default: null },
  },
  { _id: false }
);

const quizSchema = new Schema(
  {
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    title: { type: String, required: true, trim: true },
    description: String,
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    timeLimit: { type: Number, required: true, min: 1 }, // in minutes
    maxScore: { type: Number, default: 10 },
    questions: [questionSchema],
  },
  { collection: "quizzes", autoCreate: false, autoIndex: false }
);

quizSchema.index({ courseId: 1, startTime: 1, endTime: 1 }, { name: "by_course_time" });

const Quiz = mongoose.model("Quiz", quizSchema);
export default Quiz;
