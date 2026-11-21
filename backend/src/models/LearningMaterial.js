import mongoose from "mongoose";

const { Schema } = mongoose;

const learningMaterialSchema = new Schema(
  {
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    title: { type: String, required: true, trim: true },
    description: String,
    type: { type: String, enum: ["LectureNote", "Video", "Attachment"], required: true },
    fileUrl: { type: String, default: null },
    uploadedAt: { type: Date, default: Date.now },
  },
  { collection: "learningmaterials", autoCreate: false, autoIndex: false }
);

learningMaterialSchema.index({ courseId: 1, uploadedAt: -1 }, { name: "by_course_recent" });

const LearningMaterial = mongoose.model("LearningMaterial", learningMaterialSchema);
export default LearningMaterial;
