import { test, expect } from '@playwright/test'

test.describe('Minimal Integration - Terminal Validation', () => {
  
  test('app builds and serves without crashing', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Claude TMux Manager/)
    
    // Verify basic DOM structure exists
    await expect(page.locator('h1')).toBeVisible()
    await expect(page.locator('body')).toHaveClass(/bg-background/)
    
    // Verify new layout components exist
    await expect(page.locator('[data-testid="window-list-sidebar"]')).toBeVisible()
  })
  
  test('sidebar and main content are present', async ({ page }) => {
    await page.goto('/')
    
    // Verify sidebar exists
    await expect(page.locator('[data-testid="window-list-sidebar"]')).toBeVisible()
    
    // Verify expanded window view exists (even if no window selected)
    await expect(page.locator('[data-testid="expanded-window-view"]')).toBeVisible()
  })
})