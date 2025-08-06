import type { Session } from '@/types'

/**
 * Mock data fixtures for E2E tests
 * These should mirror the data from lib/mockData.ts
 */

// Import the actual mock sessions from lib/mockData to ensure consistency
import { mockSessions } from '../../../lib/mockData'
export const testSessions = mockSessions

export const expectedStats = {
  sessions: testSessions.length,
  projects: new Set(testSessions.map(s => s.projectName)).size,
  readyForPR: testSessions.filter(s => s.gitStats.hasUncommittedChanges && s.gitStats.ahead > 0).length
}

export const testProjects = Array.from(new Set(testSessions.map(s => s.projectName)))

export const activeSessionsCount = testSessions.filter(s => s.isActive).length
export const idleSessionsCount = testSessions.filter(s => !s.isActive).length

/**
 * Test scenarios for different states
 */
export const testScenarios = {
  // Search scenarios
  search: {
    validQuery: 'jwt',
    expectedResults: testSessions.filter(s => 
      s.projectName.toLowerCase().includes('jwt') || 
      s.featureName.toLowerCase().includes('jwt') || 
      s.gitStats.branch.toLowerCase().includes('jwt')
    ),
    noResultsQuery: 'nonexistent',
    partialMatch: 'dash',
    partialResults: testSessions.filter(s => 
      s.projectName.toLowerCase().includes('dash') || 
      s.featureName.toLowerCase().includes('dash')
    )
  },
  
  // Filter scenarios
  filters: {
    activeOnly: testSessions.filter(s => s.isActive),
    idleOnly: testSessions.filter(s => !s.isActive),
    readyForPR: testSessions.filter(s => s.gitStats.hasUncommittedChanges && s.gitStats.ahead > 0),
    specificProject: 'user-auth-jwt',
    specificProjectSessions: testSessions.filter(s => s.projectName === 'user-auth-jwt')
  }
}

/**
 * Form validation test data
 */
export const newSessionFormData = {
  valid: {
    projectName: 'test-project',
    featureName: 'test-feature',
    projectPath: '/Users/test/projects/test-project',
    description: 'Test feature description'
  },
  invalid: {
    emptyProjectName: {
      projectName: '',
      featureName: 'test-feature',
      projectPath: '/Users/test/projects/test-project'
    },
    emptyFeatureName: {
      projectName: 'test-project',
      featureName: '',
      projectPath: '/Users/test/projects/test-project'
    },
    invalidPath: {
      projectName: 'test-project',
      featureName: 'test-feature',
      projectPath: 'invalid/path'
    }
  }
}