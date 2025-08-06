import { test, expect } from '@playwright/test'
import { TestHelpers } from '../utils/test-helpers'
import { testScenarios } from '../fixtures/mock-data'

test.describe('Search Functionality', () => {
  let helpers: TestHelpers

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page)
    await page.goto('/')
    await helpers.waitForPageLoad()
    await helpers.waitForSessionCards()
  })

  test('displays search bar with terminal styling', async ({ page }) => {
    const searchInput = page.locator('[data-testid="search-input"]')
    
    await expect(searchInput).toBeVisible()
    await expect(searchInput).toHaveClass(/font-mono/)
    await expect(searchInput).toHaveAttribute('placeholder')
    
    // Focus should add terminal effects
    await searchInput.focus()
    await expect(searchInput).toHaveClass(/focus:ring-accent/)
    await expect(searchInput).toHaveClass(/focus:border-accent/)
    
    // Should show search tips on focus
    const searchTips = page.locator('text=Search Tips')
    await expect(searchTips).toBeVisible()
  })

  test('filters sessions by search query', async ({ page }) => {
    const initialCards = await helpers.getSessionCards().count()
    expect(initialCards).toBeGreaterThan(0)
    
    // Search for a specific term
    await helpers.searchSessions(testScenarios.search.validQuery)
    
    // Should show filtered results
    const filteredCards = await helpers.getSessionCards().count()
    expect(filteredCards).toBeLessThan(initialCards)
    expect(filteredCards).toBe(testScenarios.search.expectedResults.length)
    
    // Verify filtered cards contain the search term
    const visibleCards = helpers.getSessionCards()
    for (let i = 0; i < filteredCards; i++) {
      const card = visibleCards.nth(i)
      const text = await card.textContent()
      expect(text?.toLowerCase()).toContain(testScenarios.search.validQuery.toLowerCase())
    }
  })

  test('shows no results state for non-matching search', async ({ page }) => {
    await helpers.searchSessions(testScenarios.search.noResultsQuery)
    
    // Should show empty state
    await helpers.verifyEmptyState('no-results')
    
    const emptyState = page.locator('[data-testid="empty-state-no-results"]')
    await expect(emptyState).toContainText('No sessions found')
    await expect(emptyState).toContainText(testScenarios.search.noResultsQuery)
    
    // Should show search help
    await expect(emptyState).toContainText('Try different keywords')
  })

  test('supports partial matching', async ({ page }) => {
    await helpers.searchSessions(testScenarios.search.partialMatch)
    
    const filteredCards = await helpers.getSessionCards().count()
    expect(filteredCards).toBe(testScenarios.search.partialResults.length)
    
    // Clear search to verify all sessions return
    await helpers.clearSearch()
    
    const allCards = await helpers.getSessionCards().count()
    expect(allCards).toBeGreaterThan(filteredCards)
  })

  test('clears search with clear button', async ({ page }) => {
    const searchInput = page.locator('[data-testid="search-input"]')
    
    // Enter search query
    await helpers.searchSessions('test-query')
    await expect(searchInput).toHaveValue('test-query')
    
    // Clear button should appear
    const clearButton = page.locator('button[title="Clear search"]')
    await expect(clearButton).toBeVisible()
    
    // Click clear button
    await clearButton.click()
    await expect(searchInput).toHaveValue('')
    
    // All sessions should be visible again
    const allCards = await helpers.getSessionCards().count()
    expect(allCards).toBeGreaterThan(0)
  })

  test('maintains search state during view changes', async ({ page }) => {
    const searchQuery = testScenarios.search.validQuery
    
    // Search in grid view
    await helpers.searchSessions(searchQuery)
    const gridResults = await helpers.getSessionCards().count()
    
    // Switch to list view
    await helpers.changeViewMode('list')
    
    // Search should be maintained
    const searchInput = page.locator('[data-testid="search-input"]')
    await expect(searchInput).toHaveValue(searchQuery)
    
    // Same number of results
    const listResults = await helpers.getSessionCards().count()
    expect(listResults).toBe(gridResults)
  })

  test('supports real-time search', async ({ page }) => {
    const searchInput = page.locator('[data-testid="search-input"]')
    
    // Type character by character
    await searchInput.focus()
    await searchInput.type(testScenarios.search.validQuery, { delay: 100 })
    
    // Should filter as we type (with debouncing)
    await page.waitForTimeout(400) // Wait for debounce
    
    const filteredCards = await helpers.getSessionCards().count()
    expect(filteredCards).toBe(testScenarios.search.expectedResults.length)
  })

  test('search is case insensitive', async ({ page }) => {
    const query = testScenarios.search.validQuery
    
    // Search with lowercase
    await helpers.searchSessions(query.toLowerCase())
    const lowerResults = await helpers.getSessionCards().count()
    
    // Clear and search with uppercase
    await helpers.clearSearch()
    await helpers.searchSessions(query.toUpperCase())
    const upperResults = await helpers.getSessionCards().count()
    
    // Should have same results
    expect(upperResults).toBe(lowerResults)
  })

  test('combines search with project filter', async ({ page }) => {
    // Apply project filter first
    await helpers.filterByProject(testScenarios.filters.specificProject)
    const projectFilteredCards = await helpers.getSessionCards().count()
    
    // Then apply search
    await helpers.searchSessions(testScenarios.search.validQuery)
    const combinedResults = await helpers.getSessionCards().count()
    
    // Should show intersection of filters
    expect(combinedResults).toBeLessThanOrEqual(projectFilteredCards)
    
    // Verify all visible cards match both project and search
    const visibleCards = helpers.getSessionCards()
    for (let i = 0; i < combinedResults; i++) {
      const card = visibleCards.nth(i)
      const projectAttr = await card.getAttribute('data-project')
      const text = await card.textContent()
      
      expect(projectAttr).toBe(testScenarios.filters.specificProject)
      expect(text?.toLowerCase()).toContain(testScenarios.search.validQuery.toLowerCase())
    }
  })
})