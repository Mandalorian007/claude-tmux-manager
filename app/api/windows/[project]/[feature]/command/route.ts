import { NextRequest, NextResponse } from 'next/server'
import { windowManager } from '@/lib/managers/WindowManager'
import { logger } from '@/lib/logger'

interface SendCommandRequest {
  command: string
}

/**
 * POST /api/windows/[project]/[feature]/command
 * Send a command to a specific tmux window
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ project: string; feature: string }> }
): Promise<NextResponse> {
  const requestId = crypto.randomUUID()
  const resolvedParams = await params
  
  logger.info('POST /api/windows/[project]/[feature]/command', {
    component: 'SendCommandAPI',
    requestId,
    projectName: resolvedParams.project,
    featureName: resolvedParams.feature
  })

  try {
    // Parse request body
    const body: SendCommandRequest = await request.json()
    const { command } = body

    // Validate input
    if (!command || typeof command !== 'string' || !command.trim()) {
      return NextResponse.json(
        { 
          error: 'Command is required and must be a non-empty string',
          code: 'INVALID_COMMAND'
        },
        { status: 400 }
      )
    }

    // Decode URL parameters
    const projectName = decodeURIComponent(resolvedParams.project)
    const featureName = decodeURIComponent(resolvedParams.feature)

    // Validate project and feature names
    if (!projectName || !featureName) {
      return NextResponse.json(
        { 
          error: 'Project name and feature name are required',
          code: 'MISSING_PARAMETERS'
        },
        { status: 400 }
      )
    }

    // Send command to window
    const result = await windowManager.sendCommand(projectName, featureName, command.trim())

    if (!result.success) {
      logger.error('Failed to send command to window', {
        component: 'SendCommandAPI',
        requestId,
        projectName,
        featureName,
        command: command.trim(),
        error: result.error
      })

      return NextResponse.json(
        { 
          error: result.error || 'Failed to send command',
          code: 'COMMAND_FAILED'
        },
        { status: 500 }
      )
    }

    logger.info('POST /api/windows/[project]/[feature]/command completed', {
      component: 'SendCommandAPI',
      requestId,
      projectName,
      featureName,
      command: command.trim(),
      success: true
    })

    return NextResponse.json({
      success: true,
      message: 'Command sent successfully',
      projectName,
      featureName,
      command: command.trim()
    })

  } catch (error) {
    logger.error('Failed to send command', error, {
      component: 'SendCommandAPI',
      requestId,
      projectName: resolvedParams.project,
      featureName: resolvedParams.feature
    })

    return NextResponse.json(
      { 
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    )
  }
}