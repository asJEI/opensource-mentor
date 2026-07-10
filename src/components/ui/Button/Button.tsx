import React from 'react'
import clsx from 'clsx'

export interface ButtonProps {
  /** 按钮变体 */
  variant?: 'primary' | 'secondary' | 'white' | 'ghost'
  /** 按钮尺寸 */
  size?: 'sm' | 'md' | 'lg'
  /** 是否加载中 */
  loading?: boolean
  /** 是否禁用 */
  disabled?: boolean
  /** 点击事件 */
  onClick?: () => void
  /** 按钮内容 */
  children: React.ReactNode
  /** 自定义类名 */
  className?: string
  /** 前置图标 */
  icon?: React.ReactNode
  /** 按钮类型 */
  type?: 'button' | 'submit' | 'reset'
}

/**
 * 按钮组件
 */
export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  onClick,
  children,
  className,
  icon,
  type = 'button',
}) => {
  const classes = clsx(
    'btn',
    {
      'btn-primary': variant === 'primary',
      'btn-secondary': variant === 'secondary',
      'btn-white': variant === 'white',
      'btn-ghost': variant === 'ghost',
      'btn-sm': size === 'sm',
      'btn-lg': size === 'lg',
    },
    className
  )

  const handleClick = () => {
    if (disabled || loading) return
    onClick?.()
  }

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      onClick={handleClick}
    >
      {loading && <span className="btn-spinner" />}
      {!loading && icon && <span className="btn-icon">{icon}</span>}
      {children}
    </button>
  )
}

export default Button
