import mongoose from "mongoose";

const { Schema } = mongoose;

const announcementSchema = new Schema(
  {
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "announcements", autoCreate: false, autoIndex: false }
);

announcementSchema.index({ courseId: 1, createdAt: -1 }, { name: "by_course_recent" });

const Announcement = mongoose.model("Announcement", announcementSchema);
export default Announcement;
