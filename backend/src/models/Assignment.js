import mongoose from "mongoose";

const { Schema } = mongoose;

const assignmentSchema = new Schema(
  {
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    title: { type: String, required: true, trim: true },
    description: String,
    createdAt: { type: Date, default: Date.now },
    dueDate: { type: Date, required: true },
    maxScore: { type: Number, default: 10, min: 0 },
  },
  { collection: "assignments", autoCreate: false, autoIndex: false }
);

assignmentSchema.index({ courseId: 1, dueDate: 1 }, { name: "by_course_due_date" });

const Assignment = mongoose.model("Assignment", assignmentSchema);
export default Assignment;
