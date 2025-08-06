'use client'

import { useEffect, useState } from 'react'

interface KeyboardShortcutsProps {
  onNewWindow?: () => void
  onRefresh?: () => void
  onSearch?: () => void
  onEscape?: () => void
  onToggleSidebar?: () => void
}

export function useKeyboardShortcuts({
  onNewWindow,
  onRefresh,
  onSearch,
  onEscape,
  onToggleSidebar
}: KeyboardShortcutsProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        // Allow Escape to blur inputs
        if (event.key === 'Escape' && onEscape) {
          onEscape()
        }
        return
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const cmdOrCtrl = isMac ? event.metaKey : event.ctrlKey

      // Cmd/Ctrl + N: New Window
      if (cmdOrCtrl && event.key === 'n' && onNewWindow) {
        event.preventDefault()
        onNewWindow()
      }

      // Cmd/Ctrl + R: Refresh
      if (cmdOrCtrl && event.key === 'r' && onRefresh) {
        event.preventDefault()
        onRefresh()
      }

      // Cmd/Ctrl + K or /: Focus search
      if (((cmdOrCtrl && event.key === 'k') || event.key === '/') && onSearch) {
        event.preventDefault()
        onSearch()
      }

      // Cmd/Ctrl + B: Toggle sidebar
      if (cmdOrCtrl && event.key === 'b' && onToggleSidebar) {
        event.preventDefault()
        onToggleSidebar()
      }

      // Escape: Close modals or blur focus
      if (event.key === 'Escape' && onEscape) {
        onEscape()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onNewWindow, onRefresh, onSearch, onEscape, onToggleSidebar])
}

interface ShortcutHintProps {
  keys: string[]
  description: string
  className?: string
}

export function ShortcutHint({ keys, description, className = '' }: ShortcutHintProps) {
  const [isMac, setIsMac] = useState(false)
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().indexOf('MAC') >= 0)
    setMounted(true)
  }, [])
  
  const formatKey = (key: string) => {
    if (key === 'mod') return isMac ? '⌘' : 'Ctrl'
    if (key === 'shift') return '⇧'
    if (key === 'alt') return isMac ? '⌥' : 'Alt'
    if (key === 'enter') return '↵'
    if (key === 'escape') return 'Esc'
    return key.toUpperCase()
  }

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <div className={`flex items-center gap-2 text-xs ${className}`}>
        <span className="text-muted">{description}</span>
        <div className="flex items-center gap-1">
          {keys.map((key, index) => (
            <span key={key} className="flex items-center">
              <kbd className="px-1.5 py-0.5 bg-secondary text-muted border border-border rounded text-xs font-mono">
                {key === 'mod' ? 'Ctrl' : key.toUpperCase()}
              </kbd>
              {index < keys.length - 1 && <span className="mx-0.5 text-muted">+</span>}
            </span>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-2 text-xs ${className}`}>
      <span className="text-muted">{description}</span>
      <div className="flex items-center gap-1">
        {keys.map((key, index) => (
          <span key={key} className="flex items-center">
            <kbd className="px-1.5 py-0.5 bg-secondary text-muted border border-border rounded text-xs font-mono">
              {formatKey(key)}
            </kbd>
            {index < keys.length - 1 && <span className="mx-0.5 text-muted">+</span>}
          </span>
        ))}
      </div>
    </div>
  )
}