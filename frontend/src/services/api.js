import {
  mockCourses,
  mockMaterials,
  mockAssignments,
  mockAnnouncements,
  mockQuizzes,
  mockQuizAttempts,
  mockRecipients,
  mockMessages,
} from "./mockData";

const API_BASE = "/api";

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

// In-memory state for UI/UX testing so user actions persist live in session
let liveAssignments = [...mockAssignments];
let liveMaterials = [...mockMaterials];
let liveQuizzes = [...mockQuizzes];
let liveQuizAttempts = [...mockQuizAttempts];
let liveAnnouncements = [...mockAnnouncements];
let liveMessages = [...mockMessages];

async function request(endpoint, options = {}) {
  const token = localStorage.getItem("lms_token");
  const headers = {
    ...options.headers,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get("content-type");
  if (options.responseType === "blob") {
    if (!response.ok) {
      const errText = await response.text();
      throw new ApiError(errText || "Download failed", response.status);
    }
    return response.blob();
  }

  let data;
  if (contentType && contentType.includes("application/json")) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorMsg =
      (data && typeof data === "object" && data.message) ||
      (typeof data === "string" && data) ||
      `Request failed with status ${response.status}`;
    throw new ApiError(errorMsg, response.status, data);
  }

  return data;
}

export const api = {
  // Auth
  login: async (email, _password) => {
    try {
      return await request("/auth/login", {
        method: "POST",
        body: { email, password: _password },
      });
    } catch {
      // Seamless mock login fallback
      return {
        status: "success",
        token: "mock-student-jwt-token-2026",
        user: {
          _id: "1d0896ec8cc60f07c79dfeb1",
          email: email || "student01@lms-demo.test",
          fullName: "Alice Johnson",
          role: "Student",
          isActive: true,
        },
      };
    }
  },

  getMe: async () => {
    try {
      return await request("/auth/me");
    } catch {
      return {
        status: "success",
        user: {
          _id: "1d0896ec8cc60f07c79dfeb1",
          email: "student01@lms-demo.test",
          fullName: "Alice Johnson",
          role: "Student",
          isActive: true,
        },
      };
    }
  },

  // S01: Dashboard
  getDashboard: async () => {
    try {
      return await request("/student/dashboard");
    } catch {
      const upcoming = liveAssignments
        .filter((a) => a.status === "PENDING" || a.status === "SUBMITTED")
        .slice(0, 5);

      const pendingCount = liveAssignments.filter((a) => a.status === "PENDING").length;
      const submittedCount = liveAssignments.filter(
        (a) => a.status === "SUBMITTED" || a.status === "GRADED"
      ).length;

      return {
        status: "success",
        data: {
          courses: mockCourses,
          upcomingAssignments: upcoming,
          recentAnnouncements: mockAnnouncements,
          stats: {
            totalCourses: mockCourses.length,
            pendingAssignments: pendingCount,
            submittedAssignments: submittedCount,
          },
        },
      };
    }
  },

  // S01: My Courses
  getCourses: async (params = {}) => {
    try {
      const query = new URLSearchParams(params).toString();
      return await request(`/student/courses${query ? `?${query}` : ""}`);
    } catch {
      let filtered = [...mockCourses];
      const { q, status } = params;

      if (status === "active") {
        filtered = filtered.filter((c) => c.isActive);
      } else if (status === "inactive") {
        filtered = filtered.filter((c) => !c.isActive);
      }

      if (q && q.trim()) {
        const term = q.trim().toLowerCase();
        filtered = filtered.filter(
          (c) =>
            c.courseCode.toLowerCase().includes(term) ||
            c.courseName.toLowerCase().includes(term) ||
            (c.description && c.description.toLowerCase().includes(term))
        );
      }

      return {
        status: "success",
        data: filtered,
      };
    }
  },

  // S01: Course Details
  getCourseDetails: async (courseId) => {
    try {
      return await request(`/student/courses/${courseId}`);
    } catch {
      const course = mockCourses.find((c) => c._id === courseId) || mockCourses[0];
      const materialsInCourse = liveMaterials.filter(
        (m) => m.courseId._id === course._id || m.courseId === course._id
      );
      const assignmentsInCourse = liveAssignments.filter(
        (a) => a.courseId._id === course._id || a.courseId === course._id
      );

      return {
        status: "success",
        data: {
          ...course,
          materialCount: materialsInCourse.length,
          assignmentCount: assignmentsInCourse.length,
          announcementCount: 2,
        },
      };
    }
  },

  // S01: Materials
  getMaterials: async (courseId, params = {}) => {
    try {
      const query = new URLSearchParams(params).toString();
      return await request(`/student/courses/${courseId}/materials${query ? `?${query}` : ""}`);
    } catch {
      const course = mockCourses.find((c) => c._id === courseId) || mockCourses[0];
      let filtered = liveMaterials.filter(
        (m) => m.courseId._id === course._id || m.courseId === course._id
      );

      if (params.type && params.type !== "all") {
        filtered = filtered.filter((m) => m.type === params.type);
      }

      return {
        status: "success",
        course,
        data: filtered,
      };
    }
  },

  getMaterial: async (materialId) => {
    try {
      return await request(`/student/materials/${materialId}`);
    } catch {
      const material = liveMaterials.find((m) => m._id === materialId) || liveMaterials[0];
      return {
        status: "success",
        data: material,
      };
    }
  },

  downloadMaterialBlob: async (materialId) => {
    try {
      return await request(`/student/materials/${materialId}/download`, {
        responseType: "blob",
      });
    } catch {
      const material = liveMaterials.find((m) => m._id === materialId) || liveMaterials[0];
      const content = `======================================================
UNIVERSITY LMS - ACADEMIC LEARNING MATERIAL
======================================================
Course: ${material.courseId?.courseCode || "COURSE"} - ${material.courseId?.courseName || ""}
Title:  ${material.title}
Type:   ${material.type}
Date:   ${new Date(material.uploadedAt).toLocaleString("en-US")}
------------------------------------------------------
DESCRIPTION & SYLLABUS NOTES:
${material.description}
======================================================
Downloaded from University LMS Student Portal.
`;
      return new Blob([content], { type: "text/plain;charset=utf-8" });
    }
  },

  // S02: Assignments
  getAssignments: async (params = {}) => {
    try {
      const query = new URLSearchParams(params).toString();
      return await request(`/student/assignments${query ? `?${query}` : ""}`);
    } catch {
      let filtered = [...liveAssignments];
      const { courseId, status, q } = params;

      if (courseId) {
        filtered = filtered.filter(
          (a) => a.courseId._id === courseId || a.courseId === courseId
        );
      }

      if (status && status !== "ALL") {
        filtered = filtered.filter((a) => a.status === status);
      }

      if (q && q.trim()) {
        const term = q.trim().toLowerCase();
        filtered = filtered.filter(
          (a) =>
            a.title.toLowerCase().includes(term) ||
            (a.description && a.description.toLowerCase().includes(term))
        );
      }

      return {
        status: "success",
        data: filtered,
      };
    }
  },

  getAssignmentDetails: async (assignmentId) => {
    try {
      return await request(`/student/assignments/${assignmentId}`);
    } catch {
      const assignment = liveAssignments.find((a) => a._id === assignmentId) || liveAssignments[0];
      return {
        status: "success",
        data: assignment,
      };
    }
  },

  submitAssignment: async (assignmentId, payload) => {
    try {
      return await request(`/student/assignments/${assignmentId}/submit`, {
        method: "POST",
        body: payload,
      });
    } catch {
      let contentText = "";
      let fileName = null;

      if (payload instanceof FormData) {
        contentText = payload.get("content") || "";
        const file = payload.get("file");
        if (file && file.name) {
          fileName = file.name;
        }
      } else if (payload && typeof payload === "object") {
        contentText = payload.content || "";
        fileName = payload.fileName || null;
      }

      const assignmentIndex = liveAssignments.findIndex((a) => a._id === assignmentId);
      const submissionData = {
        _id: `sub_${Date.now()}`,
        submittedAt: new Date().toISOString(),
        content: contentText,
        fileName: fileName || "student_solution.txt",
        fileUrl: fileName ? `/uploads/submissions/${fileName}` : null,
        grade: null,
        feedback: null,
      };

      if (assignmentIndex >= 0) {
        liveAssignments[assignmentIndex] = {
          ...liveAssignments[assignmentIndex],
          submission: submissionData,
          status: "SUBMITTED",
        };
      }

      return {
        status: "success",
        message: "Assignment submitted successfully.",
        data: submissionData,
      };
    }
  },

  getSubmissionDetails: async (submissionId) => {
    try {
      return await request(`/student/submissions/${submissionId}`);
    } catch {
      const found = liveAssignments.find((a) => a.submission && a.submission._id === submissionId);
      return {
        status: "success",
        data: found?.submission || liveAssignments[0].submission,
      };
    }
  },

  // S05: Global Search
  search: async (params = {}) => {
    try {
      const query = new URLSearchParams(params).toString();
      return await request(`/student/search${query ? `?${query}` : ""}`);
    } catch {
      const { q, category } = params;

      if (!q || !q.trim()) {
        throw new ApiError("Search keyword is required.", 400);
      }

      const term = q.trim().toLowerCase();

      const matchingCourses = mockCourses.filter(
        (c) =>
          c.courseCode.toLowerCase().includes(term) ||
          c.courseName.toLowerCase().includes(term) ||
          (c.description && c.description.toLowerCase().includes(term))
      );

      const matchingMaterials = liveMaterials.filter(
        (m) =>
          m.title.toLowerCase().includes(term) ||
          (m.description && m.description.toLowerCase().includes(term)) ||
          m.type.toLowerCase().includes(term)
      );

      const matchingAssignments = liveAssignments.filter(
        (a) =>
          a.title.toLowerCase().includes(term) ||
          (a.description && a.description.toLowerCase().includes(term))
      );

      const counts = {
        courses: matchingCourses.length,
        materials: matchingMaterials.length,
        assignments: matchingAssignments.length,
        total: matchingCourses.length + matchingMaterials.length + matchingAssignments.length,
      };

      return {
        status: "success",
        keyword: q,
        data: {
          courses: !category || category === "all" || category === "courses" ? matchingCourses : [],
          materials: !category || category === "all" || category === "materials" ? matchingMaterials : [],
          assignments: !category || category === "all" || category === "assignments" ? matchingAssignments : [],
          counts,
        },
      };
    }
  },

  // S03: Quizzes Assessment
  getQuizzes: async (params = {}) => {
    try {
      const query = new URLSearchParams(params).toString();
      return await request(`/student/quizzes${query ? `?${query}` : ""}`);
    } catch {
      let filtered = [...liveQuizzes];

      if (params.courseId) {
        filtered = filtered.filter(
          (q) => (q.courseId?._id || q.courseId) === params.courseId
        );
      }

      if (params.status && params.status !== "ALL") {
        filtered = filtered.filter((q) => q.status === params.status);
      }

      if (params.q && params.q.trim()) {
        const term = params.q.trim().toLowerCase();
        filtered = filtered.filter(
          (q) =>
            q.title.toLowerCase().includes(term) ||
            q.courseId?.courseCode?.toLowerCase().includes(term) ||
            (q.description && q.description.toLowerCase().includes(term))
        );
      }

      return {
        status: "success",
        data: filtered,
      };
    }
  },

  getQuizDetails: async (quizId) => {
    try {
      return await request(`/student/quizzes/${quizId}`);
    } catch {
      const quiz = liveQuizzes.find((q) => q._id === quizId);
      if (!quiz) {
        throw new ApiError("Quiz not found.", 404);
      }

      // Safe view: hide answer keys before attempt submission
      const safeQuestions = (quiz.questions || []).map((q) => ({
        id: q.id,
        prompt: q.prompt,
        type: q.type,
        points: q.points,
        options: q.options,
      }));

      return {
        status: "success",
        data: {
          ...quiz,
          questions: safeQuestions,
          questionCount: quiz.questions?.length || 0,
        },
      };
    }
  },

  startQuiz: async (quizId) => {
    try {
      return await request(`/student/quizzes/${quizId}/start`, { method: "POST" });
    } catch {
      const quizIndex = liveQuizzes.findIndex((q) => q._id === quizId);
      if (quizIndex === -1) {
        throw new ApiError("Quiz not found.", 404);
      }

      const quiz = liveQuizzes[quizIndex];
      if (quiz.status === "EXPIRED") {
        throw new ApiError("This quiz has already closed.", 400);
      }

      if (quiz.status === "UPCOMING") {
        throw new ApiError("This quiz has not opened yet.", 400);
      }

      // If available, transition to IN_PROGRESS
      if (quiz.status === "AVAILABLE") {
        liveQuizzes[quizIndex] = {
          ...quiz,
          status: "IN_PROGRESS",
        };
      }

      const safeQuestions = (quiz.questions || []).map((q) => ({
        id: q.id,
        prompt: q.prompt,
        type: q.type,
        points: q.points,
        options: q.options,
      }));

      return {
        status: "success",
        message: "Quiz attempt started successfully.",
        data: {
          quizId: quiz._id,
          title: quiz.title,
          course: quiz.courseId,
          timeLimit: quiz.timeLimit,
          startedAt: new Date().toISOString(),
          questions: safeQuestions,
        },
      };
    }
  },

  submitQuiz: async (quizId, answers = {}) => {
    try {
      return await request(`/student/quizzes/${quizId}/submit`, {
        method: "POST",
        body: { answers },
      });
    } catch {
      const quizIndex = liveQuizzes.findIndex((q) => q._id === quizId);
      if (quizIndex === -1) {
        throw new ApiError("Quiz not found.", 404);
      }

      const quiz = liveQuizzes[quizIndex];
      const questions = quiz.questions || [];

      let score = 0;
      let totalPoints = 0;
      const detailedReview = [];

      questions.forEach((q) => {
        totalPoints += q.points || 2;
        const selectedOptionId = answers[q.id];
        const isCorrect = selectedOptionId === q.correctOptionId;
        const earnedPoints = isCorrect ? q.points || 2 : 0;
        score += earnedPoints;

        const selectedOpt = q.options?.find((o) => o.id === selectedOptionId);
        const correctOpt = q.options?.find((o) => o.id === q.correctOptionId);

        detailedReview.push({
          questionId: q.id,
          prompt: q.prompt,
          points: q.points || 2,
          earnedPoints,
          isCorrect,
          selectedOptionId: selectedOptionId || null,
          selectedOptionText: selectedOpt ? selectedOpt.text : "No answer selected",
          correctOptionId: q.correctOptionId,
          correctOptionText: correctOpt ? correctOpt.text : "",
          explanation: q.explanation || (isCorrect ? "Correct answer." : "Incorrect selection."),
        });
      });

      const attemptId = `att_${Date.now()}`;
      const percentage = totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0;

      const newAttempt = {
        _id: attemptId,
        quizId: quiz._id,
        studentId: "1d0896ec8cc60f07c79dfeb1",
        quizTitle: quiz.title,
        courseCode: quiz.courseId?.courseCode,
        courseName: quiz.courseId?.courseName,
        score,
        maxScore: totalPoints,
        percentage,
        passed: percentage >= 50,
        startedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        submittedAt: new Date().toISOString(),
        durationTaken: "15m 00s",
        answers: Object.entries(answers).map(([qId, optId]) => ({
          questionId: qId,
          selectedOptionId: optId,
        })),
        detailedReview,
      };

      liveQuizAttempts.unshift(newAttempt);

      // Mark quiz as COMPLETED
      liveQuizzes[quizIndex] = {
        ...quiz,
        status: "COMPLETED",
        attemptId,
      };

      return {
        status: "success",
        message: "Quiz submitted successfully.",
        data: newAttempt,
      };
    }
  },

  getQuizResult: async (attemptId) => {
    try {
      return await request(`/student/quiz-attempts/${attemptId}/result`);
    } catch {
      const attempt = liveQuizAttempts.find((a) => a._id === attemptId);
      if (!attempt) {
        throw new ApiError("Quiz attempt result not found.", 404);
      }
      return {
        status: "success",
        data: attempt,
      };
    }
  },

  // S04: Student Communication — Announcements
  getAnnouncements: async (params = {}) => {
    try {
      const query = new URLSearchParams(params).toString();
      return await request(`/student/announcements${query ? `?${query}` : ""}`);
    } catch {
      let filtered = [...liveAnnouncements];

      if (params.courseId) {
        filtered = filtered.filter(
          (a) => (a.courseId?._id || a.courseId) === params.courseId
        );
      }

      if (params.q && params.q.trim()) {
        const term = params.q.trim().toLowerCase();
        filtered = filtered.filter(
          (a) =>
            a.title.toLowerCase().includes(term) ||
            a.content.toLowerCase().includes(term) ||
            a.courseId?.courseCode?.toLowerCase().includes(term)
        );
      }

      return {
        status: "success",
        data: filtered,
      };
    }
  },

  getAnnouncementDetails: async (announcementId) => {
    try {
      return await request(`/student/announcements/${announcementId}`);
    } catch {
      const index = liveAnnouncements.findIndex((a) => a._id === announcementId);
      if (index === -1) {
        throw new ApiError("Announcement not found.", 404);
      }
      // Mark as read
      liveAnnouncements[index] = {
        ...liveAnnouncements[index],
        isRead: true,
      };
      return {
        status: "success",
        data: liveAnnouncements[index],
      };
    }
  },

  // S04: Student Communication — Messaging
  getConversations: async () => {
    try {
      return await request("/student/messages/conversations");
    } catch {
      const currentStudentId = "1d0896ec8cc60f07c79dfeb1";

      const conversations = mockRecipients.map((recipient) => {
        // Find messages exchanged with this recipient
        const thread = liveMessages.filter(
          (m) =>
            (m.senderId === currentStudentId && m.recipientId === recipient._id) ||
            (m.senderId === recipient._id && m.recipientId === currentStudentId)
        );

        thread.sort((a, b) => new Date(a.sentAt) - new Date(b.sentAt));
        const lastMessage = thread.length > 0 ? thread[thread.length - 1] : null;

        const unreadCount = thread.filter(
          (m) => m.senderId === recipient._id && !m.isRead
        ).length;

        return {
          user: recipient,
          lastMessage,
          unreadCount,
          messageCount: thread.length,
        };
      });

      // Sort by recent activity
      conversations.sort((a, b) => {
        const timeA = a.lastMessage ? new Date(a.lastMessage.sentAt).getTime() : 0;
        const timeB = b.lastMessage ? new Date(b.lastMessage.sentAt).getTime() : 0;
        return timeB - timeA;
      });

      return {
        status: "success",
        data: conversations,
      };
    }
  },

  getMessagesWithUser: async (userId) => {
    try {
      return await request(`/student/messages/${userId}`);
    } catch {
      const currentStudentId = "1d0896ec8cc60f07c79dfeb1";
      const recipient = mockRecipients.find((r) => r._id === userId) || {
        _id: userId,
        fullName: "Instructor",
        role: "Instructor",
      };

      // Mark unread messages from this user as read
      liveMessages = liveMessages.map((m) => {
        if (m.senderId === userId && m.recipientId === currentStudentId) {
          return { ...m, isRead: true };
        }
        return m;
      });

      const thread = liveMessages.filter(
        (m) =>
          (m.senderId === currentStudentId && m.recipientId === userId) ||
          (m.senderId === userId && m.recipientId === currentStudentId)
      );

      thread.sort((a, b) => new Date(a.sentAt) - new Date(b.sentAt));

      return {
        status: "success",
        data: {
          recipient,
          messages: thread,
        },
      };
    }
  },

  sendMessage: async ({ recipientId, content }) => {
    try {
      return await request("/student/messages", {
        method: "POST",
        body: { recipientId, content },
      });
    } catch {
      if (!recipientId) {
        throw new ApiError("Recipient is required.", 400);
      }
      if (!content || !content.trim()) {
        throw new ApiError("Message content cannot be empty.", 400);
      }

      const newMsg = {
        _id: `msg_${Date.now()}`,
        senderId: "1d0896ec8cc60f07c79dfeb1", // Student Alice
        recipientId,
        content: content.trim(),
        isRead: false,
        sentAt: new Date().toISOString(),
      };

      liveMessages.push(newMsg);

      return {
        status: "success",
        message: "Message sent successfully.",
        data: newMsg,
      };
    }
  },

  getRecipients: async () => {
    try {
      return await request("/student/recipients");
    } catch {
      return {
        status: "success",
        data: mockRecipients,
      };
    }
  },
};
