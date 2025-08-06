import { test, expect } from '@playwright/test'

test.describe('Minimal Integration - Terminal Validation', () => {
  
  test('app builds and serves without crashing', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Claude TMux Manager/)
    
    // Verify basic DOM structure exists
    await expect(page.locator('h1')).toBeVisible()
    await expect(page.locator('body')).toHaveClass(/bg-background/)
  })
})