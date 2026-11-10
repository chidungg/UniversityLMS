import mongoose from "mongoose";
import Course from "../models/Course.js";
import Enrollment from "../models/Enrollment.js";
import LearningMaterial from "../models/LearningMaterial.js";
import Assignment from "../models/Assignment.js";
import Submission from "../models/Submission.js";
import Announcement from "../models/Announcement.js";

// Helper: check if student is enrolled in a course
export const isStudentEnrolled = async (studentId, courseId) => {
  const enrollment = await Enrollment.findOne({ studentId, courseId });
  return !!enrollment;
};

// Helper: get all enrolled course IDs for a student
export const getEnrolledCourseIds = async (studentId) => {
  const enrollments = await Enrollment.find({ studentId }).select("courseId");
  return enrollments.map((e) => e.courseId);
};

// ST00: Student Dashboard
export const getDashboard = async (req, res) => {
  try {
    const studentId = req.user._id;
    const courseIds = await getEnrolledCourseIds(studentId);

    if (courseIds.length === 0) {
      return res.status(200).json({
        status: "success",
        data: {
          courses: [],
          upcomingAssignments: [],
          recentAnnouncements: [],
          stats: {
            totalCourses: 0,
            pendingAssignments: 0,
            submittedAssignments: 0,
          },
        },
      });
    }

    // Fetch enrolled courses
    const courses = await Course.find({ _id: { $in: courseIds }, isActive: true }).lean();

    // Attach counts
    const coursesWithCounts = await Promise.all(
      courses.map(async (course) => {
        const materialCount = await LearningMaterial.countDocuments({ courseId: course._id });
        const assignmentCount = await Assignment.countDocuments({ courseId: course._id });
        return {
          ...course,
          materialCount,
          assignmentCount,
        };
      })
    );

    // Fetch assignments for these courses
    const allAssignments = await Assignment.find({ courseId: { $in: courseIds } })
      .populate("courseId", "courseCode courseName")
      .sort({ dueDate: 1 })
      .lean();

    // Fetch all submissions by this student for these assignments
    const assignmentIds = allAssignments.map((a) => a._id);
    const submissions = await Submission.find({
      assignmentId: { $in: assignmentIds },
      studentId,
    }).lean();

    const submissionMap = new Map();
    submissions.forEach((sub) => {
      submissionMap.set(sub.assignmentId.toString(), sub);
    });

    const now = new Date();
    const enrichedAssignments = allAssignments.map((assignment) => {
      const submission = submissionMap.get(assignment._id.toString()) || null;
      let status = "PENDING";
      if (submission) {
        status = submission.grade !== null && submission.grade !== undefined ? "GRADED" : "SUBMITTED";
      } else if (new Date(assignment.dueDate) < now) {
        status = "OVERDUE";
      }
      return {
        ...assignment,
        submission,
        status,
      };
    });

    const upcomingAssignments = enrichedAssignments
      .filter((a) => a.status === "PENDING" || a.status === "SUBMITTED")
      .slice(0, 5);

    const pendingCount = enrichedAssignments.filter((a) => a.status === "PENDING").length;
    const submittedCount = enrichedAssignments.filter(
      (a) => a.status === "SUBMITTED" || a.status === "GRADED"
    ).length;

    // Fetch recent announcements
    const recentAnnouncements = await Announcement.find({ courseId: { $in: courseIds } })
      .populate("courseId", "courseCode courseName")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    return res.status(200).json({
      status: "success",
      data: {
        courses: coursesWithCounts,
        upcomingAssignments,
        recentAnnouncements,
        stats: {
          totalCourses: coursesWithCounts.length,
          pendingAssignments: pendingCount,
          submittedAssignments: submittedCount,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Failed to load dashboard data: " + error.message,
    });
  }
};

// ST01: My Courses
export const getAvailableCourses = async (req, res) => {
  try {
    const studentId = req.user._id;
    const { q, status } = req.query;

    const courseIds = await getEnrolledCourseIds(studentId);
    if (courseIds.length === 0) {
      return res.status(200).json({
        status: "success",
        data: [],
      });
    }

    const query = { _id: { $in: courseIds } };
    if (status === "inactive") {
      query.isActive = false;
    } else if (status === "all") {
      // no isActive filter
    } else {
      query.isActive = true;
    }

    if (q && q.trim()) {
      const searchRegex = new RegExp(q.trim(), "i");
      query.$or = [{ courseCode: searchRegex }, { courseName: searchRegex }, { description: searchRegex }];
    }

    const courses = await Course.find(query).sort({ courseCode: 1 }).lean();

    // Attach counts
    const enriched = await Promise.all(
      courses.map(async (course) => {
        const materialCount = await LearningMaterial.countDocuments({ courseId: course._id });
        const assignmentCount = await Assignment.countDocuments({ courseId: course._id });
        return {
          ...course,
          materialCount,
          assignmentCount,
        };
      })
    );

    return res.status(200).json({
      status: "success",
      data: enriched,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Failed to load courses: " + error.message,
    });
  }
};

// ST02: Course Details
export const getCourseDetails = async (req, res) => {
  try {
    const studentId = req.user._id;
    const { courseId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid course ID format.",
      });
    }

    const enrolled = await isStudentEnrolled(studentId, courseId);
    if (!enrolled) {
      return res.status(403).json({
        status: "error",
        message: "You do not have permission to access this course. You are not enrolled in it.",
      });
    }

    const course = await Course.findById(courseId).lean();
    if (!course) {
      return res.status(404).json({
        status: "error",
        message: "Course not found.",
      });
    }

    const materialCount = await LearningMaterial.countDocuments({ courseId });
    const assignmentCount = await Assignment.countDocuments({ courseId });
    const announcementCount = await Announcement.countDocuments({ courseId });

    return res.status(200).json({
      status: "success",
      data: {
        ...course,
        materialCount,
        assignmentCount,
        announcementCount,
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Failed to load course details: " + error.message,
    });
  }
};

// ST03: Course Materials
export const getMaterials = async (req, res) => {
  try {
    const studentId = req.user._id;
    const { courseId } = req.params;
    const { type } = req.query;

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid course ID format.",
      });
    }

    const enrolled = await isStudentEnrolled(studentId, courseId);
    if (!enrolled) {
      return res.status(403).json({
        status: "error",
        message: "You do not have permission to access this course's materials.",
      });
    }

    const course = await Course.findById(courseId).select("courseCode courseName").lean();
    if (!course) {
      return res.status(404).json({
        status: "error",
        message: "Course not found.",
      });
    }

    const query = { courseId };
    if (type && ["LectureNote", "Video", "Attachment"].includes(type)) {
      query.type = type;
    }

    const materials = await LearningMaterial.find(query).sort({ uploadedAt: -1 }).lean();

    return res.status(200).json({
      status: "success",
      course,
      data: materials,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Failed to load materials: " + error.message,
    });
  }
};

