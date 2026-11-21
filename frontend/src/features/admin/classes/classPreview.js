import { readPreviewCourses } from '../courses/coursePreview'
import { readPreviewUsers } from '../users/userPreview'
import { hasClassRelationships, readPreviewClasses, writePreviewClasses } from './classStore'

export function validateClass(values, classes, courses, existing) {
  const errors = {}
  if (!values.code.trim()) errors.code = 'Enter a class code.'
  else if (values.code.trim().length > 40) errors.code = 'Use 40 characters or fewer.'
  else if (classes.some((item) => item.id !== existing?.id && item.code.toUpperCase() === values.code.trim().toUpperCase())) errors.code = 'This class code is already in use. Enter a different code.'
  const course = courses.find((item) => item.id === values.courseId)
  if (!values.courseId) errors.courseId = 'Select a course.'
  else if (!course) errors.courseId = 'This course is no longer available. Refresh the directory and choose another course.'
  else if (course.status !== 'Active' && values.courseId !== existing?.courseId) errors.courseId = 'Select an active course for this class.'
  if (existing && existing.courseId !== values.courseId && hasClassRelationships(existing)) errors.courseId = 'The course cannot change while this class has enrollments or an assigned instructor.'
  return errors
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

export async function listClassWorkspace({ signal } = {}) {
  await delay(signal)
  return { classes: readPreviewClasses(), courses: readPreviewCourses(), users: readPreviewUsers() }
}

export async function savePreviewClass(values, { id, signal } = {}) {
  await delay(signal)
  const classes = readPreviewClasses()
  const existing = classes.find((item) => item.id === id)
  if (id && !existing) throw new Error('NOT_FOUND')
  const fields = validateClass(values, classes, readPreviewCourses(), existing)
  if (Object.keys(fields).length) throw Object.assign(new Error('VALIDATION'), { fields })
  const record = { id: existing?.id || `CL-${crypto.randomUUID()}`, code: values.code.trim().toUpperCase(), courseId: values.courseId, instructorId: existing?.instructorId || null, status: existing?.status || 'Active' }
  const next = existing ? classes.map((item) => item.id === id ? record : item) : [record, ...classes]
  writePreviewClasses(next)
  return { classes: next, record }
}

export async function changePreviewClass(id, action, { signal } = {}) {
  await delay(signal)
  const classes = readPreviewClasses()
  const existing = classes.find((item) => item.id === id)
  if (!existing) throw new Error('NOT_FOUND')
  if (!['activate', 'deactivate', 'delete'].includes(action)) throw new Error('INVALID_ACTION')
  if (action === 'delete' && hasClassRelationships(existing)) throw new Error('HAS_RECORDS')
  if (action === 'activate' && readPreviewCourses().find((course) => course.id === existing.courseId)?.status !== 'Active') throw new Error('INACTIVE_COURSE')
  const next = action === 'delete' ? classes.filter((item) => item.id !== id) : classes.map((item) => item.id === id ? { ...item, status: action === 'activate' ? 'Active' : 'Inactive' } : item)
  writePreviewClasses(next)
  return next
}

export function classErrorMessage(error, loading = false) {
  if (error.message === 'OFFLINE') return 'You are offline. Check your connection and try again. No changes were saved.'
  if (error.message === 'NOT_FOUND') return 'This class is no longer available. Close this dialog and refresh the directory.'
  if (error.message === 'HAS_RECORDS') return 'This class has enrollments or an assigned instructor. Deactivate it instead of deleting it.'
  if (error.message === 'INACTIVE_COURSE') return 'Activate the linked course before activating this class.'
  return loading ? 'We could not load the sample classes and related records. Check browser storage and try again.' : 'Unable to save the preview. Your details have been kept. Allow browser storage and try again.'
}
