import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

async function signIn(page, email, password = 'Browser-test-2026') {
  await page.goto('/login')
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
}

test('live API: user directory, add, update, guardrails, activate/deactivate and session revocation', async ({ page, browser }) => {
  // 1. Admin signs in and lands on live User management (no preview banner)
  await signIn(page, 'administrator@browser.test')
  await expect(page).toHaveURL(/\/admin\/users$/)
  await expect(page.getByRole('table')).toBeVisible()
  await expect(page.locator('.user-preview-notice')).toHaveCount(0)

  await page.evaluate(() => document.fonts.ready)
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  // Mobile layout check (375px)
  await page.setViewportSize({ width: 375, height: 812 })
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.setViewportSize({ width: 1440, height: 900 })

  // 2. Self row guardrails in directory
  const adminRow = page.locator('tbody tr').filter({ hasText: 'administrator@browser.test' })
  await expect(adminRow).toContainText('You')
  await expect(adminRow.getByRole('button', { name: /^Deactivate / })).toBeDisabled()

  // 3. Search, role/status filter, sort & clear filters
  await page.getByLabel('Search users').fill('instructor@browser.test')
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click()
  await page.getByLabel('Role', { exact: true }).selectOption('Instructor')
  await expect(page.locator('tbody')).toContainText('instructor@browser.test')
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click()

  await page.getByRole('button', { name: 'Sort by full name' }).click()
  await expect(page.getByRole('columnheader', { name: 'Sort by full name' })).toHaveAttribute('aria-sort', 'descending')

  // 4. Add User: missing fields (5.1), invalid/mismatched password (7.1), duplicate email (7.2), and creation
  await page.getByRole('button', { name: 'Add user', exact: true }).click()
  const addDialog = page.getByRole('dialog')
  await expect(page.getByLabel('Full name', { exact: true })).toBeFocused()
  await addDialog.getByRole('button', { name: 'Add user', exact: true }).click()
  await expect(addDialog.locator('.user-error-summary')).toBeFocused()
  await expect(addDialog.locator('#user-name-error')).toBeVisible()
  await expect(addDialog.locator('#user-email-error')).toBeVisible()
  await expect(addDialog.locator('#user-password-error')).toBeVisible()
  await expect(addDialog.locator('#user-confirm-error')).toBeVisible()

  await addDialog.getByLabel('Full name', { exact: true }).fill('New Learner')
  await addDialog.getByLabel('Email address', { exact: true }).fill('STUDENT@browser.test')
  await addDialog.locator('#user-password').fill('short')
  await addDialog.locator('#user-confirmPassword').fill('mismatch')
  await addDialog.getByRole('button', { name: 'Show initial password', exact: true }).click()
  await expect(addDialog.locator('#user-password')).toHaveAttribute('type', 'text')
  await addDialog.getByRole('button', { name: 'Add user', exact: true }).click()
  await expect(addDialog.locator('#user-email-error')).toContainText('already in use')
  await expect(addDialog.locator('#user-password-error')).toContainText('at least 8 characters')
  await expect(addDialog.locator('#user-confirm-error')).toHaveText('Passwords do not match.')

  const initialPassword = 'CreatedUser-2026!'
  await addDialog.getByLabel('Email address', { exact: true }).fill('new.learner@browser.test')
  await addDialog.locator('#user-password').fill(initialPassword)
  await addDialog.locator('#user-confirmPassword').fill(initialPassword)
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await addDialog.getByRole('button', { name: 'Add user', exact: true }).click()
  await expect(addDialog).toHaveCount(0)
  await expect(page.locator('.user-feedback')).toContainText('New Learner added.')
  await expect(page.locator('.user-feedback')).not.toContainText('in this preview')

  await page.reload()
  await expect(page.locator('tbody')).toContainText('new.learner@browser.test')

  // Verify created account can sign in with temporary password -> forced password change
  const createdUserContext = await browser.newContext()
  const createdUserPage = await createdUserContext.newPage()
  await signIn(createdUserPage, 'new.learner@browser.test', initialPassword)
  await expect(createdUserPage).toHaveURL(/\/change-password$/)
  await createdUserContext.close()

  // 5. Edit User: fetches GET /api/admin/users/:id, updates name + role, persists across reload
  await page.getByRole('button', { name: 'Edit New Learner', exact: true }).click()
  const editDialog = page.getByRole('dialog')
  await expect(editDialog.getByLabel('Full name', { exact: true })).toHaveValue('New Learner')
  await editDialog.getByLabel('Full name', { exact: true }).fill('Updated Learner')
  await editDialog.getByLabel('Role', { exact: true }).selectOption('Instructor')
  await expect(editDialog).toContainText('Changing from Student to Instructor')
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await editDialog.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(editDialog).toHaveCount(0)
  await expect(page.locator('.user-feedback')).toContainText('Updated Learner updated.')

  await page.reload()
  const updatedRow = page.locator('tbody tr').filter({ hasText: 'new.learner@browser.test' })
  await expect(updatedRow).toContainText('Updated Learner')
  await expect(updatedRow).toContainText('Instructor')

  // Editing self locks Administrator role selector
  await page.getByRole('button', { name: 'Edit Test Administrator', exact: true }).click()
  await expect(page.getByRole('dialog').getByLabel('Role', { exact: true })).toBeDisabled()
  await expect(page.getByRole('dialog')).toContainText('Your own Administrator role cannot be changed here.')
  await page.keyboard.press('Escape')

  // 6. Deactivate & Activate User + immediate session revocation on target user
  const instructorContext = await browser.newContext()
  const instructorPage = await instructorContext.newPage()
  await signIn(instructorPage, 'instructor@browser.test')
  await expect(instructorPage).toHaveURL(/\/instructor\/classes$/)

  const instructorRow = page.locator('tbody tr').filter({ hasText: 'instructor@browser.test' })
  await instructorRow.getByRole('button', { name: 'Deactivate Test Instructor', exact: true }).click()
  const statusDialog = page.getByRole('dialog')
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await statusDialog.getByRole('button', { name: 'Deactivate user', exact: true }).click()
  await expect(statusDialog).toHaveCount(0)
  await expect(page.locator('.user-feedback')).toContainText('Test Instructor deactivated.')
  await expect(instructorRow).toContainText('Inactive')

  // Target user's active session is revoked immediately and disabled login is rejected
  await instructorPage.goto('http://127.0.0.1:4173/instructor/classes')
  await expect(instructorPage).toHaveURL(/\/login$/)
  await signIn(instructorPage, 'instructor@browser.test')
  await expect(instructorPage.getByRole('alert')).toContainText('disabled')

  // Reactivate restores login
  await instructorRow.getByRole('button', { name: 'Activate Test Instructor', exact: true }).click()
  await statusDialog.getByRole('button', { name: 'Activate user', exact: true }).click()
  await expect(statusDialog).toHaveCount(0)
  await expect(page.locator('.user-feedback')).toContainText('Test Instructor activated.')
  await expect(instructorRow).toContainText('Active')

  await signIn(instructorPage, 'instructor@browser.test')
  await expect(instructorPage).toHaveURL(/\/instructor\/classes$/)
  await instructorContext.close()
})
