import mongoose from "mongoose";
import Announcement from "../models/Announcement.js";
import AnnouncementRead from "../models/AnnouncementRead.js";
import Course from "../models/Course.js";
import { isStudentEnrolled, getEnrolledCourseIds } from "./courseController.js";
import { escapeRegex } from "../utils/helpers.js";

// GET /api/student/announcements
export const getAnnouncements = async (req, res) => {
  try {
    const studentId = req.user._id;
    const { courseId, q } = req.query;

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
      isActive: true,
    }).select("_id");
    const activeCourseIds = activeCourses.map((c) => c._id);

    if (activeCourseIds.length === 0) {
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
      .populate("courseId", "courseCode courseName isActive")
      .sort({ createdAt: -1 })
      .lean();

    const announcementIds = announcements.map((a) => a._id);
    const readRecords = await AnnouncementRead.find({
      studentId,
      announcementId: { $in: announcementIds },
    }).select("announcementId");

    const readSet = new Set(readRecords.map((r) => r.announcementId.toString()));

    const enriched = announcements.map((a) => ({
      ...a,
      isRead: readSet.has(a._id.toString()),
    }));

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

    const announcement = await Announcement.findById(announcementId)
      .populate("courseId", "courseCode courseName isActive")
      .lean();

    if (!announcement) {
      return res.status(404).json({
        status: "error",
        message: "Announcement not found.",
      });
    }

    if (!announcement.courseId) {
      return res.status(404).json({
        status: "error",
        message: "Associated course not found.",
      });
    }

    const enrolled = await isStudentEnrolled(studentId, announcement.courseId._id);
    if (!enrolled) {
      return res.status(403).json({
        status: "error",
        message: "You do not have permission to access this announcement.",
      });
    }

    // Record read status for this student
    try {
      await AnnouncementRead.updateOne(
        { announcementId: announcement._id, studentId },
        { $setOnInsert: { readAt: new Date() } },
        { upsert: true }
      );
    } catch {}

    return res.status(200).json({
      status: "success",
      data: {
        ...announcement,
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
