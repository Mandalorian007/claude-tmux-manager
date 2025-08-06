import { test, expect, Page } from '@playwright/test'
import { TestHelpers } from '../utils/test-helpers'
import { testSessions, expectedStats } from '../fixtures/mock-data'

test.describe('Home Page', () => {
  let helpers: TestHelpers

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page)
    await page.goto('/')
    await helpers.waitForPageLoad()
  })

  test('loads correctly with dark terminal theme', async ({ page }) => {
    // Check page loads
    await expect(page).toHaveTitle(/Claude TMux Manager/)
    
    // Verify terminal theme
    await helpers.verifyTerminalTheme()
    
    // Check header elements
    await expect(page.locator('h1')).toContainText('claude-tmux-manager')
    await expect(page.locator('[data-testid="stats-container"]')).toBeVisible()
    
    // Verify terminal-style elements
    const header = page.locator('header')
    await expect(header).toHaveClass(/border-b/)
    await expect(header).toHaveClass(/bg-card-bg/)
    
    // Check for terminal prompt style
    await expect(page.locator('h1')).toContainText('$')
    await expect(page.locator('h1')).toHaveClass(/font-mono/)
    
    // Verify animated elements
    await expect(page.locator('.animate-blink')).toBeVisible()
  })

  test('displays session cards with correct data', async ({ page }) => {
    // Wait for session cards to load
    await helpers.waitForSessionCards()
    
    // Check that we have the expected number of sessions
    const sessionCards = helpers.getSessionCards()
    await expect(sessionCards).toHaveCount(testSessions.length)
    
    // Verify first session card content
    const firstSession = testSessions[0]
    const firstCard = helpers.getSessionCard(firstSession.projectName, firstSession.featureName)
    
    await expect(firstCard).toBeVisible()
    await expect(firstCard).toContainText(firstSession.projectName)
    await expect(firstCard).toContainText(firstSession.featureName)
    await expect(firstCard).toContainText(firstSession.gitStats.branch.replace('feature/', ''))
    
    // Check for terminal preview (more specific locator)
    await expect(firstCard.locator('[class*="bg-background"]')).toBeVisible()
    
    // Verify active session indicator
    if (firstSession.isActive) {
      // Check for the active session indicator element (green dot)
      const activeIndicator = firstCard.locator('div[title="Active session"]')
      await expect(activeIndicator).toBeAttached()
      // Check the element has the correct classes
      await expect(activeIndicator).toHaveClass(/bg-success/)
      await expect(activeIndicator).toHaveClass(/rounded-full/)
    }
  })

  test('displays correct statistics', async ({ page }) => {
    await helpers.waitForSessionCards()
    
    // Verify stats
    await helpers.verifyStats(expectedStats)
    
    // Check that stats are properly styled
    const sessionsStat = page.locator('[data-testid="stat-sessions"]')
    const projectsStat = page.locator('[data-testid="stat-projects"]')
    const readyStat = page.locator('[data-testid="stat-ready"]')
    
    await expect(sessionsStat).toHaveClass(/animate-pulse/)
    await expect(projectsStat).toHaveClass(/text-accent/)
    
    // Ready stat should have warning color if > 0
    if (expectedStats.readyForPR > 0) {
      await expect(readyStat).toHaveClass(/text-warning/)
    }
  })

  test('shows sidebar with project filters', async ({ page }) => {
    await helpers.waitForPageLoad()
    
    const sidebar = page.locator('[data-testid="project-sidebar"]')
    await expect(sidebar).toBeVisible()
    
    // Check "All" filter
    await expect(page.locator('[data-testid="project-filter-all"]')).toBeVisible()
    
    // Check project-specific filters
    const uniqueProjects = [...new Set(testSessions.map(s => s.projectName))]
    for (const project of uniqueProjects) {
      await expect(page.locator(`[data-testid="project-filter-${project}"]`)).toBeVisible()
    }
    
    // Check status filters
    await expect(page.locator('[data-testid="status-filter-all"]')).toBeVisible()
    await expect(page.locator('[data-testid="status-filter-active"]')).toBeVisible()
    await expect(page.locator('[data-testid="status-filter-ready-for-pr"]')).toBeVisible()
    await expect(page.locator('[data-testid="status-filter-idle"]')).toBeVisible()
  })

  test('shows empty state when no sessions match filters', async ({ page }) => {
    await helpers.waitForSessionCards()
    
    // Search for something that doesn't exist
    await helpers.searchSessions('nonexistent-project')
    
    // Should show no results empty state
    await helpers.verifyEmptyState('no-results')
    await expect(page.locator('[data-testid="empty-state-no-results"]')).toContainText('No sessions found')
    await expect(page.locator('[data-testid="empty-state-no-results"]')).toContainText('nonexistent-project')
  })

  test('handles loading state properly', async ({ page }) => {
    // Intercept API call to simulate loading
    await page.route('/api/sessions', async route => {
      // Delay response to test loading state
      await new Promise(resolve => setTimeout(resolve, 1000))
      await route.continue()
    })
    
    await page.goto('/')
    
    // Should show loading state initially
    await helpers.verifyEmptyState('loading')
    
    // Eventually should show sessions
    await helpers.waitForSessionCards()
    const sessionCount = await helpers.getSessionCards().count()
    expect(sessionCount).toBeGreaterThan(0)
  })
})