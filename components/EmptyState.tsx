'use client'

import { useState, useEffect } from 'react'
import { Plus, Terminal, GitBranch, Zap, Search, Coffee } from 'lucide-react'

interface EmptyStateProps {
  type: 'no-sessions' | 'no-results' | 'loading'
  searchQuery?: string
  selectedProject?: string
  filterStatus?: string
  onCreateSession?: () => void
}

const ASCII_ART = {
  noSessions: [
    '    ┌─────────────────────────┐',
    '    │     tmux manager v1.0   │',
    '    └─────────────────────────┘',
    '           ╭─────────╮',
    '           │ READY!  │',
    '           ╰─────────╯',
    '             │   │',
    '          ┌──▼───▼──┐',
    '          │   ...   │',
    '          │ waiting │',
    '          └─────────┘'
  ],
  noResults: [
    '    ╔═══════════════════════╗',
    '    ║   404: Sessions Not   ║',
    '    ║       Found!          ║',
    '    ╚═══════════════════════╝',
    '           ┌─────────┐',
    '           │  ¯\\_(ツ)_/¯  │',
    '           └─────────┘'
  ],
  loading: [
    '    ┌───────────────────────┐',
    '    │ █▓▒░ LOADING... ░▒▓█ │',
    '    └───────────────────────┘',
    '          [ ████████▓ ]',
    '            Scanning...'
  ]
}

const TERMINAL_TIPS = [
  '$ tmux new-session -s "my-feature"',
  '$ git worktree add ../feature-branch',
  '$ claude --enhance --project ./src',
  '$ git checkout -b feature/awesome-feature',
  '$ pnpm dev -- --experimental'
]

const ENCOURAGEMENTS = [
  "Time to build something amazing! ⚡",
  "Every great feature starts with a single session 🚀",
  "Ready when you are, developer! 💻",
  "Let's turn that idea into code! ✨",
  "Your next breakthrough is one session away 🌟"
]

