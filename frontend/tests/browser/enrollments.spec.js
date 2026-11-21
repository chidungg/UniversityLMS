import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const classKey = 'university-lms.class-preview.v1'
const userKey = 'university-lms.user-preview.v1'
const enrollmentKey = 'university-lms.enrollment-preview.v1'

async function openEnrollments(page, query = '') {
  await page.goto(`/admin/enrollments${query}`)
  await expect(page.getByLabel('Select class')).toBeVisible()
}

for (const width of [1024, 1440, 1920]) {
  test(`enrollment workspace desktop layout ${width}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 })
    await openEnrollments(page)
    await expect(page.getByRole('table')).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
    await page.screenshot({ path: testInfo.outputPath(`enrollments-${width}.png`), fullPage: true })
  })
}

test('class selection, roster search, status filter, sorting and deep linking', async ({ page }) => {
  await openEnrollments(page)
  await expect(page.getByLabel('Select class')).toHaveValue('SE104-01')
  await expect(page.locator('.enroll-instructor-panel')).toContainText('Dr. Lan Nguyen')
  await expect(page.locator('tbody tr')).toHaveCount(4)

  await page.getByLabel('Search enrolled students').fill('linh@example')
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await expect(page.locator('tbody')).toContainText('Linh Tran')

  await page.getByLabel('Account status', { exact: true }).selectOption('Inactive')
  await expect(page.getByRole('heading', { name: 'No matching students' })).toBeVisible()
  await page.getByRole('button', { name: 'Clear all filters' }).click()
  await expect(page.getByLabel('Search enrolled students')).toBeFocused()
  await expect(page.locator('tbody tr')).toHaveCount(4)

  await page.getByRole('button', { name: 'Sort by student' }).click()
  await expect(page.getByRole('columnheader', { name: 'Sort by student' })).toHaveAttribute('aria-sort', 'descending')
  await expect(page.locator('tbody tr').first()).toContainText('Minh Nguyen')

  await page.getByLabel('Select class').selectOption('SE104-02')
  await expect(page).toHaveURL(/classId=SE104-02/)
  await expect(page.locator('.enroll-instructor-panel')).toContainText('No instructor assigned')
  await expect(page.getByRole('heading', { name: 'No students enrolled yet' })).toBeVisible()

  await page.reload()
  await expect(page.getByLabel('Select class')).toHaveValue('SE104-02')
})

test('enroll student: duplicate, not found, invalid role/status, enroll, persist and sync', async ({ page }, testInfo) => {
  await openEnrollments(page)
  await page.getByRole('button', { name: 'Enroll student', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Find user')).toBeFocused()

  // Already enrolled student feedback
  await dialog.getByLabel('Find user').fill('Minh Nguyen')
  await expect(dialog).toContainText('Already enrolled')
  await expect(dialog).toContainText('already enrolled in SE104-01')
  await dialog.getByRole('button', { name: 'Enroll student', exact: true }).click()
  await expect(dialog.locator('.user-error-summary')).toBeFocused()
  await expect(dialog.locator('#enroll-student-error')).toContainText('already enrolled in SE104-01')

  // User not found feedback
  await dialog.getByLabel('Find user').fill('missing.user@example.edu')
  await expect(dialog).toContainText('No user found')
  await dialog.getByRole('button', { name: 'Enroll student', exact: true }).click()
  await expect(dialog.locator('#enroll-student-error')).toContainText('User not found')

  // Invalid role (Instructor) feedback
  await dialog.getByLabel('Find user').fill('Dr. Lan Nguyen')
  await expect(dialog).toContainText('Invalid enrollment')
  await dialog.getByRole('button', { name: 'Enroll student', exact: true }).click()
  await expect(dialog.locator('#enroll-student-error')).toContainText('Only active student accounts')

  // Inactive student feedback
  await dialog.getByLabel('Find user').fill('Ha Do')
  await expect(dialog).toContainText('Inactive account')

  // Eligible active student enrollment
  await dialog.getByLabel('Find user').fill('Khoa Vo')
  await dialog.getByRole('radio', { name: /Khoa Vo/ }).check()
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await page.screenshot({ path: testInfo.outputPath('enroll-student-dialog.png'), fullPage: true })
  await dialog.getByRole('button', { name: 'Enroll student', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Enrolling…' })).toBeDisabled()
  await expect(dialog).toHaveCount(0)

  await expect(page.locator('.user-feedback')).toContainText('Khoa Vo enrolled in SE104-01')
  await expect(page.locator('tbody tr')).toHaveCount(5)
  await expect(page.locator('tbody')).toContainText('Khoa Vo')

  await page.reload()
  await expect(page.locator('tbody tr')).toHaveCount(5)

  // Synchronizes with Overview & Classes
  await page.goto('/admin')
  await expect(page.locator('.admin-enrollment-summary')).toContainText('8')
  await page.goto('/admin/classes')
  await page.getByRole('button', { name: 'View SE104-01', exact: true }).click()
  await expect(page.getByRole('dialog').locator('dl')).toContainText('5')
})

test('unenroll student confirmation, cancel and removal', async ({ page }, testInfo) => {
  await openEnrollments(page)
  const trigger = page.getByRole('button', { name: 'Unenroll Minh Nguyen from SE104-01', exact: true })
  await trigger.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused()
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await page.screenshot({ path: testInfo.outputPath('unenroll-student-dialog.png'), fullPage: true })
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
  await expect(page.locator('tbody')).toContainText('Minh Nguyen')

  await trigger.click()
  await dialog.getByRole('button', { name: 'Unenroll student', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.locator('.user-feedback')).toContainText('Minh Nguyen unenrolled from SE104-01')
  await expect(page.locator('tbody')).not.toContainText('Minh Nguyen')
  await expect(page.locator('tbody tr')).toHaveCount(3)
  await expect(page.getByRole('button', { name: 'Enroll student', exact: true })).toBeFocused()

  await page.reload()
  await expect(page.locator('tbody tr')).toHaveCount(3)
})

test('instructor assignment: invalid assignment, not found, assign, change, unassign and sync', async ({ page }, testInfo) => {
  await openEnrollments(page, '?classId=SE104-02')
  await expect(page.locator('.enroll-instructor-panel')).toContainText('No instructor assigned')

  await page.getByRole('button', { name: 'Assign instructor', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Find instructor')).toBeFocused()

  // Invalid assignment (Student account)
  await dialog.getByLabel('Find instructor').fill('Minh Nguyen')
  await expect(dialog).toContainText('Invalid assignment')
  await dialog.getByRole('button', { name: 'Assign instructor', exact: true }).click()
  await expect(dialog.locator('.user-error-summary')).toBeFocused()
  await expect(dialog.locator('#assign-instructor-error')).toContainText('Invalid assignment')

  // User not found
  await dialog.getByLabel('Find instructor').fill('nobody@example.edu')
  await expect(dialog).toContainText('No user found')
  await dialog.getByRole('button', { name: 'Assign instructor', exact: true }).click()
  await expect(dialog.locator('#assign-instructor-error')).toContainText('User not found')

  // Valid instructor assignment
  await dialog.getByLabel('Find instructor').fill('Lan Nguyen')
  await dialog.getByRole('radio', { name: /Dr\. Lan Nguyen/ }).check()
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await page.screenshot({ path: testInfo.outputPath('assign-instructor-dialog.png'), fullPage: true })
  await dialog.getByRole('button', { name: 'Assign instructor', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.locator('.user-feedback')).toContainText('Dr. Lan Nguyen assigned to SE104-02')
  await expect(page.locator('.enroll-instructor-panel')).toContainText('Dr. Lan Nguyen')

  // Sync check on Classes and Overview
  await page.goto('/admin/classes')
  await expect(page.locator('tbody tr').filter({ hasText: 'SE104-02' })).toContainText('Dr. Lan Nguyen')
  await page.goto('/admin')
  await expect(page.locator('.admin-panel').filter({ hasText: 'Needs attention' }).locator('.admin-count')).toHaveText('0')

  // Change instructor
  await openEnrollments(page, '?classId=SE104-02')
  await page.getByRole('button', { name: 'Change instructor', exact: true }).click()
  await expect(dialog).toContainText('Currently assigned')
  await dialog.getByRole('radio', { name: /Dr\. Huy Tran/ }).check()
  await dialog.getByRole('button', { name: 'Save assignment', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.locator('.enroll-instructor-panel')).toContainText('Dr. Huy Tran')

  // Unassign instructor with confirmation
  const unassignTrigger = page.getByRole('button', { name: 'Unassign Dr. Huy Tran from SE104-02', exact: true })
  await unassignTrigger.click()
  await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(unassignTrigger).toBeFocused()
  await unassignTrigger.click()
  await dialog.getByRole('button', { name: 'Unassign instructor', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.locator('.enroll-instructor-panel')).toContainText('No instructor assigned')
})

test('inactive class disables new assignments and enrollments with clear notice', async ({ page }) => {
  await openEnrollments(page, '?classId=NET301-01')
  await expect(page.locator('.enroll-inactive-notice')).toContainText('NET301-01 is inactive')
  await expect(page.getByRole('button', { name: 'Enroll student', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Change instructor', exact: true })).toBeDisabled()
  await expect(page.locator('.enroll-instructor-panel')).toContainText('Dr. Huy Tran')
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
})

test('empty class list shows recovery link to Classes', async ({ page }) => {
  await page.goto('/login')
  await page.evaluate((key) => sessionStorage.setItem(key, '[]'), classKey)
  await page.goto('/admin/enrollments')
  await expect(page.getByRole('heading', { name: 'No classes available' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Manage classes' })).toBeVisible()
})

test('offline recovery, stale records and storage errors never report false success', async ({ page, context }) => {
  await openEnrollments(page)
  await context.setOffline(true)
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Unable to load enrollments' })).toBeVisible()
  await context.setOffline(false)
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('table')).toBeVisible()

  // Stale duplicate enrollment caught on save
  await page.getByRole('button', { name: 'Enroll student', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('radio', { name: /Khoa Vo/ }).check()
  await page.evaluate((key) => {
    const items = JSON.parse(sessionStorage.getItem(key) || '[]')
    items.push({ studentId: 'S05', classId: 'SE104-01' })
    sessionStorage.setItem(key, JSON.stringify(items))
  }, enrollmentKey)
  await dialog.getByRole('button', { name: 'Enroll student', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('already enrolled')

  // Storage write error caught cleanly
  await page.evaluate((key) => { sessionStorage.removeItem(key) }, enrollmentKey)
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('Unavailable') } })
  await dialog.getByRole('button', { name: 'Enroll student', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('Unable to save')
})

test('105 enrolled students with long names paginate and wrap cleanly at 1024px', async ({ page }) => {
  await page.goto('/login')
  await page.evaluate(({ userKey, enrollmentKey }) => {
    const users = [
      { id: 'I01', name: 'Dr. Lan Nguyen', email: 'lan@example.edu', role: 'Instructor', status: 'Active' },
      ...Array.from({ length: 105 }, (_, index) => ({
        id: `STU-${index}`,
        name: `Nguyen Thi Thanh Huong ${'Long Student Name '.repeat(3)}${index}`,
        email: `${'student'.repeat(8)}-${index}@university.example.edu`,
        role: 'Student',
        status: index % 9 === 0 ? 'Inactive' : 'Active',
      })),
    ]
    const enrollments = Array.from({ length: 105 }, (_, index) => ({
      studentId: `STU-${index}`,
      classId: 'SE104-01',
    }))
    sessionStorage.setItem(userKey, JSON.stringify(users))
    sessionStorage.setItem(enrollmentKey, JSON.stringify(enrollments))
  }, { userKey, enrollmentKey })

  await page.setViewportSize({ width: 1024, height: 900 })
  await openEnrollments(page)
  await expect(page.locator('tbody tr')).toHaveCount(10)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(await page.locator('.admin-table-scroll').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
  await page.getByLabel('Rows per page').selectOption('50')
  await expect(page.locator('tbody tr')).toHaveCount(50)
  await page.getByRole('button', { name: 'Next page' }).click()
  await page.getByRole('button', { name: 'Next page' }).click()
  await expect(page.locator('tbody tr')).toHaveCount(5)
  await expect(page.getByText('Page 3 of 3', { exact: true })).toBeVisible()
  await page.getByLabel('Search enrolled students').fill('studentstudentstudentstudentstudentstudentstudentstudent-104')
  await expect(page.getByText('Page 1 of 1', { exact: true })).toBeVisible()
})
