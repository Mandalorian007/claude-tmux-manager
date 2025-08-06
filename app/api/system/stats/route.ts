import { NextRequest, NextResponse } from 'next/server'
import { sessionManager } from '@/lib/managers/SessionManager'
import { tmuxAdapter } from '@/lib/adapters/tmux'
import { logger } from '@/lib/logger'

const requestLogger = logger.createChild({ component: 'SystemStatsAPI' })

interface SystemStats {
  sessions: {
    total: number
    active: number
    inactive: number
    healthy: number
    unhealthy: number
    withUncommittedChanges: number
    readyForPR: number
    byProject: Record<string, number>
    byStatus: Record<string, number>
  }
  performance: {
    cacheStats: any
    systemHealth: any
    responseTime: number
  }
  system: {
    tmux: {
      sessionExists: boolean
      totalWindows: number
    }
    nodejs: {
      version: string
      uptime: number
      memory: {
        used: number
        total: number
        percentage: number
      }
    }
  }
  meta: {
    timestamp: string
    requestId: string
    version: string
  }
}

// GET /api/system/stats - Get comprehensive system statistics
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const requestId = crypto.randomUUID()
  
  requestLogger.info('GET /api/system/stats', { requestId })
  
  try {
    const includeDetailed = request.nextUrl.searchParams.get('detailed') === 'true'
    
    // Get all sessions with metadata if detailed stats requested
    const sessions = await sessionManager.listSessions({ 
      includeMetadata: includeDetailed,
      useCache: !includeDetailed // Force fresh data for detailed stats
    })
    
    // Calculate session statistics
    const sessionStats = {
      total: sessions.length,
      active: sessions.filter(s => s.isActive).length,
      inactive: sessions.filter(s => !s.isActive).length,
      healthy: 0,
      unhealthy: 0,
      withUncommittedChanges: sessions.filter(s => s.gitStats.hasUncommittedChanges).length,
      readyForPR: sessions.filter(s => s.gitStats.ahead > 0 && !s.gitStats.hasUncommittedChanges).length,
      byProject: {} as Record<string, number>,
      byStatus: {
        active: 0,
        idle: 0,
        'ready-for-pr': 0,
        unhealthy: 0
      }
    }
    
    // Project breakdown
    for (const session of sessions) {
      sessionStats.byProject[session.projectName] = (sessionStats.byProject[session.projectName] || 0) + 1
    }
    
    // Health and status breakdown (if detailed)
    if (includeDetailed) {
      for (const session of sessions) {
        try {
          const healthCheck = await (sessionManager as any).performSessionHealthCheck(session)
          if (healthCheck.isHealthy) {
            sessionStats.healthy++
          } else {
            sessionStats.unhealthy++
          }
          
          // Determine status
          if (!healthCheck.isHealthy) {
            sessionStats.byStatus.unhealthy++
          } else if (session.gitStats.ahead > 0 && !session.gitStats.hasUncommittedChanges) {
            sessionStats.byStatus['ready-for-pr']++
          } else if (session.gitStats.hasUncommittedChanges || session.isActive) {
            sessionStats.byStatus.active++
          } else {
            sessionStats.byStatus.idle++
          }
        } catch (error) {
          sessionStats.unhealthy++
          sessionStats.byStatus.unhealthy++
        }
      }
    } else {
      // Quick status approximation without health checks
      sessionStats.healthy = sessions.length // Assume healthy unless proven otherwise
      sessionStats.unhealthy = 0
      
      for (const session of sessions) {
        if (session.gitStats.ahead > 0 && !session.gitStats.hasUncommittedChanges) {
          sessionStats.byStatus['ready-for-pr']++
        } else if (session.gitStats.hasUncommittedChanges || session.isActive) {
          sessionStats.byStatus.active++
        } else {
          sessionStats.byStatus.idle++
        }
      }
    }
    
    // Get system information
    const memoryUsage = process.memoryUsage()
    const tmuxSessionExists = await tmuxAdapter.sessionExists()
    let totalWindows = 0
    
    if (tmuxSessionExists) {
      const windows = await tmuxAdapter.listWindows()
      totalWindows = windows.length
    }
    
    // Get performance metrics
    const cacheStats = sessionManager.getCacheStats()
    let systemHealth = null
    
    if (includeDetailed) {
      systemHealth = await sessionManager.getSystemHealthReport()
    }
    
    const duration = Date.now() - startTime
    
    const stats: SystemStats = {
      sessions: sessionStats,
      performance: {
        cacheStats,
        systemHealth,
        responseTime: duration
      },
      system: {
        tmux: {
          sessionExists: tmuxSessionExists,
          totalWindows
        },
        nodejs: {
          version: process.version,
          uptime: Math.floor(process.uptime()),
          memory: {
            used: memoryUsage.heapUsed,
            total: memoryUsage.heapTotal,
            percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100)
          }
        }
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
        version: process.env.npm_package_version || '1.0.0'
      }
    }
    
    // Set caching headers based on detail level
    const cacheMaxAge = includeDetailed ? 30 : 60 // Shorter cache for detailed stats
    const headers = new Headers()
    headers.set('Cache-Control', `public, max-age=${cacheMaxAge}, stale-while-revalidate=${cacheMaxAge * 2}`)
    headers.set('X-Response-Time', `${duration}ms`)
    headers.set('X-Request-Id', requestId)
    headers.set('X-Stats-Detail-Level', includeDetailed ? 'detailed' : 'summary')
    headers.set('X-Session-Count', sessions.length.toString())
    
    requestLogger.info('GET /api/system/stats completed', {
      requestId,
      sessionCount: sessions.length,
      detailed: includeDetailed,
      duration
    })
    
    return NextResponse.json(stats, { headers })
  } catch (error) {
    const duration = Date.now() - startTime
    
    requestLogger.error('GET /api/system/stats failed', error, {
      requestId,
      duration
    })
    
    const headers = new Headers()
    headers.set('X-Response-Time', `${duration}ms`)
    headers.set('X-Request-Id', requestId)
    
    return NextResponse.json(
      {
        error: (error as Error).message || 'Failed to get system stats',
        code: (error as Error).name || 'UnknownError',
        requestId
      },
      { status: 500, headers }
    )
  }
}

