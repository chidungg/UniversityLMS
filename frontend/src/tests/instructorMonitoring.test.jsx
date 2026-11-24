import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { InstructorMonitoringPage } from "../pages/instructor/InstructorMonitoringPage";
import { api } from "../services/api";

vi.mock("../services/api", () => ({
  api: {
    getInstructorCourses: vi.fn(),
    getInstructorCourseGradebook: vi.fn(),
    getInstructorCourseProgress: vi.fn(),
  },
}));

const sampleCourse = {
  _id: "c1",
  courseCode: "SE104",
  courseName: "Software Engineering",
  description: "Software processes and modeling.",
  isActive: true,
  enrolledCount: 2,
  assignmentCount: 2,
  quizCount: 1,
};

const gradebookPayload = {
  course: sampleCourse,
  hasEnrolledStudents: true,
  hasAcademicData: true,
  emptyReason: null,
  summary: {
    enrolledCount: 2,
    filteredCount: 2,
    assignmentCount: 2,
    quizCount: 1,
    gradedSubmissions: 1,
    pendingGrading: 1,
    completedQuizAttempts: 1,
    classAssignmentAvgPct: 85,
    classQuizAvgPct: 80,
    quizPassRatePct: 100,
  },
  assignments: [
    { _id: "a1", title: "Lab 01", maxScore: 10, avgScore: 8.5 },
    { _id: "a2", title: "Lab 02", maxScore: 10, avgScore: null },
  ],
  quizzes: [
    { _id: "q1", title: "Quiz 01", maxScore: 10, avgScore: 8 },
  ],
  rows: [
    {
      student: { _id: "s1", fullName: "Alice Nguyen", email: "alice@lms.test", enrolledAt: "2026-09-01T00:00:00Z" },
      assignmentGrades: [
        {
          assignmentId: "a1",
          title: "Lab 01",
          maxScore: 10,
          dueDate: "2026-09-20T00:00:00Z",
          submissionId: "sub1",
          status: "GRADED",
          isLate: false,
          isPastDue: false,
          grade: 8.5,
          percentage: 85,
          feedback: "Well structured solution.",
          submittedAt: "2026-09-18T10:00:00Z",
        },
        {
          assignmentId: "a2",
          title: "Lab 02",
          maxScore: 10,
          dueDate: "2026-09-25T00:00:00Z",
          submissionId: "sub2",
          status: "SUBMITTED",
          isLate: true,
          isPastDue: false,
          grade: null,
          percentage: null,
          feedback: null,
          submittedAt: "2026-09-26T02:00:00Z",
        },
      ],
      quizGrades: [
        {
          quizId: "q1",
          title: "Quiz 01",
          maxScore: 10,
          status: "COMPLETED",
          score: 8,
          percentage: 80,
          passed: true,
          submittedAt: "2026-09-19T12:00:00Z",
        },
      ],
      summary: {
        gradedAssignmentsCount: 1,
        submittedAssignmentsCount: 2,
        assignmentAveragePct: 85,
        completedQuizzesCount: 1,
        passedQuizzesCount: 1,
        quizAveragePct: 80,
        overallAveragePct: 82.5,
        gradedItemsCount: 2,
      },
    },
    {
      student: { _id: "s2", fullName: "Binh Tran", email: "binh@lms.test", enrolledAt: "2026-09-02T00:00:00Z" },
      assignmentGrades: [
        {
          assignmentId: "a1",
          title: "Lab 01",
          maxScore: 10,
          dueDate: "2026-09-20T00:00:00Z",
          submissionId: null,
          status: "NOT_SUBMITTED",
          isLate: false,
          isPastDue: true,
          grade: null,
          percentage: null,
          feedback: null,
          submittedAt: null,
        },
        {
          assignmentId: "a2",
          title: "Lab 02",
          maxScore: 10,
          dueDate: "2026-09-25T00:00:00Z",
          submissionId: null,
          status: "NOT_SUBMITTED",
          isLate: false,
          isPastDue: false,
          grade: null,
          percentage: null,
          feedback: null,
          submittedAt: null,
        },
      ],
      quizGrades: [
        {
          quizId: "q1",
          title: "Quiz 01",
          maxScore: 10,
          status: "NOT_ATTEMPTED",
          score: null,
          percentage: null,
          passed: null,
          submittedAt: null,
        },
      ],
      summary: {
        gradedAssignmentsCount: 0,
        submittedAssignmentsCount: 0,
        assignmentAveragePct: null,
        completedQuizzesCount: 0,
        passedQuizzesCount: 0,
        quizAveragePct: null,
        overallAveragePct: null,
        gradedItemsCount: 0,
      },
    },
  ],
};

