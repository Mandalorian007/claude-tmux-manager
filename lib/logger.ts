/**
 * Logging utility for Claude TMux Manager
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export interface LogContext {
  [key: string]: unknown
}

export class Logger {
  private static instance: Logger
  private logLevel: LogLevel = LogLevel.INFO
  private isDevelopment = process.env.NODE_ENV === 'development'

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger()
    }
    return Logger.instance
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level
  }

  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context)
  }

  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context)
  }

  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context)
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorContext = error ? this.formatError(error) : {}
    this.log(LogLevel.ERROR, message, { ...context, ...errorContext })
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    if (level < this.logLevel) return

    const timestamp = new Date().toISOString()
    const levelName = LogLevel[level]
    const prefix = `[${timestamp}] ${levelName}:`

    if (this.isDevelopment) {
      // Rich console logging in development
      const style = this.getConsoleStyle(level)
      console.log(`%c${prefix}`, style, message, context || '')
    } else {
      // JSON logging in production
      const logEntry = {
        timestamp,
        level: levelName,
        message,
        ...context
      }
      console.log(JSON.stringify(logEntry))
    }
  }

  private formatError(error: unknown): LogContext {
    if (error instanceof Error) {
      return {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
          ...(error as any) // Include custom error properties
        }
      }
    }
    return { error: String(error) }
  }

  private getConsoleStyle(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG:
        return 'color: #666; font-size: 11px;'
      case LogLevel.INFO:
        return 'color: #007acc; font-weight: bold;'
      case LogLevel.WARN:
        return 'color: #ff8c00; font-weight: bold;'
      case LogLevel.ERROR:
        return 'color: #dc3545; font-weight: bold;'
      default:
        return ''
    }
  }

  /**
   * Create a child logger with persistent context
   */
  createChild(context: LogContext): ChildLogger {
    return new ChildLogger(this, context)
  }
}

class ChildLogger {
  constructor(
    private parent: Logger, 
    private context: LogContext
  ) {}

  debug(message: string, additionalContext?: LogContext): void {
    this.parent.debug(message, { ...this.context, ...additionalContext })
  }

  info(message: string, additionalContext?: LogContext): void {
    this.parent.info(message, { ...this.context, ...additionalContext })
  }

  warn(message: string, additionalContext?: LogContext): void {
    this.parent.warn(message, { ...this.context, ...additionalContext })
  }

  error(message: string, error?: Error | unknown, additionalContext?: LogContext): void {
    this.parent.error(message, error, { ...this.context, ...additionalContext })
  }
}

// Export singleton instance
export const logger = Logger.getInstance()