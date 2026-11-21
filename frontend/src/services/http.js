export class ApiError extends Error {
  constructor(message, status = 0, data = {}) { super(message); this.name = 'ApiError'; this.status = status; this.data = data; this.code = data.code; this.fields = data.fields }
}
export async function request(endpoint, { body, responseType, signal, ...options } = {}) {
  const timeout = AbortSignal.timeout(15000)
  let response
  try {
    response = await fetch(`/api${endpoint}`, {
      ...options, credentials: 'include', signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      headers: { Accept: 'application/json', 'X-LMS-Request': '1', ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
      ...(body ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}),
    })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new ApiError(timeout.aborted ? 'Kết nối quá thời gian. Vui lòng thử lại.' : 'Không thể kết nối máy chủ. Kiểm tra mạng và thử lại.')
  }
  if (response.status === 204) return null
  if (response.ok && responseType === 'blob') return response.blob()
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    if (!['/auth/login', '/auth/me'].includes(endpoint) && (response.status === 401 || ['ACCOUNT_DISABLED', 'PASSWORD_CHANGE_REQUIRED'].includes(data.code))) {
      window.dispatchEvent(new CustomEvent('lms:auth-invalid', { detail: data.code }))
    }
    throw new ApiError(response.status >= 500 ? 'Hệ thống tạm thời không khả dụng. Vui lòng thử lại.' : data.message || 'Không thể hoàn tất yêu cầu.', response.status, data)
  }
  return data
}
export const roleRoutes = { Administrator: '/admin/users', Instructor: '/instructor/classes', Student: '/student/courses' }
export function validUser(user) {
  return Boolean(user && typeof user._id === 'string' && user._id && Object.hasOwn(roleRoutes, user.role) && user.isActive === true)
}
export const authApi = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email: email.trim(), password } }),
  me: () => request('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),
  recover: (body) => request('/auth/recovery-requests', { method: 'POST', body }),
  changePassword: (body) => request('/auth/change-password', { method: 'POST', body }),
}
