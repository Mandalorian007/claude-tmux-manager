'use client'

import { useState, useEffect } from 'react'
import { X, FolderOpen, Plus, Zap, Terminal, GitBranch } from 'lucide-react'
import { LoadingSpinner } from './LoadingSpinner'
import type { CreateSessionRequest } from '@/types'

interface NewWindowDialogProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (request: CreateWindowRequest) => void
  isLoading?: boolean
}

export function NewWindowDialog({ 
  isOpen, 
  onClose, 
  onSubmit, 
  isLoading = false 
}: NewWindowDialogProps) {
  const [projectPath, setProjectPath] = useState('')
  const [featureName, setFeatureName] = useState('')
  const [enhancedMode, setEnhancedMode] = useState(true)
  const [showTerminalPreview, setShowTerminalPreview] = useState(false)
  const [previewCommand, setPreviewCommand] = useState('')
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true)
      setShowTerminalPreview(true)
    } else {
      setIsVisible(false)
      setShowTerminalPreview(false)
    }
  }, [isOpen])

  useEffect(() => {
    if (projectPath && featureName) {
      const projectName = projectPath.split('/').pop() || 'project'
      setPreviewCommand(`tmux new-window -t claude-tmux-manager -n "${projectName}:${featureName}" -c "${projectPath}"`)
    } else {
      setPreviewCommand('tmux new-window -t claude-tmux-manager -n "project:feature" -c "/path/to/project"')
    }
  }, [projectPath, featureName])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (projectPath.trim() && featureName.trim()) {
      const trimmedPath = projectPath.trim()
      const projectName = trimmedPath.split('/').pop() || 'unknown-project'
      
      onSubmit({
        projectName,
        projectPath: trimmedPath,
        featureName: featureName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        createWorktree: true // Default to creating worktree
      })
    }
  }

  const handleFeatureNameChange = (value: string) => {
    // Auto-format to URL-safe
    const formatted = value.toLowerCase().replace(/[^a-z0-9-\s]/g, '').replace(/\s+/g, '-')
    setFeatureName(formatted)
  }

  const handleProjectPathValidation = (path: string) => {
    setProjectPath(path)
    // You could add path validation logic here
  }

  if (!isOpen) return null

  return (
    <div className={`
      fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4
      transition-all duration-300
      ${isVisible ? 'opacity-100' : 'opacity-0'}
    `}>
      <div className={`
        bg-card-bg border-2 border-accent/30 rounded-lg p-6 w-full max-w-lg         transition-all duration-300 transform
        ${isVisible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}
        relative overflow-hidden
      `} data-testid="new-window-dialog">
        {/* Terminal window chrome */}
        <div className="absolute top-0 left-0 right-0 h-6 bg-background/80 flex items-center px-3 gap-2">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 bg-error rounded-full" />
            <div className="w-2.5 h-2.5 bg-warning rounded-full" />
            <div className="w-2.5 h-2.5 bg-success rounded-full" />
          </div>
          <span className="text-xs text-muted font-mono ml-2">create-window.sh</span>
        </div>
        <div className="flex items-center justify-between mb-6 mt-8">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-accent animate-pulse" />
            <h2 className="text-xl font-semibold text-foreground font-mono">
              <span className="text-accent">$</span> new-window
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted hover:text-error hover:bg-error/10 rounded-lg transition-all duration-200 hover:scale-110"
            disabled={isLoading}
            title="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Project Path
            </label>
            <div className="relative">
              <input
                type="text"
                value={projectPath}
                onChange={(e) => handleProjectPathValidation(e.target.value)}
                placeholder="/path/to/your/project"
                className="w-full pl-10 pr-3 py-3 bg-background border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                required
                disabled={isLoading}
              />
              <FolderOpen className="absolute left-3 top-3.5 w-4 h-4 text-muted" />
            </div>
            <p className="text-xs text-muted mt-1.5">
              Path to the git repository root directory
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Feature Name
            </label>
            <input
              type="text"
              value={featureName}
              onChange={(e) => handleFeatureNameChange(e.target.value)}
              placeholder="user-authentication"
              className="w-full px-3 py-3 bg-background border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
              required
              disabled={isLoading}
            />
            <p className="text-xs text-muted mt-1.5">
              URL-safe name (lowercase, hyphens only)
            </p>
          </div>

          <div>
            <label className="flex items-center gap-3 py-2">
              <input
                type="checkbox"
                checked={enhancedMode}
                onChange={(e) => setEnhancedMode(e.target.checked)}
                className="w-4 h-4 text-accent bg-background border-border rounded focus:ring-accent focus:ring-2"
                disabled={isLoading}
              />
              <div>
                <span className="text-sm font-medium text-foreground">Enhanced Mode</span>
                <p className="text-xs text-muted">Enable advanced Claude Code features and automation</p>
              </div>
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 text-foreground bg-secondary border border-border rounded-lg hover:bg-border/50 transition-colors font-medium"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-accent text-background rounded-lg hover:bg-accent/90 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium hover:scale-105 active:scale-95 group"
              disabled={isLoading || !projectPath.trim() || !featureName.trim()}
            >
              {isLoading ? (
                <>
                  <LoadingSpinner type="terminal" size="sm" color="foreground" message="Initializing..." />
                </>
              ) : (
                <>
                  <GitBranch className="w-4 h-4 group-hover:rotate-12 transition-transform duration-200" />
                  <span className="font-mono">$ init</span>
                  <Zap className="w-3 h-3" />
                </>
              )}
            </button>
          </div>
          
          {/* Terminal command preview */}
          {showTerminalPreview && (projectPath || featureName) && (
            <div className="mt-6 pt-4 border-t border-border/30">
              <div className="flex items-center gap-2 mb-2">
                <Terminal className="w-4 h-4 text-accent" />
                <span className="text-sm font-medium text-foreground">Command Preview</span>
              </div>
              <div className="bg-background/80 border border-border/50 rounded p-3 font-mono text-xs">
                <div className="flex items-center gap-2 text-accent mb-1">
                  <span>$</span>
                  <span className="animate-typing overflow-hidden whitespace-nowrap">
                    {previewCommand}
                  </span>
                </div>
                <div className="text-muted text-xs mt-2">
                  <div>✓ Create tmux window</div>
                  <div>✓ Setup git worktree</div>
                  <div>✓ Initialize Claude Code workspace</div>
                  {enhancedMode && <div>✓ Enable enhanced features</div>}
                </div>
              </div>
            </div>
          )}
        </form>
        
        {/* Subtle terminal effects */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-6 left-0 w-full h-px bg-gradient-to-r from-transparent via-accent/20 to-transparent" />
          <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-accent/10 to-transparent" />
        </div>
      </div>
    </div>
  )
}