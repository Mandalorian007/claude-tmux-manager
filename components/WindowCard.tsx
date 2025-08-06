import { GitBranch, ExternalLink, Edit3, Trash2, Activity, GitCommit, Terminal, Zap } from 'lucide-react'
import type { WorkspaceWindow } from '@/types'
import { useState } from 'react'

interface WindowCardProps {
  window: WorkspaceWindow
  onDelete?: (projectName: string, featureName: string) => void
  viewMode?: 'grid' | 'list'
}

export function WindowCard({ window, onDelete, viewMode = 'grid' }: WindowCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [terminalCursor, setTerminalCursor] = useState(true)
  
  const hasChanges = window.gitStats.hasUncommittedChanges
  const totalAdded = window.gitStats.staged + window.gitStats.unstaged
  const totalDeleted = window.gitStats.untracked // Simplified for mockup matching
  const totalModified = window.gitStats.unstaged
  
  // Simulate some terminal output for the preview (only for grid view)
  const terminalPreview = [
    `$ claude-code ${window.projectName}/${window.featureName}`,
    `Analyzing authentication flow...`,
    hasChanges ? '✓ Added refresh token generation' : '✓ All tests passing',
    hasChanges ? '✓ Implemented token rotation' : '✓ Bundle size reduced by 23%',
    hasChanges ? 'Running security tests...' : '⚠ 2 accessibility warnings to review',
    hasChanges ? '✓ All 37 tests passing' : 'Optimizing performance...',
    hasChanges 
      ? `$ git commit -m "Add ${window.featureName.replace('-', ' ')} support"` 
      : '✓ Implemented React.memo'
  ].slice(0, viewMode === 'grid' ? 7 : 4)

  // List view compact layout
  if (viewMode === 'list') {
    return (
      <div 
        className="bg-card-bg border border-border rounded-lg hover:border-accent/50 transition-all duration-200 group px-4 py-2"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        data-testid="window-card"
        data-project={window.projectName}
        data-feature={window.featureName}
      >
        <div className="flex items-center justify-between">
          {/* Left section: Project:Feature, Branch, Git stats */}
          <div className="flex items-center gap-4 min-w-0 flex-1">
            {/* Project:Feature name with status indicator */}
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="font-medium text-foreground text-sm truncate max-w-[200px]">
                {window.projectName}
              </h3>
              <span className="text-muted text-sm">:</span>
              <span className="text-accent font-medium text-sm truncate max-w-[150px]">{window.featureName}</span>
              {window.isActive && (
                <div className="w-1.5 h-1.5 bg-success rounded-full flex-shrink-0 animate-pulse" title="Active session" />
              )}
            </div>
            
            {/* Branch name */}
            <div className="flex items-center gap-1 text-xs text-muted min-w-0">
              <GitBranch className="w-3 h-3 flex-shrink-0" />
              <span className="font-mono truncate max-w-[120px]">{window.gitStats.branch.replace('feature/', '')}</span>
            </div>
            
            {/* Git stats - inline and compact */}
            <div className="flex items-center gap-2 text-xs font-mono flex-shrink-0">
              {totalAdded > 0 && (
                <span className="text-success">+{totalAdded}</span>
              )}
              {totalDeleted > 0 && (
                <span className="text-warning">-{totalDeleted}</span>
              )}
              {totalModified > 0 && (
                <span className="text-error">-{totalModified}</span>
              )}
              {!hasChanges && (
                <span className="text-muted opacity-60">clean</span>
              )}
            </div>
          </div>
          
          {/* Right section: Action buttons */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button 
              className="p-1.5 text-muted hover:text-foreground hover:bg-secondary/50 rounded text-xs transition-all duration-200"
              title="View PR"
            >
              <GitCommit className="w-3 h-3" />
            </button>
            <button 
              className="p-1.5 text-muted hover:text-foreground hover:bg-secondary/50 rounded text-xs transition-all duration-200"
              title="Edit Session"
            >
              <Edit3 className="w-3 h-3" />
            </button>
            <button 
              className="p-1.5 text-muted hover:text-foreground hover:bg-secondary/50 rounded text-xs transition-all duration-200"
              title="Open Terminal"
            >
              <ExternalLink className="w-3 h-3" />
            </button>
            {onDelete && (
              <button
                onClick={() => onDelete(window.projectName, window.featureName)}
                className="p-1.5 text-muted hover:text-error hover:bg-error/10 rounded text-xs transition-all duration-200 ml-1"
                title="Clean Up"
                data-testid="delete-session-button"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Grid view - original detailed layout
  return (
    <div 
      className="bg-card-bg border border-border rounded-lg overflow-hidden hover:border-accent/50 transition-all duration-200 group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
              data-testid="window-card"
              data-project={window.projectName}
        data-feature={window.featureName}
    >
      {/* Header */}
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <h3 className="font-medium text-foreground truncate">
              {window.projectName}
            </h3>
            <span className="text-muted">:</span>
            <span className="text-accent font-medium truncate">{window.featureName}</span>
            {window.isActive && (
              <div className="w-2 h-2 bg-success rounded-full flex-shrink-0 animate-pulse" title="Active session" />
            )}
          </div>
          {onDelete && (
            <button
              onClick={() => onDelete(window.projectName, window.featureName)}
              className="opacity-0 group-hover:opacity-100 p-1.5 text-muted hover:text-error hover:bg-error/10 rounded transition-all duration-200"
              title="Clean Up"
              data-testid="delete-session-button"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
        
        {/* Git branch and session ID */}
        <div className="flex items-center gap-3 text-xs text-muted mb-3">
          <div className="flex items-center gap-1">
            <GitBranch className="w-3 h-3" />
            <span className="font-mono">{window.gitStats.branch.replace('feature/', '')}</span>
          </div>
          <div className="font-mono">
            {window.projectName}-{window.featureName}:0
          </div>
        </div>

        {/* Change stats */}
        <div className="flex items-center gap-4 text-sm mb-3">
          {totalAdded > 0 && (
            <span className="text-success font-mono">+{totalAdded}</span>
          )}
          {totalDeleted > 0 && (
            <span className="text-warning font-mono">-{totalDeleted}</span>
          )}
          {totalModified > 0 && (
            <span className="text-error font-mono">-{totalModified}</span>
          )}
          {!hasChanges && (
            <span className="text-muted text-xs">No pending changes</span>
          )}
        </div>
      </div>

      {/* Terminal Preview */}
      <div className="px-4 pb-4">
        <div className="bg-background/50 rounded border border-border p-3 font-mono text-xs relative overflow-hidden group-hover:bg-background/70 transition-colors duration-300">
          {/* Terminal header */}
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-border/30">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-error rounded-full" />
                <div className="w-2 h-2 bg-warning rounded-full" />
                <div className="w-2 h-2 bg-success rounded-full" />
              </div>
              <span className="text-xs text-muted ml-2">
                {window.projectName}-{window.featureName}:0
              </span>
            </div>
            <Terminal className="w-3 h-3 text-muted" />
          </div>
          
          {terminalPreview.map((line, index) => {
            const isTyping = isHovered && index === terminalPreview.length - 1
            return (
              <div 
                key={index} 
                className={`${index === 0 ? 'text-accent' : 
                  line.startsWith('✓') ? 'text-success' : 
                  line.startsWith('⚠') ? 'text-warning' : 
                  line.startsWith('$') ? 'text-accent' : 
                  'text-muted'}
                  ${index < terminalPreview.length - 1 ? 'mb-1' : ''}
                  ${isTyping ? 'animate-pulse' : ''}
                  transition-all duration-200
                  ${isHovered ? 'text-opacity-100' : 'text-opacity-90'}`
                }
              >
                {line}
                {isTyping && terminalCursor && (
                  <span className="ml-1 bg-accent w-1.5 h-3 inline-block animate-pulse" />
                )}
              </div>
            )
          })}
          {hasChanges && (
            <div className="text-accent mt-1 flex items-center gap-2">
              <Zap className="w-3 h-3" />
              [{window.projectName}:{window.featureName}] Add {window.featureName.replace('-', ' ')} refresh token support
            </div>
          )}
          
          {/* Subtle scan line effect on hover */}
          {isHovered && (
            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-accent/30 to-transparent animate-scan-line" />
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-4 pb-4">
        <div className="flex gap-2">
          <button className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-transparent border border-border text-muted hover:text-foreground hover:border-accent/50 rounded text-sm transition-all duration-200">
            <GitCommit className="w-4 h-4" />
            View PR
          </button>
          <button className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-transparent border border-border text-muted hover:text-foreground hover:border-accent/50 rounded text-sm transition-all duration-200">
            <Edit3 className="w-4 h-4" />
            Edit
          </button>
          <button className="flex items-center justify-center gap-2 px-3 py-2 bg-transparent border border-border text-muted hover:text-error hover:border-error/50 rounded text-sm transition-all duration-200">
            <Trash2 className="w-4 h-4" />
            Clean Up
          </button>
        </div>
      </div>
    </div>
  )
}