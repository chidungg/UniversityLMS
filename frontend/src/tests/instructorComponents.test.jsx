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
    getInstructorCourseStudents: vi.fn(),
    getInstructorMaterials: vi.fn(),
    createMaterial: vi.fn(),
    updateMaterial: vi.fn(),
    deleteMaterial: vi.fn(),
    downloadInstructorMaterialBlob: vi.fn(),
    getInstructorAssignments: vi.fn(),
    getInstructorAssignmentDetails: vi.fn(),
    getInstructorAssignmentSubmission: vi.fn(),
    downloadInstructorSubmissionBlob: vi.fn(),
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

  it("I01 opens the selected course and shows its three management options", async () => {
    api.getInstructorCourseDetails.mockResolvedValue({
      status: "success",
      data: { course: sampleCourse, managementOptions: ["materials", "assignments", "quizzes"] },
    });
    render(
      <MemoryRouter initialEntries={["/instructor/courses"]}>
        <Routes>
          <Route path="/instructor/courses" element={<InstructorCoursesPage />} />
          <Route path="/instructor/courses/:courseId" element={<InstructorCourseDetailsPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Programming Techniques")).toBeDefined();
      expect(screen.getByText("2 Students")).toBeDefined();
    });

    fireEvent.click(screen.getByRole("link", { name: /Open Workspace/i }));
    expect((await screen.findByRole("link", { name: /Learning Materials/i })).getAttribute("href"))
      .toBe("/instructor/courses/c1/materials");
    expect(screen.getByRole("link", { name: /Assignments & Grading/i }).getAttribute("href"))
      .toBe("/instructor/assignments?courseId=c1");
    expect(screen.getByRole("link", { name: /Quizzes & Assessments/i }).getAttribute("href"))
      .toBe("/instructor/quizzes?courseId=c1");
    expect(screen.queryByRole("button", { name: /Edit Course/i })).toBeNull();
  });

  it("I01 shows the unavailable-course response and a return link", async () => {
    api.getInstructorCourseDetails.mockRejectedValueOnce(
      Object.assign(new Error("This course is no longer available to you."), { status: 404 })
    );
    render(
      <MemoryRouter initialEntries={["/instructor/courses/c1"]}>
        <Routes>
          <Route path="/instructor/courses/:courseId" element={<InstructorCourseDetailsPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect((await screen.findByRole("alert")).textContent).toContain("no longer available");
    expect(screen.getByRole("link", { name: "Back to Assigned Courses" }).getAttribute("href")).toBe("/instructor/courses");
    expect(screen.queryByRole("link", { name: /Learning Materials/i })).toBeNull();
  });

  it("I02 loads the selected course roster when opening Enrolled Students and filters by email", async () => {
    api.getInstructorCourseDetails.mockResolvedValue({
      status: "success",
      data: { course: sampleCourse },
    });
    api.getInstructorCourseStudents.mockResolvedValueOnce({
      status: "success",
      data: [{ _id: "s1", fullName: "Alice Johnson", email: "student01@lms-demo.test", enrolledAt: "2026-09-12T08:00:00Z" }],
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
    expect(api.getInstructorCourseStudents).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("tab", { name: /Enrolled Students/i }));

    expect(await screen.findByText("Alice Johnson")).toBeDefined();
    expect(screen.getByText("student01@lms-demo.test")).toBeDefined();
    expect(api.getInstructorCourseStudents).toHaveBeenCalledWith("c1", { signal: expect.any(AbortSignal) });

    const search = screen.getByRole("searchbox", { name: "Search enrolled students" });
    fireEvent.change(search, { target: { value: "different" } });
    expect(screen.getByText("No matching students")).toBeDefined();
    fireEvent.change(search, { target: { value: "STUDENT01" } });
    expect(screen.getByText("Alice Johnson")).toBeDefined();
    expect(api.getInstructorCourseStudents).toHaveBeenCalledTimes(1);
  });

  it("I02 shows a roster error separately from an empty roster and can retry", async () => {
    api.getInstructorCourseDetails.mockResolvedValue({ status: "success", data: { course: sampleCourse } });
    api.getInstructorCourseStudents.mockRejectedValueOnce(new Error("Roster request failed"));
    api.getInstructorCourseStudents.mockResolvedValueOnce({ status: "success", data: [] });

    render(
      <MemoryRouter initialEntries={["/instructor/classes/c1?tab=students"]}>
        <Routes>
          <Route path="/instructor/classes/:courseId" element={<InstructorCourseDetailsPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect((await screen.findByRole("alert")).textContent).toContain("Roster request failed");
    expect(screen.queryByText("No students enrolled yet")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("No students enrolled yet")).toBeDefined();
    expect(api.getInstructorCourseDetails).toHaveBeenCalledTimes(1);
    expect(api.getInstructorCourseStudents).toHaveBeenCalledTimes(2);
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
    const file = new File(["Worksheet contents"], "worksheet.txt", { type: "text/plain" });
    fireEvent.change(screen.getByLabelText("Attach File"), { target: { files: [file] } });
    fireEvent.submit(document.getElementById("material-form"));

    await waitFor(() => {
      expect(api.createMaterial).toHaveBeenCalledWith(
        expect.objectContaining({ courseId: "c1", title: "Lab 01 Worksheet", file })
      );
      expect(api.getInstructorMaterials).toHaveBeenCalledTimes(2);
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
              hasFile: true,
              fileSize: 2048,
              grade: null,
              feedback: null,
              submittedAt: "2026-11-10T10:00:00Z",
              revision: 0,
            },
          },
          { student: { _id: "s2", fullName: "Bob Lee", email: "student02@lms-demo.test" }, status: "NOT_SUBMITTED", submission: null },
        ],
      },
    });
    api.gradeSubmission.mockResolvedValue({ status: "success", data: { grade: 0 } });
    api.getInstructorAssignmentSubmission.mockResolvedValue({
      status: "success",
      data: { _id: "sub_1", content: "Reviewed source", hasFile: true, fileName: "strings.zip", grade: null, revision: 0 },
    });

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
    expect(screen.getByText("Bob Lee")).toBeDefined();
    expect(screen.queryByRole("button", { name: /^Record Grade$/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /^Grade$/i }));

    await waitFor(() => {
      expect(screen.getByText(/Grade Submission — Alice Johnson/i)).toBeDefined();
    });

    const scoreInput = await screen.findByLabelText(/Score \(0 – 10\)/i);
    expect(api.getInstructorAssignmentSubmission).toHaveBeenCalledWith("a1", "sub_1", { signal: expect.any(AbortSignal) });
    fireEvent.change(scoreInput, { target: { value: "11" } });
    fireEvent.click(screen.getByRole("button", { name: /Save Grade/i }));
    expect(await screen.findByText("Grade must be between 0 and 10.")).toBeDefined();
    expect(api.gradeSubmission).not.toHaveBeenCalled();

    fireEvent.change(scoreInput, { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: /Save Grade/i }));

    await waitFor(() => {
      expect(api.gradeSubmission).toHaveBeenCalledWith(
        "a1",
        "sub_1",
        expect.objectContaining({ grade: 0, revision: 0 })
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

  it("I05 edits metadata while questions and timing are locked by a Student attempt", async () => {
    api.getInstructorQuizDetails.mockResolvedValueOnce({
      status: "success",
      data: {
        _id: "q1", courseId: sampleCourse, title: "Existing Quiz", description: "Original instructions",
        startTime: "2026-11-06T18:30:00Z", endTime: "2026-11-07T18:30:00Z", timeLimit: 30, hasAttempts: true,
        questions: [{ id: "stable-id", prompt: "Existing question", points: 3, correctOptionId: "B", options: [{ id: "A", text: "First" }, { id: "B", text: "Second" }] }],
      },
    });
    api.updateQuiz.mockResolvedValueOnce({ status: "success", message: "Quiz updated successfully." });
    render(
      <MemoryRouter initialEntries={["/instructor/quizzes/q1/edit"]}>
        <Routes>
          <Route path="/instructor/quizzes/:quizId/edit" element={<InstructorQuizBuilderPage />} />
          <Route path="/instructor/quizzes" element={<div>Saved quiz list</div>} />
        </Routes>
      </MemoryRouter>
    );

    const title = await screen.findByLabelText("Quiz Title *");
    expect(screen.getByLabelText("Time Limit (Minutes) *").disabled).toBe(true);
    expect(screen.getByLabelText("Question Prompt *").closest("fieldset").disabled).toBe(true);
    fireEvent.change(title, { target: { value: "Updated Quiz" } });
    fireEvent.submit(title.closest("form"));
    expect(await screen.findByText("Saved quiz list")).toBeDefined();
    expect(api.updateQuiz).toHaveBeenCalledWith("q1", { title: "Updated Quiz", description: "Original instructions" });
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
