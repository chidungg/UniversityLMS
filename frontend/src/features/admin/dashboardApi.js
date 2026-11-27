import { request } from '../../services/http'

export async function fetchAdminDashboard({ signal } = {}) {
  if (globalThis.navigator?.onLine === false) {
    throw new Error('OFFLINE')
  }
  return request('/admin/dashboard', { signal })
}

export function dashboardErrorMessage(error) {
  const code = error?.code || error?.message
  if (globalThis.navigator?.onLine === false || code === 'OFFLINE' || error?.status === 0) {
    return 'You are offline or unable to reach the server. Check your connection and try again.'
  }
  if (error?.status === 403) {
    return 'You do not have permission to view the admin dashboard.'
  }
  if (code === 'DASHBOARD_RETRIEVAL_FAILED' || error?.status >= 500) {
    return 'Unable to load dashboard data from the database. Please try again.'
  }
  return error?.message || 'Unable to load dashboard data. Please try again.'
}

export function formatDashboardTimestamp(isoString) {
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