// ST04: Material Details / Preview
export const getMaterial = async (req, res) => {
  try {
    const studentId = req.user._id;
    const { materialId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(materialId)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid material ID format.",
      });
    }

    const material = await LearningMaterial.findById(materialId).populate("courseId", "courseCode courseName isActive").lean();
    if (!material) {
      return res.status(404).json({
        status: "error",
        message: "Learning material not found.",
      });
    }

    const enrolled = await isStudentEnrolled(studentId, material.courseId._id);
    if (!enrolled) {
      return res.status(403).json({
        status: "error",
        message: "You do not have permission to access this learning material.",
      });
    }

    return res.status(200).json({
      status: "success",
      data: material,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Failed to load material: " + error.message,
    });
  }
};

// Download Material
export const downloadMaterial = async (req, res) => {
  try {
    const studentId = req.user._id;
    const { materialId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(materialId)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid material ID format.",
      });
    }

    const material = await LearningMaterial.findById(materialId).populate("courseId", "courseCode courseName").lean();
    if (!material) {
      return res.status(404).json({
        status: "error",
        message: "Learning material not found.",
      });
    }

    const enrolled = await isStudentEnrolled(studentId, material.courseId._id);
    if (!enrolled) {
      return res.status(403).json({
        status: "error",
        message: "You do not have permission to download this material.",
      });
    }

    // Prepare safe filename
    const cleanCourseCode = material.courseId.courseCode.replace(/[^a-zA-Z0-9_-]/g, "_");
    const cleanTitle = material.title.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `${cleanCourseCode}_${cleanTitle}.txt`;

    const fileContent = `======================================================
UNIVERSITY LMS - ACADEMIC LEARNING MATERIAL
======================================================
Course: ${material.courseId.courseCode} - ${material.courseId.courseName}
Title:  ${material.title}
Type:   ${material.type}
Uploaded: ${new Date(material.uploadedAt).toLocaleString("en-US")}
------------------------------------------------------
DESCRIPTION & NOTES:
${material.description || "No additional description provided."}
======================================================
`;

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(fileContent);
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Failed to download material: " + error.message,
    });
  }
};
