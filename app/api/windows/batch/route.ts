import { NextRequest, NextResponse } from 'next/server'
import { sessionManager } from '@/lib/managers/SessionManager'
import { SessionError, ValidationError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import type { SessionOperationResult } from '@/types'

const requestLogger = logger.createChild({ component: 'BatchAPI' })

interface BatchOperation {
  operation: 'delete' | 'health-check' | 'refresh-cache' | 'get-status'
  projectName: string
  featureName: string
  options?: {
    force?: boolean
    enhanced?: boolean
    includeMetadata?: boolean
  }
}

interface BatchRequest {
  operations: BatchOperation[]
  options?: {
    concurrency?: number
    failFast?: boolean
    continueOnError?: boolean
  }
}

interface BatchResult {
  operation: BatchOperation
  success: boolean
  data?: any
  error?: string
  duration: number
  sessionId: string
}

interface BatchResponse {
  success: boolean
  totalOperations: number
  successfulOperations: number
  failedOperations: number
  results: BatchResult[]
  meta: {
    totalDuration: number
    averageDuration: number
    requestId: string
    batchSize: number
  }
}

function validateBatchRequest(body: any): BatchRequest {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body must be an object', 'body', body)
  }
  
  if (!Array.isArray(body.operations)) {
    throw new ValidationError('operations must be an array', 'operations', body.operations)
  }
  
  if (body.operations.length === 0) {
    throw new ValidationError('operations array cannot be empty', 'operations', body.operations)
  }
  
  if (body.operations.length > 100) {
    throw new ValidationError('Maximum 100 operations per batch', 'operations', body.operations.length)
  }
  
  // Validate each operation
  for (let i = 0; i < body.operations.length; i++) {
    const op = body.operations[i]
    
    if (!op || typeof op !== 'object') {
      throw new ValidationError(`Operation ${i} must be an object`, `operations[${i}]`, op)
    }
    
    if (!['delete', 'health-check', 'refresh-cache', 'get-status'].includes(op.operation)) {
      throw new ValidationError(
        `Operation ${i} has invalid type. Must be: delete, health-check, refresh-cache, get-status`,
        `operations[${i}].operation`,
        op.operation
      )
    }
    
    if (!op.projectName || typeof op.projectName !== 'string') {
      throw new ValidationError(
        `Operation ${i} must have a valid projectName`,
        `operations[${i}].projectName`,
        op.projectName
      )
    }
    
    if (!op.featureName || typeof op.featureName !== 'string') {
      throw new ValidationError(
        `Operation ${i} must have a valid featureName`,
        `operations[${i}].featureName`,
        op.featureName
      )
    }
  }
  
  const options = body.options || {}
  if (options.concurrency && (typeof options.concurrency !== 'number' || options.concurrency < 1 || options.concurrency > 10)) {
    throw new ValidationError('concurrency must be between 1 and 10', 'options.concurrency', options.concurrency)
  }
  
  return {
    operations: body.operations,
    options: {
      concurrency: options.concurrency || 5,
      failFast: options.failFast || false,
      continueOnError: options.continueOnError !== false
    }
  }
}

async function executeOperation(operation: BatchOperation): Promise<{ success: boolean; data?: any; error?: string }> {
  const { projectName, featureName, options = {} } = operation
  
  try {
    switch (operation.operation) {
      case 'delete': {
        if (options.enhanced) {
          const result = await sessionManager.deleteSessionEnhanced(projectName, featureName)
          return result
        } else {
          await sessionManager.deleteSession(projectName, featureName)
          return { success: true }
        }
      }
      
      case 'health-check': {
        const session = await sessionManager.getSession(projectName, featureName)
        if (!session) {
          return { success: false, error: 'Session not found' }
        }
        
        const healthCheck = await (sessionManager as any).performSessionHealthCheck(session)
        return { success: true, data: healthCheck }
      }
      
      case 'refresh-cache': {
        // Clear cache for this specific session
        sessionManager.clearAllCaches()
        // Re-fetch session to populate cache
        const session = await sessionManager.getSession(projectName, featureName)
        return { 
          success: true, 
          data: { 
            sessionExists: session !== null,
            cached: false 
          } 
        }
      }
      
      case 'get-status': {
        const statusInfo = await sessionManager.getSessionStatus(projectName, featureName)
        return { success: true, data: statusInfo }
      }
      
      default:
        return { success: false, error: 'Unknown operation type' }
    }
  } catch (error) {
    return { 
      success: false, 
      error: (error as Error).message || 'Operation failed' 
    }
  }
}

