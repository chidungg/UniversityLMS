import mongoose from "mongoose";
import Course from "../models/Course.js";
import Enrollment from "../models/Enrollment.js";
import Message from "../models/Message.js";
import User from "../models/User.js";

const MAX_MESSAGE_LENGTH = 2000;
const PUBLIC_USER_FIELDS = "_id fullName email role isActive";

// ============================================================================
// SHARED COURSE-SCOPED ELIGIBILITY HELPERS
// ============================================================================

async function getStudentEligibleCoursesByInstructor(studentId) {
  const enrollments = await Enrollment.find({ studentId }).select("courseId").lean();
  if (enrollments.length === 0) return new Map();

  const enrolledCourseIds = enrollments.map((e) => e.courseId);
  const activeCourses = await Course.find({
    _id: { $in: enrolledCourseIds },
    isActive: { $ne: false },
    instructorId: { $ne: null },
  })
    .select("courseCode courseName +instructorId")
    .sort({ courseCode: 1, _id: 1 })
    .lean();

  const map = new Map();
  for (const course of activeCourses) {
    const key = String(course.instructorId);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push({
      _id: course._id,
      courseCode: course.courseCode,
      courseName: course.courseName,
    });
  }
  return map;
}

async function getInstructorEligibleCoursesByStudent(instructorId) {
  const activeCourses = await Course.find({
    instructorId,
    isActive: { $ne: false },
  })
    .select("courseCode courseName")
    .sort({ courseCode: 1, _id: 1 })
    .lean();

  if (activeCourses.length === 0) return new Map();

  const courseById = new Map(activeCourses.map((c) => [String(c._id), c]));
  const enrollments = await Enrollment.find({
    courseId: { $in: activeCourses.map((c) => c._id) },
  })
    .select("courseId studentId")
    .lean();

  const map = new Map();
  for (const enrollment of enrollments) {
    const course = courseById.get(String(enrollment.courseId));
    if (!course) continue;
    const key = String(enrollment.studentId);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push({
      _id: course._id,
      courseCode: course.courseCode,
      courseName: course.courseName,
    });
  }
  return map;
}

async function listEligibleRecipients(currentUserId, targetRole, coursesByRecipientMap) {
  const recipientIds = Array.from(coursesByRecipientMap.keys());
  if (recipientIds.length === 0) return [];

  const users = await User.find({
    _id: { $in: recipientIds, $ne: currentUserId },
    role: targetRole,
    isActive: true,
  })
    .select("_id fullName email role")
    .sort({ fullName: 1, _id: 1 })
    .lean();

  return users.map((user) => {
    const sharedCourses = coursesByRecipientMap.get(String(user._id)) || [];
    return {
      ...user,
      courses: sharedCourses.map((c) => `${c.courseCode} — ${c.courseName}`),
    };
  });
}

async function listConversationsForUser(currentUserId, searchQuery = "") {
  const messages = await Message.find({
    $or: [{ senderId: currentUserId }, { recipientId: currentUserId }],
  })
    .sort({ sentAt: 1, _id: 1 })
    .lean();

  if (messages.length === 0) return [];

  const threadMap = new Map();
  const currentIdStr = String(currentUserId);

  for (const msg of messages) {
    const counterpartId =
      String(msg.senderId) === currentIdStr
        ? String(msg.recipientId)
        : String(msg.senderId);

    if (!threadMap.has(counterpartId)) {
      threadMap.set(counterpartId, []);
    }
    threadMap.get(counterpartId).push(msg);
  }

  const counterpartIds = Array.from(threadMap.keys());
  const users = await User.find({ _id: { $in: counterpartIds } })
    .select(PUBLIC_USER_FIELDS)
    .lean();

  const userMap = new Map(users.map((u) => [String(u._id), u]));

  let conversations = counterpartIds.map((cId) => {
    const thread = threadMap.get(cId) || [];
    const user = userMap.get(cId) || {
      _id: cId,
      fullName: "User",
      role: "Unknown",
    };

    const lastMessage = thread.length > 0 ? thread[thread.length - 1] : null;
    const unreadCount = thread.filter(
      (m) => String(m.senderId) === cId && String(m.recipientId) === currentIdStr && !m.isRead
    ).length;

    return {
      user,
      lastMessage,
      unreadCount,
      messageCount: thread.length,
    };
  });

  if (typeof searchQuery === "string" && searchQuery.trim()) {
    const term = searchQuery.trim().toLowerCase();
    conversations = conversations.filter(
      (c) =>
        c.user?.fullName?.toLowerCase().includes(term) ||
        c.user?.email?.toLowerCase().includes(term) ||
        c.lastMessage?.content?.toLowerCase().includes(term)
    );
  }

  conversations.sort((a, b) => {
    const timeA = a.lastMessage ? new Date(a.lastMessage.sentAt).getTime() : 0;
    const timeB = b.lastMessage ? new Date(b.lastMessage.sentAt).getTime() : 0;
    return timeB - timeA;
  });

  return conversations;
}

