import { NextRequest, NextResponse } from 'next/server'
import { windowManager } from '@/lib/managers/WindowManager'
import { WindowError, ValidationError, TmuxError, GitError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import type { 
  CreateWindowRequest, 
  WindowResponse, 
  CreateWindowResponse
} from '@/types'
import type {
  WindowFilter,
  WindowSearchOptions,
  WindowOperationResult
} from '@/types/index'

const requestLogger = logger.createChild({ component: 'WindowsAPI' })

// Request validation
function validatePaginationParams(searchParams: URLSearchParams) {
  const limit = searchParams.get('limit')
  const offset = searchParams.get('offset')
  
  const parsedLimit = limit ? parseInt(limit, 10) : 50
  const parsedOffset = offset ? parseInt(offset, 10) : 0
  
  if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 1000) {
    throw new ValidationError('Limit must be between 1 and 1000', 'limit', limit)
  }
  
  if (isNaN(parsedOffset) || parsedOffset < 0) {
    throw new ValidationError('Offset must be non-negative', 'offset', offset)
  }
  
  return { limit: parsedLimit, offset: parsedOffset }
}

function parseFilterParams(searchParams: URLSearchParams): WindowFilter {
  const filter: WindowFilter = {}
  
  if (searchParams.get('projectName')) {
    filter.projectName = searchParams.get('projectName')!
  }
  
  if (searchParams.get('featureName')) {
    filter.featureName = searchParams.get('featureName')!
  }
  
  if (searchParams.get('hasUncommittedChanges')) {
    filter.hasUncommittedChanges = searchParams.get('hasUncommittedChanges') === 'true'
  }
  
  if (searchParams.get('isActive')) {
    filter.isActive = searchParams.get('isActive') === 'true'
  }
  
  if (searchParams.get('status')) {
    const status = searchParams.get('status')!
    if (['active', 'idle', 'ready-for-pr', 'unhealthy'].includes(status)) {
      filter.status = status as any
    }
  }
  
  if (searchParams.get('branchPattern')) {
    try {
      filter.branchPattern = new RegExp(searchParams.get('branchPattern')!)
    } catch (error) {
      throw new ValidationError('Invalid regular expression for branchPattern', 'branchPattern', searchParams.get('branchPattern'))
    }
  }
  
  return filter
}

function getErrorStatusCode(error: Error): number {
  if (error instanceof ValidationError) return 400
  if (error instanceof WindowError) return 409
  if (error instanceof TmuxError || error instanceof GitError) return 503
  return 500
}

// GET /api/windows - List all windows with advanced filtering and search
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const { searchParams } = new URL(request.url)
  const requestId = crypto.randomUUID()
  
  requestLogger.info('GET /api/windows', { 
    requestId,
    params: Object.fromEntries(searchParams),
    userAgent: request.headers.get('user-agent')
  })
  
  try {
    // Parse and validate parameters
    const { limit, offset } = validatePaginationParams(searchParams)
    const filter = parseFilterParams(searchParams)
    const includeMetadata = searchParams.get('includeMetadata') === 'true'
    const sortBy = searchParams.get('sortBy') as 'name' | 'activity' | 'score' | undefined
    const searchText = searchParams.get('search')
    
    let windows
    let total = 0
    
    // Handle search vs filter
    if (searchText) {
      const searchOptions: WindowSearchOptions = {
        text: searchText,
        sortBy: sortBy || 'score',
        limit: limit + offset // Get more to handle offset
      }
      
      const searchResults = await windowManager.searchWindows(searchOptions)
      const paginatedResults = searchResults.slice(offset, offset + limit)
      
      windows = paginatedResults.map(result => result.window)
      total = searchResults.length
    } else {
      // Regular list with filtering
      const allWindows = await windowManager.listWindows({ 
        useCache: true, 
        includeMetadata, 
        filter 
      })
      
      total = allWindows.length
      windows = allWindows.slice(offset, offset + limit)
    }
    
    const duration = Date.now() - startTime
    
    // Set caching headers
    const headers = new Headers()
    headers.set('Cache-Control', 'public, max-age=10, stale-while-revalidate=30')
    headers.set('X-Total-Count', total.toString())
    headers.set('X-Response-Time', `${duration}ms`)
    headers.set('X-Request-Id', requestId)
    
    const response: WindowResponse & {
      pagination: { limit: number; offset: number; total: number; hasMore: boolean }
      meta: { duration: number; cached: boolean }
    } = {
      windows,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + windows.length < total
      },
      meta: {
        duration,
        cached: false // Would need cache hit detection
      }
    }
    
    requestLogger.info('GET /api/windows completed', {
      requestId,
      windowCount: windows.length,
      total,
      duration
    })
    
    return NextResponse.json(response, { headers })
  } catch (error) {
    const duration = Date.now() - startTime
    const statusCode = getErrorStatusCode(error as Error)
    
    requestLogger.error('GET /api/windows failed', error, {
      requestId,
      duration,
      statusCode
    })
    
    const headers = new Headers()
    headers.set('X-Response-Time', `${duration}ms`)
    headers.set('X-Request-Id', requestId)
    
    return NextResponse.json(
      { 
        error: (error as Error).message || 'Failed to list windows',
        code: (error as Error).name || 'UnknownError',
        requestId
      },
      { status: statusCode, headers }
    )
  }
}

