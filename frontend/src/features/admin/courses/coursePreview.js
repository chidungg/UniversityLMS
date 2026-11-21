import { dashboardSample } from '../dashboardData'
import { readPreviewClasses } from '../classes/classStore'

export const COURSE_PREVIEW_KEY = 'university-lms.course-preview.v1'
export const courseLimits = { code: 30, name: 200, description: 500 }

const descriptions = {
  SE104: 'Software development processes, requirements analysis, design and testing.',
  DBI202: 'Relational data modeling, SQL and database design fundamentals.',
  NET301: 'Network architecture, communication protocols and core networking concepts.',
}

export function initialCourses() {
  return dashboardSample.courses.map((course) => ({ ...course, code: course.id, description: descriptions[course.id] || '' }))
}

export function validateCourse(values, courses, id) {
  const errors = {}
  if (!values.code.trim()) errors.code = 'Enter a course code.'
  else if (values.code.trim().length > courseLimits.code) errors.code = 'Use 30 characters or fewer.'
  else if (courses.some((course) => course.id !== id && course.code.toLowerCase() === values.code.trim().toLowerCase())) errors.code = 'This course code is already in use. Enter a different code.'
  if (!values.name.trim()) errors.name = 'Enter a course name.'
  else if (values.name.trim().length > courseLimits.name) errors.name = 'Use 200 characters or fewer.'
  if (values.description.length > courseLimits.description) errors.description = 'Keep the description to 500 characters or fewer.'
  return errors
}

export function readPreviewCourses() {
  const stored = sessionStorage.getItem(COURSE_PREVIEW_KEY)
  if (stored === null) return initialCourses()
  const courses = JSON.parse(stored)
  if (!Array.isArray(courses) || courses.some((course) => !course || typeof course.id !== 'string' || !course.id || typeof course.code !== 'string' || !course.code.trim() || typeof course.name !== 'string' || !course.name.trim() || typeof course.description !== 'string' || !['Active', 'Inactive'].includes(course.status)) || new Set(courses.map((course) => course.id)).size !== courses.length || new Set(courses.map((course) => course.code.toLowerCase())).size !== courses.length) throw new Error('STORAGE')
  return courses
}

export function linkedClasses(id) {
  return readPreviewClasses().filter((item) => item.courseId === id)
}

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

export async function listPreviewCourses({ signal } = {}) {
  await delay(signal)
  readPreviewClasses()
  return readPreviewCourses()
}

export async function savePreviewCourse(values, { id, signal } = {}) {
  await delay(signal)
  const courses = readPreviewCourses()
  const existing = courses.find((course) => course.id === id)
  if (id && !existing) throw new Error('NOT_FOUND')
  const fields = validateCourse(values, courses, id)
  if (Object.keys(fields).length) throw Object.assign(new Error('VALIDATION'), { fields })
  // Stable ID preserves class references when the visible course code changes.
  const record = { id: id || `C-${crypto.randomUUID()}`, code: values.code.trim().toUpperCase(), name: values.name.trim(), description: values.description.trim(), status: existing?.status || 'Active' }
  const next = existing ? courses.map((course) => course.id === id ? record : course) : [record, ...courses]
  sessionStorage.setItem(COURSE_PREVIEW_KEY, JSON.stringify(next))
  return { courses: next, record }
}

export async function changePreviewCourse(id, action, { signal } = {}) {
  await delay(signal)
  const courses = readPreviewCourses()
  if (!courses.some((course) => course.id === id)) throw new Error('NOT_FOUND')
  if (!['activate', 'deactivate', 'delete'].includes(action)) throw new Error('INVALID_ACTION')
  if (action === 'delete' && linkedClasses(id).length) throw new Error('HAS_CLASSES')
  const next = action === 'delete' ? courses.filter((course) => course.id !== id) : courses.map((course) => course.id === id ? { ...course, status: action === 'activate' ? 'Active' : 'Inactive' } : course)
  sessionStorage.setItem(COURSE_PREVIEW_KEY, JSON.stringify(next))
  return next
}

export function courseErrorMessage(error, loading = false) {
  if (error.message === 'OFFLINE') return 'You are offline. Check your connection and try again. No changes were saved.'
  if (error.message === 'NOT_FOUND') return 'This course is no longer available. Close this dialog and refresh the catalog.'
  if (error.message === 'HAS_CLASSES') return 'This course has linked classes and cannot be deleted. Deactivate it instead.'
  return loading ? 'We could not load the sample catalog. Check that browser storage is available, then try again.' : 'Unable to save the preview. Your details have been kept. Allow browser storage and try again.'
}
