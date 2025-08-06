import { test, expect } from '@playwright/test'
import { TestHelpers } from '../utils/test-helpers'

test.describe('Error Handling', () => {
  let helpers: TestHelpers

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page)
  })

  test('handles network errors gracefully', async ({ page }) => {
    // Block all network requests to simulate offline state
    await page.route('**/*', route => route.abort())
    
    await page.goto('/')
    
    // Should fallback to mock data or show error state
    await page.waitForTimeout(2000)
    
    // Check if either mock data loads or error state is shown
    const hasSessions = await helpers.getSessionCards().count() > 0
    const hasErrorState = await page.locator('[data-testid="error-state"]').count() > 0
    
    expect(hasSessions || hasErrorState).toBeTruthy()
  })

  test('handles API server errors', async ({ page }) => {
    // Mock server error responses
    await page.route('/api/sessions', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Internal Server Error'
        })
      })
    })
    
    await page.goto('/')
    await helpers.waitForPageLoad()
    
    // Should fallback to mock data since we're in development mode
    await helpers.waitForSessionCards()
    const sessionCards = await helpers.getSessionCards().count()
    expect(sessionCards).toBeGreaterThan(0)
  })

  test('shows appropriate error message for session creation failures', async ({ page }) => {
    await page.goto('/')
    await helpers.waitForPageLoad()
    
    // Mock failed session creation
    await page.route('/api/sessions', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Project path does not exist'
          })
        })
      } else {
        await route.continue()
      }
    })
    
    await helpers.openNewSessionDialog()
    
    // Fill and submit invalid data
    const dialog = page.locator('[data-testid="new-session-dialog"]')
    await dialog.locator('input[name="projectPath"]').fill('/nonexistent/path')
    await dialog.locator('input[name="featureName"]').fill('test-feature')
    
    const submitButton = dialog.locator('button[type="submit"]')
    await submitButton.click()
    
    // Should show error notification
    const errorNotification = page.locator('.bg-error, .text-error').filter({ hasText: /error|fail/i }).first()
    await expect(errorNotification).toBeVisible({ timeout: 5000 })
    
    // Dialog should remain open on error
    await expect(dialog).toBeVisible()
  })

  test('handles session deletion failures', async ({ page }) => {
    await page.goto('/')
    await helpers.waitForPageLoad()
    await helpers.waitForSessionCards()
    
    // Mock failed deletion
    await page.route('/api/sessions/**', async route => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Failed to delete session'
          })
        })
      } else {
        await route.continue()
      }
    })
    
    // Try to delete a session
    const firstCard = helpers.getSessionCards().first()
    await firstCard.hover()
    
    const deleteButton = firstCard.locator('[data-testid="delete-session-button"]')
    await expect(deleteButton).toBeVisible()
    await deleteButton.click()
    
    // Should show error notification
    const errorNotification = page.locator('.text-error').filter({ hasText: /fail|error/i }).first()
    await expect(errorNotification).toBeVisible({ timeout: 5000 })
    
    // Session should still be present
    await expect(firstCard).toBeVisible()
  })

  test('handles malformed API responses', async ({ page }) => {
    // Mock malformed JSON response
    await page.route('/api/sessions', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: 'invalid json{'
      })
    })
    
    await page.goto('/')
    await helpers.waitForPageLoad()
    
    // Should fallback to mock data
    await helpers.waitForSessionCards()
    const sessionCards = await helpers.getSessionCards().count()
    expect(sessionCards).toBeGreaterThan(0)
  })

  test('handles slow API responses', async ({ page }) => {
    // Mock very slow response
    await page.route('/api/sessions', async route => {
      await new Promise(resolve => setTimeout(resolve, 5000))
      await route.continue()
    })
    
    await page.goto('/')
    
    // Should show loading state
    await helpers.verifyEmptyState('loading')
    
    // Eventually should load (fallback to mock data)
    await helpers.waitForSessionCards()
    const sessionCards = await helpers.getSessionCards().count()
    expect(sessionCards).toBeGreaterThan(0)
  })

  test('displays user-friendly error messages', async ({ page }) => {
    await page.route('/api/sessions', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Permission denied: Cannot create session in this directory'
          })
        })
      } else {
        await route.continue()
      }
    })
    
    await page.goto('/')
    await helpers.waitForPageLoad()
    await helpers.openNewSessionDialog()
    
    const dialog = page.locator('[data-testid="new-session-dialog"]')
    await dialog.locator('input[name="projectPath"]').fill('/restricted/path')
    await dialog.locator('input[name="featureName"]').fill('test-feature')
    
    const submitButton = dialog.locator('button[type="submit"]')
    await submitButton.click()
    
    // Should show user-friendly error message
    const errorText = page.locator('text=/Permission denied/i')
    await expect(errorText).toBeVisible()
  })

  test('handles concurrent request errors', async ({ page }) => {
    let requestCount = 0
    
    await page.route('/api/sessions', async route => {
      requestCount++
      if (requestCount <= 2) {
        // Fail first few requests
        await route.fulfill({
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Too many requests'
          })
        })
      } else {
        await route.continue()
      }
    })
    
    await page.goto('/')
    await helpers.waitForPageLoad()
    
    // Should eventually succeed and show sessions
    await helpers.waitForSessionCards()
    const sessionCards = await helpers.getSessionCards().count()
    expect(sessionCards).toBeGreaterThan(0)
  })

  test('maintains app stability during errors', async ({ page }) => {
    // Simulate various error conditions
    await page.route('/api/sessions', async route => {
      const url = route.request().url()
      if (url.includes('sessions') && Math.random() < 0.5) {
        // Randomly fail 50% of requests
        await route.abort()
      } else {
        await route.continue()
      }
    })
    
    await page.goto('/')
    await helpers.waitForPageLoad()
    
    // App should remain functional despite errors
    const newSessionButton = page.locator('[data-testid="new-session-button"]')
    await expect(newSessionButton).toBeVisible()
    
    const searchInput = page.locator('[data-testid="search-input"]')
    await expect(searchInput).toBeVisible()
    
    // Basic interactions should work
    await searchInput.fill('test')
    await newSessionButton.click()
    
    const dialog = page.locator('[data-testid="new-session-dialog"]')
    await expect(dialog).toBeVisible()
  })

  test('provides helpful error recovery suggestions', async ({ page }) => {
    await page.route('/api/sessions', async route => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Service temporarily unavailable'
        })
      })
    })
    
    await page.goto('/')
    await helpers.waitForPageLoad()
    
    // Look for error recovery suggestions in notifications or UI
    const refreshButton = page.locator('[data-testid="refresh-sessions"]')
    await expect(refreshButton).toBeVisible()
    
    // Refresh button should be functional
    await refreshButton.click()
    
    // Should show refreshing state
    const refreshIcon = refreshButton.locator('svg')
    await expect(refreshIcon).toHaveClass(/animate-spin/)
  })

  test('logs errors for debugging', async ({ page }) => {
    const consoleErrors: string[] = []
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })
    
    // Trigger an error
    await page.route('/api/sessions', async route => {
      await route.fulfill({
        status: 500,
        body: 'Server Error'
      })
    })
    
    await page.goto('/')
    await helpers.waitForPageLoad()
    
    // Check that errors are logged (this depends on implementation)
    // At minimum, network errors should appear in console
    expect(consoleErrors.length).toBeGreaterThan(0)
  })

  test('handles JavaScript runtime errors gracefully', async ({ page }) => {
    // Inject a script that might cause errors
    await page.addInitScript(() => {
      // Override a method to cause potential errors
      const originalFetch = window.fetch
      window.fetch = async (...args) => {
        if (Math.random() < 0.1) {
          throw new Error('Random network error')
        }
        return originalFetch.apply(window, args)
      }
    })
    
    await page.goto('/')
    await helpers.waitForPageLoad()
    
    // App should still function despite random errors
    await helpers.waitForSessionCards()
    const sessionCards = await helpers.getSessionCards().count()
    expect(sessionCards).toBeGreaterThan(0)
    
    // Basic functionality should work
    await helpers.searchSessions('test')
    await helpers.clearSearch()
  })
})