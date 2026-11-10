import mongoose from "mongoose";

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    fullName: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, required: true, enum: ["Administrator", "Instructor", "Student"] },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "users", autoCreate: false, autoIndex: false }
);

userSchema.index({ email: 1 }, { unique: true, name: "uniq_user_email" });

const User = mongoose.model("User", userSchema);
export default User;
