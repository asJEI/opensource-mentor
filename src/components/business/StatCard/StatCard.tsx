import React from 'react'
import clsx from 'clsx'

export type StatCardVariant = 'purple' | 'green' | 'yellow' | 'blue'

export interface StatCardProps {
  /** 标签名称 */
  label: string
  /** 数值 */
  value: string | number
  /** 变化量（正数上升，负数下降） */
  change?: number
  /** 图标 */
  icon?: React.ReactNode
  /** 变体（图标背景色） */
  variant?: StatCardVariant
  /** 自定义类名 */
  className?: string
}

/**
 * 统计卡片
 * 显示图标、数值、标签和变化量
 */
export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  change,
  icon,
  variant = 'purple',
  className,
}) => {
  const isPositive = change !== undefined && change >= 0
  const isNegative = change !== undefined && change < 0

  return (
    <div className={clsx('stat-card', className)}>
      <div className="stat-label">
        {icon && (
          <span className={clsx('stat-label-icon', variant)}>
            {icon}
          </span>
        )}
        {label}
      </div>
      <div className="stat-value">{value}</div>
      {change !== undefined && (
        <div
          className={clsx('stat-change', { down: isNegative })}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            {isPositive ? (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ width: '12px', height: '12px' }}
              >
                <polyline points="18 15 12 9 6 15" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ width: '12px', height: '12px' }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            )}
            {Math.abs(change)}%
          </span>
          <span style={{ marginLeft: '4px' }}>vs 上周</span>
        </div>
      )}
    </div>
  )
}

export default StatCard
