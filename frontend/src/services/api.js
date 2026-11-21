import { request, ApiError } from "./http";
import {
  mockCourses,
  mockQuizzes,
  mockQuizAttempts,
  mockEnrolledStudents,
  mockCourseEnrollments,
} from "./mockData";

export { ApiError };

// In-memory state for Instructor UI fallback when backend endpoints are unavailable
const liveCourses = [...mockCourses];
let liveQuizzes = [...mockQuizzes];
let liveQuizAttempts = [...mockQuizAttempts];
const liveEnrollments = [...mockCourseEnrollments];

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
function materialFormData({ title, description, type, file, fileUrl }) {
  const data = new FormData();
  for (const [field, value] of Object.entries({ title, description, type })) {
    if (value !== undefined) data.append(field, value);
  }
  if (file) data.append("file", file);
  if (fileUrl) data.append("fileUrl", fileUrl);
  return data;
}

export const api = {
  // Auth
  login: async (email, _password) => {
    return await request("/auth/login", {
      method: "POST",
      body: { email, password: _password },
    });
  },
  getMe: async () => {
    return await request("/auth/me");
  },
  // S01: Dashboard
  getDashboard: async () => {
    return await request("/student/dashboard");
  },
  // S01: My Courses
  getCourses: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return await request(`/student/courses${query ? `?${query}` : ""}`);
  },
  // S01: Course Details
  getCourseDetails: async (courseId) => {
    return await request(`/student/courses/${courseId}`);
  },
  // S01: Materials
  getMaterials: async (courseId, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return await request(`/student/courses/${courseId}/materials${query ? `?${query}` : ""}`);
  },
  getMaterial: async (materialId) => {
    return await request(`/student/materials/${materialId}`);
  },
  downloadMaterialBlob: async (materialId) => {
    return await request(`/student/materials/${materialId}/download`, {
      responseType: "blob", timeoutMs: 120_000,
    });
  },
  // S02: Assignments
  getAssignments: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return await request(`/student/assignments${query ? `?${query}` : ""}`);
  },
  getAssignmentDetails: async (assignmentId) => {
    return await request(`/student/assignments/${assignmentId}`);
  },
  submitAssignment: async (assignmentId, payload) => {
    return await request(`/student/assignments/${assignmentId}/submit`, {
      method: "POST",
      body: payload,
    });
  },
  getSubmissionDetails: async (submissionId) => {
    return await request(`/student/submissions/${submissionId}`);
  },
  // S05: Global Search
  search: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return await request(`/student/search${query ? `?${query}` : ""}`);
  },
  // S03: Quizzes Assessment
  getQuizzes: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return await request(`/student/quizzes${query ? `?${query}` : ""}`);
  },
  getQuizDetails: async (quizId) => {
    return await request(`/student/quizzes/${quizId}`);
  },
  startQuiz: async (quizId) => {
    return await request(`/student/quizzes/${quizId}/start`, { method: "POST" });
  },
  submitQuiz: async (quizId, answers = {}) => {
    return await request(`/student/quizzes/${quizId}/submit`, {
      method: "POST",
      body: { answers },
    });
  },
  getQuizResult: async (attemptId) => {
    return await request(`/student/quiz-attempts/${attemptId}/result`);
  },
  // S04: Student Communication — Announcements
  getAnnouncements: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return await request(`/student/announcements${query ? `?${query}` : ""}`);
  },
  getAnnouncementDetails: async (announcementId) => {
    return await request(`/student/announcements/${announcementId}`);
  },
  // S04: Student Communication — Messaging
  getConversations: async () => {
    return await request("/student/messages/conversations");
  },
  getMessagesWithUser: async (userId) => {
    return await request(`/student/messages/${userId}`);
  },
  sendMessage: async ({ recipientId, content }) => {
    return await request("/student/messages", {
      method: "POST",
      body: { recipientId, content },
    });
  },
  getRecipients: async () => {
    return await request("/student/recipients");
  },

  // =====================================================================
  // INSTRUCTOR WORKSPACE APIs (I01 - I05)
  // =====================================================================

  // I01: Manage Course
  getInstructorDashboard: () => request("/instructor/dashboard"),

  getInstructorCourses: (params = {}, { signal } = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/instructor/courses${query ? `?${query}` : ""}`, { signal });
  },

  getInstructorCourseDetails: (courseId, { signal } = {}) =>
    request(`/instructor/courses/${encodeURIComponent(courseId)}`, { signal }),

  // I02: View the selected course's student list.
  getInstructorCourseStudents: (courseId, { signal } = {}) =>
    request(`/instructor/courses/${encodeURIComponent(courseId)}/students`, { signal }),

  // I03: Learning Materials Management
  getInstructorMaterials: (params = {}, { signal } = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/instructor/materials${query ? `?${query}` : ""}`, { signal });
  },

  createMaterial: (payload) =>
    request(`/instructor/courses/${encodeURIComponent(payload.courseId)}/materials`, {
      method: "POST", body: materialFormData(payload), timeoutMs: 120_000,
    }),

  updateMaterial: (materialId, payload) =>
    request(`/instructor/materials/${encodeURIComponent(materialId)}`, {
      method: "PUT", body: materialFormData(payload), timeoutMs: 120_000,
    }),

  deleteMaterial: (materialId) =>
    request(`/instructor/materials/${encodeURIComponent(materialId)}`, { method: "DELETE" }),

  downloadInstructorMaterialBlob: (materialId) =>
    request(`/instructor/materials/${encodeURIComponent(materialId)}/download`, {
      responseType: "blob", timeoutMs: 120_000,
    }),

  // I04: Assignment Management & Grading
  getInstructorAssignments: (params = {}, { signal } = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/instructor/assignments${query ? `?${query}` : ""}`, { signal });
  },

  getInstructorAssignmentDetails: (assignmentId, { signal } = {}) =>
    request(`/instructor/assignments/${encodeURIComponent(assignmentId)}`, { signal }),

  getInstructorAssignmentSubmission: (assignmentId, submissionId, { signal } = {}) =>
    request(`/instructor/assignments/${encodeURIComponent(assignmentId)}/submissions/${encodeURIComponent(submissionId)}`, { signal }),

  createAssignment: ({ courseId, ...body }) =>
    request(`/instructor/courses/${encodeURIComponent(courseId)}/assignments`, { method: "POST", body }),

  updateAssignment: (assignmentId, { courseId: _courseId, ...body }) =>
    request(`/instructor/assignments/${encodeURIComponent(assignmentId)}`, { method: "PUT", body }),

  deleteAssignment: (assignmentId) =>
    request(`/instructor/assignments/${encodeURIComponent(assignmentId)}`, { method: "DELETE" }),

  gradeSubmission: (assignmentId, submissionId, body) =>
    request(`/instructor/assignments/${encodeURIComponent(assignmentId)}/submissions/${encodeURIComponent(submissionId)}/grade`, {
      method: "PATCH", body,
    }),

  downloadInstructorSubmissionBlob: (assignmentId, submissionId) =>
    request(`/instructor/assignments/${encodeURIComponent(assignmentId)}/submissions/${encodeURIComponent(submissionId)}/download`, {
      responseType: "blob", timeoutMs: 120_000,
    }),

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
