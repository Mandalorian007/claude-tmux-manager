import { test, expect } from '@playwright/test'
import { TestHelpers } from '../utils/test-helpers'
import { newSessionFormData } from '../fixtures/mock-data'

test.describe('Modal Dialogs', () => {
  let helpers: TestHelpers

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page)
    await page.goto('/')
    await helpers.waitForPageLoad()
  })

  test('opens new session dialog with correct styling', async ({ page }) => {
    // Dialog should not be visible initially
    await expect(page.locator('[data-testid="new-session-dialog"]')).not.toBeVisible()
    
    // Click new session button
    await helpers.openNewSessionDialog()
    
    // Dialog should be visible with proper styling
    const dialog = page.locator('[data-testid="new-session-dialog"]')
    await expect(dialog).toBeVisible()
    
    // Check terminal styling
    await expect(dialog).toHaveClass(/border-accent/)
    await expect(dialog.locator('h2')).toContainText('new-session')
    await expect(dialog.locator('h2')).toHaveClass(/font-mono/)
    await expect(dialog.locator('h2')).toContainText('$')
    
    // Check terminal window chrome
    const chrome = dialog.locator('.bg-background\\/80')
    await expect(chrome).toBeVisible()
    await expect(chrome).toContainText('create-session.sh')
    
    // Check terminal circles
    const redCircle = dialog.locator('.bg-error.rounded-full')
    const yellowCircle = dialog.locator('.bg-warning.rounded-full')
    const greenCircle = dialog.locator('.bg-success.rounded-full')
    
    await expect(redCircle).toBeVisible()
    await expect(yellowCircle).toBeVisible()
    await expect(greenCircle).toBeVisible()
  })

  test('closes dialog with close button', async ({ page }) => {
    await helpers.openNewSessionDialog()
    
    const dialog = page.locator('[data-testid="new-session-dialog"]')
    const closeButton = dialog.locator('button[title="Close dialog"]')
    
    await expect(closeButton).toBeVisible()
    await closeButton.click()
    
    await expect(dialog).not.toBeVisible()
  })

  test('closes dialog with Escape key', async ({ page }) => {
    await helpers.openNewSessionDialog()
    
    const dialog = page.locator('[data-testid="new-session-dialog"]')
    await expect(dialog).toBeVisible()
    
    await helpers.closeDialog()
    await expect(dialog).not.toBeVisible()
  })

  test('prevents dialog close when loading', async ({ page }) => {
    await helpers.openNewSessionDialog()
    
    // Mock the API to simulate loading state
    await page.route('/api/sessions', async route => {
      await new Promise(resolve => setTimeout(resolve, 2000))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          session: {
            ...newSessionFormData.valid,
            projectName: newSessionFormData.valid.projectName,
            featureName: newSessionFormData.valid.featureName,
            branch: `feature/${newSessionFormData.valid.featureName}`,
            gitStats: {
              branch: `feature/${newSessionFormData.valid.featureName}`,
              ahead: 0,
              behind: 0,
              staged: 0,
              unstaged: 0,
              untracked: 0,
              hasUncommittedChanges: false
            },
            isActive: true
          }
        })
      })
    })
    
    const dialog = page.locator('[data-testid="new-session-dialog"]')
    
    // Fill form
    await page.fill('input[name="projectPath"]', newSessionFormData.valid.projectPath)
    await page.fill('input[name="featureName"]', newSessionFormData.valid.featureName)
    
    // Submit form
    const submitButton = dialog.locator('button[type="submit"]')
    await submitButton.click()
    
    // Close button should be disabled during loading
    const closeButton = dialog.locator('button[title="Close dialog"]')
    await expect(closeButton).toBeDisabled()
    
    // Loading state should be visible
    await expect(dialog.locator('[data-testid="loading-spinner"]')).toBeVisible()
  })

  test('shows validation errors for invalid input', async ({ page }) => {
    await helpers.openNewSessionDialog()
    
    const dialog = page.locator('[data-testid="new-session-dialog"]')
    
    // Try to submit with empty fields
    const submitButton = dialog.locator('button[type="submit"]')
    await submitButton.click()
    
    // Form validation should prevent submission
    const projectPathInput = dialog.locator('input[name="projectPath"]')
    const featureNameInput = dialog.locator('input[name="featureName"]')
    
    // Check for required validation
    await expect(projectPathInput).toHaveAttribute('required')
    await expect(featureNameInput).toHaveAttribute('required')
  })

  test('fills form and shows command preview', async ({ page }) => {
    await helpers.openNewSessionDialog()
    
    const dialog = page.locator('[data-testid="new-session-dialog"]')
    
    // Fill project path
    const projectPathInput = dialog.locator('input[name="projectPath"]')
    await projectPathInput.fill(newSessionFormData.valid.projectPath)
    
    // Fill feature name
    const featureNameInput = dialog.locator('input[name="featureName"]')
    await featureNameInput.fill(newSessionFormData.valid.featureName)
    
    // Should show command preview
    const preview = dialog.locator('.font-mono').filter({ hasText: 'tmux new-session' })
    await expect(preview).toBeVisible()
    await expect(preview).toContainText(newSessionFormData.valid.featureName)
  })

  test('auto-formats feature name to be URL-safe', async ({ page }) => {
    await helpers.openNewSessionDialog()
    
    const dialog = page.locator('[data-testid="new-session-dialog"]')
    const featureNameInput = dialog.locator('input[name="featureName"]')
    
    // Type feature name with spaces and special characters
    await featureNameInput.fill('My Feature Name!@#')
    
    // Should be auto-formatted
    await expect(featureNameInput).toHaveValue('my-feature-name')
  })

  test('handles successful form submission', async ({ page }) => {
    // Mock successful API response
    await page.route('/api/sessions', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          session: {
            ...newSessionFormData.valid,
            projectName: newSessionFormData.valid.projectName,
            featureName: newSessionFormData.valid.featureName,
            branch: `feature/${newSessionFormData.valid.featureName}`,
            gitStats: {
              branch: `feature/${newSessionFormData.valid.featureName}`,
              ahead: 0,
              behind: 0,
              staged: 0,
              unstaged: 0,
              untracked: 0,
              hasUncommittedChanges: false
            },
            isActive: true
          }
        })
      })
    })
    
    await helpers.openNewSessionDialog()
    
    const dialog = page.locator('[data-testid="new-session-dialog"]')
    
    // Fill valid form data
    await page.fill('input[name="projectPath"]', newSessionFormData.valid.projectPath)
    await page.fill('input[name="featureName"]', newSessionFormData.valid.featureName)
    
    // Submit form
    const submitButton = dialog.locator('button[type="submit"]')
    await submitButton.click()
    
    // Dialog should close after successful submission
    await expect(dialog).not.toBeVisible()
    
    // Should show success notification
    const notification = page.locator('.bg-success, .text-success').filter({ hasText: /success/i })
    await expect(notification).toBeVisible()
  })

  test('handles API errors gracefully', async ({ page }) => {
    // Mock error response
    await page.route('/api/sessions', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Internal server error'
        })
      })
    })
    
    await helpers.openNewSessionDialog()
    
    const dialog = page.locator('[data-testid="new-session-dialog"]')
    
    // Fill and submit form
    await page.fill('input[name="projectPath"]', newSessionFormData.valid.projectPath)
    await page.fill('input[name="featureName"]', newSessionFormData.valid.featureName)
    
    const submitButton = dialog.locator('button[type="submit"]')
    await submitButton.click()
    
    // Should show error notification
    const errorNotification = page.locator('.bg-error, .text-error').filter({ hasText: /error|fail/i })
    await expect(errorNotification).toBeVisible()
  })

  test('maintains dialog state during view changes', async ({ page }) => {
    await helpers.openNewSessionDialog()
    
    const dialog = page.locator('[data-testid="new-session-dialog"]')
    
    // Fill some data
    await page.fill('input[name="projectPath"]', '/some/path')
    
    // Change view mode while dialog is open
    await helpers.changeViewMode('list')
    
    // Dialog should still be visible with data intact
    await expect(dialog).toBeVisible()
    const projectPathInput = dialog.locator('input[name="projectPath"]')
    await expect(projectPathInput).toHaveValue('/some/path')
  })
})