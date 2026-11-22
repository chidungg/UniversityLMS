import { request } from '../../../services/http'
import { dashboardSample } from '../dashboardData'
import { readPreviewClasses } from '../classes/classStore'

// Replaceable adapter backed by /api/admin/courses when authenticated, with preview fallback only when Vite backend proxy is absent.
export const COURSE_PREVIEW_KEY = 'university-lms.course-preview.v1'
export const courseLimits = { code: 30, name: 200, description: 500 }

const COURSE_CODE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,29}$/

const descriptions = {
  SE104: 'Software development processes, requirements analysis, design and testing.',
  DBI202: 'Relational data modeling, SQL and database design fundamentals.',
  NET301: 'Network architecture, communication protocols and core networking concepts.',
}

export function initialCourses() {
  return dashboardSample.courses.map((course) => ({ ...course, code: course.id, description: descriptions[course.id] || '' }))
}

function normalizeApiCourse(course) {
  return {
    id: course.id || course._id,
    code: course.code || course.courseCode,
    name: course.name || course.courseName,
    description: course.description || '',
    status: course.status || (course.isActive ? 'Active' : 'Inactive'),
    ...(course.counts ? { counts: course.counts } : {}),
  }
}

export function validateCourse(values, courses = [], id) {
  const errors = {}
  const code = (values.code || '').trim()
  if (!code) errors.code = 'Enter a course code.'
  else if (code.length > courseLimits.code) errors.code = `Use ${courseLimits.code} characters or fewer.`
  else if (!COURSE_CODE_RE.test(code)) errors.code = 'Use letters, numbers, hyphens, underscores, or dots only.'
  else if (courses.some((course) => course.id !== id && course.code.toLowerCase() === code.toLowerCase())) {
    errors.code = 'This course code is already in use. Enter a different code.'
  }

  const name = (values.name || '').trim()
  if (!name) errors.name = 'Enter a course name.'
  else if (name.length > courseLimits.name) errors.name = `Use ${courseLimits.name} characters or fewer.`

  if ((values.description || '').length > courseLimits.description) {
    errors.description = `Keep the description to ${courseLimits.description} characters or fewer.`
  }
  return errors
}

export function readPreviewCourses() {
  const stored = sessionStorage.getItem(COURSE_PREVIEW_KEY)
  if (stored === null) return initialCourses()
  const courses = JSON.parse(stored)
  if (
    !Array.isArray(courses) ||
    courses.some((course) => (
      !course ||
      typeof course.id !== 'string' || !course.id ||
      typeof course.code !== 'string' || !course.code.trim() ||
      typeof course.name !== 'string' || !course.name.trim() ||
      typeof course.description !== 'string' ||
      !['Active', 'Inactive'].includes(course.status)
    )) ||
    new Set(courses.map((course) => course.id)).size !== courses.length ||
    new Set(courses.map((course) => course.code.toLowerCase())).size !== courses.length
  ) throw new Error('STORAGE')
  return courses
}

export function linkedClasses(id) {
  return readPreviewClasses().filter((item) => item.courseId === id)
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
    const abort = () => { clearTimeout(timer); reject(new DOMException('Cancelled', 'AbortError')) }
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve() }, 350)
    signal?.addEventListener('abort', abort, { once: true })
  })
  signal?.throwIfAborted()
  if (globalThis.navigator?.onLine === false) throw new Error('OFFLINE')
}

async function fetchLiveCourses({ signal } = {}) {
  const firstPage = await request('/admin/courses?page=1&limit=100', { signal })
  const allCourses = [...(firstPage.courses || []).map(normalizeApiCourse)]
  const total = firstPage.pagination?.total ?? allCourses.length
  let page = 2
  while (allCourses.length < total && page <= 20) {
    const nextPage = await request(`/admin/courses?page=${page}&limit=100`, { signal })
    const batch = (nextPage.courses || []).map(normalizeApiCourse)
    if (!batch.length) break
    allCourses.push(...batch)
    page += 1
  }
  return allCourses
}

export async function listCourses({ signal, authenticated = false } = {}) {
  if (globalThis.navigator?.onLine === false) throw new Error('OFFLINE')
  try {
    return { courses: await fetchLiveCourses({ signal }), preview: false }
  } catch (error) {
    if (error.name === 'AbortError' || signal?.aborted) throw error
    if (!isViteBackendAbsent(error, authenticated)) throw error
    await delay(signal)
    readPreviewClasses()
    return { courses: readPreviewCourses(), preview: true }
  }
}

export const listPreviewCourses = listCourses

export async function getCourseById(id, { signal, authenticated = false } = {}) {
  if (globalThis.navigator?.onLine === false) throw new Error('OFFLINE')
  try {
    const data = await request(`/admin/courses/${encodeURIComponent(id)}`, { signal })
    return { course: normalizeApiCourse(data.course), preview: false }
  } catch (error) {
    if (error.name === 'AbortError' || signal?.aborted) throw error
    if (!isViteBackendAbsent(error, authenticated)) throw error
    await delay(signal)
    const course = readPreviewCourses().find((entry) => entry.id === id)
    if (!course) throw new Error('NOT_FOUND', { cause: error })
    return { course, preview: true }
  }
}

