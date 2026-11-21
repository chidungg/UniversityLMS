import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const resetKey = 'university-lms.password-reset-preview.v1'
const userKey = 'university-lms.user-preview.v1'

async function openResets(page) {
  await page.goto('/admin/password-resets')
  await expect(page.getByRole('table')).toBeVisible()
}

for (const width of [1024, 1440, 1920]) {
  test(`password reset queue desktop layout ${width}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 })
    await openResets(page)
    await page.evaluate(() => document.fonts.ready)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
    await page.screenshot({ path: testInfo.outputPath(`password-resets-${width}.png`), fullPage: true })
  })
}

test('search, status & account filters, sorting and request details dialog', async ({ page }, testInfo) => {
  await openResets(page)
  await expect(page.locator('tbody tr')).toHaveCount(6)

  await page.getByLabel('Search requests').fill('Database Systems')
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await expect(page.locator('tbody')).toContainText('Linh Tran')

  await page.getByLabel('Status', { exact: true }).selectOption('Completed')
  await expect(page.getByRole('heading', { name: 'No matching requests' })).toBeVisible()
  await page.getByRole('button', { name: 'Clear all filters' }).click()
  await expect(page.getByLabel('Search requests')).toBeFocused()
  await expect(page.locator('tbody tr')).toHaveCount(6)

  await page.getByLabel('Account check', { exact: true }).selectOption('Needs review')
  await expect(page.locator('tbody tr')).toHaveCount(2)
  await expect(page.locator('tbody')).toContainText('Inactive account')
  await expect(page.locator('tbody')).toContainText('Account not found')
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click()

  await page.getByRole('button', { name: 'Sort by student' }).click()
  await expect(page.getByRole('columnheader', { name: 'Sort by student' })).toHaveAttribute('aria-sort', 'ascending')
  await expect(page.locator('tbody tr').first()).toContainText('An Le')

  const trigger = page.getByRole('button', { name: 'View request PR-105 for Minh Nguyen', exact: true })
  await trigger.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('Locked out after switching to a new laptop')
  await expect(dialog).toContainText('21/11/2026, 09:15')
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await page.screenshot({ path: testInfo.outputPath('reset-details-dialog.png'), fullPage: true })
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
})

test('complete reset: validation, password toggle, mismatch check, no password persisted, reload persistence', async ({ page }, testInfo) => {
  await openResets(page)
  await page.getByRole('button', { name: 'Reset password for PR-105', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel(/verified Minh Nguyen/i)).toBeFocused()

  // Submit empty -> focusable error summary + inline errors
  await dialog.getByRole('button', { name: 'Confirm password reset', exact: true }).click()
  await expect(dialog.locator('.user-error-summary')).toBeFocused()
  await expect(dialog.locator('#reset-verified-error')).toBeVisible()
  await expect(dialog.locator('#reset-password-error')).toHaveText('Enter a temporary password.')
  await expect(dialog.locator('#reset-confirm-error')).toHaveText('Confirm the temporary password.')

  // Short password + mismatch + show/hide toggle
  await dialog.getByLabel(/verified Minh Nguyen/i).check()
  await dialog.locator('#reset-password').fill('short')
  await dialog.locator('#reset-confirmPassword').fill('different')
  await dialog.getByRole('button', { name: 'Show temporary password', exact: true }).click()
  await expect(dialog.locator('#reset-password')).toHaveAttribute('type', 'text')
  await dialog.getByRole('button', { name: 'Confirm password reset', exact: true }).click()
  await expect(dialog.locator('#reset-password-error')).toContainText('at least 8 characters')
  await expect(dialog.locator('#reset-confirm-error')).toHaveText('Passwords do not match.')

  // Valid reset
  const secretTemp = 'TempReset#2026!'
  await dialog.locator('#reset-password').fill(secretTemp)
  await dialog.locator('#reset-confirmPassword').fill(secretTemp)
  await dialog.getByLabel(/Resolution note/i).fill('Verified student ID card at faculty office.')
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await page.screenshot({ path: testInfo.outputPath('reset-password-dialog.png'), fullPage: true })
  await dialog.getByRole('button', { name: 'Confirm password reset', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Saving…' })).toBeDisabled()
  await expect(dialog).toHaveCount(0)

  await expect(page.locator('.user-feedback')).toContainText('Password reset recorded for Minh Nguyen (PR-105)')
  const row = page.locator('tbody tr').filter({ hasText: 'PR-105' })
  await expect(row).toContainText('Completed')
  await expect(row).not.toContainText(secretTemp)

  // Security check: temporary password is NEVER written to sessionStorage
  const storedRaw = await page.evaluate((key) => sessionStorage.getItem(key), resetKey)
  expect(storedRaw).not.toContain(secretTemp)

  await page.reload()
  await expect(page.locator('tbody tr').filter({ hasText: 'PR-105' })).toContainText('Completed')
})

test('blocked reset for inactive and unmatched accounts; reject with required reason', async ({ page }, testInfo) => {
  await openResets(page)

  // Inactive student blocked from reset
  await page.getByRole('button', { name: 'Reset password for PR-103', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('Reset cannot be completed')
  await expect(dialog).toContainText('currently Inactive')
  await expect(dialog.getByRole('link', { name: 'Open User management' })).toBeVisible()
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await page.keyboard.press('Escape')

  // Unmatched account blocked from reset
  await page.getByRole('button', { name: 'Reset password for PR-102', exact: true }).click()
  await expect(dialog).toContainText('Reset cannot be completed')
  await expect(dialog).toContainText('No student account matches')
  await page.keyboard.press('Escape')

  // Reject unmatched account request with validation + confirmation
  await page.getByRole('button', { name: 'Reject request PR-102', exact: true }).click()
  await expect(dialog.getByLabel(/Reason for rejection/i)).toBeFocused()
  await dialog.getByRole('button', { name: 'Reject request', exact: true }).click()
  await expect(dialog.locator('#reject-reason-error')).toHaveText('Enter a reason for rejecting this request.')
  await dialog.getByLabel(/Reason for rejection/i).fill('Email address does not match any registered student account.')
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await page.screenshot({ path: testInfo.outputPath('reject-reset-dialog.png'), fullPage: true })
  await dialog.getByRole('button', { name: 'Reject request', exact: true }).click()
  await expect(dialog).toHaveCount(0)

  await expect(page.locator('.user-feedback')).toContainText('PR-102 rejected')
  await expect(page.locator('tbody tr').filter({ hasText: 'PR-102' })).toContainText('Rejected')
})

test('unsaved changes discard guard, offline retry, stale records and storage errors', async ({ page, context }) => {
  await openResets(page)
  const trigger = page.getByRole('button', { name: 'Reject request PR-104', exact: true })
  await trigger.click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel(/Reason for rejection/i).fill('Unsaved rejection reason')
  await page.keyboard.press('Escape')
  await expect(dialog.getByRole('button', { name: 'Keep editing' })).toBeFocused()
  await dialog.getByRole('button', { name: 'Keep editing' }).click()
  await expect(dialog.getByLabel(/Reason for rejection/i)).toBeFocused()
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await dialog.getByRole('button', { name: 'Discard changes' }).click()
  await expect(trigger).toBeFocused()

  // Offline load recovery
  await context.setOffline(true)
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Unable to load reset requests' })).toBeVisible()
  await context.setOffline(false)
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('table')).toBeVisible()

  // Stale already-processed request caught on save
  await page.getByRole('button', { name: 'Reject request PR-104', exact: true }).click()
  await dialog.getByLabel(/Reason for rejection/i).fill('Duplicate submission')
  await page.evaluate((key) => {
    const items = JSON.parse(sessionStorage.getItem(key) || '[]')
    if (items.length) {
      items.find((item) => item.id === 'PR-104').status = 'Completed'
      sessionStorage.setItem(key, JSON.stringify(items))
    } else {
      sessionStorage.setItem(key, JSON.stringify([{
        id: 'PR-104',
        email: 'linh@example.edu',
        note: '',
        submittedAt: '2026-11-21T01:40:00.000Z',
        status: 'Completed',
        reviewedAt: '2026-11-21T02:00:00.000Z',
        resolutionNote: 'Already done',
      }]))
    }
  }, resetKey)
  await dialog.getByRole('button', { name: 'Reject request', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('already been processed')
})

test('empty queue and 105 long requests paginate and wrap cleanly at 1024px', async ({ page }) => {
  await page.goto('/admin')
  await page.evaluate((key) => sessionStorage.setItem(key, '[]'), resetKey)
  await page.goto('/admin/password-resets')
  await expect(page.getByRole('heading', { name: 'No password reset requests' })).toBeVisible()

  await page.evaluate(({ resetKey, userKey }) => {
    const users = Array.from({ length: 105 }, (_, index) => ({
      id: `S-${index}`,
      name: `Nguyen Van Student ${'Long Name '.repeat(3)}${index}`,
      email: `${'student'.repeat(6)}-${index}@university.example.edu`,
      role: 'Student',
      status: 'Active',
    }))
    const requests = Array.from({ length: 105 }, (_, index) => ({
      id: `PR-${200 + index}`,
      email: users[index].email,
      note: 'Detailed student recovery request explaining locked account before exams. '.repeat(4),
      submittedAt: new Date(Date.UTC(2026, 10, 21, 1, 0, index)).toISOString(),
      status: index % 3 === 0 ? 'Pending' : index % 3 === 1 ? 'Completed' : 'Rejected',
      reviewedAt: index % 3 === 0 ? null : new Date(Date.UTC(2026, 10, 21, 2, 0, index)).toISOString(),
      resolutionNote: index % 3 === 0 ? '' : 'Reviewed by administrator.',
    }))
    sessionStorage.setItem(userKey, JSON.stringify(users))
    sessionStorage.setItem(resetKey, JSON.stringify(requests))
  }, { resetKey, userKey })

  await page.setViewportSize({ width: 1024, height: 900 })
  await page.reload()
  await expect(page.locator('tbody tr')).toHaveCount(10)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(await page.locator('.admin-table-scroll').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
  await page.getByLabel('Rows per page').selectOption('50')
  await expect(page.locator('tbody tr')).toHaveCount(50)
  await page.getByRole('button', { name: 'Next page' }).click()
  await page.getByRole('button', { name: 'Next page' }).click()
  await expect(page.locator('tbody tr')).toHaveCount(5)
  await expect(page.getByText('Page 3 of 3', { exact: true })).toBeVisible()
})
