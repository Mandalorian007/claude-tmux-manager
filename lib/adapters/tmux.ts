import type { WindowInfo } from '@/types'
import { CommandExecutor } from '../command-executor'
import { TmuxError, ValidationError } from '../errors'
import { logger } from '../logger'
import { expandPath } from '../utils'

const TMUX_SESSION = 'claude-tmux-manager'
const WINDOW_NAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9:._-]*$/
const MAX_WINDOW_NAME_LENGTH = 100
const COMMAND_TIMEOUT = 15000 // 15 seconds for tmux commands

export class TmuxAdapter {
  private logger = logger.createChild({ component: 'TmuxAdapter' })
  private sessionCache: { exists: boolean; lastCheck: number } | null = null
  private readonly cacheTimeout = 5000 // 5 seconds

  constructor() {
    this.validateTmuxInstallation()
  }

  /**
   * Validate that tmux is installed and accessible
   */
  private async validateTmuxInstallation(): Promise<void> {
    const isAvailable = await CommandExecutor.validateCommand('tmux')
    if (!isAvailable) {
      throw new TmuxError('tmux command not found. Please install tmux first.')
    }
  }

  /**
   * List all windows in the claude-tmux-manager session with comprehensive error handling
   */
  async listWindows(): Promise<WindowInfo[]> {
    this.logger.debug('Listing tmux windows')

    try {
      const sessionExists = await this.sessionExists()
      if (!sessionExists) {
        this.logger.info('Tmux session does not exist, returning empty window list')
        return []
      }

      const command = `tmux list-windows -t ${CommandExecutor.escapeShellArg(TMUX_SESSION)} -F "#{window_name}#{?pane_current_path,:#{pane_current_path},}"`
      
      const result = await CommandExecutor.execute(command, {
        timeout: COMMAND_TIMEOUT
      })
      
      const windows = this.parseWindowList(result.stdout)
      this.logger.debug(`Found ${windows.length} windows`, { windowCount: windows.length })
      
      return windows
    } catch (error) {
      this.logger.error('Failed to list tmux windows', error)
      if (error instanceof TmuxError) {
        throw error
      }
      throw new TmuxError(
        'Failed to list tmux windows', 
        'tmux list-windows',
        (error as any)?.code
      )
    }
  }

  /**
   * Parse the output from tmux list-windows command
   */
  private parseWindowList(output: string): WindowInfo[] {
    if (!output?.trim()) {
      return []
    }

    const windows: WindowInfo[] = []
    const lines = output.trim().split('\n')

    for (const line of lines) {
      if (!line.trim()) continue

      try {
        // Use lastIndexOf to handle window names that contain colons (e.g., "project:feature")
        const colonIndex = line.lastIndexOf(':')
        if (colonIndex === -1) {
          this.logger.warn('Invalid window format, no path separator', { line })
          continue
        }

        const name = line.substring(0, colonIndex)
        const panePath = line.substring(colonIndex + 1)

        if (!name || !panePath) {
          this.logger.warn('Invalid window format, missing name or path', { line })
          continue
        }

        // Validate window name format
        if (!this.isValidWindowName(name)) {
          this.logger.warn('Invalid window name format', { name })
          continue
        }

        windows.push({ name, panePath })
      } catch (error) {
        this.logger.warn('Error parsing window line', { line, errorMessage: (error as Error).message })
        continue
      }
    }

    return windows
  }

  /**
   * Create a new tmux window with comprehensive validation and error handling
   */
  async createWindow(name: string, path: string): Promise<void> {
    this.logger.debug('Creating tmux window', { name, path })

    // Validate inputs
    this.validateWindowName(name)
    this.validatePath(path)
    
    // Expand path for tilde support
    const expandedPath = expandPath(path)

    try {
      // Ensure session exists before creating window
      await this.ensureSession()

      // Check if window already exists
      const existingWindows = await this.listWindows()
      if (existingWindows.some(w => w.name === name)) {
        throw new TmuxError(`Window '${name}' already exists`)
      }

      const command = `tmux new-window -t ${CommandExecutor.escapeShellArg(TMUX_SESSION)} -n ${CommandExecutor.escapeShellArg(name)} -c ${CommandExecutor.escapeShellArg(expandedPath)} \\; send-keys "export $(cat .env | xargs) && claude --dangerously-skip-permissions" Enter`
      
      await CommandExecutor.execute(command, {
        timeout: COMMAND_TIMEOUT
      })

      this.logger.info('Successfully created tmux window', { name, path })
    } catch (error) {
      this.logger.error('Failed to create tmux window', error, { name, path })
      if (error instanceof TmuxError || error instanceof ValidationError) {
        throw error
      }
              const cmd = `tmux new-window -t ${CommandExecutor.escapeShellArg(TMUX_SESSION)} -n ${CommandExecutor.escapeShellArg(name)} -c ${CommandExecutor.escapeShellArg(expandedPath)} \\; send-keys "export $(cat .env | xargs) && claude --dangerously-skip-permissions" Enter`
      throw new TmuxError(
        `Failed to create window '${name}': ${(error as Error).message}`,
        cmd,
        (error as any)?.code
      )
    }
  }

