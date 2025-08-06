import { Page, Locator, expect } from '@playwright/test'

/**
 * Test utility functions for common Playwright operations
 */
export class TestHelpers {
  constructor(private page: Page) {}

  /**
   * Wait for the page to fully load with all animations
   */
  async waitForPageLoad() {
    await this.page.waitForLoadState('networkidle')
    // Wait for any mount animations to complete
    await this.page.waitForTimeout(500)
    // Dismiss any overlays that might interfere
    await this.dismissOverlays()
  }

  /**
   * Wait for session cards to be visible
   */
  async waitForSessionCards() {
    await this.page.waitForSelector('[data-testid="session-card"]', { timeout: 10000 })
  }

  /**
   * Get all session cards
   */
  getSessionCards(): Locator {
    return this.page.locator('[data-testid="session-card"]')
  }

  /**
   * Get a specific session card by project and feature name
   */
  getSessionCard(projectName: string, featureName: string): Locator {
    return this.page.locator(`[data-testid="session-card"][data-project="${projectName}"][data-feature="${featureName}"]`)
  }

  /**
   * Open the new session dialog
   */
  async openNewSessionDialog() {
    // Dismiss any welcome message first
    const welcomeMessage = this.page.locator('[data-testid="welcome-message"]')
    if (await welcomeMessage.isVisible()) {
      const dismissButton = welcomeMessage.locator('button')
      if (await dismissButton.isVisible()) {
        await dismissButton.click()
        await this.page.waitForTimeout(300)
      }
    }
    
    await this.page.click('[data-testid="new-session-button"]')
    await this.page.waitForSelector('[data-testid="new-session-dialog"]')
  }

  /**
   * Close any open dialog by pressing Escape
   */
  async closeDialog() {
    await this.page.keyboard.press('Escape')
    await this.page.waitForTimeout(300) // Wait for close animation
  }

  /**
   * Search for sessions
   */
  async searchSessions(query: string) {
    await this.page.fill('[data-testid="search-input"]', query)
    await this.page.waitForTimeout(300) // Wait for debounced search
  }

  /**
   * Clear search
   */
  async clearSearch() {
    await this.page.fill('[data-testid="search-input"]', '')
    await this.page.waitForTimeout(300)
  }

  /**
   * Change view mode (grid or list)
   */
  async changeViewMode(mode: 'grid' | 'list') {
    await this.dismissOverlays()
    await this.page.click(`[data-testid="view-mode-${mode}"]`)
    await this.page.waitForTimeout(300) // Wait for view transition
  }

  /**
   * Refresh sessions
   */
  async refreshSessions() {
    await this.page.click('[data-testid="refresh-sessions"]')
    await this.page.waitForSelector('[data-testid="refresh-sessions"]:not(.animate-spin)', { timeout: 10000 })
  }

  /**
   * Filter by project
   */
  async filterByProject(projectName: string) {
    // Dismiss any overlays first
    await this.dismissOverlays()
    
    await this.page.click(`[data-testid="project-filter-${projectName}"]`)
    await this.page.waitForTimeout(300)
  }

  /**
   * Filter by status
   */
  async filterByStatus(status: 'all' | 'active' | 'ready-for-pr' | 'idle') {
    await this.page.click(`[data-testid="status-filter-${status}"]`)
    await this.page.waitForTimeout(300)
  }

  /**
   * Check if an element has a specific class
   */
  async hasClass(selector: string, className: string): Promise<boolean> {
    const element = this.page.locator(selector)
    const classAttr = await element.getAttribute('class')
    return classAttr?.includes(className) || false
  }

  /**
   * Verify terminal theme styles are applied
   */
  async verifyTerminalTheme() {
    // Check for dark background
    const body = this.page.locator('body')
    await expect(body).toHaveClass(/bg-background/)
    
    // Check for terminal-style header
    const header = this.page.locator('header')
    await expect(header).toBeVisible()
    
    // Check for terminal prompt style title
    const title = this.page.locator('h1')
    await expect(title).toContainText('claude-tmux-manager')
    await expect(title).toHaveClass(/font-mono/)
  }

