'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Zap, Plus, RefreshCw, Search, Grid3x3, List, GitBranch, Terminal, Coffee } from 'lucide-react'
import { SessionCard } from '@/components/SessionCard'
import { NewSessionDialog } from '@/components/NewSessionDialog'
import { SearchBar } from '@/components/SearchBar'
import { ProjectSidebar } from '@/components/ProjectSidebar'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useKeyboardShortcuts, ShortcutHint } from '@/components/KeyboardShortcuts'
import { ActionButton } from '@/components/ActionButton'
import { EmptyState } from '@/components/EmptyState'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { useTerminalNotifications } from '@/components/TerminalNotification'
import { WelcomeMessage, useWelcomeMessage } from '@/components/WelcomeMessage'
import { useEasterEgg } from '@/components/EasterEgg'
import { mockSessions, useMockData } from '@/lib/mockData'
import type { Session, CreateSessionRequest, SessionResponse, CreateSessionResponse } from '@/types'

type ViewMode = 'grid' | 'list'
type FilterStatus = 'all' | 'active' | 'ready-for-pr' | 'idle'

export default function HomePage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProject, setSelectedProject] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [mountAnimation, setMountAnimation] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const { showSuccess, showError, showInfo, NotificationContainer } = useTerminalNotifications()
  const { showWelcome, dismissWelcome } = useWelcomeMessage()
  const { EasterEggModal, MatrixRain } = useEasterEgg()

  const fetchSessions = async () => {
    try {
      setIsRefreshing(true)
      
      if (useMockData) {
        // Use mock data for demonstration
        await new Promise(resolve => setTimeout(resolve, 800)) // Simulate API delay
        setSessions(mockSessions)
      } else {
        const response = await fetch('/api/sessions')
        const data: SessionResponse = await response.json()
        setSessions(data.sessions)
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error)
      // Fallback to mock data if API fails
      setSessions(mockSessions)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  const handleCreateSession = async (request: CreateSessionRequest) => {
    try {
      setIsCreating(true)
      showInfo('Creating new session...', {
        message: 'Setting up tmux environment and git worktree',
        command: `tmux new-session -s "${request.projectPath.split('/').pop()}-${request.featureName}"`
      })
      
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      })
      
      const data: CreateSessionResponse = await response.json()
      
      if (data.success && data.session) {
        setSessions(prev => [...prev, data.session!])
        setIsDialogOpen(false)
        showSuccess('Session created successfully! 🚀', {
          message: `Ready to start coding on ${data.session.featureName}`,
          command: `cd ${request.projectPath} && tmux attach-session -t "${data.session.projectName}-${data.session.featureName}"`
        })
      } else {
        showError('Failed to create session', {
          message: data.error || 'Unknown error occurred',
          command: 'Check logs for more details'
        })
      }
    } catch (error) {
      console.error('Failed to create session:', error)
      showError('Session creation failed', {
        message: 'Network error or server unavailable',
        command: 'curl -f http://localhost:3000/api/health'
      })
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeleteSession = async (projectName: string, featureName: string) => {
    showInfo('Cleaning up session...', {
      message: 'Removing tmux session and git worktree',
      command: `tmux kill-session -t "${projectName}-${featureName}"`
    })

    try {
      const response = await fetch(`/api/sessions/${projectName}/${featureName}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        setSessions(prev => prev.filter(s => 
          !(s.projectName === projectName && s.featureName === featureName)
        ))
        showSuccess('Session cleaned up successfully! 🧹', {
          message: `Removed ${projectName}:${featureName} and associated resources`,
          command: 'git worktree prune'
        })
      } else {
        showError('Failed to delete session', {
          message: 'Session may still be running or locked',
          command: `tmux list-sessions | grep "${projectName}-${featureName}"`
        })
      }
    } catch (error) {
      console.error('Failed to delete session:', error)
      showError('Cleanup failed', {
        message: 'Network error during cleanup operation',
        command: 'Check server connection and try again'
      })
    }
  }

  // Compute stats and filtered data
  const { stats, projectCounts, filteredSessions } = useMemo(() => {
    const projectCounts = sessions.reduce((acc, session) => {
      acc[session.projectName] = (acc[session.projectName] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const stats = {
      sessions: sessions.length,
      projects: Object.keys(projectCounts).length,
      readyForPR: sessions.filter(s => s.gitStats.hasUncommittedChanges && s.gitStats.ahead > 0).length
    }

    let filtered = sessions

    // Filter by project
    if (selectedProject !== 'all') {
      filtered = filtered.filter(s => s.projectName === selectedProject)
    }

    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(s => {
        switch (filterStatus) {
          case 'active':
            return s.isActive
          case 'ready-for-pr':
            return s.gitStats.hasUncommittedChanges && s.gitStats.ahead > 0
          case 'idle':
            return !s.isActive
          default:
            return true
        }
      })
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(s => 
        s.projectName.toLowerCase().includes(query) ||
        s.featureName.toLowerCase().includes(query) ||
        s.gitStats.branch.toLowerCase().includes(query)
      )
    }

    return { stats, projectCounts, filteredSessions: filtered }
  }, [sessions, selectedProject, filterStatus, searchQuery])

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onNewSession: () => setIsDialogOpen(true),
    onRefresh: fetchSessions,
    onSearch: () => searchInputRef.current?.focus(),
    onEscape: () => {
      if (isDialogOpen) {
        setIsDialogOpen(false)
      } else {
        searchInputRef.current?.blur()
        if (document.activeElement && 'blur' in document.activeElement) {
          (document.activeElement as HTMLElement).blur()
        }
      }
    }
  })

  useEffect(() => {
    fetchSessions()
    // Trigger mount animation
    const timer = setTimeout(() => setMountAnimation(true), 100)
    return () => clearTimeout(timer)
  }, [])

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-card-bg relative overflow-hidden">
        {/* Terminal scan line effect */}
        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-accent/40 to-transparent animate-scan-slow" />
        
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 group">
                <Zap className="w-6 h-6 text-accent animate-bounce-subtle group-hover:animate-terminal-glow transition-all duration-300" />
                <h1 className="text-xl font-semibold text-foreground font-mono">
                  <span className="text-accent">$</span>{' '}
                  <span className="terminal-glow group-hover:text-accent transition-colors duration-300">
                    claude-tmux-manager
                  </span>
                  <span className="animate-blink text-accent ml-1">_</span>
                </h1>
              </div>
            </div>
            
            <div className="flex items-center gap-6 text-sm font-mono" data-testid="stats-container">
              <div className="flex items-center gap-1 px-3 py-1 bg-background/30 rounded border border-border/50 hover:border-accent/30 transition-colors">
                <span className="text-muted">sessions:</span>
                <span className="font-medium text-success animate-pulse" data-testid="stat-sessions">{stats.sessions}</span>
              </div>
              <div className="flex items-center gap-1 px-3 py-1 bg-background/30 rounded border border-border/50 hover:border-accent/30 transition-colors">
                <span className="text-muted">projects:</span>
                <span className="font-medium text-accent" data-testid="stat-projects">{stats.projects}</span>
              </div>
              <div className="flex items-center gap-1 px-3 py-1 bg-background/30 rounded border border-border/50 hover:border-accent/30 transition-colors">
                <span className="text-muted">ready:</span>
                <span className={`font-medium ${stats.readyForPR > 0 ? 'text-warning animate-pulse' : 'text-muted'}`} data-testid="stat-ready">
                  {stats.readyForPR}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <ProjectSidebar
              projects={projectCounts}
              selectedProject={selectedProject}
              onProjectSelect={setSelectedProject}
              filterStatus={filterStatus}
              onFilterChange={setFilterStatus}
              totalSessions={sessions.length}
              activeSessions={sessions.filter(s => s.isActive).length}
              readyForPRSessions={stats.readyForPR}
              idleSessions={sessions.filter(s => !s.isActive).length}
            />
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-4">
            {/* Controls */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex items-center gap-2">
                <ActionButton
                  variant="primary"
                  icon={Plus}
                  onClick={() => setIsDialogOpen(true)}
                  data-testid="new-session-button"
                >
                  New Session
                </ActionButton>
                <div className="hidden lg:block">
                  <ShortcutHint keys={['mod', 'n']} description="New session" />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <SearchBar
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Search sessions, branches, or files..."
                />
                
                <div className="flex items-center gap-1 bg-card-bg rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded ${viewMode === 'grid' ? 'bg-secondary text-foreground' : 'text-muted hover:text-foreground'} transition-colors`}
                    title="Grid view"
                    data-testid="view-mode-grid"
                  >
                    <Grid3x3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded ${viewMode === 'list' ? 'bg-secondary text-foreground' : 'text-muted hover:text-foreground'} transition-colors`}
                    title="List view"
                    data-testid="view-mode-list"
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>

                <button
                  onClick={() => {
                    fetchSessions()
                    if (!isRefreshing) {
                      showInfo('Refreshing sessions...', {
                        message: 'Scanning tmux processes and git repositories',
                        command: 'tmux list-sessions && git worktree list'
                      })
                    }
                  }}
                  className={`
                    p-2 text-muted hover:text-foreground rounded-lg hover:bg-card-bg
                    transition-all duration-200 hover:scale-110 active:scale-95
                    ${isRefreshing ? 'text-accent' : ''}
                    group
                  `}
                  disabled={isRefreshing}
                  title={isRefreshing ? 'Refreshing...' : 'Refresh sessions'}
                  data-testid="refresh-sessions"
                >
                  <RefreshCw className={`
                    w-4 h-4 transition-transform duration-200
                    ${isRefreshing ? 'animate-spin text-accent' : 'group-hover:rotate-180'}
                  `} />
                </button>
              </div>
            </div>

            {/* Sessions Grid/List */}
            <div className={`
              ${viewMode === 'grid' ? 'grid gap-4 grid-cols-1 xl:grid-cols-2' : 'space-y-1'}
              transition-all duration-300
              ${mountAnimation ? 'animate-fade-in' : ''}
            `}>
              {isLoading ? (
                <div className="col-span-full">
                  <EmptyState type="loading" />
                </div>
              ) : filteredSessions.length === 0 ? (
                <EmptyState
                  type={searchQuery || selectedProject !== 'all' || filterStatus !== 'all' ? 'no-results' : 'no-sessions'}
                  searchQuery={searchQuery}
                  selectedProject={selectedProject !== 'all' ? selectedProject : undefined}
                  filterStatus={filterStatus !== 'all' ? filterStatus : undefined}
                  onCreateSession={() => setIsDialogOpen(true)}
                />
              ) : (
                filteredSessions.map((session, index) => (
                  <div
                    key={`${session.projectName}:${session.featureName}`}
                    className="animate-fade-in"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <SessionCard
                      session={session}
                      onDelete={handleDeleteSession}
                      viewMode={viewMode}
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        
        {/* Delightful Footer */}
        <footer className="mt-12 py-6 border-t border-border/30">
          <div className="flex items-center justify-center gap-2 text-xs text-muted">
            <Terminal className="w-3 h-3" />
            <span>Crafted with</span>
            <span className="text-error animate-pulse">❤️</span>
            <span>for terminal enthusiasts</span>
            <Coffee className="w-3 h-3 ml-2" />
          </div>
          <div className="flex items-center justify-center gap-4 mt-2 text-xs text-muted font-mono">
            <span>⚡ claude-tmux-manager v1.0</span>
            <span>•</span>
            <span>👩‍💻 Built for developers, by developers</span>
            <span>•</span>
            <span className="text-accent hover:text-foreground transition-colors cursor-pointer" 
                  title="Try the Konami Code: ↑↑↓↓←→←→BA">
              🎮 Easter eggs included
            </span>
          </div>
        </footer>
      </div>

      <NotificationContainer />
      
      {showWelcome && (
        <WelcomeMessage onDismiss={dismissWelcome} />
      )}
      
      <MatrixRain />
      <EasterEggModal />
      
      <NewSessionDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSubmit={handleCreateSession}
        isLoading={isCreating}
      />
      </div>
    </ErrorBoundary>
  )
}