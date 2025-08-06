import path from 'path'
import fs from 'fs/promises'
import type { GitStats } from '@/types'
import { CommandExecutor } from '../command-executor'
import { GitError, ValidationError } from '../errors'
import { logger } from '../logger'
import { expandPath } from '../utils'

const GIT_COMMAND_TIMEOUT = 30000 // 30 seconds for git operations
const WORKTREE_DIR = '.worktrees'
const BRANCH_PREFIX = 'feature/'
const VALID_FEATURE_NAME_REGEX = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/

export class GitAdapter {
  private logger = logger.createChild({ component: 'GitAdapter' })
  private gitStatusCache = new Map<string, { stats: GitStats; timestamp: number }>()
  private readonly cacheTimeout = 10000 // 10 seconds

  constructor() {
    this.validateGitInstallation()
  }

  /**
   * Validate that git is installed and accessible
   */
  private async validateGitInstallation(): Promise<void> {
    const isAvailable = await CommandExecutor.validateCommand('git')
    if (!isAvailable) {
      throw new GitError('git command not found. Please install git first.')
    }
  }

  /**
   * Get comprehensive git status for a repository with caching and error handling
   */
  async getStatus(repoPath: string): Promise<GitStats> {
    this.logger.debug('Getting git status', { repoPath })
    
    this.validatePath(repoPath)
    
    // Check cache first
    const cacheKey = repoPath
    const cached = this.gitStatusCache.get(cacheKey)
    const now = Date.now()
    
    if (cached && (now - cached.timestamp) < this.cacheTimeout) {
      this.logger.debug('Returning cached git status', { repoPath })
      return cached.stats
    }

    try {
      // Verify this is a git repository
      await this.ensureGitRepository(repoPath)
      
      const [branch, remoteStatus, fileStatus] = await Promise.all([
        this.getCurrentBranch(repoPath),
        this.getRemoteStatus(repoPath),
        this.getFileStatus(repoPath)
      ])

      const stats: GitStats = {
        branch,
        ahead: remoteStatus.ahead,
        behind: remoteStatus.behind,
        staged: fileStatus.staged,
        unstaged: fileStatus.unstaged,
        untracked: fileStatus.untracked,
        hasUncommittedChanges: fileStatus.staged > 0 || fileStatus.unstaged > 0 || fileStatus.untracked > 0
      }

      // Cache the result
      this.gitStatusCache.set(cacheKey, { stats, timestamp: now })
      
      this.logger.debug('Successfully retrieved git status', { repoPath, stats })
      return stats
    } catch (error) {
      this.logger.error('Failed to get git status', error, { repoPath })
      
      // Return safe defaults on error
      const defaultStats: GitStats = {
        branch: 'unknown',
        ahead: 0,
        behind: 0,
        staged: 0,
        unstaged: 0,
        untracked: 0,
        hasUncommittedChanges: false
      }
      
      // Cache the error result briefly to avoid repeated failures
      this.gitStatusCache.set(cacheKey, { stats: defaultStats, timestamp: now })
      
      return defaultStats
    }
  }

  /**
   * Get the current git branch
   */
  private async getCurrentBranch(repoPath: string): Promise<string> {
    const expandedPath = expandPath(repoPath)
    const result = await CommandExecutor.execute(
      'git rev-parse --abbrev-ref HEAD',
      { cwd: expandedPath, timeout: 5000 }
    )
    
    const branch = result.stdout.trim()
    if (!branch) {
      throw new GitError('Unable to determine current branch', 'git rev-parse --abbrev-ref HEAD', 0, repoPath)
    }
    
    return branch
  }

  /**
   * Get remote tracking status (ahead/behind)
   */
  private async getRemoteStatus(repoPath: string): Promise<{ ahead: number; behind: number }> {
    try {
      // First check if we have a remote tracking branch
      const expandedPath = expandPath(repoPath)
      const trackingResult = await CommandExecutor.execute(
        'git rev-parse --abbrev-ref @{upstream}',
        { cwd: expandedPath, timeout: 5000, suppressErrors: true }
      )
      
      if (trackingResult.exitCode !== 0) {
        // No upstream branch configured
        return { ahead: 0, behind: 0 }
      }
      
      const upstream = trackingResult.stdout.trim()
      
      // Get ahead/behind counts
      const countResult = await CommandExecutor.execute(
        `git rev-list --left-right --count ${CommandExecutor.escapeShellArg(upstream)}...HEAD`,
        { cwd: expandedPath, timeout: 10000 }
      )
      
      const [behindStr, aheadStr] = countResult.stdout.trim().split('\t')
      const behind = parseInt(behindStr, 10) || 0
      const ahead = parseInt(aheadStr, 10) || 0
      
      return { ahead, behind }
    } catch (error) {
      this.logger.debug('Unable to get remote status', { repoPath, error })
      return { ahead: 0, behind: 0 }
    }
  }

