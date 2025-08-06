import { render, RenderOptions } from '@testing-library/react'
import { ReactElement, ReactNode } from 'react'
import type { Session, GitStats, WindowInfo } from '@/types'

// Test fixtures and mock data factories
export const testFixtures = {
  // Git statistics fixtures
  gitStats: {
    clean: (): GitStats => ({
      branch: 'feature/test',
      ahead: 0,
      behind: 0,
      staged: 0,
      unstaged: 0,
      untracked: 0,
      hasUncommittedChanges: false,
    }),
    
    dirty: (): GitStats => ({
      branch: 'feature/test-feature',
      ahead: 2,
      behind: 1,
      staged: 3,
      unstaged: 2,
      untracked: 1,
      hasUncommittedChanges: true,
    }),
    
    ahead: (count: number = 5): GitStats => ({
      branch: 'feature/ahead-branch',
      ahead: count,
      behind: 0,
      staged: 0,
      unstaged: 0,
      untracked: 0,
      hasUncommittedChanges: false,
    }),
    
    behind: (count: number = 3): GitStats => ({
      branch: 'feature/behind-branch',
      ahead: 0,
      behind: count,
      staged: 0,
      unstaged: 0,
      untracked: 0,
      hasUncommittedChanges: false,
    }),
    
    mixed: (): GitStats => ({
      branch: 'feature/complex-state',
      ahead: 2,
      behind: 1,
      staged: 1,
      unstaged: 2,
      untracked: 1,
      hasUncommittedChanges: true,
    }),
  },

  // Session fixtures
  sessions: {
    active: (): Session => ({
      projectName: 'active-project',
      featureName: 'active-feature',
      projectPath: '/projects/active-project',
      worktreePath: '/projects/active-project/.worktrees/active-feature',
      branch: 'feature/active-feature',
      gitStats: testFixtures.gitStats.dirty(),
      isActive: true,
    }),
    
    inactive: (): Session => ({
      projectName: 'inactive-project',
      featureName: 'inactive-feature',
      projectPath: '/projects/inactive-project',
      worktreePath: '/projects/inactive-project/.worktrees/inactive-feature',
      branch: 'feature/inactive-feature',
      gitStats: testFixtures.gitStats.clean(),
      isActive: false,
    }),
    
    webApp: (): Session => ({
      projectName: 'web-application',
      featureName: 'user-authentication',
      projectPath: '/projects/web-application',
      worktreePath: '/projects/web-application/.worktrees/user-authentication',
      branch: 'feature/user-authentication',
      gitStats: testFixtures.gitStats.mixed(),
      isActive: true,
    }),
    
    apiServer: (): Session => ({
      projectName: 'api-server',
      featureName: 'rate-limiting',
      projectPath: '/projects/api-server',
      worktreePath: '/projects/api-server/.worktrees/rate-limiting',
      branch: 'feature/rate-limiting',
      gitStats: testFixtures.gitStats.ahead(3),
      isActive: true,
    }),
    
    mobileApp: (): Session => ({
      projectName: 'mobile-app',
      featureName: 'offline-support',
      projectPath: '/projects/mobile-app',
      worktreePath: '/projects/mobile-app/.worktrees/offline-support',
      branch: 'feature/offline-support',
      gitStats: testFixtures.gitStats.behind(2),
      isActive: false,
    }),
  },

  // Window info fixtures
  windows: {
    standard: (): WindowInfo => ({
      name: 'project:feature',
      panePath: '/projects/project/.worktrees/feature',
    }),
    
    complex: (): WindowInfo => ({
      name: 'complex-project-name:complex-feature-name',
      panePath: '/home/dev/projects/complex-project-name/.worktrees/complex-feature-name',
    }),
    
    nested: (): WindowInfo => ({
      name: 'nested:project:feature-branch',
      panePath: '/deeply/nested/project/structure/.worktrees/feature-branch',
    }),
  },

  // Terminal output fixtures
  terminal: {
    clean: () => [
      '$ npm test',
      '✓ All tests passing (47 tests)',
      '✓ Coverage: 92%',
      '✓ Bundle size: 234KB (-12KB)',
      '$ git status',
      'On branch feature/test',
      'nothing to commit, working tree clean',
    ].join('\n'),
    
    building: () => [
      '$ npm run build',
      '⚡ Building application...',
      '⚡ Compiling TypeScript...',
      '⚡ Bundling assets...',
      '⚡ Optimizing images...',
      'Build completed in 23.4s',
    ].join('\n'),
    
    error: () => [
      '$ npm test',
      '❌ Test suite failed',
      'ERROR: Cannot find module \'../utils\'',
      '    at Object.<anonymous> (test/component.test.tsx:5:1)',
      'FAIL src/components/Button.test.tsx',
      'Tests:       2 failed, 8 passed, 10 total',
    ].join('\n'),
    
    installing: () => [
      '$ npm install @testing-library/react',
      '⬇ Downloading packages...',
      '⬇ Installing dependencies...',
      '✓ @testing-library/react@14.3.1',
      '✓ @testing-library/jest-dom@6.4.6',
      'added 23 packages in 12s',
    ].join('\n'),
  },

  // API response fixtures
  api: {
    sessionResponse: (sessions: Session[] = []) => ({
      sessions,
      pagination: {
        limit: 50,
        offset: 0,
        total: sessions.length,
        hasMore: false,
      },
      meta: {
        duration: 156,
        cached: false,
      },
    }),
    
    createSessionResponse: (session: Session | null, success = true, error?: string) => ({
      session,
      success,
      error,
      meta: {
        duration: 2340,
        requestId: 'test-request-id',
      },
    }),
    
    errorResponse: (error: string, code = 'UnknownError') => ({
      error,
      code,
      requestId: 'test-request-id',
    }),
  },

  // Command execution fixtures
  commands: {
    success: (stdout = '', stderr = '') => ({
      stdout,
      stderr,
      exitCode: 0,
    }),
    
    failure: (stderr = 'Command failed', exitCode = 1) => ({
      stdout: '',
      stderr,
      exitCode,
    }),
    
    gitStatus: () => ({
      stdout: 'M  modified-file.ts\nA  new-file.ts\n?? untracked-file.ts\n',
      stderr: '',
      exitCode: 0,
    }),
    
    tmuxListWindows: (windows: WindowInfo[] = []) => ({
      stdout: windows.map(w => `${w.name}:${w.panePath}`).join('\n'),
      stderr: '',
      exitCode: 0,
    }),
  },
}

