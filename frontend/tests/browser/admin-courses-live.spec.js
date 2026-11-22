import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

async function signIn(page, email = 'administrator@browser.test', password = 'Browser-test-2026') {
  await page.goto('/login')
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
}

const rowFor = (page, code) => page.locator('tbody tr').filter({
  has: page.getByRole('button', { name: `View ${code}`, exact: true }),
})

test('live API: course catalog, details, add, update, and activate/deactivate (desktop)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await signIn(page)
  await expect(page).toHaveURL(/\/admin\/users$/)

  await page.getByRole('navigation', { name: 'Administration', exact: true }).getByRole('link', { name: 'Courses', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/courses$/)
  await expect(page.getByRole('table')).toBeVisible()
  await expect(page.locator('.user-preview-notice')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Delete / })).toHaveCount(0)
  await expect(rowFor(page, 'SE104')).toContainText('Software Engineering')
  await expect(rowFor(page, 'NET301')).toContainText('Inactive')

  await page.evaluate(() => document.fonts.ready)
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  // Search, filter, sort & Course Details dialog (live counts, no Sample data)
  await page.getByLabel('Search courses').fill('Networks')
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await expect(rowFor(page, 'NET301')).toBeVisible()

  await page.getByLabel('Status', { exact: true }).selectOption('Active')
  await expect(page.getByRole('heading', { name: 'No courses found' })).toBeVisible()
  await page.getByRole('button', { name: 'Clear all filters' }).click()
  await expect(page.getByLabel('Search courses')).toBeFocused()

  await page.getByRole('button', { name: 'Sort by course code' }).click()
  await expect(page.getByRole('columnheader', { name: 'Sort by course code' })).toHaveAttribute('aria-sort', 'descending')

  const viewTrigger = page.getByRole('button', { name: 'View SE104', exact: true })
  await viewTrigger.click()
  const detailsDialog = page.getByRole('dialog')
  await expect(detailsDialog).toContainText('Software Engineering')
  await expect(detailsDialog).not.toContainText('SAMPLE DATA')
  await expect(detailsDialog.locator('.course-counts')).toContainText('Enrollments')
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await page.keyboard.press('Escape')
  await expect(viewTrigger).toBeFocused()

  // Add Course (3.1, 5.1, 7.1): missing fields, invalid format, duplicate code, valid creation
  await page.getByRole('button', { name: 'Add course', exact: true }).click()
  const addDialog = page.getByRole('dialog')
  await expect(addDialog.getByLabel('Course code', { exact: false })).toBeFocused()
  await addDialog.getByRole('button', { name: 'Add course', exact: true }).click()
  await expect(addDialog.locator('.user-error-summary')).toBeFocused()
  await expect(addDialog.locator('#course-code-error')).toHaveText('Enter a course code.')
  await expect(addDialog.locator('#course-name-error')).toHaveText('Enter a course name.')

  await addDialog.getByLabel('Course code', { exact: false }).fill('bad code!')
  await addDialog.getByLabel('Course name', { exact: false }).fill('Web Development')
  await addDialog.getByRole('button', { name: 'Add course', exact: true }).click()
  await expect(addDialog.locator('#course-code-error')).toContainText('letters, numbers')

  await addDialog.getByLabel('Course code', { exact: false }).fill(' se104 ')
  await addDialog.getByRole('button', { name: 'Add course', exact: true }).click()
  await expect(addDialog.locator('#course-code-error')).toContainText('already in use')

  await addDialog.getByLabel('Course code', { exact: false }).fill('web101')
  await addDialog.getByLabel('Short description', { exact: false }).fill('Build accessible web applications.')
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await addDialog.getByRole('button', { name: 'Add course', exact: true }).click()
  await expect(addDialog).toHaveCount(0)
  await expect(page.locator('.user-feedback')).toContainText('WEB101 added.')
  await expect(page.locator('.user-feedback')).not.toContainText('in this preview')

  await page.reload()
  await expect(rowFor(page, 'WEB101')).toContainText('Web Development')
  await expect(rowFor(page, 'WEB101')).toContainText('Active')

  // Update Course (3.2): fetch GET /api/admin/courses/:id -> edit -> save -> reload
  await page.getByRole('button', { name: 'Edit WEB101', exact: true }).click()
  const editDialog = page.getByRole('dialog')
  await expect(editDialog.getByLabel('Course code', { exact: false })).toHaveValue('WEB101')
  await expect(editDialog.getByLabel('Course name', { exact: false })).toHaveValue('Web Development')
  await editDialog.getByLabel('Course code', { exact: false }).fill('WEB201')
  await editDialog.getByLabel('Course name', { exact: false }).fill('Web Application Architecture')
  await editDialog.getByLabel('Short description', { exact: false }).fill('Full-stack MERN course architecture.')
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await editDialog.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(editDialog).toHaveCount(0)
  await expect(page.locator('.user-feedback')).toContainText('WEB201 updated.')

  await page.reload()
  await expect(rowFor(page, 'WEB201')).toContainText('Web Application Architecture')

  // Activate / Deactivate Course (3.3): cancel confirmation preserves status, confirm updates & persists
  const deactivateBtn = page.getByRole('button', { name: 'Deactivate WEB201', exact: true })
  await deactivateBtn.click()
  const actionDialog = page.getByRole('dialog')
  await expect(actionDialog.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused()
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await page.keyboard.press('Escape')
  await expect(deactivateBtn).toBeFocused()
  await expect(rowFor(page, 'WEB201')).toContainText('Active')

  await deactivateBtn.click()
  await actionDialog.getByRole('button', { name: 'Deactivate course', exact: true }).click()
  await expect(actionDialog).toHaveCount(0)
  await expect(page.locator('.user-feedback')).toContainText('WEB201 deactivated.')
  await expect(rowFor(page, 'WEB201')).toContainText('Inactive')

  await page.reload()
  await expect(rowFor(page, 'WEB201')).toContainText('Inactive')

  await page.getByRole('button', { name: 'Activate WEB201', exact: true }).click()
  await actionDialog.getByRole('button', { name: 'Activate course', exact: true }).click()
  await expect(actionDialog).toHaveCount(0)
  await expect(page.locator('.user-feedback')).toContainText('WEB201 activated.')
  await expect(rowFor(page, 'WEB201')).toContainText('Active')

  await page.reload()
  await expect(rowFor(page, 'WEB201')).toContainText('Active')
})
