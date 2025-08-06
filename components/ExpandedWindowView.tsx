'use client'

import { useState, useEffect } from 'react'
import { ExternalLink, Trash2, GitCommit, Terminal, Zap, GitBranch, Edit3, Activity, Clock, Code } from 'lucide-react'
import type { ExpandedWindowViewProps } from '@/types'

export function ExpandedWindowView({ window, onDelete }: ExpandedWindowViewProps) {
  const [terminalOutput, setTerminalOutput] = useState<string>('')
  const [isLoadingOutput, setIsLoadingOutput] = useState(false)
  const [terminalCursor, setTerminalCursor] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setTerminalCursor(prev => !prev)
    }, 500)
    return () => clearInterval(interval)
  }, [])

  // Fetch real terminal output
  useEffect(() => {
    const fetchTerminalOutput = async () => {
      if (!window) return
      
      setIsLoadingOutput(true)
      try {
        const response = await fetch(
          `/api/windows/${encodeURIComponent(window.projectName)}/${encodeURIComponent(window.featureName)}/output?lines=20&format=text`,
          { cache: 'no-cache' }
        )
        
        if (response.ok) {
          const output = await response.text()
          setTerminalOutput(output.trim())
        } else {
          setTerminalOutput('')
        }
      } catch (error) {
        console.warn('Failed to fetch terminal output:', error)
        setTerminalOutput('')
      } finally {
        setIsLoadingOutput(false)
      }
    }
    
    fetchTerminalOutput()
    const interval = setInterval(fetchTerminalOutput, 3000)
    
    return () => clearInterval(interval)
  }, [window])

  if (!window) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-secondary rounded-lg flex items-center justify-center">
            <Terminal className="w-8 h-8 text-muted" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-medium text-foreground">No Window Selected</h3>
            <p className="text-muted text-sm max-w-md">
              Select a window from the sidebar to view its details and interact with the terminal.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const hasChanges = window.gitStats.hasUncommittedChanges
  const totalAdded = window.gitStats.staged + window.gitStats.unstaged
  const totalDeleted = window.gitStats.untracked
  const totalModified = window.gitStats.unstaged

  // Fallback to mock data if no real terminal output
  const mockTerminalPreview = [
    `$ export $(cat .env | xargs) && claude --dangerously-skip-permissions`,
    `$ cd ${window.worktreePath}`,
    `Analyzing authentication flow...`,
    hasChanges ? '✓ Added refresh token generation' : '✓ All tests passing',
    hasChanges ? '✓ Implemented token rotation' : '✓ Bundle size reduced by 23%',
    hasChanges ? 'Running security tests...' : '⚠ 2 accessibility warnings to review',
    hasChanges ? '✓ All 37 tests passing' : 'Optimizing performance...',
    hasChanges ? `$ git commit -m "Add ${window.featureName.replace('-', ' ')} support"` : '✓ Implemented React.memo',
    '✓ Type checking complete',
    '✓ Linting passed',
    hasChanges ? 'Ready to push changes...' : 'All optimizations applied',
    hasChanges ? `$ git push origin ${window.gitStats.branch}` : '$ npm run build'
  ]

  const terminalPreview = terminalOutput 
    ? terminalOutput.split('\n').slice(-12).filter(line => line.trim()) 
    : mockTerminalPreview

  return (
    <div className="flex-1 bg-card-bg border border-border rounded-lg overflow-hidden" data-testid="expanded-window-view">
      {/* Header */}
      <div className="px-8 py-6 border-b border-border bg-gradient-to-r from-card-bg to-secondary/10">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold text-foreground truncate">
                {window.projectName}
              </h1>
              <span className="text-2xl text-muted">:</span>
              <span className="text-2xl text-accent font-semibold truncate">{window.featureName}</span>
            </div>
            {window.isActive && (
              <div className="flex items-center gap-2 px-3 py-1 bg-success/10 border border-success/30 rounded-full">
                <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
                <span className="text-success text-sm font-medium">Active</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-4 flex-shrink-0">
            {/* Git stats */}
            <div className="flex items-center gap-4 text-sm font-mono">
              {totalAdded > 0 && (
                <div className="flex items-center gap-1 px-2 py-1 bg-success/10 border border-success/30 rounded">
                  <span className="text-success">+{totalAdded}</span>
                  <span className="text-success/70">added</span>
                </div>
              )}
              {totalDeleted > 0 && (
                <div className="flex items-center gap-1 px-2 py-1 bg-warning/10 border border-warning/30 rounded">
                  <span className="text-warning">-{totalDeleted}</span>
                  <span className="text-warning/70">deleted</span>
                </div>
              )}
              {totalModified > 0 && (
                <div className="flex items-center gap-1 px-2 py-1 bg-error/10 border border-error/30 rounded">
                  <span className="text-error">~{totalModified}</span>
                  <span className="text-error/70">modified</span>
                </div>
              )}
              {!hasChanges && (
                <div className="flex items-center gap-1 px-2 py-1 bg-muted/10 border border-muted/30 rounded">
                  <span className="text-muted">clean</span>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Branch info */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-muted" />
            <span className="font-mono text-muted">{window.gitStats.branch}</span>
          </div>
          <div className="flex items-center gap-2 text-muted">
            <Clock className="w-4 h-4" />
            <span>Last modified: 2 hours ago</span>
          </div>
          <div className="flex items-center gap-2 text-muted">
            <Code className="w-4 h-4" />
            <span>Path: {window.worktreePath}</span>
          </div>
        </div>
      </div>

      {/* Terminal Preview - Expanded */}
      <div className="p-8">
        <div className="bg-background rounded-lg border border-border overflow-hidden">
          {/* Terminal header */}
          <div className="flex items-center justify-between px-4 py-3 bg-secondary/30 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-error rounded-full" />
                <div className="w-3 h-3 bg-warning rounded-full" />
                <div className="w-3 h-3 bg-success rounded-full" />
              </div>
              <span className="text-sm text-muted font-mono">
                {window.projectName}-{window.featureName}:0 — 20×80
              </span>
            </div>
            <div className="flex items-center gap-2">
              {isLoadingOutput && (
                <div className="text-xs text-muted animate-pulse">Updating...</div>
              )}
              <Terminal className="w-4 h-4 text-muted" />
            </div>
          </div>
          
          {/* Terminal content */}
          <div className="p-4 font-mono text-sm space-y-1 min-h-[400px] max-h-[500px] overflow-y-auto">
            {terminalPreview.map((line, index) => (
              <div 
                key={index} 
                className={`${
                  index === 0 ? 'text-accent' : 
                  line.startsWith('✓') ? 'text-success' : 
                  line.startsWith('⚠') ? 'text-warning' : 
                  line.startsWith('✗') ? 'text-error' : 
                  line.startsWith('$') ? 'text-accent' : 
                  'text-muted'
                } transition-all duration-200`}
              >
                {line}
                {index === terminalPreview.length - 1 && terminalCursor && (
                  <span className="ml-1 bg-accent w-2 h-4 inline-block animate-pulse" />
                )}
              </div>
            ))}
            
            {hasChanges && (
              <div className="text-accent mt-2 flex items-center gap-2 border-t border-border/30 pt-2">
                <Zap className="w-4 h-4" />
                <span>[{window.projectName}:{window.featureName}] Ready to commit: {window.featureName.replace('-', ' ')} implementation</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="px-8 pb-6">
        <div className="flex gap-4 items-center">
          {/* Command input field - larger */}
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder={`$ tmux send-keys -t ${window.projectName}:${window.featureName} "your-command" Enter`}
              className="w-full px-4 py-3 bg-background border border-border text-foreground placeholder-muted/60 rounded-lg text-sm font-mono focus:outline-none focus:border-accent/50 focus:bg-background/80 transition-all duration-200 shadow-sm"
              onKeyDown={async (e) => {
                if (e.key === 'Enter') {
                  const inputElement = e.currentTarget
                  const command = inputElement.value.trim()
                  if (!command) return
                  
                  try {
                    const response = await fetch(
                      `/api/windows/${encodeURIComponent(window.projectName)}/${encodeURIComponent(window.featureName)}/command`,
                      {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ command }),
                      }
                    )

                    if (response.ok) {
                      console.log(`✓ Command sent: ${command}`)
                      inputElement.value = ''
                      inputElement.style.borderColor = '#10b981'
                      setTimeout(() => {
                        inputElement.style.borderColor = ''
                      }, 1000)
                    } else {
                      const error = await response.json()
                      console.error(`✗ Command failed: ${error.error || 'Unknown error'}`)
                      inputElement.style.borderColor = '#ef4444'
                      setTimeout(() => {
                        inputElement.style.borderColor = ''
                      }, 2000)
                    }
                  } catch (error) {
                    console.error(`✗ Failed to send command: ${error}`)
                    inputElement.style.borderColor = '#ef4444'
                    setTimeout(() => {
                      inputElement.style.borderColor = ''
                    }, 2000)
                  }
                }
              }}
            />
            <Terminal className="absolute right-4 top-3.5 w-4 h-4 text-muted/50 pointer-events-none" />
          </div>
          
          {/* Action buttons */}
          <div className="flex gap-2">
            <button 
              className="flex items-center gap-2 px-4 py-3 bg-transparent border border-border text-muted hover:text-foreground hover:border-accent/50 rounded-lg text-sm transition-all duration-200"
              title="View PR"
            >
              <GitCommit className="w-4 h-4" />
              <span>View PR</span>
            </button>
            <button 
              className="flex items-center gap-2 px-4 py-3 bg-transparent border border-border text-muted hover:text-foreground hover:border-accent/50 rounded-lg text-sm transition-all duration-200"
              title="Edit Session"
            >
              <Edit3 className="w-4 h-4" />
              <span>Edit</span>
            </button>
            <button 
              className="flex items-center gap-2 px-4 py-3 bg-transparent border border-border text-muted hover:text-foreground hover:border-accent/50 rounded-lg text-sm transition-all duration-200"
              title="Open Terminal"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Terminal</span>
            </button>
            {onDelete && (
              <button 
                onClick={() => onDelete(window.projectName, window.featureName)}
                className="flex items-center gap-2 px-4 py-3 bg-error/10 border border-error/30 text-error hover:bg-error hover:text-white hover:border-error rounded-lg text-sm transition-all duration-200"
                data-testid="cleanup-button"
                title="Clean Up Window"
              >
                <Trash2 className="w-4 h-4" />
                <span>Clean Up</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}