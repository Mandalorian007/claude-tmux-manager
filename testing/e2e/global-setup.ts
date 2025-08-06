import { FullConfig } from '@playwright/test'

async function globalSetup(config: FullConfig) {
  console.log('🎭 Setting up Playwright tests for Claude TMux Manager')
  
  // Ensure we're using mock data in tests
  process.env.NEXT_PUBLIC_USE_MOCK_DATA = 'true'
  // NODE_ENV is read-only in some environments, so we use a try-catch
  try {
    (process.env as any).NODE_ENV = 'development'
  } catch {
    // Ignore if NODE_ENV cannot be set
  }
  
  // Add any global test setup here
  // For example: database seeding, authentication setup, etc.
  
  console.log('✅ Global setup complete - mock data enabled')
}

export default globalSetup