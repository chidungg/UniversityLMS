import mongoose from "mongoose";

const { Schema } = mongoose;

const messageSchema = new Schema(
  {
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    recipientId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true, trim: true },
    isRead: { type: Boolean, default: false },
    sentAt: { type: Date, default: Date.now },
  },
  { collection: "messages", autoCreate: false, autoIndex: false }
);

messageSchema.index({ senderId: 1, recipientId: 1, sentAt: -1 }, { name: "by_participants_time" });
messageSchema.index({ recipientId: 1, isRead: 1 }, { name: "by_recipient_unread" });

const Message = mongoose.model("Message", messageSchema);
export default Message;