// POST /api/system/stats - Refresh statistics and clear caches
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const requestId = crypto.randomUUID()
  
  requestLogger.info('POST /api/system/stats (refresh)', { requestId })
  
  try {
    // Parse request body for refresh options
    const body = await request.json().catch(() => ({}))
    const options = {
      clearCaches: body.clearCaches !== false, // Default to true
      optimizeCaches: body.optimizeCaches !== false, // Default to true
      includeDetailed: body.includeDetailed === true
    }
    
    // Clear caches if requested
    if (options.clearCaches) {
      sessionManager.clearAllCaches()
      tmuxAdapter.clearCache()
    }
    
    // Optimize caches if requested
    let cacheOptimizationResult = null
    if (options.optimizeCaches) {
      cacheOptimizationResult = sessionManager.optimizeCache()
    }
    
    // Get fresh statistics
    const sessions = await sessionManager.listSessions({ 
      includeMetadata: options.includeDetailed,
      useCache: false // Force fresh data
    })
    
    const duration = Date.now() - startTime
    
    const response = {
      success: true,
      message: 'Statistics refreshed successfully',
      actions: {
        cachesCleared: options.clearCaches,
        cachesOptimized: options.optimizeCaches,
        cacheOptimizationResult
      },
      summary: {
        totalSessions: sessions.length,
        activeSessions: sessions.filter(s => s.isActive).length,
        refreshDuration: duration
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
        options
      }
    }
    
    const headers = new Headers()
    headers.set('X-Response-Time', `${duration}ms`)
    headers.set('X-Request-Id', requestId)
    headers.set('X-Refresh-Actions', JSON.stringify(Object.keys(response.actions).filter(k => response.actions[k as keyof typeof response.actions])))
    
    requestLogger.info('POST /api/system/stats completed', {
      requestId,
      sessionCount: sessions.length,
      duration,
      actions: response.actions
    })
    
    return NextResponse.json(response, { headers })
  } catch (error) {
    const duration = Date.now() - startTime
    
    requestLogger.error('POST /api/system/stats failed', error, {
      requestId,
      duration
    })
    
    return NextResponse.json(
      {
        success: false,
        error: (error as Error).message || 'Failed to refresh stats',
        requestId
      },
      { status: 500 }
    )
  }
}

// OPTIONS - Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  })
}