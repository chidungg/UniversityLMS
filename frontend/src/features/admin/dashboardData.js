// Fictional fixtures for the explicitly labeled frontend preview. No API or session data.
export const dashboardSample = {
  users: [
    { id: 'S01', name: 'Minh Nguyen', email: 'minh@example.edu', role: 'Student', status: 'Active' },
    { id: 'S02', name: 'Linh Tran', email: 'linh@example.edu', role: 'Student', status: 'Active' },
    { id: 'S03', name: 'An Le', email: 'an@example.edu', role: 'Student', status: 'Active' },
    { id: 'S04', name: 'Mai Pham', email: 'mai@example.edu', role: 'Student', status: 'Active' },
    { id: 'S05', name: 'Khoa Vo', email: 'khoa@example.edu', role: 'Student', status: 'Active' },
    { id: 'S06', name: 'Ha Do', email: 'ha@example.edu', role: 'Student', status: 'Inactive' },
    { id: 'I01', name: 'Dr. Lan Nguyen', email: 'lan@example.edu', role: 'Instructor', status: 'Active' },
    { id: 'I02', name: 'Dr. Huy Tran', email: 'huy@example.edu', role: 'Instructor', status: 'Active' },
  ],
  courses: [
    { id: 'SE104', name: 'Software Engineering', status: 'Active' },
    { id: 'DBI202', name: 'Database Systems', status: 'Active' },
    { id: 'NET301', name: 'Computer Networks', status: 'Inactive' },
  ],
  classes: [
    { id: 'SE104-01', courseId: 'SE104', instructorId: 'I01', status: 'Active' },
    { id: 'DBI202-01', courseId: 'DBI202', instructorId: 'I02', status: 'Active' },
    { id: 'SE104-02', courseId: 'SE104', instructorId: null, status: 'Active' },
    { id: 'NET301-01', courseId: 'NET301', instructorId: 'I02', status: 'Inactive' },
  ],
  enrollments: [
    { studentId: 'S01', classId: 'SE104-01' }, { studentId: 'S02', classId: 'SE104-01' },
    { studentId: 'S03', classId: 'SE104-01' }, { studentId: 'S04', classId: 'SE104-01' },
    { studentId: 'S01', classId: 'DBI202-01' }, { studentId: 'S03', classId: 'DBI202-01' },
    { studentId: 'S05', classId: 'DBI202-01' },
  ],
}

export function summarizeDashboard(data) {
  return {
    students: data.users.filter((user) => user.role === 'Student').length,
    instructors: data.users.filter((user) => user.role === 'Instructor').length,
    activeCourses: data.courses.filter((course) => course.status === 'Active').length,
    activeClasses: data.classes.filter((item) => item.status === 'Active').length,
    unassigned: data.classes.filter((item) => item.status === 'Active' && !item.instructorId),
    unenrolled: data.classes.filter((item) => item.status === 'Active' && !data.enrollments.some((entry) => entry.classId === item.id)),
  }
}
