import { NextRequest, NextResponse } from 'next/server'
import { sessionManager } from '@/lib/managers/SessionManager'
import { SessionError, ValidationError, TmuxError, GitError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import type { SessionStatusInfo, SessionOperationResult } from '@/types'
import type { SessionHealthCheck, SessionMetadata } from '@/lib/managers/SessionManager'

const requestLogger = logger.createChild({ component: 'SessionAPI' })

interface RouteParams {
  params: Promise<{
    project: string
    feature: string
  }>
}

function validateParams(project: string, feature: string) {
  if (!project || typeof project !== 'string') {
    throw new ValidationError('Project name is required', 'project', project)
  }
  
  if (!feature || typeof feature !== 'string') {
    throw new ValidationError('Feature name is required', 'feature', feature)
  }
  
  // URL decode parameters
  const decodedProject = decodeURIComponent(project)
  const decodedFeature = decodeURIComponent(feature)
  
  // Basic validation
  if (decodedProject.length > 100 || decodedFeature.length > 100) {
    throw new ValidationError('Project or feature name too long', 'params', { project: decodedProject, feature: decodedFeature })
  }
  
  return { projectName: decodedProject, featureName: decodedFeature }
}

function getErrorStatusCode(error: Error): number {
  if (error instanceof ValidationError) return 400
  if (error instanceof SessionError) return 404
  if (error instanceof TmuxError || error instanceof GitError) return 503
  return 500
}

// GET /api/sessions/[project]/[feature] - Get session details
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const startTime = Date.now()
  const requestId = crypto.randomUUID()
  
  try {
    const resolvedParams = await params
    const { projectName, featureName } = validateParams(resolvedParams.project, resolvedParams.feature)
    
    requestLogger.info('GET /api/sessions/[project]/[feature]', {
      requestId,
      projectName,
      featureName
    })
    
    const includeHealth = request.nextUrl.searchParams.get('includeHealth') === 'true'
    const includeMetadata = request.nextUrl.searchParams.get('includeMetadata') === 'true'
    
    let response: SessionStatusInfo
    
    if (includeHealth) {
      // Get comprehensive status information
      response = await sessionManager.getSessionStatus(projectName, featureName)
    } else {
      // Get basic session info
      const session = await sessionManager.getSession(projectName, featureName)
      response = {
        exists: session !== null,
        isHealthy: true, // Assume healthy if no health check requested
        status: session ? 'active' : 'not-found',
        session: session || undefined
      }
      
      if (includeMetadata && session) {
        // Add metadata if requested
        response.metadata = await (sessionManager as any).collectSessionMetadata(session)
      }
    }
    
    const duration = Date.now() - startTime
    
    const headers = new Headers()
    headers.set('Cache-Control', 'public, max-age=5, stale-while-revalidate=15')
    headers.set('X-Response-Time', `${duration}ms`)
    headers.set('X-Request-Id', requestId)
    
    const responseWithMeta = {
      ...response,
      meta: {
        duration,
        requestId
      }
    }
    
    requestLogger.info('GET /api/sessions/[project]/[feature] completed', {
      requestId,
      projectName,
      featureName,
      exists: response.exists,
      duration
    })
    
    return NextResponse.json(responseWithMeta, { 
      status: response.exists ? 200 : 404, 
      headers 
    })
  } catch (error) {
    const duration = Date.now() - startTime
    const statusCode = getErrorStatusCode(error as Error)
    const resolvedParams = await params
    
    requestLogger.error('GET /api/sessions/[project]/[feature] failed', error, {
      requestId,
      project: resolvedParams.project,
      feature: resolvedParams.feature,
      duration
    })
    
    const headers = new Headers()
    headers.set('X-Response-Time', `${duration}ms`)
    headers.set('X-Request-Id', requestId)
    
    return NextResponse.json(
      { 
        error: (error as Error).message || 'Failed to get session',
        code: (error as Error).name || 'UnknownError',
        requestId
      },
      { status: statusCode, headers }
    )
  }
}

