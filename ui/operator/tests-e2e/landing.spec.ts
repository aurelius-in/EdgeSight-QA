import { test, expect } from '@playwright/test'

test('Landing hero renders and CTAs work', async ({ page }) => {
  await page.goto('/')
  // Splash waits max 5s; tolerate up to 6s
  await page.waitForTimeout(6000)
  await expect(page.locator('text=EDGESIGHT QA')).toBeVisible()
  await expect(page.getByRole('button', { name: /Enter Live/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /Enter Offline/i })).toBeVisible()
})


