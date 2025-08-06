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
  featureName: string
  projectPath: string
  createWorktree: boolean
}

export interface CreateWindowResponse {
  success: boolean
  window?: WorkspaceWindow
  error?: string
}

export interface WindowResponse {
  windows: WorkspaceWindow[]
}

// Backward compatibility aliases
export type Session = WorkspaceWindow
export type CreateSessionRequest = CreateWindowRequest
export type CreateSessionResponse = CreateWindowResponse  
export type SessionResponse = WindowResponse

// API Response types
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

// Search and filter types
export type FilterStatus = 'all' | 'active' | 'ready-for-pr' | 'idle'
export type ViewMode = 'grid' | 'list'

// Component prop types
export interface WindowCardProps {
  window: WorkspaceWindow
  onDelete?: (projectName: string, featureName: string) => void
  viewMode?: ViewMode
  onSelect?: (window: WorkspaceWindow) => void
  isSelected?: boolean
}

export interface WindowListSidebarProps {
  windows: WorkspaceWindow[]
  selectedWindow?: WorkspaceWindow
  onWindowSelect: (window: WorkspaceWindow) => void
  projects: Record<string, number>
  selectedProject: string
  onProjectSelect: (project: string) => void
  filterStatus: FilterStatus
  onFilterChange: (status: FilterStatus) => void
  totalWindows: number
  activeWindows: number
  readyForPRWindows: number
  idleWindows: number
  searchQuery: string
  onSearchChange: (query: string) => void
}

export interface ExpandedWindowViewProps {
  window?: WorkspaceWindow
  onDelete?: (projectName: string, featureName: string) => void
}

export interface EmptyStateProps {
  type: 'no-windows' | 'no-results' | 'loading'
  searchQuery?: string
  selectedProject?: string
  filterStatus?: string
  onCreateWindow?: () => void
}

// Backward compatibility
export type SessionCardProps = WindowCardProps

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

export interface SessionSearchResult {
  session: Session
  metadata?: any // Imported from SessionManager
  matchScore: number
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
  healthCheck?: any // Will be imported separately from SessionManager
  metadata?: any // Will be imported separately from SessionManager
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