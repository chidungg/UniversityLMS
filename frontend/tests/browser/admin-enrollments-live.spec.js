import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

async function signIn(page, email = 'administrator@browser.test', password = 'Browser-test-2026') {
  await page.goto('/login')
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
}

test('live API: course enrollment, unenrollment, instructor assignment, and student access enforcement (desktop)', async ({ page, browser }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await signIn(page)
  await expect(page).toHaveURL(/\/admin\/users$/)

  await page.getByRole('navigation', { name: 'Administration', exact: true }).getByRole('link', { name: 'Enrollment & assignment', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/enrollments$/)
  await expect(page.getByLabel('Select course')).toBeVisible()
  await expect(page.locator('.user-preview-notice')).toHaveCount(0)

  // Verify inactive course disables enrollment and instructor assignment
  await page.getByLabel('Select course').selectOption({ label: 'NET301 — Computer Networks (Inactive)' })
  await expect(page.locator('.enroll-inactive-notice')).toContainText('NET301 is inactive')
  await expect(page.getByRole('button', { name: 'Enroll student', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Assign instructor', exact: true })).toBeDisabled()

  // Switch to active SE104 course
  await page.getByLabel('Select course').selectOption({ label: 'SE104 — Software Engineering' })
  await expect(page).toHaveURL(/courseId=/)
  await expect(page.getByRole('heading', { name: 'No students enrolled yet' })).toBeVisible()

  await page.evaluate(() => document.fonts.ready)
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  // 1. Enroll Student (5.1 + 6.1 + 8.1)
  await page.getByRole('button', { name: 'Enroll student', exact: true }).click()
  const enrollDialog = page.getByRole('dialog')
  await expect(enrollDialog.getByLabel('Find user')).toBeFocused()

  await enrollDialog.getByLabel('Find user').fill('nobody@browser.test')
  await expect(enrollDialog).toContainText('No user found')
  await enrollDialog.getByRole('button', { name: 'Enroll student', exact: true }).click()
  await expect(enrollDialog.locator('.user-error-summary')).toBeFocused()
  await expect(enrollDialog.locator('#enroll-student-error')).toContainText('User not found')

  await enrollDialog.getByLabel('Find user').fill('instructor@browser.test')
  await expect(enrollDialog).toContainText('Invalid enrollment')
  await enrollDialog.getByRole('button', { name: 'Enroll student', exact: true }).click()
  await expect(enrollDialog.locator('#enroll-student-error')).toContainText('Only active student accounts')

  await enrollDialog.getByLabel('Find user').fill('inactive.student@browser.test')
  await expect(enrollDialog).toContainText('Inactive account')

  await enrollDialog.getByLabel('Find user').fill('student@browser.test')
  const studentRadio = enrollDialog.getByRole('radio', { name: /Test Student/ })
  await expect(studentRadio).toBeVisible()
  await studentRadio.check()
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await enrollDialog.getByRole('button', { name: 'Enroll student', exact: true }).click()
  await expect(enrollDialog).toHaveCount(0)

  await expect(page.locator('.user-feedback')).toContainText('Test Student enrolled in SE104.')
  await expect(page.locator('.user-feedback')).not.toContainText('in this preview')
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await expect(page.locator('tbody')).toContainText('student@browser.test')

  await page.reload()
  await expect(page.locator('tbody')).toContainText('student@browser.test')

  // Reopening dialog flags already-enrolled student cleanly
  await page.getByRole('button', { name: 'Enroll student', exact: true }).click()
  await enrollDialog.getByLabel('Find user').fill('student@browser.test')
  await expect(enrollDialog).toContainText('Already enrolled')
  await expect(enrollDialog).toContainText('already enrolled in SE104')
  await enrollDialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(enrollDialog).toHaveCount(0)

  // Live effect: Student immediately sees SE104 on /student/courses
  const studentContext = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const studentPage = await studentContext.newPage()
  await signIn(studentPage, 'student@browser.test')
  await expect(studentPage).toHaveURL(/\/student\/courses$/)
  await expect(studentPage.getByRole('heading', { name: 'My Enrolled Courses' })).toBeVisible()
  await expect(studentPage.locator('main')).toContainText('SE104')

  // 2. Unenroll Student (5.2): Escape cancels, Confirm removes and revokes student course visibility
  const unenrollBtn = page.getByRole('button', { name: 'Unenroll Test Student from SE104', exact: true })
  await unenrollBtn.click()
  const actionDialog = page.getByRole('dialog')
  await expect(actionDialog.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused()
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await page.keyboard.press('Escape')
  await expect(unenrollBtn).toBeFocused()
  await expect(page.locator('tbody')).toContainText('student@browser.test')

  await unenrollBtn.click()
  await actionDialog.getByRole('button', { name: 'Unenroll student', exact: true }).click()
  await expect(actionDialog).toHaveCount(0)
  await expect(page.locator('.user-feedback')).toContainText('Test Student unenrolled from SE104.')
  await expect(page.getByRole('heading', { name: 'No students enrolled yet' })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: 'No students enrolled yet' })).toBeVisible()

  // Student no longer sees SE104 after unenrollment
  await studentPage.reload()
  await expect(studentPage.getByRole('heading', { name: 'My Enrolled Courses' })).toBeVisible()
  await expect(studentPage.locator('main')).not.toContainText('SE104')
  await studentContext.close()

  // 3. Assign & Unassign Instructor (5.3 + 8.3)
  await page.getByRole('button', { name: 'Assign instructor', exact: true }).click()
  const assignDialog = page.getByRole('dialog')
  await expect(assignDialog.getByLabel('Find instructor')).toBeFocused()

  await assignDialog.getByLabel('Find instructor').fill('student@browser.test')
  await expect(assignDialog).toContainText('Invalid assignment')
  await assignDialog.getByRole('button', { name: 'Assign instructor', exact: true }).click()
  await expect(assignDialog.locator('.user-error-summary')).toBeFocused()

  await assignDialog.getByLabel('Find instructor').fill('instructor@browser.test')
  const instructorRadio = assignDialog.getByRole('radio', { name: /Test Instructor/ })
  await expect(instructorRadio).toBeVisible()
  await instructorRadio.check()
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await assignDialog.getByRole('button', { name: 'Assign instructor', exact: true }).click()
  await expect(assignDialog).toHaveCount(0)
  await expect(page.locator('.user-feedback')).toContainText('Test Instructor assigned to SE104.')
  await expect(page.locator('.enroll-instructor-panel')).toContainText('Test Instructor')

  await page.reload()
  await expect(page.locator('.enroll-instructor-panel')).toContainText('Test Instructor')

  // Unassign Instructor with confirmation
  const unassignBtn = page.getByRole('button', { name: 'Unassign Test Instructor from SE104', exact: true })
  await unassignBtn.click()
  await actionDialog.getByRole('button', { name: 'Unassign instructor', exact: true }).click()
  await expect(actionDialog).toHaveCount(0)
  await expect(page.locator('.user-feedback')).toContainText('Test Instructor unassigned from SE104.')
  await expect(page.locator('.enroll-instructor-panel')).toContainText('No instructor assigned')

  await page.reload()
  await expect(page.locator('.enroll-instructor-panel')).toContainText('No instructor assigned')
})
