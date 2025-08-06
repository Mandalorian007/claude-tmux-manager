/**
 * Utility functions for session management and operations
 */

import type { Session } from '@/types'
import type { SessionHealthCheck, SessionMetadata } from '@/lib/managers/SessionManager'
import { logger } from '@/lib/logger'

/**
 * Session status determination based on git stats and metadata
 */
export class SessionStatusAnalyzer {
  private static logger = logger.createChild({ component: 'SessionStatusAnalyzer' })

  /**
   * Determine session status based on various factors
   */
  static determineStatus(
    session: Session, 
    healthCheck: SessionHealthCheck, 
    metadata?: SessionMetadata
  ): 'active' | 'idle' | 'ready-for-pr' | 'unhealthy' {
    // First check health
    if (!healthCheck.isHealthy) {
      return 'unhealthy'
    }

    const { gitStats } = session
    const lastActivity = metadata?.lastActivity
    const now = Date.now()
    
    // Ready for PR: commits ahead and no uncommitted changes
    if (gitStats.ahead > 0 && !gitStats.hasUncommittedChanges) {
      return 'ready-for-pr'
    }
    
    // Active: has uncommitted changes OR recent activity (last hour)
    if (gitStats.hasUncommittedChanges || 
        (lastActivity && now - lastActivity.getTime() < 3600000)) {
      return 'active'
    }
    
    // Default to idle
    return 'idle'
  }

  /**
   * Calculate a health score (0-100) for a session
   */
  static calculateHealthScore(healthCheck: SessionHealthCheck): number {
    let score = 0
    const totalChecks = 4 // Number of boolean health checks

    if (healthCheck.tmuxWindowExists) score += 25
    if (healthCheck.gitWorktreeValid) score += 25
    if (healthCheck.pathAccessible) score += 25
    if (healthCheck.branchValid) score += 25

    return score
  }

  /**
   * Get session priority for cleanup operations
   * Higher score = higher priority to keep
   */
  static getSessionPriority(
    session: Session, 
    metadata?: SessionMetadata
  ): number {
    let priority = 0

    // Recent activity boosts priority
    if (metadata?.lastActivity) {
      const daysSinceActivity = (Date.now() - metadata.lastActivity.getTime()) / (1000 * 60 * 60 * 24)
      if (daysSinceActivity < 1) priority += 50
      else if (daysSinceActivity < 7) priority += 25
      else if (daysSinceActivity < 30) priority += 10
    }

    // Uncommitted changes boost priority
    if (session.gitStats.hasUncommittedChanges) {
      priority += 30
    }

    // Commits ahead boost priority
    if (session.gitStats.ahead > 0) {
      priority += Math.min(session.gitStats.ahead * 5, 25)
    }

    // Active status boosts priority
    if (session.isActive) {
      priority += 20
    }

    return Math.min(priority, 100) // Cap at 100
  }
}

/**
 * Path validation and normalization utilities
 */
export class PathValidator {
  private static logger = logger.createChild({ component: 'PathValidator' })

  /**
   * Validate that a path follows expected patterns
   */
  static validateWorktreePath(worktreePath: string, featureName: string): boolean {
    // Should end with /.worktrees/feature-name
    const expectedSuffix = `/.worktrees/${featureName}`
    return worktreePath.endsWith(expectedSuffix)
  }

  /**
   * Validate project path structure
   */
  static validateProjectPath(projectPath: string): boolean {
    // Basic validation - not a system directory, reasonable length
    if (projectPath.length < 3 || projectPath.length > 500) {
      return false
    }

    const systemPaths = ['/bin', '/usr', '/var', '/etc', '/tmp', '/root', '/dev', '/proc']
    const normalizedPath = projectPath.toLowerCase()
    
    return !systemPaths.some(sysPath => 
      normalizedPath === sysPath || normalizedPath.startsWith(sysPath + '/')
    )
  }

  /**
   * Extract project name from various path formats
   */
  static extractProjectName(projectPath: string): string | null {
    try {
      // Handle various path formats
      const normalized = projectPath.replace(/\/$/, '') // Remove trailing slash
      const parts = normalized.split('/')
      const projectName = parts[parts.length - 1]
      
      if (!projectName || projectName === '.' || projectName === '..') {
        return null
      }
      
      return projectName
    } catch {
      return null
    }
  }