// DELETE /api/sessions/[project]/[feature] - Delete session with enhanced cleanup
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  const startTime = Date.now()
  const requestId = crypto.randomUUID()
  
  try {
    const resolvedParams = await params
    const { projectName, featureName } = validateParams(resolvedParams.project, resolvedParams.feature)
    
    requestLogger.info('DELETE /api/sessions/[project]/[feature]', {
      requestId,
      projectName,
      featureName
    })
    
    // Check for enhanced deletion mode
    const useEnhanced = request.nextUrl.searchParams.get('enhanced') === 'true'
    const force = request.nextUrl.searchParams.get('force') === 'true'
    
    // Safety check unless force is specified
    if (!force) {
      const session = await sessionManager.getSession(projectName, featureName)
      if (session) {
        const safetyCheck = await (sessionManager as any).performSessionHealthCheck(session)
        if (session.gitStats.hasUncommittedChanges && session.gitStats.ahead === 0) {
          requestLogger.warn('Refusing to delete session with uncommitted changes', {
            projectName,
            featureName,
            uncommittedChanges: session.gitStats.staged + session.gitStats.unstaged + session.gitStats.untracked
          })
          
          return NextResponse.json(
            {
              error: 'Session has uncommitted changes. Use force=true to delete anyway or commit/stash changes first.',
              code: 'UNCOMMITTED_CHANGES',
              details: {
                staged: session.gitStats.staged,
                unstaged: session.gitStats.unstaged,
                untracked: session.gitStats.untracked
              },
              requestId
            },
            { status: 409 }
          )
        }
      }
    }
    
    let result: SessionOperationResult
    
    if (useEnhanced) {
      result = await sessionManager.deleteSessionEnhanced(projectName, featureName)
    } else {
      try {
        await sessionManager.deleteSession(projectName, featureName)
        result = {
          success: true,
          warnings: []
        }
      } catch (error) {
        result = {
          success: false,
          error: (error as Error).message,
          warnings: []
        }
      }
    }
    
    const duration = Date.now() - startTime
    const statusCode = result.success ? 200 : getErrorStatusCode(new Error(result.error))
    
    const headers = new Headers()
    headers.set('X-Response-Time', `${duration}ms`)
    headers.set('X-Request-Id', requestId)
    
    const response = {
      success: result.success,
      error: result.error,
      warnings: result.warnings,
      metadata: result.metadata,
      meta: {
        duration,
        requestId,
        enhanced: useEnhanced,
        forced: force
      }
    }
    
    requestLogger.info('DELETE /api/sessions/[project]/[feature] completed', {
      requestId,
      projectName,
      featureName,
      success: result.success,
      duration
    })
    
    return NextResponse.json(response, { status: statusCode, headers })
  } catch (error) {
    const duration = Date.now() - startTime
    const statusCode = getErrorStatusCode(error as Error)
    const resolvedParams = await params
    
    requestLogger.error('DELETE /api/sessions/[project]/[feature] failed', error, {
      requestId,
      project: resolvedParams.project,
      feature: resolvedParams.feature,
      duration
    })
    
    const headers = new Headers()
    headers.set('X-Response-Time', `${duration}ms`)
    headers.set('X-Request-Id', requestId)
    
    return NextResponse.json(
      { 
        success: false,
        error: (error as Error).message || 'Failed to delete session',
        code: (error as Error).name || 'UnknownError',
        requestId
      },
      { status: statusCode, headers }
    )
  }
}

// PATCH /api/sessions/[project]/[feature] - Update session (future enhancement)
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  const startTime = Date.now()
  const requestId = crypto.randomUUID()
  
  try {
    const resolvedParams = await params
    const { projectName, featureName } = validateParams(resolvedParams.project, resolvedParams.feature)
    
    requestLogger.info('PATCH /api/sessions/[project]/[feature]', {
      requestId,
      projectName,
      featureName
    })
    
    // For now, return method not implemented
    // Future: could support operations like:
    // - Refresh session cache
    // - Update session metadata
    // - Restart session processes
    
    return NextResponse.json(
      {
        error: 'Session updates not yet implemented',
        code: 'NOT_IMPLEMENTED',
        suggestedOperations: [
          'Delete and recreate session',
          'Use specific endpoints for operations like refresh'
        ],
        requestId
      },
      { status: 501 }
    )
  } catch (error) {
    const duration = Date.now() - startTime
    const statusCode = getErrorStatusCode(error as Error)
    
    const headers = new Headers()
    headers.set('X-Response-Time', `${duration}ms`)
    headers.set('X-Request-Id', requestId)
    
    return NextResponse.json(
      { 
        error: (error as Error).message || 'Failed to update session',
        code: (error as Error).name || 'UnknownError',
        requestId
      },
      { status: statusCode, headers }
    )
  }
}

// OPTIONS - Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  })
}