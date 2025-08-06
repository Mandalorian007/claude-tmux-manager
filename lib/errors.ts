/**
 * Custom error types for Claude TMux Manager
 */

export class TmuxError extends Error {
  constructor(message: string, public command?: string, public exitCode?: number) {
    super(message)
    this.name = 'TmuxError'
  }
}

export class GitError extends Error {
  constructor(message: string, public command?: string, public exitCode?: number, public repoPath?: string) {
    super(message)
    this.name = 'GitError'
  }
}

export class SessionError extends Error {
  constructor(message: string, public sessionName?: string) {
    super(message)
    this.name = 'SessionError'
  }
}

export class ValidationError extends Error {
  constructor(message: string, public field?: string, public value?: unknown) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class CommandTimeoutError extends Error {
  constructor(message: string, public command: string, public timeout: number) {
    super(message)
    this.name = 'CommandTimeoutError'
  }
}

export class WindowError extends Error {
  constructor(message: string, public windowName?: string, public projectName?: string) {
    super(message)
    this.name = 'WindowError'
  }
}