import type { Session } from '@/types'

export const mockSessions: Session[] = [
  {
    projectName: 'user-auth-jwt',
    featureName: 'jwt-refresh-tokens',
    projectPath: '/Users/claude/projects/user-auth-jwt',
    worktreePath: '/Users/claude/projects/user-auth-jwt/.worktrees/jwt-refresh-tokens',
    branch: 'feature/jwt-refresh-tokens',
    gitStats: {
      branch: 'feature/jwt-refresh-tokens',
      ahead: 3,
      behind: 0,
      staged: 2,
      unstaged: 1,
      untracked: 0,
      hasUncommittedChanges: true
    },
    isActive: true
  },
  {
    projectName: 'dashboard-redesign',
    featureName: 'dashboard-v2',
    projectPath: '/Users/claude/projects/dashboard-redesign',
    worktreePath: '/Users/claude/projects/dashboard-redesign/.worktrees/dashboard-v2',
    branch: 'feature/dashboard-v2',
    gitStats: {
      branch: 'feature/dashboard-v2',
      ahead: 12,
      behind: 2,
      staged: 5,
      unstaged: 3,
      untracked: 1,
      hasUncommittedChanges: true
    },
    isActive: true
  },
  {
    projectName: 'data-migration',
    featureName: 'user-data-cleanup',
    projectPath: '/Users/claude/projects/data-migration',
    worktreePath: '/Users/claude/projects/data-migration/.worktrees/user-data-cleanup',
    branch: 'feature/user-data-cleanup',
    gitStats: {
      branch: 'feature/user-data-cleanup',
      ahead: 0,
      behind: 0,
      staged: 0,
      unstaged: 0,
      untracked: 0,
      hasUncommittedChanges: false
    },
    isActive: false
  },
  {
    projectName: 'api-backend',
    featureName: 'rate-limiting',
    projectPath: '/Users/claude/projects/api-backend',
    worktreePath: '/Users/claude/projects/api-backend/.worktrees/rate-limiting',
    branch: 'feature/rate-limiting',
    gitStats: {
      branch: 'feature/rate-limiting',
      ahead: 5,
      behind: 1,
      staged: 2,
      unstaged: 0,
      untracked: 1,
      hasUncommittedChanges: true
    },
    isActive: true
  },
  {
    projectName: 'web-frontend',
    featureName: 'accessibility-improvements',
    projectPath: '/Users/claude/projects/web-frontend',
    worktreePath: '/Users/claude/projects/web-frontend/.worktrees/accessibility-improvements',
    branch: 'feature/accessibility-improvements',
    gitStats: {
      branch: 'feature/accessibility-improvements',
      ahead: 8,
      behind: 0,
      staged: 3,
      unstaged: 2,
      untracked: 0,
      hasUncommittedChanges: true
    },
    isActive: true
  },
  {
    projectName: 'ml-service',
    featureName: 'model-optimization',
    projectPath: '/Users/claude/projects/ml-service',
    worktreePath: '/Users/claude/projects/ml-service/.worktrees/model-optimization',
    branch: 'feature/model-optimization',
    gitStats: {
      branch: 'feature/model-optimization',
      ahead: 0,
      behind: 3,
      staged: 0,
      unstaged: 0,
      untracked: 0,
      hasUncommittedChanges: false
    },
    isActive: false
  }
]

export const useMockData = process.env.NODE_ENV === 'development' && 
  (process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true' || !process.env.NEXT_PUBLIC_USE_MOCK_DATA)