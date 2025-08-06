import { defineConfig, devices } from '@playwright/test'

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './testing/e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. Terminal-focused for validation loop */
  reporter: [
    ['list'], // Simple terminal output
    ['json', { outputFile: 'testing/e2e/test-results/results.json' }] // For automation
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:3000',
    
    /* Run headless for terminal-based validation */
    headless: true,
    
    /* Collect trace only on failure for minimal overhead */
    trace: 'retain-on-failure',
    
    /* No screenshots or videos for headless operation */
    screenshot: 'off',
    video: 'off',
    
    /* Timeout for each test */
    actionTimeout: 2000,
    
    /* Navigation timeout */
    navigationTimeout: 3000
  },

  /* Configure projects for major browsers - simplified to just Chromium for MVP */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], headless: true },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 30 * 1000, // 30 seconds max startup
    env: {
      NODE_ENV: 'development',
      NEXT_PUBLIC_USE_MOCK_DATA: 'true'
    }
  },

  /* Global setup and teardown */
  globalSetup: require.resolve('./testing/e2e/global-setup.ts'),
  
  /* Test timeout - ultra fast */
  timeout: 5 * 1000, // 5 seconds per test
  
  /* Expect timeout */
  expect: {
    timeout: 3000
  },
  
  /* Output directory for test artifacts */
  outputDir: './testing/e2e/test-results',
  
  /* Report slow tests */
  reportSlowTests: {
    max: 3,
    threshold: 10000 // 10 seconds
  }
})