  /**
   * Send command to an existing tmux window
   */
  async sendCommand(windowName: string, command: string): Promise<void> {
    this.logger.debug('Sending command to tmux window', { windowName, command })

    // Validate inputs
    this.validateWindowName(windowName)
    if (!command || typeof command !== 'string') {
      throw new ValidationError('Command must be a non-empty string', 'command', command)
    }

    try {
      // Ensure session exists
      const sessionExists = await this.sessionExists()
      if (!sessionExists) {
        throw new TmuxError(`Tmux session '${TMUX_SESSION}' does not exist`)
      }

      // Check if window exists
      const existingWindows = await this.listWindows()
      if (!existingWindows.some(w => w.name === windowName)) {
        throw new TmuxError(`Window '${windowName}' does not exist`)
      }

      // Send the command text first
      const sendCommandText = `tmux send-keys -t ${CommandExecutor.escapeShellArg(TMUX_SESSION)}:${CommandExecutor.escapeShellArg(windowName)} ${CommandExecutor.escapeShellArg(command)}`
      
      await CommandExecutor.execute(sendCommandText, {
        timeout: COMMAND_TIMEOUT
      })

      // Wait 0.5 seconds for UI to register
      await new Promise(resolve => setTimeout(resolve, 500))

      // Send Enter to submit
      const sendEnter = `tmux send-keys -t ${CommandExecutor.escapeShellArg(TMUX_SESSION)}:${CommandExecutor.escapeShellArg(windowName)} Enter`
      
      await CommandExecutor.execute(sendEnter, {
        timeout: COMMAND_TIMEOUT
      })

      this.logger.info('Successfully sent command to tmux window', { windowName, command })
    } catch (error) {
      this.logger.error('Failed to send command to tmux window', error, { windowName, command })
      if (error instanceof TmuxError || error instanceof ValidationError) {
        throw error
      }
      throw new TmuxError(
        `Failed to send command to window '${windowName}': ${(error as Error).message}`,
        `tmux send-keys -t ${TMUX_SESSION}:${windowName}`,
        (error as any)?.code
      )
    }
  }

  /**
   * Kill a tmux window by name with proper error handling
   */
  async killWindow(name: string): Promise<void> {
    this.logger.debug('Killing tmux window', { name })

    this.validateWindowName(name)

    try {
      const command = `tmux kill-window -t ${CommandExecutor.escapeShellArg(TMUX_SESSION)}:${CommandExecutor.escapeShellArg(name)}`
      
      await CommandExecutor.execute(command, {
        timeout: COMMAND_TIMEOUT,
        retries: 1 // Less retries for kill operations
      })

      this.logger.info('Successfully killed tmux window', { name })
    } catch (error) {
      // Check if the error is because the window doesn't exist
      if ((error as any)?.stderr?.includes("can't find window")) {
        this.logger.warn('Attempted to kill non-existent window', { name })
        return // Don't throw error for non-existent windows
      }

      this.logger.error('Failed to kill tmux window', error, { name })
      const cmd = `tmux kill-window -t ${CommandExecutor.escapeShellArg(TMUX_SESSION)}:${CommandExecutor.escapeShellArg(name)}`
      throw new TmuxError(
        `Failed to kill window '${name}': ${(error as Error).message}`,
        cmd,
        (error as any)?.code
      )
    }
  }

