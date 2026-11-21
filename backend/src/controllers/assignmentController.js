import mongoose from "mongoose";
import Assignment from "../models/Assignment.js";
import Submission from "../models/Submission.js";
import { isStudentEnrolled, getEnrolledCourseIds } from "./courseController.js";

// ST05: My Assignments
export const getMyAssignments = async (req, res) => {
  try {
    const studentId = req.user._id;
    const { courseId, status, q } = req.query;

    const enrolledCourseIds = await getEnrolledCourseIds(studentId);
    if (enrolledCourseIds.length === 0) {
      return res.status(200).json({
        status: "success",
        data: [],
      });
    }

    const query = { courseId: { $in: enrolledCourseIds } };

    if (courseId && mongoose.Types.ObjectId.isValid(courseId)) {
      if (!enrolledCourseIds.some((id) => id.toString() === courseId)) {
        return res.status(403).json({
          status: "error",
          message: "You are not enrolled in the specified course.",
        });
      }
      query.courseId = courseId;
    }

    if (q && q.trim()) {
      const searchRegex = new RegExp(q.trim(), "i");
      query.$or = [{ title: searchRegex }, { description: searchRegex }];
    }

    const assignments = await Assignment.find(query)
      .populate("courseId", "courseCode courseName isActive")
      .sort({ dueDate: 1 })
      .lean();

    const assignmentIds = assignments.map((a) => a._id);
    const submissions = await Submission.find({
      assignmentId: { $in: assignmentIds },
      studentId,
    }).lean();

    const submissionMap = new Map();
    submissions.forEach((sub) => {
      submissionMap.set(sub.assignmentId.toString(), sub);
    });

    const now = new Date();
    let enriched = assignments.map((assignment) => {
      const submission = submissionMap.get(assignment._id.toString()) || null;
      let computedStatus = "PENDING";

      if (submission) {
        if (submission.grade !== null && submission.grade !== undefined) {
          computedStatus = "GRADED";
        } else {
          computedStatus = "SUBMITTED";
        }
      } else if (new Date(assignment.dueDate) < now) {
        computedStatus = "OVERDUE";
      }

      return {
        ...assignment,
        submission,
        status: computedStatus,
      };
    });

    // Apply status filter if provided
    if (status && status !== "ALL") {
      const upperStatus = status.toUpperCase();
      enriched = enriched.filter((a) => a.status === upperStatus);
    }

    return res.status(200).json({
      status: "success",
      data: enriched,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Failed to load assignments: " + error.message,
    });
  }
};

// ST06: Assignment Details
export const getAssignmentDetails = async (req, res) => {
  try {
    const studentId = req.user._id;
    const { assignmentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(assignmentId)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid assignment ID format.",
      });
    }

    const assignment = await Assignment.findById(assignmentId)
      .populate("courseId", "courseCode courseName isActive")
      .lean();

    if (!assignment) {
      return res.status(404).json({
        status: "error",
        message: "Assignment not found.",
      });
    }

    const enrolled = await isStudentEnrolled(studentId, assignment.courseId._id);
    if (!enrolled) {
      return res.status(403).json({
        status: "error",
        message: "You do not have permission to access this assignment. You are not enrolled in the course.",
      });
    }

    const submission = await Submission.findOne({
      assignmentId,
      studentId,
    }).lean();

    const now = new Date();
    let status = "PENDING";
    if (submission) {
      status = submission.grade !== null && submission.grade !== undefined ? "GRADED" : "SUBMITTED";
    } else if (new Date(assignment.dueDate) < now) {
      status = "OVERDUE";
    }

    return res.status(200).json({
      status: "success",
      data: {
        ...assignment,
        submission,
        status,
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Failed to load assignment details: " + error.message,
    });
  }
};

// ST06: Submit Assignment
export const submitAssignment = async (req, res) => {
  try {
    const studentId = req.user._id;
    const { assignmentId } = req.params;
    const { content } = req.body;

    if (!mongoose.Types.ObjectId.isValid(assignmentId)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid assignment ID format.",
      });
    }

    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({
        status: "error",
        message: "Assignment not found.",
      });
    }

    const enrolled = await isStudentEnrolled(studentId, assignment.courseId);
    if (!enrolled) {
      return res.status(403).json({
        status: "error",
        message: "You do not have permission to submit to this assignment.",
      });
    }

    const hasFile = !!req.file;
    const hasContent = content && content.trim().length > 0;

    if (!hasContent && !hasFile) {
      return res.status(400).json({
        status: "error",
        message: "Submission requires text content or an attached file.",
      });
    }

    let fileUrl = null;
    let fileName = null;
    let fileSize = null;

    if (hasFile) {
      fileUrl = `/uploads/submissions/${req.file.filename}`;
      fileName = req.file.originalname;
      fileSize = req.file.size;
    }

    // Check existing submission
    let submission = await Submission.findOne({ assignmentId, studentId });

    if (submission) {
      // If already graded, cannot modify
      if (submission.grade !== null && submission.grade !== undefined) {
        return res.status(400).json({
          status: "error",
          message: "This assignment has already been graded and cannot be resubmitted.",
        });
      }

      submission.content = hasContent ? content.trim() : submission.content;
      if (hasFile) {
        submission.fileUrl = fileUrl;
        submission.fileName = fileName;
        submission.fileSize = fileSize;
      }
      submission.submittedAt = new Date();
      await submission.save();

      return res.status(200).json({
        status: "success",
        message: "Assignment submission updated successfully.",
        data: submission,
      });
    }

    // Create new submission
    submission = new Submission({
      assignmentId,
      studentId,
      content: hasContent ? content.trim() : "",
      fileUrl,
      fileName,
      fileSize,
      submittedAt: new Date(),
    });

    await submission.save();

    return res.status(201).json({
      status: "success",
      message: "Assignment submitted successfully.",
      data: submission,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Failed to submit assignment: " + error.message,
    });
  }
};

// ST07: Submission Details
export const getSubmissionDetails = async (req, res) => {
  try {
    const studentId = req.user._id;
    const { submissionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(submissionId)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid submission ID format.",
      });
    }

    const submission = await Submission.findById(submissionId)
      .populate({
        path: "assignmentId",
        populate: { path: "courseId", select: "courseCode courseName" },
      })
      .lean();

    if (!submission) {
      return res.status(404).json({
        status: "error",
        message: "Submission not found.",
      });
    }

    // Security check: only the student who submitted (or instructors/admins) can view
    if (submission.studentId.toString() !== studentId.toString() && req.user.role === "Student") {
      return res.status(403).json({
        status: "error",
        message: "You do not have permission to view this submission.",
      });
    }

    return res.status(200).json({
      status: "success",
      data: submission,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Failed to load submission details: " + error.message,
    });
  }
};
