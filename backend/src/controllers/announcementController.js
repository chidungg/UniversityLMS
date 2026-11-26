import mongoose from "mongoose";
import Announcement from "../models/Announcement.js";
import AnnouncementRead from "../models/AnnouncementRead.js";
import Course from "../models/Course.js";
import User from "../models/User.js";
import { isStudentEnrolled, getEnrolledCourseIds } from "./courseController.js";
import { escapeRegex } from "../utils/helpers.js";

const PUBLIC_COURSE_FIELDS = "courseCode courseName isActive";

function toPublicCourse(courseDoc) {
  if (!courseDoc) return null;
  return {
    _id: courseDoc._id,
    courseCode: courseDoc.courseCode,
    courseName: courseDoc.courseName,
    isActive: courseDoc.isActive,
  };
}

async function resolveAuthorsByCourse(courses) {
  const instructorIds = [
    ...new Set(
      courses
        .map((c) => c.instructorId)
        .filter(Boolean)
        .map((id) => String(id))
    ),
  ];

  if (instructorIds.length === 0) return new Map();

  const instructors = await User.find({ _id: { $in: instructorIds } })
    .select("_id fullName")
    .lean();

  const instructorMap = new Map(
    instructors.map((inst) => [String(inst._id), { _id: inst._id, fullName: inst.fullName }])
  );

  const authorByCourse = new Map();
  for (const course of courses) {
    if (course.instructorId) {
      const author = instructorMap.get(String(course.instructorId)) || null;
      if (author) authorByCourse.set(String(course._id), author);
    }
  }
  return authorByCourse;
}

// ============================================================================
// STUDENT COMMUNICATION — S04 ANNOUNCEMENTS
// ============================================================================

// GET /api/student/announcements
export const getAnnouncements = async (req, res) => {
  try {
    const studentId = req.user._id;
    const { courseId, q } = req.query;

    if (q !== undefined && (typeof q !== "string" || q.length > 200)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid search query.",
      });
    }

    const enrolledCourseIds = await getEnrolledCourseIds(studentId);
    if (enrolledCourseIds.length === 0) {
      return res.status(200).json({
        status: "success",
        data: [],
      });
    }

    // Only include active courses
    const activeCourses = await Course.find({
      _id: { $in: enrolledCourseIds },
      isActive: { $ne: false },
    })
      .select(`${PUBLIC_COURSE_FIELDS} +instructorId`)
      .lean();
    const activeCourseIds = activeCourses.map((c) => c._id);

    if (activeCourseIds.length === 0) {
      if (courseId) {
        if (!mongoose.Types.ObjectId.isValid(courseId)) {
          return res.status(400).json({
            status: "error",
            message: "Invalid course ID format.",
          });
        }
        return res.status(403).json({
          status: "error",
          message: "You are not enrolled in the specified course or it is inactive.",
        });
      }
      return res.status(200).json({
        status: "success",
        data: [],
      });
    }

    const query = { courseId: { $in: activeCourseIds } };

    if (courseId) {
      if (!mongoose.Types.ObjectId.isValid(courseId)) {
        return res.status(400).json({
          status: "error",
          message: "Invalid course ID format.",
        });
      }
      if (!activeCourseIds.some((id) => id.toString() === courseId)) {
        return res.status(403).json({
          status: "error",
          message: "You are not enrolled in the specified course or it is inactive.",
        });
      }
      query.courseId = courseId;
    }

    if (q && q.trim()) {
      const searchRegex = new RegExp(escapeRegex(q.trim()), "i");
      query.$or = [{ title: searchRegex }, { content: searchRegex }];
    }

    const announcements = await Announcement.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .lean();

    const courseMap = new Map(activeCourses.map((c) => [String(c._id), c]));
    const authorByCourse = await resolveAuthorsByCourse(activeCourses);

    const announcementIds = announcements.map((a) => a._id);
    const readRecords = await AnnouncementRead.find({
      studentId,
      announcementId: { $in: announcementIds },
    }).select("announcementId");

    const readSet = new Set(readRecords.map((r) => r.announcementId.toString()));

    const enriched = announcements.map((a) => {
      const courseDoc = courseMap.get(String(a.courseId));
      return {
        ...a,
        courseId: toPublicCourse(courseDoc),
        author: authorByCourse.get(String(a.courseId)) || null,
        isRead: readSet.has(a._id.toString()),
      };
    });

    return res.status(200).json({
      status: "success",
      data: enriched,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Failed to load announcements: " + error.message,
    });
  }
};

// GET /api/student/announcements/:announcementId
export const getAnnouncementDetails = async (req, res) => {
  try {
    const studentId = req.user._id;
    const { announcementId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(announcementId)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid announcement ID format.",
      });
    }

    const announcement = await Announcement.findById(announcementId).lean();

    if (!announcement) {
      return res.status(404).json({
        status: "error",
        message: "Announcement not found.",
      });
    }

    const course = await Course.findById(announcement.courseId)
      .select(`${PUBLIC_COURSE_FIELDS} +instructorId`)
      .lean();

    if (!course) {
      return res.status(404).json({
        status: "error",
        message: "Associated course not found.",
      });
    }

    const enrolled = await isStudentEnrolled(studentId, course._id);
    if (!enrolled) {
      return res.status(403).json({
        status: "error",
        message: "You do not have permission to access this announcement.",
      });
    }

    if (course.isActive === false) {
      return res.status(403).json({
        status: "error",
        message: "You do not have permission to access announcements from an inactive course.",
      });
    }

    // Record read status for this student
    try {
      await AnnouncementRead.updateOne(
        { announcementId: announcement._id, studentId },
        { $setOnInsert: { readAt: new Date() } },
        { upsert: true }
      );
    } catch {
      // ignore duplicate key race condition on upsert
    }

    const authorByCourse = await resolveAuthorsByCourse([course]);

    return res.status(200).json({
      status: "success",
      data: {
        ...announcement,
        courseId: toPublicCourse(course),
        author: authorByCourse.get(String(course._id)) || null,
        isRead: true,
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Failed to load announcement details: " + error.message,
    });
  }
};