const progressPayload = {
  course: sampleCourse,
  hasEnrolledStudents: true,
  hasAcademicData: true,
  emptyReason: null,
  summary: {
    enrolledCount: 2,
    filteredCount: 2,
    assignmentCount: 2,
    quizCount: 1,
    materialCount: 4,
    trackedItemsTotal: 3,
    studentsOnTrack: 1,
    studentsNeedingAttention: 0,
    studentsWithNoActivity: 1,
    totalSubmittedAssignments: 2,
    totalCompletedQuizzes: 1,
  },
  rows: [
    {
      student: gradebookPayload.rows[0].student,
      progress: {
        assignmentsTotal: 2,
        assignmentsSubmitted: 2,
        assignmentsGraded: 1,
        assignmentsPendingGrading: 1,
        assignmentsLate: 1,
        assignmentsMissingPastDue: 0,
        quizzesTotal: 1,
        quizzesCompleted: 1,
        quizzesInProgress: 0,
        quizzesPassed: 1,
        quizzesMissedExpired: 0,
        trackedItemsTotal: 3,
        trackedItemsCompleted: 3,
        completionRatePct: 100,
        lastActivityAt: "2026-09-26T02:00:00Z",
        attentionStatus: "ON_TRACK",
      },
      assignmentItems: gradebookPayload.rows[0].assignmentGrades,
      quizItems: gradebookPayload.rows[0].quizGrades,
    },
    {
      student: gradebookPayload.rows[1].student,
      progress: {
        assignmentsTotal: 2,
        assignmentsSubmitted: 0,
        assignmentsGraded: 0,
        assignmentsPendingGrading: 0,
        assignmentsLate: 0,
        assignmentsMissingPastDue: 1,
        quizzesTotal: 1,
        quizzesCompleted: 0,
        quizzesInProgress: 0,
        quizzesPassed: 0,
        quizzesMissedExpired: 0,
        trackedItemsTotal: 3,
        trackedItemsCompleted: 0,
        completionRatePct: 0,
        lastActivityAt: null,
        attentionStatus: "NO_ACTIVITY",
      },
      assignmentItems: gradebookPayload.rows[1].assignmentGrades,
      quizItems: gradebookPayload.rows[1].quizGrades,
    },
  ],
};

function renderMonitoring(initialEntry = "/instructor/monitoring") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/instructor/monitoring" element={<InstructorMonitoringPage />} />
        <Route path="/instructor/courses/:courseId/students" element={<InstructorMonitoringPage />} />
        <Route path="/instructor/courses/:courseId" element={<div>Course Workspace</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("I06: Instructor Monitor Students", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getInstructorCourses.mockResolvedValue({ status: "success", data: [sampleCourse] });
    api.getInstructorCourseGradebook.mockResolvedValue({ status: "success", data: gradebookPayload });
    api.getInstructorCourseProgress.mockResolvedValue({ status: "success", data: progressPayload });
  });

  it("5.1 loads Gradebook with real scores, ungraded badges, and student search filtering", async () => {
    renderMonitoring();

    const table = await screen.findByRole("table", { name: "Course gradebook" });
    expect(within(table).getByText(/8\.5 \/ 10/)).toBeDefined();
    expect(within(table).getByText("Needs Grading")).toBeDefined();
    expect(within(table).getByText("82.5%")).toBeDefined();

    const search = screen.getByRole("searchbox", { name: "Search students in gradebook" });
    fireEvent.change(search, { target: { value: "binh" } });
    expect(screen.queryByText("Alice Nguyen")).toBeNull();
    expect(screen.getByText("Binh Tran")).toBeDefined();

    fireEvent.change(search, { target: { value: "nobody" } });
    expect(screen.getByText("No matching students")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Clear Filters" }));
    expect(screen.getByText("Alice Nguyen")).toBeDefined();
  });

  it("5.2 switches to Track Learning Progress, filters by status, and opens read-only detail modal", async () => {
    renderMonitoring();

    await screen.findByRole("table", { name: "Course gradebook" });
    fireEvent.click(screen.getByRole("tab", { name: /Track Learning Progress/i }));

    expect(await screen.findByRole("table", { name: "Student learning progress" })).toBeDefined();
    expect(api.getInstructorCourseProgress).toHaveBeenCalledWith("c1", {}, { signal: expect.any(AbortSignal) });
    expect(screen.getByText(/Published course materials \(4\)/)).toBeDefined();
    expect(screen.getByText("3 / 3 completed")).toBeDefined();

    const filterGroup = screen.getByRole("group", { name: "Filter by student progress status" });
    fireEvent.click(filterGroup.querySelectorAll("button")[1]); // On Track
    expect(screen.getByText("Alice Nguyen")).toBeDefined();
    expect(screen.queryByText("Binh Tran")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Details for Alice Nguyen" }));
    expect(await screen.findByText(/Academic Record · Alice Nguyen/)).toBeDefined();
    expect(screen.getByText(/Well structured solution\./)).toBeDefined();
    expect(screen.queryByRole("button", { name: /Save/i })).toBeNull();
  });

  it("handles Exception 3.1 (No Students Enrolled) and 6.1 (No Academic Data Available)", async () => {
    api.getInstructorCourseGradebook.mockResolvedValueOnce({
      status: "success",
      data: {
        course: sampleCourse,
        hasEnrolledStudents: false,
        hasAcademicData: false,
        emptyReason: "NO_STUDENTS_ENROLLED",
        summary: { enrolledCount: 0 },
        assignments: [],
        quizzes: [],
        rows: [],
      },
    });
    renderMonitoring();
    expect(await screen.findByText("No students enrolled in this course")).toBeDefined();

    api.getInstructorCourseGradebook.mockResolvedValueOnce({
      status: "success",
      data: {
        course: sampleCourse,
        hasEnrolledStudents: true,
        hasAcademicData: false,
        emptyReason: "NO_ASSESSMENTS",
        summary: { enrolledCount: 2 },
        assignments: [],
        quizzes: [],
        rows: [],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: /Refresh/i }));
    expect(await screen.findByText("No academic data available yet")).toBeDefined();
  });

  it("handles Exception 6.2 (Data Retrieval Failed) and recovers via Retry", async () => {
    api.getInstructorCourseGradebook
      .mockRejectedValueOnce(new Error("Temporary monitoring timeout"))
      .mockResolvedValueOnce({ status: "success", data: gradebookPayload });

    renderMonitoring();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Temporary monitoring timeout");

    fireEvent.click(screen.getByRole("button", { name: /Retry/i }));
    await waitFor(() => {
      expect(screen.getByRole("table", { name: "Course gradebook" })).toBeDefined();
    });
  });
});
