'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react'

interface TerminalNotificationProps {
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
  command?: string
  onClose?: () => void
  autoClose?: boolean
  duration?: number
}

const NOTIFICATION_ICONS = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertCircle,
  info: Info
}

const NOTIFICATION_STYLES = {
  success: {
    border: 'border-success/50',
    bg: 'bg-success/10',
    icon: 'text-success',
    prefix: '$'
  },
  error: {
    border: 'border-error/50',
    bg: 'bg-error/10',
    icon: 'text-error',
    prefix: '!!'
  },
  warning: {
    border: 'border-warning/50',
    bg: 'bg-warning/10',
    icon: 'text-warning',
    prefix: '?'
  },
  info: {
    border: 'border-accent/50',
    bg: 'bg-accent/10',
    icon: 'text-accent',
    prefix: 'i'
  }
}

export function TerminalNotification({
  type,
  title,
  message,
  command,
  onClose,
  autoClose = true,
  duration = 5000
}: TerminalNotificationProps) {
  const [isVisible, setIsVisible] = useState(true)
  const [progress, setProgress] = useState(100)
  
  const Icon = NOTIFICATION_ICONS[type]
  const styles = NOTIFICATION_STYLES[type]

  useEffect(() => {
    if (autoClose && onClose) {
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          const newProgress = prev - (100 / (duration / 50))
          if (newProgress <= 0) {
            clearInterval(progressInterval)
            setIsVisible(false)
            setTimeout(onClose, 300)
            return 0
          }
          return newProgress
        })
      }, 50)

      return () => clearInterval(progressInterval)
    }
  }, [autoClose, onClose, duration])

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(() => onClose?.(), 300)
  }

  if (!isVisible) return null

  return (
    <div className={`fixed top-4 right-4 z-50 transform transition-all duration-300 ease-out ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'} max-w-md w-full ${styles.bg} ${styles.border} border rounded-lg shadow-2xl backdrop-blur-sm animate-slide-in-right`}>
      {/* Progress bar */}
      {autoClose && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-border/30 rounded-t-lg overflow-hidden">
          <div 
            className={`h-full ${styles.icon.replace('text-', 'bg-')} transition-all duration-50 ease-linear`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <div className="p-4 pt-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="flex-shrink-0">
              <Icon className={`w-5 h-5 ${styles.icon}`} />
            </div>
            
            <div className="flex-1 min-w-0">
              {/* Terminal-style header */}
              <div className="flex items-center gap-2 mb-2">
                <span className={`font-mono text-sm ${styles.icon} font-bold`}>
                  [{styles.prefix}]
                </span>
                <span className="font-medium text-foreground text-sm">{title}</span>
              </div>
              
              {/* Command output style */}
              {message && (
                <div className="font-mono text-xs text-muted mb-2 pl-6">
                  {message}
                </div>
              )}
              
              {/* Command that was executed */}
              {command && (
                <div className="font-mono text-xs bg-background/50 rounded px-3 py-2 border border-border/50 pl-6">
                  <span className="text-accent">$</span>{' '}
                  <span className="text-foreground">{command}</span>
                </div>
              )}
            </div>
          </div>
          
          {onClose && (
            <button
              onClick={handleClose}
              className="flex-shrink-0 p-1 text-muted hover:text-foreground transition-colors rounded"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// Hook for managing notifications
export function useTerminalNotifications() {
  const [notifications, setNotifications] = useState<(TerminalNotificationProps & { id: string })[]>([])

  const addNotification = (notification: Omit<TerminalNotificationProps, 'onClose'>) => {
    const id = Math.random().toString(36).substr(2, 9)
    const newNotification = {
      ...notification,
      id,
      onClose: () => removeNotification(id)
    }
    
    setNotifications(prev => [...prev, newNotification])
    
    return id
  }

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const showSuccess = (title: string, options?: Partial<TerminalNotificationProps>) => {
    return addNotification({ type: 'success', title, ...options })
  }

  const showError = (title: string, options?: Partial<TerminalNotificationProps>) => {
    return addNotification({ type: 'error', title, autoClose: false, ...options })
  }

  const showWarning = (title: string, options?: Partial<TerminalNotificationProps>) => {
    return addNotification({ type: 'warning', title, ...options })
  }

  const showInfo = (title: string, options?: Partial<TerminalNotificationProps>) => {
    return addNotification({ type: 'info', title, ...options })
  }

  const NotificationContainer = () => (
    <div className="fixed top-0 right-0 z-50 p-4 space-y-2 pointer-events-none">
      {notifications.map(notification => (
        <div key={notification.id} className="pointer-events-auto">
          <TerminalNotification {...notification} />
        </div>
      ))}
    </div>
  )

  return {
    notifications,
    addNotification,
    removeNotification,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    NotificationContainer
  }
}