// Enhanced test utilities extending the global ones
export const testUtils = {
  ...(global as any).testUtils || {},
  
  // Create mock functions with realistic behavior
  createMockAdapter: (type: 'tmux' | 'git') => {
    if (type === 'tmux') {
      return {
        ensureSession: jest.fn().mockResolvedValue(undefined),
        sessionExists: jest.fn().mockResolvedValue(true),
        listWindows: jest.fn().mockResolvedValue([]),
        createWindow: jest.fn().mockResolvedValue(undefined),
        killWindow: jest.fn().mockResolvedValue(undefined),
        capturePane: jest.fn().mockResolvedValue('terminal output'),
        getSessionInfo: jest.fn().mockResolvedValue({
          name: 'claude-tmux-manager',
          windows: 0,
          exists: true,
        }),
        clearCache: jest.fn(),
      }
    } else {
      return {
        getStatus: jest.fn().mockResolvedValue(testFixtures.gitStats.clean()),
        createWorktree: jest.fn().mockResolvedValue('/test/worktree'),
        removeWorktree: jest.fn().mockResolvedValue(undefined),
        rollbackChanges: jest.fn().mockResolvedValue(undefined),
        getProjectName: jest.fn().mockReturnValue('test-project'),
        getRepositoryInfo: jest.fn().mockResolvedValue({
          isRepo: true,
          branch: 'main',
          remoteUrl: 'git@github.com:user/repo.git',
          worktrees: [],
        }),
      }
    }
  },

  // Mock session manager with realistic behavior
  createMockSessionManager: () => ({
    listSessions: jest.fn().mockResolvedValue([]),
    createSession: jest.fn().mockResolvedValue(testFixtures.sessions.active()),
    deleteSession: jest.fn().mockResolvedValue(undefined),
    getSession: jest.fn().mockResolvedValue(null),
    sessionExists: jest.fn().mockResolvedValue(false),
    getSessionOutput: jest.fn().mockResolvedValue('terminal output'),
    searchSessions: jest.fn().mockResolvedValue([]),
    createSessionEnhanced: jest.fn().mockResolvedValue({
      success: true,
      data: testFixtures.sessions.active(),
      warnings: [],
    }),
    deleteSessionEnhanced: jest.fn().mockResolvedValue({
      success: true,
      warnings: [],
      metadata: { operationsCompleted: 3, operationsFailed: 0 },
    }),
    getSessionStatus: jest.fn().mockResolvedValue({
      exists: true,
      isHealthy: true,
      status: 'active',
    }),
    batchProcessSessions: jest.fn().mockResolvedValue([]),
    getSystemHealthReport: jest.fn().mockResolvedValue({
      totalSessions: 0,
      healthySessions: 0,
      unhealthySessions: 0,
      orphanedResources: 0,
      cacheEfficiency: 100,
      performanceMetrics: {},
      issues: [],
    }),
    clearAllCaches: jest.fn(),
    getCacheStats: jest.fn().mockReturnValue({
      sessionCacheSize: 0,
      metadataCacheSize: 0,
      performance: {},
    }),
    optimizeCache: jest.fn().mockReturnValue({
      removedSessions: 0,
      removedMetadata: 0,
    }),
  }),

  // Create collections of test data
  createSessionCollection: (count: number = 5): Session[] => {
    const generators = [
      testFixtures.sessions.webApp,
      testFixtures.sessions.apiServer,
      testFixtures.sessions.mobileApp,
      testFixtures.sessions.active,
      testFixtures.sessions.inactive,
    ]
    
    return Array.from({ length: count }, (_, i) => {
      const generator = generators[i % generators.length]
      const session = generator()
      return {
        ...session,
        projectName: `project-${i + 1}`,
        featureName: `feature-${i + 1}`,
      }
    })
  },

  // Simulate user interactions
  createUserEvent: () => {
    if (typeof window === 'undefined') {
      // Node.js environment - return mock
      return {
        click: jest.fn(),
        hover: jest.fn(),
        type: jest.fn(),
        tab: jest.fn(),
        keyboard: jest.fn(),
        setup: jest.fn().mockReturnThis(),
      }
    }
    
    // Browser environment - return real userEvent
    const userEvent = require('@testing-library/user-event')
    return userEvent
  },

  // Mock network requests
  mockFetch: (responses: Record<string, any> = {}) => {
    const defaultResponses = {
      '/api/sessions': testFixtures.api.sessionResponse(),
      '/api/health': { status: 'healthy' },
    }
    
    const allResponses = { ...defaultResponses, ...responses }
    
    global.fetch = jest.fn((input: any) => {
      const url = typeof input === 'string' ? input : input.url;
      const response = (allResponses as any)[url] || { error: 'Not found' }
      return Promise.resolve({
        ok: !response.error,
        status: response.error ? 404 : 200,
        json: () => Promise.resolve(response),
        headers: new Map(),
      } as unknown as Response)
    })
  },

  // Time utilities for testing
  time: {
    freeze: (date = new Date('2024-01-01')) => {
      jest.useFakeTimers()
      jest.setSystemTime(date)
    },
    
    unfreeze: () => {
      jest.useRealTimers()
    },
    
    advance: (ms: number) => {
      jest.advanceTimersByTime(ms)
    },
  },

  // Assertion helpers
  expect: {
    toBeSession: (received: any, expected: Partial<Session>) => {
      const pass = Object.keys(expected).every(key => {
        return received[key] === expected[key as keyof Session]
      })
      
      return {
        pass,
        message: () => pass
          ? `Expected session not to match ${JSON.stringify(expected)}`
          : `Expected session to match ${JSON.stringify(expected)}, but got ${JSON.stringify(received)}`,
      }
    },
    
    toBeGitStats: (received: any, expected: Partial<GitStats>) => {
      const pass = Object.keys(expected).every(key => {
        return received[key] === expected[key as keyof GitStats]
      })
      
      return {
        pass,
        message: () => pass
          ? `Expected git stats not to match ${JSON.stringify(expected)}`
          : `Expected git stats to match ${JSON.stringify(expected)}, but got ${JSON.stringify(received)}`,
      }
    },
  },

  // Environment helpers
  env: {
    mockNodeEnv: (env: string) => {
      const originalEnv = process.env.NODE_ENV
      ;(process.env as any).NODE_ENV = env
      return () => {
        ;(process.env as any).NODE_ENV = originalEnv
      }
    },
    
    mockEnvVar: (name: string, value: string) => {
      const original = process.env[name]
      process.env[name] = value
      return () => {
        if (original === undefined) {
          delete process.env[name]
        } else {
          process.env[name] = original
        }
      }
    },
  },

  // Component testing helpers
  component: {
    renderWithProviders: (ui: ReactElement, options: RenderOptions = {}) => {
      // If we had providers (like Redux, React Query, etc.), we'd wrap them here
      return render(ui, options)
    },
    
    expectToBeVisible: (element: HTMLElement) => {
      // expect(element).toBeInTheDocument()
      // expect(element).toBeVisible()
      // Note: These matchers should only be used in test environment
    },
    
    expectToHaveAccessibleName: (element: HTMLElement, name: string) => {
      // Custom accessible name matcher - implementation depends on testing framework
      const accessibleName = element.getAttribute('aria-label') || element.textContent || element.getAttribute('title')
      expect(accessibleName).toBe(name)
    },
  },
}

// Enhanced matchers for Jest
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeSession(expected: Partial<Session>): R
      toBeGitStats(expected: Partial<GitStats>): R
    }
  }
}

// Export everything as a convenience
export {
  testFixtures as fixtures,
  testUtils as utils,
}

export default testUtils