export async function createCourse(values, { signal, authenticated = false } = {}) {
  if (globalThis.navigator?.onLine === false) throw new Error('OFFLINE')
  try {
    const response = await request('/admin/courses', {
      method: 'POST',
      body: {
        courseCode: (values.code || '').trim().toUpperCase(),
        courseName: (values.name || '').trim(),
        description: (values.description || '').trim(),
      },
      signal,
    })
    const courses = await fetchLiveCourses({ signal })
    return { courses, record: normalizeApiCourse(response.course), preview: false }
  } catch (error) {
    if (error.name === 'AbortError' || signal?.aborted) throw error
    if (!isViteBackendAbsent(error, authenticated)) throw error
    await delay(signal)
    const courses = readPreviewCourses()
    const fields = validateCourse(values, courses)
    if (Object.keys(fields).length) throw Object.assign(new Error('VALIDATION', { cause: error }), { fields })
    const record = {
      id: `C-${crypto.randomUUID()}`,
      code: values.code.trim().toUpperCase(),
      name: values.name.trim(),
      description: (values.description || '').trim(),
      status: 'Active',
    }
    const next = [record, ...courses]
    sessionStorage.setItem(COURSE_PREVIEW_KEY, JSON.stringify(next))
    return { courses: next, record, preview: true }
  }
}

export async function updateCourse(id, values, { signal, authenticated = false } = {}) {
  if (globalThis.navigator?.onLine === false) throw new Error('OFFLINE')
  try {
    const response = await request(`/admin/courses/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: {
        courseCode: (values.code || '').trim().toUpperCase(),
        courseName: (values.name || '').trim(),
        description: (values.description || '').trim(),
      },
      signal,
    })
    const courses = await fetchLiveCourses({ signal })
    return { courses, record: normalizeApiCourse(response.course), preview: false }
  } catch (error) {
    if (error.name === 'AbortError' || signal?.aborted) throw error
    if (!isViteBackendAbsent(error, authenticated)) throw error
    await delay(signal)
    const courses = readPreviewCourses()
    const existing = courses.find((course) => course.id === id)
    if (!existing) throw new Error('NOT_FOUND', { cause: error })
    const fields = validateCourse(values, courses, id)
    if (Object.keys(fields).length) throw Object.assign(new Error('VALIDATION', { cause: error }), { fields })
    const record = {
      ...existing,
      code: values.code.trim().toUpperCase(),
      name: values.name.trim(),
      description: (values.description || '').trim(),
    }
    const next = courses.map((course) => course.id === id ? record : course)
    sessionStorage.setItem(COURSE_PREVIEW_KEY, JSON.stringify(next))
    return { courses: next, record, preview: true }
  }
}

export async function changeCourseStatus(id, status, { signal, authenticated = false } = {}) {
  if (globalThis.navigator?.onLine === false) throw new Error('OFFLINE')
  try {
    const response = await request(`/admin/courses/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: {
        isActive: status === 'Active',
        status,
      },
      signal,
    })
    const courses = await fetchLiveCourses({ signal })
    return { courses, record: normalizeApiCourse(response.course), preview: false }
  } catch (error) {
    if (error.name === 'AbortError' || signal?.aborted) throw error
    if (!isViteBackendAbsent(error, authenticated)) throw error
    await delay(signal)
    const courses = readPreviewCourses()
    const existing = courses.find((course) => course.id === id)
    if (!existing) throw new Error('NOT_FOUND', { cause: error })
    if (!['Active', 'Inactive'].includes(status)) throw new Error('INVALID_ACTION', { cause: error })
    const record = { ...existing, status }
    const next = courses.map((course) => course.id === id ? record : course)
    sessionStorage.setItem(COURSE_PREVIEW_KEY, JSON.stringify(next))
    return { courses: next, record, preview: true }
  }
}

export function courseErrorMessage(error, loading = false) {
  const code = error?.code || error?.message
  if (globalThis.navigator?.onLine === false || code === 'OFFLINE' || error?.status === 0) {
    return 'You are offline or unable to reach the server. Check your connection and try again.'
  }
  if (code === 'COURSE_EXISTS') return 'This course code is already in use. Enter a different code.'
  if (code === 'NOT_FOUND') return 'This course is no longer available. Close this dialog and refresh the catalog.'
  if (code === 'RATE_LIMITED') return 'Too many course management requests. Wait a moment and try again.'
  if (code === 'VALIDATION') return error?.message || 'Please check the entered course details and try again.'
  if (code === 'STORAGE') return 'Unable to load or save preview storage. Allow browser storage and try again.'
  return error?.message || (
    loading
      ? 'Unable to load the course catalog. Please try again.'
      : 'Unable to save course changes. Please try again.'
  )
}
