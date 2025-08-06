import { test, expect } from '@playwright/test'
import { TestHelpers } from '../utils/test-helpers'

test.describe('Claude TMux Manager - Demo Tests', () => {
  let helpers: TestHelpers

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page)
    await page.goto('/')
    await helpers.waitForPageLoad()
  })

  test('loads application with terminal theme', async ({ page }) => {
    // Check page loads with correct title
    await expect(page).toHaveTitle(/Claude TMux Manager/)
    
    // Verify terminal theme
    await helpers.verifyTerminalTheme()
    
    // Check header elements
    await expect(page.locator('h1')).toContainText('claude-tmux-manager')
    await expect(page.locator('h1')).toContainText('$')
    
    // Check for animated terminal cursor
    await expect(page.locator('.animate-blink')).toBeVisible()
  })

  test('displays session cards with data', async ({ page }) => {
    await helpers.waitForSessionCards()
    
    // Check that we have session cards
    const sessionCards = helpers.getSessionCards()
    const count = await sessionCards.count()
    expect(count).toBeGreaterThan(0)
    
    // Verify first session card has content
    const firstCard = sessionCards.first()
    await expect(firstCard).toBeVisible()
    
    // Check for project and feature name
    await expect(firstCard).toContainText('user-auth-jwt')
    await expect(firstCard).toContainText('jwt-refresh-tokens')
  })

  test('shows statistics in header', async ({ page }) => {
    await helpers.waitForSessionCards()
    
    // Verify stats container is visible
    const statsContainer = page.locator('[data-testid="stats-container"]')
    await expect(statsContainer).toBeVisible()
    
    // Check individual stats
    const sessionsStat = page.locator('[data-testid="stat-sessions"]')
    const projectsStat = page.locator('[data-testid="stat-projects"]')
    const readyStat = page.locator('[data-testid="stat-ready"]')
    
    await expect(sessionsStat).toBeVisible()
    await expect(projectsStat).toBeVisible()
    await expect(readyStat).toBeVisible()
    
    // Stats should show numbers
    const sessionsText = await sessionsStat.textContent()
    const projectsText = await projectsStat.textContent()
    
    expect(parseInt(sessionsText || '0')).toBeGreaterThan(0)
    expect(parseInt(projectsText || '0')).toBeGreaterThan(0)
  })

  test('search bar works with terminal styling', async ({ page }) => {
    const searchInput = page.locator('[data-testid="search-input"]')
    
    // Search bar should be visible and styled
    await expect(searchInput).toBeVisible()
    await expect(searchInput).toHaveClass(/font-mono/)
    
    // Focus should trigger terminal effects
    await searchInput.focus()
    await expect(searchInput).toBeFocused()
    
    // Should show search tips
    const searchTips = page.locator('text=Search Tips')
    await expect(searchTips).toBeVisible()
    
    // Type in search
    await searchInput.fill('jwt')
    await page.waitForTimeout(400) // Wait for debounce
    
    // Should filter results
    const sessionCards = helpers.getSessionCards()
    const count = await sessionCards.count()
    expect(count).toBeGreaterThan(0)
  })

  test('keyboard shortcuts work', async ({ page }) => {
    const isMac = process.platform === 'darwin'
    const modifier = isMac ? 'Meta' : 'Control'
    
    // Test search shortcut
    await page.keyboard.press(`${modifier}+KeyK`)
    
    const searchInput = page.locator('[data-testid="search-input"]')
    await expect(searchInput).toBeFocused()
    
    // Escape to clear focus
    await page.keyboard.press('Escape')
    await expect(searchInput).not.toBeFocused()
    
    // Test new session shortcut
    await page.keyboard.press(`${modifier}+KeyN`)
    
    const dialog = page.locator('[data-testid="new-session-dialog"]')
    await expect(dialog).toBeVisible()
    
    // Close with Escape
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()
  })

  test('responsive design basics', async ({ page }) => {
    await helpers.waitForSessionCards()
    
    // Test desktop
    await page.setViewportSize({ width: 1200, height: 800 })
    await expect(page.locator('[data-testid="project-sidebar"]')).toBeVisible()
    await expect(helpers.getSessionCards().first()).toBeVisible()
    
    // Test mobile
    await page.setViewportSize({ width: 375, height: 667 })
    await page.waitForTimeout(300)
    
    // Sessions should still be visible
    await expect(helpers.getSessionCards().first()).toBeVisible()
    
    // Search should work on mobile
    const searchInput = page.locator('[data-testid="search-input"]')
    await expect(searchInput).toBeVisible()
  })

  test('view mode buttons are visible', async ({ page }) => {
    await helpers.waitForSessionCards()
    
    // Test that view mode buttons exist
    const gridButton = page.locator('[data-testid="view-mode-grid"]')
    const listButton = page.locator('[data-testid="view-mode-list"]')
    
    await expect(gridButton).toBeVisible()
    await expect(listButton).toBeVisible()
    
    // Sessions should be visible in current view
    await expect(helpers.getSessionCards().first()).toBeVisible()
  })
})