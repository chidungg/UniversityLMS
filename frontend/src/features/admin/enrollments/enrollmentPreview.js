import { request } from '../../../services/http'
import { readPreviewClasses, writePreviewClasses } from '../classes/classStore'
import { readPreviewCourses } from '../courses/coursePreview'
import { readPreviewUsers } from '../users/userPreview'
import { readPreviewEnrollments, writePreviewEnrollments } from './enrollmentStore'

function isViteBackendAbsent(error, authenticated) {
  return (
    !authenticated &&
    error?.status === 503 &&
    error?.data?.message === 'Backend unavailable' &&
    !error?.code &&
    globalThis.navigator?.onLine !== false
  )
}

async function delay(signal) {
  signal?.throwIfAborted()
  await new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new DOMException('Cancelled', 'AbortError')) }
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve() }, 350)
    signal?.addEventListener('abort', abort, { once: true })
  })
  signal?.throwIfAborted()
  if (globalThis.navigator?.onLine === false) throw new Error('OFFLINE')
}

function buildPreviewState(requestedId = '') {
  const classes = readPreviewClasses()
  const courses = readPreviewCourses()
  const users = readPreviewUsers()
  const enrollments = readPreviewEnrollments()

  const items = classes.map((item) => {
    const course = courses.find((entry) => entry.id === item.courseId) || null
    const instructor = item.instructorId ? users.find((entry) => entry.id === item.instructorId) || null : null
    const enrolledCount = enrollments.filter((entry) => entry.classId === item.id).length
    return {
      ...item,
      courseCode: course?.code || '',
      courseName: course?.name || 'Course unavailable',
      name: course?.name || 'Course unavailable',
      instructor,
      enrolledCount,
    }
  })

  const selectedItem = items.find((item) => item.id === requestedId)
    || items.find((item) => item.status === 'Active')
    || items[0]
    || null

  const selectedEnrollments = selectedItem
    ? enrollments
        .filter((entry) => entry.classId === selectedItem.id)
        .map((entry) => ({
          id: `${entry.classId}::${entry.studentId}`,
          classId: entry.classId,
          studentId: entry.studentId,
          enrolledAt: null,
          student: users.find((user) => user.id === entry.studentId) || null,
        }))
    : []

  return {
    preview: true,
    items,
    selectedItem,
    instructor: selectedItem?.instructor || null,
    enrollments: selectedEnrollments,
  }
}

function buildPreviewCandidates(targetId, type = 'student', query = '') {
  const classes = readPreviewClasses()
  const users = readPreviewUsers()
  const enrollments = readPreviewEnrollments()
  const target = classes.find((item) => item.id === targetId)
  if (!target) return []

  const targetRole = type === 'instructor' ? 'Instructor' : 'Student'
  const trimmed = query.trim().toLowerCase()
  const enrolledIds = new Set(
    enrollments.filter((entry) => entry.classId === targetId).map((entry) => entry.studentId),
  )

  return users
    .filter((user) => {
      if (!trimmed) return user.role === targetRole
      return `${user.name} ${user.email}`.toLowerCase().includes(trimmed)
    })
    .map((user) => {
      const isTargetRole = user.role === targetRole
      const isActive = user.status === 'Active'
      const alreadyEnrolled = type === 'student' && enrolledIds.has(user.id)
      const isCurrent = type === 'instructor' && target.instructorId === user.id
      const eligible = isTargetRole && isActive && !alreadyEnrolled && !isCurrent
      let reason = ''
      if (alreadyEnrolled) reason = 'ALREADY_ENROLLED'
      else if (isCurrent) reason = 'ALREADY_ASSIGNED'
      else if (!isTargetRole) reason = 'INVALID_ROLE'
      else if (!isActive) reason = 'INACTIVE'
      return { user, eligible, alreadyEnrolled, isCurrent, isTargetRole, isActive, reason }
    })
    .sort((a, b) => {
      if (a.eligible !== b.eligible) return a.eligible ? -1 : 1
      const aExisting = a.alreadyEnrolled || a.isCurrent
      const bExisting = b.alreadyEnrolled || b.isCurrent
      if (aExisting !== bExisting) return aExisting ? -1 : 1
      return a.user.name.localeCompare(b.user.name, 'en', { sensitivity: 'base' })
    })
}

