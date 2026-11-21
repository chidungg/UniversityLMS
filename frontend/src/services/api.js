import {
  mockCourses,
  mockMaterials,
  mockAssignments,
  mockAnnouncements,
  mockQuizzes,
  mockQuizAttempts,
  mockRecipients,
  mockMessages,
  mockInstructorUser,
  mockEnrolledStudents,
  mockCourseEnrollments,
  mockInstructorSubmissions,
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
let liveCourses = [...mockCourses];
let liveAssignments = [...mockAssignments];
let liveMaterials = [...mockMaterials];
let liveQuizzes = [...mockQuizzes];
let liveQuizAttempts = [...mockQuizAttempts];
let liveAnnouncements = [...mockAnnouncements];
let liveMessages = [...mockMessages];
let liveEnrollments = [...mockCourseEnrollments];
let liveSubmissions = [...mockInstructorSubmissions];

const getCourseRef = (courseId) => {
  const targetId = typeof courseId === "object" ? courseId?._id : courseId;
  const course = liveCourses.find((c) => c._id === targetId);
  return course
    ? { _id: course._id, courseCode: course.courseCode, courseName: course.courseName }
    : { _id: targetId, courseCode: "COURSE", courseName: "Academic Course" };
};

const computeQuizWindowStatus = (quiz) => {
  const now = Date.now();
  const start = new Date(quiz.startTime).getTime();
  const end = new Date(quiz.endTime).getTime();
  if (now < start) return "UPCOMING";
  if (now > end) return "EXPIRED";
  return "AVAILABLE";
};

const enrichCourseStats = (course) => {
  const courseId = course._id;
  const enrolledCount = liveEnrollments.filter((e) => e.courseId === courseId).length;
  const materialCount = liveMaterials.filter((m) => (m.courseId?._id || m.courseId) === courseId).length;
  const courseAssignments = liveAssignments.filter((a) => (a.courseId?._id || a.courseId) === courseId);
  const quizCount = liveQuizzes.filter((q) => (q.courseId?._id || q.courseId) === courseId).length;
  const assignmentIds = new Set(courseAssignments.map((a) => a._id));
  const pendingGradingCount = liveSubmissions.filter(
    (s) => assignmentIds.has(s.assignmentId) && s.grade === null
  ).length;

  return {
    ...course,
    instructor: course.instructor || mockInstructorUser.fullName,
    enrolledCount,
    materialCount,
    assignmentCount: courseAssignments.length,
    quizCount,
    pendingGradingCount,
  };
};

const enrichAssignmentStats = (assignment) => {
  const courseId = assignment.courseId?._id || assignment.courseId;
  const enrolledCount = liveEnrollments.filter((e) => e.courseId === courseId).length;
  const subs = liveSubmissions.filter((s) => s.assignmentId === assignment._id);
  const gradedCount = subs.filter((s) => s.grade !== null && s.grade !== undefined).length;
  const ungradedCount = subs.length - gradedCount;
  return {
    ...assignment,
    courseId: getCourseRef(courseId),
    enrolledCount,
    submissionCount: subs.length,
    gradedCount,
    ungradedCount,
  };
};

const buildAttemptDetailedReview = (quiz, attempt) => {
  if (attempt.detailedReview && attempt.detailedReview.length > 0) {
    return attempt.detailedReview;
  }
  const questions = quiz?.questions || [];
  return questions.map((q) => {
    const ans = attempt.answers?.find((a) => a.questionId === q.id);
    const selectedOptionId = ans?.selectedOptionId || null;
    const isCorrect = selectedOptionId === q.correctOptionId;
    const selectedOpt = q.options?.find((o) => o.id === selectedOptionId);
    const correctOpt = q.options?.find((o) => o.id === q.correctOptionId);
    return {
      questionId: q.id,
      prompt: q.prompt,
      points: q.points || 2,
      earnedPoints: isCorrect ? q.points || 2 : 0,
      isCorrect,
      selectedOptionId,
      selectedOptionText: selectedOpt ? selectedOpt.text : "No answer selected",
      correctOptionId: q.correctOptionId,
      correctOptionText: correctOpt ? correctOpt.text : "",
      explanation: q.explanation || "",
    };
  });
};

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
          courses: liveCourses.map(enrichCourseStats),
          upcomingAssignments: upcoming,
          recentAnnouncements: liveAnnouncements,
          stats: {
            totalCourses: liveCourses.length,
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
      let filtered = liveCourses.map(enrichCourseStats);
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
      const course = liveCourses.find((c) => c._id === courseId) || liveCourses[0];
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
      const course = liveCourses.find((c) => c._id === courseId) || liveCourses[0];
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

      // Sync with instructor submissions list for Student Alice Johnson
      const existingSubIdx = liveSubmissions.findIndex(
        (s) => s.assignmentId === assignmentId && s.studentId === "1d0896ec8cc60f07c79dfeb1"
      );
      const instructorSubRecord = {
        ...submissionData,
        assignmentId,
        studentId: "1d0896ec8cc60f07c79dfeb1",
        fileSize: 16384,
      };
      if (existingSubIdx >= 0) {
        liveSubmissions[existingSubIdx] = instructorSubRecord;
      } else {
        liveSubmissions.unshift(instructorSubRecord);
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

      const matchingCourses = liveCourses.filter(
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

  // =====================================================================
  // INSTRUCTOR WORKSPACE APIs (I01 - I05)
  // =====================================================================

  // I01 & I02: Instructor Dashboard
  getInstructorDashboard: async () => {
    try {
      return await request("/instructor/dashboard");
    } catch {
      const courses = liveCourses.map(enrichCourseStats);
      const uniqueStudentIds = new Set(liveEnrollments.map((e) => e.studentId));

      const pendingSubmissions = liveSubmissions
        .filter((s) => s.grade === null || s.grade === undefined)
        .map((s) => {
          const assignment = liveAssignments.find((a) => a._id === s.assignmentId);
          const student = mockEnrolledStudents.find((u) => u._id === s.studentId);
          const course = assignment ? getCourseRef(assignment.courseId) : null;
          return {
            ...s,
            student: student || { _id: s.studentId, fullName: "Student", email: "" },
            assignmentTitle: assignment?.title || "Assignment",
            dueDate: assignment?.dueDate,
            maxScore: assignment?.maxScore ?? 10,
            course,
            isLate: assignment ? new Date(s.submittedAt) > new Date(assignment.dueDate) : false,
          };
        })
        .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

      const activeQuizzes = liveQuizzes.filter((q) => computeQuizWindowStatus(q) === "AVAILABLE");

      const upcomingSchedule = [
        ...liveAssignments.map((a) => ({
          id: a._id,
          kind: "ASSIGNMENT",
          title: a.title,
          course: getCourseRef(a.courseId),
          date: a.dueDate,
          meta: `Max ${a.maxScore ?? 10} pts`,
          to: `/instructor/assignments/${a._id}`,
        })),
        ...liveQuizzes.map((q) => ({
          id: q._id,
          kind: "QUIZ",
          title: q.title,
          course: getCourseRef(q.courseId),
          date: q.endTime,
          meta: `${q.timeLimit} mins · ${q.questions?.length || 0} Qs`,
          to: `/instructor/quizzes/${q._id}/results`,
        })),
      ].sort((a, b) => new Date(b.date) - new Date(a.date));

      return {
        status: "success",
        data: {
          instructor: mockInstructorUser,
          courses,
          pendingSubmissions,
          upcomingSchedule: upcomingSchedule.slice(0, 6),
          stats: {
            assignedCourses: courses.filter((c) => c.isActive).length,
            totalCourses: courses.length,
            uniqueStudents: uniqueStudentIds.size,
            totalEnrollments: liveEnrollments.length,
            pendingGrading: pendingSubmissions.length,
            activeQuizzes: activeQuizzes.length,
            totalMaterials: liveMaterials.length,
          },
        },
      };
    }
  },

  // I01 & I02: Assigned Courses
  getInstructorCourses: async (params = {}) => {
    try {
      const query = new URLSearchParams(params).toString();
      return await request(`/instructor/courses${query ? `?${query}` : ""}`);
    } catch {
      let list = liveCourses.map(enrichCourseStats);
      const { q, status } = params;

      if (status === "active") {
        list = list.filter((c) => c.isActive);
      } else if (status === "inactive") {
        list = list.filter((c) => !c.isActive);
      }

      if (q && q.trim()) {
        const term = q.trim().toLowerCase();
        list = list.filter(
          (c) =>
            c.courseCode.toLowerCase().includes(term) ||
            c.courseName.toLowerCase().includes(term) ||
            (c.description && c.description.toLowerCase().includes(term))
        );
      }

      return {
        status: "success",
        data: list,
      };
    }
  },

  // I01 & I02: Course Details + Tabs + Enrolled Student Roster
  getInstructorCourseDetails: async (courseId) => {
    try {
      return await request(`/instructor/courses/${courseId}`);
    } catch {
      const rawCourse = liveCourses.find((c) => c._id === courseId);
      if (!rawCourse) {
        throw new ApiError("Course not found.", 404);
      }
      const course = enrichCourseStats(rawCourse);

      const materials = liveMaterials
        .filter((m) => (m.courseId?._id || m.courseId) === course._id)
        .map((m) => ({ ...m, courseId: getCourseRef(course._id) }));

      const assignments = liveAssignments
        .filter((a) => (a.courseId?._id || a.courseId) === course._id)
        .map(enrichAssignmentStats);

      const quizzes = liveQuizzes
        .filter((q) => (q.courseId?._id || q.courseId) === course._id)
        .map((q) => {
          const attempts = liveQuizAttempts.filter((att) => att.quizId === q._id);
          const avgScore =
            attempts.length > 0
              ? Number((attempts.reduce((sum, a) => sum + (a.score || 0), 0) / attempts.length).toFixed(1))
              : null;
          return {
            ...q,
            courseId: getCourseRef(course._id),
            computedStatus: computeQuizWindowStatus(q),
            questionCount: q.questions?.length || 0,
            attemptCount: attempts.length,
            avgScore,
          };
        });

      const courseEnrollments = liveEnrollments.filter((e) => e.courseId === course._id);
      const assignmentIds = new Set(assignments.map((a) => a._id));
      const quizIds = new Set(quizzes.map((q) => q._id));

      const students = courseEnrollments
        .map((enrollment) => {
          const student = mockEnrolledStudents.find((s) => s._id === enrollment.studentId);
          if (!student) return null;

          const studentSubmissions = liveSubmissions.filter(
            (s) => s.studentId === student._id && assignmentIds.has(s.assignmentId)
          );
          const studentQuizAttempts = liveQuizAttempts.filter(
            (a) => a.studentId === student._id && quizIds.has(a.quizId)
          );

          const gradedScores = [
            ...studentSubmissions
              .filter((s) => s.grade !== null && s.grade !== undefined)
              .map((s) => {
                const a = assignments.find((item) => item._id === s.assignmentId);
                return a?.maxScore ? (s.grade / a.maxScore) * 10 : s.grade;
              }),
            ...studentQuizAttempts.map((q) => (q.maxScore ? (q.score / q.maxScore) * 10 : q.score)),
          ];

          const averageScore =
            gradedScores.length > 0
              ? Number((gradedScores.reduce((acc, v) => acc + v, 0) / gradedScores.length).toFixed(1))
              : null;

          return {
            ...student,
            enrolledAt: enrollment.enrolledAt,
            assignmentsSubmitted: studentSubmissions.length,
            totalAssignments: assignments.length,
            quizzesCompleted: studentQuizAttempts.length,
            totalQuizzes: quizzes.length,
            averageScore,
            submissions: studentSubmissions.map((s) => {
              const a = assignments.find((item) => item._id === s.assignmentId);
              return { ...s, assignmentTitle: a?.title || "Assignment", maxScore: a?.maxScore ?? 10 };
            }),
            quizAttempts: studentQuizAttempts,
          };
        })
        .filter(Boolean);

      return {
        status: "success",
        data: {
          course,
          materials,
          assignments,
          quizzes,
          students,
        },
      };
    }
  },

  updateInstructorCourse: async (courseId, payload) => {
    try {
      return await request(`/instructor/courses/${courseId}`, {
        method: "PUT",
        body: payload,
      });
    } catch {
      const idx = liveCourses.findIndex((c) => c._id === courseId);
      if (idx === -1) {
        throw new ApiError("Course not found.", 404);
      }
      if (!payload.courseName || !payload.courseName.trim()) {
        throw new ApiError("Course name is required.", 400);
      }
      liveCourses[idx] = {
        ...liveCourses[idx],
        courseName: payload.courseName.trim(),
        description: payload.description?.trim() || "",
        isActive: payload.isActive !== undefined ? payload.isActive : liveCourses[idx].isActive,
      };
      return {
        status: "success",
        message: "Course information updated.",
        data: enrichCourseStats(liveCourses[idx]),
      };
    }
  },

  // I03: Learning Materials Management
  getInstructorMaterials: async (params = {}) => {
    try {
      const query = new URLSearchParams(params).toString();
      return await request(`/instructor/materials${query ? `?${query}` : ""}`);
    } catch {
      let filtered = liveMaterials.map((m) => ({
        ...m,
        courseId: getCourseRef(m.courseId),
      }));

      if (params.courseId) {
        filtered = filtered.filter((m) => m.courseId._id === params.courseId);
      }

      if (params.type && params.type !== "all") {
        filtered = filtered.filter((m) => m.type === params.type);
      }

      if (params.q && params.q.trim()) {
        const term = params.q.trim().toLowerCase();
        filtered = filtered.filter(
          (m) =>
            m.title.toLowerCase().includes(term) ||
            (m.description && m.description.toLowerCase().includes(term)) ||
            (m.fileName && m.fileName.toLowerCase().includes(term)) ||
            m.courseId.courseCode.toLowerCase().includes(term)
        );
      }

      filtered.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

      return {
        status: "success",
        data: filtered,
      };
    }
  },

  createMaterial: async (payload) => {
    try {
      return await request("/instructor/materials", {
        method: "POST",
        body: payload,
      });
    } catch {
      if (!payload.courseId) throw new ApiError("Course is required.", 400);
      if (!payload.title || !payload.title.trim()) throw new ApiError("Material title is required.", 400);

      const newMaterial = {
        _id: `mat_${Date.now()}`,
        courseId: getCourseRef(payload.courseId),
        title: payload.title.trim(),
        description: payload.description?.trim() || "",
        type: payload.type || "LectureNote",
        fileName: payload.fileName || null,
        fileSize: payload.fileSize || null,
        fileUrl: payload.fileUrl || (payload.fileName ? `/uploads/materials/${payload.fileName}` : null),
        uploadedAt: new Date().toISOString(),
      };

      liveMaterials.unshift(newMaterial);

      return {
        status: "success",
        message: "Learning material uploaded successfully.",
        data: newMaterial,
      };
    }
  },

  updateMaterial: async (materialId, payload) => {
    try {
      return await request(`/instructor/materials/${materialId}`, {
        method: "PUT",
        body: payload,
      });
    } catch {
      const idx = liveMaterials.findIndex((m) => m._id === materialId);
      if (idx === -1) throw new ApiError("Material not found.", 404);
      if (!payload.title || !payload.title.trim()) throw new ApiError("Material title is required.", 400);

      const existing = liveMaterials[idx];
      liveMaterials[idx] = {
        ...existing,
        courseId: payload.courseId ? getCourseRef(payload.courseId) : getCourseRef(existing.courseId),
        title: payload.title.trim(),
        description: payload.description !== undefined ? payload.description.trim() : existing.description,
        type: payload.type || existing.type,
        fileName: payload.fileName !== undefined ? payload.fileName : existing.fileName,
        fileSize: payload.fileSize !== undefined ? payload.fileSize : existing.fileSize,
        fileUrl: payload.fileUrl !== undefined ? payload.fileUrl : existing.fileUrl,
      };

      return {
        status: "success",
        message: "Learning material updated successfully.",
        data: liveMaterials[idx],
      };
    }
  },

  deleteMaterial: async (materialId) => {
    try {
      return await request(`/instructor/materials/${materialId}`, {
        method: "DELETE",
      });
    } catch {
      const idx = liveMaterials.findIndex((m) => m._id === materialId);
      if (idx === -1) throw new ApiError("Material not found.", 404);
      liveMaterials.splice(idx, 1);
      return {
        status: "success",
        message: "Learning material deleted.",
      };
    }
  },

  // I04: Assignment Management & Grading
  getInstructorAssignments: async (params = {}) => {
    try {
      const query = new URLSearchParams(params).toString();
      return await request(`/instructor/assignments${query ? `?${query}` : ""}`);
    } catch {
      let list = liveAssignments.map(enrichAssignmentStats);
      const now = Date.now();

      if (params.courseId) {
        list = list.filter((a) => a.courseId._id === params.courseId);
      }

      if (params.status && params.status !== "ALL") {
        if (params.status === "NEEDS_GRADING") {
          list = list.filter((a) => a.ungradedCount > 0);
        } else if (params.status === "OPEN") {
          list = list.filter((a) => new Date(a.dueDate).getTime() >= now);
        } else if (params.status === "PAST_DUE") {
          list = list.filter((a) => new Date(a.dueDate).getTime() < now);
        }
      }

      if (params.q && params.q.trim()) {
        const term = params.q.trim().toLowerCase();
        list = list.filter(
          (a) =>
            a.title.toLowerCase().includes(term) ||
            (a.description && a.description.toLowerCase().includes(term)) ||
            a.courseId.courseCode.toLowerCase().includes(term)
        );
      }

      list.sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate));

      return {
        status: "success",
        data: list,
      };
    }
  },

  getInstructorAssignmentDetails: async (assignmentId) => {
    try {
      return await request(`/instructor/assignments/${assignmentId}`);
    } catch {
      const raw = liveAssignments.find((a) => a._id === assignmentId);
      if (!raw) throw new ApiError("Assignment not found.", 404);

      const assignment = enrichAssignmentStats(raw);
      const courseId = assignment.courseId._id;
      const enrolled = liveEnrollments.filter((e) => e.courseId === courseId);
      const dueTime = new Date(assignment.dueDate).getTime();

      const rosterSubmissions = enrolled
        .map((e) => {
          const student = mockEnrolledStudents.find((s) => s._id === e.studentId);
          if (!student) return null;
          const submission = liveSubmissions.find(
            (s) => s.assignmentId === assignmentId && s.studentId === student._id
          );
          let status = "NOT_SUBMITTED";
          let isLate = false;
          if (submission) {
            isLate = new Date(submission.submittedAt).getTime() > dueTime;
            status =
              submission.grade !== null && submission.grade !== undefined ? "GRADED" : "SUBMITTED";
          }
          return {
            student,
            enrolledAt: e.enrolledAt,
            submission: submission || null,
            status,
            isLate,
          };
        })
        .filter(Boolean);

      return {
        status: "success",
        data: {
          assignment,
          rosterSubmissions,
        },
      };
    }
  },

  createAssignment: async (payload) => {
    try {
      return await request("/instructor/assignments", {
        method: "POST",
        body: payload,
      });
    } catch {
      if (!payload.courseId) throw new ApiError("Course is required.", 400);
      if (!payload.title || !payload.title.trim()) throw new ApiError("Title is required.", 400);
      if (!payload.dueDate) throw new ApiError("Due date is required.", 400);

      const newAssignment = {
        _id: `assign_${Date.now()}`,
        courseId: getCourseRef(payload.courseId),
        title: payload.title.trim(),
        description: payload.description?.trim() || "",
        createdAt: new Date().toISOString(),
        dueDate: new Date(payload.dueDate).toISOString(),
        maxScore: Number(payload.maxScore) > 0 ? Number(payload.maxScore) : 10,
        submission: null,
        status: "PENDING",
      };

      liveAssignments.unshift(newAssignment);

      return {
        status: "success",
        message: "Assignment created successfully.",
        data: enrichAssignmentStats(newAssignment),
      };
    }
  },

  updateAssignment: async (assignmentId, payload) => {
    try {
      return await request(`/instructor/assignments/${assignmentId}`, {
        method: "PUT",
        body: payload,
      });
    } catch {
      const idx = liveAssignments.findIndex((a) => a._id === assignmentId);
      if (idx === -1) throw new ApiError("Assignment not found.", 404);
      if (!payload.title || !payload.title.trim()) throw new ApiError("Title is required.", 400);

      const existing = liveAssignments[idx];
      liveAssignments[idx] = {
        ...existing,
        courseId: payload.courseId ? getCourseRef(payload.courseId) : getCourseRef(existing.courseId),
        title: payload.title.trim(),
        description: payload.description !== undefined ? payload.description.trim() : existing.description,
        dueDate: payload.dueDate ? new Date(payload.dueDate).toISOString() : existing.dueDate,
        maxScore: payload.maxScore !== undefined ? Number(payload.maxScore) : existing.maxScore,
      };

      return {
        status: "success",
        message: "Assignment updated successfully.",
        data: enrichAssignmentStats(liveAssignments[idx]),
      };
    }
  },

  deleteAssignment: async (assignmentId) => {
    try {
      return await request(`/instructor/assignments/${assignmentId}`, {
        method: "DELETE",
      });
    } catch {
      const idx = liveAssignments.findIndex((a) => a._id === assignmentId);
      if (idx === -1) throw new ApiError("Assignment not found.", 404);
      liveAssignments.splice(idx, 1);
      liveSubmissions = liveSubmissions.filter((s) => s.assignmentId !== assignmentId);
      return {
        status: "success",
        message: "Assignment deleted.",
      };
    }
  },

  gradeSubmission: async (assignmentId, payload) => {
    try {
      return await request(`/instructor/assignments/${assignmentId}/grade`, {
        method: "POST",
        body: payload,
      });
    } catch {
      const assignment = liveAssignments.find((a) => a._id === assignmentId);
      if (!assignment) throw new ApiError("Assignment not found.", 404);

      const maxScore = assignment.maxScore ?? 10;
      const numericGrade = Number(payload.grade);
      if (Number.isNaN(numericGrade) || numericGrade < 0 || numericGrade > maxScore) {
        throw new ApiError(`Grade must be between 0 and ${maxScore}.`, 400);
      }

      const subIdx = liveSubmissions.findIndex(
        (s) =>
          (payload.submissionId && s._id === payload.submissionId) ||
          (s.assignmentId === assignmentId && s.studentId === payload.studentId)
      );

      let updatedSubmission;
      if (subIdx >= 0) {
        updatedSubmission = {
          ...liveSubmissions[subIdx],
          grade: numericGrade,
          feedback: payload.feedback?.trim() || "",
        };
        liveSubmissions[subIdx] = updatedSubmission;
      } else {
        updatedSubmission = {
          _id: `sub_${Date.now()}`,
          assignmentId,
          studentId: payload.studentId,
          content: "(Manual grade recorded by instructor)",
          fileName: null,
          fileUrl: null,
          fileSize: null,
          grade: numericGrade,
          feedback: payload.feedback?.trim() || "",
          submittedAt: new Date().toISOString(),
        };
        liveSubmissions.unshift(updatedSubmission);
      }

      // Sync with Student Alice view if studentId matches
      if (updatedSubmission.studentId === "1d0896ec8cc60f07c79dfeb1") {
        const aIdx = liveAssignments.findIndex((a) => a._id === assignmentId);
        if (aIdx >= 0) {
          liveAssignments[aIdx] = {
            ...liveAssignments[aIdx],
            submission: {
              ...updatedSubmission,
            },
            status: "GRADED",
          };
        }
      }

      return {
        status: "success",
        message: "Grade saved successfully.",
        data: updatedSubmission,
      };
    }
  },

  // I05: Quiz Management
  getInstructorQuizzes: async (params = {}) => {
    try {
      const query = new URLSearchParams(params).toString();
      return await request(`/instructor/quizzes${query ? `?${query}` : ""}`);
    } catch {
      let list = liveQuizzes.map((q) => {
        const courseRef = getCourseRef(q.courseId);
        const attempts = liveQuizAttempts.filter((a) => a.quizId === q._id);
        const avgScore =
          attempts.length > 0
            ? Number((attempts.reduce((sum, a) => sum + (a.score || 0), 0) / attempts.length).toFixed(1))
            : null;
        return {
          ...q,
          courseId: courseRef,
          computedStatus: computeQuizWindowStatus(q),
          questionCount: q.questions?.length || 0,
          attemptCount: attempts.length,
          avgScore,
        };
      });

      if (params.courseId) {
        list = list.filter((q) => q.courseId._id === params.courseId);
      }

      if (params.status && params.status !== "ALL") {
        list = list.filter((q) => q.computedStatus === params.status);
      }

      if (params.q && params.q.trim()) {
        const term = params.q.trim().toLowerCase();
        list = list.filter(
          (q) =>
            q.title.toLowerCase().includes(term) ||
            (q.description && q.description.toLowerCase().includes(term)) ||
            q.courseId.courseCode.toLowerCase().includes(term)
        );
      }

      return {
        status: "success",
        data: list,
      };
    }
  },

  getInstructorQuizDetails: async (quizId) => {
    try {
      return await request(`/instructor/quizzes/${quizId}`);
    } catch {
      const quiz = liveQuizzes.find((q) => q._id === quizId);
      if (!quiz) throw new ApiError("Quiz not found.", 404);
      return {
        status: "success",
        data: {
          ...quiz,
          courseId: getCourseRef(quiz.courseId),
          computedStatus: computeQuizWindowStatus(quiz),
        },
      };
    }
  },

  createQuiz: async (payload) => {
    try {
      return await request("/instructor/quizzes", {
        method: "POST",
        body: payload,
      });
    } catch {
      if (!payload.courseId) throw new ApiError("Course is required.", 400);
      if (!payload.title || !payload.title.trim()) throw new ApiError("Quiz title is required.", 400);

      const questions = payload.questions || [];
      const totalPoints = questions.reduce((sum, q) => sum + (Number(q.points) || 0), 0);

      const newQuiz = {
        _id: `quiz_${Date.now()}`,
        courseId: getCourseRef(payload.courseId),
        title: payload.title.trim(),
        description: payload.description?.trim() || "",
        startTime: new Date(payload.startTime).toISOString(),
        endTime: new Date(payload.endTime).toISOString(),
        timeLimit: Number(payload.timeLimit) || 30,
        maxScore: totalPoints > 0 ? totalPoints : Number(payload.maxScore) || 10,
        status: computeQuizWindowStatus(payload),
        attemptId: null,
        questions,
      };

      liveQuizzes.unshift(newQuiz);

      return {
        status: "success",
        message: "Quiz created successfully.",
        data: newQuiz,
      };
    }
  },

  updateQuiz: async (quizId, payload) => {
    try {
      return await request(`/instructor/quizzes/${quizId}`, {
        method: "PUT",
        body: payload,
      });
    } catch {
      const idx = liveQuizzes.findIndex((q) => q._id === quizId);
      if (idx === -1) throw new ApiError("Quiz not found.", 404);

      const existing = liveQuizzes[idx];
      const questions = payload.questions || existing.questions || [];
      const totalPoints = questions.reduce((sum, q) => sum + (Number(q.points) || 0), 0);

      const updated = {
        ...existing,
        courseId: payload.courseId ? getCourseRef(payload.courseId) : getCourseRef(existing.courseId),
        title: payload.title?.trim() || existing.title,
        description: payload.description !== undefined ? payload.description.trim() : existing.description,
        startTime: payload.startTime ? new Date(payload.startTime).toISOString() : existing.startTime,
        endTime: payload.endTime ? new Date(payload.endTime).toISOString() : existing.endTime,
        timeLimit: payload.timeLimit !== undefined ? Number(payload.timeLimit) : existing.timeLimit,
        maxScore: totalPoints > 0 ? totalPoints : existing.maxScore,
        questions,
      };
      updated.status = existing.status === "COMPLETED" ? "COMPLETED" : computeQuizWindowStatus(updated);

      liveQuizzes[idx] = updated;

      return {
        status: "success",
        message: "Quiz updated successfully.",
        data: updated,
      };
    }
  },

  deleteQuiz: async (quizId) => {
    try {
      return await request(`/instructor/quizzes/${quizId}`, {
        method: "DELETE",
      });
    } catch {
      const idx = liveQuizzes.findIndex((q) => q._id === quizId);
      if (idx === -1) throw new ApiError("Quiz not found.", 404);
      liveQuizzes.splice(idx, 1);
      liveQuizAttempts = liveQuizAttempts.filter((a) => a.quizId !== quizId);
      return {
        status: "success",
        message: "Quiz deleted.",
      };
    }
  },

  getInstructorQuizResults: async (quizId) => {
    try {
      return await request(`/instructor/quizzes/${quizId}/results`);
    } catch {
      const rawQuiz = liveQuizzes.find((q) => q._id === quizId);
      if (!rawQuiz) throw new ApiError("Quiz not found.", 404);

      const quiz = {
        ...rawQuiz,
        courseId: getCourseRef(rawQuiz.courseId),
        computedStatus: computeQuizWindowStatus(rawQuiz),
      };

      const courseId = quiz.courseId._id;
      const enrolled = liveEnrollments.filter((e) => e.courseId === courseId);
      const attempts = liveQuizAttempts.filter((a) => a.quizId === quizId);

      const rosterAttempts = enrolled
        .map((e) => {
          const student = mockEnrolledStudents.find((s) => s._id === e.studentId);
          if (!student) return null;
          const attempt = attempts.find((a) => a.studentId === student._id);
          return {
            student,
            status: attempt ? "COMPLETED" : "NOT_ATTEMPTED",
            attempt: attempt
              ? {
                  ...attempt,
                  detailedReview: buildAttemptDetailedReview(quiz, attempt),
                }
              : null,
          };
        })
        .filter(Boolean);

      const completedAttempts = rosterAttempts.filter((r) => r.attempt);
      const scores = completedAttempts.map((r) => r.attempt.score);
      const passedCount = completedAttempts.filter((r) => r.attempt.passed).length;

      const summary = {
        totalEnrolled: rosterAttempts.length,
        totalAttempts: completedAttempts.length,
        avgScore:
          scores.length > 0
            ? Number((scores.reduce((sum, v) => sum + v, 0) / scores.length).toFixed(1))
            : null,
        highestScore: scores.length > 0 ? Math.max(...scores) : null,
        passRate:
          completedAttempts.length > 0
            ? Math.round((passedCount / completedAttempts.length) * 100)
            : null,
        passedCount,
      };

      return {
        status: "success",
        data: {
          quiz,
          summary,
          rosterAttempts,
        },
      };
    }
  },
};
