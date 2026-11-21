import mongoose from "mongoose";

const { Schema } = mongoose;

const courseSchema = new Schema(
  {
    courseCode: { type: String, required: true, trim: true },
    courseName: { type: String, required: true, trim: true },
    description: String,
    isActive: { type: Boolean, default: true },
  },
  { collection: "courses", autoCreate: false, autoIndex: false }
);

courseSchema.index({ courseCode: 1 }, { unique: true, name: "uniq_course_code" });

const Course = mongoose.model("Course", courseSchema);
export default Course;
