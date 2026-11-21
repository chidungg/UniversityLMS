import mongoose from "mongoose";

const { Schema } = mongoose;

const announcementReadSchema = new Schema(
  {
    announcementId: { type: Schema.Types.ObjectId, ref: "Announcement", required: true },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    readAt: { type: Date, default: Date.now },
  },
  { collection: "announcement_reads", autoCreate: false, autoIndex: false }
);

announcementReadSchema.index({ announcementId: 1, studentId: 1 }, { unique: true, name: "uniq_announcement_student" });

const AnnouncementRead = mongoose.model("AnnouncementRead", announcementReadSchema);
export default AnnouncementRead;
