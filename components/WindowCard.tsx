import { ExternalLink, Trash2, Activity, GitCommit, Terminal, Zap, GitBranch, Edit3, Eye } from 'lucide-react'
import type { WorkspaceWindow } from '@/types'
import { useState, useEffect } from 'react'

interface WindowCardProps {
  window: WorkspaceWindow
  onDelete?: (projectName: string, featureName: string) => void
  viewMode?: 'grid' | 'list'
  onSelect?: (window: WorkspaceWindow) => void
  isSelected?: boolean
}

export function WindowCard({ window, onDelete, viewMode = 'grid', onSelect, isSelected }: WindowCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [terminalCursor, setTerminalCursor] = useState(true)
  const [terminalOutput, setTerminalOutput] = useState<string>('')
  const [isLoadingOutput, setIsLoadingOutput] = useState(false)
  const [prStatus, setPrStatus] = useState<{
    loading: boolean
    found: boolean
    pr?: { number: number; url: string; title: string; state: string }
  }>({ loading: true, found: false })
  
  const hasChanges = window.gitStats.hasUncommittedChanges
  const totalAdded = window.gitStats.staged + window.gitStats.unstaged
  const totalDeleted = window.gitStats.untracked // Simplified for mockup matching
  const totalModified = window.gitStats.unstaged
  
  // Fetch real terminal output
  useEffect(() => {
    const fetchTerminalOutput = async () => {
      if (viewMode !== 'grid') return // Only fetch for grid view
      
      setIsLoadingOutput(true)
      try {
        const response = await fetch(
          `/api/windows/${encodeURIComponent(window.projectName)}/${encodeURIComponent(window.featureName)}/output?lines=8&format=text`,
          { cache: 'no-cache' }
        )
        
        if (response.ok) {
          const output = await response.text()
          setTerminalOutput(output.trim())
        } else {
          // Fallback to mock data if API fails
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
    
    // Base refresh every 5 seconds, faster 3 seconds when hovered
    const baseInterval = setInterval(fetchTerminalOutput, 5000)
    const hoverInterval = isHovered ? setInterval(fetchTerminalOutput, 3000) : null
    
    return () => {
      clearInterval(baseInterval)
      if (hoverInterval) clearInterval(hoverInterval)
    }
  }, [window.projectName, window.featureName, viewMode, isHovered])

  // Proactively check PR status when component mounts
  useEffect(() => {
    const checkPrStatus = async () => {
      setPrStatus({ loading: true, found: false })
      
      try {
        const response = await fetch(
          `/api/windows/${encodeURIComponent(window.projectName)}/${encodeURIComponent(window.featureName)}/pr`,
          { cache: 'no-cache' }
        )

        if (response.ok) {
          const result = await response.json()
          
          if (result.found && result.pr) {
            setPrStatus({
              loading: false,
              found: true,
              pr: result.pr
            })
          } else {
            setPrStatus({
              loading: false,
              found: false
            })
          }
        } else {
          setPrStatus({ loading: false, found: false })
        }
      } catch (error) {
        console.warn('Failed to check PR status:', error)
        setPrStatus({ loading: false, found: false })
      }
    }

    checkPrStatus()
  }, [window.projectName, window.featureName])
  
  // Fallback to mock data if no real terminal output
  const mockTerminalPreview = [
    `$ export $(cat .env | xargs) && claude --dangerously-skip-permissions`,
    `$ cd ${window.worktreePath}`,
    `Analyzing authentication flow...`,
    hasChanges ? '✓ Added refresh token generation' : '✓ All tests passing',
    hasChanges ? '✓ Implemented token rotation' : '✓ Bundle size reduced by 23%',
    hasChanges ? 'Running security tests...' : '⚠ 2 accessibility warnings to review',
    hasChanges ? '✓ All 37 tests passing' : 'Optimizing performance...',
    hasChanges 
      ? `$ git commit -m "Add ${window.featureName.replace('-', ' ')} support"` 
      : '✓ Implemented React.memo'
  ].slice(0, viewMode === 'grid' ? 8 : 4)
  
  // Use real terminal output if available, otherwise use mock
  const terminalPreview = terminalOutput 
    ? terminalOutput.split('\n').slice(-8).filter(line => line.trim()) 
    : mockTerminalPreview

  // List view compact layout
  if (viewMode === 'list') {
    return (
      <div 
        className={`bg-card-bg border border-border rounded-lg hover:border-accent/50 transition-all duration-200 group px-4 py-2 cursor-pointer ${
          isSelected ? 'ring-2 ring-accent border-accent' : ''
        }`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => onSelect?.(window)}
        data-testid="window-card"
        data-project={window.projectName}
        data-feature={window.featureName}
      >
        <div className="flex items-center justify-between">
          {/* Left section: Project:Feature, Branch */}
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
          </div>
          
          {/* Right section: Git stats and Action buttons */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Git stats - moved to top right */}
            <div className="flex items-center gap-2 text-xs font-mono">
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
                <span className="text-muted opacity-60 text-xs">clean</span>
              )}
            </div>
            <button 
              className={`p-1.5 rounded text-xs transition-all duration-200 ${
                prStatus.loading 
                  ? 'text-muted opacity-50 animate-pulse' 
                  : prStatus.found 
                    ? 'text-success bg-success/10 hover:bg-success/20 border border-success/30' 
                    : 'text-muted opacity-40 cursor-not-allowed'
              }`}
              title={
                prStatus.loading 
                  ? 'Checking PR status...' 
                  : prStatus.found 
                    ? `View PR #${prStatus.pr?.number}: ${prStatus.pr?.title}`
                    : 'No PR found'
              }
              disabled={prStatus.loading || !prStatus.found}
              onClick={() => {
                if (prStatus.loading || !prStatus.found || !prStatus.pr) return;
                
                console.log(`✓ Opening PR #${prStatus.pr.number}`);
                globalThis.window.open(prStatus.pr.url, '_blank');
              }}
            >
              {prStatus.loading ? (
                <GitCommit className="w-3 h-3" />
              ) : prStatus.found ? (
                <Eye className="w-3 h-3" />
              ) : (
                <GitCommit className="w-3 h-3" />
              )}
            </button>
            <button 
              className="p-1.5 text-muted hover:text-foreground hover:bg-secondary/50 rounded text-xs transition-all duration-200"
              title="Edit Session"
            >
              <Edit3 className="w-3 h-3" />
            </button>
            <button 
              className="p-1.5 text-muted hover:text-foreground hover:bg-secondary/50 rounded text-xs transition-all duration-200 terminal-button"
              title="Open Terminal (tmux attach)"
              onClick={async (e) => {
                e.stopPropagation()
                try {
                  const response = await fetch(
                    `/api/windows/${encodeURIComponent(window.projectName)}/${encodeURIComponent(window.featureName)}/terminal`,
                    { method: 'POST' }
                  )
                  
                  const result = await response.json()
                  
                  if (response.ok && result.success) {
                    console.log(`✓ Terminal opened for ${window.projectName}:${window.featureName}`)
                  } else if (response.status === 202 && result.fallback) {
                    // Fallback - show manual instructions
                    const instructions = result.fallback.instructions.join('\n')
                    const shouldCopy = globalThis.window.confirm(
                      `Could not open terminal automatically.\n\n${instructions}\n\nCopy tmux command to clipboard?`
                    )
                    
                    if (shouldCopy && navigator.clipboard) {
                      try {
                        await navigator.clipboard.writeText(result.fallback.message)
                        console.log(`✓ Tmux command copied to clipboard: ${result.fallback.message}`)
                      } catch (clipError) {
                        console.warn('Failed to copy to clipboard:', clipError)
                        // Fallback: show in console
                        console.log(`Manual command: ${result.fallback.message}`)
                      }
                    } else {
                      console.log(`Manual command: ${result.fallback.message}`)
                    }
                  } else {
                    console.error(`✗ Failed to open terminal: ${result.error || response.statusText}`)
                  }
                } catch (error) {
                  console.error(`✗ Failed to open terminal:`, error)
                }
              }}
            >
              <Terminal className="w-3 h-3" />
            </button>

          </div>
        </div>
      </div>
    )
  }

  // Grid view - original detailed layout
  return (
    <div 
      className={`bg-card-bg border border-border rounded-lg overflow-hidden hover:border-accent/50 transition-all duration-200 group cursor-pointer ${
        isSelected ? 'ring-2 ring-accent border-accent' : ''
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onSelect?.(window)}
              data-testid="window-card"
              data-project={window.projectName}
        data-feature={window.featureName}
    >
      {/* Header */}
      <div className="px-6 pt-4 pb-3">
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
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Git stats - moved to top right */}
            <div className="flex items-center gap-2 text-xs font-mono">
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
                <span className="text-muted opacity-60 text-xs">clean</span>
              )}
            </div>

          </div>
        </div>
        
      </div>

      {/* Terminal Preview */}
      <div className="px-6 pb-4">
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
      <div className="px-6 pb-4">
        <div className="flex gap-2 items-center">
          {/* Command input field */}
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="$ tmux send-keys -t ${window.projectName}:${window.featureName}"
              className="w-full px-3 py-2 bg-background/50 border border-border text-foreground placeholder-muted/60 rounded text-sm font-mono focus:outline-none focus:border-accent/50 focus:bg-background/80 transition-all duration-200"
              onKeyDown={async (e) => {
                if (e.key === 'Enter') {
                  const inputElement = e.currentTarget; // Store reference before async operation
                  const command = inputElement.value.trim();
                  if (!command) return;
                  
                  try {
                    const response = await fetch(
                      `/api/windows/${encodeURIComponent(window.projectName)}/${encodeURIComponent(window.featureName)}/command`,
                      {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ command }),
                      }
                    );

                    if (response.ok) {
                      console.log(`✓ Command sent: ${command}`);
                      // Clear the input field
                      inputElement.value = '';
                      // Optional: Give visual feedback
                      inputElement.style.borderColor = '#10b981';
                      setTimeout(() => {
                        inputElement.style.borderColor = '';
                      }, 1000);
                    } else {
                      const error = await response.json();
                      console.error(`✗ Command failed: ${error.error || 'Unknown error'}`);
                      // Give error visual feedback
                      inputElement.style.borderColor = '#ef4444';
                      setTimeout(() => {
                        inputElement.style.borderColor = '';
                      }, 2000);
                    }
                  } catch (error) {
                    console.error(`✗ Failed to send command: ${error}`);
                    // Give error visual feedback even on network errors
                    inputElement.style.borderColor = '#ef4444';
                    setTimeout(() => {
                      inputElement.style.borderColor = '';
                    }, 2000);
                  }
                }
              }}
            />
            <Terminal className="absolute right-3 top-2.5 w-3 h-3 text-muted/50 pointer-events-none" />
          </div>
          
          {/* Condensed action buttons */}
          <div className="flex gap-1">
            <button 
              className={`flex items-center justify-center gap-1 px-2 py-2 rounded text-sm transition-all duration-200 ${
                prStatus.loading 
                  ? 'bg-muted/10 border border-border text-muted opacity-50 animate-pulse' 
                  : prStatus.found 
                    ? 'bg-success/10 border border-success/30 text-success hover:bg-success/20 hover:border-success/50' 
                    : 'bg-muted/10 border border-border text-muted opacity-40 cursor-not-allowed'
              }`}
              title={
                prStatus.loading 
                  ? 'Checking PR status...' 
                  : prStatus.found 
                    ? `View PR #${prStatus.pr?.number}: ${prStatus.pr?.title}`
                    : 'No PR found'
              }
              disabled={prStatus.loading || !prStatus.found}
              onClick={() => {
                if (prStatus.loading || !prStatus.found || !prStatus.pr) return;
                
                console.log(`✓ Opening PR #${prStatus.pr.number}`);
                globalThis.window.open(prStatus.pr.url, '_blank');
              }}
            >
              {prStatus.loading ? (
                <GitCommit className="w-4 h-4" />
              ) : prStatus.found ? (
                <Eye className="w-4 h-4" />
              ) : (
                <GitCommit className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">
                {prStatus.loading ? 'PR' : prStatus.found ? 'View' : 'PR'}
              </span>
            </button>
            <button 
              className="flex items-center justify-center gap-1 px-2 py-2 bg-accent/10 border border-accent/30 text-accent hover:bg-accent/20 hover:border-accent/50 rounded text-sm transition-all duration-200 terminal-button"
              title="Open Terminal (tmux attach)"
              onClick={async (e) => {
                e.stopPropagation()
                try {
                  const response = await fetch(
                    `/api/windows/${encodeURIComponent(window.projectName)}/${encodeURIComponent(window.featureName)}/terminal`,
                    { method: 'POST' }
                  )
                  
                  const result = await response.json()
                  
                  if (response.ok && result.success) {
                    console.log(`✓ Terminal opened for ${window.projectName}:${window.featureName}`)
                  } else if (response.status === 202 && result.fallback) {
                    // Fallback - show manual instructions
                    const instructions = result.fallback.instructions.join('\n')
                    const shouldCopy = globalThis.window.confirm(
                      `Could not open terminal automatically.\n\n${instructions}\n\nCopy tmux command to clipboard?`
                    )
                    
                    if (shouldCopy && navigator.clipboard) {
                      try {
                        await navigator.clipboard.writeText(result.fallback.message)
                        console.log(`✓ Tmux command copied to clipboard: ${result.fallback.message}`)
                      } catch (clipError) {
                        console.warn('Failed to copy to clipboard:', clipError)
                        // Fallback: show in console
                        console.log(`Manual command: ${result.fallback.message}`)
                      }
                    } else {
                      console.log(`Manual command: ${result.fallback.message}`)
                    }
                  } else {
                    console.error(`✗ Failed to open terminal: ${result.error || response.statusText}`)
                  }
                } catch (error) {
                  console.error(`✗ Failed to open terminal:`, error)
                }
              }}
            >
              <Terminal className="w-4 h-4" />
              <span className="hidden sm:inline">Term</span>
            </button>
            {onDelete && (
              <button 
                onClick={() => {
                  const confirmed = globalThis.window.confirm(
                    `⚠️ DESTRUCTIVE ACTION\n\n` +
                    `This will permanently:\n` +
                    `• Kill the tmux window\n` +
                    `• Delete the git worktree\n` +
                    `• Remove all local changes\n\n` +
                    `Project: ${window.projectName}\n` +
                    `Feature: ${window.featureName}\n\n` +
                    `Are you absolutely sure?`
                  );
                  
                  if (confirmed) {
                    onDelete(window.projectName, window.featureName);
                  }
                }}
                className="flex items-center justify-center gap-1 px-2 py-2 bg-error/10 border border-error/30 text-error hover:bg-error hover:text-white hover:border-error rounded text-sm transition-all duration-200"
                data-testid="cleanup-button"
                title="⚠️ Permanently delete tmux window and git worktree"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Clean</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}