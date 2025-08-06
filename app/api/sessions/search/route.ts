import { NextRequest, NextResponse } from 'next/server'
import { sessionManager } from '@/lib/managers/SessionManager'
import { ValidationError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import type { SessionSearchOptions, SessionSearchResult } from '@/types'

const requestLogger = logger.createChild({ component: 'SearchAPI' })

function validateSearchParams(searchParams: URLSearchParams): SessionSearchOptions & { 
  limit: number
  offset: number
  includeMetadata: boolean
} {
  const options: any = {}
  
  // Text search
  const text = searchParams.get('q') || searchParams.get('text') || searchParams.get('search')
  if (text) {
    if (text.length > 500) {
      throw new ValidationError('Search text too long (max 500 characters)', 'text', text)
    }
    options.text = text.trim()
  }
  
  // Tags (future feature)
  const tagsParam = searchParams.get('tags')
  if (tagsParam) {
    const tags = tagsParam.split(',').map(t => t.trim()).filter(Boolean)
    if (tags.length > 20) {
      throw new ValidationError('Too many tags (max 20)', 'tags', tags)
    }
    options.tags = tags
  }
  
  // Sort options
  const sortBy = searchParams.get('sortBy')
  if (sortBy && !['name', 'activity', 'score'].includes(sortBy)) {
    throw new ValidationError('sortBy must be: name, activity, or score', 'sortBy', sortBy)
  }
  options.sortBy = sortBy as 'name' | 'activity' | 'score' || 'score'
  
  // Pagination
  const limit = parseInt(searchParams.get('limit') || '50', 10)
  const offset = parseInt(searchParams.get('offset') || '0', 10)
  
  if (isNaN(limit) || limit < 1 || limit > 500) {
    throw new ValidationError('limit must be between 1 and 500', 'limit', searchParams.get('limit'))
  }
  
  if (isNaN(offset) || offset < 0) {
    throw new ValidationError('offset must be non-negative', 'offset', searchParams.get('offset'))
  }
  
  options.limit = limit + offset // Get more results to handle offset
  
  // Additional options
  options.includeMetadata = searchParams.get('includeMetadata') === 'true'
  
  return { ...options, limit, offset }
}

// GET /api/sessions/search - Advanced session search
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const requestId = crypto.randomUUID()
  const { searchParams } = new URL(request.url)
  
  requestLogger.info('GET /api/sessions/search', { 
    requestId,
    params: Object.fromEntries(searchParams)
  })
  
  try {
    // Validate and parse search parameters
    const searchOptions = validateSearchParams(searchParams)
    const { limit, offset, includeMetadata, ...actualSearchOptions } = searchOptions
    
    // If no search criteria provided, return empty results
    if (!actualSearchOptions.text && !actualSearchOptions.tags?.length) {
      return NextResponse.json({
        results: [],
        pagination: {
          limit,
          offset,
          total: 0,
          hasMore: false
        },
        meta: {
          duration: Date.now() - startTime,
          requestId,
          query: actualSearchOptions
        }
      })
    }
    
    // Execute search
    const searchResults = await sessionManager.searchSessions(actualSearchOptions)
    
    // Apply pagination
    const paginatedResults = searchResults.slice(offset, offset + limit)
    const total = searchResults.length
    
    const duration = Date.now() - startTime
    
    // Enhance results with additional metadata if requested
    let enhancedResults = paginatedResults
    if (includeMetadata) {
      enhancedResults = await Promise.all(
        paginatedResults.map(async (result) => ({
          ...result,
          metadata: result.metadata || await (sessionManager as any).collectSessionMetadata(result.session)
        }))
      )
    }
    
    // Set caching headers
    const headers = new Headers()
    headers.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=60')
    headers.set('X-Total-Count', total.toString())
    headers.set('X-Response-Time', `${duration}ms`)
    headers.set('X-Request-Id', requestId)
    
    const response = {
      results: enhancedResults,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + paginatedResults.length < total
      },
      aggregations: {
        totalMatches: total,
        averageMatchScore: total > 0 
          ? searchResults.reduce((sum, r) => sum + r.matchScore, 0) / total 
          : 0,
        projectBreakdown: getProjectBreakdown(searchResults),
        statusBreakdown: await getStatusBreakdown(searchResults)
      },
      meta: {
        duration,
        requestId,
        query: {
          text: actualSearchOptions.text,
          tags: actualSearchOptions.tags,
          sortBy: actualSearchOptions.sortBy,
          includeMetadata
        }
      }
    }
    
    requestLogger.info('GET /api/sessions/search completed', {
      requestId,
      resultCount: paginatedResults.length,
      totalMatches: total,
      duration
    })
    
    return NextResponse.json(response, { headers })
  } catch (error) {
    const duration = Date.now() - startTime
    const statusCode = error instanceof ValidationError ? 400 : 500
    
    requestLogger.error('GET /api/sessions/search failed', error, {
      requestId,
      duration
    })
    
    const headers = new Headers()
    headers.set('X-Response-Time', `${duration}ms`)
    headers.set('X-Request-Id', requestId)
    
    return NextResponse.json(
      {
        error: (error as Error).message || 'Search failed',
        code: (error as Error).name || 'UnknownError',
        requestId
      },
      { status: statusCode, headers }
    )
  }
}

// Helper functions
function getProjectBreakdown(results: SessionSearchResult[]): Record<string, number> {
  const breakdown: Record<string, number> = {}
  
  for (const result of results) {
    const projectName = result.session.projectName
    breakdown[projectName] = (breakdown[projectName] || 0) + 1
  }
  
  return breakdown
}

async function getStatusBreakdown(results: SessionSearchResult[]): Promise<Record<string, number>> {
  const breakdown: Record<string, number> = {
    active: 0,
    idle: 0,
    'ready-for-pr': 0,
    unhealthy: 0
  }
  
  // This would be more efficient if status was already computed
  // For now, we'll do a simple breakdown based on basic criteria
  for (const result of results) {
    const session = result.session
    
    if (!session.isActive) {
      breakdown.idle++
    } else if (session.gitStats.ahead > 0 && !session.gitStats.hasUncommittedChanges) {
      breakdown['ready-for-pr']++
    } else if (session.gitStats.hasUncommittedChanges) {
      breakdown.active++
    } else {
      breakdown.idle++
    }
  }
  
  return breakdown
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