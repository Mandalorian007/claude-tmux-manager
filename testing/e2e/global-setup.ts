import { FullConfig } from '@playwright/test'

async function globalSetup(config: FullConfig) {
  // Minimal setup - enable mock data for tests
  process.env.NEXT_PUBLIC_USE_MOCK_DATA = 'true'
}

export default globalSetup