import mongoose from "mongoose";
import Course from "../models/Course.js";
import LearningMaterial from "../models/LearningMaterial.js";
import Assignment from "../models/Assignment.js";
import { getEnrolledCourseIds } from "./courseController.js";
import { escapeRegex } from "../utils/helpers.js";

// ST16: Global Search
export const search = async (req, res) => {
  try {
    const studentId = req.user._id;
    const { q, category } = req.query;

    if (!q || !q.trim()) {
      return res.status(400).json({
        status: "error",
        message: "Search keyword is required.",
      });
    }

    const keyword = q.trim();
    if (keyword.length > 100) {
      return res.status(400).json({
        status: "error",
        message: "Search keyword exceeds maximum allowed length of 100 characters.",
      });
    }

    const VALID_CATEGORIES = ["all", "courses", "materials", "assignments"];
    const normalizedCategory = category ? category.toLowerCase().trim() : "all";
    if (category && !VALID_CATEGORIES.includes(normalizedCategory)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid search category. Supported categories are: all, courses, materials, assignments.",
      });
    }

    const searchRegex = new RegExp(escapeRegex(keyword), "i");

    // Scoped strictly to student's enrolled and active courses
    const enrolledCourseIds = await getEnrolledCourseIds(studentId);

    if (enrolledCourseIds.length === 0) {
      return res.status(200).json({
        status: "success",
        keyword,
        data: {
          courses: [],
          materials: [],
          assignments: [],
          counts: {
            courses: 0,
            materials: 0,
            assignments: 0,
            total: 0,
          },
        },
      });
    }

    const activeEnrolledCourses = await Course.find({
      _id: { $in: enrolledCourseIds },
      isActive: true,
    }).select("_id");
    const activeCourseIds = activeEnrolledCourses.map((c) => c._id);

    if (activeCourseIds.length === 0) {
      return res.status(200).json({
        status: "success",
        keyword,
        data: {
          courses: [],
          materials: [],
          assignments: [],
          counts: {
            courses: 0,
            materials: 0,
            assignments: 0,
            total: 0,
          },
        },
      });
    }

    let matchingCourses = [];
    let matchingMaterials = [];
    let matchingAssignments = [];

    const shouldSearchCourses = normalizedCategory === "all" || normalizedCategory === "courses";
    const shouldSearchMaterials = normalizedCategory === "all" || normalizedCategory === "materials";
    const shouldSearchAssignments = normalizedCategory === "all" || normalizedCategory === "assignments";

    if (shouldSearchCourses) {
      matchingCourses = await Course.find({
        _id: { $in: activeCourseIds },
        isActive: true,
        $or: [
          { courseCode: searchRegex },
          { courseName: searchRegex },
          { description: searchRegex },
        ],
      })
        .select("courseCode courseName description isActive")
        .sort({ courseCode: 1 })
        .lean();
    }

    if (shouldSearchMaterials) {
      matchingMaterials = await LearningMaterial.find({
        courseId: { $in: activeCourseIds },
        $or: [
          { title: searchRegex },
          { description: searchRegex },
          { type: searchRegex },
        ],
      })
        .populate("courseId", "courseCode courseName isActive")
        .sort({ uploadedAt: -1 })
        .lean();
    }

    if (shouldSearchAssignments) {
      matchingAssignments = await Assignment.find({
        courseId: { $in: activeCourseIds },
        $or: [
          { title: searchRegex },
          { description: searchRegex },
        ],
      })
        .populate("courseId", "courseCode courseName isActive")
        .sort({ dueDate: 1 })
        .lean();
    }

    const counts = {
      courses: matchingCourses.length,
      materials: matchingMaterials.length,
      assignments: matchingAssignments.length,
      total: matchingCourses.length + matchingMaterials.length + matchingAssignments.length,
    };

    return res.status(200).json({
      status: "success",
      keyword,
      data: {
        courses: matchingCourses,
        materials: matchingMaterials,
        assignments: matchingAssignments,
        counts,
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Search operation failed: " + error.message,
    });
  }
};
