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

export interface WorkspaceWindow {
  projectName: string    // "my-backend"
  featureName: string    // "user-auth"
  projectPath: string    // "/home/user/projects/my-backend"
  worktreePath: string   // "/home/user/projects/my-backend/.worktrees/user-auth"
  branch: string         // "feature/user-auth"
  gitStats: GitStats
  isActive: boolean
}

export interface CreateWindowRequest {
  projectName: string
  projectPath: string
  featureName: string
  createWorktree?: boolean
}

export interface WindowResponse {
  windows: WorkspaceWindow[]
}

export interface CreateWindowResponse {
  window: WorkspaceWindow
  success: boolean
  error?: string
}

// Enhanced types for the improved WindowManager
export interface WindowFilter {
  projectName?: string
  featureName?: string
  hasUncommittedChanges?: boolean
  isActive?: boolean
  branchPattern?: RegExp
  status?: 'active' | 'idle' | 'ready-for-pr' | 'unhealthy'
  lastActivityBefore?: Date
  lastActivityAfter?: Date
}

export interface WindowMetadata {
  lastActivity?: Date
  commitInfo?: {
    hash: string
    message: string
    author: string
    date: Date
  }
  outputHistory?: string[]
}

export interface WindowSearchResult {
  window: WorkspaceWindow
  metadata?: WindowMetadata
  matchScore: number
}

export interface WindowHealthCheck {
  isHealthy: boolean
  issues: string[]
  tmuxWindowExists: boolean
  gitWorktreeValid: boolean
  pathAccessible: boolean
  branchValid: boolean
}

export interface WindowOperationResult<T = void> {
  success: boolean
  data?: T
  error?: string
  warnings: string[]
  metadata?: Record<string, any>
}

export interface WindowStatusInfo {
  exists: boolean
  isHealthy: boolean
  status: 'active' | 'idle' | 'ready-for-pr' | 'unhealthy' | 'not-found'
  window?: WorkspaceWindow
  healthCheck?: WindowHealthCheck
  metadata?: WindowMetadata
}

// Additional types for enhanced window operations
export interface WindowSearchOptions {
  text?: string
  tags?: string[]
  sortBy?: 'name' | 'activity' | 'score'
  limit?: number
}

export interface WindowStreamOptions {
  interval?: number
  maxLines?: number
  includeEscapes?: boolean
}

export interface OrphanedWindowInfo {
  windowName: string
  panePath: string
  detectedProject?: string
  detectedFeature?: string
  canRestore: boolean
  issues: string[]
}

export interface WindowCacheStats {
  windowCacheSize: number
  metadataCacheSize: number
  oldestWindowCacheEntry?: number
  oldestMetadataCacheEntry?: number
  hitRate?: number
  missRate?: number
}

// Global test utilities interface
declare global {
  var testUtils: {
    waitForAsync: (ms?: number) => Promise<void>
    createMockWindow: (overrides?: Partial<WorkspaceWindow>) => WorkspaceWindow
    createMockGitStats: (overrides?: Partial<GitStats>) => GitStats
    createMockWindowInfo: (overrides?: Partial<WindowInfo>) => WindowInfo
  }
}