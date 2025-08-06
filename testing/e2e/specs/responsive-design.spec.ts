import { test, expect } from '@playwright/test'
import { TestHelpers } from '../utils/test-helpers'

test.describe('Responsive Design', () => {
  let helpers: TestHelpers

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page)
    await page.goto('/')
    await helpers.waitForPageLoad()
  })

  test('adapts layout for desktop screens', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 })
    await helpers.waitForSessionCards()
    
    // Sidebar should be visible
    const sidebar = page.locator('[data-testid="project-sidebar"]')
    await expect(sidebar).toBeVisible()
    
    // Grid should show multiple columns
    const sessionGrid = page.locator('.grid-cols-1.xl\\:grid-cols-2')
    await expect(sessionGrid).toBeVisible()
    
    // Header stats should all be visible
    const statsContainer = page.locator('[data-testid="stats-container"]')
    await expect(statsContainer).toBeVisible()
    
    // Controls should be in a single row
    const controls = page.locator('.flex.items-center.justify-between')
    await expect(controls).toBeVisible()
  })

  test('adapts layout for tablet screens', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await helpers.waitForSessionCards()
    
    // Layout should still work but may be more compact
    const sessionCards = helpers.getSessionCards()
    await expect(sessionCards.first()).toBeVisible()
    
    // Header should remain functional
    const header = page.locator('header')
    await expect(header).toBeVisible()
    
    // Stats should be visible but may reflow
    const stats = page.locator('[data-testid="stats-container"]')
    await expect(stats).toBeVisible()
  })

  test('adapts layout for mobile screens', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await helpers.waitForSessionCards()
    
    // Session cards should still be visible and functional
    const sessionCards = helpers.getSessionCards()
    await expect(sessionCards.first()).toBeVisible()
    
    // Header should be responsive
    const header = page.locator('header')
    await expect(header).toBeVisible()
    
    // Title should be visible
    await expect(page.locator('h1')).toContainText('claude-tmux-manager')
    
    // Stats should be stacked or hidden gracefully
    const statsContainer = page.locator('[data-testid="stats-container"]')
    await expect(statsContainer).toBeVisible()
  })

  test('maintains functionality across screen sizes', async ({ page }) => {
    await helpers.testResponsiveDesign()
    
    // Test that core functionality works at mobile size
    await page.setViewportSize({ width: 375, height: 667 })
    
    // Search should work
    const searchInput = page.locator('[data-testid="search-input"]')
    await expect(searchInput).toBeVisible()
    await helpers.searchSessions('jwt')
    
    // New session button should work
    const newSessionButton = page.locator('[data-testid="new-session-button"]')
    await expect(newSessionButton).toBeVisible()
    await newSessionButton.click()
    
    const dialog = page.locator('[data-testid="new-session-dialog"]')
    await expect(dialog).toBeVisible()
    
    // Close dialog
    await helpers.closeDialog()
  })

  test('handles view mode changes on different screen sizes', async ({ page }) => {
    const screenSizes = [
      { width: 1200, height: 800 },
      { width: 768, height: 1024 },
      { width: 375, height: 667 }
    ]
    
    for (const size of screenSizes) {
      await page.setViewportSize(size)
      await helpers.waitForSessionCards()
      
      // Grid view
      await helpers.changeViewMode('grid')
      await expect(helpers.getSessionCards().first()).toBeVisible()
      
      // List view
      await helpers.changeViewMode('list')
      await expect(helpers.getSessionCards().first()).toBeVisible()
    }
  })

  test('maintains terminal theme consistency across devices', async ({ page }) => {
    const screenSizes = [
      { width: 1200, height: 800 },
      { width: 768, height: 1024 },
      { width: 375, height: 667 }
    ]
    
    for (const size of screenSizes) {
      await page.setViewportSize(size)
      await page.waitForTimeout(300) // Wait for responsive changes
      
      // Verify terminal theme elements
      await helpers.verifyTerminalTheme()
      
      // Check for terminal-specific styling
      await expect(page.locator('h1')).toHaveClass(/font-mono/)
      await expect(page.locator('[data-testid="search-input"]')).toHaveClass(/font-mono/)
      
      // Check for dark theme
      const body = page.locator('body')
      await expect(body).toHaveClass(/bg-background/)
    }
  })

  test('handles session card interactions on touch devices', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await helpers.waitForSessionCards()
    
    const firstCard = helpers.getSessionCards().first()
    
    // Touch interaction should work
    await firstCard.tap()
    
    // Hover effects might not apply on mobile, but card should remain interactive
    await expect(firstCard).toBeVisible()
    
    // Terminal preview should be visible
    const terminalPreview = firstCard.locator('.font-mono')
    await expect(terminalPreview).toBeVisible()
  })

  test('optimizes content for different orientations', async ({ page }) => {
    // Portrait mobile
    await page.setViewportSize({ width: 375, height: 667 })
    await helpers.waitForSessionCards()
    let sessionCards = await helpers.getSessionCards().count()
    expect(sessionCards).toBeGreaterThan(0)
    
    // Landscape mobile
    await page.setViewportSize({ width: 667, height: 375 })
    await page.waitForTimeout(300)
    
    // Should still show sessions
    await expect(helpers.getSessionCards().first()).toBeVisible()
    
    // Header should adapt to landscape
    const header = page.locator('header')
    await expect(header).toBeVisible()
  })

  test('handles text scaling and accessibility', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 })
    await helpers.waitForSessionCards()
    
    // Test with different text sizes (simulate browser zoom)
    const originalFontSize = await page.evaluate(() => {
      return window.getComputedStyle(document.documentElement).fontSize
    })
    
    // Increase font size
    await page.addStyleTag({
      content: 'html { font-size: 18px !important; }'
    })
    
    // Layout should still work
    await expect(helpers.getSessionCards().first()).toBeVisible()
    await expect(page.locator('h1')).toBeVisible()
    
    // Reset font size
    await page.addStyleTag({
      content: `html { font-size: ${originalFontSize} !important; }`
    })
  })

  test('maintains scroll behavior on small screens', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 500 }) // Very small height
    await helpers.waitForSessionCards()
    
    // Should be able to scroll to see all content
    const footer = page.locator('footer')
    await footer.scrollIntoViewIfNeeded()
    await expect(footer).toBeVisible()
    
    // Scroll back to top
    const header = page.locator('header')
    await header.scrollIntoViewIfNeeded()
    await expect(header).toBeVisible()
  })
})