  /**
   * Normalize paths for consistent comparison
   */
  static normalizePath(inputPath: string): string {
    return inputPath
      .replace(/\/+/g, '/') // Replace multiple slashes with single
      .replace(/\/$/, '') // Remove trailing slash
      .trim()
  }
}

/**
 * Session search and filtering utilities
 */
export class SessionSearchUtil {
  private static logger = logger.createChild({ component: 'SessionSearchUtil' })

  /**
   * Calculate text match score for a session
   */
  static calculateTextMatchScore(session: Session, searchText: string): number {
    if (!searchText) return 100 // No filter = perfect match

    const text = searchText.toLowerCase()
    let score = 0

    // Exact matches get highest scores
    if (session.projectName.toLowerCase() === text) score += 100
    if (session.featureName.toLowerCase() === text) score += 90
    
    // Partial matches
    if (session.projectName.toLowerCase().includes(text)) score += 50
    if (session.featureName.toLowerCase().includes(text)) score += 40
    if (session.branch.toLowerCase().includes(text)) score += 20
    
    // Path matches (lower priority)
    if (session.projectPath.toLowerCase().includes(text)) score += 10
    if (session.worktreePath.toLowerCase().includes(text)) score += 10

    return Math.min(score, 100) // Cap at 100
  }

  /**
   * Filter sessions based on complex criteria
   */
  static filterSessions(
    sessions: Session[], 
    filter: {
      projectName?: string
      featureName?: string
      hasUncommittedChanges?: boolean
      isActive?: boolean
      branchPattern?: RegExp
      status?: string
      lastActivityBefore?: Date
      lastActivityAfter?: Date
    },
    metadata?: Map<string, SessionMetadata>
  ): Session[] {
    return sessions.filter(session => {
      // Project name filter
      if (filter.projectName && !session.projectName.includes(filter.projectName)) {
        return false
      }

      // Feature name filter
      if (filter.featureName && !session.featureName.includes(filter.featureName)) {
        return false
      }

      // Uncommitted changes filter
      if (filter.hasUncommittedChanges !== undefined && 
          session.gitStats.hasUncommittedChanges !== filter.hasUncommittedChanges) {
        return false
      }

      // Active filter
      if (filter.isActive !== undefined && session.isActive !== filter.isActive) {
        return false
      }

      // Branch pattern filter
      if (filter.branchPattern && !filter.branchPattern.test(session.branch)) {
        return false
      }

      // Activity date filters
      if (metadata && (filter.lastActivityBefore || filter.lastActivityAfter)) {
        const sessionKey = `${session.projectName}:${session.featureName}`
        const sessionMetadata = metadata.get(sessionKey)
        const lastActivity = sessionMetadata?.lastActivity

        if (filter.lastActivityBefore && lastActivity && lastActivity > filter.lastActivityBefore) {
          return false
        }

        if (filter.lastActivityAfter && lastActivity && lastActivity < filter.lastActivityAfter) {
          return false
        }
      }

      return true
    })
  }

  /**
   * Sort sessions by various criteria
   */
  static sortSessions(
    sessions: Session[], 
    sortBy: 'name' | 'activity' | 'score' | 'health' | 'priority',
    metadata?: Map<string, SessionMetadata>,
    ascending: boolean = false
  ): Session[] {
    const sorted = [...sessions].sort((a, b) => {
      let comparison = 0

      switch (sortBy) {
        case 'name':
          comparison = a.projectName.localeCompare(b.projectName) ||
                      a.featureName.localeCompare(b.featureName)
          break

        case 'activity':
          const aTime = metadata?.get(`${a.projectName}:${a.featureName}`)?.lastActivity?.getTime() || 0
          const bTime = metadata?.get(`${b.projectName}:${b.featureName}`)?.lastActivity?.getTime() || 0
          comparison = bTime - aTime // Most recent first by default
          break

        case 'priority':
          const aPriority = SessionStatusAnalyzer.getSessionPriority(
            a, 
            metadata?.get(`${a.projectName}:${a.featureName}`)
          )
          const bPriority = SessionStatusAnalyzer.getSessionPriority(
            b, 
            metadata?.get(`${b.projectName}:${b.featureName}`)
          )
          comparison = bPriority - aPriority // Higher priority first
          break

        default:
          comparison = 0
      }

      return ascending ? comparison : -comparison
    })

    return sorted
  }
}

