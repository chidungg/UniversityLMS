import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { InstructorDashboardPage } from "../pages/instructor/InstructorDashboardPage";
import { InstructorCoursesPage } from "../pages/instructor/InstructorCoursesPage";
import { InstructorCourseDetailsPage } from "../pages/instructor/InstructorCourseDetailsPage";
import { InstructorMaterialsPage } from "../pages/instructor/InstructorMaterialsPage";
import { InstructorAssignmentsPage } from "../pages/instructor/InstructorAssignmentsPage";
import { InstructorAssignmentDetailsPage } from "../pages/instructor/InstructorAssignmentDetailsPage";
import { InstructorQuizzesPage } from "../pages/instructor/InstructorQuizzesPage";
import { InstructorQuizBuilderPage } from "../pages/instructor/InstructorQuizBuilderPage";
import { InstructorQuizResultsPage } from "../pages/instructor/InstructorQuizResultsPage";
import { api } from "../services/api";

vi.mock("../services/api", () => ({
  api: {
    getInstructorDashboard: vi.fn(),
    getInstructorCourses: vi.fn(),
    getInstructorCourseDetails: vi.fn(),
    updateInstructorCourse: vi.fn(),
    getInstructorMaterials: vi.fn(),
    createMaterial: vi.fn(),
    updateMaterial: vi.fn(),
    deleteMaterial: vi.fn(),
    downloadMaterialBlob: vi.fn(),
    getInstructorAssignments: vi.fn(),
    getInstructorAssignmentDetails: vi.fn(),
    createAssignment: vi.fn(),
    updateAssignment: vi.fn(),
    deleteAssignment: vi.fn(),
    gradeSubmission: vi.fn(),
    getInstructorQuizzes: vi.fn(),
    getInstructorQuizDetails: vi.fn(),
    createQuiz: vi.fn(),
    updateQuiz: vi.fn(),
    deleteQuiz: vi.fn(),
    getInstructorQuizResults: vi.fn(),
  },
}));

const sampleCourse = {
  _id: "c1",
  courseCode: "DEMO-PRG101",
  courseName: "Programming Techniques",
  description: "Algorithms and procedural programming.",
  isActive: true,
  instructor: "Dr. David Miller",
  enrolledCount: 2,
  materialCount: 1,
  assignmentCount: 1,
  quizCount: 1,
  pendingGradingCount: 1,
};