// POST /api/windows - Create new window with enhanced validation
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const requestId = crypto.randomUUID()
  
  requestLogger.info('POST /api/windows', { requestId })
  
  try {
    // Validate content type
    const contentType = request.headers.get('content-type')
    if (!contentType?.includes('application/json')) {
      throw new ValidationError('Content-Type must be application/json', 'content-type', contentType)
    }
    
    // Parse and validate request body
    let body: CreateWindowRequest
    try {
      body = await request.json()
    } catch (error) {
      throw new ValidationError('Invalid JSON in request body', 'body', error)
    }
    
    // Enhanced input validation
    if (!body || typeof body !== 'object') {
      throw new ValidationError('Request body must be an object', 'body', body)
    }
    
    if (!body.projectPath || typeof body.projectPath !== 'string') {
      throw new ValidationError('projectPath is required and must be a string', 'projectPath', body.projectPath)
    }
    
    if (!body.featureName || typeof body.featureName !== 'string') {
      throw new ValidationError('featureName is required and must be a string', 'featureName', body.featureName)
    }
    
    // Sanitize inputs
    body.projectPath = body.projectPath.trim()
    body.featureName = body.featureName.trim().toLowerCase()
    
    // Check for enhanced creation mode
    const useEnhanced = request.nextUrl.searchParams.get('enhanced') === 'true'
    
    let result: WindowOperationResult<any>
    
    if (useEnhanced) {
      result = await windowManager.createWindowEnhanced(body)
    } else {
      try {
        const window = await windowManager.createWindow(body)
        result = {
          success: true,
          data: window,
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
    const statusCode = result.success ? 201 : getErrorStatusCode(new Error(result.error))
    
    // Set response headers
    const headers = new Headers()
    headers.set('X-Response-Time', `${duration}ms`)
    headers.set('X-Request-Id', requestId)
    
    if (result.success && result.data) {
      headers.set('Location', `/api/windows/${encodeURIComponent(result.data.projectName)}/${encodeURIComponent(result.data.featureName)}`)
    }
    
    const response: CreateWindowResponse & {
      meta: { duration: number; warnings?: string[]; requestId: string }
    } = {
      window: result.data || null,
      success: result.success,
      error: result.error,
      meta: {
        duration,
        warnings: result.warnings,
        requestId
      }
    }
    
    requestLogger.info('POST /api/windows completed', {
      requestId,
      success: result.success,
      projectName: result.data?.projectName,
      featureName: result.data?.featureName,
      duration
    })
    
    return NextResponse.json(response, { status: statusCode, headers })
  } catch (error) {
    const duration = Date.now() - startTime
    const statusCode = getErrorStatusCode(error as Error)
    
    requestLogger.error('POST /api/windows failed', error, {
      requestId,
      duration,
      statusCode
    })
    
    const headers = new Headers()
    headers.set('X-Response-Time', `${duration}ms`)
    headers.set('X-Request-Id', requestId)
    
    const response: CreateWindowResponse & {
      meta: { duration: number; requestId: string }
    } = {
      window: null as any,
      success: false,
      error: (error as Error).message || 'Failed to create window',
      meta: {
        duration,
        requestId
      }
    }
    
    return NextResponse.json(response, { status: statusCode, headers })
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