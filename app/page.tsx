'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Zap, Plus, RefreshCw, Search, Grid3x3, List, GitBranch, Terminal, Coffee, Menu, X } from 'lucide-react'
import { WindowCard } from '@/components/WindowCard'
import { NewWindowDialog } from '@/components/NewWindowDialog'
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
import type { WorkspaceWindow, CreateWindowRequest, WindowResponse, CreateWindowResponse } from '@/types'

type ViewMode = 'grid' | 'list'
type FilterStatus = 'all' | 'active' | 'ready-for-pr' | 'idle'

export default function HomePage() {
  const [windows, setWindows] = useState<WorkspaceWindow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProject, setSelectedProject] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [mountAnimation, setMountAnimation] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebar-collapsed') === 'true'
    }
    return false
  })
  const searchInputRef = useRef<HTMLInputElement>(null)
  const { showSuccess, showError, showInfo, NotificationContainer } = useTerminalNotifications()
  const { showWelcome, dismissWelcome } = useWelcomeMessage()
  const { EasterEggModal, MatrixRain } = useEasterEgg()

  const fetchWindows = async () => {
    try {
      setIsRefreshing(true)
      
      if (useMockData) {
        // Use mock data for demonstration
        await new Promise(resolve => setTimeout(resolve, 800)) // Simulate API delay
        setWindows(mockSessions) // Note: mockSessions will be renamed to mockWindows
      } else {
        const response = await fetch('/api/windows')
        const data: WindowResponse = await response.json()
        setWindows(data.windows)
      }
    } catch (error) {
      console.error('Failed to fetch windows:', error)
      // Fallback to mock data if API fails
      setWindows(mockSessions)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  const handleCreateWindow = async (request: CreateWindowRequest) => {
    try {
      setIsCreating(true)
      showInfo('Creating new window...', {
        message: 'Setting up tmux environment and git worktree',
        command: `tmux new-window -t claude-tmux-manager -n "${request.projectPath.split('/').pop()}:${request.featureName}"`
      })
      
              const response = await fetch('/api/windows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      })
      
      const data: CreateWindowResponse = await response.json()
      
      if (data.success && data.window) {
        setWindows(prev => [...prev, data.window!])
        setIsDialogOpen(false)
        showSuccess('Window created successfully! 🚀', {
          message: `Ready to start coding on ${data.window.featureName}`,
          command: `cd ${request.projectPath} && tmux select-window -t claude-tmux-manager:"${data.window.projectName}:${data.window.featureName}"`
        })
      } else {
        showError('Failed to create window', {
          message: data.error || 'Unknown error occurred',
          command: 'Check logs for more details'
        })
      }
    } catch (error) {
      console.error('Failed to create window:', error)
      showError('Window creation failed', {
        message: 'Network error or server unavailable',
        command: 'curl -f http://localhost:3000/api/health'
      })
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeleteWindow = async (projectName: string, featureName: string) => {
    showInfo('Cleaning up window...', {
      message: 'Removing tmux window and git worktree',
      command: `tmux kill-window -t claude-tmux-manager:"${projectName}:${featureName}"`
    })

    try {
              const response = await fetch(`/api/windows/${projectName}/${featureName}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        setWindows(prev => prev.filter(w => 
          !(w.projectName === projectName && w.featureName === featureName)
        ))
        showSuccess('Window cleaned up successfully! 🧹', {
          message: `Removed ${projectName}:${featureName} and associated resources`,
          command: 'git worktree prune'
        })
      } else {
        showError('Failed to delete window', {
          message: 'Window may still be running or locked',
          command: `tmux list-windows -t claude-tmux-manager | grep "${projectName}:${featureName}"`
        })
      }
    } catch (error) {
      console.error('Failed to delete window:', error)
      showError('Cleanup failed', {
        message: 'Network error during cleanup operation',
        command: 'Check server connection and try again'
      })
    }
  }

  // Compute stats and filtered data
  const { stats, projectCounts, filteredWindows } = useMemo(() => {
    const projectCounts = windows.reduce((acc, window) => {
      acc[window.projectName] = (acc[window.projectName] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    const stats = {
      windows: windows.length,
      projects: Object.keys(projectCounts).length,
      readyForPR: windows.filter(w => w.gitStats.hasUncommittedChanges && w.gitStats.ahead > 0).length
    }
    
    let filtered = windows

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

    return { stats, projectCounts, filteredWindows: filtered }
  }, [windows, selectedProject, filterStatus, searchQuery])

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onNewWindow: () => setIsDialogOpen(true),
    onRefresh: fetchWindows,
    onSearch: () => searchInputRef.current?.focus(),
    onToggleSidebar: () => {
      const newCollapsedState = !sidebarCollapsed
      setSidebarCollapsed(newCollapsedState)
      localStorage.setItem('sidebar-collapsed', newCollapsedState.toString())
    },
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
    fetchWindows()
    // Trigger mount animation
    const timer = setTimeout(() => setMountAnimation(true), 100)
    return () => clearTimeout(timer)
  }, [])

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background text-foreground flex flex-col">
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
                  <span className="text-muted">windows:</span>
                  <span className="font-medium text-success animate-pulse" data-testid="stat-windows">{stats.windows}</span>
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

        {/* Main Content - grows to fill space */}
        <main className="flex-1 w-full px-2 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            {/* Sidebar */}
            <div className={`lg:col-span-2 transition-all duration-300 ${sidebarCollapsed ? 'lg:col-span-0' : ''}`}>
              <div className={`${sidebarCollapsed ? 'lg:hidden' : ''}`}>
                <ProjectSidebar
                  projects={projectCounts}
                  selectedProject={selectedProject}
                  onProjectSelect={setSelectedProject}
                  filterStatus={filterStatus}
                  onFilterChange={setFilterStatus}
                  totalWindows={windows.length}
                  activeWindows={windows.filter(w => w.isActive).length}
                  readyForPRWindows={stats.readyForPR}
                  idleWindows={windows.filter(w => !w.isActive).length}
                />
              </div>
            </div>

            {/* Main Content */}
            <div className={`space-y-4 transition-all duration-300 ${sidebarCollapsed ? 'lg:col-span-12' : 'lg:col-span-10'}`}>
              {/* Controls */}
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="flex items-center gap-2">
                  {/* Sidebar Toggle */}
                  <button
                    onClick={() => {
                      const newCollapsedState = !sidebarCollapsed
                      setSidebarCollapsed(newCollapsedState)
                      localStorage.setItem('sidebar-collapsed', newCollapsedState.toString())
                    }}
                    className="lg:flex hidden items-center justify-center w-9 h-9 bg-transparent border border-border text-muted hover:text-foreground hover:border-accent/50 rounded transition-all duration-200"
                    title={sidebarCollapsed ? 'Show Sidebar (Cmd/Ctrl+B)' : 'Hide Sidebar (Cmd/Ctrl+B)'}
                  >
                    {sidebarCollapsed ? <Menu className="w-4 h-4" /> : <X className="w-4 h-4" />}
                  </button>
                  <ActionButton
                    variant="primary"
                    icon={Plus}
                    onClick={() => setIsDialogOpen(true)}
                    data-testid="new-session-button"
                  >
                    New Window
                  </ActionButton>
                  <div className="hidden lg:block">
                    <ShortcutHint keys={['mod', 'n']} description="New window" />
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <SearchBar
                    ref={searchInputRef}
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Search windows, branches, or files..."
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
                      fetchWindows()
                      if (!isRefreshing) {
                        showInfo('Refreshing windows...', {
                          message: 'Scanning tmux processes and git repositories',
                          command: 'tmux list-windows -t claude-tmux-manager && git worktree list'
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
                    title={isRefreshing ? 'Refreshing...' : 'Refresh windows'}
                    data-testid="refresh-windows"
                  >
                    <RefreshCw className={`
                      w-4 h-4 transition-transform duration-200
                      ${isRefreshing ? 'animate-spin text-accent' : 'group-hover:rotate-180'}
                    `} />
                  </button>
                </div>
              </div>

              {/* Windows Grid/List */}
              <div className={`
                ${viewMode === 'grid' 
                  ? `grid gap-3 grid-cols-1 ${sidebarCollapsed 
                    ? 'md:grid-cols-2 lg:grid-cols-3' 
                    : 'md:grid-cols-2 lg:grid-cols-3'
                  }`
                  : 'space-y-1'
                }
                transition-all duration-300
                ${mountAnimation ? 'animate-fade-in' : ''}
              `}>
                {isLoading ? (
                  <div className="col-span-full">
                    <EmptyState type="loading" />
                  </div>
                ) : filteredWindows.length === 0 ? (
                  <EmptyState
                    type={searchQuery || selectedProject !== 'all' || filterStatus !== 'all' ? 'no-results' : 'no-windows'}
                    searchQuery={searchQuery}
                    selectedProject={selectedProject !== 'all' ? selectedProject : undefined}
                    filterStatus={filterStatus !== 'all' ? filterStatus : undefined}
                    onCreateWindow={() => setIsDialogOpen(true)}
                  />
                ) : (
                  filteredWindows.map((window, index) => (
                    <div
                      key={`${window.projectName}:${window.featureName}`}
                      className="animate-fade-in"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <WindowCard
                        window={window}
                        onDelete={handleDeleteWindow}
                        viewMode={viewMode}
                      />
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </main>
        
        {/* Sticky Footer */}
        <footer className="mt-auto py-6 border-t border-border/30 bg-background">
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
      
      <NewWindowDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSubmit={handleCreateWindow}
        isLoading={isCreating}
      />
    </ErrorBoundary>
  )
}