/**
 * Session operation validation and safety checks
 */
export class SessionSafetyValidator {
  private static logger = logger.createChild({ component: 'SessionSafetyValidator' })

  /**
   * Validate that a session can be safely deleted
   */
  static async validateSafeDeletion(session: Session): Promise<{
    safe: boolean
    warnings: string[]
    blockingIssues: string[]
  }> {
    const warnings: string[] = []
    const blockingIssues: string[] = []

    // Check for uncommitted changes
    if (session.gitStats.hasUncommittedChanges) {
      warnings.push(`Session has ${session.gitStats.staged + session.gitStats.unstaged + session.gitStats.untracked} uncommitted changes`)
    }

    // Check for unpushed commits
    if (session.gitStats.ahead > 0) {
      warnings.push(`Session has ${session.gitStats.ahead} unpushed commits`)
    }

    // Check if session is currently active (could have running processes)
    if (session.isActive) {
      warnings.push('Session appears to be active and may have running processes')
    }

    const safe = blockingIssues.length === 0
    return { safe, warnings, blockingIssues }
  }

  /**
   * Validate session creation parameters
   */
  static validateCreationParams(projectPath: string, featureName: string): {
    valid: boolean
    errors: string[]
    warnings: string[]
  } {
    const errors: string[] = []
    const warnings: string[] = []

    // Validate project path
    if (!PathValidator.validateProjectPath(projectPath)) {
      errors.push('Invalid project path format')
    }

    // Validate feature name format
    const featureNameRegex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/
    if (!featureNameRegex.test(featureName)) {
      errors.push('Feature name must be lowercase kebab-case')
    }

    if (featureName.length > 100) {
      errors.push('Feature name too long (max 100 characters)')
    }

    // Check for reserved names
    const reservedNames = ['main', 'master', 'dev', 'develop', 'staging', 'production']
    if (reservedNames.includes(featureName)) {
      errors.push(`Feature name '${featureName}' is reserved`)
    }

    const valid = errors.length === 0
    return { valid, errors, warnings }
  }
}

/**
 * Performance monitoring for session operations
 */
export class SessionPerformanceMonitor {
  private static metrics: Map<string, Array<{ timestamp: number; duration: number }>> = new Map()
  private static logger = logger.createChild({ component: 'SessionPerformanceMonitor' })

  /**
   * Record operation timing
   */
  static recordOperation(operation: string, durationMs: number): void {
    const timestamp = Date.now()
    
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, [])
    }
    
    const operations = this.metrics.get(operation)!
    operations.push({ timestamp, duration: durationMs })
    
    // Keep only last 100 operations
    if (operations.length > 100) {
      operations.shift()
    }
  }

  /**
   * Get performance statistics for an operation
   */
  static getOperationStats(operation: string): {
    count: number
    averageDuration: number
    minDuration: number
    maxDuration: number
    recentAverage: number // Last 10 operations
  } | null {
    const operations = this.metrics.get(operation)
    if (!operations || operations.length === 0) {
      return null
    }

    const durations = operations.map(op => op.duration)
    const recentDurations = durations.slice(-10)

    return {
      count: operations.length,
      averageDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      recentAverage: recentDurations.reduce((sum, d) => sum + d, 0) / recentDurations.length
    }
  }

  /**
   * Time an operation and record its performance
   */
  static async timeOperation<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    const startTime = Date.now()
    
    try {
      const result = await fn()
      const duration = Date.now() - startTime
      this.recordOperation(operation, duration)
      return result
    } catch (error) {
      const duration = Date.now() - startTime
      this.recordOperation(`${operation}-error`, duration)
      throw error
    }
  }

  /**
   * Get all performance metrics
   */
  static getAllMetrics(): Record<string, ReturnType<typeof SessionPerformanceMonitor.getOperationStats>> {
    const result: Record<string, any> = {}
    
    for (const operation of Array.from(this.metrics.keys())) {
      result[operation] = this.getOperationStats(operation)
    }
    
    return result
  }
}