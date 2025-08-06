'use client'

import { Folder, FolderOpen, Activity, GitPullRequest, Clock, AlertCircle } from 'lucide-react'

type FilterStatus = 'all' | 'active' | 'ready-for-pr' | 'idle'

interface ProjectSidebarProps {
  projects: Record<string, number>
  selectedProject: string
  onProjectSelect: (project: string) => void
  filterStatus: FilterStatus
  onFilterChange: (status: FilterStatus) => void
  totalWindows: number
  activeWindows: number
  readyForPRWindows: number
  idleWindows: number
}

export function ProjectSidebar({
  projects,
  selectedProject,
  onProjectSelect,
  filterStatus,
  onFilterChange,
  totalWindows,
  activeWindows,
  readyForPRWindows,
  idleWindows
}: ProjectSidebarProps) {
  const projectEntries = Object.entries(projects).sort(([a], [b]) => a.localeCompare(b))

  const statusFilters = [
    { id: 'all' as const, label: 'All', count: totalWindows, icon: Folder },
    { id: 'active' as const, label: 'Active', count: activeWindows, icon: Activity, color: 'text-success' },
    { id: 'ready-for-pr' as const, label: 'Ready for PR', count: readyForPRWindows, icon: GitPullRequest, color: 'text-accent' },
    { id: 'idle' as const, label: 'Idle', count: idleWindows, icon: Clock, color: 'text-muted' }
  ]

  return (
    <div className="space-y-6" data-testid="project-sidebar">
      {/* Projects Section */}
      <div className="bg-sidebar-bg rounded-lg p-4 border border-border">
        <h3 className="text-sm font-medium text-muted uppercase tracking-wider mb-3">Projects</h3>
        <div className="space-y-1">
          <button
            onClick={() => onProjectSelect('all')}
            className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors ${
              selectedProject === 'all'
                ? 'bg-accent text-background font-medium'
                : 'text-foreground hover:bg-secondary'
            }`}
            data-testid="project-filter-all"
          >
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4" />
              <span>All</span>
            </div>
            <span className="text-xs px-2 py-0.5 bg-secondary rounded-full">
              {totalWindows}
            </span>
          </button>
          
          {projectEntries.map(([project, count]) => (
            <button
              key={project}
              onClick={() => onProjectSelect(project)}
              className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors ${
                selectedProject === project
                  ? 'bg-accent text-background font-medium'
                  : 'text-foreground hover:bg-secondary'
              }`}
              data-testid={`project-filter-${project}`}
            >
              <div className="flex items-center gap-2">
                <Folder className="w-4 h-4" />
                <span className="truncate">{project}</span>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                selectedProject === project ? 'bg-background/20' : 'bg-secondary'
              }`}>
                {count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Quick Filters Section */}
      <div className="bg-sidebar-bg rounded-lg p-4 border border-border">
        <h3 className="text-sm font-medium text-muted uppercase tracking-wider mb-3">Quick Filters</h3>
        <div className="space-y-1">
          {statusFilters.map(({ id, label, count, icon: Icon, color = 'text-foreground' }) => (
            <button
              key={id}
              onClick={() => onFilterChange(id)}
              className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors ${
                filterStatus === id
                  ? 'bg-accent text-background font-medium'
                  : 'text-foreground hover:bg-secondary'
              }`}
              data-testid={`status-filter-${id}`}
            >
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  id === 'active' ? 'bg-success' : 
                  id === 'ready-for-pr' ? 'bg-accent' : 
                  id === 'idle' ? 'bg-muted' : 
                  'bg-border'
                }`} />
                <span>{label}</span>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                filterStatus === id ? 'bg-background/20' : 'bg-secondary'
              }`}>
                {count}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}