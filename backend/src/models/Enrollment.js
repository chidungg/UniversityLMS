import mongoose from "mongoose";

const { Schema } = mongoose;

const enrollmentSchema = new Schema(
  {
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    enrolledAt: { type: Date, default: Date.now },
  },
  { collection: "enrollments", autoCreate: false, autoIndex: false }
);

enrollmentSchema.index({ courseId: 1, studentId: 1 }, { unique: true, name: "uniq_course_student" });

const Enrollment = mongoose.model("Enrollment", enrollmentSchema);
export default Enrollment;
