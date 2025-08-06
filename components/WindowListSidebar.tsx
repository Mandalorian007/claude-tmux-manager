'use client'

import { useRef, useState } from 'react'
import { Search, GitBranch, Zap, ChevronDown, Filter } from 'lucide-react'
import type { WindowListSidebarProps, WorkspaceWindow, FilterStatus } from '@/types'

export function WindowListSidebar({
  windows,
  selectedWindow,
  onWindowSelect,
  projects,
  selectedProject,
  onProjectSelect,
  filterStatus,
  onFilterChange,
  totalWindows,
  activeWindows,
  readyForPRWindows,
  idleWindows,
  searchQuery,
  onSearchChange
}: WindowListSidebarProps) {
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [showProjectFilter, setShowProjectFilter] = useState(false)
  
  const projectEntries = Object.entries(projects).sort(([a], [b]) => a.localeCompare(b))

  // Filter windows based on current filters
  let filteredWindows = windows

  // Filter by project
  if (selectedProject !== 'all') {
    filteredWindows = filteredWindows.filter(w => w.projectName === selectedProject)
  }

  // Filter by status
  if (filterStatus !== 'all') {
    filteredWindows = filteredWindows.filter(w => {
      switch (filterStatus) {
        case 'active':
          return w.isActive
        case 'ready-for-pr':
          return w.gitStats.hasUncommittedChanges && w.gitStats.ahead > 0
        case 'idle':
          return !w.isActive
        default:
          return true
      }
    })
  }

  // Filter by search query
  if (searchQuery) {
    const query = searchQuery.toLowerCase()
    filteredWindows = filteredWindows.filter(w => 
      w.projectName.toLowerCase().includes(query) ||
      w.featureName.toLowerCase().includes(query) ||
      w.gitStats.branch.toLowerCase().includes(query)
    )
  }

  return (
    <div className="h-full flex flex-col" data-testid="window-list-sidebar">
      {/* Header with Search and Filters */}
      <div className="bg-sidebar-bg rounded-lg p-4 border border-border mb-4">
        {/* Search Bar */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search windows..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg text-sm placeholder-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-colors"
          />
        </div>
        
        {/* Inline Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => onFilterChange(e.target.value as FilterStatus)}
            className="text-xs bg-background border border-border rounded px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            data-testid="status-filter-select"
          >
            <option value="all">All ({totalWindows})</option>
            <option value="active">Active ({activeWindows})</option>
            <option value="ready-for-pr">Ready for PR ({readyForPRWindows})</option>
            <option value="idle">Idle ({idleWindows})</option>
          </select>
          
          {/* Project Filter */}
          <select
            value={selectedProject}
            onChange={(e) => onProjectSelect(e.target.value)}
            className="text-xs bg-background border border-border rounded px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            data-testid="project-filter-select"
          >
            <option value="all">All Projects</option>
            {projectEntries.map(([project, count]) => (
              <option key={project} value={project}>
                {project} ({count})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Windows List */}
      <div className="flex-1 bg-sidebar-bg rounded-lg border border-border overflow-hidden">
        <div className="p-3 border-b border-border">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted uppercase tracking-wider">
              Windows
            </h3>
            <span className="text-xs text-muted bg-background px-2 py-1 rounded">
              {filteredWindows.length}
            </span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredWindows.length === 0 ? (
            <div className="p-6 text-center text-muted text-sm">
              {searchQuery || selectedProject !== 'all' || filterStatus !== 'all' 
                ? 'No windows match your filters' 
                : 'No windows available'
              }
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {filteredWindows.map((window) => {
                const isSelected = selectedWindow?.projectName === window.projectName && 
                                 selectedWindow?.featureName === window.featureName
                const hasChanges = window.gitStats.hasUncommittedChanges
                const totalAdded = window.gitStats.staged + window.gitStats.unstaged
                
                return (
                  <button
                    key={`${window.projectName}:${window.featureName}`}
                    onClick={() => onWindowSelect(window)}
                    className={`w-full p-3 rounded-lg text-left transition-all duration-200 group ${
                      isSelected 
                        ? 'bg-accent text-background shadow-md border border-accent/20' 
                        : 'hover:bg-secondary/50 hover:border-border/50 border border-transparent'
                    }`}
                    data-testid={`window-item-${window.projectName}-${window.featureName}`}
                  >
                    <div className="space-y-2">
                      {/* Project:Feature name with better visual hierarchy */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          {/* Project badge */}
                          <span className={`text-xs px-2 py-0.5 rounded font-medium truncate max-w-[80px] ${
                            isSelected 
                              ? 'bg-background/20 text-background' 
                              : 'bg-muted/20 text-muted'
                          }`}>
                            {window.projectName}
                          </span>
                          
                          {/* Feature name - main focus */}
                          <span className={`font-medium text-sm truncate ${
                            isSelected ? 'text-background' : 'text-foreground'
                          }`}>
                            {window.featureName}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {/* Git changes indicator */}
                          {hasChanges && (
                            <div className={`flex items-center gap-1 text-xs font-mono ${
                              isSelected ? 'text-background' : 'text-success'
                            }`}>
                              <Zap className="w-3 h-3" />
                              <span>+{totalAdded}</span>
                            </div>
                          )}
                          
                          {/* Active indicator */}
                          {window.isActive && (
                            <div className={`w-2 h-2 rounded-full animate-pulse ${
                              isSelected ? 'bg-background' : 'bg-success'
                            }`} title="Active session" />
                          )}
                        </div>
                      </div>
                      
                      {/* Branch info - secondary */}
                      <div className="flex items-center gap-1 text-xs">
                        <GitBranch className={`w-3 h-3 flex-shrink-0 ${
                          isSelected ? 'text-background/60' : 'text-muted/70'
                        }`} />
                        <span className={`font-mono truncate ${
                          isSelected ? 'text-background/60' : 'text-muted/70'
                        }`}>
                          {window.gitStats.branch.replace('feature/', '')}
                        </span>
                        
                        {!hasChanges && (
                          <span className={`ml-auto font-mono opacity-50 ${
                            isSelected ? 'text-background/50' : 'text-muted/50'
                          }`}>
                            clean
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}