import { request } from './http'
export { ApiError } from './http'
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
      responseType: "blob",
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
};