export function EmptyState({ 
  type, 
  searchQuery, 
  selectedProject, 
  filterStatus, 
  onCreateSession 
}: EmptyStateProps) {
  const [currentTip, setCurrentTip] = useState(0)
  const [currentEncouragement, setCurrentEncouragement] = useState(0)
  const [showCursor, setShowCursor] = useState(true)

  // Rotate tips and encouragements
  useEffect(() => {
    const tipInterval = setInterval(() => {
      setCurrentTip(prev => (prev + 1) % TERMINAL_TIPS.length)
    }, 3000)

    const encouragementInterval = setInterval(() => {
      setCurrentEncouragement(prev => (prev + 1) % ENCOURAGEMENTS.length)
    }, 4000)

    return () => {
      clearInterval(tipInterval)
      clearInterval(encouragementInterval)
    }
  }, [])

  // Cursor blinking effect
  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setShowCursor(prev => !prev)
    }, 600)

    return () => clearInterval(cursorInterval)
  }, [])

  const renderContent = () => {
    switch (type) {
      case 'loading':
        return (
          <div className="text-center" data-testid="empty-state-loading">
            <div className="font-mono text-xs text-muted space-y-1 mb-6">
              {ASCII_ART.loading.map((line, i) => (
                <div key={i} className={i === 1 ? 'text-accent' : ''}>
                  {line}
                </div>
              ))}
            </div>
            <p className="text-lg font-medium text-foreground mb-2">Scanning for sessions...</p>
            <p className="text-sm text-muted">Checking tmux processes and git worktrees</p>
          </div>
        )

      case 'no-results':
        return (
          <div className="text-center" data-testid="empty-state-no-results">
            <div className="font-mono text-xs text-muted space-y-1 mb-6">
              {ASCII_ART.noResults.map((line, i) => (
                <div key={i} className={i === 1 || i === 2 ? 'text-warning' : ''}>
                  {line}
                </div>
              ))}
            </div>
            
            <Search className="w-12 h-12 mx-auto mb-4 text-muted" />
            <p className="text-lg font-medium mb-2">No sessions found</p>
            
            <div className="text-sm text-muted space-y-1 mb-6">
              {searchQuery && (
                <p>No results for <code className="bg-secondary px-2 py-1 rounded font-mono text-xs">&apos;{searchQuery}&apos;</code></p>
              )}
              {selectedProject !== 'all' && (
                <p>Project: <code className="bg-secondary px-2 py-1 rounded font-mono text-xs">{selectedProject}</code></p>
              )}
              {filterStatus !== 'all' && (
                <p>Status: <code className="bg-secondary px-2 py-1 rounded font-mono text-xs">{filterStatus}</code></p>
              )}
            </div>

            <div className="bg-background/50 border border-border rounded-lg p-4 mb-6">
              <p className="text-xs text-muted mb-2 font-mono">$ search --help</p>
              <div className="text-xs text-muted space-y-1">
                <p>• Try different keywords or filters</p>
                <p>• Check project name spelling</p>
                <p>• Clear filters to see all sessions</p>
                <p>• Create a new session to get started</p>
              </div>
            </div>
          </div>
        )

      case 'no-sessions':
      default:
        return (
          <div className="text-center" data-testid="empty-state-no-sessions">
            <div className="font-mono text-xs text-muted space-y-1 mb-6">
              {ASCII_ART.noSessions.map((line, i) => (
                <div key={i} className={[0, 1, 2].includes(i) ? 'text-accent' : ''}>
                  {line}
                </div>
              ))}
            </div>
            
            <div className="mb-6">
              <GitBranch className="w-16 h-16 mx-auto mb-4 text-muted" />
              <p className="text-xl font-medium mb-2">No active sessions</p>
              <p className="text-muted mb-4">{ENCOURAGEMENTS[currentEncouragement]}</p>
              
              {onCreateSession && (
                <button
                  onClick={onCreateSession}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-background rounded-lg hover:bg-accent/90 transition-all duration-200 font-medium shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 group"
                >
                  <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-200" />
                  Create Your First Session
                  <Zap className="w-4 h-4 ml-1" />
                </button>
              )}
            </div>

            {/* Terminal tip */}
            <div className="bg-background/50 border border-border rounded-lg p-4 max-w-md mx-auto">
              <div className="flex items-center gap-2 mb-2">
                <Terminal className="w-4 h-4 text-accent" />
                <span className="text-sm font-medium text-foreground">Pro Tip</span>
              </div>
              <div className="font-mono text-xs text-muted flex items-center">
                <span className="text-accent">$</span>
                <span className="ml-2">{TERMINAL_TIPS[currentTip]}</span>
                {showCursor && <span className="ml-1 bg-accent w-1.5 h-3 inline-block" />}
              </div>
            </div>

            {/* Fun footer */}
            <div className="mt-8 flex items-center justify-center gap-2 text-xs text-muted">
              <Coffee className="w-4 h-4" />
              <span>Powered by terminal magic and developer coffee</span>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="col-span-full bg-card-bg border border-border rounded-lg p-12 animate-fade-in">
      {renderContent()}
    </div>
  )
}

// Enhanced version with more terminal personality
export function TerminalEmptyState({ type, ...props }: EmptyStateProps) {
  return (
    <div className="col-span-full">
      <div className="bg-background/95 border-2 border-accent/20 rounded-lg p-8 relative overflow-hidden">
        {/* Terminal window chrome */}
        <div className="flex items-center gap-2 mb-6 pb-3 border-b border-border/30">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-error rounded-full" />
            <div className="w-3 h-3 bg-warning rounded-full" />
            <div className="w-3 h-3 bg-success rounded-full" />
          </div>
          <div className="flex-1 text-center">
            <span className="text-xs font-mono text-muted">claude-tmux-manager — sessions</span>
          </div>
        </div>
        
        <EmptyState type={type} {...props} />
        
        {/* Subtle scan lines */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-accent/5 to-transparent opacity-50 animate-scan-slow" />
        </div>
      </div>
    </div>
  )
}