  /**
   * Get file status counts (staged, unstaged, untracked)
   */
  private async getFileStatus(repoPath: string): Promise<{ staged: number; unstaged: number; untracked: number }> {
    const expandedPath = expandPath(repoPath)
    const result = await CommandExecutor.execute(
      'git status --porcelain=v1',
      { cwd: expandedPath, timeout: 10000 }
    )

    let staged = 0
    let unstaged = 0
    let untracked = 0

    const lines = result.stdout.split('\n')
    for (const line of lines) {
      if (!line.trim()) continue
      
      if (line.length < 2) {
        this.logger.warn('Invalid git status line', { line, repoPath })
        continue
      }
      
      const indexStatus = line[0]
      const workingStatus = line[1]

      if (indexStatus === '?' && workingStatus === '?') {
        untracked++
      } else {
        if (indexStatus !== ' ' && indexStatus !== '?') staged++
        if (workingStatus !== ' ' && workingStatus !== '?') unstaged++
      }
    }

    return { staged, unstaged, untracked }
  }

  /**
   * Create a git worktree with comprehensive validation and error handling
   */
  async createWorktree(projectPath: string, featureName: string): Promise<string> {
    this.logger.debug('Creating git worktree', { projectPath, featureName })
    
    // Validate inputs
    this.validatePath(projectPath)
    this.validateFeatureName(featureName)
    
    // Expand path early to handle tilde notation
    const expandedProjectPath = expandPath(projectPath)
    const worktreePath = path.join(expandedProjectPath, WORKTREE_DIR, featureName)
    const branchName = `${BRANCH_PREFIX}${featureName}`

    try {
      // Ensure we're in a git repository
      await this.ensureGitRepository(projectPath)
      
      // Check if worktree already exists
      await this.validateWorktreeDoesNotExist(projectPath, featureName)
      
      // Check if branch already exists
      await this.validateBranchDoesNotExist(projectPath, branchName)
      
      // Ensure worktrees directory exists
      const worktreesDir = path.join(expandedProjectPath, WORKTREE_DIR)
      await this.ensureDirectory(worktreesDir)
      
      // Create the worktree and branch
      const command = `git worktree add ${CommandExecutor.escapeShellArg(worktreePath)} -b ${CommandExecutor.escapeShellArg(branchName)}`
      
      await CommandExecutor.execute(command, {
        cwd: expandedProjectPath,
        timeout: GIT_COMMAND_TIMEOUT
      })
      
      // Verify the worktree was created successfully
      await this.verifyWorktreeExists(worktreePath)
      
      this.logger.info('Successfully created git worktree', { 
        projectPath, 
        featureName, 
        worktreePath,
        branchName
      })
      
      return worktreePath
    } catch (error) {
      this.logger.error('Failed to create git worktree', error, { 
        projectPath, 
        featureName, 
        worktreePath,
        branchName
      })
      
      // Cleanup on failure
      await this.cleanupFailedWorktree(worktreePath, projectPath, branchName)
      
      if (error instanceof GitError || error instanceof ValidationError) {
        throw error
      }
      
      throw new GitError(
        `Failed to create worktree for feature '${featureName}': ${(error as Error).message}`,
        'git worktree add',
        (error as any)?.code,
        projectPath
      )
    }
  }

