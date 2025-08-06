// Jest setup file for testing environment
require('@testing-library/jest-dom')

// Mock next/router
jest.mock('next/router', () => ({
  useRouter: () => ({
    route: '/',
    pathname: '/',
    query: {},
    asPath: '/',
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    prefetch: jest.fn(),
    beforePopState: jest.fn(),
    events: {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
    },
  }),
}))

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

// Mock crypto.randomUUID for API tests
if (typeof crypto === 'undefined') {
  global.crypto = {
    randomUUID: () => 'test-uuid-' + Math.random().toString(36).substring(2),
  }
}

// Increase test timeout for integration tests
jest.setTimeout(30000)

// Mock console methods for cleaner test output
const originalError = console.error
const originalWarn = console.warn

beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is deprecated')
    ) {
      return
    }
    originalError.call(console, ...args)
  }
  
  console.warn = (...args) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('componentWillReceiveProps') ||
       args[0].includes('componentWillMount'))
    ) {
      return
    }
    originalWarn.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
  console.warn = originalWarn
})

// Make test utilities available globally
// Note: We define testUtils inline to avoid circular imports

// Global test utilities
global.testUtils = {
  // Wait for async operations
  waitForAsync: (ms = 0) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Create mock session data
  createMockSession: (overrides = {}) => ({
    projectName: 'test-project',
    featureName: 'test-feature',
    projectPath: '/test/project',
    worktreePath: '/test/project/.worktrees/test-feature',
    branch: 'feature/test-feature',
    gitStats: {
      branch: 'feature/test-feature',
      ahead: 0,
      behind: 0,
      staged: 0,
      unstaged: 0,
      untracked: 0,
      hasUncommittedChanges: false,
    },
    isActive: true,
    ...overrides,
  }),
  
  // Create mock git stats
  createMockGitStats: (overrides = {}) => ({
    branch: 'feature/test',
    ahead: 0,
    behind: 0,
    staged: 0,
    unstaged: 0,
    untracked: 0,
    hasUncommittedChanges: false,
    ...overrides,
  }),
  
  // Create mock window info
  createMockWindowInfo: (overrides = {}) => ({
    name: 'test-project:test-feature',
    panePath: '/test/project/.worktrees/test-feature',
    ...overrides,
  }),
}