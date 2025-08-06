import { test, expect } from '@playwright/test'
import { TestHelpers } from '../utils/test-helpers'

test.describe('Keyboard Shortcuts', () => {
  let helpers: TestHelpers

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page)
    await page.goto('/')
    await helpers.waitForPageLoad()
  })

  test('displays keyboard shortcut hints', async ({ page }) => {
    // Check for shortcut hints in the UI
    const newSessionHint = page.locator('text=⌘N').or(page.locator('text=Ctrl+N'))
    const searchHint = page.locator('text=⌘K').or(page.locator('text=Ctrl+K'))
    
    // On desktop, shortcuts should be visible
    await page.setViewportSize({ width: 1200, height: 800 })
    
    // New session shortcut hint
    await expect(page.locator('text=New session')).toBeVisible()
    
    // Search shortcut hint (might be near search)
    const searchInput = page.locator('[data-testid="search-input"]')
    await expect(searchInput).toBeVisible()
  })

  test('opens new session dialog with Cmd+N (Mac) or Ctrl+N (Windows)', async ({ page }) => {
    const isMac = process.platform === 'darwin'
    const modifier = isMac ? 'Meta' : 'Control'
    
    // Ensure dialog is not open
    await expect(page.locator('[data-testid="new-session-dialog"]')).not.toBeVisible()
    
    // Press keyboard shortcut
    await page.keyboard.press(`${modifier}+KeyN`)
    
    // Dialog should open
    const dialog = page.locator('[data-testid="new-session-dialog"]')
    await expect(dialog).toBeVisible()
    
    // Close dialog for cleanup
    await helpers.closeDialog()
  })

  test('focuses search with Cmd+K (Mac) or Ctrl+K (Windows)', async ({ page }) => {
    const isMac = process.platform === 'darwin'
    const modifier = isMac ? 'Meta' : 'Control'
    
    const searchInput = page.locator('[data-testid="search-input"]')
    
    // Ensure search is not focused initially
    await expect(searchInput).not.toBeFocused()
    
    // Press keyboard shortcut
    await page.keyboard.press(`${modifier}+KeyK`)
    
    // Search should be focused
    await expect(searchInput).toBeFocused()
    
    // Should show search tips
    const searchTips = page.locator('text=Search Tips')
    await expect(searchTips).toBeVisible()
  })

  test('escapes from focused search', async ({ page }) => {
    const searchInput = page.locator('[data-testid="search-input"]')
    
    // Focus search manually
    await searchInput.focus()
    await expect(searchInput).toBeFocused()
    
    // Press Escape
    await page.keyboard.press('Escape')
    
    // Search should lose focus
    await expect(searchInput).not.toBeFocused()
    
    // Search tips should be hidden
    const searchTips = page.locator('text=Search Tips')
    await expect(searchTips).not.toBeVisible()
  })

  test('escapes from new session dialog', async ({ page }) => {
    // Open dialog
    await helpers.openNewSessionDialog()
    
    const dialog = page.locator('[data-testid="new-session-dialog"]')
    await expect(dialog).toBeVisible()
    
    // Press Escape
    await page.keyboard.press('Escape')
    
    // Dialog should close
    await expect(dialog).not.toBeVisible()
  })

  test('keyboard shortcuts work with search query present', async ({ page }) => {
    const isMac = process.platform === 'darwin'
    const modifier = isMac ? 'Meta' : 'Control'
    
    // Enter a search query first
    await helpers.searchSessions('jwt')
    
    // Keyboard shortcuts should still work
    await page.keyboard.press(`${modifier}+KeyN`)
    
    const dialog = page.locator('[data-testid="new-session-dialog"]')
    await expect(dialog).toBeVisible()
    
    // Close dialog
    await helpers.closeDialog()
  })

  test('keyboard navigation works in dialog forms', async ({ page }) => {
    await helpers.openNewSessionDialog()
    
    const dialog = page.locator('[data-testid="new-session-dialog"]')
    const projectPathInput = dialog.locator('input[name="projectPath"]')
    const featureNameInput = dialog.locator('input[name="featureName"]')
    
    // Tab should move between form fields
    await page.keyboard.press('Tab')
    
    // First input should be focused (or second, depending on form order)
    const focusedElement = await page.locator(':focus')
    const tagName = await focusedElement.getAttribute('name')
    expect(['projectPath', 'featureName']).toContain(tagName)
    
    // Tab again should move to next field
    await page.keyboard.press('Tab')
    
    // Continue tabbing should cycle through form elements
    await page.keyboard.press('Tab')
    
    // Should be able to submit with Enter (if form is valid)
    await projectPathInput.fill('/valid/path')
    await featureNameInput.fill('valid-feature')
    
    // Focus submit button and press Enter
    const submitButton = dialog.locator('button[type="submit"]')
    await submitButton.focus()
    await page.keyboard.press('Enter')
    
    // Form should attempt to submit (may show loading or error)
  })

  test('prevents default browser shortcuts when appropriate', async ({ page }) => {
    const isMac = process.platform === 'darwin'
    const modifier = isMac ? 'Meta' : 'Control'
    
    // Our Cmd+N should not trigger browser's new window
    await page.keyboard.press(`${modifier}+KeyN`)
    
    // Our dialog should open, not browser new window
    const dialog = page.locator('[data-testid="new-session-dialog"]')
    await expect(dialog).toBeVisible()
    
    await helpers.closeDialog()
  })

  test('keyboard shortcuts work in different view modes', async ({ page }) => {
    const isMac = process.platform === 'darwin'
    const modifier = isMac ? 'Meta' : 'Control'
    
    // Test in grid view
    await helpers.changeViewMode('grid')
    await page.keyboard.press(`${modifier}+KeyN`)
    let dialog = page.locator('[data-testid="new-session-dialog"]')
    await expect(dialog).toBeVisible()
    await helpers.closeDialog()
    
    // Test in list view
    await helpers.changeViewMode('list')
    await page.keyboard.press(`${modifier}+KeyN`)
    await expect(dialog).toBeVisible()
    await helpers.closeDialog()
  })

  test('handles rapid keyboard shortcuts', async ({ page }) => {
    const isMac = process.platform === 'darwin'
    const modifier = isMac ? 'Meta' : 'Control'
    
    // Rapidly press shortcuts
    await page.keyboard.press(`${modifier}+KeyK`)
    await page.keyboard.press('Escape')
    await page.keyboard.press(`${modifier}+KeyN`)
    await page.keyboard.press('Escape')
    
    // Should handle gracefully without getting stuck
    const dialog = page.locator('[data-testid="new-session-dialog"]')
    await expect(dialog).not.toBeVisible()
    
    const searchInput = page.locator('[data-testid="search-input"]')
    await expect(searchInput).not.toBeFocused()
  })

  test('keyboard shortcuts work with filters applied', async ({ page }) => {
    const isMac = process.platform === 'darwin'
    const modifier = isMac ? 'Meta' : 'Control'
    
    // Apply a filter first
    await helpers.filterByStatus('active')
    
    // Keyboard shortcuts should still work
    await page.keyboard.press(`${modifier}+KeyK`)
    
    const searchInput = page.locator('[data-testid="search-input"]')
    await expect(searchInput).toBeFocused()
    
    // Clear focus
    await page.keyboard.press('Escape')
    
    // New session shortcut should work
    await page.keyboard.press(`${modifier}+KeyN`)
    
    const dialog = page.locator('[data-testid="new-session-dialog"]')
    await expect(dialog).toBeVisible()
    
    await helpers.closeDialog()
  })

  test('shows helpful keyboard shortcut information', async ({ page }) => {
    // Look for any keyboard shortcut documentation or hints
    const body = await page.textContent('body')
    
    // Should contain hints about keyboard shortcuts
    const hasKeyboardHints = body?.includes('⌘') || 
                            body?.includes('Ctrl') || 
                            body?.includes('shortcut') ||
                            body?.includes('keyboard')
    
    expect(hasKeyboardHints).toBeTruthy()
  })

  test('accessibility: shortcuts work with screen readers', async ({ page }) => {
    const isMac = process.platform === 'darwin'
    const modifier = isMac ? 'Meta' : 'Control'
    
    // Test that ARIA labels and roles are present for keyboard navigation
    await page.keyboard.press(`${modifier}+KeyN`)
    
    const dialog = page.locator('[data-testid="new-session-dialog"]')
    await expect(dialog).toBeVisible()
    
    // Check for proper ARIA attributes
    const form = dialog.locator('form')
    const inputs = form.locator('input')
    
    // Inputs should have proper labels or aria-label
    const inputCount = await inputs.count()
    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i)
      const hasLabel = await input.getAttribute('aria-label') || 
                      await input.getAttribute('placeholder') ||
                      await page.locator(`label[for="${await input.getAttribute('id')}"]`).count() > 0
      expect(hasLabel).toBeTruthy()
    }
    
    await helpers.closeDialog()
  })
})