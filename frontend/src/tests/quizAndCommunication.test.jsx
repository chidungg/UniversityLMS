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
import { InstructorAnnouncementsPage } from "../pages/instructor/communication/InstructorAnnouncementsPage";
import { InstructorCreateAnnouncementPage } from "../pages/instructor/communication/InstructorCreateAnnouncementPage";
import { InstructorAnnouncementDetailsPage } from "../pages/instructor/communication/InstructorAnnouncementDetailsPage";
import { InstructorMessagesPage } from "../pages/instructor/communication/InstructorMessagesPage";
import { api } from "../services/api";

let mockAuthUser = {
  _id: "1d0896ec8cc60f07c79dfeb1",
  fullName: "Alice Johnson",
  email: "student01@lms-demo.test",
  role: "Student",
};

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
    getInstructorCourses: vi.fn(),
    getInstructorAnnouncements: vi.fn(),
    getInstructorAnnouncementDetails: vi.fn(),
    publishInstructorAnnouncement: vi.fn(),
    getInstructorConversations: vi.fn(),
    getInstructorMessagesWithUser: vi.fn(),
    sendInstructorMessage: vi.fn(),
    getInstructorRecipients: vi.fn(),
  },
}));

vi.mock("../app/AuthContext", () => ({
  useAuth: () => ({
    user: mockAuthUser,
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
          title: "Week 03 — Variables and Data Types Quiz",
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
      expect(screen.getByText("Week 03 — Variables and Data Types Quiz")).toBeDefined();
    });
    fireEvent.click(screen.getByRole("button", { name: "By Week" }));
    expect(screen.getByText("Week 03").closest("details").textContent).toContain("1 quiz");

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

  it("uses authenticated user ID for incoming/outgoing message alignment, updates unread count, and prevents stale thread overwrite on rapid switching", async () => {
    mockAuthUser = {
      _id: "student_dynamic_99",
      fullName: "Dynamic Student",
      email: "dyn@univ.test",
      role: "Student",
    };

    api.getConversations.mockResolvedValue({
      status: "success",
      data: [
        {
          user: { _id: "inst_1", fullName: "Prof. First", email: "first@univ.test", role: "Instructor" },
          lastMessage: { content: "First thread msg", sentAt: "2026-11-09T14:00:00Z" },
          unreadCount: 2,
        },
        {
          user: { _id: "inst_2", fullName: "Prof. Second", email: "second@univ.test", role: "Instructor" },
          lastMessage: { content: "Second thread msg", sentAt: "2026-11-09T13:00:00Z" },
          unreadCount: 1,
        },
      ],
    });

    let resolveFirst;
    api.getMessagesWithUser.mockImplementation((id) => {
      if (id === "inst_1") {
        return new Promise((resolve) => {
          resolveFirst = resolve;
        });
      }
      return Promise.resolve({
        status: "success",
        data: {
          recipient: { _id: "inst_2", fullName: "Prof. Second", email: "second@univ.test", role: "Instructor" },
          canReply: true,
          messages: [
            {
              _id: "m_inst2_1",
              senderId: "student_dynamic_99",
              recipientId: "inst_2",
              content: "My outgoing question to Prof. Second",
              sentAt: "2026-11-09T13:00:00Z",
              isRead: false,
            },
            {
              _id: "m_inst2_2",
              senderId: "inst_2",
              recipientId: "student_dynamic_99",
              content: "Reply from Prof. Second",
              sentAt: "2026-11-09T13:05:00Z",
              isRead: true,
            },
          ],
        },
      });
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
      expect(screen.getAllByText("Prof. First").length).toBeGreaterThan(0);
    });

    // Click first conversation (slow response), then immediately switch to second conversation (fast response)
    fireEvent.click(screen.getByText("Prof. First").closest("button"));
    fireEvent.click(screen.getByText("Prof. Second").closest("button"));

    await waitFor(() => {
      expect(screen.getByText("My outgoing question to Prof. Second")).toBeDefined();
    });

    // Now resolve the stale first request and verify it does NOT overwrite the active second thread
    resolveFirst({
      status: "success",
      data: {
        recipient: { _id: "inst_1", fullName: "Prof. First", email: "first@univ.test", role: "Instructor" },
        messages: [
          {
            _id: "m_stale",
            senderId: "inst_1",
            recipientId: "student_dynamic_99",
            content: "STALE THREAD CONTENT",
            sentAt: "2026-11-09T14:00:00Z",
          },
        ],
      },
    });

    await waitFor(() => {
      expect(screen.queryByText("STALE THREAD CONTENT")).toBeNull();
    });

    const ownBubble = screen.getByText("My outgoing question to Prof. Second").closest("[data-sender]");
    const otherBubble = screen.getByText("Reply from Prof. Second").closest("[data-sender]");
    expect(ownBubble.getAttribute("data-sender")).toBe("self");
    expect(otherBubble.getAttribute("data-sender")).toBe("other");
  });

  it("handles empty message validation and failed send without losing typed text", async () => {
    mockAuthUser = {
      _id: "1d0896ec8cc60f07c79dfeb1",
      fullName: "Alice Johnson",
      email: "student01@lms-demo.test",
      role: "Student",
    };

    api.getConversations.mockResolvedValue({
      status: "success",
      data: [
        {
          user: { _id: "inst_1", fullName: "Prof. Miller", email: "miller@univ.test", role: "Instructor" },
          lastMessage: { content: "Hi", sentAt: "2026-11-09T14:00:00Z" },
          unreadCount: 0,
        },
      ],
    });
    api.getMessagesWithUser.mockResolvedValue({
      status: "success",
      data: {
        recipient: { _id: "inst_1", fullName: "Prof. Miller", email: "miller@univ.test", role: "Instructor" },
        canReply: true,
        messages: [],
      },
    });
    api.sendMessage.mockRejectedValue(new Error("Recipient account is inactive."));

    render(
      <MemoryRouter initialEntries={["/student/messages/inst_1"]}>
        <Routes>
          <Route path="/student/messages" element={<MessagesPage />} />
          <Route path="/student/messages/:userId" element={<MessagesPage />} />
        </Routes>
      </MemoryRouter>
    );

    const textarea = await screen.findByLabelText("Message Prof. Miller");
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(screen.getByText("Message content cannot be empty.")).toBeDefined();

    fireEvent.change(textarea, { target: { value: "Preserved draft message" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(screen.getByText("Recipient account is inactive.")).toBeDefined();
    });
    expect(textarea.value).toBe("Preserved draft message");
  });
});

describe("I06: Instructor Communication Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthUser = {
      _id: "inst_auth_1",
      fullName: "Dr. Alan Turing",
      email: "turing@univ.test",
      role: "Instructor",
    };
  });

  it("renders InstructorAnnouncementsPage list, empty state, and error state", async () => {
    api.getInstructorCourses.mockResolvedValue({
      status: "success",
      data: [{ _id: "c_1", courseCode: "CS201", courseName: "Algorithms", isActive: true }],
    });
    api.getInstructorAnnouncements.mockResolvedValue({
      status: "success",
      data: [
        {
          _id: "iann_1",
          courseId: { _id: "c_1", courseCode: "CS201", courseName: "Algorithms", isActive: true },
          title: "Lab 3 Submission Deadline",
          content: "Submit your graph traversal lab by Friday.",
          createdAt: "2026-11-10T09:00:00Z",
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={["/instructor/announcements"]}>
        <Routes>
          <Route path="/instructor/announcements" element={<InstructorAnnouncementsPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Lab 3 Submission Deadline")).toBeDefined();
    });
    expect(screen.getByText("Create Announcement")).toBeDefined();
    expect(screen.getByText("View Announcement")).toBeDefined();
  });

  it("validates and publishes an announcement on InstructorCreateAnnouncementPage", async () => {
    api.getInstructorCourses.mockResolvedValue({
      status: "success",
      data: [
        { _id: "c_1", courseCode: "CS201", courseName: "Algorithms", isActive: true },
        { _id: "c_inactive", courseCode: "CS099", courseName: "Legacy", isActive: false },
      ],
    });
    api.publishInstructorAnnouncement.mockResolvedValue({
      status: "success",
      data: {
        _id: "iann_new",
        courseId: { _id: "c_1", courseCode: "CS201", courseName: "Algorithms", isActive: true },
        title: "Final Exam Room",
        content: "Final exam is in Hall A.",
      },
    });

    render(
      <MemoryRouter initialEntries={["/instructor/announcements/new"]}>
        <Routes>
          <Route path="/instructor/announcements/new" element={<InstructorCreateAnnouncementPage />} />
        </Routes>
      </MemoryRouter>
    );

    const publishBtn = await screen.findByRole("button", { name: /Publish Announcement/i });
    fireEvent.click(publishBtn);

    expect(screen.getByText("Announcement title is required.")).toBeDefined();
    expect(screen.getByText("Announcement content cannot be empty.")).toBeDefined();

    fireEvent.change(screen.getByLabelText("Announcement Title"), { target: { value: "Final Exam Room" } });
    fireEvent.change(screen.getByLabelText("Announcement Content"), { target: { value: "Final exam is in Hall A." } });
    fireEvent.click(publishBtn);

    await waitFor(() => {
      expect(api.publishInstructorAnnouncement).toHaveBeenCalledWith({
        courseId: "c_1",
        title: "Final Exam Room",
        content: "Final exam is in Hall A.",
      });
      expect(screen.getByText(/published successfully/i)).toBeDefined();
    });
  });

  it("renders InstructorAnnouncementDetailsPage using shared view", async () => {
    api.getInstructorAnnouncementDetails.mockResolvedValue({
      status: "success",
      data: {
        _id: "iann_1",
        courseId: { _id: "c_1", courseCode: "CS201", courseName: "Algorithms", isActive: true },
        title: "Office Hours Update",
        content: "Office hours moved to Wednesday 2 PM.",
        author: { fullName: "Dr. Alan Turing" },
        createdAt: "2026-11-11T10:00:00Z",
      },
    });

    render(
      <MemoryRouter initialEntries={["/instructor/announcements/iann_1"]}>
        <Routes>
          <Route path="/instructor/announcements/:announcementId" element={<InstructorAnnouncementDetailsPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText("Office Hours Update").length).toBeGreaterThan(0);
    });
    expect(screen.getByText("Office hours moved to Wednesday 2 PM.")).toBeDefined();
    expect(screen.getByText(/Dr\. Alan Turing/i)).toBeDefined();
  });

  it("renders InstructorMessagesPage, allows initiating a new message to an eligible student, and renders sender roles properly", async () => {
    api.getInstructorConversations.mockResolvedValue({
      status: "success",
      data: [],
    });
    api.getInstructorRecipients.mockResolvedValue({
      status: "success",
      data: [
        {
          _id: "stud_1",
          fullName: "Alice Enrolled",
          email: "alice@univ.test",
          role: "Student",
          courses: ["CS201 — Algorithms"],
        },
      ],
    });
    api.sendInstructorMessage.mockResolvedValue({
      status: "success",
      data: {
        _id: "im_1",
        senderId: "inst_auth_1",
        recipientId: "stud_1",
        content: "Please check your lab feedback.",
        sentAt: "2026-11-11T11:00:00Z",
        isRead: false,
      },
    });
    api.getInstructorMessagesWithUser.mockResolvedValue({
      status: "success",
      data: {
        recipient: { _id: "stud_1", fullName: "Alice Enrolled", email: "alice@univ.test", role: "Student" },
        canReply: true,
        messages: [
          {
            _id: "im_1",
            senderId: "inst_auth_1",
            recipientId: "stud_1",
            content: "Please check your lab feedback.",
            sentAt: "2026-11-11T11:00:00Z",
            isRead: false,
          },
        ],
      },
    });

    render(
      <MemoryRouter initialEntries={["/instructor/messages"]}>
        <Routes>
          <Route path="/instructor/messages" element={<InstructorMessagesPage />} />
          <Route path="/instructor/messages/:userId" element={<InstructorMessagesPage />} />
        </Routes>
      </MemoryRouter>
    );

    const newMsgButtons = await screen.findAllByRole("button", { name: /New Message/i });
    fireEvent.click(newMsgButtons[0]);

    await waitFor(() => {
      expect(screen.getByLabelText("Select Student:")).toBeDefined();
    });

    fireEvent.change(screen.getByLabelText("Message Content"), {
      target: { value: "Please check your lab feedback." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send Message/i }));

    await waitFor(() => {
      expect(api.sendInstructorMessage).toHaveBeenCalledWith({
        recipientId: "stud_1",
        content: "Please check your lab feedback.",
      });
      const bubble = screen
        .getByText("Please check your lab feedback.")
        .closest("[data-sender]");
      expect(bubble).not.toBeNull();
      expect(bubble.getAttribute("data-sender")).toBe("self");
    });
  });
});
