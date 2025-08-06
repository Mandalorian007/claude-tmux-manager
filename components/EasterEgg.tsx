'use client'

import { useState, useEffect } from 'react'
import { Terminal, Zap, Coffee, Heart } from 'lucide-react'

// Konami Code: ↑↑↓↓←→←→BA
const KONAMI_CODE = [
  'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
  'KeyB', 'KeyA'
]

const MATRIX_CHARS = '01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン'

interface MatrixRainProps {
  active: boolean
}

function MatrixRain({ active }: MatrixRainProps) {
  const [drops, setDrops] = useState<Array<{ x: number; y: number; speed: number; char: string }>>([])

  useEffect(() => {
    if (!active) {
      setDrops([])
      return
    }

    const createDrops = () => {
      const newDrops = []
      for (let i = 0; i < 20; i++) {
        newDrops.push({
          x: Math.random() * window.innerWidth,
          y: Math.random() * -window.innerHeight,
          speed: Math.random() * 3 + 1,
          char: MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)]
        })
      }
      setDrops(newDrops)
    }

    createDrops()

    const interval = setInterval(() => {
      setDrops(prev => prev.map(drop => ({
        ...drop,
        y: drop.y > window.innerHeight ? -50 : drop.y + drop.speed,
        char: Math.random() < 0.1 ? MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)] : drop.char
      })))
    }, 50)

    return () => clearInterval(interval)
  }, [active])

  if (!active) return null

  return (
    <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
      {drops.map((drop, i) => (
        <div
          key={i}
          className="absolute text-accent font-mono text-lg animate-matrix-rain"
          style={{
            left: drop.x,
            top: drop.y,
            textShadow: '0 0 5px currentColor'
          }}
        >
          {drop.char}
        </div>
      ))}
    </div>
  )
}

interface EasterEggModalProps {
  onClose: () => void
}

function EasterEggModal({ onClose }: EasterEggModalProps) {
  const [showMessage, setShowMessage] = useState(false)
  const [messageIndex, setMessageIndex] = useState(0)

  const messages = [
    "You found the secret! 🎉",
    "Welcome to the Matrix, developer!",
    "You've unlocked terminal zen mode",
    "The code is strong with this one...",
    "Achievement unlocked: Terminal Ninja! 🥷"
  ]

  useEffect(() => {
    const timer = setTimeout(() => setShowMessage(true), 500)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!showMessage) return
    
    const interval = setInterval(() => {
      setMessageIndex(prev => (prev + 1) % messages.length)
    }, 2000)
    
    return () => clearInterval(interval)
  }, [showMessage, messages.length])

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-card-bg border-2 border-accent rounded-lg p-8 max-w-md w-full mx-4 text-center relative overflow-hidden">
        {/* Terminal chrome */}
        <div className="absolute top-0 left-0 right-0 h-6 bg-background/90 flex items-center px-3 gap-2">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-error rounded-full" />
            <div className="w-2 h-2 bg-warning rounded-full" />
            <div className="w-2 h-2 bg-success rounded-full" />
          </div>
          <span className="text-xs text-muted font-mono ml-2">easter-egg.exe</span>
        </div>

        <div className="mt-8">
          {/* ASCII Art */}
          <div className="font-mono text-xs text-accent mb-6 animate-terminal-glow">
            <div>    ╔══════════════════╗</div>
            <div>    ║  KONAMI UNLOCKED ║</div>
            <div>    ╚══════════════════╝</div>
            <div>         ╭─────────╮</div>
            <div>         │ ⚡ WOW! ⚡ │</div>
            <div>         ╰─────────╯</div>
          </div>

          {showMessage && (
            <div className="animate-fade-in">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Zap className="w-6 h-6 text-accent animate-bounce-subtle" />
                <h2 className="text-xl font-bold text-foreground">
                  {messages[messageIndex]}
                </h2>
                <Heart className="w-6 h-6 text-error animate-pulse" />
              </div>
              
              <p className="text-muted mb-6">
                You discovered the developer&apos;s secret! The Konami Code still works in 2024.
              </p>

              {/* Terminal command */}
              <div className="bg-background/80 border border-border rounded p-3 mb-6 font-mono text-sm text-left">
                <div className="text-accent flex items-center gap-2">
                  <Terminal className="w-4 h-4" />
                  <span>$ echo &quot;Matrix mode activated&quot;</span>
                </div>
                <div className="text-success text-xs mt-1">
                  ✓ You are the chosen one • Level: Terminal Master
                </div>
              </div>

              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={onClose}
                  className="px-6 py-3 bg-accent text-background rounded-lg hover:bg-accent/90 transition-all duration-200 font-medium hover:scale-105 active:scale-95 group"
                >
                  <span className="flex items-center gap-2">
                    <Coffee className="w-4 h-4 group-hover:rotate-12 transition-transform duration-200" />
                    Back to coding!
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Scan line effect */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-6 left-0 w-full h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent animate-scan-slow" />
        </div>
      </div>
    </div>
  )
}

export function useEasterEgg() {
  const [sequence, setSequence] = useState<string[]>([])
  const [showEasterEgg, setShowEasterEgg] = useState(false)
  const [showMatrix, setShowMatrix] = useState(false)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if typing in input fields
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return
      }

      setSequence(prev => {
        const newSequence = [...prev, event.code].slice(-KONAMI_CODE.length)
        
        // Check if the sequence matches the Konami Code
        if (newSequence.length === KONAMI_CODE.length && 
            newSequence.every((key, index) => key === KONAMI_CODE[index])) {
          setShowEasterEgg(true)
          setShowMatrix(true)
          return []
        }
        
        return newSequence
      })
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const closeEasterEgg = () => {
    setShowEasterEgg(false)
    setShowMatrix(false)
    setSequence([])
  }

  return {
    showEasterEgg,
    showMatrix,
    closeEasterEgg,
    EasterEggModal: () => showEasterEgg ? <EasterEggModal onClose={closeEasterEgg} /> : null,
    MatrixRain: () => <MatrixRain active={showMatrix} />
  }
}