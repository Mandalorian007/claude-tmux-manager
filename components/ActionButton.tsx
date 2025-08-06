import React from 'react'
import { LoadingSpinner } from './LoadingSpinner'
import { LucideIcon } from 'lucide-react'

interface ActionButtonProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  disabled?: boolean
  icon?: LucideIcon
  children: React.ReactNode
  onClick?: () => void
  type?: 'button' | 'submit' | 'reset'
  className?: string
  fullWidth?: boolean
  'data-testid'?: string
}

export function ActionButton({
  variant = 'secondary',
  size = 'md',
  isLoading = false,
  disabled = false,
  icon: Icon,
  children,
  onClick,
  type = 'button',
  className = '',
  fullWidth = false,
  'data-testid': dataTestId
}: ActionButtonProps) {
  const baseClasses = 'inline-flex items-center justify-center gap-2 font-medium font-mono rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background disabled:cursor-not-allowed transform-gpu hover:scale-105 active:scale-95 group'
  
  const variantClasses = {
    primary: 'bg-accent text-background hover:bg-accent/90 hover:shadow-lg hover:shadow-accent/20 focus:ring-accent disabled:opacity-50 relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:translate-x-[-100%] hover:before:translate-x-[100%] before:transition-transform before:duration-500',
    secondary: 'bg-transparent border border-border text-muted hover:text-foreground hover:border-accent/50 hover:shadow-md hover:shadow-accent/10 focus:ring-accent disabled:opacity-50',
    danger: 'bg-transparent border border-border text-muted hover:text-error hover:border-error/50 hover:bg-error/5 focus:ring-error disabled:opacity-50',
    ghost: 'bg-transparent text-muted hover:text-foreground hover:bg-secondary/50 focus:ring-secondary disabled:opacity-50'
  }
  
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  }

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4', 
    lg: 'w-5 h-5'
  }

  const spinnerSizes = {
    sm: 'sm' as const,
    md: 'sm' as const,
    lg: 'md' as const
  }

  const isDisabled = disabled || isLoading

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      data-testid={dataTestId}
      className={`
        ${baseClasses}
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
    >
      {isLoading ? (
        <>
          <LoadingSpinner 
            size={spinnerSizes[size]} 
            color={variant === 'primary' ? 'foreground' : 'accent'} 
          />
          {typeof children === 'string' ? 'Loading...' : children}
        </>
      ) : (
        <>
          {Icon && <Icon className={`${iconSizes[size]} group-hover:rotate-12 transition-transform duration-200`} />}
          {children}
        </>
      )}
    </button>
  )
}