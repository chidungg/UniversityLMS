import mongoose from "mongoose";
import { authError } from "../config/auth.js";
import Assignment from "../models/Assignment.js";

export function withAssignmentWrite(assignmentId, write) {
  return mongoose.connection.transaction(async (session) => {
    // Touch the same record for submission, grading, update and delete so concurrent transactions cannot leave orphan submissions or conflicting scores.
    const assignment = await Assignment.findOneAndUpdate(
      { _id: assignmentId }, { $inc: { __v: 1 } }, { session, returnDocument: "after" }
    ).lean();
    if (!assignment) throw authError(404, "ASSIGNMENT_NOT_FOUND", "Assignment not found.");
    return write(assignment, session);
  });
}
