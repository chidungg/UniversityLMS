import { request } from '../../../services/http'
import { readPreviewClasses } from '../classes/classStore'
import { readPreviewCourses } from '../courses/coursePreview'
import { readPreviewEnrollments } from '../enrollments/enrollmentStore'
import { readPreviewUsers } from '../users/userPreview'

export const DEFAULT_FILTERS = {
  courseStatus: 'all',
  courseId: 'all',
  activityType: 'all',
  period: 'all',
}

export const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'Active', label: 'Active' },
  { value: 'Inactive', label: 'Inactive' },
]

export const ACTIVITY_OPTIONS = [
  { value: 'all', label: 'All academic activity' },
  { value: 'enrollments', label: 'Enrollments' },
  { value: 'assignments', label: 'Assignment submissions' },
  { value: 'quizzes', label: 'Quiz attempts' },
]

export const PERIOD_OPTIONS = [
  { value: 'all', label: 'All time' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
]

export function normalizeFilters(raw = {}) {
  return {
    courseStatus: STATUS_OPTIONS.some((opt) => opt.value === raw.courseStatus) ? raw.courseStatus : 'all',
    courseId: typeof raw.courseId === 'string' && raw.courseId.trim() ? raw.courseId.trim() : 'all',
    activityType: ACTIVITY_OPTIONS.some((opt) => opt.value === raw.activityType) ? raw.activityType : 'all',
    period: PERIOD_OPTIONS.some((opt) => opt.value === raw.period) ? raw.period : 'all',
  }
}

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
    const abort = () => {
      clearTimeout(timer)
      reject(new DOMException('Cancelled', 'AbortError'))
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort)
      resolve()
    }, 280)
    signal?.addEventListener('abort', abort, { once: true })
  })
  signal?.throwIfAborted()
  if (globalThis.navigator?.onLine === false) throw new Error('OFFLINE')
}

function round1(value) {
  return Math.round(value * 10) / 10
}

function buildPreviewStatistics(filters) {
  const courses = readPreviewCourses()
  const classes = readPreviewClasses()
  const enrollments = readPreviewEnrollments()
  const users = readPreviewUsers()
  const userMap = new Map(users.map((user) => [user.id, user]))

  const filteredCourses = courses.filter((course) => {
    if (filters.courseStatus !== 'all' && course.status !== filters.courseStatus) return false
    if (filters.courseId !== 'all' && course.id !== filters.courseId) return false
    return true
  })

  const uniqueStudents = new Set()
  let active = 0
  let assignedInstructor = 0
  let totalEnrollments = 0
  let coursesWithEnrollments = 0

  const courseBreakdown = filteredCourses.map((course) => {
    if (course.status === 'Active') active += 1
    const courseClasses = classes.filter((item) => item.courseId === course.id)
    const courseClassIds = new Set(courseClasses.map((item) => item.id))
    const instructorEntry = courseClasses.find((item) => item.instructorId)
    const instructor = instructorEntry ? userMap.get(instructorEntry.instructorId) : null
    if (instructor) assignedInstructor += 1

    const courseEnrollments = filters.period === 'all'
      ? enrollments.filter((entry) => courseClassIds.has(entry.classId))
      : []
    for (const entry of courseEnrollments) uniqueStudents.add(entry.studentId)
    totalEnrollments += courseEnrollments.length
    if (courseEnrollments.length > 0) coursesWithEnrollments += 1

    return {
      courseId: course.id,
      courseCode: course.code,
      courseName: course.name,
      isActive: course.status === 'Active',
      status: course.status,
      instructorName: instructor?.name || 'Not assigned',
      enrollments: courseEnrollments.length,
      assignmentsCount: 0,
      submissionsTotal: 0,
      submissionsGraded: 0,
      submissionsPending: 0,
      averageAssignmentPct: null,
      quizzesCount: 0,
      quizAttemptsTotal: 0,
      quizAttemptsCompleted: 0,
      averageQuizPct: null,
      quizPassRatePct: null,
    }
  })

  let noDataReason = null
  if (courses.length === 0) noDataReason = 'empty_system'
  else if (filteredCourses.length === 0) noDataReason = 'no_matching_courses'
  else if (filters.activityType === 'enrollments' && totalEnrollments === 0) noDataReason = 'no_enrollment_data'
  else if (filters.activityType === 'assignments') noDataReason = 'no_submission_data'
  else if (filters.activityType === 'quizzes') noDataReason = 'no_quiz_data'

  return {
    preview: true,
    summary: {
      courses: {
        total: filteredCourses.length,
        active,
        inactive: filteredCourses.length - active,
        assignedInstructor,
        unassignedInstructor: filteredCourses.length - assignedInstructor,
      },
      enrollments: {
        total: totalEnrollments,
        uniqueStudents: uniqueStudents.size,
        coursesWithEnrollments,
        averagePerCourse: filteredCourses.length > 0 ? round1(totalEnrollments / filteredCourses.length) : 0,
      },
      submissions: {
        assignmentsTotal: 0,
        total: 0,
        graded: 0,
        pendingGrading: 0,
        averageScorePct: null,
      },
      quizAttempts: {
        quizzesTotal: 0,
        total: 0,
        completed: 0,
        inProgress: 0,
        passed: 0,
        passRatePct: null,
        averageScorePct: null,
      },
    },
    courseBreakdown,
    filters: {
      applied: filters,
      courses: courses.map((course) => ({
        id: course.id,
        code: course.code,
        name: course.name,
        status: course.status,
      })),
    },
    meta: {
      generatedAt: new Date().toISOString(),
      totalSystemCourses: courses.length,
      hasData: noDataReason === null,
      noDataReason,
    },
  }
}

