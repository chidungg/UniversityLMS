import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

async function enterCredentials(page) {
  await page.getByLabel('Email', { exact: false }).fill('student@example.edu.vn')
  await page.getByLabel(/^Password/).fill('a-real-password')
}

for (const [width, height] of [[1440, 900], [1024, 768], [1920, 1080]]) {
  test(`layout and accessibility at ${width} × ${height}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height })
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/login')
    await page.evaluate(() => document.fonts.ready)
    await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
    expect(result.violations).toEqual([])
    expect(errors).toEqual([])
    await page.screenshot({ path: testInfo.outputPath(`login-${width}.png`), fullPage: true })
  })
}

test('empty submit focuses a linked summary and keeps inline errors', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('alert')).toBeFocused()
  await expect(page.locator('#email')).toHaveAttribute('aria-invalid', 'true')
  await expect(page.locator('#password')).toHaveAttribute('aria-describedby', 'password-error')
  await page.getByRole('link', { name: 'Please enter your email.' }).click()
  await expect(page.locator('#email')).toBeFocused()
  await page.locator('#email').fill('incorrect')
  await page.locator('#email').blur()
  await expect(page.locator('#email-error')).toContainText('valid email address')
  await enterCredentials(page)
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('password visibility and keyboard navigation', async ({ page }) => {
  await page.goto('/login')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused()
  await enterCredentials(page)
  await page.getByRole('button', { name: 'Show password', exact: true }).click()
  await expect(page.locator('#password')).toHaveAttribute('type', 'text')
  await expect(page.getByRole('button', { name: 'Hide password', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Enter')
  await expect(page.locator('#password')).toHaveAttribute('type', 'password')
})

for (const [status, body, message] of [
  [401, {}, 'Incorrect email or password'],
  [403, { code: 'ACCOUNT_DISABLED' }, 'Your account has been disabled'],
  [403, {}, 'Your account does not have access'],
  [429, {}, 'Too many sign-in attempts'],
  [500, {}, 'Unable to connect to the system'],
  [200, { user: { id: '1', role: 'unknown' } }, 'Unable to verify your sign-in session'],
]) {
  test(`server error ${status}: ${message}`, async ({ page }) => {
    await page.route('**/test-auth/login', (route) => route.fulfill({ status, json: body }))
    await page.goto('/login')
    await enterCredentials(page)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page.locator('.form-notice')).toContainText(message)
    await expect(page.locator('#password')).toHaveValue('a-real-password')
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled()
  })
}

for (const [role, destination] of [['student', '/student/courses'], ['instructor', '/instructor/classes'], ['admin', '/admin/users']]) {
  test(`loading, single submission, success, and ${role} redirect`, async ({ page }) => {
    let release
    let requests = 0
    const gate = new Promise((resolve) => { release = resolve })
    await page.route('**/test-auth/login', async (route) => {
      requests += 1
      await gate
      await route.fulfill({ json: { user: { id: 'test-user', role, isActive: true } } })
    })
    await page.goto('/login')
    await enterCredentials(page)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Signing in…' })).toBeDisabled()
    await page.locator('form').evaluate((form) => form.requestSubmit())
    expect(requests).toBe(1)
    release()
    await expect(page.locator('.success-notice')).toContainText('Signed in successfully')
    await expect(page.locator('#password')).toHaveValue('')
    await expect(page).toHaveURL(new RegExp(`${destination}$`))
    await expect(page.getByRole('heading', { name: 'Page unavailable' })).toBeVisible()
  })
}

test('connection failure can be retried successfully', async ({ page }) => {
  await page.route('**/test-auth/login', (route) => route.abort('failed'))
  await page.goto('/login')
  await enterCredentials(page)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.locator('.form-notice')).toContainText('Unable to connect')
  await page.unroute('**/test-auth/login')
  await page.route('**/test-auth/login', (route) => route.fulfill({ json: { user: { id: 'test', role: 'student' } } }))
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.locator('.success-notice')).toBeVisible()
})

test('offline feedback retains input', async ({ page, context }) => {
  await page.goto('/login')
  await enterCredentials(page)
  await context.setOffline(true)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.locator('.form-notice')).toContainText('You are offline')
  await expect(page.locator('#email')).toHaveValue('student@example.edu.vn')
  await context.setOffline(false)
})

test('password recovery opens as a dialog from help and direct links', async ({ page }) => {
  await page.goto('/forgot-password')
  await expect(page.getByRole('dialog', { name: 'Forgot your password?' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  await page.getByRole('link', { name: 'Help', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Sign-in help' })).toBeVisible()
  await page.getByRole('button', { name: 'I forgot my password' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'I forgot my password' })).toBeFocused()
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
})

test('reduced motion and enlarged text keep controls usable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/login')
  await page.addStyleTag({ content: 'html { zoom: 2; }' })
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Show password', exact: true }).click()
  await expect(page.locator('#password')).toHaveAttribute('type', 'text')
})

test('a stalled request times out with a retry action', async ({ page }) => {
  await page.route('**/test-auth/login', () => {})
  await page.goto('/login')
  await enterCredentials(page)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.locator('.form-notice')).toContainText('The connection is taking longer than expected', { timeout: 18000 })
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled()
})

test('leaving the form cancels a pending login without a late redirect', async ({ page }) => {
  await page.route('**/test-auth/login', () => {})
  await page.goto('/login')
  await enterCredentials(page)
  const failure = page.waitForEvent('requestfailed', { predicate: (request) => request.url().endsWith('/test-auth/login') })
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Signing in…' })).toBeDisabled()
  await page.getByRole('link', { name: 'Help', exact: true }).click()
  await failure
  await expect(page).toHaveURL(/\/support$/)
  await expect(page.getByRole('heading', { name: 'Sign-in help' })).toBeVisible()
})
