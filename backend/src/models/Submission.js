import mongoose from "mongoose";

const { Schema } = mongoose;

const submissionSchema = new Schema(
  {
    assignmentId: { type: Schema.Types.ObjectId, ref: "Assignment", required: true },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, default: "" },
    fileUrl: { type: String, default: null },
    fileName: { type: String, default: null },
    fileSize: { type: Number, default: null },
    grade: { type: Number, default: null },
    feedback: { type: String, default: null },
    submittedAt: { type: Date, default: Date.now },
  },
  { collection: "submissions", autoCreate: false, autoIndex: false }
);

submissionSchema.index({ assignmentId: 1, studentId: 1 }, { name: "by_assignment_student" });

const Submission = mongoose.model("Submission", submissionSchema);
export default Submission;
