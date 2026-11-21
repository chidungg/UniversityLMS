import assert from 'node:assert/strict'
import { test } from 'node:test'
import { login, validateLogin } from '../src/features/auth/auth.js'

const credentials = { email: '  student@example.edu.vn  ', password: ' secret ' }
const response = (body, status = 200) => async () => new Response(JSON.stringify(body), { status })
const options = (body, status) => ({ endpoint: '/test-auth/login', fetcher: response(body, status) })

test('validates required fields and email, without imposing new password rules', () => {
  assert.deepEqual(Object.keys(validateLogin({ email: ' ', password: '' })), ['email', 'password'])
  assert.ok(validateLogin({ email: 'invalid@', password: 'x' }).email)
  assert.deepEqual(validateLogin({ email: 'student@example.edu.vn', password: 'x' }), {})
})

test('trims email, preserves the password, and sends credentials only in the request body', async () => {
  await login(credentials, { endpoint: '/test-auth/login', fetcher: async (url, init) => {
    assert.equal(url, '/test-auth/login')
    assert.equal(init.method, 'POST')
    assert.equal(init.credentials, 'include')
    assert.deepEqual(JSON.parse(init.body), { email: 'student@example.edu.vn', password: ' secret ' })
    return new Response(JSON.stringify({ user: { id: '1', role: 'student', isActive: true } }))
  } })
})

for (const [role, destination] of Object.entries({ admin: '/admin/users', instructor: '/instructor/classes', student: '/student/courses' })) {
  test(`routes a server-confirmed ${role} to the correct area`, async () => {
    assert.equal((await login(credentials, options({ user: { id: '1', role, isActive: true } }))).destination, destination)
  })
}

for (const [status, body, code] of [
  [401, {}, 'INVALID_CREDENTIALS'], [403, { code: 'ACCOUNT_DISABLED' }, 'ACCOUNT_DISABLED'],
  [403, {}, 'FORBIDDEN'], [429, {}, 'RATE_LIMITED'], [500, {}, 'UNAVAILABLE'],
  [200, { user: { id: '1', role: 'student', isActive: false } }, 'ACCOUNT_DISABLED'],
  [200, { user: { id: '1', role: 'superuser' } }, 'INVALID_RESPONSE'],
  [200, { user: { id: '1', role: 'constructor' } }, 'INVALID_RESPONSE'],
  [200, { user: { role: 'student' } }, 'INVALID_RESPONSE'],
]) {
  test(`handles ${status} / ${code} without granting access`, async () => {
    await assert.rejects(login(credentials, options(body, status)), { code })
  })
}

test('fails clearly when authentication has not been configured', async () => {
  await assert.rejects(login(credentials, { endpoint: '' }), { code: 'NOT_CONFIGURED' })
})

test('does not expose raw server or connection errors', async () => {
  await assert.rejects(login(credentials, { endpoint: '/test-auth/login', fetcher: async () => { throw new Error('internal detail') } }), { code: 'UNAVAILABLE' })
})

test('rejects invalid JSON even with a successful HTTP status', async () => {
  await assert.rejects(login(credentials, { endpoint: '/test-auth/login', fetcher: async () => new Response('<html>proxy error</html>') }), { code: 'INVALID_RESPONSE' })
})