// POST /api/sessions/batch - Execute batch operations on sessions
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const requestId = crypto.randomUUID()
  
  requestLogger.info('POST /api/sessions/batch', { requestId })
  
  try {
    // Parse and validate request
    const body = await request.json().catch(() => ({}))
    const batchRequest = validateBatchRequest(body)
    
    requestLogger.info('Executing batch operations', {
      requestId,
      operationCount: batchRequest.operations.length,
      concurrency: batchRequest.options?.concurrency,
      failFast: batchRequest.options?.failFast
    })
    
    const results: BatchResult[] = []
    let successfulOperations = 0
    let failedOperations = 0
    
    // Process operations in batches for concurrency control
    const concurrency = batchRequest.options!.concurrency!
    const operationBatches: BatchOperation[][] = []
    
    for (let i = 0; i < batchRequest.operations.length; i += concurrency) {
      operationBatches.push(batchRequest.operations.slice(i, i + concurrency))
    }
    
    for (const batch of operationBatches) {
      const batchPromises = batch.map(async (operation) => {
        const operationStart = Date.now()
        const sessionId = `${operation.projectName}:${operation.featureName}`
        
        const result = await executeOperation(operation)
        const duration = Date.now() - operationStart
        
        const batchResult: BatchResult = {
          operation,
          success: result.success,
          data: result.data,
          error: result.error,
          duration,
          sessionId
        }
        
        if (result.success) {
          successfulOperations++
        } else {
          failedOperations++
          
          if (batchRequest.options?.failFast) {
            throw new Error(`Batch operation failed (fail-fast enabled): ${result.error}`)
          }
        }
        
        return batchResult
      })
      
      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)
      
      // If fail-fast is enabled and we have failures, stop processing
      if (batchRequest.options?.failFast && failedOperations > 0) {
        break
      }
    }
    
    const totalDuration = Date.now() - startTime
    const averageDuration = results.length > 0 
      ? results.reduce((sum, r) => sum + r.duration, 0) / results.length 
      : 0
    
    const response: BatchResponse = {
      success: failedOperations === 0,
      totalOperations: batchRequest.operations.length,
      successfulOperations,
      failedOperations,
      results,
      meta: {
        totalDuration,
        averageDuration,
        requestId,
        batchSize: batchRequest.operations.length
      }
    }
    
    const statusCode = response.success ? 200 : (successfulOperations > 0 ? 207 : 400)
    
    const headers = new Headers()
    headers.set('Content-Type', 'application/json')
    headers.set('X-Response-Time', `${totalDuration}ms`)
    headers.set('X-Request-Id', requestId)
    headers.set('X-Batch-Size', batchRequest.operations.length.toString())
    headers.set('X-Successful-Operations', successfulOperations.toString())
    headers.set('X-Failed-Operations', failedOperations.toString())
    
    requestLogger.info('POST /api/sessions/batch completed', {
      requestId,
      totalOperations: batchRequest.operations.length,
      successfulOperations,
      failedOperations,
      totalDuration
    })
    
    return NextResponse.json(response, { status: statusCode, headers })
  } catch (error) {
    const duration = Date.now() - startTime
    
    requestLogger.error('POST /api/sessions/batch failed', error, {
      requestId,
      duration
    })
    
    const statusCode = error instanceof ValidationError ? 400 : 500
    
    const headers = new Headers()
    headers.set('X-Response-Time', `${duration}ms`)
    headers.set('X-Request-Id', requestId)
    
    return NextResponse.json(
      {
        success: false,
        error: (error as Error).message || 'Batch operation failed',
        code: (error as Error).name || 'UnknownError',
        requestId
      },
      { status: statusCode, headers }
    )
  }
}

// GET /api/sessions/batch - Get batch operation documentation
export async function GET() {
  const documentation = {
    description: 'Batch operations endpoint for Claude TMux Manager sessions',
    supportedOperations: [
      {
        name: 'delete',
        description: 'Delete a session with optional enhanced cleanup',
        options: {
          force: 'boolean - Force deletion even with uncommitted changes',
          enhanced: 'boolean - Use enhanced deletion with better error recovery'
        }
      },
      {
        name: 'health-check',
        description: 'Perform health check on a session',
        options: {}
      },
      {
        name: 'refresh-cache',
        description: 'Clear and refresh cache for a session',
        options: {}
      },
      {
        name: 'get-status',
        description: 'Get comprehensive status information for a session',
        options: {
          includeMetadata: 'boolean - Include session metadata in response'
        }
      }
    ],
    batchOptions: {
      concurrency: 'number (1-10) - Number of operations to run concurrently',
      failFast: 'boolean - Stop on first failure',
      continueOnError: 'boolean - Continue processing after errors (default: true)'
    },
    limits: {
      maxOperations: 100,
      maxConcurrency: 10
    },
    example: {
      operations: [
        {
          operation: 'health-check',
          projectName: 'my-project',
          featureName: 'feature-branch'
        },
        {
          operation: 'delete',
          projectName: 'old-project',
          featureName: 'completed-feature',
          options: { enhanced: true }
        }
      ],
      options: {
        concurrency: 3,
        failFast: false
      }
    }
  }
  
  return NextResponse.json(documentation)
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