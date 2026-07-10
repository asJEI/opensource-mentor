import React from 'react'
import clsx from 'clsx'

export interface BadgeProps {
  /** 徽章内容 */
  children: React.ReactNode
  /** 变体 */
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'accent'
  /** 尺寸 */
  size?: 'sm' | 'md'
  /** 自定义类名 */
  className?: string
}

/**
 * 徽章组件
 */
export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  className,
}) => {
  return (
    <span
      className={clsx(
        'badge',
        {
          'badge-default': variant === 'default',
          'badge-success': variant === 'success',
          'badge-warning': variant === 'warning',
          'badge-danger': variant === 'danger',
          'badge-info': variant === 'info',
          'badge-accent': variant === 'accent',
          'badge-sm': size === 'sm',
          'badge-md': size === 'md',
        },
        className
      )}
    >
      {children}
    </span>
  )
}

export default Badge