// ============================================================================
// INSTRUCTOR COMMUNICATION — I06 ANNOUNCEMENTS
// ============================================================================

// GET /api/instructor/announcements
export const getInstructorAnnouncements = async (req, res) => {
  try {
    const instructorId = req.user._id;
    const { courseId, q } = req.query;

    if (q !== undefined && (typeof q !== "string" || q.length > 200)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid announcement search query.",
      });
    }

    const assignedCourses = await Course.find({ instructorId })
      .select(PUBLIC_COURSE_FIELDS)
      .sort({ courseCode: 1, _id: 1 })
      .lean();

    const courseMap = new Map(assignedCourses.map((c) => [String(c._id), c]));
    let targetCourseIds = assignedCourses.map((c) => c._id);

    if (courseId) {
      if (!mongoose.Types.ObjectId.isValid(courseId)) {
        return res.status(400).json({
          status: "error",
          message: "Invalid course ID format.",
        });
      }

      if (!courseMap.has(String(courseId))) {
        const existingCourse = await Course.findById(courseId).select("_id").lean();
        if (!existingCourse) {
          return res.status(404).json({
            status: "error",
            message: "Course not found.",
          });
        }
        return res.status(403).json({
          status: "error",
          message: "You do not have permission to view announcements for this course.",
        });
      }

      targetCourseIds = [new mongoose.Types.ObjectId(courseId)];
    }

    if (targetCourseIds.length === 0) {
      return res.status(200).json({
        status: "success",
        data: [],
      });
    }

    const query = { courseId: { $in: targetCourseIds } };
    if (q && q.trim()) {
      const searchRegex = new RegExp(escapeRegex(q.trim()), "i");
      query.$or = [{ title: searchRegex }, { content: searchRegex }];
    }

    const announcements = await Announcement.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .lean();

    const author = { _id: req.user._id, fullName: req.user.fullName };

    const enriched = announcements.map((a) => ({
      ...a,
      courseId: toPublicCourse(courseMap.get(String(a.courseId))),
      author,
    }));

    return res.status(200).json({
      status: "success",
      data: enriched,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Failed to load instructor announcements: " + error.message,
    });
  }
};

// GET /api/instructor/announcements/:announcementId
export const getInstructorAnnouncementDetails = async (req, res) => {
  try {
    const instructorId = req.user._id;
    const { announcementId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(announcementId)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid announcement ID format.",
      });
    }

    const announcement = await Announcement.findById(announcementId).lean();
    if (!announcement) {
      return res.status(404).json({
        status: "error",
        message: "Announcement not found.",
      });
    }

    const course = await Course.findById(announcement.courseId)
      .select(`${PUBLIC_COURSE_FIELDS} +instructorId`)
      .lean();

    if (!course) {
      return res.status(404).json({
        status: "error",
        message: "Associated course not found.",
      });
    }

    if (!course.instructorId || String(course.instructorId) !== String(instructorId)) {
      return res.status(403).json({
        status: "error",
        message: "You do not have permission to access this announcement.",
      });
    }

    return res.status(200).json({
      status: "success",
      data: {
        ...announcement,
        courseId: toPublicCourse(course),
        author: { _id: req.user._id, fullName: req.user.fullName },
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Failed to load announcement details: " + error.message,
    });
  }
};

// POST /api/instructor/courses/:courseId/announcements
export const publishInstructorAnnouncement = async (req, res) => {
  try {
    const instructorId = req.user._id;
    const { courseId } = req.params;
    const { title, content } = req.body ?? {};

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid course ID format.",
      });
    }

    const course = await Course.findById(courseId)
      .select(`${PUBLIC_COURSE_FIELDS} +instructorId`)
      .lean();

    if (!course) {
      return res.status(404).json({
        status: "error",
        message: "Course not found.",
      });
    }

    if (!course.instructorId || String(course.instructorId) !== String(instructorId)) {
      return res.status(403).json({
        status: "error",
        message: "You are not assigned to this course and cannot publish announcements for it.",
      });
    }

    if (course.isActive === false) {
      return res.status(409).json({
        status: "error",
        code: "COURSE_INACTIVE",
        message: "Cannot publish announcements for an inactive course.",
      });
    }

    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({
        status: "error",
        message: "Announcement title is required.",
      });
    }

    if (title.trim().length > 200) {
      return res.status(400).json({
        status: "error",
        message: "Announcement title exceeds maximum allowed length of 200 characters.",
      });
    }

    if (typeof content !== "string" || !content.trim()) {
      return res.status(400).json({
        status: "error",
        message: "Announcement content cannot be empty.",
      });
    }

    if (content.trim().length > 5000) {
      return res.status(400).json({
        status: "error",
        message: "Announcement content exceeds maximum allowed length of 5000 characters.",
      });
    }

    const announcement = await Announcement.create({
      courseId: course._id,
      title: title.trim(),
      content: content.trim(),
      createdAt: new Date(),
    });

    return res.status(201).json({
      status: "success",
      message: "Announcement published successfully.",
      data: {
        ...announcement.toObject(),
        courseId: toPublicCourse(course),
        author: { _id: req.user._id, fullName: req.user.fullName },
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Failed to publish announcement: " + error.message,
    });
  }
};
