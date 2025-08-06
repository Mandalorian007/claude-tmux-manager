export interface GitStats {
  branch: string
  ahead: number
  behind: number
  staged: number
  unstaged: number
  untracked: number
  hasUncommittedChanges: boolean
}

export interface WindowInfo {
  name: string        // "my-backend:user-auth"
  panePath: string    // "/home/user/projects/my-backend/.worktrees/user-auth"
}

export interface Session {
  projectName: string    // "my-backend"
  featureName: string    // "user-auth"
  projectPath: string    // "/home/user/projects/my-backend"
  worktreePath: string   // "/home/user/projects/my-backend/.worktrees/user-auth"
  branch: string         // "feature/user-auth"
  gitStats: GitStats
  isActive: boolean
}

export interface CreateSessionRequest {
  projectName: string
  projectPath: string
  featureName: string
  createWorktree?: boolean
}

export interface SessionResponse {
  sessions: Session[]
}

export interface CreateSessionResponse {
  session: Session
  success: boolean
  error?: string
}

// Enhanced types for the improved SessionManager
export interface SessionFilter {
  projectName?: string
  featureName?: string
  hasUncommittedChanges?: boolean
  isActive?: boolean
  branchPattern?: RegExp
  status?: 'active' | 'idle' | 'ready-for-pr' | 'unhealthy'
  lastActivityBefore?: Date
  lastActivityAfter?: Date
}

export interface SessionMetadata {
  lastActivity?: Date
  commitInfo?: {
    hash: string
    message: string
    author: string
    date: Date
  }
  outputHistory?: string[]
}

export interface SessionSearchResult {
  session: Session
  metadata?: SessionMetadata
  matchScore: number
}

export interface SessionHealthCheck {
  isHealthy: boolean
  issues: string[]
  tmuxWindowExists: boolean
  gitWorktreeValid: boolean
  pathAccessible: boolean
  branchValid: boolean
}

export interface SessionOperationResult<T = void> {
  success: boolean
  data?: T
  error?: string
  warnings: string[]
  metadata?: Record<string, any>
}

export interface SessionStatusInfo {
  exists: boolean
  isHealthy: boolean
  status: 'active' | 'idle' | 'ready-for-pr' | 'unhealthy' | 'not-found'
  session?: Session
  healthCheck?: SessionHealthCheck
  metadata?: SessionMetadata
}

// Additional types for enhanced session operations
export interface SessionSearchOptions {
  text?: string
  tags?: string[]
  sortBy?: 'name' | 'activity' | 'score'
  limit?: number
}

export interface SessionStreamOptions {
  interval?: number
  maxLines?: number
  includeEscapes?: boolean
}

export interface OrphanedSessionInfo {
  windowName: string
  panePath: string
  detectedProject?: string
  detectedFeature?: string
  canRestore: boolean
  issues: string[]
}

export interface SessionCacheStats {
  sessionCacheSize: number
  metadataCacheSize: number
  oldestSessionCacheEntry?: number
  oldestMetadataCacheEntry?: number
  hitRate?: number
  missRate?: number
}

// Global test utilities interface
declare global {
  var testUtils: {
    waitForAsync: (ms?: number) => Promise<void>
    createMockSession: (overrides?: Partial<Session>) => Session
    createMockGitStats: (overrides?: Partial<GitStats>) => GitStats
    createMockWindowInfo: (overrides?: Partial<WindowInfo>) => WindowInfo
  }
}