async function fetchLiveDetailAndCourses(targetId, { signal } = {}) {
  const [{ courses = [] }, detail] = await Promise.all([
    request('/admin/enrollments/courses', { signal }),
    request(`/admin/enrollments/courses/${encodeURIComponent(targetId)}`, { signal }),
  ])
  return {
    preview: false,
    items: courses,
    selectedItem: detail.course,
    instructor: detail.instructor,
    enrollments: detail.enrollments || [],
  }
}

export function validateEnrollmentSelection(selectedItem, candidate, preview = false) {
  if (!selectedItem) return `Select a ${preview ? 'class' : 'course'} before enrolling a student.`
  if (selectedItem.status !== 'Active') {
    return preview
      ? 'This class is inactive. Activate it in Classes before enrolling students.'
      : 'This course is inactive. Activate it in Courses before enrolling students.'
  }
  if (!candidate?.user) return 'Select an active student to enroll.'
  const { user, alreadyEnrolled, isTargetRole, isActive } = candidate
  if (alreadyEnrolled) return `${user.name} is already enrolled in ${selectedItem.code}.`
  if (!isTargetRole) return 'Invalid enrollment. Only student accounts can be enrolled.'
  if (!isActive) return 'Invalid enrollment. Activate this student account in User management before enrolling them.'
  return ''
}

export function validateInstructorSelection(selectedItem, candidate, preview = false) {
  if (!selectedItem) return `Select a ${preview ? 'class' : 'course'} before assigning an instructor.`
  if (selectedItem.status !== 'Active') {
    return preview
      ? 'Invalid assignment. Activate this class in Classes before assigning an instructor.'
      : 'Invalid assignment. Activate this course in Courses before assigning an instructor.'
  }
  if (!candidate?.user) return 'Select an active instructor to assign.'
  const { user, isCurrent, isTargetRole, isActive } = candidate
  if (isCurrent) return `${user.name} is already assigned to ${selectedItem.code}.`
  if (!isTargetRole) return 'Invalid assignment. Only accounts with the Instructor role can be assigned.'
  if (!isActive) return 'Invalid assignment. Activate this instructor in User management before assigning them.'
  return ''
}

export async function listEnrollmentWorkspace({ signal, authenticated = false, selectedId = '' } = {}) {
  if (globalThis.navigator?.onLine === false) throw new Error('OFFLINE')
  try {
    const { courses = [] } = await request('/admin/enrollments/courses', { signal })
    const target = courses.find((item) => item.id === selectedId)
      || courses.find((item) => item.status === 'Active')
      || courses[0]
      || null
    if (!target) {
      return { preview: false, items: [], selectedItem: null, instructor: null, enrollments: [] }
    }
    const detail = await request(`/admin/enrollments/courses/${encodeURIComponent(target.id)}`, { signal })
    return {
      preview: false,
      items: courses,
      selectedItem: detail.course,
      instructor: detail.instructor,
      enrollments: detail.enrollments || [],
    }
  } catch (error) {
    if (error.name === 'AbortError' || signal?.aborted) throw error
    if (!isViteBackendAbsent(error, authenticated)) throw error
    await delay(signal)
    return buildPreviewState(selectedId)
  }
}

export async function getEnrollmentDetail(targetId, { signal, authenticated = false } = {}) {
  if (globalThis.navigator?.onLine === false) throw new Error('OFFLINE')
  try {
    return await fetchLiveDetailAndCourses(targetId, { signal })
  } catch (error) {
    if (error.name === 'AbortError' || signal?.aborted) throw error
    if (!isViteBackendAbsent(error, authenticated)) throw error
    await delay(signal)
    const state = buildPreviewState(targetId)
    if (!state.items.some((item) => item.id === targetId)) {
      throw new Error('CLASS_NOT_FOUND', { cause: error })
    }
    return state
  }
}

