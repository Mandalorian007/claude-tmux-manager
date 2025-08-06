import { tmuxAdapter } from '@/lib/adapters/tmux'
import { gitAdapter } from '@/lib/adapters/git'
import type { Session, CreateSessionRequest, WindowInfo, GitStats, SessionSearchOptions } from '@/types'
import { SessionError, ValidationError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import path from 'path'
import fs from 'fs/promises'
import { CommandExecutor } from '@/lib/command-executor'
import { 
  SessionStatusAnalyzer,
  PathValidator,
  SessionSearchUtil,
  SessionSafetyValidator,
  SessionPerformanceMonitor
} from '@/lib/utils/session-utils'

export interface SessionFilter {
  projectName?: string
  featureName?: string
  hasUncommittedChanges?: boolean
  isActive?: boolean
  branchPattern?: RegExp
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

export class SessionManager {
  private logger = logger.createChild({ component: 'SessionManager' })
  private sessionCache = new Map<string, { session: Session; timestamp: number; metadata?: SessionMetadata }>()
  private metadataCache = new Map<string, { metadata: SessionMetadata; timestamp: number }>()
  private readonly cacheTimeout = 30000 // 30 seconds
  private readonly metadataCacheTimeout = 60000 // 1 minute
  private readonly maxConcurrentOperations = 5
  private operationQueue: Array<() => Promise<any>> = []
  private activeOperations = 0

  /**
   * List all active sessions with intelligent caching and concurrent processing
   */
  async listSessions(options: { 
    useCache?: boolean
    includeMetadata?: boolean
    filter?: SessionFilter 
  } = {}): Promise<Session[]> {
    const { useCache = true, includeMetadata = false, filter } = options
    this.logger.debug('Listing sessions', { useCache, includeMetadata, hasFilter: !!filter })
    
    return SessionPerformanceMonitor.timeOperation('list-sessions', async () => {
      const cacheKey = 'all-sessions'
      const now = Date.now()
      
      // Check cache if enabled
      if (useCache) {
        const cached = this.sessionCache.get(cacheKey)
        if (cached && (now - cached.timestamp) < this.cacheTimeout) {
          this.logger.debug('Returning cached sessions', { count: cached.session ? 1 : 0 })
          let sessions = Array.isArray(cached.session) ? cached.session : []
          return this.applyFilter(sessions, filter)
        }
      }

      try {
        await tmuxAdapter.ensureSession()
        const windows = await tmuxAdapter.listWindows()
        
        this.logger.debug(`Found ${windows.length} tmux windows`, { windowCount: windows.length })

        const sessions: Session[] = []
        const errors: Array<{ window: string; error: Error }> = []
        
        // Process windows concurrently with limit
        const processingResults = await this.processConcurrently(
          windows,
          async (window) => {
            try {
              const session = await this.parseWindowToSession(window, { includeMetadata })
              return session
            } catch (error) {
              errors.push({ window: window.name, error: error as Error })
              return null
            }
          },
          this.maxConcurrentOperations
        )
        
        // Collect valid sessions
        for (const result of processingResults) {
          if (result) {
            sessions.push(result)
          }
        }
        
        // Log any errors
        if (errors.length > 0) {
          this.logger.warn('Some windows could not be processed', { 
            errorCount: errors.length,
            errors: errors.map(e => ({ window: e.window, message: e.error.message })) 
          })
        }
        
        // Cache the results
        this.sessionCache.set(cacheKey, {
          session: sessions as any,
          timestamp: now
        })
        
        this.logger.info(`Successfully listed ${sessions.length} sessions`, { 
          sessionCount: sessions.length,
          errorCount: errors.length 
        })
        
        return this.applyFilter(sessions, filter)
      } catch (error) {
        this.logger.error('Failed to list sessions', error)
        throw new SessionError(`Failed to list sessions: ${(error as Error).message}`)
      }
    })
  }
  
  /**
   * Parse a tmux window into a session object with enhanced path derivation
   */
  private async parseWindowToSession(
    window: WindowInfo, 
    options: { includeMetadata?: boolean } = {}
  ): Promise<Session | null> {
    const { includeMetadata = false } = options
    
    // Enhanced window name parsing with validation
    const parseResult = this.parseWindowName(window.name)
    if (!parseResult) {
      return null
    }
    
    const { projectName, featureName } = parseResult
    
    // Robust project path derivation with edge case handling
    const pathInfo = await this.deriveProjectPaths(window.panePath, featureName)
    if (!pathInfo) {
      this.logger.debug('Could not derive project paths', {
        windowName: window.name,
        panePath: window.panePath,
        featureName
      })
      return null
    }
    
    const { projectPath, worktreePath } = pathInfo
    const branch = `feature/${featureName}`
    
    try {
      // Validate paths exist and are accessible
      await this.validateSessionPaths(projectPath, worktreePath)
      
      // Get git status with enhanced error handling
      const gitStats = await gitAdapter.getStatus(worktreePath)
      
      const session: Session = {
        projectName,
        featureName,
        projectPath,
        worktreePath,
        branch,
        gitStats,
        isActive: true
      }
      
      // Cache the session for quick lookups
      const sessionKey = `${projectName}:${featureName}`
      this.sessionCache.set(sessionKey, {
        session,
        timestamp: Date.now(),
        metadata: includeMetadata ? await this.collectSessionMetadata(session) : undefined
      })
      
      return session
    } catch (error) {
      this.logger.warn('Failed to validate session during parsing', {
        windowName: window.name,
        projectPath,
        worktreePath,
        error: (error as Error).message
      })
      return null
    }
  }
  
  /**
   * Enhanced window name parsing with comprehensive validation
   */
  private parseWindowName(windowName: string): { projectName: string; featureName: string } | null {
    if (!windowName || typeof windowName !== 'string') {
      this.logger.debug('Invalid window name type', { windowName })
      return null
    }
    
    // Find the first colon (project:feature format)
    const colonIndex = windowName.indexOf(':')
    if (colonIndex === -1) {
      this.logger.debug('Window name missing colon separator', { windowName })
      return null
    }
    
    const projectName = windowName.substring(0, colonIndex).trim()
    const featureName = windowName.substring(colonIndex + 1).trim()
    
    // Validate project name
    if (!this.isValidProjectName(projectName)) {
      this.logger.debug('Invalid project name format', { windowName, projectName })
      return null
    }
    
    // Validate feature name using existing validation logic
    if (!this.isValidFeatureName(featureName)) {
      this.logger.debug('Invalid feature name format', { windowName, featureName })
      return null
    }
    
    return { projectName, featureName }
  }
  
  /**
   * Robust project path derivation with edge case handling
   */
  private async deriveProjectPaths(
    panePath: string, 
    featureName: string
  ): Promise<{ projectPath: string; worktreePath: string } | null> {
    if (!panePath || !featureName) {
      return null
    }
    
    // Standard worktree pattern: /path/to/project/.worktrees/feature-name
    const standardSuffix = `/.worktrees/${featureName}`
    
    if (panePath.endsWith(standardSuffix)) {
      const projectPath = panePath.slice(0, -standardSuffix.length)
      return {
        projectPath: await this.resolveRealPath(projectPath),
        worktreePath: await this.resolveRealPath(panePath)
      }
    }
    
    // Handle nested worktrees: /path/to/project/nested/.worktrees/feature-name
    const worktreePattern = /^(.+)\.worktrees\/${this.escapeRegex(featureName)}$/
    const match = panePath.match(worktreePattern)
    if (match) {
      const basePath = match[1].replace(/\/$/, '') // Remove trailing slash
      try {
        // Verify this looks like a project path
        const realBasePath = await this.resolveRealPath(basePath)
        const realPanePath = await this.resolveRealPath(panePath)
        
        if (await this.isValidProjectPath(realBasePath)) {
          return {
            projectPath: realBasePath,
            worktreePath: realPanePath
          }
        }
      } catch (error) {
        this.logger.debug('Failed to resolve nested worktree paths', {
          basePath,
          panePath,
          error: (error as Error).message
        })
      }
    }
    
    // Handle symlinks and alternative structures
    try {
      const realPath = await this.resolveRealPath(panePath)
      if (realPath !== panePath) {
        // Try again with resolved real path
        return this.deriveProjectPaths(realPath, featureName)
      }
    } catch (error) {
      this.logger.debug('Failed to resolve symlinks in path derivation', {
        panePath,
        error: (error as Error).message
      })
    }
    
    this.logger.debug('No valid path pattern matched', { panePath, featureName })
    return null
  }
  
  /**
   * Validate project and feature naming conventions
   */
  private isValidProjectName(projectName: string): boolean {
    if (!projectName || typeof projectName !== 'string') {
      return false
    }
    
    // Project names should be reasonable length and format
    if (projectName.length === 0 || projectName.length > 100) {
      return false
    }
    
    // Allow alphanumeric, hyphens, underscores, dots (common project name patterns)
    const validProjectNameRegex = /^[a-zA-Z0-9][a-zA-Z0-9._-]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/
    return validProjectNameRegex.test(projectName)
  }
  
  private isValidFeatureName(featureName: string): boolean {
    if (!featureName || typeof featureName !== 'string') {
      return false
    }
    
    if (featureName.length === 0 || featureName.length > 100) {
      return false
    }
    
    // Feature names should be lowercase kebab-case
    const validFeatureNameRegex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/
    return validFeatureNameRegex.test(featureName)
  }
  
  /**
   * Resolve real path handling symlinks and relative paths
   */
  private async resolveRealPath(inputPath: string): Promise<string> {
    try {
      const stats = await fs.lstat(inputPath)
      if (stats.isSymbolicLink()) {
        const linkTarget = await fs.readlink(inputPath)
        const resolvedPath = path.isAbsolute(linkTarget) 
          ? linkTarget 
          : path.resolve(path.dirname(inputPath), linkTarget)
        return this.resolveRealPath(resolvedPath) // Recursively resolve
      }
      return path.resolve(inputPath)
    } catch (error) {
      // If we can't resolve, return the original path
      return path.resolve(inputPath)
    }
  }
  
  /**
   * Validate that a path looks like a valid project path
   */
  private async isValidProjectPath(projectPath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(projectPath)
      if (!stats.isDirectory()) {
        return false
      }
      
      // Check for common project indicators
      const projectIndicators = [
        '.git',
        'package.json',
        'Cargo.toml',
        'go.mod',
        'pom.xml',
        'requirements.txt',
        'Makefile',
        'README.md',
        'README.rst'
      ]
      
      for (const indicator of projectIndicators) {
        try {
          await fs.access(path.join(projectPath, indicator))
          return true // Found a project indicator
        } catch {
          // Continue checking other indicators
        }
      }
      
      // If no indicators found, it might still be a valid project directory
      // Check if it's not obviously a system directory
      const suspiciousPaths = ['/bin', '/usr', '/var', '/etc', '/tmp', '/root']
      const normalizedPath = path.resolve(projectPath)
      
      return !suspiciousPaths.some(suspicious => 
        normalizedPath.startsWith(suspicious + '/') || normalizedPath === suspicious
      )
    } catch {
      return false
    }
  }
  
  /**
   * Escape string for use in regex
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
  
  /**
   * Validate session paths exist and are accessible
   */
  private async validateSessionPaths(projectPath: string, worktreePath: string): Promise<void> {
    try {
      // Check project path
      const projectStat = await fs.stat(projectPath)
      if (!projectStat.isDirectory()) {
        throw new ValidationError('Project path is not a directory', 'projectPath', projectPath)
      }
      
      // Check worktree path
      const worktreeStat = await fs.stat(worktreePath)
      if (!worktreeStat.isDirectory()) {
        throw new ValidationError('Worktree path is not a directory', 'worktreePath', worktreePath)
      }
      
      // Verify worktree is actually a git worktree
      const gitDirResult = await CommandExecutor.execute(
        'git rev-parse --git-dir',
        { cwd: worktreePath, timeout: 5000, suppressErrors: true }
      )
      
      if (gitDirResult.exitCode !== 0) {
        throw new ValidationError('Worktree path is not a valid git worktree', 'worktreePath', worktreePath)
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error
      }
      throw new ValidationError(
        `Failed to validate session paths: ${(error as Error).message}`,
        'paths',
        { projectPath, worktreePath }
      )
    }
  }
  
  /**
   * Process items concurrently with a limit
   */
  private async processConcurrently<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    concurrencyLimit: number
  ): Promise<R[]> {
    const results: R[] = new Array(items.length)
    const executing: Promise<void>[] = []
    
    for (let i = 0; i < items.length; i++) {
      const promise = processor(items[i]).then(result => {
        results[i] = result
      })
      
      executing.push(promise)
      
      if (executing.length >= concurrencyLimit) {
        await Promise.race(executing)
        // Remove completed promises
        const completed = executing.filter(p => (p as any).settled !== false)
        executing.splice(0, completed.length)
      }
    }
    
    await Promise.all(executing)
    return results
  }
  
  /**
   * Apply filter to sessions list using enhanced utility
   */
  private applyFilter(sessions: Session[], filter?: SessionFilter): Session[] {
    if (!filter) {
      return sessions
    }
    
    // Use utility for enhanced filtering
    return SessionSearchUtil.filterSessions(sessions, filter)
  }

  /**
   * Create a new session with comprehensive validation and error handling
   */
  async createSession(request: CreateSessionRequest): Promise<Session> {
    this.logger.debug('Creating new session', { projectPath: request.projectPath, featureName: request.featureName })
    
    const { projectPath, featureName } = request

    try {
      // Validate inputs
      this.validateCreateSessionRequest(request)

      const projectName = gitAdapter.getProjectName(projectPath)
      const windowName = `${projectName}:${featureName}`
      
      this.logger.info('Creating session', {
        projectName,
        featureName,
        windowName,
        projectPath
      })

      // Check if session already exists
      const existingSessions = await this.listSessions()
      const existingSession = existingSessions.find(
        s => s.projectName === projectName && s.featureName === featureName
      )
      
      if (existingSession) {
        throw new SessionError(
          `Session already exists for project '${projectName}' and feature '${featureName}'`,
          windowName
        )
      }

      // Ensure tmux session exists
      await tmuxAdapter.ensureSession()

      // Create git worktree (this will validate the git repo and feature name)
      const worktreePath = await gitAdapter.createWorktree(projectPath, featureName)

      try {
        // Create tmux window
        await tmuxAdapter.createWindow(windowName, worktreePath)
        
        // Get initial git stats
        const gitStats = await gitAdapter.getStatus(worktreePath)

        const session: Session = {
          projectName,
          featureName,
          projectPath,
          worktreePath,
          branch: `feature/${featureName}`,
          gitStats,
          isActive: true
        }
        
        this.logger.info('Successfully created session', {
          projectName,
          featureName,
          windowName
        })
        
        return session
      } catch (tmuxError) {
        // If tmux window creation fails, clean up the git worktree
        this.logger.warn('Tmux window creation failed, cleaning up git worktree', { errorMessage: (tmuxError as Error).message })
        
        try {
          await gitAdapter.removeWorktree(projectPath, featureName)
        } catch (cleanupError) {
          this.logger.error('Failed to cleanup git worktree after tmux failure', cleanupError)
        }
        
        throw tmuxError
      }
    } catch (error) {
      this.logger.error('Failed to create session', error, { projectPath, featureName })
      
      if (error instanceof SessionError || error instanceof ValidationError) {
        throw error
      }
      
      throw new SessionError(
        `Failed to create session for feature '${featureName}': ${(error as Error).message}`,
        `${gitAdapter.getProjectName(projectPath)}:${featureName}`
      )
    }
  }
  
  /**
   * Validate create session request
   */
  private validateCreateSessionRequest(request: CreateSessionRequest): void {
    const { projectPath, featureName } = request
    
    if (!projectPath || typeof projectPath !== 'string') {
      throw new ValidationError('Project path must be a non-empty string', 'projectPath', projectPath)
    }
    
    if (!featureName || typeof featureName !== 'string') {
      throw new ValidationError('Feature name must be a non-empty string', 'featureName', featureName)
    }
    
    // Validate feature name format (delegated to GitAdapter, but also check here for early validation)
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(featureName)) {
      throw new ValidationError(
        'Feature name must be lowercase, start and end with alphanumeric, and contain only alphanumeric and hyphens',
        'featureName',
        featureName
      )
    }
    
    if (featureName.length > 100) {
      throw new ValidationError(
        'Feature name must be 100 characters or less',
        'featureName',
        featureName
      )
    }
  }

  /**
   * Send a command to an existing session's tmux window
   */
  async sendCommand(projectName: string, featureName: string, command: string): Promise<void> {
    this.logger.debug('Sending command to session', { projectName, featureName, command })

    // Validate inputs
    if (!projectName || !featureName || !command) {
      throw new SessionError('Project name, feature name, and command are required')
    }

    // Generate window name in consistent format
    const windowName = `${projectName}:${featureName}`

    try {
      // Send command via tmux adapter
      await tmuxAdapter.sendCommand(windowName, command)
      
      this.logger.info('Successfully sent command to session', { 
        projectName, 
        featureName, 
        command,
        windowName 
      })
    } catch (error) {
      this.logger.error('Failed to send command to session', error, { 
        projectName, 
        featureName, 
        command 
      })
      
      if (error instanceof Error) {
        throw new SessionError(`Failed to send command: ${error.message}`)
      }
      
      throw new SessionError(`Failed to send command to session ${projectName}:${featureName}: ${(error as Error).message}`)
    }
  }

  /**
   * Delete a session with comprehensive cleanup and error handling
   */
  async deleteSession(projectName: string, featureName: string): Promise<void> {
    this.logger.debug('Deleting session', { projectName, featureName })
    
    // Validate inputs
    if (!projectName || !featureName) {
      throw new ValidationError('Project name and feature name are required')
    }
    
    const windowName = `${projectName}:${featureName}`
    
    try {
      this.logger.info('Deleting session', { projectName, featureName, windowName })
      
      // Get current session info
      const sessions = await this.listSessions()
      const session = sessions.find(s => s.projectName === projectName && s.featureName === featureName)
      
      if (!session) {
        this.logger.warn('Session not found, attempting cleanup anyway', { windowName })
        // Still try to clean up in case there are orphaned resources
      }
      
      const errors: Error[] = []
      
      // Try to get window info for path derivation
      let worktreePath: string | undefined
      let projectPath: string | undefined
      
      if (session) {
        worktreePath = session.worktreePath
        projectPath = session.projectPath
      } else {
        // Fallback: try to find the window
        const windows = await tmuxAdapter.listWindows()
        const window = windows.find(w => w.name === windowName)
        
        if (window) {
          const worktreesSuffix = `/.worktrees/${featureName}`
          if (window.panePath.endsWith(worktreesSuffix)) {
            worktreePath = window.panePath
            projectPath = window.panePath.slice(0, -worktreesSuffix.length)
          }
        }
      }
      
      // Clean up git worktree if we have the paths
      if (worktreePath && projectPath) {
        try {
          this.logger.debug('Rolling back git changes', { worktreePath })
          await gitAdapter.rollbackChanges(worktreePath)
          
          this.logger.debug('Removing git worktree', { projectPath, featureName })
          await gitAdapter.removeWorktree(projectPath, featureName)
        } catch (gitError) {
          this.logger.error('Failed to cleanup git resources', gitError, {
            projectPath,
            featureName,
            worktreePath
          })
          errors.push(gitError as Error)
        }
      } else {
        this.logger.warn('Could not determine worktree path, skipping git cleanup', {
          projectName,
          featureName
        })
      }

      // Kill tmux window
      try {
        this.logger.debug('Killing tmux window', { windowName })
        await tmuxAdapter.killWindow(windowName)
      } catch (tmuxError) {
        this.logger.error('Failed to kill tmux window', tmuxError, { windowName })
        errors.push(tmuxError as Error)
      }
      
      // If we had errors but some cleanup succeeded, warn about partial failure
      if (errors.length > 0) {
        const errorMessages = errors.map(e => e.message).join('; ')
        this.logger.warn('Session deletion completed with some errors', {
          windowName,
          errorMessages
        })
        
        // Throw the first error, but log that there were multiple issues
        throw new SessionError(
          `Failed to fully delete session '${windowName}': ${errorMessages}`,
          windowName
        )
      }
      
      this.logger.info('Successfully deleted session', { projectName, featureName, windowName })
    } catch (error) {
      this.logger.error('Failed to delete session', error, { projectName, featureName, windowName })
      
      if (error instanceof SessionError || error instanceof ValidationError) {
        throw error
      }
      
      throw new SessionError(
        `Failed to delete session '${windowName}': ${(error as Error).message}`,
        windowName
      )
    }
  }

  /**
   * Get terminal output for a session with enhanced error handling
   */
  async getSessionOutput(projectName: string, featureName: string, options?: {
    lines?: number;
    includeEscapes?: boolean;
  }): Promise<string> {
    this.logger.debug('Getting session output', { projectName, featureName, options })
    
    // Validate inputs
    if (!projectName || !featureName) {
      throw new ValidationError('Project name and feature name are required')
    }
    
    const windowName = `${projectName}:${featureName}`
    
    try {
      const output = await tmuxAdapter.capturePane(windowName, options)
      
      this.logger.debug('Successfully captured session output', {
        projectName,
        featureName,
        outputLength: output.length
      })
      
      return output
    } catch (error) {
      this.logger.error('Failed to get session output', error, {
        projectName,
        featureName,
        windowName
      })
      
      throw new SessionError(
        `Failed to get output for session '${windowName}': ${(error as Error).message}`,
        windowName
      )
    }
  }
  
  /**
   * Get session by project and feature name
   */
  async getSession(projectName: string, featureName: string): Promise<Session | null> {
    this.logger.debug('Getting session', { projectName, featureName })
    
    if (!projectName || !featureName) {
      throw new ValidationError('Project name and feature name are required')
    }
    
    try {
      const sessions = await this.listSessions()
      const session = sessions.find(s => s.projectName === projectName && s.featureName === featureName)
      
      if (session) {
        this.logger.debug('Found session', { projectName, featureName })
      } else {
        this.logger.debug('Session not found', { projectName, featureName })
      }
      
      return session || null
    } catch (error) {
      this.logger.error('Failed to get session', error, { projectName, featureName })
      throw new SessionError(
        `Failed to get session '${projectName}:${featureName}': ${(error as Error).message}`
      )
    }
  }
  
  /**
   * Check if a session exists
   */
  async sessionExists(projectName: string, featureName: string): Promise<boolean> {
    try {
      const session = await this.getSession(projectName, featureName)
      return session !== null
    } catch {
      return false
    }
  }

  /**
   * Collect comprehensive session metadata
   */
  private async collectSessionMetadata(session: Session): Promise<SessionMetadata> {
    const now = Date.now()
    
    // Check cache first
    const cacheKey = `${session.projectName}:${session.featureName}`
    const cached = this.metadataCache.get(cacheKey)
    
    if (cached && (now - cached.timestamp) < this.metadataCacheTimeout) {
      return cached.metadata
    }
    
    const metadata: SessionMetadata = {}
    
    try {
      // Get last activity from tmux pane
      const output = await tmuxAdapter.capturePane(
        `${session.projectName}:${session.featureName}`,
        { lines: 1 }
      )
      
      if (output.trim()) {
        // Rough estimate of last activity - in real implementation,
        // you might want to track this more precisely
        metadata.lastActivity = new Date()
      }
      
      // Get latest commit info
      try {
        const commitResult = await CommandExecutor.execute(
          'git log -1 --format="%H|%s|%an|%ci"',
          { cwd: session.worktreePath, timeout: 5000, suppressErrors: true }
        )
        
        if (commitResult.exitCode === 0 && commitResult.stdout.trim()) {
          const [hash, message, author, dateStr] = commitResult.stdout.trim().split('|')
          metadata.commitInfo = {
            hash: hash.substring(0, 7), // Short hash
            message: message || 'No message',
            author: author || 'Unknown',
            date: new Date(dateStr || Date.now())
          }
        }
      } catch (error) {
        this.logger.debug('Failed to get commit info', {
          worktreePath: session.worktreePath,
          error: (error as Error).message
        })
      }
      
      // Get recent output history (last 100 lines)
      try {
        const historyOutput = await tmuxAdapter.capturePane(
          `${session.projectName}:${session.featureName}`,
          { lines: 100 }
        )
        
        if (historyOutput.trim()) {
          metadata.outputHistory = historyOutput.split('\n').slice(-10) // Keep last 10 lines
        }
      } catch (error) {
        this.logger.debug('Failed to get output history', {
          sessionName: cacheKey,
          error: (error as Error).message
        })
      }
      
      // Cache the result
      this.metadataCache.set(cacheKey, {
        metadata,
        timestamp: now
      })
      
      return metadata
    } catch (error) {
      this.logger.warn('Failed to collect session metadata', {
        sessionName: cacheKey,
        error: (error as Error).message
      })
      
      return {}
    }
  }

  /**
   * Perform comprehensive session health check
   */
  private async performSessionHealthCheck(session: Session): Promise<SessionHealthCheck> {
    const issues: string[] = []
    let tmuxWindowExists = false
    let gitWorktreeValid = false
    let pathAccessible = false
    let branchValid = false
    
    try {
      // Check if tmux window exists
      const windows = await tmuxAdapter.listWindows()
      const windowName = `${session.projectName}:${session.featureName}`
      tmuxWindowExists = windows.some(w => w.name === windowName)
      
      if (!tmuxWindowExists) {
        issues.push('Tmux window does not exist')
      }
    } catch (error) {
      issues.push(`Failed to check tmux window: ${(error as Error).message}`)
    }
    
    try {
      // Check if paths are accessible
      await fs.access(session.projectPath)
      await fs.access(session.worktreePath)
      pathAccessible = true
    } catch (error) {
      pathAccessible = false
      issues.push('Project or worktree path is not accessible')
    }
    
    try {
      // Check if git worktree is valid
      const gitDirResult = await CommandExecutor.execute(
        'git rev-parse --git-dir',
        { cwd: session.worktreePath, timeout: 5000, suppressErrors: true }
      )
      
      gitWorktreeValid = gitDirResult.exitCode === 0
      if (!gitWorktreeValid) {
        issues.push('Git worktree is invalid or corrupted')
      }
    } catch (error) {
      issues.push(`Failed to validate git worktree: ${(error as Error).message}`)
    }
    
    try {
      // Check if branch exists and is valid
      const branchResult = await CommandExecutor.execute(
        'git rev-parse --verify HEAD',
        { cwd: session.worktreePath, timeout: 5000, suppressErrors: true }
      )
      
      branchValid = branchResult.exitCode === 0
      if (!branchValid) {
        issues.push('Branch is invalid or has no commits')
      }
    } catch (error) {
      issues.push(`Failed to validate branch: ${(error as Error).message}`)
    }
    
    const isHealthy = issues.length === 0 && tmuxWindowExists && gitWorktreeValid && pathAccessible && branchValid
    
    return {
      isHealthy,
      issues,
      tmuxWindowExists,
      gitWorktreeValid,
      pathAccessible,
      branchValid
    }
  }

  /**
   * Search sessions with advanced filtering and scoring
   */
  async searchSessions(options: {
    text?: string
    tags?: string[]
    sortBy?: 'name' | 'activity' | 'score'
    limit?: number
  }): Promise<SessionSearchResult[]> {
    const { text, tags, sortBy = 'score', limit = 50 } = options
    
    try {
      const sessions = await this.listSessions({ includeMetadata: true })
      const results: SessionSearchResult[] = []
      
      for (const session of sessions) {
        let matchScore = 0
        
        // Text matching
        if (text) {
          const searchText = text.toLowerCase()
          let textScore = 0
          
          // Project name match (high weight)
          if (session.projectName.toLowerCase().includes(searchText)) {
            textScore += 50
          }
          
          // Feature name match (high weight)
          if (session.featureName.toLowerCase().includes(searchText)) {
            textScore += 40
          }
          
          // Branch name match (medium weight)
          if (session.branch.toLowerCase().includes(searchText)) {
            textScore += 20
          }
          
          // Path match (low weight)
          if (session.projectPath.toLowerCase().includes(searchText) || 
              session.worktreePath.toLowerCase().includes(searchText)) {
            textScore += 10
          }
          
          matchScore += textScore
        } else {
          matchScore = 100 // No text filter, all sessions match
        }
        
        // Tag matching (if implemented)
        if (tags && tags.length > 0) {
          // This would require session tagging implementation
          // For now, skip tag filtering
        }
        
        // Only include sessions with some match
        if (matchScore > 0) {
          const metadata = await this.collectSessionMetadata(session)
          results.push({ session, metadata, matchScore })
        }
      }
      
      // Sort results
      results.sort((a, b) => {
        switch (sortBy) {
          case 'name':
            return a.session.projectName.localeCompare(b.session.projectName) ||
                   a.session.featureName.localeCompare(b.session.featureName)
          case 'activity':
            const aTime = a.metadata?.lastActivity?.getTime() || 0
            const bTime = b.metadata?.lastActivity?.getTime() || 0
            return bTime - aTime
          case 'score':
          default:
            return b.matchScore - a.matchScore
        }
      })
      
      return results.slice(0, limit)
    } catch (error) {
      this.logger.error('Failed to search sessions', error)
      throw new SessionError(`Failed to search sessions: ${(error as Error).message}`)
    }
  }

  /**
   * Get comprehensive session status information
   */
  async getSessionStatus(projectName: string, featureName: string): Promise<{
    exists: boolean
    isHealthy: boolean
    status: 'active' | 'idle' | 'ready-for-pr' | 'unhealthy' | 'not-found'
    session?: Session
    healthCheck?: SessionHealthCheck
    metadata?: SessionMetadata
  }> {
    try {
      const session = await this.getSession(projectName, featureName)
      
      if (!session) {
        return {
          exists: false,
          isHealthy: false,
          status: 'not-found'
        }
      }
      
      const healthCheck = await this.performSessionHealthCheck(session)
      const metadata = await this.collectSessionMetadata(session)
      
      if (!healthCheck.isHealthy) {
        return {
          exists: true,
          isHealthy: false,
          status: 'unhealthy',
          session,
          healthCheck,
          metadata
        }
      }
      
      // Determine status using utility function
      const status = SessionStatusAnalyzer.determineStatus(session, healthCheck, metadata)
      
      return {
        exists: true,
        isHealthy: true,
        status,
        session,
        healthCheck,
        metadata
      }
    } catch (error) {
      this.logger.error('Failed to get session status', error, { projectName, featureName })
      throw new SessionError(
        `Failed to get session status for '${projectName}:${featureName}': ${(error as Error).message}`
      )
    }
  }

  /**
   * Enhanced session creation with health check and auto-cleanup
   */
  async createSessionEnhanced(request: CreateSessionRequest): Promise<SessionOperationResult<Session>> {
    const { projectPath, featureName } = request
    this.logger.debug('Creating enhanced session', { projectPath, featureName })
    
    const warnings: string[] = []
    const metadata: Record<string, any> = {}
    
    try {
      // Validate inputs using safety validator
      const validation = SessionSafetyValidator.validateCreationParams(projectPath, featureName)
      if (!validation.valid) {
        throw new ValidationError(`Invalid session parameters: ${validation.errors.join(', ')}`)
      }
      
      // Add any warnings to our warnings list
      warnings.push(...validation.warnings)
      
      // Additional legacy validation
      this.validateCreateSessionRequest(request)
      
      const projectName = gitAdapter.getProjectName(projectPath)
      const windowName = `${projectName}:${featureName}`
      
      // Check if session already exists
      const existingSession = await this.getSession(projectName, featureName)
      
      if (existingSession) {
        // Check if existing session is healthy
        const healthCheck = await this.performSessionHealthCheck(existingSession)
        
        if (healthCheck.isHealthy) {
          return {
            success: false,
            error: `Healthy session already exists for '${projectName}:${featureName}'`,
            warnings: [],
            metadata: { existingSession: true }
          }
        } else {
          // Existing session is unhealthy, clean it up first
          warnings.push(`Found unhealthy existing session, cleaning up: ${healthCheck.issues.join(', ')}`)
          
          try {
            const cleanupResult = await this.deleteSessionEnhanced(projectName, featureName)
            if (!cleanupResult.success) {
              warnings.push(`Partial cleanup of unhealthy session: ${cleanupResult.error}`)
            }
            metadata.cleanedUpUnhealthySession = true
          } catch (cleanupError) {
            warnings.push(`Failed to cleanup unhealthy session: ${(cleanupError as Error).message}`)
          }
        }
      }
      
      // Ensure tmux session exists
      await tmuxAdapter.ensureSession()
      
      // Create git worktree
      const worktreePath = await gitAdapter.createWorktree(projectPath, featureName)
      metadata.worktreeCreated = true
      
      try {
        // Create tmux window
        await tmuxAdapter.createWindow(windowName, worktreePath)
        metadata.tmuxWindowCreated = true
        
        // Get initial git stats
        const gitStats = await gitAdapter.getStatus(worktreePath)
        
        const session: Session = {
          projectName,
          featureName,
          projectPath,
          worktreePath,
          branch: `feature/${featureName}`,
          gitStats,
          isActive: true
        }
        
        // Validate the created session
        const healthCheck = await this.performSessionHealthCheck(session)
        if (!healthCheck.isHealthy) {
          warnings.push(`Created session has health issues: ${healthCheck.issues.join(', ')}`)
        }
        
        this.logger.info('Successfully created enhanced session', {
          projectName,
          featureName,
          windowName,
          healthScore: healthCheck.isHealthy ? 'healthy' : 'unhealthy'
        })
        
        return {
          success: true,
          data: session,
          warnings,
          metadata
        }
      } catch (tmuxError) {
        // Rollback git worktree on tmux failure
        metadata.rollbackInitiated = true
        
        try {
          await gitAdapter.removeWorktree(projectPath, featureName)
          metadata.rollbackSucceeded = true
        } catch (rollbackError) {
          warnings.push(`Failed to rollback git worktree: ${(rollbackError as Error).message}`)
          metadata.rollbackFailed = true
        }
        
        throw tmuxError
      }
    } catch (error) {
      this.logger.error('Failed to create enhanced session', error, { projectPath, featureName })
      
      return {
        success: false,
        error: `Failed to create session for '${featureName}': ${(error as Error).message}`,
        warnings,
        metadata
      }
    }
  }

  /**
   * Enhanced session deletion with partial failure recovery
   */
  async deleteSessionEnhanced(projectName: string, featureName: string): Promise<SessionOperationResult> {
    this.logger.debug('Deleting enhanced session', { projectName, featureName })
    
    const warnings: string[] = []
    const metadata: Record<string, any> = { operationsCompleted: 0, operationsFailed: 0 }
    
    // Validate inputs
    if (!projectName || !featureName) {
      return {
        success: false,
        error: 'Project name and feature name are required',
        warnings: [],
        metadata
      }
    }
    
    const windowName = `${projectName}:${featureName}`
    
    try {
      // Get session info (if it exists)
      const session = await this.getSession(projectName, featureName)
      let worktreePath: string | undefined
      let projectPath: string | undefined
      
      if (session) {
        worktreePath = session.worktreePath
        projectPath = session.projectPath
        metadata.sessionFound = true
      } else {
        // Try to detect orphaned resources
        const orphanedSession = await this.detectOrphanedSession(projectName, featureName)
        if (orphanedSession) {
          worktreePath = orphanedSession.worktreePath
          projectPath = orphanedSession.projectPath
          warnings.push('Found orphaned resources for cleanup')
          metadata.orphanedResourcesFound = true
        }
      }
      
      const operations: Array<{ name: string; operation: () => Promise<void> }> = []
      
      // Add git cleanup operations
      if (worktreePath && projectPath) {
        operations.push({
          name: 'rollback-changes',
          operation: () => gitAdapter.rollbackChanges(worktreePath!)
        })
        
        operations.push({
          name: 'remove-worktree',
          operation: () => gitAdapter.removeWorktree(projectPath!, featureName)
        })
      }
      
      // Add tmux cleanup operation
      operations.push({
        name: 'kill-window',
        operation: () => tmuxAdapter.killWindow(windowName)
      })
      
      // Execute operations with error tracking
      const results = await Promise.allSettled(
        operations.map(async ({ name, operation }) => {
          try {
            await operation()
            metadata.operationsCompleted++
            return { name, success: true }
          } catch (error) {
            metadata.operationsFailed++
            warnings.push(`Failed ${name}: ${(error as Error).message}`)
            return { name, success: false, error }
          }
        })
      )
      
      const failedOperations = results.filter((result, index) => 
        result.status === 'rejected' || 
        (result.status === 'fulfilled' && !result.value.success)
      )
      
      if (failedOperations.length === 0) {
        this.logger.info('Successfully deleted session', { projectName, featureName, windowName })
        return {
          success: true,
          warnings,
          metadata
        }
      } else if (failedOperations.length < operations.length) {
        // Partial success
        const errorMessages = warnings.join('; ')
        
        return {
          success: false,
          error: `Partial deletion failure: ${errorMessages}`,
          warnings,
          metadata: { ...metadata, partialSuccess: true }
        }
      } else {
        // Complete failure
        const errorMessages = warnings.join('; ')
        
        return {
          success: false,
          error: `Failed to delete session '${windowName}': ${errorMessages}`,
          warnings,
          metadata
        }
      }
    } catch (error) {
      this.logger.error('Failed to delete enhanced session', error, { projectName, featureName })
      
      return {
        success: false,
        error: `Failed to delete session '${windowName}': ${(error as Error).message}`,
        warnings,
        metadata
      }
    }
  }

  /**
   * Detect orphaned sessions (tmux windows without proper session tracking)
   */
  private async detectOrphanedSession(projectName: string, featureName: string): Promise<Session | null> {
    try {
      const windowName = `${projectName}:${featureName}`
      const windows = await tmuxAdapter.listWindows()
      const orphanedWindow = windows.find(w => w.name === windowName)
      
      if (!orphanedWindow) {
        return null
      }
      
      // Try to parse paths from the orphaned window
      const pathInfo = await this.deriveProjectPaths(orphanedWindow.panePath, featureName)
      if (!pathInfo) {
        return null
      }
      
      const { projectPath, worktreePath } = pathInfo
      
      try {
        // Get git stats if possible
        const gitStats = await gitAdapter.getStatus(worktreePath)
        
        return {
          projectName,
          featureName,
          projectPath,
          worktreePath,
          branch: `feature/${featureName}`,
          gitStats,
          isActive: false // Mark as inactive since it's orphaned
        }
      } catch {
        // Return minimal session info for cleanup
        return {
          projectName,
          featureName,
          projectPath,
          worktreePath,
          branch: `feature/${featureName}`,
          gitStats: {
            branch: 'unknown',
            ahead: 0,
            behind: 0,
            staged: 0,
            unstaged: 0,
            untracked: 0,
            hasUncommittedChanges: false
          },
          isActive: false
        }
      }
    } catch (error) {
      this.logger.debug('Failed to detect orphaned session', {
        projectName,
        featureName,
        error: (error as Error).message
      })
      return null
    }
  }

  /**
   * Stream session output with real-time updates
   */
  async streamSessionOutput(
    projectName: string, 
    featureName: string,
    callback: (output: string) => void,
    options: { 
      interval?: number
      maxLines?: number
      includeEscapes?: boolean 
    } = {}
  ): Promise<() => void> {
    const { interval = 1000, maxLines = 100, includeEscapes = false } = options
    const windowName = `${projectName}:${featureName}`
    
    let isStreaming = true
    let lastOutput = ''
    
    const streamLoop = async () => {
      while (isStreaming) {
        try {
          const currentOutput = await tmuxAdapter.capturePane(windowName, {
            lines: maxLines,
            includeEscapes
          })
          
          if (currentOutput !== lastOutput) {
            callback(currentOutput)
            lastOutput = currentOutput
          }
        } catch (error) {
          this.logger.warn('Failed to capture pane output during streaming', {
            windowName,
            error: (error as Error).message
          })
        }
        
        if (isStreaming) {
          await new Promise(resolve => setTimeout(resolve, interval))
        }
      }
    }
    
    streamLoop()
    
    // Return stop function
    return () => {
      isStreaming = false
    }
  }

  /**
   * Clear all caches (useful for testing or forced refresh)
   */
  clearAllCaches(): void {
    this.sessionCache.clear()
    this.metadataCache.clear()
    this.logger.debug('Cleared all SessionManager caches')
  }

  /**
   * Get comprehensive cache statistics for monitoring
   */
  getCacheStats(): {
    sessionCacheSize: number
    metadataCacheSize: number
    oldestSessionCacheEntry?: number
    oldestMetadataCacheEntry?: number
    performance?: Record<string, any>
  } {
    let oldestSessionCache: number | undefined
    let oldestMetadataCache: number | undefined
    
    for (const entry of Array.from(this.sessionCache.values())) {
      if (!oldestSessionCache || entry.timestamp < oldestSessionCache) {
        oldestSessionCache = entry.timestamp
      }
    }
    
    for (const entry of Array.from(this.metadataCache.values())) {
      if (!oldestMetadataCache || entry.timestamp < oldestMetadataCache) {
        oldestMetadataCache = entry.timestamp
      }
    }
    
    return {
      sessionCacheSize: this.sessionCache.size,
      metadataCacheSize: this.metadataCache.size,
      oldestSessionCacheEntry: oldestSessionCache,
      oldestMetadataCacheEntry: oldestMetadataCache,
      performance: SessionPerformanceMonitor.getAllMetrics()
    }
  }

  /**
   * Optimize cache by removing stale entries
   */
  optimizeCache(): { removedSessions: number; removedMetadata: number } {
    const now = Date.now()
    let removedSessions = 0
    let removedMetadata = 0
    
    // Remove stale session cache entries
    for (const [key, entry] of Array.from(this.sessionCache.entries())) {
      if (now - entry.timestamp > this.cacheTimeout * 2) { // 2x timeout for cleanup
        this.sessionCache.delete(key)
        removedSessions++
      }
    }
    
    // Remove stale metadata cache entries
    for (const [key, entry] of Array.from(this.metadataCache.entries())) {
      if (now - entry.timestamp > this.metadataCacheTimeout * 2) { // 2x timeout for cleanup
        this.metadataCache.delete(key)
        removedMetadata++
      }
    }
    
    this.logger.debug('Optimized cache', { removedSessions, removedMetadata })
    return { removedSessions, removedMetadata }
  }

  /**
   * Get system health report including session health
   */
  async getSystemHealthReport(): Promise<{
    totalSessions: number
    healthySessions: number
    unhealthySessions: number
    orphanedResources: number
    cacheEfficiency: number
    performanceMetrics: Record<string, any>
    issues: string[]
  }> {
    const sessions = await this.listSessions({ includeMetadata: true })
    const issues: string[] = []
    let healthySessions = 0
    let unhealthySessions = 0
    let orphanedResources = 0
    
    // Check health of all sessions
    for (const session of sessions) {
      try {
        const healthCheck = await this.performSessionHealthCheck(session)
        if (healthCheck.isHealthy) {
          healthySessions++
        } else {
          unhealthySessions++
          issues.push(`Unhealthy session ${session.projectName}:${session.featureName}: ${healthCheck.issues.join(', ')}`)
        }
      } catch (error) {
        unhealthySessions++
        issues.push(`Health check failed for ${session.projectName}:${session.featureName}: ${(error as Error).message}`)
      }
    }
    
    // Check for orphaned tmux windows
    try {
      const allWindows = await tmuxAdapter.listWindows()
      const sessionWindows = new Set(sessions.map(s => `${s.projectName}:${s.featureName}`))
      
      for (const window of allWindows) {
        if (window.name.includes(':') && !sessionWindows.has(window.name)) {
          orphanedResources++
          issues.push(`Orphaned tmux window: ${window.name}`)
        }
      }
    } catch (error) {
      issues.push(`Failed to check for orphaned resources: ${(error as Error).message}`)
    }
    
    // Calculate cache efficiency (rough estimate)
    const cacheStats = this.getCacheStats()
    const cacheEfficiency = cacheStats.sessionCacheSize > 0 
      ? Math.min((cacheStats.sessionCacheSize / Math.max(sessions.length, 1)) * 100, 100)
      : 0
    
    return {
      totalSessions: sessions.length,
      healthySessions,
      unhealthySessions,
      orphanedResources,
      cacheEfficiency,
      performanceMetrics: SessionPerformanceMonitor.getAllMetrics(),
      issues
    }
  }

  /**
   * Batch process multiple sessions efficiently
   */
  async batchProcessSessions<T>(
    sessionIds: Array<{ projectName: string; featureName: string }>,
    processor: (session: Session) => Promise<T>,
    options: { concurrency?: number; failFast?: boolean } = {}
  ): Promise<Array<{ success: boolean; data?: T; error?: string; sessionId: string }>> {
    const { concurrency = this.maxConcurrentOperations, failFast = false } = options
    
    return SessionPerformanceMonitor.timeOperation('batch-process-sessions', async () => {
      const results: Array<{ success: boolean; data?: T; error?: string; sessionId: string }> = []
      
      // Get all sessions first
      const sessions = await this.listSessions()
      const sessionMap = new Map<string, Session>()
      
      for (const session of sessions) {
        const key = `${session.projectName}:${session.featureName}`
        sessionMap.set(key, session)
      }
      
      // Process in batches
      const batches = []
      for (let i = 0; i < sessionIds.length; i += concurrency) {
        batches.push(sessionIds.slice(i, i + concurrency))
      }
      
      for (const batch of batches) {
        const batchPromises = batch.map(async (sessionId) => {
          const key = `${sessionId.projectName}:${sessionId.featureName}`
          const session = sessionMap.get(key)
          
          if (!session) {
            return {
              success: false,
              error: 'Session not found',
              sessionId: key
            }
          }
          
          try {
            const data = await processor(session)
            return {
              success: true,
              data,
              sessionId: key
            }
          } catch (error) {
            const result = {
              success: false,
              error: (error as Error).message,
              sessionId: key
            }
            
            if (failFast) {
              throw error
            }
            
            return result
          }
        })
        
        const batchResults = await Promise.all(batchPromises)
        results.push(...batchResults)
      }
      
      return results
    })
  }
}

// Export singleton instance
export const sessionManager = new SessionManager()