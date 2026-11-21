import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

for (const width of [1024, 1440, 1920]) {
  test(`admin dashboard layout and accessibility at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('/admin')
    await page.evaluate(() => document.fonts.ready)
    await expect(page.getByRole('heading', { name: 'Your workspace, at a glance.' })).toBeVisible()
    await expect(page.getByText('Sample data', { exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
    await page.screenshot({ path: testInfo.outputPath(`admin-${width}.png`), fullPage: true })
  })
}

test('class search, empty state, details and focus restoration', async ({ page }) => {
  await page.goto('/admin')
  await page.getByRole('textbox', { name: 'Search classes' }).fill('DBI202')
  await expect(page.getByRole('button', { name: 'DBI202-01', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'SE104-01', exact: true })).toHaveCount(0)
  await page.getByRole('textbox', { name: 'Search classes' }).fill('no-match')
  await expect(page.getByText('No classes found')).toBeVisible()
  await page.getByRole('button', { name: 'Clear class search' }).click()
  const trigger = page.getByRole('button', { name: 'Review', exact: true })
  await trigger.click()
  await expect(page.getByRole('dialog')).toContainText('Not assigned')
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
})

test('refresh, offline retry and real navigation to read-only previews', async ({ page, context }) => {
  await page.goto('/admin')
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Refreshing…' })).toBeDisabled()
  await expect(page.getByRole('status')).toContainText('Sample overview refreshed')
  await context.setOffline(true)
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('You are offline')
  await context.setOffline(false)
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('status')).toContainText('Sample overview refreshed')
  await page.getByRole('navigation', { name: 'Administration', exact: true }).getByRole('link', { name: 'Courses', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/courses$/)
  await expect(page.getByRole('heading', { name: 'Courses', exact: true })).toBeVisible()
  await expect(page.getByRole('table')).toContainText('Software Engineering')
  await page.getByRole('link', { name: 'Exit preview' }).click()
  await expect(page).toHaveURL(/\/login$/)
})