async function getThreadWithUser({
  currentUserId,
  targetUserId,
  expectedCounterpartRole,
  getEligibilityMap,
}) {
  if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
    return {
      statusCode: 400,
      body: { status: "error", message: "Invalid user ID format." },
    };
  }

  if (String(targetUserId) === String(currentUserId)) {
    return {
      statusCode: 400,
      body: { status: "error", message: "Cannot load message thread with yourself." },
    };
  }

  const counterpart = await User.findById(targetUserId)
    .select(PUBLIC_USER_FIELDS)
    .lean();

  if (!counterpart) {
    return {
      statusCode: 404,
      body: { status: "error", message: "User not found." },
    };
  }

  if (counterpart.role !== expectedCounterpartRole) {
    return {
      statusCode: 403,
      body: {
        status: "error",
        message: "You do not have permission to access messages with this user.",
      },
    };
  }

  const messages = await Message.find({
    $or: [
      { senderId: currentUserId, recipientId: targetUserId },
      { senderId: targetUserId, recipientId: currentUserId },
    ],
  })
    .sort({ sentAt: 1, _id: 1 })
    .lean();

  const eligibilityMap = await getEligibilityMap(currentUserId);
  const isEligible = counterpart.isActive === true && eligibilityMap.has(String(targetUserId));

  if (!isEligible && messages.length === 0) {
    return {
      statusCode: 403,
      body: {
        status: "error",
        message: "You do not have permission to message this user.",
      },
    };
  }

  // Only update read status for incoming messages addressed to the authenticated user
  await Message.updateMany(
    { senderId: targetUserId, recipientId: currentUserId, isRead: false },
    { $set: { isRead: true } }
  );

  const sharedCourses = eligibilityMap.get(String(targetUserId)) || [];

  return {
    statusCode: 200,
    body: {
      status: "success",
      data: {
        recipient: {
          ...counterpart,
          courses: sharedCourses.map((c) => `${c.courseCode} — ${c.courseName}`),
        },
        canReply: isEligible,
        messages: messages.map((m) =>
          String(m.senderId) === String(targetUserId) && String(m.recipientId) === String(currentUserId)
            ? { ...m, isRead: true }
            : m
        ),
      },
    },
  };
}

async function sendDirectMessage({
  senderId,
  recipientId,
  content,
  expectedRecipientRole,
  getEligibilityMap,
  roleMismatchMessage,
  ineligibleMessage,
}) {
  if (!recipientId) {
    return {
      statusCode: 400,
      body: { status: "error", message: "Recipient ID is required." },
    };
  }

  if (!mongoose.Types.ObjectId.isValid(recipientId)) {
    return {
      statusCode: 400,
      body: { status: "error", message: "Invalid recipient ID format." },
    };
  }

  if (String(recipientId) === String(senderId)) {
    return {
      statusCode: 400,
      body: { status: "error", message: "You cannot send messages to yourself." },
    };
  }

  if (typeof content !== "string" || !content.trim()) {
    return {
      statusCode: 400,
      body: { status: "error", message: "Message content cannot be empty." },
    };
  }

  if (content.trim().length > MAX_MESSAGE_LENGTH) {
    return {
      statusCode: 400,
      body: {
        status: "error",
        message: `Message content exceeds maximum allowed limit of ${MAX_MESSAGE_LENGTH} characters.`,
      },
    };
  }

  const recipient = await User.findById(recipientId)
    .select(PUBLIC_USER_FIELDS)
    .lean();

  if (!recipient) {
    return {
      statusCode: 404,
      body: { status: "error", message: "Recipient user not found." },
    };
  }

  if (!recipient.isActive) {
    return {
      statusCode: 400,
      body: {
        status: "error",
        message: "Recipient account is inactive and cannot receive messages.",
      },
    };
  }

  if (recipient.role !== expectedRecipientRole) {
    return {
      statusCode: 403,
      body: { status: "error", message: roleMismatchMessage },
    };
  }

  const eligibilityMap = await getEligibilityMap(senderId);
  if (!eligibilityMap.has(String(recipientId))) {
    return {
      statusCode: 403,
      body: { status: "error", message: ineligibleMessage },
    };
  }

  const message = await Message.create({
    senderId,
    recipientId,
    content: content.trim(),
    isRead: false,
    sentAt: new Date(),
  });

  return {
    statusCode: 201,
    body: {
      status: "success",
      message: "Message sent successfully.",
      data: message,
    },
  };
}