export async function listEnrollmentCandidates(targetId, type = 'student', query = '', { signal, authenticated = false } = {}) {
  if (globalThis.navigator?.onLine === false) throw new Error('OFFLINE')
  try {
    const params = new URLSearchParams({ type, q: query, limit: '50' })
    const res = await request(`/admin/enrollments/courses/${encodeURIComponent(targetId)}/candidates?${params}`, { signal })
    return {
      preview: false,
      candidates: res.candidates || [],
      total: res.total ?? (res.candidates || []).length,
    }
  } catch (error) {
    if (error.name === 'AbortError' || signal?.aborted) throw error
    if (!isViteBackendAbsent(error, authenticated)) throw error
    const candidates = buildPreviewCandidates(targetId, type, query)
    return { preview: true, candidates, total: candidates.length }
  }
}

export async function enrollStudent(targetId, studentId, { signal, authenticated = false } = {}) {
  if (globalThis.navigator?.onLine === false) throw new Error('OFFLINE')
  try {
    const response = await request(`/admin/enrollments/courses/${encodeURIComponent(targetId)}/students`, {
      method: 'POST',
      body: { studentId },
      signal,
    })
    const workspace = await fetchLiveDetailAndCourses(targetId, { signal })
    return { ...workspace, student: response.student }
  } catch (error) {
    if (error.name === 'AbortError' || signal?.aborted) throw error
    if (!isViteBackendAbsent(error, authenticated)) throw error
    await delay(signal)
    const classes = readPreviewClasses()
    const users = readPreviewUsers()
    const enrollments = readPreviewEnrollments()
    const classItem = classes.find((item) => item.id === targetId)
    if (!classItem) throw new Error('CLASS_NOT_FOUND', { cause: error })
    if (classItem.status !== 'Active') throw new Error('INACTIVE_CLASS', { cause: error })
    const student = users.find((user) => user.id === studentId)
    if (!student) throw new Error('USER_NOT_FOUND', { cause: error })
    if (student.role !== 'Student') throw new Error('INVALID_STUDENT', { cause: error })
    if (student.status !== 'Active') throw new Error('INACTIVE_STUDENT', { cause: error })
    if (enrollments.some((entry) => entry.classId === targetId && entry.studentId === studentId)) {
      throw new Error('ALREADY_ENROLLED', { cause: error })
    }
    const next = [{ studentId, classId: targetId }, ...enrollments]
    writePreviewEnrollments(next)
    return { ...buildPreviewState(targetId), student }
  }
}

export async function unenrollStudent(targetId, studentId, { signal, authenticated = false } = {}) {
  if (globalThis.navigator?.onLine === false) throw new Error('OFFLINE')
  try {
    await request(`/admin/enrollments/courses/${encodeURIComponent(targetId)}/students/${encodeURIComponent(studentId)}`, {
      method: 'DELETE',
      signal,
    })
    return await fetchLiveDetailAndCourses(targetId, { signal })
  } catch (error) {
    if (error.name === 'AbortError' || signal?.aborted) throw error
    if (!isViteBackendAbsent(error, authenticated)) throw error
    await delay(signal)
    const classes = readPreviewClasses()
    const enrollments = readPreviewEnrollments()
    if (!classes.some((item) => item.id === targetId)) throw new Error('CLASS_NOT_FOUND', { cause: error })
    if (!enrollments.some((entry) => entry.classId === targetId && entry.studentId === studentId)) {
      throw new Error('ENROLLMENT_NOT_FOUND', { cause: error })
    }
    const next = enrollments.filter((entry) => !(entry.classId === targetId && entry.studentId === studentId))
    writePreviewEnrollments(next)
    return buildPreviewState(targetId)
  }
}

export async function assignInstructor(targetId, instructorId, { signal, authenticated = false } = {}) {
  if (globalThis.navigator?.onLine === false) throw new Error('OFFLINE')
  try {
    const response = await request(`/admin/enrollments/courses/${encodeURIComponent(targetId)}/instructor`, {
      method: 'PUT',
      body: { instructorId },
      signal,
    })
    const workspace = await fetchLiveDetailAndCourses(targetId, { signal })
    return { ...workspace, instructor: response.instructor }
  } catch (error) {
    if (error.name === 'AbortError' || signal?.aborted) throw error
    if (!isViteBackendAbsent(error, authenticated)) throw error
    await delay(signal)
    const classes = readPreviewClasses()
    const users = readPreviewUsers()
    const classItem = classes.find((item) => item.id === targetId)
    if (!classItem) throw new Error('CLASS_NOT_FOUND', { cause: error })
    if (classItem.status !== 'Active') throw new Error('INACTIVE_CLASS', { cause: error })
    const instructor = users.find((user) => user.id === instructorId)
    if (!instructor) throw new Error('USER_NOT_FOUND', { cause: error })
    if (instructor.role !== 'Instructor') throw new Error('INVALID_ASSIGNMENT', { cause: error })
    if (instructor.status !== 'Active') throw new Error('INACTIVE_INSTRUCTOR', { cause: error })
    if (classItem.instructorId === instructorId) throw new Error('ALREADY_ASSIGNED', { cause: error })
    const next = classes.map((item) => item.id === targetId ? { ...item, instructorId } : item)
    writePreviewClasses(next)
    return { ...buildPreviewState(targetId), instructor }
  }
}