  /**
   * Remove a git worktree with comprehensive cleanup and error handling
   */
  async removeWorktree(projectPath: string, featureName: string): Promise<void> {
    this.logger.debug('Removing git worktree', { projectPath, featureName })
    
    this.validatePath(projectPath)
    this.validateFeatureName(featureName)
    
    const expandedProjectPath = expandPath(projectPath)
    const worktreePath = path.join(expandedProjectPath, WORKTREE_DIR, featureName)
    const branchName = `${BRANCH_PREFIX}${featureName}`

    try {
      await this.ensureGitRepository(projectPath)
      
      // Check if worktree exists before trying to remove it
      const worktreeExists = await this.worktreeExists(worktreePath)
      
      if (worktreeExists) {
        // First try to remove the worktree gracefully
        const removeCommand = `git worktree remove ${CommandExecutor.escapeShellArg(worktreePath)}`
        
        const removeResult = await CommandExecutor.execute(removeCommand, {
          cwd: expandedProjectPath,
          timeout: GIT_COMMAND_TIMEOUT,
          suppressErrors: true
        })
        
        if (removeResult.exitCode !== 0) {
          this.logger.warn('Failed to remove worktree gracefully, trying force removal', {
            worktreePath,
            stderr: removeResult.stderr
          })
          
          // Try force removal
          const forceCommand = `git worktree remove --force ${CommandExecutor.escapeShellArg(worktreePath)}`
          await CommandExecutor.execute(forceCommand, {
            cwd: expandedProjectPath,
            timeout: GIT_COMMAND_TIMEOUT
          })
        }
      } else {
        this.logger.info('Worktree does not exist, skipping removal', { worktreePath })
      }

      // Clean up the local branch if it exists
      await this.cleanupBranch(projectPath, branchName)
      
      // Clean up remote tracking branch if it exists
      await this.cleanupRemoteBranch(projectPath, branchName)
      
      // Clear cache for this path
      this.clearStatusCache(worktreePath)
      
      this.logger.info('Successfully removed git worktree', { 
        projectPath, 
        featureName, 
        worktreePath,
        branchName
      })
    } catch (error) {
      this.logger.error('Failed to remove git worktree', error, { 
        projectPath, 
        featureName, 
        worktreePath,
        branchName
      })
      
      if (error instanceof GitError || error instanceof ValidationError) {
        throw error
      }
      
      throw new GitError(
        `Failed to remove worktree for feature '${featureName}': ${(error as Error).message}`,
        'git worktree remove',
        (error as any)?.code,
        projectPath
      )
    }
  }

  /**
   * Roll back uncommitted changes in a worktree with comprehensive cleanup
   */
  async rollbackChanges(worktreePath: string): Promise<void> {
    this.logger.debug('Rolling back git changes', { worktreePath })
    
    this.validatePath(worktreePath)
    
    try {
      await this.ensureGitRepository(worktreePath)
      
      // Get current status to see what needs to be cleaned up
      const status = await this.getStatus(worktreePath)
      
      if (!status.hasUncommittedChanges) {
        this.logger.debug('No uncommitted changes to roll back', { worktreePath })
        return
      }
      
      this.logger.info('Rolling back uncommitted changes', {
        worktreePath,
        staged: status.staged,
        unstaged: status.unstaged,
        untracked: status.untracked
      })
      
      // Expand path once for use throughout the method
      const expandedWorktreePath = expandPath(worktreePath)
      
      // Stash any tracked changes (staged + unstaged)
      if (status.staged > 0 || status.unstaged > 0) {
        const stashResult = await CommandExecutor.execute(
          'git stash push --include-untracked -m "Auto-stash before session deletion"',
          {
            cwd: expandedWorktreePath,
            timeout: GIT_COMMAND_TIMEOUT,
            suppressErrors: true
          }
        )
        
        if (stashResult.exitCode === 0) {
          this.logger.debug('Successfully stashed changes', { worktreePath })
        } else {
          this.logger.warn('Failed to stash changes, trying reset', {
            worktreePath,
            stderr: stashResult.stderr
          })
          
          // Fallback: reset staged changes
          await CommandExecutor.execute(
            'git reset HEAD .',
            {
              cwd: expandedWorktreePath,
              timeout: GIT_COMMAND_TIMEOUT,
              suppressErrors: true
            }
          )
          
          // Checkout to discard unstaged changes
          await CommandExecutor.execute(
            'git checkout -- .',
            {
              cwd: expandedWorktreePath,
              timeout: GIT_COMMAND_TIMEOUT,
              suppressErrors: true
            }
          )
        }
      }
      
      // Clean up untracked files
      if (status.untracked > 0) {
        await CommandExecutor.execute(
          'git clean -fd',
          {
            cwd: expandedWorktreePath,
            timeout: GIT_COMMAND_TIMEOUT,
            suppressErrors: true
          }
        )
      }
      
      // Clear cache as status has changed
      this.clearStatusCache(worktreePath)
      
      this.logger.info('Successfully rolled back changes', { worktreePath })
    } catch (error) {
      this.logger.error('Failed to roll back changes', error, { worktreePath })
      // Don't throw here as this is cleanup code
    }
  }