export async function fetchStatistics(rawFilters = {}, { signal, authenticated = false } = {}) {
  if (globalThis.navigator?.onLine === false) throw new Error('OFFLINE')
  const filters = normalizeFilters(rawFilters)
  const params = new URLSearchParams()
  if (filters.courseStatus !== 'all') params.set('courseStatus', filters.courseStatus)
  if (filters.courseId !== 'all') params.set('courseId', filters.courseId)
  if (filters.activityType !== 'all') params.set('activityType', filters.activityType)
  if (filters.period !== 'all') params.set('period', filters.period)
  const query = params.toString()

  try {
    const response = await request(`/admin/statistics${query ? `?${query}` : ''}`, { signal })
    return {
      ...response,
      preview: false,
    }
  } catch (error) {
    if (error.name === 'AbortError' || signal?.aborted) throw error
    if (!isViteBackendAbsent(error, authenticated)) throw error
    await delay(signal)
    return buildPreviewStatistics(filters)
  }
}

export function statisticsErrorMessage(error) {
  const code = error?.code || error?.message
  if (globalThis.navigator?.onLine === false || code === 'OFFLINE' || error?.status === 0) {
    return 'You are offline or unable to reach the server. Check your connection and try again.'
  }
  if (error?.status === 403) {
    return 'You do not have permission to view system statistics.'
  }
  if (code === 'VALIDATION' || error?.status === 400) {
    return error?.message || 'Selected statistical filter criteria are invalid. Reset filters and try again.'
  }
  if (code === 'STATISTICS_RETRIEVAL_FAILED' || error?.status >= 500) {
    return 'Unable to retrieve statistical data from the database. Please try again.'
  }
  if (code === 'STORAGE') {
    return 'Unable to read sample statistics from browser storage. Refresh or reset preview data.'
  }
  return error?.message || 'Unable to retrieve statistical data. Please try again.'
}

export function formatStatisticsTimestamp(isoString) {
  if (!isoString) return ''
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return ''
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = date.getFullYear()
  const hh = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy}, ${hh}:${min}`
}
