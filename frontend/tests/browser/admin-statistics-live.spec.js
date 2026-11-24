import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

async function signIn(page, email = 'administrator@browser.test', password = 'Browser-test-2026') {
  await page.goto('/login')
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
}

const rowFor = (page, code) => page.locator('.stat-table tbody tr').filter({
  has: page.getByRole('link', { name: code, exact: true }),
})

test('live API: system statistics, filtering criteria, empty data state, failure retry, and read-only enforcement (desktop)', async ({ page }) => {
  const nonGetStatisticsRequests = []
  page.on('request', (req) => {
    if (req.url().includes('/api/admin/statistics') && req.method() !== 'GET') {
      nonGetStatisticsRequests.push(`${req.method()} ${req.url()}`)
    }
  })

  await page.setViewportSize({ width: 1440, height: 900 })
  await signIn(page)
  await expect(page).toHaveURL(/\/admin\/users$/)

  await page.getByRole('navigation', { name: 'Administration', exact: true })
    .getByRole('link', { name: 'Statistics & reports', exact: true })
    .click()
  await expect(page).toHaveURL(/\/admin\/statistics$/)

  // Main Flow: live summary strip, breakdown table, comparison charts, no sample banner
  await expect(page.getByRole('heading', { name: 'Statistics & reports', exact: true })).toBeVisible()
  await expect(page.locator('.user-preview-notice')).toHaveCount(0)
  await expect(page.getByRole('table')).toBeVisible()

  const dbiRow = rowFor(page, 'DBI202')
  await expect(dbiRow).toContainText('Database Systems')
  await expect(dbiRow).toContainText('85%')
  await expect(dbiRow).toContainText('80%')
  await expect(rowFor(page, 'NET301')).toContainText('Inactive')

  await expect(page.getByRole('heading', { name: 'Enrollment by course' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Assessment scores by course' })).toBeVisible()

  await page.evaluate(() => document.fonts.ready)
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  // Check compact desktop laptop viewport (1024px) — no horizontal overflow or Axe issues
  await page.setViewportSize({ width: 1024, height: 900 })
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.setViewportSize({ width: 1440, height: 900 })

  // Interactive chart series legend toggle
  await page.getByRole('button', { name: 'Assignments', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Assignments', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Both', exact: true }).click()

  // Alternate Flow 4.1: filter by Course status & persist across reload
  await page.getByLabel('Course status', { exact: true }).selectOption('Active')
  await expect(page).toHaveURL(/courseStatus=Active/)
  await expect(rowFor(page, 'NET301')).toHaveCount(0)
  await expect(rowFor(page, 'DBI202')).toBeVisible()

  await page.reload()
  await expect(page.getByLabel('Course status', { exact: true })).toHaveValue('Active')
  await expect(rowFor(page, 'NET301')).toHaveCount(0)

  // Filter by specific Course & Assignments focus
  const dbiOptionValue = await page.getByLabel('Course', { exact: true })
    .locator('option')
    .filter({ hasText: 'DBI202' })
    .first()
    .getAttribute('value')
  await page.getByLabel('Course', { exact: true }).selectOption(dbiOptionValue)
  await page.getByLabel('Statistical focus', { exact: true }).selectOption('assignments')

  await expect(page.locator('.stat-table tbody tr')).toHaveCount(1)
  await expect(page.locator('.stat-table thead')).toContainText('Pending Grading')
  await expect(rowFor(page, 'DBI202')).toContainText('85%')
  await expect(page.getByRole('heading', { name: 'Enrollment by course' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Assessment scores by course' })).toBeVisible()

  // Switch focus to Quizzes & check sortable header
  await page.getByLabel('Statistical focus', { exact: true }).selectOption('quizzes')
  await expect(page.locator('.stat-table thead')).toContainText('Pass Rate')
  await expect(rowFor(page, 'DBI202')).toContainText('100%')

  const sortBtn = page.getByRole('button', { name: 'Sort by course', exact: true })
  await sortBtn.click()
  await expect(page.getByRole('columnheader', { name: 'Sort by course', exact: true })).toHaveAttribute('aria-sort', 'descending')

  // Exception Flow 2.1: No Data Available when filtering Inactive + Enrollments
  await page.getByLabel('Course', { exact: true }).selectOption('all')
  await page.getByLabel('Course status', { exact: true }).selectOption('Inactive')
  await page.getByLabel('Statistical focus', { exact: true }).selectOption('enrollments')
  await expect(page.getByRole('heading', { name: 'No statistical data is currently available' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Enrollment by course' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Assessment scores by course' })).toHaveCount(0)
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])

  await page.getByRole('button', { name: 'Reset filters', exact: true }).first().click()
  await expect(page).toHaveURL(/\/admin\/statistics$/)
  await expect(rowFor(page, 'DBI202')).toBeVisible()
  await expect(rowFor(page, 'NET301')).toBeVisible()

  // Exception Flow 2.2: Data Retrieval Failed + Try again recovery
  await page.route('**/api/admin/statistics*', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'error',
        code: 'STATISTICS_RETRIEVAL_FAILED',
        message: 'Unable to retrieve statistical data. Please try again.',
      }),
    })
  })

  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  const alertPanel = page.getByRole('alert')
  await expect(alertPanel).toBeVisible()
  await expect(alertPanel).toContainText('Unable to retrieve statistical data')
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])

  await page.unroute('**/api/admin/statistics*')
  await alertPanel.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(rowFor(page, 'DBI202')).toBeVisible()

  // Post-condition: read-only GET requests only
  expect(nonGetStatisticsRequests).toEqual([])
})