  /**
   * Extract project name from project path
   */
  getProjectName(projectPath: string): string {
    this.validatePath(projectPath)
    const projectName = path.basename(projectPath)
    
    if (!projectName || projectName === '.' || projectName === '/') {
      throw new ValidationError('Invalid project path', 'projectPath', projectPath)
    }
    
    return projectName
  }
  
  /**
   * Validate that a path exists and is accessible
   */
  private validatePath(repoPath: string): void {
    if (!repoPath || typeof repoPath !== 'string') {
      throw new ValidationError('Path must be a non-empty string', 'path', repoPath)
    }
    
    if (repoPath.includes('\0')) {
      throw new ValidationError('Path contains null character', 'path', repoPath)
    }
  }
  
  /**
   * Validate feature name format
   */
  private validateFeatureName(featureName: string): void {
    if (!featureName || typeof featureName !== 'string') {
      throw new ValidationError('Feature name must be a non-empty string', 'featureName', featureName)
    }
    
    if (featureName.length > 100) {
      throw new ValidationError('Feature name must be 100 characters or less', 'featureName', featureName)
    }
    
    if (!VALID_FEATURE_NAME_REGEX.test(featureName)) {
      throw new ValidationError(
        'Feature name must be lowercase, start and end with alphanumeric, and contain only alphanumeric and hyphens',
        'featureName',
        featureName
      )
    }
  }
  
  /**
   * Ensure we're working with a git repository
   */
  private async ensureGitRepository(repoPath: string): Promise<void> {
    const expandedPath = expandPath(repoPath)
    const result = await CommandExecutor.execute(
      'git rev-parse --git-dir',
      {
        cwd: expandedPath,
        timeout: 5000,
        suppressErrors: true
      }
    )
    
    if (result.exitCode !== 0) {
      throw new GitError(
        `Directory is not a git repository: ${expandedPath} (original: ${repoPath})`,
        'git rev-parse --git-dir',
        result.exitCode,
        expandedPath
      )
    }
  }
  
