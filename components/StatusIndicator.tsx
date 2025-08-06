import { Activity, Clock, GitPullRequest, AlertTriangle } from 'lucide-react'

interface StatusIndicatorProps {
  status: 'active' | 'idle' | 'ready-for-pr' | 'unhealthy' | 'loading'
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  className?: string
}

export function StatusIndicator({ 
  status, 
  size = 'md', 
  showLabel = false, 
  className = '' 
}: StatusIndicatorProps) {
  const configs = {
    active: {
      color: 'text-success',
      bgColor: 'bg-success',
      icon: Activity,
      label: 'Active',
      dotClass: 'bg-success animate-pulse'
    },
    idle: {
      color: 'text-muted',
      bgColor: 'bg-muted',
      icon: Clock,
      label: 'Idle',
      dotClass: 'bg-muted'
    },
    'ready-for-pr': {
      color: 'text-accent',
      bgColor: 'bg-accent',
      icon: GitPullRequest,
      label: 'Ready for PR',
      dotClass: 'bg-accent animate-pulse-slow'
    },
    unhealthy: {
      color: 'text-error',
      bgColor: 'bg-error',
      icon: AlertTriangle,
      label: 'Unhealthy',
      dotClass: 'bg-error animate-pulse'
    },
    loading: {
      color: 'text-muted',
      bgColor: 'bg-muted',
      icon: Clock,
      label: 'Loading',
      dotClass: 'bg-muted animate-pulse'
    }
  }

  const config = configs[status]
  const Icon = config.icon

  const sizeClasses = {
    sm: {
      dot: 'w-2 h-2',
      icon: 'w-3 h-3',
      text: 'text-xs'
    },
    md: {
      dot: 'w-3 h-3',
      icon: 'w-4 h-4',
      text: 'text-sm'
    },
    lg: {
      dot: 'w-4 h-4',
      icon: 'w-5 h-5',
      text: 'text-base'
    }
  }

  const sizes = sizeClasses[size]

  if (showLabel) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className={`${sizes.dot} rounded-full ${config.dotClass}`} />
        <Icon className={`${sizes.icon} ${config.color}`} />
        <span className={`${sizes.text} ${config.color} font-medium`}>
          {config.label}
        </span>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-1.5 ${className}`} title={config.label}>
      <div className={`${sizes.dot} rounded-full ${config.dotClass}`} />
      <Icon className={`${sizes.icon} ${config.color}`} />
    </div>
  )
}