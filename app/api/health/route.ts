import { NextRequest, NextResponse } from 'next/server'
import { sessionManager } from '@/lib/managers/SessionManager'
import { tmuxAdapter } from '@/lib/adapters/tmux'
import { gitAdapter } from '@/lib/adapters/git'
import { logger } from '@/lib/logger'

const requestLogger = logger.createChild({ component: 'HealthAPI' })

interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  version: string
  uptime: number
  services: {
    tmux: {
      status: 'healthy' | 'unhealthy'
      sessionExists: boolean
      windowCount?: number
      error?: string
    }
    git: {
      status: 'healthy' | 'unhealthy'
      error?: string
    }
    sessionManager: {
      status: 'healthy' | 'unhealthy'
      activeSessions: number
      cacheStats?: any
      error?: string
    }
  }
  performance: {
    responseTime: number
    cacheHitRate?: number
    systemLoad?: {
      sessions: number
      memory?: number
    }
  }
}

// GET /api/health - System health check endpoint
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const requestId = crypto.randomUUID()
  
  requestLogger.info('GET /api/health', { requestId })
  
  const detailed = request.nextUrl.searchParams.get('detailed') === 'true'
  
  const response: HealthCheckResponse = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime(),
    services: {
      tmux: { status: 'healthy', sessionExists: false },
      git: { status: 'healthy' },
      sessionManager: { status: 'healthy', activeSessions: 0 }
    },
    performance: {
      responseTime: 0
    }
  }
  
  let healthyServices = 0
  const totalServices = 3
  
  // Check tmux service
  try {
    const sessionExists = await tmuxAdapter.sessionExists()
    response.services.tmux.sessionExists = sessionExists
    
    if (sessionExists && detailed) {
      const windows = await tmuxAdapter.listWindows()
      response.services.tmux.windowCount = windows.length
    }
    
    healthyServices++
  } catch (error) {
    response.services.tmux.status = 'unhealthy'
    response.services.tmux.error = (error as Error).message
    requestLogger.warn('Tmux health check failed', { error: (error as Error).message })
  }
  
  // Check git service
  try {
    // Basic git availability check
    const testPath = process.cwd()
    await (gitAdapter as any).validateGitInstallation()
    healthyServices++
  } catch (error) {
    response.services.git.status = 'unhealthy'
    response.services.git.error = (error as Error).message
    requestLogger.warn('Git health check failed', { error: (error as Error).message })
  }
  
  // Check session manager
  try {
    const sessions = await sessionManager.listSessions({ useCache: true })
    response.services.sessionManager.activeSessions = sessions.length
    
    if (detailed) {
      response.services.sessionManager.cacheStats = sessionManager.getCacheStats()
      
      // Get system health report
      const systemReport = await sessionManager.getSystemHealthReport()
      response.performance.systemLoad = {
        sessions: systemReport.totalSessions,
        // memory: process.memoryUsage().heapUsed / 1024 / 1024 // MB
      }
    }
    
    healthyServices++
  } catch (error) {
    response.services.sessionManager.status = 'unhealthy'
    response.services.sessionManager.error = (error as Error).message
    requestLogger.warn('Session manager health check failed', { error: (error as Error).message })
  }
  
  // Determine overall status
  if (healthyServices === totalServices) {
    response.status = 'healthy'
  } else if (healthyServices > 0) {
    response.status = 'degraded'
  } else {
    response.status = 'unhealthy'
  }
  
  response.performance.responseTime = Date.now() - startTime
  
  // Set appropriate status code
  let statusCode = 200
  if (response.status === 'degraded') statusCode = 207 // Multi-Status
  if (response.status === 'unhealthy') statusCode = 503 // Service Unavailable
  
  // Set headers
  const headers = new Headers()
  headers.set('Content-Type', 'application/json')
  headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
  headers.set('X-Response-Time', `${response.performance.responseTime}ms`)
  headers.set('X-Request-Id', requestId)
  headers.set('X-Health-Status', response.status)
  
  requestLogger.info('GET /api/health completed', {
    requestId,
    status: response.status,
    healthyServices,
    totalServices,
    responseTime: response.performance.responseTime
  })
  
  return NextResponse.json(response, { status: statusCode, headers })
}

// HEAD /api/health - Lightweight health check
export async function HEAD() {
  const startTime = Date.now()
  
  try {
    // Quick check of essential services
    const [tmuxExists, sessionCount] = await Promise.all([
      tmuxAdapter.sessionExists().catch(() => false),
      sessionManager.listSessions({ useCache: true }).then(s => s.length).catch(() => -1)
    ])
    
    const duration = Date.now() - startTime
    const isHealthy = tmuxExists !== false && sessionCount >= 0
    
    const headers = new Headers()
    headers.set('X-Response-Time', `${duration}ms`)
    headers.set('X-Health-Status', isHealthy ? 'healthy' : 'degraded')
    headers.set('X-Session-Count', sessionCount.toString())
    headers.set('Cache-Control', 'no-cache')
    
    return new NextResponse(null, {
      status: isHealthy ? 200 : 503,
      headers
    })
  } catch (error) {
    const headers = new Headers()
    headers.set('X-Response-Time', `${Date.now() - startTime}ms`)
    headers.set('X-Health-Status', 'unhealthy')
    
    return new NextResponse(null, {
      status: 503,
      headers
    })
  }
}

// OPTIONS - Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  })
}