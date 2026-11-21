import mongoose from "mongoose";
import Message from "../models/Message.js";
import User from "../models/User.js";

// GET /api/student/recipients
export const getRecipients = async (req, res) => {
  try {
    const studentId = req.user._id;

    // Available recipients: Instructors (and Administrators if needed) who are active
    const recipients = await User.find({
      _id: { $ne: studentId },
      role: { $in: ["Instructor", "Administrator"] },
      isActive: true,
    })
      .select("_id fullName email role")
      .sort({ fullName: 1 })
      .lean();

    return res.status(200).json({
      status: "success",
      data: recipients,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Failed to load recipients: " + error.message,
    });
  }
};

// GET /api/student/messages/conversations
export const getConversations = async (req, res) => {
  try {
    const studentId = req.user._id;

    // Find all messages involving current student
    const messages = await Message.find({
      $or: [{ senderId: studentId }, { recipientId: studentId }],
    })
      .sort({ sentAt: 1 })
      .lean();

    if (messages.length === 0) {
      return res.status(200).json({
        status: "success",
        data: [],
      });
    }

    // Map by counterpart user ID
    const threadMap = new Map();
    messages.forEach((msg) => {
      const counterpartId =
        msg.senderId.toString() === studentId.toString()
          ? msg.recipientId.toString()
          : msg.senderId.toString();

      if (!threadMap.has(counterpartId)) {
        threadMap.set(counterpartId, []);
      }
      threadMap.get(counterpartId).push(msg);
    });

    // Populate user info for all counterparts
    const counterpartIds = Array.from(threadMap.keys());
    const users = await User.find({
      _id: { $in: counterpartIds },
    })
      .select("_id fullName email role isActive")
      .lean();

    const userMap = new Map();
    users.forEach((u) => userMap.set(u._id.toString(), u));

    const conversations = counterpartIds.map((cId) => {
      const thread = threadMap.get(cId) || [];
      const user = userMap.get(cId) || {
        _id: cId,
        fullName: "User",
        role: "Unknown",
      };

      const lastMessage = thread.length > 0 ? thread[thread.length - 1] : null;
      const unreadCount = thread.filter(
        (m) => m.senderId.toString() === cId && !m.isRead
      ).length;

      return {
        user,
        lastMessage,
        unreadCount,
        messageCount: thread.length,
      };
    });

    // Sort by latest message timestamp descending
    conversations.sort((a, b) => {
      const timeA = a.lastMessage ? new Date(a.lastMessage.sentAt).getTime() : 0;
      const timeB = b.lastMessage ? new Date(b.lastMessage.sentAt).getTime() : 0;
      return timeB - timeA;
    });

    return res.status(200).json({
      status: "success",
      data: conversations,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Failed to load conversations: " + error.message,
    });
  }
};

// GET /api/student/messages/:userId
export const getMessagesWithUser = async (req, res) => {
  try {
    const studentId = req.user._id;
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid user ID format.",
      });
    }

    if (userId.toString() === studentId.toString()) {
      return res.status(400).json({
        status: "error",
        message: "Cannot load message thread with yourself.",
      });
    }

    const counterpart = await User.findById(userId)
      .select("_id fullName email role isActive")
      .lean();

    if (!counterpart) {
      return res.status(404).json({
        status: "error",
        message: "User not found.",
      });
    }

    // Retrieve full thread between student and this user
    const messages = await Message.find({
      $or: [
        { senderId: studentId, recipientId: userId },
        { senderId: userId, recipientId: studentId },
      ],
    })
      .sort({ sentAt: 1 })
      .lean();

    // Mark incoming messages from this user as read
    await Message.updateMany(
      { senderId: userId, recipientId: studentId, isRead: false },
      { $set: { isRead: true } }
    );

    return res.status(200).json({
      status: "success",
      data: {
        recipient: counterpart,
        messages: messages.map((m) => {
          if (m.senderId.toString() === userId.toString()) {
            return { ...m, isRead: true };
          }
          return m;
        }),
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Failed to load messages: " + error.message,
    });
  }
};

// POST /api/student/messages
export const sendMessage = async (req, res) => {
  try {
    const studentId = req.user._id;
    const { recipientId, content } = req.body;

    if (!recipientId) {
      return res.status(400).json({
        status: "error",
        message: "Recipient ID is required.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(recipientId)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid recipient ID format.",
      });
    }

    if (recipientId.toString() === studentId.toString()) {
      return res.status(400).json({
        status: "error",
        message: "You cannot send messages to yourself.",
      });
    }

    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({
        status: "error",
        message: "Recipient user not found.",
      });
    }

    if (!recipient.isActive) {
      return res.status(400).json({
        status: "error",
        message: "Recipient account is inactive and cannot receive messages.",
      });
    }

    if (!content || typeof content !== "string" || !content.trim()) {
      return res.status(400).json({
        status: "error",
        message: "Message content cannot be empty.",
      });
    }

    if (content.trim().length > 2000) {
      return res.status(400).json({
        status: "error",
        message: "Message content exceeds maximum allowed limit of 2000 characters.",
      });
    }

    const message = new Message({
      senderId: studentId,
      recipientId,
      content: content.trim(),
      isRead: false,
      sentAt: new Date(),
    });

    await message.save();

    return res.status(201).json({
      status: "success",
      message: "Message sent successfully.",
      data: message,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Failed to send message: " + error.message,
    });
  }
};
