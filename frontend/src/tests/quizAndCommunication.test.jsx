import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QuizListPage } from "../pages/student/quizzes/QuizListPage";
import { QuizInstructionsPage } from "../pages/student/quizzes/QuizInstructionsPage";
import { TakeQuizPage } from "../pages/student/quizzes/TakeQuizPage";
import { QuizResultPage } from "../pages/student/quizzes/QuizResultPage";
import { AnnouncementsPage } from "../pages/student/communication/AnnouncementsPage";
import { AnnouncementDetailsPage } from "../pages/student/communication/AnnouncementDetailsPage";
import { MessagesPage } from "../pages/student/communication/MessagesPage";
import { api } from "../services/api";

vi.mock("../services/api", () => ({
  api: {
    getCourses: vi.fn(),
    getQuizzes: vi.fn(),
    getQuizDetails: vi.fn(),
    startQuiz: vi.fn(),
    submitQuiz: vi.fn(),
    getQuizResult: vi.fn(),
    getAnnouncements: vi.fn(),
    getAnnouncementDetails: vi.fn(),
    getConversations: vi.fn(),
    getMessagesWithUser: vi.fn(),
    sendMessage: vi.fn(),
    getRecipients: vi.fn(),
  },
}));

vi.mock("../app/AuthContext", () => ({
  useAuth: () => ({
    user: {
      _id: "1d0896ec8cc60f07c79dfeb1",
      fullName: "Alice Johnson",
      email: "student01@lms-demo.test",
      role: "Student",
    },
    isAuthenticated: true,
  }),
}));

window.HTMLElement.prototype.scrollIntoView = vi.fn();

describe("S03: Quiz Assessment Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getCourses.mockResolvedValue({
      status: "success",
      data: [{ _id: "course_1", courseCode: "CS101", courseName: "Programming" }],
    });
  });

  it("renders QuizListPage with quiz cards, time limits, and question counts", async () => {
    api.getQuizzes.mockResolvedValue({
      status: "success",
      data: [
        {
          _id: "quiz_1",
          courseId: { _id: "course_1", courseCode: "CS101", courseName: "Programming" },
          title: "Variables and Data Types Quiz",
          description: "Assessment on variables and types.",
          timeLimit: 30,
          maxScore: 10,
          status: "AVAILABLE",
          startTime: "2026-10-01T08:00:00Z",
          endTime: "2026-11-30T23:59:00Z",
          questions: [1, 2, 3, 4, 5],
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={["/student/quizzes"]}>
        <Routes>
          <Route path="/student/quizzes" element={<QuizListPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Variables and Data Types Quiz")).toBeDefined();
    });

    expect(screen.getByText("30 mins limit")).toBeDefined();
    expect(screen.getByText("5 questions")).toBeDefined();
    expect(screen.getByText("Start Quiz")).toBeDefined();
  });

  it("renders QuizInstructionsPage with attempt parameters and start button", async () => {
    api.getQuizDetails.mockResolvedValue({
      status: "success",
      data: {
        _id: "quiz_1",
        title: "Variables and Data Types Quiz",
        description: "Review your understanding of variables before starting.",
        courseId: { _id: "course_1", courseCode: "CS101", courseName: "Programming" },
        timeLimit: 30,
        maxScore: 10,
        status: "AVAILABLE",
        startTime: "2026-10-01T08:00:00Z",
        endTime: "2026-11-30T23:59:00Z",
        questionCount: 5,
      },
    });

    render(
      <MemoryRouter initialEntries={["/student/quizzes/quiz_1"]}>
        <Routes>
          <Route path="/student/quizzes/:quizId" element={<QuizInstructionsPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText("Variables and Data Types Quiz").length).toBeGreaterThan(0);
    });

    expect(screen.getByText("30 Minutes")).toBeDefined();
    expect(screen.getByText("Start Quiz Attempt")).toBeDefined();
  });

  it("renders TakeQuizPage and allows selecting answers and opening confirmation dialog", async () => {
    api.startQuiz.mockResolvedValue({
      status: "success",
      data: {
        quizId: "quiz_1",
        title: "Variables Quiz",
        course: { courseCode: "CS101" },
        timeLimit: 25,
        questions: [
          {
            id: "Q1",
            prompt: "What is typeof null?",
            points: 2,
            options: [
              { id: "A", text: "null" },
              { id: "B", text: "object" },
            ],
          },
          {
            id: "Q2",
            prompt: "Which keyword is block-scoped?",
            points: 2,
            options: [
              { id: "A", text: "let" },
              { id: "B", text: "var" },
            ],
          },
        ],
      },
    });

    render(
      <MemoryRouter initialEntries={["/student/quizzes/quiz_1/attempt"]}>
        <Routes>
          <Route path="/student/quizzes/:quizId/attempt" element={<TakeQuizPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("What is typeof null?")).toBeDefined();
    });

    // Select option B for Q1
    const radioOption = screen.getByDisplayValue("B");
    fireEvent.click(radioOption);

    // Click Submit Quiz button
    const submitBtn = screen.getByRole("button", { name: /Submit Quiz/i });
    fireEvent.click(submitBtn);

    // Confirmation modal should appear with warning for unanswered questions
    await waitFor(() => {
      expect(screen.getByText("Confirm Quiz Submission")).toBeDefined();
      expect(screen.getByText(/You have 1 unanswered question/i)).toBeDefined();
    });
  });

  it("renders QuizResultPage with score, percentage, and detailed answer review", async () => {
    api.getQuizResult.mockResolvedValue({
      status: "success",
      data: {
        _id: "attempt_1",
        quizTitle: "Variables Quiz",
        courseCode: "CS101",
        score: 8,
        maxScore: 10,
        percentage: 80,
        passed: true,
        durationTaken: "14m 10s",
        submittedAt: "2026-11-10T12:00:00Z",
        detailedReview: [
          {
            questionId: "Q1",
            prompt: "What is typeof null?",
            points: 2,
            earnedPoints: 2,
            isCorrect: true,
            selectedOptionId: "B",
            selectedOptionText: "object",
            correctOptionId: "B",
            correctOptionText: "object",
            explanation: "In JS, typeof null returns 'object'.",
          },
        ],
      },
    });

    render(
      <MemoryRouter initialEntries={["/student/quiz-attempts/attempt_1/result"]}>
        <Routes>
          <Route path="/student/quiz-attempts/:attemptId/result" element={<QuizResultPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("8 / 10 pts")).toBeDefined();
    });

    expect(screen.getByText("80% Academic Grade")).toBeDefined();
    expect(screen.getByText("What is typeof null?")).toBeDefined();
    expect(screen.getByText("B. object")).toBeDefined();
  });
});