  /**
   * Validate that a worktree doesn't already exist
   */
  private async validateWorktreeDoesNotExist(projectPath: string, featureName: string): Promise<void> {
    const expandedProjectPath = expandPath(projectPath)
    const worktreePath = path.join(expandedProjectPath, WORKTREE_DIR, featureName)
    
    try {
      await fs.access(worktreePath)
      throw new GitError(
        `Worktree already exists: ${worktreePath}`,
        undefined,
        undefined,
        projectPath
      )
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // Good, worktree doesn't exist
        return
      }
      throw error
    }
  }
  
  /**
   * Validate that a branch doesn't already exist
   */
  private async validateBranchDoesNotExist(projectPath: string, branchName: string): Promise<void> {
    const expandedProjectPath = expandPath(projectPath)
    const result = await CommandExecutor.execute(
      `git show-ref --verify --quiet refs/heads/${CommandExecutor.escapeShellArg(branchName)}`,
      {
        cwd: expandedProjectPath,
        timeout: 5000,
        suppressErrors: true
      }
    )
    
    if (result.exitCode === 0) {
      throw new GitError(
        `Branch already exists: ${branchName}`,
        'git show-ref',
        0,
        projectPath
      )
    }
  }
  
  /**
   * Ensure a directory exists
   */
  private async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true })
    } catch (error) {
      throw new GitError(
        `Failed to create directory: ${dirPath}`,
        'mkdir',
        (error as any)?.code
      )
    }
  }
  
  /**
   * Verify that a worktree was created successfully
   */
  private async verifyWorktreeExists(worktreePath: string): Promise<void> {
    const expandedWorktreePath = expandPath(worktreePath)
    try {
      await fs.access(expandedWorktreePath)
      
      // Also verify it's a valid git worktree
      await CommandExecutor.execute(
        'git rev-parse --git-dir',
        {
          cwd: expandedWorktreePath,
          timeout: 5000
        }
      )
    } catch (error) {
      throw new GitError(
        `Failed to verify worktree creation: ${expandedWorktreePath} (original: ${worktreePath})`,
        'verification',
        (error as any)?.code
      )
    }
  }
  
  /**
   * Check if a worktree exists
   */
  private async worktreeExists(worktreePath: string): Promise<boolean> {
    try {
      const expandedWorktreePath = expandPath(worktreePath)
      await fs.access(expandedWorktreePath)
      return true
    } catch {
      return false
    }
  }
  
  /**
   * Clean up a failed worktree creation
   */
  private async cleanupFailedWorktree(
    worktreePath: string, 
    projectPath: string, 
    branchName: string
  ): Promise<void> {
    try {
      // Try to remove the worktree if it exists
      const expandedProjectPath = expandPath(projectPath)
      const exists = await this.worktreeExists(worktreePath)
      if (exists) {
        await CommandExecutor.execute(
          `git worktree remove --force ${CommandExecutor.escapeShellArg(worktreePath)}`,
          {
            cwd: expandedProjectPath,
            timeout: GIT_COMMAND_TIMEOUT,
            suppressErrors: true
          }
        )
      }
      
      // Try to delete the branch if it was created
      await CommandExecutor.execute(
        `git branch -D ${CommandExecutor.escapeShellArg(branchName)}`,
        {
          cwd: expandedProjectPath,
          timeout: 5000,
          suppressErrors: true
        }
      )
    } catch {
      // Ignore cleanup errors
    }
  }
  
  /**
   * Clean up a local branch
   */
  private async cleanupBranch(projectPath: string, branchName: string): Promise<void> {
    const expandedProjectPath = expandPath(projectPath)
    const result = await CommandExecutor.execute(
      `git branch -D ${CommandExecutor.escapeShellArg(branchName)}`,
      {
        cwd: expandedProjectPath,
        timeout: 5000,
        suppressErrors: true
      }
    )
    
    if (result.exitCode === 0) {
      this.logger.debug('Successfully deleted local branch', { branchName })
    } else if (!result.stderr.includes('not found')) {
      this.logger.warn('Failed to delete local branch', { 
        branchName, 
        stderr: result.stderr 
      })
    }
  }
  
  /**
   * Clean up remote tracking branch
   */
  private async cleanupRemoteBranch(projectPath: string, branchName: string): Promise<void> {
    // Check if there's a remote tracking branch
    const expandedProjectPath = expandPath(projectPath)
    const remoteResult = await CommandExecutor.execute(
      `git ls-remote --heads origin ${CommandExecutor.escapeShellArg(branchName)}`,
      {
        cwd: expandedProjectPath,
        timeout: 10000,
        suppressErrors: true
      }
    )
    
    if (remoteResult.exitCode === 0 && remoteResult.stdout.trim()) {
      this.logger.info('Remote branch exists, consider cleaning up manually', { 
        branchName,
        remote: 'origin'
      })
      // Note: We don't automatically delete remote branches as this could be destructive
      // Users should delete remote branches manually or via PR cleanup
    }
  }
  
  /**
   * Clear status cache for a specific path
   */
  private clearStatusCache(repoPath?: string): void {
    if (repoPath) {
      this.gitStatusCache.delete(repoPath)
    } else {
      this.gitStatusCache.clear()
    }
  }
  
  /**
   * Get repository information for debugging
   */
  async getRepositoryInfo(repoPath: string): Promise<{
    isRepo: boolean;
    branch?: string;
    remoteUrl?: string;
    worktrees?: string[];
  }> {
    try {
      await this.ensureGitRepository(repoPath)
      
      const expandedRepoPath = expandPath(repoPath)
      const [branch, remoteUrl, worktreesOutput] = await Promise.all([
        this.getCurrentBranch(repoPath),
        CommandExecutor.execute(
          'git config --get remote.origin.url',
          { cwd: expandedRepoPath, timeout: 5000, suppressErrors: true }
        ),
        CommandExecutor.execute(
          'git worktree list --porcelain',
          { cwd: expandedRepoPath, timeout: 10000, suppressErrors: true }
        )
      ])
      
      const worktrees = worktreesOutput.exitCode === 0 
        ? this.parseWorktreeList(worktreesOutput.stdout)
        : []
      
      return {
        isRepo: true,
        branch,
        remoteUrl: remoteUrl.exitCode === 0 ? remoteUrl.stdout.trim() : undefined,
        worktrees
      }
    } catch {
      return { isRepo: false }
    }
  }
  
  /**
   * Parse git worktree list output
   */
  private parseWorktreeList(output: string): string[] {
    const worktrees: string[] = []
    const lines = output.split('\n')
    
    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        const worktreePath = line.substring('worktree '.length)
        worktrees.push(worktreePath)
      }
    }
    
    return worktrees
  }
}

// Export singleton instance
export const gitAdapter = new GitAdapter()