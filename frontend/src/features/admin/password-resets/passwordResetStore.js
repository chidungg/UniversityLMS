export const PASSWORD_RESET_PREVIEW_KEY = 'university-lms.password-reset-preview.v1'
export const RESET_STATUSES = ['Pending', 'Completed', 'Rejected']

// Fictional sample requests linked to dashboardSample student emails for the frontend preview.
export const initialPasswordResetRequests = [
  {
    id: 'PR-105',
    email: 'minh@example.edu',
    note: 'Locked out after switching to a new laptop before the Software Engineering assignment deadline.',
    submittedAt: '2026-11-21T02:15:00.000Z',
    status: 'Pending',
    reviewedAt: null,
    resolutionNote: '',
  },
  {
    id: 'PR-104',
    email: 'linh@example.edu',
    note: 'Cannot sign in to view Database Systems lecture slides. Student ID verified at faculty desk.',
    submittedAt: '2026-11-21T01:40:00.000Z',
    status: 'Pending',
    reviewedAt: null,
    resolutionNote: '',
  },
  {
    id: 'PR-103',
    email: 'ha@example.edu',
    note: 'Returning from academic leave and unable to access my student account.',
    submittedAt: '2026-11-20T09:25:00.000Z',
    status: 'Pending',
    reviewedAt: null,
    resolutionNote: '',
  },
  {
    id: 'PR-102',
    email: 'quang.tran@example.edu',
    note: 'I may have entered my secondary email address instead of my registered university account.',
    submittedAt: '2026-11-20T07:10:00.000Z',
    status: 'Pending',
    reviewedAt: null,
    resolutionNote: '',
  },
  {
    id: 'PR-101',
    email: 'mai@example.edu',
    note: '',
    submittedAt: '2026-11-19T03:05:00.000Z',
    status: 'Completed',
    reviewedAt: '2026-11-19T03:32:00.000Z',
    resolutionNote: 'Identity verified in person with student ID card. Temporary reset completed.',
  },
  {
    id: 'PR-100',
    email: 'an@example.edu',
    note: 'Submitting a password reset request on behalf of a classmate in SE104-01.',
    submittedAt: '2026-11-18T08:20:00.000Z',
    status: 'Rejected',
    reviewedAt: '2026-11-18T09:00:00.000Z',
    resolutionNote: 'Third-party requests are not permitted. The account holder must submit directly.',
  },
]

export function readPreviewPasswordResets() {
  const raw = sessionStorage.getItem(PASSWORD_RESET_PREVIEW_KEY)
  if (raw === null) return structuredClone(initialPasswordResetRequests)
  const items = JSON.parse(raw)
  if (
    !Array.isArray(items) ||
    items.some((item) => (
      !item ||
      typeof item.id !== 'string' || !item.id.trim() ||
      typeof item.email !== 'string' || !item.email.trim() ||
      typeof item.note !== 'string' ||
      typeof item.submittedAt !== 'string' || Number.isNaN(Date.parse(item.submittedAt)) ||
      !RESET_STATUSES.includes(item.status) ||
      !(item.reviewedAt === null || (typeof item.reviewedAt === 'string' && !Number.isNaN(Date.parse(item.reviewedAt)))) ||
      typeof item.resolutionNote !== 'string'
    )) ||
    new Set(items.map((item) => item.id)).size !== items.length
  ) throw new Error('STORAGE')
  return items
}

export function writePreviewPasswordResets(items) {
  sessionStorage.setItem(PASSWORD_RESET_PREVIEW_KEY, JSON.stringify(items))
}
