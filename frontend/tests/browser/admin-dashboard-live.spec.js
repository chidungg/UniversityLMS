import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

async function signIn(page, email = 'administrator@browser.test', password = 'Browser-test-2026') {
  await page.goto('/login')
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
}

const courseRow = (page, code) =>
  page.locator('.admin-table tbody tr').filter({
    has: page.getByRole('button', { name: code, exact: true }),
  })

test('live API: Admin Dashboard, removed Class UI, search/filter, details dialog, refresh & error recovery', async ({ page }) => {
  const nonGetDashboardRequests = []
  page.on('request', (req) => {
    if (req.url().includes('/api/admin/dashboard') && req.method() !== 'GET') {
      nonGetDashboardRequests.push(`${req.method()} ${req.url()}`)
    }
  })

  await page.setViewportSize({ width: 1440, height: 900 })
  await signIn(page)
  await expect(page).toHaveURL(/\/admin\/users$/)

  // Sidebar displays Dashboard (renamed from Overview) and omits Classes
  const sidebarNav = page.getByRole('navigation', { name: 'Administration', exact: true })
  await expect(sidebarNav.getByRole('link', { name: 'Dashboard', exact: true })).toBeVisible()
  await expect(sidebarNav.getByRole('link', { name: 'Overview', exact: true })).toHaveCount(0)
  await expect(sidebarNav.getByRole('link', { name: 'Classes', exact: true })).toHaveCount(0)

  // /admin/classes route is removed and falls through to 404 page
  await page.goto('/admin/classes')
  await expect(page.getByRole('heading', { name: 'Page Not Found (404)', exact: true })).toBeVisible()

  // Navigate to Dashboard via sidebar from /admin/users and capture live API response
  await page.goto('/admin/users')
  const dashboardResponsePromise = page.waitForResponse(
    (res) => res.url().includes('/api/admin/dashboard') && res.request().method() === 'GET',
  )
  await sidebarNav.getByRole('link', { name: 'Dashboard', exact: true }).click()
  await expect(page).toHaveURL(/\/admin$/)

  const dashboardResponse = await dashboardResponsePromise
  expect(dashboardResponse.status()).toBe(200)
  const payload = await dashboardResponse.json()

  // Confirm live values, updated heading/title/breadcrumb, and zero sample data notice
  await expect(page).toHaveTitle('Dashboard | University LMS')
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Breadcrumb', exact: true })).toContainText('Dashboard')
  await expect(page.locator('.admin-preview-notice')).toHaveCount(0)
  await expect(page.getByText('Sample data', { exact: true })).toHaveCount(0)

  expect(payload.summary.users.students).toBeGreaterThanOrEqual(3)
  expect(payload.summary.courses.total).toBeGreaterThanOrEqual(5)
  expect(payload.summary.enrollments.total).toBeGreaterThanOrEqual(2)

  await expect(page.locator('.admin-metric').filter({ hasText: 'Students' }).locator('strong')).toHaveText(
    String(payload.summary.users.students),
  )
  await expect(page.locator('.admin-metric').filter({ hasText: 'Instructors' }).locator('strong')).toHaveText(
    String(payload.summary.users.instructors),
  )
  await expect(page.locator('.admin-metric').filter({ hasText: 'Active courses' }).locator('strong')).toHaveText(
    String(payload.summary.courses.active),
  )
  await expect(page.locator('.admin-metric').filter({ hasText: 'Enrollments' }).locator('strong')).toHaveText(
    String(payload.summary.enrollments.total),
  )

  await expect(courseRow(page, 'DBI202')).toContainText('Database Systems')
  await expect(courseRow(page, 'DBI202')).toContainText('Test Instructor')
  await expect(courseRow(page, 'DBI202')).toContainText('Active')
  await expect(courseRow(page, 'SE104')).toContainText('Not assigned')
  await expect(courseRow(page, 'NET301')).toContainText('Inactive')

  const quickAccess = page.getByRole('complementary', { name: 'Quick access', exact: true })
  await expect(quickAccess.getByRole('link', { name: 'User management' })).toBeVisible()
  await expect(quickAccess.getByRole('link', { name: 'Courses' })).toBeVisible()
  await expect(quickAccess.getByRole('link', { name: 'Enrollment & assignment' })).toBeVisible()
  await expect(quickAccess.getByRole('link', { name: 'Password resets' })).toBeVisible()
  await expect(quickAccess.getByRole('link', { name: 'Statistics & reports' })).toBeVisible()
  await expect(quickAccess.getByRole('link', { name: 'Classes' })).toHaveCount(0)

  // Accessibility & overflow checks at desktop 1440px and compact desktop 1024px
  await page.evaluate(() => document.fonts.ready)
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  await page.setViewportSize({ width: 1024, height: 900 })
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.setViewportSize({ width: 1440, height: 900 })

  // Course search & status filter
  await page.getByRole('textbox', { name: 'Search courses', exact: true }).fill('DBI202')
  await expect(courseRow(page, 'DBI202')).toBeVisible()
  await expect(courseRow(page, 'SE104')).toHaveCount(0)

  await page.getByRole('textbox', { name: 'Search courses', exact: true }).fill('no-course-match-xyz')
  await expect(page.getByText('No courses found')).toBeVisible()
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click()
  await expect(courseRow(page, 'SE104')).toBeVisible()

  await page.getByRole('button', { name: 'Inactive', exact: true }).click()
  await expect(courseRow(page, 'NET301')).toBeVisible()
  await expect(courseRow(page, 'DBI202')).toHaveCount(0)
  await page.getByRole('button', { name: 'All', exact: true }).click()
  await expect(courseRow(page, 'DBI202')).toBeVisible()

  // Needs attention Review dialog + Escape focus restoration
  const reviewSeBtn = page.getByRole('button', { name: 'Review SE104', exact: true })
  await reviewSeBtn.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('SE104')
  await expect(dialog).toContainText('Software Engineering')
  await expect(dialog).toContainText('Not assigned')
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(reviewSeBtn).toBeFocused()

  // Course Details modal links cleanly to Enrollment & assignment for selected course
  await page.getByRole('button', { name: 'DBI202', exact: true }).click()
  await expect(dialog).toContainText('Database Systems')
  await expect(dialog).toContainText('Test Instructor')
  await expect(dialog).toContainText('Manage enrollments')
  await dialog.getByRole('link', { name: 'Manage enrollments' }).click()
  await expect(page).toHaveURL(/\/admin\/enrollments\?courseId=/)
  await expect(page.getByLabel('Select course')).toContainText('DBI202 — Database Systems')

  // Return to Dashboard, test Refresh and 500 error recovery
  await sidebarNav.getByRole('link', { name: 'Dashboard', exact: true }).click()
  await expect(page).toHaveURL(/\/admin$/)
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(page.locator('.admin-feedback')).toContainText('Dashboard updated.')

  await page.route('**/api/admin/dashboard', (route) =>
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'error',
        code: 'DASHBOARD_RETRIEVAL_FAILED',
        message: 'Unable to load dashboard data. Please try again.',
      }),
    }),
  )
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(page.locator('.admin-feedback.has-failed')).toContainText(
    'Unable to load dashboard data from the database. Please try again.',
  )
  await page.unroute('**/api/admin/dashboard')
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.locator('.admin-feedback')).toContainText('Dashboard updated.')

  // Verify initial load 500 error state + Try again recovery
  await page.route('**/api/admin/dashboard', (route) =>
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'error',
        code: 'DASHBOARD_RETRIEVAL_FAILED',
        message: 'Unable to load dashboard data. Please try again.',
      }),
    }),
  )
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Unable to load dashboard', exact: true })).toBeVisible()
  await page.unroute('**/api/admin/dashboard')
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(courseRow(page, 'DBI202')).toBeVisible()

  expect(nonGetDashboardRequests).toEqual([])
})
