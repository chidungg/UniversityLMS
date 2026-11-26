import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

async function login(page, role, password = 'Browser-test-2026') {
  await page.goto('/login')
  await page.locator('#email').fill(`${role}@browser.test`)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
}

test('real API: cookie session, RBAC, recovery, Admin reset, mandatory password change and logout', async ({ page, browser }) => {
  // 1. Route protection when unauthenticated
  await page.goto('/admin/password-resets')
  await expect(page).toHaveURL(/\/login$/)

  // 2. Invalid credentials error keeps user on /login
  await page.locator('#email').fill('student@browser.test')
  await page.locator('#password').fill('wrong-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Incorrect email or password')
  await expect(page).toHaveURL(/\/login$/)

  // 3. Mobile responsiveness & accessibility check on LoginPage v2
  await page.setViewportSize({ width: 375, height: 812 })
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/a01-login-mobile.png', fullPage: true })

  // 4. Student sign-in, HttpOnly cookie persistence & RBAC enforcement
  await login(page, 'student')
  await expect(page).toHaveURL(/\/student\/courses$/)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Log out', exact: true })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('lms_token'))).toBeNull()
  expect((await page.context().cookies()).find((cookie) => cookie.name === 'lms_session')?.httpOnly).toBe(true)
  await page.goto('/admin/password-resets')
  await expect(page).toHaveURL(/\/403$/)
  await page.goto('/instructor/classes')
  await expect(page).toHaveURL(/\/403$/)

  // 5. Guest submits password recovery request via /forgot-password dialog
  const guest = await browser.newContext()
  const recovery = await guest.newPage()
  await recovery.goto('http://127.0.0.1:4173/forgot-password')
  const recoveryDialog = recovery.getByRole('dialog')
  await expect(recoveryDialog).toBeVisible()
  await recoveryDialog.getByLabel('Account email', { exact: false }).fill('student@browser.test')
  await recoveryDialog.getByLabel('Note', { exact: false }).fill('Please verify my identity in person.')
  await recoveryDialog.getByRole('button', { name: 'Send request', exact: true }).click()
  await expect(recoveryDialog.getByRole('status')).toContainText('Recovery request received')

  // 6. Administrator signs in, processes recovery request in upgraded PasswordResetManagement
  const adminContext = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const admin = await adminContext.newPage()
  await admin.goto('http://127.0.0.1:4173/login')
  await admin.locator('#email').fill('administrator@browser.test')
  await admin.locator('#password').fill('Browser-test-2026')
  await admin.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(admin).toHaveURL(/\/admin\/users$/)

  await admin.goto('http://127.0.0.1:4173/admin/password-resets')
  await expect(admin.getByRole('table')).toBeVisible()
  expect((await new AxeBuilder({ page: admin }).analyze()).violations).toEqual([])
  await admin.locator('tbody tr').filter({ hasText: 'student@browser.test' }).getByRole('button', { name: /^Reset password for / }).click()

  const resetDialog = admin.getByRole('dialog')
  await resetDialog.locator('#reset-verified').check()
  await resetDialog.locator('#reset-password').fill('Temporary-browser-2026')
  await resetDialog.locator('#reset-confirmPassword').fill('Temporary-browser-2026')
  await resetDialog.locator('#reset-resolutionNote').fill('Verified in person')
  await resetDialog.getByRole('button', { name: 'Confirm password reset', exact: true }).click()
  await expect(admin.locator('.user-feedback')).toContainText('Password reset completed')
  await admin.screenshot({ path: 'test-results/a01-admin-recovery.png', fullPage: true })

  // Admin logout revokes session & blocks back navigation
  await admin.getByRole('button', { name: 'Log out', exact: true }).click()
  await expect(admin).toHaveURL(/\/login$/)
  await admin.goBack()
  await expect(admin).toHaveURL(/\/login$/)

  // 7. Student's previous session was revoked by Admin reset
  await page.goto('/student/courses')
  await expect(page).toHaveURL(/\/login$/)

  // 8. Student signs in with temporary password -> forced password change
  await login(page, 'student', 'Temporary-browser-2026')
  await expect(page).toHaveURL(/\/change-password$/)
  await page.goto('/student/courses')
  await expect(page).toHaveURL(/\/change-password$/)

  await page.getByLabel('Current password', { exact: true }).fill('Temporary-browser-2026')
  await page.getByLabel('New password', { exact: true }).fill('Private-browser-2026')
  await page.getByLabel('Confirm new password', { exact: true }).fill('Private-browser-2026')
  await page.getByRole('button', { name: 'Save new password' }).click()
  await expect(page).toHaveURL(/\/login$/)

  // 9. Student signs in with new private password, navigates, and logs out
  await login(page, 'student', 'Private-browser-2026')
  await expect(page).toHaveURL(/\/student\/courses$/)
  await page.goto('/student/assignments')
  await expect(page).toHaveURL(/\/student\/assignments$/)
  await page.getByRole('button', { name: 'Log out', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  await page.goBack()
  await expect(page).toHaveURL(/\/login$/)

  // 10. Instructor signs in, RBAC check, and logout revokes session
  await login(page, 'instructor')
  await expect(page).toHaveURL(/\/instructor\/classes$/)
  await expect(page.getByRole('heading', { name: 'Assigned Courses' })).toBeVisible()
  await page.goto('/admin/password-resets')
  await expect(page).toHaveURL(/\/403$/)
  await page.goto('/instructor/classes')
  await page.getByRole('button', { name: 'Log out', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  await page.goBack()
  await expect(page).toHaveURL(/\/login$/)

  await guest.close()
  await adminContext.close()
})
