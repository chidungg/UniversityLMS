import mongoose from "mongoose";
import Course from "../models/Course.js";
import LearningMaterial from "../models/LearningMaterial.js";
import Assignment from "../models/Assignment.js";
import { getEnrolledCourseIds } from "./courseController.js";

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
    const searchRegex = new RegExp(keyword, "i");

    // Scoped strictly to student's enrolled courses
    const enrolledCourseIds = await getEnrolledCourseIds(studentId);

    if (enrolledCourseIds.length === 0) {
      return res.status(200).json({
        status: "success",
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

    const shouldSearchCourses = !category || category === "all" || category === "courses";
    const shouldSearchMaterials = !category || category === "all" || category === "materials";
    const shouldSearchAssignments = !category || category === "all" || category === "assignments";

    if (shouldSearchCourses) {
      matchingCourses = await Course.find({
        _id: { $in: enrolledCourseIds },
        isActive: true,
        $or: [
          { courseCode: searchRegex },
          { courseName: searchRegex },
          { description: searchRegex },
        ],
      })
        .select("courseCode courseName description isActive")
        .lean();
    }

    if (shouldSearchMaterials) {
      matchingMaterials = await LearningMaterial.find({
        courseId: { $in: enrolledCourseIds },
        $or: [
          { title: searchRegex },
          { description: searchRegex },
          { type: searchRegex },
        ],
      })
        .populate("courseId", "courseCode courseName")
        .sort({ uploadedAt: -1 })
        .lean();
    }

    if (shouldSearchAssignments) {
      matchingAssignments = await Assignment.find({
        courseId: { $in: enrolledCourseIds },
        $or: [
          { title: searchRegex },
          { description: searchRegex },
        ],
      })
        .populate("courseId", "courseCode courseName")
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
