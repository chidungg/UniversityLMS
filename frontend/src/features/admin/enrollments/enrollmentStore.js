import { dashboardSample } from '../dashboardData'

export const ENROLLMENT_PREVIEW_KEY = 'university-lms.enrollment-preview.v1'

// Storage only: avoids circular dependencies across Class, Dashboard and Enrollment adapters.
export function readPreviewEnrollments() {
  const raw = sessionStorage.getItem(ENROLLMENT_PREVIEW_KEY)
  if (raw === null) return structuredClone(dashboardSample.enrollments)
  const items = JSON.parse(raw)
  if (
    !Array.isArray(items) ||
    items.some((item) => !item || typeof item.studentId !== 'string' || !item.studentId.trim() || typeof item.classId !== 'string' || !item.classId.trim()) ||
    new Set(items.map((item) => `${item.classId}::${item.studentId}`)).size !== items.length
  ) throw new Error('STORAGE')
  return items
}

export function writePreviewEnrollments(items) {
  sessionStorage.setItem(ENROLLMENT_PREVIEW_KEY, JSON.stringify(items))
}
