import { request } from "./http";
export { ApiError } from "./http";

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
  getInstructorQuizzes: (params = {}, { signal } = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/instructor/quizzes${query ? `?${query}` : ""}`, { signal });
  },

  getInstructorQuizDetails: (quizId, { signal } = {}) =>
    request(`/instructor/quizzes/${encodeURIComponent(quizId)}`, { signal }),

  createQuiz: ({ courseId, ...body }) =>
    request(`/instructor/courses/${encodeURIComponent(courseId)}/quizzes`, { method: "POST", body }),

  updateQuiz: (quizId, body) =>
    request(`/instructor/quizzes/${encodeURIComponent(quizId)}`, { method: "PUT", body }),

  deleteQuiz: (quizId) =>
    request(`/instructor/quizzes/${encodeURIComponent(quizId)}`, { method: "DELETE" }),

  getInstructorQuizResults: (quizId, { signal } = {}) =>
    request(`/instructor/quizzes/${encodeURIComponent(quizId)}/results`, { signal }),
};
