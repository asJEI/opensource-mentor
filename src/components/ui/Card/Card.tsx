import React from 'react'
import clsx from 'clsx'

export interface CardProps {
  /** 卡片标题 */
  title?: React.ReactNode
  /** 标题图标 */
  icon?: React.ReactNode
  /** 卡片内容 */
  children: React.ReactNode
  /** 自定义类名 */
  className?: string
  /** 头部自定义类名 */
  headerClassName?: string
  /** 内容区自定义类名 */
  bodyClassName?: string
  /** 是否有悬停效果 */
  hover?: boolean
}

/**
 * 卡片组件
 */
export const Card: React.FC<CardProps> = ({
  title,
  icon,
  children,
  className,
  headerClassName,
  bodyClassName,
  hover = false,
}) => {
  return (
    <div
      className={clsx('card', { 'card-hover': hover }, className)}
    >
      {(title || icon) && (
        <div className={clsx('card-header', headerClassName)}>
          <div className="card-title">
            {icon && <span className="card-title-icon">{icon}</span>}
            {title}
          </div>
        </div>
      )}
      <div className={clsx('card-body', bodyClassName)}>{children}</div>
    </div>
  )
}

export default Card
