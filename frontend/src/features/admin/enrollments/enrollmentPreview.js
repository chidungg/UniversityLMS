import { readPreviewClasses, writePreviewClasses } from '../classes/classStore'
import { readPreviewCourses } from '../courses/coursePreview'
import { readPreviewUsers } from '../users/userPreview'
import { readPreviewEnrollments, writePreviewEnrollments } from './enrollmentStore'

async function delay(signal) {
  signal?.throwIfAborted()
  await new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new DOMException('Cancelled', 'AbortError')) }
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve() }, 350)
    signal?.addEventListener('abort', abort, { once: true })
  })
  signal?.throwIfAborted()
  if (!navigator.onLine) throw new Error('OFFLINE')
}

export function validateEnrollmentSelection(classItem, studentId, users, enrollments) {
  if (!classItem) return 'Select a class before enrolling a student.'
  if (classItem.status !== 'Active') return 'This class is inactive. Activate it in Classes before enrolling students.'
  if (!studentId) return 'Select an active student to enroll.'
  const user = users.find((entry) => entry.id === studentId)
  if (!user) return 'User not found. Refresh the workspace and try again.'
  if (user.role !== 'Student') return 'Invalid enrollment. Only student accounts can be enrolled in a class.'
  if (user.status !== 'Active') return 'Invalid enrollment. Activate this student account in User management before enrolling them.'
  if (enrollments.some((entry) => entry.classId === classItem.id && entry.studentId === studentId)) return `${user.name} is already enrolled in ${classItem.code}.`
  return ''
}

export function validateInstructorSelection(classItem, instructorId, users) {
  if (!classItem) return 'Select a class before assigning an instructor.'
  if (classItem.status !== 'Active') return 'Invalid assignment. Activate this class in Classes before assigning an instructor.'
  if (!instructorId) return 'Select an active instructor to assign.'
  const user = users.find((entry) => entry.id === instructorId)
  if (!user) return 'User not found. Refresh the workspace and try again.'
  if (user.role !== 'Instructor') return 'Invalid assignment. Only accounts with the Instructor role can be assigned to a class.'
  if (user.status !== 'Active') return 'Invalid assignment. Activate this instructor in User management before assigning them.'
  if (classItem.instructorId === instructorId) return `${user.name} is already assigned to ${classItem.code}.`
  return ''
}

export async function listEnrollmentWorkspace({ signal } = {}) {
  await delay(signal)
  return {
    classes: readPreviewClasses(),
    courses: readPreviewCourses(),
    users: readPreviewUsers(),
    enrollments: readPreviewEnrollments(),
  }
}

export async function enrollPreviewStudent(classId, studentId, { signal } = {}) {
  await delay(signal)
  const classes = readPreviewClasses()
  const users = readPreviewUsers()
  const enrollments = readPreviewEnrollments()
  const classItem = classes.find((item) => item.id === classId)
  if (!classItem) throw new Error('CLASS_NOT_FOUND')
  if (classItem.status !== 'Active') throw new Error('INACTIVE_CLASS')
  const student = users.find((user) => user.id === studentId)
  if (!student) throw new Error('USER_NOT_FOUND')
  if (student.role !== 'Student') throw new Error('INVALID_STUDENT')
  if (student.status !== 'Active') throw new Error('INACTIVE_STUDENT')
  if (enrollments.some((entry) => entry.classId === classId && entry.studentId === studentId)) throw new Error('ALREADY_ENROLLED')
  const next = [{ studentId, classId }, ...enrollments]
  writePreviewEnrollments(next)
  return { enrollments: next, classes, users, courses: readPreviewCourses(), student, classItem }
}

