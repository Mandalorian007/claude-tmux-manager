# End-to-End Testing with Playwright

This directory contains comprehensive Playwright end-to-end tests for the Claude TMux Manager application.

## Overview

The E2E test suite validates the complete user experience across different browsers and devices, ensuring that:

- The application loads correctly with the dark terminal theme
- Session cards display properly with mock data
- Search functionality works as expected
- Modal dialogs open and close correctly
- Responsive design adapts to different screen sizes
- Keyboard shortcuts work consistently
- Error states are handled gracefully

## Test Structure

```
testing/e2e/
├── fixtures/           # Test data and mock responses
│   └── mock-data.ts   # Shared test fixtures
├── specs/             # Test specification files
│   ├── home-page.spec.ts
│   ├── search-functionality.spec.ts
│   ├── modal-dialogs.spec.ts
│   ├── responsive-design.spec.ts
│   ├── keyboard-shortcuts.spec.ts
│   └── error-handling.spec.ts
├── utils/             # Test utility functions
│   └── test-helpers.ts
├── global-setup.ts    # Global test configuration
└── README.md         # This file
```

## Running Tests

### Prerequisites

1. Install dependencies:
   ```bash
   npm install
   ```

2. Install Playwright browsers:
   ```bash
   npm run test:e2e:install
   ```

### Running All Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run tests with UI mode (interactive)
npm run test:e2e:ui

# Run tests in debug mode
npm run test:e2e:debug
```

### Running Specific Tests

```bash
# Run a specific test file
npm run test:e2e -- specs/home-page.spec.ts

# Run tests matching a pattern
npm run test:e2e -- --grep "search functionality"

# Run tests on a specific browser
npm run test:e2e -- --project=chromium
```

### Viewing Reports

```bash
# Show HTML report
npm run test:e2e:report
```

## Test Configuration

Tests are configured in `playwright.config.ts` with the following key settings:

- **Base URL**: `http://localhost:3000`
- **Browsers**: Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari
- **Parallel Execution**: Tests run in parallel for faster execution
- **Retry Logic**: Automatic retry on failures in CI environment
- **Screenshots**: Captured on test failures
- **Videos**: Recorded for failed tests
- **Mock Data**: Uses development mock data for consistent testing

## Test Data

The tests use mock data defined in `testing/e2e/fixtures/mock-data.ts`, which mirrors the actual development mock data to ensure consistency. This includes:

- 6 sample tmux sessions across different projects
- Various git states (active, idle, ready for PR)
- Realistic project names and feature branches
- Git statistics (staged, unstaged, commits ahead/behind)

## Test Helpers

The `TestHelpers` class in `utils/test-helpers.ts` provides common functionality:

- Page load waiting and animation handling
- Session card interactions
- Search and filtering operations
- Modal dialog management
- Responsive design testing
- Keyboard shortcut testing

## Test Categories

### 1. Home Page Tests (`home-page.spec.ts`)
- Page loading and terminal theme verification
- Session card display and data accuracy
- Statistics calculation and display
- Sidebar functionality
- Empty states

### 2. Search Functionality (`search-functionality.spec.ts`)
- Real-time search filtering
- Search result accuracy
- Search state persistence
- Combined search and filter operations
- Search UX (terminal styling, tips)

### 3. Modal Dialogs (`modal-dialogs.spec.ts`)
- New session dialog opening/closing
- Form validation and submission
- Loading states and error handling
- Keyboard interaction (Escape key)
- Terminal-style dialog presentation

### 4. Responsive Design (`responsive-design.spec.ts`)
- Layout adaptation across screen sizes
- Touch device interactions
- Content optimization for different orientations
- Accessibility with text scaling
- Component visibility and functionality

### 5. Keyboard Shortcuts (`keyboard-shortcuts.spec.ts`)
- Cmd+N / Ctrl+N for new session
- Cmd+K / Ctrl+K for search focus
- Escape key for dialog closing
- Tab navigation in forms
- Cross-platform compatibility

### 6. Error Handling (`error-handling.spec.ts`)
- Network error recovery
- API error responses
- Loading timeouts
- Form validation errors
- Application stability under error conditions

## Best Practices

### Writing Tests

1. **Use descriptive test names** that clearly indicate what is being tested
2. **Follow the AAA pattern**: Arrange, Act, Assert
3. **Use data-testid attributes** for reliable element selection
4. **Wait for animations** and loading states before assertions
5. **Test user journeys** rather than implementation details

### Test Data

1. **Use consistent mock data** across all tests
2. **Create realistic test scenarios** that match production use cases
3. **Test edge cases** like empty states and error conditions
4. **Maintain data fixtures** separately for reusability

### Performance

1. **Use parallel execution** for faster test runs
2. **Run critical tests first** in CI environments
3. **Optimize selectors** for speed and reliability
4. **Clean up state** between tests to prevent interference

## Debugging Tests

### Local Debugging

```bash
# Run tests with browser visible
npm run test:e2e -- --headed

# Run tests with slow motion
npm run test:e2e -- --headed --slowMo=1000

# Debug a specific test
npm run test:e2e:debug -- specs/home-page.spec.ts
```

### Analyzing Failures

1. **Check screenshots** in `testing/e2e/test-results/`
2. **Review videos** of failed test runs
3. **Examine console logs** in the Playwright trace viewer
4. **Verify test data** and mock responses

## Environment Variables

- `NEXT_PUBLIC_USE_MOCK_DATA=true` - Ensures mock data is used during testing
- `NODE_ENV=development` - Enables development mode features
- `CI=true` - Activates CI-specific behaviors (retry logic, etc.)

## CI Integration

Tests run automatically on:
- Pull requests to main/develop branches
- Pushes to main/develop branches

The CI workflow:
1. Sets up Node.js environment
2. Installs dependencies and Playwright browsers
3. Builds the application
4. Runs the complete E2E test suite
5. Uploads test artifacts (reports, screenshots, videos)

## Maintenance

### Updating Tests

1. **Keep tests in sync** with UI changes
2. **Update test data** when mock data changes
3. **Add new test cases** for new features
4. **Remove obsolete tests** for deprecated functionality

### Performance Monitoring

1. **Monitor test execution time** and optimize slow tests
2. **Track flaky tests** and improve their reliability
3. **Update browser versions** regularly
4. **Review and update timeouts** as needed

## Troubleshooting

### Common Issues

1. **Test timeouts**: Increase timeout values or improve wait conditions
2. **Element not found**: Update selectors or add proper wait conditions
3. **Flaky tests**: Add more specific waits and improve test isolation
4. **Mock data mismatch**: Ensure test fixtures match application mock data

### Getting Help

1. Check the Playwright documentation: https://playwright.dev/
2. Review existing test patterns in the codebase
3. Use the Playwright trace viewer for detailed debugging
4. Run tests with `--debug` flag for step-by-step execution

---

The E2E test suite provides confidence that the Claude TMux Manager works correctly from a user's perspective across different browsers and devices, ensuring a reliable and consistent experience for terminal enthusiasts.