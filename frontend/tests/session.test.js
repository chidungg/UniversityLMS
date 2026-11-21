import test from 'node:test'
import assert from 'node:assert/strict'
import { request, authApi, validUser } from '../src/services/http.js'
const originalFetch = globalThis.fetch
globalThis.window = new EventTarget()
test.after(() => { globalThis.fetch = originalFetch; delete globalThis.window })
test('canonical schema rejects unknown roles, disabled users and preview IDs', () => {
  assert.equal(validUser({ _id: '123', role: 'Student', isActive: true }), true)
  for (const user of [{ id: '123', role: 'student', isActive: true }, { _id: '123', role: 'constructor', isActive: true }, { _id: '123', role: 'Administrator', isActive: false }]) assert.equal(validUser(user), false)
})
test('login sends cookie credentials and CSRF header without trimming passwords', async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/auth/login'); assert.equal(options.credentials, 'include')
    assert.equal(options.headers['X-LMS-Request'], '1'); assert.equal(options.headers.Authorization, undefined)
    assert.deepEqual(JSON.parse(options.body), { email: 'student@test.edu', password: ' password ' })
    return Response.json({ user: { _id: '1', role: 'Student', isActive: true } })
  }
  await authApi.login(' student@test.edu ', ' password ')
})
test('failed authentication and server errors never produce mock success', async () => {
  for (const status of [401, 403, 429, 500]) {
    globalThis.fetch = async () => Response.json({ code: 'FAIL', message: 'failure' }, { status })
    await assert.rejects(authApi.login('student@test.edu', 'wrong'), (error) => error.status === status)
  }
  globalThis.fetch = async () => { throw new TypeError('network down') }
  await assert.rejects(authApi.me(), (error) => error.status === 0)
})
test('protected API rejection invalidates session; login and me are handled by AuthContext', async () => {
  let events = 0
  const handler = () => { events++ }
  window.addEventListener('lms:auth-invalid', handler)
  globalThis.fetch = async () => Response.json({ code: 'SESSION_EXPIRED' }, { status: 401 })
  await assert.rejects(request('/student/courses')); assert.equal(events, 1)
  await assert.rejects(authApi.me()); assert.equal(events, 1)
  await assert.rejects(authApi.login('student@test.edu', 'wrong')); assert.equal(events, 1)
  window.removeEventListener('lms:auth-invalid', handler)
})