export async function unenrollPreviewStudent(classId, studentId, { signal } = {}) {
  await delay(signal)
  const classes = readPreviewClasses()
  const enrollments = readPreviewEnrollments()
  const classItem = classes.find((item) => item.id === classId)
  if (!classItem) throw new Error('CLASS_NOT_FOUND')
  if (!enrollments.some((entry) => entry.classId === classId && entry.studentId === studentId)) throw new Error('ENROLLMENT_NOT_FOUND')
  const next = enrollments.filter((entry) => !(entry.classId === classId && entry.studentId === studentId))
  writePreviewEnrollments(next)
  return { enrollments: next, classes, users: readPreviewUsers(), courses: readPreviewCourses() }
}

export async function assignPreviewInstructor(classId, instructorId, { signal } = {}) {
  await delay(signal)
  const classes = readPreviewClasses()
  const users = readPreviewUsers()
  const classItem = classes.find((item) => item.id === classId)
  if (!classItem) throw new Error('CLASS_NOT_FOUND')
  if (classItem.status !== 'Active') throw new Error('INACTIVE_CLASS')
  const instructor = users.find((user) => user.id === instructorId)
  if (!instructor) throw new Error('USER_NOT_FOUND')
  if (instructor.role !== 'Instructor') throw new Error('INVALID_ASSIGNMENT')
  if (instructor.status !== 'Active') throw new Error('INACTIVE_INSTRUCTOR')
  if (classItem.instructorId === instructorId) throw new Error('ALREADY_ASSIGNED')
  const next = classes.map((item) => item.id === classId ? { ...item, instructorId } : item)
  writePreviewClasses(next)
  return { classes: next, enrollments: readPreviewEnrollments(), users, courses: readPreviewCourses(), instructor, classItem }
}

export async function unassignPreviewInstructor(classId, { signal } = {}) {
  await delay(signal)
  const classes = readPreviewClasses()
  const classItem = classes.find((item) => item.id === classId)
  if (!classItem) throw new Error('CLASS_NOT_FOUND')
  if (!classItem.instructorId) throw new Error('NOT_ASSIGNED')
  const next = classes.map((item) => item.id === classId ? { ...item, instructorId: null } : item)
  writePreviewClasses(next)
  return { classes: next, enrollments: readPreviewEnrollments(), users: readPreviewUsers(), courses: readPreviewCourses() }
}

export function enrollmentErrorMessage(error, loading = false) {
  if (error.message === 'OFFLINE') return 'You are offline. Check your connection and try again. No changes were saved.'
  if (error.message === 'CLASS_NOT_FOUND') return 'This class is no longer available. Close this dialog and refresh the workspace.'
  if (error.message === 'USER_NOT_FOUND') return 'User not found. Refresh the workspace and choose an available account.'
  if (error.message === 'ALREADY_ENROLLED') return 'This student is already enrolled in this class.'
  if (error.message === 'ENROLLMENT_NOT_FOUND') return 'This student is no longer enrolled in this class. Refresh the workspace to see the latest list.'
  if (error.message === 'INVALID_STUDENT') return 'Invalid enrollment. Only student accounts can be enrolled in a class.'
  if (error.message === 'INACTIVE_STUDENT') return 'Invalid enrollment. Activate this student account in User management before enrolling them.'
  if (error.message === 'INVALID_ASSIGNMENT') return 'Invalid assignment. Only accounts with the Instructor role can be assigned to a class.'
  if (error.message === 'INACTIVE_INSTRUCTOR') return 'Invalid assignment. Activate this instructor in User management before assigning them.'
  if (error.message === 'INACTIVE_CLASS') return 'This class is inactive. Activate it in Classes before making new assignments or enrollments.'
  if (error.message === 'ALREADY_ASSIGNED') return 'This instructor is already assigned to this class.'
  if (error.message === 'NOT_ASSIGNED') return 'No instructor is currently assigned to this class. Refresh the workspace to see the latest details.'
  return loading
    ? 'We could not load the sample enrollment records. Check browser storage and try again.'
    : 'Unable to save the preview. Your selection has been kept. Allow browser storage and try again.'
}
