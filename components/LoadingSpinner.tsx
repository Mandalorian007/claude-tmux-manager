'use client'

import { useState, useEffect } from 'react'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  color?: 'accent' | 'muted' | 'foreground'
  type?: 'spinner' | 'terminal' | 'dots'
  message?: string
}

const TERMINAL_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
const DOT_FRAMES = ['.', '..', '...', '']

const LOADING_MESSAGES = [
  'Initializing tmux session...',
  'Creating git worktree...',
  'Setting up development environment...',
  'Configuring Claude Code workspace...',
  'Syncing project dependencies...',
  'Preparing terminal interface...'
]

export function LoadingSpinner({ 
  size = 'md', 
  className = '', 
  color = 'accent',
  type = 'terminal',
  message
}: LoadingSpinnerProps) {
  const [frameIndex, setFrameIndex] = useState(0)
  const [messageIndex, setMessageIndex] = useState(0)
  const [currentMessage, setCurrentMessage] = useState(message || LOADING_MESSAGES[0])

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base', 
    lg: 'text-lg'
  }

  const colorClasses = {
    accent: 'text-accent',
    muted: 'text-muted', 
    foreground: 'text-foreground'
  }

  useEffect(() => {
    const interval = setInterval(() => {
      if (type === 'terminal') {
        setFrameIndex((prev) => (prev + 1) % TERMINAL_FRAMES.length)
      } else if (type === 'dots') {
        setFrameIndex((prev) => (prev + 1) % DOT_FRAMES.length)
      }
    }, 100)

    return () => clearInterval(interval)
  }, [type])

  useEffect(() => {
    if (!message) {
      const messageInterval = setInterval(() => {
        setMessageIndex((prev) => {
          const newIndex = (prev + 1) % LOADING_MESSAGES.length
          setCurrentMessage(LOADING_MESSAGES[newIndex])
          return newIndex
        })
      }, 2000)

      return () => clearInterval(messageInterval)
    }
  }, [message])

  if (type === 'spinner') {
    return (
      <div
        className={`
          w-${size === 'sm' ? '4' : size === 'md' ? '6' : '8'} 
          h-${size === 'sm' ? '4' : size === 'md' ? '6' : '8'}
          border-2 
          border-${color} border-t-transparent
          rounded-full 
          animate-spin
          ${className}
        `}
        role="status"
        aria-label="Loading"
        data-testid="loading-spinner"
      >
        <span className="sr-only">Loading...</span>
      </div>
    )
  }

  if (type === 'terminal') {
    return (
      <div className={`flex items-center gap-3 ${sizeClasses[size]} ${colorClasses[color]} ${className}`} role="status" data-testid="loading-spinner">
        <span className="font-mono text-accent animate-pulse">{TERMINAL_FRAMES[frameIndex]}</span>
        <span className="terminal-text">{currentMessage}</span>
        <div className="w-2 h-4 bg-accent animate-pulse ml-1" style={{ animationDuration: '1s' }} />
      </div>
    )
  }

  if (type === 'dots') {
    return (
      <div className={`flex items-center gap-2 ${sizeClasses[size]} ${colorClasses[color]} ${className}`} role="status">
        <span className="terminal-text">{currentMessage}</span>
        <span className="font-mono w-6 text-left">{DOT_FRAMES[frameIndex]}</span>
      </div>
    )
  }

  return null
}