describe("S04: Student Communication Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getCourses.mockResolvedValue({
      status: "success",
      data: [{ _id: "course_1", courseCode: "CS101", courseName: "Programming" }],
    });
  });

  it("renders AnnouncementsPage and opens full reading modal", async () => {
    api.getAnnouncements.mockResolvedValue({
      status: "success",
      data: [
        {
          _id: "ann_1",
          courseId: { _id: "course_1", courseCode: "CS101", courseName: "Programming" },
          title: "Exam Schedule Notice",
          content: "The final exam is on December 15 in Room 401.",
          author: { fullName: "Prof. Miller" },
          createdAt: "2026-11-08T09:00:00Z",
          isRead: false,
        },
      ],
    });
    api.getAnnouncementDetails.mockResolvedValue({
      status: "success",
      data: { _id: "ann_1", title: "Exam Schedule Notice", content: "The final exam is on December 15." },
    });

    render(
      <MemoryRouter initialEntries={["/student/announcements"]}>
        <Routes>
          <Route path="/student/announcements" element={<AnnouncementsPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Exam Schedule Notice")).toBeDefined();
    });

    expect(screen.getByText("The final exam is on December 15 in Room 401.")).toBeDefined();

    // Click "Read Full Announcement"
    const readBtn = screen.getByText("Read Full Announcement");
    fireEvent.click(readBtn);

    await waitFor(() => {
      expect(screen.getByText("Open Standalone Page")).toBeDefined();
    });
  });

  it("renders AnnouncementDetailsPage with complete text and publication date", async () => {
    api.getAnnouncementDetails.mockResolvedValue({
      status: "success",
      data: {
        _id: "ann_1",
        courseId: { _id: "course_1", courseCode: "CS101", courseName: "Programming" },
        title: "Extended Lecture Hours",
        content: "There will be an additional review session on Thursday afternoon.",
        author: { fullName: "Prof. Miller" },
        createdAt: "2026-11-09T10:00:00Z",
      },
    });

    render(
      <MemoryRouter initialEntries={["/student/announcements/ann_1"]}>
        <Routes>
          <Route path="/student/announcements/:announcementId" element={<AnnouncementDetailsPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText("Extended Lecture Hours").length).toBeGreaterThan(0);
    });

    expect(screen.getByText("There will be an additional review session on Thursday afternoon.")).toBeDefined();
    expect(screen.getByText(/Prof. Miller/i)).toBeDefined();
  });

  it("renders MessagesPage with conversation list and allows composing a message", async () => {
    api.getConversations.mockResolvedValue({
      status: "success",
      data: [
        {
          user: {
            _id: "inst_1",
            fullName: "Instructor David Miller",
            email: "dmiller@univ.test",
          },
          lastMessage: { content: "See you in class tomorrow.", sentAt: "2026-11-09T14:00:00Z" },
          unreadCount: 1,
        },
      ],
    });

    api.getMessagesWithUser.mockResolvedValue({
      status: "success",
      data: {
        recipient: { _id: "inst_1", fullName: "Instructor David Miller" },
        messages: [
          {
            _id: "m_1",
            senderId: "inst_1",
            recipientId: "1d0896ec8cc60f07c79dfeb1",
            content: "Hello Alice, let me know if you need any help with project.",
            sentAt: "2026-11-09T10:00:00Z",
          },
        ],
      },
    });

    api.sendMessage.mockResolvedValue({
      status: "success",
      data: { _id: "m_2", content: "Thank you Professor!" },
    });

    render(
      <MemoryRouter initialEntries={["/student/messages"]}>
        <Routes>
          <Route path="/student/messages" element={<MessagesPage />} />
          <Route path="/student/messages/:userId" element={<MessagesPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText("Instructor David Miller").length).toBeGreaterThan(0);
    });

    // Select the conversation button in the list
    const convButtons = screen.getAllByText("Instructor David Miller");
    fireEvent.click(convButtons[0]);

    await waitFor(() => {
      expect(screen.getByText("Hello Alice, let me know if you need any help with project.")).toBeDefined();
    });
  });
});
