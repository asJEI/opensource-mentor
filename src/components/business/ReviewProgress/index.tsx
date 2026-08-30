import React from 'react'
import clsx from 'clsx'
import type { ReviewStatus, ReviewProgress as ReviewProgressType, ReviewPhaseStatus } from '@/types/codeReview'
import './index.css'

export interface ReviewProgressProps {
  /** 审查状态 */
  status: ReviewStatus
  /** 审查进度 */
  progress: ReviewProgressType
  /** 错误信息 */
  error?: string | null
  /** 自定义类名 */
  className?: string
}

interface PhaseInfo {
  key: 'summary' | 'risk' | 'comments'
  label: string
}

const phases: PhaseInfo[] = [
  { key: 'summary', label: '分析代码' },
  { key: 'risk', label: '风险评估' },
  { key: 'comments', label: '生成建议' },
]

const statusConfig: Record<ReviewStatus, { icon: string; title: string; subtitle: string }> = {
  idle: {
    icon: '🤖',
    title: '准备就绪',
    subtitle: '等待开始代码审查',
  },
  queued: {
    icon: '⏳',
    title: '等待审查...',
    subtitle: '你的代码正在排队中',
  },
  running: {
    icon: '🤖',
    title: 'AI 导师审查中...',
    subtitle: '正在分析你的代码，请稍候',
  },
  completed: {
    icon: '✅',
    title: '审查完成',
    subtitle: '下面按文件列出了问题、风险和建议，逐条看一遍',
  },
  failed: {
    icon: '❌',
    title: '审查失败',
    subtitle: '出了点小问题，请重试',
  },
}

/**
 * 根据当前阶段获取导师寄语
 */
const getMentorMessage = (
  status: ReviewStatus,
  phaseStatuses: ReviewProgressType['phases']
): string => {
  if (status === 'completed') {
    return '审查结果出来了，先看「严重」和「高」级别的问题，确认没有遗漏再提交 PR～'
  }
  if (status === 'failed') {
    return '抱歉，审查出了点问题，要不要重试一下？'
  }
  if (status === 'queued' || status === 'idle') {
    return '马上就好～让我先看看你改了哪些地方～'
  }
  if (phaseStatuses.summary === 'running') {
    return '让我先看看你改了哪些地方～'
  }
  if (phaseStatuses.risk === 'running') {
    return '嗯，这里有几个地方需要注意...'
  }
  if (phaseStatuses.comments === 'running') {
    return '快好了，我在整理修改建议...'
  }
  return '正在审查中...'
}

const getPhaseClass = (phaseStatus: ReviewPhaseStatus): string => {
  if (phaseStatus === 'running') return 'review-progress__phase--running'
  if (phaseStatus === 'completed') return 'review-progress__phase--completed'
  if (phaseStatus === 'failed') return 'review-progress__phase--failed'
  return ''
}

/**
 * 审查进度组件
 * 展示 AI 导师审查进度和导师寄语
 */
export const ReviewProgress: React.FC<ReviewProgressProps> = ({
  status,
  progress,
  error,
  className,
}) => {
  const config = statusConfig[status]
  const mentorMessage = getMentorMessage(status, progress.phases)

  return (
    <div className={clsx('review-progress', className)}>
      {/* 头部状态 */}
      <div className="review-progress__header">
        <div
          className={clsx(
            'review-progress__icon',
            `review-progress__icon--${status}`
          )}
        >
          {config.icon}
        </div>
        <div className="review-progress__title-group">
          <div className="review-progress__title">{config.title}</div>
          <div className="review-progress__subtitle">
            {error || config.subtitle}
          </div>
        </div>
      </div>

      {/* 进度条 */}
      <div className="review-progress__bar-wrap">
        <div className="review-progress__bar-label">
          <span>审查进度</span>
          <span className="review-progress__bar-percent">
            {progress.percent}%
          </span>
        </div>
        <div className="review-progress__bar">
          <div
            className={clsx('review-progress__bar-fill', {
              'review-progress__bar-fill--failed': status === 'failed',
            })}
            style={{ width: `${progress.percent}%` }}
          />
        </div>
      </div>

      {/* 三阶段标签 */}
      <div className="review-progress__phases">
        {phases.map((phase) => (
          <div
            key={phase.key}
            className={clsx(
              'review-progress__phase',
              getPhaseClass(progress.phases[phase.key])
            )}
          >
            <span className="review-progress__phase-dot" />
            <span>{phase.label}</span>
          </div>
        ))}
      </div>

      {/* 导师寄语气泡 */}
      <div className="review-progress__mentor-bubble">
        <div className="review-progress__mentor-icon">💬</div>
        <div className="review-progress__mentor-text">{mentorMessage}</div>
      </div>
    </div>
  )
}

export default ReviewProgress
