'use client'

import React, { forwardRef, useState, useEffect } from 'react'
import { Search, X, Terminal, Zap } from 'lucide-react'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(
  ({ value, onChange, placeholder = "Search windows, branches...", className = "" }, ref) => {
    const [isFocused, setIsFocused] = useState(false)
    const [showCursor, setShowCursor] = useState(true)
    const [searchTip, setSearchTip] = useState(0)
    
    const searchTips = [
      'project:myapp',
      'branch:feature/*', 
      'status:active',
      'git:uncommitted',
      'type:worktree'
    ]

    // Blinking cursor effect for terminal feel
    useEffect(() => {
      const interval = setInterval(() => {
        setShowCursor(prev => !prev)
      }, 600)
      return () => clearInterval(interval)
    }, [])

    // Rotate search tips
    useEffect(() => {
      const interval = setInterval(() => {
        setSearchTip(prev => (prev + 1) % searchTips.length)
      }, 3000)
      return () => clearInterval(interval)
    }, [searchTips.length])

    return (
      <div className={`relative group ${className}`}>
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className={`h-4 w-4 transition-all duration-200 ${isFocused ? 'text-accent animate-pulse' : 'text-muted'}`} />
        </div>
        
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={isFocused ? `Try: ${searchTips[searchTip]}` : placeholder}
          data-testid="search-input"
          className={`
            w-full pl-10 pr-12 py-2.5 font-mono text-sm
            bg-card-bg border border-border rounded-lg 
            placeholder:text-muted placeholder:transition-all placeholder:duration-300
            focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent
            focus:bg-background/50             transition-all duration-200
            ${isFocused ? 'scale-[1.02]' : ''}
          `}
        />
        
        {/* Terminal cursor effect when focused and empty */}
        {isFocused && !value && showCursor && (
          <div className="absolute inset-y-0 left-10 flex items-center pointer-events-none">
            <div className="w-1.5 h-4 bg-accent animate-pulse" />
          </div>
        )}
        
        {value && (
          <button
            onClick={() => onChange('')}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted hover:text-error hover:scale-110 transition-all duration-200 group"
            title="Clear search"
          >
            <X className="h-4 w-4 group-hover:rotate-90 transition-transform duration-200" />
          </button>
        )}
        
        {/* Search suggestions tooltip */}
        {isFocused && !value && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-card-bg border border-border/50 rounded-lg p-3 z-10  animate-fade-in">
            <div className="flex items-center gap-2 mb-2">
              <Terminal className="w-3 h-3 text-accent" />
              <span className="text-xs font-medium text-foreground">Search Tips</span>
            </div>
            <div className="space-y-1 text-xs text-muted font-mono">
              <div>• Use filters: <code className="text-accent">status:active</code></div>
              <div>• Search branches: <code className="text-accent">feature/auth</code></div>
              <div>• Find projects: <code className="text-accent">myapp</code></div>
              <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border/30">
                <Zap className="w-3 h-3 text-accent" />
                <span>Tip: Use Ctrl+K to focus search</span>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }
)

SearchBar.displayName = 'SearchBar'