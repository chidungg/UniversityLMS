import mongoose from "mongoose";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import Assignment from "../models/Assignment.js";
import Submission from "../models/Submission.js";
import Enrollment from "../models/Enrollment.js";
import { authError } from "../config/auth.js";
import { withAssignmentWrite } from "../utils/assignmentWrite.js";
import { isStudentEnrolled, getEnrolledCourseIds } from "./courseController.js";
import { escapeRegex } from "../utils/helpers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

    if (courseId) {
      if (!mongoose.Types.ObjectId.isValid(courseId)) {
        return res.status(400).json({
          status: "error",
          message: "Invalid course ID format.",
        });
      }
      if (!enrolledCourseIds.some((id) => id.toString() === courseId)) {
        return res.status(403).json({
          status: "error",
          message: "You are not enrolled in the specified course.",
        });
      }
      query.courseId = courseId;
    }

    const VALID_STATUSES = ["ALL", "PENDING", "SUBMITTED", "OVERDUE", "GRADED"];
    if (status && !VALID_STATUSES.includes(status.toUpperCase())) {
      return res.status(400).json({
        status: "error",
        message: "Invalid status filter. Allowed values: ALL, PENDING, SUBMITTED, OVERDUE, GRADED.",
      });
    }

    if (q && q.trim()) {
      const searchRegex = new RegExp(escapeRegex(q.trim()), "i");
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
    }).sort({ submittedAt: -1, _id: -1 }).lean();

    const submissionMap = new Map();
    submissions.forEach((sub) => {
      const key = String(sub.assignmentId);
      if (!submissionMap.has(key)) submissionMap.set(key, sub);
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
    if (status && status.toUpperCase() !== "ALL") {
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
    }).sort({ submittedAt: -1, _id: -1 }).lean();

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

// Helper to safely delete an uploaded file
const cleanupUploadedFile = (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.error("Failed to cleanup file:", filePath, err.message);
    }
  }
};

// ST06: Submit Assignment
export const submitAssignment = async (req, res, next) => {
  const { assignmentId } = req.params;
  const studentId = req.user._id;
  const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
  const uploadedPath = req.file?.path;
  const fileUrl = req.file ? `/uploads/submissions/${req.file.filename}` : null;

  try {
    if (!mongoose.isObjectIdOrHexString(assignmentId)) {
      throw authError(400, "INVALID_ASSIGNMENT_ID", "Invalid assignment ID format.");
    }

    const result = await withAssignmentWrite(assignmentId, async (assignment, session) => {
      if (!(await Enrollment.exists({ studentId, courseId: assignment.courseId }).session(session))) {
        throw authError(403, "ASSIGNMENT_FORBIDDEN", "You do not have permission to submit to this assignment.");
      }
      const now = new Date();
      if (assignment.dueDate < now) {
        throw authError(400, "ASSIGNMENT_OVERDUE", "The deadline for this assignment has passed. Submissions are no longer accepted.");
      }
      if (!content && !req.file) {
        throw authError(400, "SUBMISSION_REQUIRED", "Submission requires text content or an attached file.");
      }
      if (req.file?.size === 0) {
        throw authError(400, "SUBMISSION_FILE_EMPTY", "Uploaded file is empty.");
      }

      const filter = { assignmentId: assignment._id, studentId };
      const existing = await Submission.findOne(filter).sort({ submittedAt: -1, _id: -1 }).session(session).lean();
      if (existing?.grade != null) {
        throw authError(400, "SUBMISSION_ALREADY_GRADED", "This assignment has already been graded and cannot be resubmitted.");
      }
      const changes = {
        content: content || existing?.content || "",
        submittedAt: now,
        ...(req.file ? { fileUrl, fileName: req.file.originalname, fileSize: req.file.size } : {}),
      };
      if (!existing) {
        const submission = await new Submission({ ...filter, ...changes }).save({ session });
        return { submission, created: true };
      }
      const submission = await Submission.findOneAndUpdate(
        { _id: existing._id }, { $set: changes, $inc: { __v: 1 } },
        { session, returnDocument: "after", runValidators: true }
      ).lean();
      return { submission, previousFileUrl: existing.fileUrl, created: false };
    });

    if (req.file && result.previousFileUrl?.startsWith("/uploads/submissions/")) {
      const previousPath = path.resolve(__dirname, "../../uploads/submissions", path.basename(result.previousFileUrl));
      if (previousPath !== uploadedPath) cleanupUploadedFile(previousPath);
    }
    return res.status(result.created ? 201 : 200).json({
      status: "success",
      message: result.created ? "Assignment submitted successfully." : "Assignment submission updated successfully.",
      data: result.submission,
    });
  } catch (error) {
    if (uploadedPath) {
      try {
        if (error.statusCode < 500 || !(await Submission.exists({ fileUrl }))) cleanupUploadedFile(uploadedPath);
      } catch (cleanupError) {
        console.error("Could not verify unused assignment upload:", cleanupError.code || cleanupError.name);
      }
    }
    return next(error);
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
