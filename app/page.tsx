'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Zap, Plus, RefreshCw, Terminal, Coffee, Menu, X } from 'lucide-react'
import { NewWindowDialog } from '@/components/NewWindowDialog'
import { WindowListSidebar } from '@/components/WindowListSidebar'
import { ExpandedWindowView } from '@/components/ExpandedWindowView'
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
  const [selectedWindow, setSelectedWindow] = useState<WorkspaceWindow | undefined>()
  const [mountAnimation, setMountAnimation] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebar-collapsed') === 'true'
    }
    return false
  })
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
        command: `tmux new-window -t claude-tmux-manager -n "${request.projectPath.split('/').pop()}:${request.featureName}" && export $(cat .env | xargs) && claude --dangerously-skip-permissions`
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

  // Auto-select first window when windows change
  useEffect(() => {
    if (windows.length > 0 && !selectedWindow) {
      setSelectedWindow(windows[0])
    } else if (selectedWindow && !windows.find(w => 
      w.projectName === selectedWindow.projectName && 
      w.featureName === selectedWindow.featureName
    )) {
      // Selected window was deleted, select first available
      setSelectedWindow(windows.length > 0 ? windows[0] : undefined)
    }
  }, [windows, selectedWindow])

  // Handle window selection
  const handleWindowSelect = (window: WorkspaceWindow) => {
    setSelectedWindow(window)
  }

  // Compute stats and project counts
  const { stats, projectCounts } = useMemo(() => {
    // Ensure windows is an array to prevent errors when API fails
    const safeWindows = windows || []
    
    const projectCounts = safeWindows.reduce((acc, window) => {
      acc[window.projectName] = (acc[window.projectName] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    const stats = {
      windows: safeWindows.length,
      projects: Object.keys(projectCounts).length,
      readyForPR: safeWindows.filter(w => w.gitStats.hasUncommittedChanges && w.gitStats.ahead > 0).length
    }
    
    return { stats, projectCounts }
  }, [windows])

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onNewWindow: () => setIsDialogOpen(true),
    onRefresh: fetchWindows,
    onSearch: () => {},  // Search is now handled in sidebar
    onToggleSidebar: () => {
      const newCollapsedState = !sidebarCollapsed
      setSidebarCollapsed(newCollapsedState)
      localStorage.setItem('sidebar-collapsed', newCollapsedState.toString())
    },
    onEscape: () => {
      if (isDialogOpen) {
        setIsDialogOpen(false)
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
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-200px)]">
            {/* Sidebar */}
            <div className={`transition-all duration-300 ${sidebarCollapsed ? 'lg:col-span-0' : 'lg:col-span-4'}`}>
              <div className={`h-full ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
                <WindowListSidebar
                  windows={windows}
                  selectedWindow={selectedWindow}
                  onWindowSelect={handleWindowSelect}
                  projects={projectCounts}
                  selectedProject={selectedProject}
                  onProjectSelect={setSelectedProject}
                  filterStatus={filterStatus}
                  onFilterChange={setFilterStatus}
                  totalWindows={windows.length}
                  activeWindows={windows.filter(w => w.isActive).length}
                  readyForPRWindows={stats.readyForPR}
                  idleWindows={windows.filter(w => !w.isActive).length}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                />
              </div>
            </div>

            {/* Main Content */}
            <div className={`transition-all duration-300 flex flex-col ${sidebarCollapsed ? 'lg:col-span-12' : 'lg:col-span-8'}`}>
              {/* Controls */}
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-6">
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

              {/* Expanded Window View */}
              <div className="flex-1 overflow-hidden">
                {isLoading ? (
                  <div className="h-full flex items-center justify-center">
                    <EmptyState type="loading" />
                  </div>
                ) : windows.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <EmptyState
                      type="no-windows"
                      onCreateWindow={() => setIsDialogOpen(true)}
                    />
                  </div>
                ) : (
                  <ExpandedWindowView
                    window={selectedWindow}
                    onDelete={handleDeleteWindow}
                  />
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