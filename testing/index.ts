/**
 * Testing Directory Index
 * 
 * This file provides an overview of the testing structure for the Claude TMux Manager project.
 * All tests are organized in a mirrored directory structure for easier discovery and maintenance.
 */

// Test Categories
export * from './lib'
export * from './components'
export * from './app'

/**
 * Test Structure:
 * 
 * testing/
 * ├── lib/                          # Core library tests
 * │   ├── adapters/                 # Adapter tests (tmux, git)
 * │   ├── managers/                 # Manager tests (SessionManager)
 * │   ├── command-executor.test.ts  # Command execution tests
 * │   ├── errors.test.ts            # Error handling tests
 * │   └── utils.test.ts             # Utility function tests
 * ├── components/                   # React component tests
 * │   └── SessionCard.test.tsx      # SessionCard component tests
 * └── app/                          # Next.js app tests
 *     └── api/                      # API route tests
 *         └── sessions/              # Session API tests
 *             └── route.test.ts      # Session route tests
 */

// Test utilities and helpers
export { default as testUtils } from '../test-utils'