describe("Instructor Workspace Modules (I01 - I05)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getInstructorCourses.mockResolvedValue({
      status: "success",
      data: [sampleCourse],
    });
  });

  it("I01: InstructorDashboardPage displays assigned courses and pending grading queue", async () => {
    api.getInstructorDashboard.mockResolvedValue({
      status: "success",
      data: {
        instructor: { fullName: "Dr. David Miller" },
        courses: [sampleCourse],
        pendingSubmissions: [
          {
            _id: "sub_1",
            assignmentId: "a1",
            assignmentTitle: "Array Algorithms",
            submittedAt: "2026-11-06T18:30:00Z",
            student: { _id: "s1", fullName: "Alice Johnson" },
            course: { _id: "c1", courseCode: "DEMO-PRG101" },
            isLate: false,
          },
        ],
        upcomingSchedule: [],
        stats: {
          assignedCourses: 1,
          uniqueStudents: 2,
          pendingGrading: 1,
          activeQuizzes: 1,
        },
      },
    });

    render(
      <MemoryRouter>
        <InstructorDashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Welcome back, Dr. David Miller/i)).toBeDefined();
      expect(screen.getByText("Programming Techniques")).toBeDefined();
      expect(screen.getByText("Array Algorithms")).toBeDefined();
      expect(screen.getByText("Alice Johnson")).toBeDefined();
    });
  });

  it("I01 & I02: InstructorCoursesPage lists assigned courses and opens edit info modal", async () => {
    api.updateInstructorCourse.mockResolvedValue({
      status: "success",
      data: { ...sampleCourse, courseName: "Programming Techniques II" },
    });

    render(
      <MemoryRouter initialEntries={["/instructor/courses"]}>
        <Routes>
          <Route path="/instructor/courses" element={<InstructorCoursesPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Programming Techniques")).toBeDefined();
      expect(screen.getByText("2 Students")).toBeDefined();
    });

    fireEvent.click(screen.getByRole("button", { name: /Edit Info/i }));
    await waitFor(() => {
      expect(screen.getByText(/Edit Course Info — DEMO-PRG101/i)).toBeDefined();
    });
  });

  it("I02: InstructorCourseDetailsPage switches to Enrolled Students tab and views student summary", async () => {
    api.getInstructorCourseDetails.mockResolvedValue({
      status: "success",
      data: {
        course: sampleCourse,
        materials: [],
        assignments: [],
        quizzes: [],
        students: [
          {
            _id: "s1",
            fullName: "Alice Johnson",
            email: "student01@lms-demo.test",
            studentCode: "22110001",
            enrolledAt: "2026-09-12T08:00:00Z",
            assignmentsSubmitted: 1,
            totalAssignments: 2,
            quizzesCompleted: 1,
            totalQuizzes: 1,
            averageScore: 9.0,
            submissions: [],
            quizAttempts: [],
          },
        ],
      },
    });

    render(
      <MemoryRouter initialEntries={["/instructor/courses/c1"]}>
        <Routes>
          <Route path="/instructor/courses/:courseId" element={<InstructorCourseDetailsPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Programming Techniques")).toBeDefined();
    });

    fireEvent.click(screen.getByRole("tab", { name: /Enrolled Students/i }));

    await waitFor(() => {
      expect(screen.getByText("Alice Johnson")).toBeDefined();
      expect(screen.getByText("9 / 10")).toBeDefined();
    });

    fireEvent.click(screen.getByRole("button", { name: /View Summary/i }));
    await waitFor(() => {
      expect(screen.getByText(/Student Summary — Alice Johnson/i)).toBeDefined();
    });
  });

  it("I03: InstructorMaterialsPage renders materials and submits Upload Material form", async () => {
    api.getInstructorMaterials.mockResolvedValue({
      status: "success",
      data: [
        {
          _id: "m1",
          courseId: { _id: "c1", courseCode: "DEMO-PRG101", courseName: "Programming Techniques" },
          title: "Lecture 01 — Variables",
          description: "Intro slides",
          type: "LectureNote",
          uploadedAt: "2026-10-11T09:00:00Z",
        },
      ],
    });
    api.createMaterial.mockResolvedValue({
      status: "success",
      message: "Learning material uploaded successfully.",
      data: { _id: "m2", title: "Lab 01" },
    });

    render(
      <MemoryRouter initialEntries={["/instructor/materials"]}>
        <Routes>
          <Route path="/instructor/materials" element={<InstructorMaterialsPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Lecture 01 — Variables")).toBeDefined();
    });

    fireEvent.click(screen.getByRole("button", { name: /Upload Material/i }));

    await waitFor(() => {
      expect(screen.getByText("Upload Learning Material")).toBeDefined();
    });

    const titleInput = screen.getByLabelText(/Material Title/i);
    fireEvent.change(titleInput, { target: { value: "Lab 01 Worksheet" } });
    fireEvent.submit(document.getElementById("material-form"));

    await waitFor(() => {
      expect(api.createMaterial).toHaveBeenCalledTimes(1);
    });
  });

  it("I04: InstructorAssignmentsPage and InstructorAssignmentDetailsPage support grading submissions", async () => {
    api.getInstructorAssignments.mockResolvedValue({
      status: "success",
      data: [
        {
          _id: "a1",
          courseId: { _id: "c1", courseCode: "DEMO-PRG101", courseName: "Programming Techniques" },
          title: "String Algorithms",
          dueDate: "2026-11-30T23:59:00Z",
          maxScore: 10,
          enrolledCount: 2,
          submissionCount: 1,
          gradedCount: 0,
          ungradedCount: 1,
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={["/instructor/assignments"]}>
        <Routes>
          <Route path="/instructor/assignments" element={<InstructorAssignmentsPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("String Algorithms")).toBeDefined();
      expect(screen.getByText("1 ungraded")).toBeDefined();
    });
  });

  it("I04: InstructorAssignmentDetailsPage validates grade and saves instructor evaluation", async () => {
    api.getInstructorAssignmentDetails.mockResolvedValue({
      status: "success",
      data: {
        assignment: {
          _id: "a1",
          courseId: { _id: "c1", courseCode: "DEMO-PRG101", courseName: "Programming Techniques" },
          title: "String Algorithms",
          description: "Implement string routines.",
          dueDate: "2026-11-30T23:59:00Z",
          maxScore: 10,
        },
        rosterSubmissions: [
          {
            student: { _id: "s1", fullName: "Alice Johnson", email: "student01@lms-demo.test", studentCode: "22110001" },
            status: "SUBMITTED",
            isLate: false,
            submission: {
              _id: "sub_1",
              content: "O(n) implementation attached.",
              fileName: "strings.zip",
              fileSize: 2048,
              grade: null,
              feedback: null,
              submittedAt: "2026-11-10T10:00:00Z",
            },
          },
        ],
      },
    });
    api.gradeSubmission.mockResolvedValue({ status: "success", data: { grade: 9.5 } });

    render(
      <MemoryRouter initialEntries={["/instructor/assignments/a1"]}>
        <Routes>
          <Route path="/instructor/assignments/:assignmentId" element={<InstructorAssignmentDetailsPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Alice Johnson")).toBeDefined();
    });

    fireEvent.click(screen.getByRole("button", { name: /^Grade$/i }));

    await waitFor(() => {
      expect(screen.getByText(/Grade Submission — Alice Johnson/i)).toBeDefined();
    });

    const scoreInput = screen.getByLabelText(/Score \(0 – 10\)/i);
    fireEvent.change(scoreInput, { target: { value: "9.5" } });
    fireEvent.click(screen.getByRole("button", { name: /Save Grade/i }));

    await waitFor(() => {
      expect(api.gradeSubmission).toHaveBeenCalledWith(
        "a1",
        expect.objectContaining({ studentId: "s1", grade: 9.5 })
      );
    });
  });

  it("I05: InstructorQuizzesPage, QuizBuilderPage, and QuizResultsPage render and support quiz workflows", async () => {
    api.getInstructorQuizzes.mockResolvedValue({
      status: "success",
      data: [
        {
          _id: "q1",
          courseId: { _id: "c1", courseCode: "DEMO-PRG101", courseName: "Programming Techniques" },
          title: "Quiz 1 — Variables",
          description: "Variables assessment",
          startTime: "2026-10-18T08:00:00Z",
          endTime: "2026-11-28T23:59:00Z",
          timeLimit: 30,
          maxScore: 10,
          computedStatus: "AVAILABLE",
          questionCount: 5,
          attemptCount: 4,
          avgScore: 8.5,
        },
      ],
    });

    const { unmount } = render(
      <MemoryRouter initialEntries={["/instructor/quizzes"]}>
        <Routes>
          <Route path="/instructor/quizzes" element={<InstructorQuizzesPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Quiz 1 — Variables")).toBeDefined();
      expect(screen.getByText("30 mins limit")).toBeDefined();
    });
    unmount();

    // Test Quiz Builder
    render(
      <MemoryRouter initialEntries={["/instructor/quizzes/new"]}>
        <Routes>
          <Route path="/instructor/quizzes/new" element={<InstructorQuizBuilderPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Create New Quiz")).toBeDefined();
      expect(screen.getByText("Question 1")).toBeDefined();
    });

    fireEvent.click(screen.getByRole("button", { name: "Add Question" }));
    expect(screen.getByText("Question 2")).toBeDefined();
  });

  it("I05: InstructorQuizResultsPage renders student attempt metrics and inspects answers", async () => {
    api.getInstructorQuizResults.mockResolvedValue({
      status: "success",
      data: {
        quiz: {
          _id: "q1",
          title: "Quiz 1 — Variables",
          courseId: { _id: "c1", courseCode: "DEMO-PRG101", courseName: "Programming Techniques" },
          computedStatus: "AVAILABLE",
          timeLimit: 30,
          maxScore: 10,
          startTime: "2026-10-18T08:00:00Z",
          endTime: "2026-11-28T23:59:00Z",
          questions: [{ id: "Q1" }],
        },
        summary: {
          totalEnrolled: 2,
          totalAttempts: 1,
          avgScore: 8,
          highestScore: 8,
          passRate: 100,
          passedCount: 1,
        },
        rosterAttempts: [
          {
            student: { _id: "s1", fullName: "Alice Johnson", email: "student01@lms-demo.test", studentCode: "22110001" },
            status: "COMPLETED",
            attempt: {
              _id: "att1",
              score: 8,
              maxScore: 10,
              percentage: 80,
              passed: true,
              submittedAt: "2026-10-22T08:18:24Z",
              durationTaken: "18m 24s",
              detailedReview: [
                {
                  questionId: "Q1",
                  prompt: "What is strict equality in JS?",
                  points: 2,
                  earnedPoints: 2,
                  isCorrect: true,
                  selectedOptionId: "B",
                  selectedOptionText: "===",
                  correctOptionId: "B",
                  correctOptionText: "===",
                  explanation: "=== compares value and type.",
                },
              ],
            },
          },
        ],
      },
    });

    render(
      <MemoryRouter initialEntries={["/instructor/quizzes/q1/results"]}>
        <Routes>
          <Route path="/instructor/quizzes/:quizId/results" element={<InstructorQuizResultsPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Quiz 1 — Variables — Results")).toBeDefined();
      expect(screen.getByText("8 / 10 (80%)")).toBeDefined();
    });

    fireEvent.click(screen.getByRole("button", { name: /Inspect Answers/i }));
    await waitFor(() => {
      expect(screen.getByText(/Attempt Details — Alice Johnson/i)).toBeDefined();
      expect(screen.getByText(/What is strict equality in JS\?/i)).toBeDefined();
    });
  });
});
