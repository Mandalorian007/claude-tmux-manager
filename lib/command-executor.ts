import { exec, ExecOptions } from 'child_process'
import { promisify } from 'util'
import { CommandTimeoutError } from './errors'

const execAsync = promisify(exec)

export interface CommandResult {
  stdout: string
  stderr: string
  exitCode: number
}

export interface ExecuteOptions extends ExecOptions {
  timeout?: number
  retries?: number
  retryDelay?: number
  suppressErrors?: boolean
}

export class CommandExecutor {
  private static readonly DEFAULT_TIMEOUT = 10000 // 10 seconds
  private static readonly DEFAULT_RETRIES = 2
  private static readonly DEFAULT_RETRY_DELAY = 1000 // 1 second

  /**
   * Execute a shell command with timeout, retry logic, and comprehensive error handling
   */
  static async execute(
    command: string, 
    options: ExecuteOptions = {}
  ): Promise<CommandResult> {
    const {
      timeout = this.DEFAULT_TIMEOUT,
      retries = this.DEFAULT_RETRIES,
      retryDelay = this.DEFAULT_RETRY_DELAY,
      suppressErrors = false,
      ...execOptions
    } = options

    let lastError: Error | null = null

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => {
          controller.abort()
        }, timeout)

        const result = await execAsync(command, {
          ...execOptions,
          signal: controller.signal,
          maxBuffer: 1024 * 1024 // 1MB buffer
        })

        clearTimeout(timeoutId)

        return {
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: 0
        }
      } catch (error: any) {
        lastError = error

        // Handle timeout specifically
        if (error.code === 'ABORT_ERR' || error.signal === 'SIGKILL') {
          throw new CommandTimeoutError(
            `Command timed out after ${timeout}ms: ${command}`,
            command,
            timeout
          )
        }

        // Don't retry on certain errors
        if (this.isNonRetriableError(error)) {
          break
        }

        // If this is not the last attempt, wait before retrying
        if (attempt < retries) {
          await this.sleep(retryDelay)
          continue
        }
      }
    }

    // If we get here, all retries failed
    if (!suppressErrors && lastError) {
      throw lastError
    }

    return {
      stdout: '',
      stderr: lastError?.message || '',
      exitCode: (lastError as any)?.code || 1
    }
  }

  /**
   * Execute a command that is expected to fail (returns success on failure)
   */
  static async executeExpectingFailure(
    command: string, 
    options: ExecuteOptions = {}
  ): Promise<boolean> {
    try {
      await this.execute(command, { ...options, suppressErrors: true })
      return false // Command succeeded when we expected failure
    } catch {
      return true // Command failed as expected
    }
  }

  /**
   * Check if an error should not be retried
   */
  private static isNonRetriableError(error: any): boolean {
    if (!error.code) return false

    const nonRetriableCodes = [
      'ENOENT', // Command not found
      'EACCES', // Permission denied
      'EPERM',  // Operation not permitted
    ]

    return nonRetriableCodes.includes((error as any).code)
  }

  /**
   * Sleep for a given number of milliseconds
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Safely escape shell arguments
   */
  static escapeShellArg(arg: string): string {
    return `"${arg.replace(/"/g, '\\"')}"`
  }

  /**
   * Validate that required commands are available
   */
  static async validateCommand(command: string): Promise<boolean> {
    try {
      await this.execute(`which ${command}`, { suppressErrors: true })
      return true
    } catch {
      return false
    }
  }
}