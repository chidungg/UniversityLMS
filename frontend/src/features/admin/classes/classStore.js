import { dashboardSample } from '../dashboardData'
import { readPreviewEnrollments } from '../enrollments/enrollmentStore'

export const CLASS_PREVIEW_KEY = 'university-lms.class-preview.v1'

// Storage only: avoids a circular dependency between Course and Class adapters.
export function readPreviewClasses() {
  const raw = sessionStorage.getItem(CLASS_PREVIEW_KEY)
  if (raw === null) return dashboardSample.classes.map((item) => ({ ...item, code: item.id }))
  const items = JSON.parse(raw)
  if (!Array.isArray(items) || items.some((item) => !item || typeof item.id !== 'string' || !item.id || typeof item.code !== 'string' || !item.code.trim() || typeof item.courseId !== 'string' || !item.courseId || !(item.instructorId === null || typeof item.instructorId === 'string') || !['Active', 'Inactive'].includes(item.status)) || new Set(items.map((item) => item.id)).size !== items.length || new Set(items.map((item) => item.code.toUpperCase())).size !== items.length) throw new Error('STORAGE')
  return items
}

export function writePreviewClasses(items) {
  sessionStorage.setItem(CLASS_PREVIEW_KEY, JSON.stringify(items))
}

export function classEnrollmentCount(id) {
  try {
    return readPreviewEnrollments().filter((entry) => entry.classId === id).length
  } catch {
    return dashboardSample.enrollments.filter((entry) => entry.classId === id).length
  }
}

export function hasClassRelationships(item) {
  return Boolean(item.instructorId) || classEnrollmentCount(item.id) > 0
}