export async function unassignInstructor(targetId, { signal, authenticated = false } = {}) {
  if (globalThis.navigator?.onLine === false) throw new Error('OFFLINE')
  try {
    await request(`/admin/enrollments/courses/${encodeURIComponent(targetId)}/instructor`, {
      method: 'DELETE',
      signal,
    })
    return await fetchLiveDetailAndCourses(targetId, { signal })
  } catch (error) {
    if (error.name === 'AbortError' || signal?.aborted) throw error
    if (!isViteBackendAbsent(error, authenticated)) throw error
    await delay(signal)
    const classes = readPreviewClasses()
    const classItem = classes.find((item) => item.id === targetId)
    if (!classItem) throw new Error('CLASS_NOT_FOUND', { cause: error })
    if (!classItem.instructorId) throw new Error('NOT_ASSIGNED', { cause: error })
    const next = classes.map((item) => item.id === targetId ? { ...item, instructorId: null } : item)
    writePreviewClasses(next)
    return buildPreviewState(targetId)
  }
}

export function enrollmentErrorMessage(error, loading = false) {
  const code = error?.code || error?.message
  if (globalThis.navigator?.onLine === false || code === 'OFFLINE' || error?.status === 0) {
    return 'You are offline or unable to reach the server. Check your connection and try again.'
  }
  if (code === 'COURSE_NOT_FOUND') return 'This course is no longer available. Close this dialog and refresh the workspace.'
  if (code === 'CLASS_NOT_FOUND') return 'This class is no longer available. Close this dialog and refresh the workspace.'
  if (code === 'USER_NOT_FOUND') return 'User not found. Refresh the workspace and choose an available account.'
  if (code === 'ALREADY_ENROLLED') return error?.message || 'This student is already enrolled.'
  if (code === 'ENROLLMENT_NOT_FOUND') return 'This student is no longer enrolled. Refresh the workspace to see the latest list.'
  if (code === 'INVALID_STUDENT') return 'Invalid enrollment. Only student accounts can be enrolled.'
  if (code === 'INACTIVE_STUDENT') return 'Invalid enrollment. Activate this student account in User management before enrolling them.'
  if (code === 'INVALID_ASSIGNMENT') return 'Invalid assignment. Only accounts with the Instructor role can be assigned.'
  if (code === 'INACTIVE_INSTRUCTOR') return 'Invalid assignment. Activate this instructor in User management before assigning them.'
  if (code === 'INACTIVE_COURSE') return 'This course is inactive. Activate it in Courses before making new assignments or enrollments.'
  if (code === 'INACTIVE_CLASS') return 'This class is inactive. Activate it in Classes before making new assignments or enrollments.'
  if (code === 'ALREADY_ASSIGNED') return error?.message || 'This instructor is already assigned.'
  if (code === 'NOT_ASSIGNED') return 'No instructor is currently assigned. Refresh the workspace to see the latest details.'
  if (code === 'RATE_LIMITED') return 'Too many enrollment requests. Wait a moment and try again.'
  if (code === 'VALIDATION') return error?.message || 'Please check your selection and try again.'
  if (code === 'STORAGE' || error?.message === 'Unavailable') {
    return 'Unable to save the preview. Your selection has been kept. Allow browser storage and try again.'
  }
  if (error?.name === 'ApiError' && error?.message) return error.message
  return loading
    ? 'Unable to load enrollment records. Please try again.'
    : 'Unable to update enrollment information. Existing data remains unchanged.'
}
