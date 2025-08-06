import { NextRequest, NextResponse } from 'next/server'
import { sessionManager } from '@/lib/managers/SessionManager'
import { SessionError, ValidationError, TmuxError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import type { SessionStreamOptions } from '@/types'

const requestLogger = logger.createChild({ component: 'SessionOutputAPI' })

interface RouteParams {
  params: {
    project: string
    feature: string
  }
}

function validateParams(project: string, feature: string) {
  if (!project || typeof project !== 'string') {
    throw new ValidationError('Project name is required', 'project', project)
  }
  
  if (!feature || typeof feature !== 'string') {
    throw new ValidationError('Feature name is required', 'feature', feature)
  }
  
  return { 
    projectName: decodeURIComponent(project), 
    featureName: decodeURIComponent(feature) 
  }
}

function parseOutputOptions(searchParams: URLSearchParams): {
  lines?: number
  includeEscapes?: boolean
  format?: 'text' | 'json' | 'html'
  tail?: boolean
} {
  const options: any = {}
  
  const lines = searchParams.get('lines')
  if (lines) {
    const parsedLines = parseInt(lines, 10)
    if (isNaN(parsedLines) || parsedLines < 1 || parsedLines > 10000) {
      throw new ValidationError('Lines must be between 1 and 10000', 'lines', lines)
    }
    options.lines = parsedLines
  }
  
  options.includeEscapes = searchParams.get('includeEscapes') === 'true'
  options.tail = searchParams.get('tail') === 'true'
  
  const format = searchParams.get('format')
  if (format && !['text', 'json', 'html'].includes(format)) {
    throw new ValidationError('Format must be text, json, or html', 'format', format)
  }
  options.format = format || 'text'
  
  return options
}

function getErrorStatusCode(error: Error): number {
  if (error instanceof ValidationError) return 400
  if (error instanceof SessionError) return 404
  if (error instanceof TmuxError) return 503
  return 500
}

function formatOutput(output: string, format: string, includeEscapes: boolean) {
  switch (format) {
    case 'json':
      return {
        output: output,
        lines: output.split('\n'),
        length: output.length,
        hasEscapes: includeEscapes && /\x1b\[/.test(output)
      }
    case 'html':
      // Basic ANSI to HTML conversion (simplified)
      let htmlOutput = output
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>')
      
      if (includeEscapes) {
        // Very basic ANSI color conversion - in production you'd want a proper library
        htmlOutput = htmlOutput
          .replace(/\x1b\[31m/g, '<span style="color: red;">')
          .replace(/\x1b\[32m/g, '<span style="color: green;">')
          .replace(/\x1b\[33m/g, '<span style="color: yellow;">')
          .replace(/\x1b\[34m/g, '<span style="color: blue;">')
          .replace(/\x1b\[35m/g, '<span style="color: magenta;">')
          .replace(/\x1b\[36m/g, '<span style="color: cyan;">')
          .replace(/\x1b\[0m/g, '</span>')
          .replace(/\x1b\[\d+m/g, '') // Remove other escape codes
      }
      
      return {
        output: htmlOutput,
        format: 'html'
      }
    case 'text':
    default:
      return { output }
  }
}

// GET /api/sessions/[project]/[feature]/output - Get terminal output with advanced options
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const startTime = Date.now()
  const requestId = crypto.randomUUID()
  
  try {
    const { projectName, featureName } = validateParams(params.project, params.feature)
    const options = parseOutputOptions(request.nextUrl.searchParams)
    
    requestLogger.info('GET /api/sessions/[project]/[feature]/output', {
      requestId,
      projectName,
      featureName,
      options
    })
    
    // Check if session exists first
    const sessionExists = await sessionManager.sessionExists(projectName, featureName)
    if (!sessionExists) {
      return NextResponse.json(
        {
          error: `Session '${projectName}:${featureName}' not found`,
          code: 'SESSION_NOT_FOUND',
          requestId
        },
        { status: 404 }
      )
    }
    
    // Get the output
    const output = await sessionManager.getSessionOutput(projectName, featureName, {
      lines: options.lines,
      includeEscapes: options.includeEscapes
    })
    
    const duration = Date.now() - startTime
    
    // Format output based on requested format
    const formattedResponse = formatOutput(output, options.format || 'text', options.includeEscapes || false)
    
    // Set appropriate headers
    const headers = new Headers()
    headers.set('X-Response-Time', `${duration}ms`)
    headers.set('X-Request-Id', requestId)
    headers.set('X-Output-Length', output.length.toString())
    
    // Set content type based on format
    if (options.format === 'html') {
      headers.set('Content-Type', 'application/json; charset=utf-8')
    } else if (options.format === 'text' && !request.nextUrl.searchParams.has('json')) {
      // Return raw text if specifically requested
      headers.set('Content-Type', 'text/plain; charset=utf-8')
      return new NextResponse(output, { headers })
    }
    
    // Set caching headers (shorter cache for terminal output)
    headers.set('Cache-Control', 'private, max-age=2, stale-while-revalidate=5')
    
    const response = {
      ...formattedResponse,
      meta: {
        sessionName: `${projectName}:${featureName}`,
        timestamp: new Date().toISOString(),
        duration,
        requestId,
        options
      }
    }
    
    requestLogger.info('GET /api/sessions/[project]/[feature]/output completed', {
      requestId,
      projectName,
      featureName,
      outputLength: output.length,
      duration
    })
    
    return NextResponse.json(response, { headers })
  } catch (error) {
    const duration = Date.now() - startTime
    const statusCode = getErrorStatusCode(error as Error)
    
    requestLogger.error('GET /api/sessions/[project]/[feature]/output failed', error, {
      requestId,
      project: params.project,
      feature: params.feature,
      duration
    })
    
    const headers = new Headers()
    headers.set('X-Response-Time', `${duration}ms`)
    headers.set('X-Request-Id', requestId)
    
    return NextResponse.json(
      { 
        error: (error as Error).message || 'Failed to get session output',
        code: (error as Error).name || 'UnknownError',
        requestId
      },
      { status: statusCode, headers }
    )
  }
}

// POST /api/sessions/[project]/[feature]/output - Stream output (WebSocket alternative)
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  const startTime = Date.now()
  const requestId = crypto.randomUUID()
  
  try {
    const { projectName, featureName } = validateParams(params.project, params.feature)
    
    requestLogger.info('POST /api/sessions/[project]/[feature]/output (stream)', {
      requestId,
      projectName,
      featureName
    })
    
    // Parse streaming options from body
    const body = await request.json().catch(() => ({}))
    const streamOptions: SessionStreamOptions = {
      interval: body.interval || 1000,
      maxLines: body.maxLines || 100,
      includeEscapes: body.includeEscapes || false
    }
    
    // Validate streaming options
    if (streamOptions.interval! < 100 || streamOptions.interval! > 60000) {
      throw new ValidationError('Interval must be between 100ms and 60000ms', 'interval', streamOptions.interval)
    }
    
    if (streamOptions.maxLines! < 1 || streamOptions.maxLines! > 1000) {
      throw new ValidationError('maxLines must be between 1 and 1000', 'maxLines', streamOptions.maxLines)
    }
    
    // For now, return information about streaming capabilities
    // In a real implementation, you might use Server-Sent Events or WebSocket
    const response = {
      message: 'Streaming endpoint ready',
      streamOptions,
      capabilities: {
        serverSentEvents: false, // Would need to implement
        webSocket: false,        // Would need to implement
        polling: true           // Available via GET with interval
      },
      recommendations: {
        polling: {
          method: 'GET',
          url: `/api/sessions/${encodeURIComponent(projectName)}/${encodeURIComponent(featureName)}/output`,
          interval: `${streamOptions.interval}ms`,
          parameters: {
            lines: streamOptions.maxLines,
            includeEscapes: streamOptions.includeEscapes,
            tail: true
          }
        }
      },
      meta: {
        duration: Date.now() - startTime,
        requestId
      }
    }
    
    requestLogger.info('POST /api/sessions/[project]/[feature]/output completed', {
      requestId,
      projectName,
      featureName
    })
    
    return NextResponse.json(response, { status: 200 })
  } catch (error) {
    const duration = Date.now() - startTime
    const statusCode = getErrorStatusCode(error as Error)
    
    requestLogger.error('POST /api/sessions/[project]/[feature]/output failed', error, {
      requestId,
      project: params.project,
      feature: params.feature,
      duration
    })
    
    return NextResponse.json(
      { 
        error: (error as Error).message || 'Failed to setup output stream',
        code: (error as Error).name || 'UnknownError',
        requestId
      },
      { status: statusCode }
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