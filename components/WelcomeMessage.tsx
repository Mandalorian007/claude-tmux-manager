'use client'

import { useState, useEffect } from 'react'
import { Terminal, Coffee, Zap, GitBranch, Code } from 'lucide-react'

interface WelcomeMessageProps {
  onDismiss?: () => void
}

const WELCOME_MESSAGES = [
  {
    icon: Terminal,
    title: "Welcome to Claude TMux Manager!",
    message: "Your terminal-based development companion is ready to rock.",
    command: "$ claude-tmux-manager --status=online"
  },
  {
    icon: GitBranch,
    title: "Ready to branch out?",
    message: "Manage multiple features like a git wizard with tmux sessions.",
    command: "$ git worktree add ../feature-branch && tmux new"
  },
  {
    icon: Code,
    title: "Code at warp speed!",
    message: "Each session is an isolated development environment.",
    command: "$ tmux list-sessions | grep -E '(active|running)'"
  },
  {
    icon: Coffee,
    title: "Fuel your coding sessions",
    message: "Time to brew some code. Your workspace awaits!",
    command: "$ pnpm dev && tmux attach-session -t main"
  }
]

const ASCII_LOGO = [
  '     ╔══════════════════════════════╗',
  '     ║    ⚡ CLAUDE TMUX MANAGER ⚡    ║',
  '     ╚══════════════════════════════╝',
  '           ╭─────────────────╮',
  '           │  READY TO CODE! │',
  '           ╰─────────────────╯'
]

export function WelcomeMessage({ onDismiss }: WelcomeMessageProps) {
  const [currentMessage, setCurrentMessage] = useState(0)
  const [showCursor, setShowCursor] = useState(true)
  const [isVisible, setIsVisible] = useState(true)
  const [commandText, setCommandText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  
  const message = WELCOME_MESSAGES[currentMessage]

  // Blinking cursor effect
  useEffect(() => {
    const interval = setInterval(() => {
      setShowCursor(prev => !prev)
    }, 600)
    return () => clearInterval(interval)
  }, [])

  // Typewriter effect for command
  useEffect(() => {
    const command = message.command
    let index = 0
    setCommandText('')
    setIsTyping(true)

    const typeInterval = setInterval(() => {
      if (index < command.length) {
        setCommandText(command.slice(0, index + 1))
        index++
      } else {
        setIsTyping(false)
        clearInterval(typeInterval)
      }
    }, 50)

    return () => clearInterval(typeInterval)
  }, [message.command])

  // Auto-advance messages
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentMessage(prev => (prev + 1) % WELCOME_MESSAGES.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  const handleDismiss = () => {
    setIsVisible(false)
    setTimeout(() => {
      onDismiss?.()
    }, 300)
  }

  if (!isVisible) return null

  const Icon = message.icon

  return (
    <div className={`fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 transition-all duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
      <div className={`bg-card-bg border-2 border-accent/30 rounded-lg p-8 max-w-2xl w-full mx-4 relative overflow-hidden transition-all duration-300 transform ${isVisible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}`}>
        {/* Terminal window chrome */}
        <div className="absolute top-0 left-0 right-0 h-8 bg-background/90 flex items-center px-4 gap-2">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-error rounded-full" />
            <div className="w-3 h-3 bg-warning rounded-full" />
            <div className="w-3 h-3 bg-success rounded-full" />
          </div>
          <span className="text-xs text-muted font-mono ml-3">welcome.sh</span>
        </div>

        <div className="mt-6 text-center">
          {/* ASCII Art Logo */}
          <div className="font-mono text-xs text-accent space-y-1 mb-8">
            {ASCII_LOGO.map((line, i) => (
              <div key={i} className={i <= 2 ? 'animate-terminal-glow' : 'animate-bounce-subtle'} style={{ animationDelay: `${i * 100}ms` }}>
                {line}
              </div>
            ))}
          </div>

          {/* Message Content */}
          <div className="mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Icon className="w-8 h-8 text-accent animate-bounce-subtle" />
              <h2 className="text-2xl font-bold text-foreground">
                {message.title}
              </h2>
            </div>
            
            <p className="text-lg text-muted mb-6 max-w-md mx-auto">
              {message.message}
            </p>
          </div>

          {/* Terminal Command Demo */}
          <div className="bg-background/80 border border-border rounded-lg p-4 mb-8 text-left max-w-lg mx-auto">
            <div className="flex items-center gap-2 mb-2">
              <Terminal className="w-4 h-4 text-accent" />
              <span className="text-sm font-medium text-foreground">Terminal</span>
            </div>
            <div className="font-mono text-sm">
              <div className="flex items-center text-accent">
                <span>$</span>
                <span className="ml-2">{commandText}</span>
                {(isTyping || showCursor) && <span className="bg-accent w-1.5 h-4 inline-block ml-1 animate-pulse" />}
              </div>
              <div className="text-success text-xs mt-1">
                ✓ System ready • Sessions: 0 • Projects: 0
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={handleDismiss}
              className="px-6 py-3 bg-accent text-background rounded-lg hover:bg-accent/90 transition-all duration-200 font-medium hover:scale-105 active:scale-95 group"
            >
              <span className="flex items-center gap-2">
                <Zap className="w-4 h-4 group-hover:rotate-12 transition-transform duration-200" />
                Get Started
              </span>
            </button>
            
            <button
              onClick={() => setCurrentMessage((prev) => (prev + 1) % WELCOME_MESSAGES.length)}
              className="px-4 py-3 text-muted hover:text-foreground transition-colors font-mono text-sm"
            >
              Next tip →
            </button>
          </div>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-2 mt-6">
            {WELCOME_MESSAGES.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentMessage(index)}
                className={`w-2 h-2 rounded-full transition-all duration-200 ${
                  index === currentMessage ? 'bg-accent' : 'bg-border hover:bg-muted'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Terminal scan line effect */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-8 left-0 w-full h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent animate-scan-slow" />
        </div>
      </div>
    </div>
  )
}

// Hook to manage welcome message state
export function useWelcomeMessage() {
  const [showWelcome, setShowWelcome] = useState(() => {
    // Show welcome on first visit
    if (typeof window !== 'undefined') {
      return !localStorage.getItem('claude-tmux-welcome-seen')
    }
    return false
  })

  const dismissWelcome = () => {
    setShowWelcome(false)
    if (typeof window !== 'undefined') {
      localStorage.setItem('claude-tmux-welcome-seen', 'true')
    }
  }

  const showWelcomeAgain = () => {
    setShowWelcome(true)
    if (typeof window !== 'undefined') {
      localStorage.removeItem('claude-tmux-welcome-seen')
    }
  }

  return {
    showWelcome,
    dismissWelcome,
    showWelcomeAgain
  }
}