  /**
   * Verify responsive design at different screen sizes
   */
  async testResponsiveDesign() {
    const sizes = [
      { width: 1200, height: 800, name: 'desktop' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 375, height: 667, name: 'mobile' }
    ]

    for (const size of sizes) {
      await this.page.setViewportSize({ width: size.width, height: size.height })
      await this.page.waitForTimeout(300) // Wait for responsive changes
      
      // Verify layout adapts
      const isDesktop = size.width >= 1024
      const sidebar = this.page.locator('[data-testid="project-sidebar"]')
      
      if (isDesktop) {
        await expect(sidebar).toBeVisible()
      }
      
      // Verify sessions are still visible and interactive
      await expect(this.getSessionCards().first()).toBeVisible()
    }
    
    // Reset to desktop size
    await this.page.setViewportSize({ width: 1200, height: 800 })
  }

  /**
   * Test keyboard shortcuts
   */
  async testKeyboardShortcuts() {
    // Test Cmd+N (or Ctrl+N on non-Mac) for new session
    const isMac = process.platform === 'darwin'
    const modifier = isMac ? 'Meta' : 'Control'
    
    await this.page.keyboard.press(`${modifier}+KeyN`)
    await expect(this.page.locator('[data-testid="new-session-dialog"]')).toBeVisible()
    
    // Close dialog with Escape
    await this.page.keyboard.press('Escape')
    await expect(this.page.locator('[data-testid="new-session-dialog"]')).not.toBeVisible()
    
    // Test Cmd+K (or Ctrl+K) for search focus
    await this.page.keyboard.press(`${modifier}+KeyK`)
    await expect(this.page.locator('[data-testid="search-input"]')).toBeFocused()
    
    // Test Escape to blur search
    await this.page.keyboard.press('Escape')
    await expect(this.page.locator('[data-testid="search-input"]')).not.toBeFocused()
  }

  /**
   * Verify stats display correctly
   */
  async verifyStats(expectedStats: { sessions: number; projects: number; readyForPR: number }) {
    const statsContainer = this.page.locator('[data-testid="stats-container"]')
    await expect(statsContainer).toBeVisible()
    
    // Check individual stats
    await expect(this.page.locator('[data-testid="stat-sessions"]')).toContainText(expectedStats.sessions.toString())
    await expect(this.page.locator('[data-testid="stat-projects"]')).toContainText(expectedStats.projects.toString())
    await expect(this.page.locator('[data-testid="stat-ready"]')).toContainText(expectedStats.readyForPR.toString())
  }

  /**
   * Simulate session card hover effects
   */
  async testSessionCardHover(projectName: string, featureName: string) {
    const card = this.getSessionCard(projectName, featureName)
    await card.hover()
    await this.page.waitForTimeout(200) // Wait for hover animation
    
    // Verify hover effects are applied
    const deleteButton = card.locator('[data-testid="delete-session-button"]')
    await expect(deleteButton).toBeVisible()
  }

  /**
   * Test error state display
   */
  async verifyErrorState(expectedMessage?: string) {
    const errorState = this.page.locator('[data-testid="error-state"]')
    await expect(errorState).toBeVisible()
    
    if (expectedMessage) {
      await expect(errorState).toContainText(expectedMessage)
    }
  }

  /**
   * Test empty state display
   */
  async verifyEmptyState(type: 'no-sessions' | 'no-results' | 'loading') {
    const emptyState = this.page.locator(`[data-testid="empty-state-${type}"]`)
    await expect(emptyState).toBeVisible()
  }

  /**
   * Wait for loading states to complete
   */
  async waitForLoadingToComplete() {
    // Wait for any loading spinners to disappear
    await this.page.waitForSelector('[data-testid="loading-spinner"]', { state: 'detached', timeout: 10000 })
  }

  /**
   * Take a screenshot with a descriptive name
   */
  async takeScreenshot(name: string) {
    await this.page.screenshot({
      path: `./testing/e2e/screenshots/${name}.png`,
      fullPage: true
    })
  }
  
  /**
   * Dismiss any welcome messages or overlays that might interfere with tests
   */
  async dismissOverlays() {
    // Dismiss welcome message
    const welcomeMessage = this.page.locator('[data-testid="welcome-message"]')
    if (await welcomeMessage.isVisible()) {
      const dismissButton = welcomeMessage.locator('button')
      if (await dismissButton.isVisible()) {
        await dismissButton.click()
        await this.page.waitForTimeout(300)
      }
    }
    
    // Close any open dialogs
    const dialogs = this.page.locator('[data-testid*="dialog"]')
    const dialogCount = await dialogs.count()
    if (dialogCount > 0) {
      await this.closeDialog()
    }
  }
}