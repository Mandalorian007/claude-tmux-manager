/**
 * WindowManager - A compatibility layer over SessionManager
 * 
 * This provides the new Window-based terminology while using the existing SessionManager implementation.
 * As the project migrates from "Sessions" to "Windows", this provides a clean interface.
 */

import { SessionManager } from './SessionManager'
import type { 
  WorkspaceWindow, 
  CreateWindowRequest
} from '@/types'
import type {
  WindowFilter,
  WindowSearchOptions,
  WindowOperationResult,
  WindowStatusInfo,
  WindowSearchResult,
  WindowHealthCheck,
  WindowMetadata
} from '@/types/index'

// Create a singleton instance of SessionManager to use as WindowManager
class WindowManagerImpl extends SessionManager {
  // All the methods from SessionManager are inherited and work with the Window types
  // due to the type aliases in types.ts (Session = WorkspaceWindow, etc.)
  
  constructor() {
    super()
  }

  // Override methods to use proper Window terminology in logging
  async listWindows(options?: { 
    useCache?: boolean; 
    includeMetadata?: boolean; 
    filter?: WindowFilter 
  }): Promise<WorkspaceWindow[]> {
    // Map WindowFilter to SessionFilter for compatibility
    const sessionOptions = options ? {
      ...options,
      filter: options.filter ? {
        projectName: options.filter.projectName,
        featureName: options.filter.featureName,
        hasUncommittedChanges: options.filter.hasUncommittedChanges,
        isActive: options.filter.isActive,
        branchPattern: options.filter.branchPattern,
        status: options.filter.status,
        lastActivityBefore: options.filter.lastActivityBefore,
        lastActivityAfter: options.filter.lastActivityAfter
      } : undefined
    } : undefined

    return this.listSessions(sessionOptions)
  }

  async createWindow(request: CreateWindowRequest): Promise<WorkspaceWindow> {
    return this.createSession(request)
  }

  async createWindowEnhanced(request: CreateWindowRequest): Promise<WindowOperationResult<WorkspaceWindow>> {
    return this.createSessionEnhanced(request)
  }

  async searchWindows(options: WindowSearchOptions): Promise<WindowSearchResult[]> {
    const sessionResults = await this.searchSessions(options)
    // Map SessionSearchResult to WindowSearchResult 
    return sessionResults.map(result => ({
      window: result.session, // session is an alias for WorkspaceWindow
      metadata: result.metadata,
      matchScore: result.matchScore
    }))
  }

  async getWindowStatus(projectName: string, featureName: string): Promise<WindowStatusInfo> {
    return this.getSessionStatus(projectName, featureName)
  }

  async deleteWindow(projectName: string, featureName: string): Promise<WindowOperationResult> {
    try {
      await this.deleteSession(projectName, featureName)
      return {
        success: true,
        warnings: []
      }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        warnings: []
      }
    }
  }

  async healthCheckWindow(projectName: string, featureName: string): Promise<WindowHealthCheck> {
    // Find the session/window first
    const sessions = await this.listSessions()
    const session = sessions.find(s => s.projectName === projectName && s.featureName === featureName)
    
    if (!session) {
      throw new Error(`Window not found: ${projectName}:${featureName}`)
    }
    
    // Use the private method via any cast for now - this should be refactored
    return (this as any).performSessionHealthCheck(session)
  }
}

// Export singleton instance
export const windowManager = new WindowManagerImpl()
export type WindowManager = WindowManagerImpl