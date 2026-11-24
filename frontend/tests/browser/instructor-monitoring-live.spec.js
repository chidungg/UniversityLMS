import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

async function signIn(page, email = 'instructor@browser.test', password = 'Browser-test-2026') {
  await page.goto('/login')
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
}

test('live API: instructor Monitor Students gradebook, progress tracking, exception flows, and read-only enforcement (desktop)', async ({ page }) => {
  const nonGetMonitoringRequests = []
  page.on('request', (req) => {
    if (req.url().includes('/monitoring/') && req.method() !== 'GET') {
      nonGetMonitoringRequests.push(`${req.method()} ${req.url()}`)
    }
  })

  await page.setViewportSize({ width: 1440, height: 900 })
  await signIn(page)
  await expect(page).toHaveURL(/\/instructor\//)

  await page.getByRole('navigation', { name: 'Teaching modules', exact: true })
    .getByRole('link', { name: 'Monitor Students', exact: true })
    .click()
  await expect(page).toHaveURL(/\/instructor\/monitoring/)

  // Main Flow + Alternate Flow 5.1: Select DBI202 and review Gradebook
  const courseSelect = page.getByLabel('Assigned Course', { exact: true })
  const dbiValue = await courseSelect.locator('option').filter({ hasText: 'DBI202' }).first().getAttribute('value')
  await courseSelect.selectOption(dbiValue)

  await expect(page.getByRole('table', { name: 'Course gradebook', exact: true })).toBeVisible()
  await expect(page.getByRole('table', { name: 'Course gradebook', exact: true })).toContainText('Second Student')
  await expect(page.getByRole('table', { name: 'Course gradebook', exact: true })).toContainText('8.5 / 10')
  await expect(page.getByRole('table', { name: 'Course gradebook', exact: true })).toContainText('Needs Grading')
  await expect(page.getByRole('table', { name: 'Course gradebook', exact: true })).toContainText('8 / 10')

  await page.evaluate(() => document.fonts.ready)
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  // Compact laptop width check (1024px)
  await page.setViewportSize({ width: 1024, height: 900 })
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.setViewportSize({ width: 1440, height: 900 })

  // Student detail inspection modal (read-only) + Escape dismiss
  await page.getByRole('button', { name: 'Details for Second Student', exact: true }).click()
  const modal = page.getByRole('dialog')
  await expect(modal).toBeVisible()
  await expect(modal).toContainText('ER Modeling Lab')
  await expect(modal).toContainText('Strong ER model.')
  await expect(modal).toContainText('Relational Algebra Quiz')
  await page.keyboard.press('Escape')
  await expect(modal).toHaveCount(0)

  // Alternate Flow 5.2: Track Learning Progress
  await page.getByRole('tab', { name: 'Track Learning Progress', exact: true }).click()
  await expect(page.getByRole('table', { name: 'Student learning progress', exact: true })).toBeVisible()
  await expect(page.getByRole('table', { name: 'Student learning progress', exact: true })).toContainText('2 / 2')
  await expect(page.getByRole('table', { name: 'Student learning progress', exact: true })).toContainText('1 / 1')
  await expect(page.getByRole('table', { name: 'Student learning progress', exact: true })).toContainText('On Track')
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])

  // Exception 3.1: No Students Enrolled (CS105)
  const cs105Value = await courseSelect.locator('option').filter({ hasText: 'CS105' }).first().getAttribute('value')
  await courseSelect.selectOption(cs105Value)
  await expect(page.getByRole('heading', { name: 'No students enrolled in this course' })).toBeVisible()
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])

  // Exception 6.1: No Academic Data Available (CS106)
  const cs106Value = await courseSelect.locator('option').filter({ hasText: 'CS106' }).first().getAttribute('value')
  await courseSelect.selectOption(cs106Value)
  await expect(page.getByRole('heading', { name: 'No academic data available yet' })).toBeVisible()
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])

  // Exception 6.2: Data Retrieval Failed + Retry recovery
  await courseSelect.selectOption(dbiValue)
  await expect(page.getByRole('table', { name: 'Student learning progress', exact: true })).toBeVisible()

  await page.route('**/api/instructor/courses/*/monitoring/*', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'error',
        code: 'MONITORING_RETRIEVAL_FAILED',
        message: 'Unable to retrieve student monitoring data. Please try again.',
      }),
    })
  })

  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  const alert = page.getByRole('alert')
  await expect(alert).toBeVisible()
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])

  await page.unroute('**/api/instructor/courses/*/monitoring/*')
  await alert.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.getByRole('table', { name: 'Student learning progress', exact: true })).toBeVisible()

  // Post-condition: read-only GET requests only
  expect(nonGetMonitoringRequests).toEqual([])
})