  /**
   * Capture the output of a pane with enhanced error handling and options
   */
  async capturePane(windowName: string, options: { lines?: number; includeEscapes?: boolean } = {}): Promise<string> {
    this.logger.debug('Capturing pane output', { windowName, options })

    this.validateWindowName(windowName)

    try {
      const { lines = 1000, includeEscapes = false } = options
      
      let command = `tmux capture-pane -t ${CommandExecutor.escapeShellArg(TMUX_SESSION)}:${CommandExecutor.escapeShellArg(windowName)} -p`
      
      // Add line limit if specified
      if (lines > 0) {
        command += ` -S -${lines}`
      }
      
      // Include escape sequences if requested
      if (includeEscapes) {
        command += ' -e'
      }

      const result = await CommandExecutor.execute(command, {
        timeout: COMMAND_TIMEOUT,
        suppressErrors: true // Don't throw on capture failures
      })

      if (result.exitCode !== 0) {
        this.logger.warn('Failed to capture pane output', { 
          windowName, 
          exitCode: result.exitCode, 
          stderr: result.stderr 
        })
        return ''
      }

      this.logger.debug('Successfully captured pane output', { 
        windowName, 
        outputLength: result.stdout.length 
      })
      
      return result.stdout
    } catch (error) {
      this.logger.warn('Error capturing pane output', { windowName, errorMessage: (error as Error).message })
      return '' // Return empty string on error rather than throwing
    }
  }

  /**
   * Check if the tmux session exists with caching for performance
   */
  async sessionExists(): Promise<boolean> {
    const now = Date.now()
    
    // Use cached result if it's fresh
    if (this.sessionCache && (now - this.sessionCache.lastCheck) < this.cacheTimeout) {
      return this.sessionCache.exists
    }

    try {
      const command = `tmux has-session -t ${CommandExecutor.escapeShellArg(TMUX_SESSION)}`
      
      await CommandExecutor.execute(command, {
        timeout: 5000, // Shorter timeout for session checks
        retries: 0,     // No retries for session checks
        suppressErrors: true
      })

      this.sessionCache = { exists: true, lastCheck: now }
      return true
    } catch {
      this.sessionCache = { exists: false, lastCheck: now }
      return false
    }
  }

  /**
   * Create the tmux session if it doesn't exist
   */
  async ensureSession(): Promise<void> {
    this.logger.debug('Ensuring tmux session exists')

    try {
      const exists = await this.sessionExists()
      
      if (exists) {
        this.logger.debug('Tmux session already exists')
        return
      }

      this.logger.info('Creating new tmux session', { session: TMUX_SESSION })
      
      const command = `tmux new-session -d -s ${CommandExecutor.escapeShellArg(TMUX_SESSION)}`
      
      await CommandExecutor.execute(command, {
        timeout: COMMAND_TIMEOUT
      })

      // Invalidate cache since we just created the session
      this.sessionCache = { exists: true, lastCheck: Date.now() }
      
      this.logger.info('Successfully created tmux session', { session: TMUX_SESSION })
    } catch (error) {
      this.logger.error('Failed to ensure tmux session', error)
      throw new TmuxError(
        `Failed to create tmux session '${TMUX_SESSION}': ${(error as Error).message}`,
        `tmux new-session -d -s ${TMUX_SESSION}`,
        (error as any)?.code
      )
    }
  }

  /**
   * Validate window name format and length
   */
  private validateWindowName(name: string): void {
    if (!name || typeof name !== 'string') {
      throw new ValidationError('Window name must be a non-empty string', 'name', name)
    }

    if (name.length > MAX_WINDOW_NAME_LENGTH) {
      throw new ValidationError(
        `Window name must be ${MAX_WINDOW_NAME_LENGTH} characters or less`,
        'name',
        name
      )
    }

    if (!WINDOW_NAME_REGEX.test(name)) {
      throw new ValidationError(
        'Window name contains invalid characters. Use only alphanumeric, colon, underscore, dot, and hyphen.',
        'name',
        name
      )
    }
  }

  /**
   * Check if window name is valid without throwing
   */
  private isValidWindowName(name: string): boolean {
    try {
      this.validateWindowName(name)
      return true
    } catch {
      return false
    }
  }

  /**
   * Validate path exists and is accessible
   */
  private validatePath(path: string): void {
    if (!path || typeof path !== 'string') {
      throw new ValidationError('Path must be a non-empty string', 'path', path)
    }

    // Basic path validation - more comprehensive validation could be added
    if (path.includes('\0')) {
      throw new ValidationError('Path contains null character', 'path', path)
    }
  }

  /**
   * Get session information for debugging
   */
  async getSessionInfo(): Promise<{ name: string; windows: number; exists: boolean }> {
    const exists = await this.sessionExists()
    const windows = exists ? await this.listWindows() : []
    
    return {
      name: TMUX_SESSION,
      windows: windows.length,
      exists
    }
  }

  /**
   * Clear session cache (useful for testing or after external session changes)
   */
  clearCache(): void {
    this.sessionCache = null
  }
}

// Export singleton instance
export const tmuxAdapter = new TmuxAdapter()