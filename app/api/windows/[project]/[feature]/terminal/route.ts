import { NextRequest, NextResponse } from 'next/server'
import { sessionManager } from '@/lib/managers/SessionManager'
import { logger } from '@/lib/logger'
import { CommandExecutor } from '@/lib/command-executor'

const routeLogger = logger.createChild({ component: 'TerminalAPI' })

export async function POST(
  request: NextRequest,
  { params }: { params: { project: string; feature: string } }
) {
  const { project, feature } = params
  
  routeLogger.debug('Opening terminal for session', { project, feature })
  
  try {
    // Validate that the session exists
    const session = await sessionManager.getSession(project, feature)
    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }
    
    // Generate the tmux command to attach to the specific window
    const sessionName = 'claude-tmux-manager'
    const windowName = `${project}:${feature}`
    
    // Build the tmux command to attach and select the window
    const tmuxCmd = `tmux attach-session -t "${sessionName}" \\; select-window -t "${windowName}"`
    
    // Open terminal and attach to the tmux session/window based on platform
    let command: string
    
    if (process.platform === 'darwin') {
      // macOS - use osascript to open Terminal.app
      command = `osascript -e 'tell application "Terminal" to do script "${tmuxCmd}"'`
    } else if (process.platform === 'linux') {
      // Linux - try common terminal emulators
      command = [
        `gnome-terminal -- bash -c "${tmuxCmd}"`,
        `xterm -e "${tmuxCmd}"`,
        `konsole -e bash -c "${tmuxCmd}"`,
        `alacritty -e bash -c "${tmuxCmd}"`,
        `kitty bash -c "${tmuxCmd}"`
      ].join(' || ')
    } else if (process.platform === 'win32') {
      // Windows - use cmd or PowerShell
      command = `start cmd /k "${tmuxCmd.replace(/\\\\/g, '&')}"`
    } else {
      // Fallback for other platforms
      command = `x-terminal-emulator -e "${tmuxCmd}" || xterm -e "${tmuxCmd}"`
    }
    
    routeLogger.info('Executing terminal open command', { 
      project, 
      feature, 
      windowName,
      platform: process.platform 
    })
    
    // Execute the command to open terminal
    let result
    try {
      result = await CommandExecutor.execute(command, {
        timeout: 10000,
        suppressErrors: true
      })
    } catch (error) {
      routeLogger.warn('Failed to execute terminal command', {
        project,
        feature,
        command,
        error: error instanceof Error ? error.message : String(error)
      })
      
      // Fallback: provide instructions for manual connection
      return NextResponse.json({
        success: false,
        error: 'Could not automatically open terminal',
        fallback: {
          message: `Manually run: ${tmuxCmd}`,
          sessionName,
          windowName,
          instructions: [
            '1. Open your terminal application',
            `2. Run: ${tmuxCmd}`,
            '3. This will attach to the tmux session and select your window'
          ]
        }
      }, { status: 202 }) // 202 Accepted - fallback provided
    }
    
    if (result.exitCode === 0) {
      routeLogger.info('Successfully opened terminal', { project, feature, windowName })
      return NextResponse.json({ 
        success: true, 
        message: `Terminal opened for ${project}:${feature}`,
        windowName 
      })
    } else {
      routeLogger.warn('Terminal command returned non-zero exit code', {
        project,
        feature, 
        exitCode: result.exitCode,
        stderr: result.stderr,
        stdout: result.stdout
      })
      
      // Provide fallback instructions
      return NextResponse.json({
        success: false,
        error: 'Failed to open terminal automatically',
        fallback: {
          message: `Manually run: ${tmuxCmd}`,
          sessionName,
          windowName,
          instructions: [
            '1. Open your terminal application',
            `2. Run: ${tmuxCmd}`,
            '3. This will attach to the tmux session and select your window'
          ]
        },
        debug: {
          exitCode: result.exitCode,
          stderr: result.stderr,
          stdout: result.stdout
        }
      }, { status: 202 }) // 202 Accepted - fallback provided
    }
    
  } catch (error) {
    routeLogger.error('Failed to open terminal', error, { project, feature })
    
    return NextResponse.json({
      error: 'Failed to open terminal',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}