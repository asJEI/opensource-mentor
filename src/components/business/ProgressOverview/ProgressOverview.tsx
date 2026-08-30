import React from 'react'
import clsx from 'clsx'
import type { RoadmapProgress } from '@/types'
import { Button } from '@/components/ui'

export interface ProgressOverviewProps {
  /** 进度数据 */
  progress: RoadmapProgress
  /** 开始回调（未开始时） */
  onStart?: () => void
  /** 下一步回调（进行中时） */
  onNext?: () => void
  /** 重置回调 */
  onReset?: () => void
  /** 自定义类名 */
  className?: string
}

/**
 * 进度总览卡片
 * SVG 环形进度条 + 进度描述 + 统计 + 主操作按钮
 */
export const ProgressOverview: React.FC<ProgressOverviewProps> = ({
  progress,
  onStart,
  onNext,
  onReset,
  className,
}) => {
  const { currentStep, totalSteps, completedSteps, percentage } = progress

  // SVG 环形进度参数
  const radius = 35
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference - (percentage / 100) * circumference

  const isStarted = completedSteps > 0 || currentStep > 0
  const isCompleted = completedSteps === totalSteps

  const stats = [
    { label: '已完成', value: completedSteps, dotClass: '' },
    { label: '进行中', value: isCompleted ? 0 : 1, dotClass: 'current' },
    { label: '待完成', value: totalSteps - completedSteps - (isCompleted ? 0 : 1), dotClass: 'pending' },
  ]

  const getTitle = () => {
    if (isCompleted) return '恭喜！全部完成'
    if (isStarted) return `第 ${currentStep + 1} 步进行中`
    return '准备开始你的开源之旅'
  }

  const getDesc = () => {
    if (isCompleted) return '你已完成所有学习步骤，继续保持对开源的热情！'
    if (isStarted) return `共 ${totalSteps} 个步骤，按照计划逐步推进`
    return `共 ${totalSteps} 个步骤，预计需要一定时间完成`
  }

  const renderActionButton = () => {
    if (isCompleted) {
      return onReset ? (
        <Button variant="secondary" onClick={onReset}>
          重新开始
        </Button>
      ) : null
    }
    if (isStarted) {
      return onNext ? (
        <Button variant="primary" onClick={onNext}>
          继续下一步
        </Button>
      ) : null
    }
    return onStart ? (
      <Button variant="primary" onClick={onStart}>
        立即开始
      </Button>
    ) : null
  }

  return (
    <div className={clsx('progress-overview', className)}>
      {/* SVG 环形进度条 */}
      <div className="progress-circle-wrap">
        <svg viewBox="0 0 84 84">
          <defs>
            <linearGradient id="roadmapGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f2c063" />
              <stop offset="100%" stopColor="#b0791a" />
            </linearGradient>
          </defs>
          <circle
            className="progress-circle-bg"
            cx="42"
            cy="42"
            r={radius}
          />
          <circle
            className="progress-circle-fill"
            cx="42"
            cy="42"
            r={radius}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
          />
        </svg>
        <div className="progress-circle-text">{Math.round(percentage)}%</div>
      </div>

      {/* 进度信息 */}
      <div className="progress-info">
        <h3 className="progress-title">{getTitle()}</h3>
        <p className="progress-desc">{getDesc()}</p>
        <div className="progress-stats">
          {stats.map((stat) => (
            <div key={stat.label} className="progress-stat">
              <span className={clsx('progress-stat-dot', stat.dotClass)} />
              {stat.label}：<strong>{stat.value}</strong>
            </div>
          ))}
        </div>
      </div>

      {/* 操作按钮 */}
      <div>{renderActionButton()}</div>
    </div>
  )
}

export default ProgressOverview