// ============================================================================
// STUDENT MESSAGING — S04
// ============================================================================

// GET /api/student/recipients
export const getRecipients = async (req, res) => {
  try {
    const studentId = req.user._id;
    const eligibilityMap = await getStudentEligibleCoursesByInstructor(studentId);
    const recipients = await listEligibleRecipients(studentId, "Instructor", eligibilityMap);

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
    const { q = "" } = req.query;
    if (typeof q !== "string" || q.length > 200) {
      return res.status(400).json({
        status: "error",
        message: "Invalid conversation search query.",
      });
    }

    const conversations = await listConversationsForUser(req.user._id, q);
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
    const result = await getThreadWithUser({
      currentUserId: req.user._id,
      targetUserId: req.params.userId,
      expectedCounterpartRole: "Instructor",
      getEligibilityMap: getStudentEligibleCoursesByInstructor,
    });
    return res.status(result.statusCode).json(result.body);
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
    const { recipientId, content } = req.body ?? {};
    const result = await sendDirectMessage({
      senderId: req.user._id,
      recipientId,
      content,
      expectedRecipientRole: "Instructor",
      getEligibilityMap: getStudentEligibleCoursesByInstructor,
      roleMismatchMessage: "Students can only send messages to authorized instructors.",
      ineligibleMessage: "You can only message instructors assigned to your active enrolled courses.",
    });
    return res.status(result.statusCode).json(result.body);
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Failed to send message: " + error.message,
    });
  }
};

// ============================================================================
// INSTRUCTOR MESSAGING — I06
// ============================================================================

// GET /api/instructor/recipients
export const getInstructorRecipients = async (req, res) => {
  try {
    const instructorId = req.user._id;
    const eligibilityMap = await getInstructorEligibleCoursesByStudent(instructorId);
    const recipients = await listEligibleRecipients(instructorId, "Student", eligibilityMap);

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

// GET /api/instructor/messages/conversations
export const getInstructorConversations = async (req, res) => {
  try {
    const { q = "" } = req.query;
    if (typeof q !== "string" || q.length > 200) {
      return res.status(400).json({
        status: "error",
        message: "Invalid conversation search query.",
      });
    }

    const conversations = await listConversationsForUser(req.user._id, q);
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

// GET /api/instructor/messages/:userId
export const getInstructorMessagesWithUser = async (req, res) => {
  try {
    const result = await getThreadWithUser({
      currentUserId: req.user._id,
      targetUserId: req.params.userId,
      expectedCounterpartRole: "Student",
      getEligibilityMap: getInstructorEligibleCoursesByStudent,
    });
    return res.status(result.statusCode).json(result.body);
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Failed to load messages: " + error.message,
    });
  }
};

// POST /api/instructor/messages
export const sendInstructorMessage = async (req, res) => {
  try {
    const { recipientId, content } = req.body ?? {};
    const result = await sendDirectMessage({
      senderId: req.user._id,
      recipientId,
      content,
      expectedRecipientRole: "Student",
      getEligibilityMap: getInstructorEligibleCoursesByStudent,
      roleMismatchMessage: "Instructors can only send messages to enrolled students.",
      ineligibleMessage: "You can only message students enrolled in your active assigned courses.",
    });
    return res.status(result.statusCode).json(result.body);
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Failed to send message: " + error.message,
    });
  }
};
