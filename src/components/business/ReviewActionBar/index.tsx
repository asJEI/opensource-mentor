import React from 'react'
import clsx from 'clsx'
import type { ReviewStatus } from '@/types/codeReview'
import { Button } from '@/components/ui'
import './index.css'

export interface ReviewActionBarProps {
  /** 审查状态 */
  status: ReviewStatus
  /** 根据 Review 修改代码回调 */
  onFixCode: () => void
  /** 生成 Pull Request 描述回调 */
  onGeneratePr: () => void
  /** 自定义类名 */
  className?: string
}

const statusConfig: Record<ReviewStatus, { icon: string; text: string }> = {
  idle: {
    icon: '🤖',
    text: '准备开始代码审查',
  },
  queued: {
    icon: '⏳',
    text: 'AI 导师正在排队审查你的代码，请稍候...',
  },
  running: {
    icon: '🤖',
    text: 'AI 导师正在审查你的代码，请稍候...',
  },
  completed: {
    icon: '🎉',
    text: '审查完成！改完这些就可以提交 PR 啦',
  },
  failed: {
    icon: '❌',
    text: '审查失败，请重试',
  },
}

/**
 * 审查操作栏
 * 底部粘性操作栏，提供两个主要操作按钮
 */
export const ReviewActionBar: React.FC<ReviewActionBarProps> = ({
  status,
  onFixCode,
  onGeneratePr,
  className,
}) => {
  const isProcessing = status === 'running' || status === 'queued'
  const config = statusConfig[status]

  return (
    <div className={clsx('review-action-bar', className)}>
      {/* 左侧状态提示 */}
      <div className="review-action-bar__left">
        <span className="review-action-bar__status-icon">{config.icon}</span>
        <span
          className={clsx(
            'review-action-bar__status-text',
            `review-action-bar__status-text--${status}`
          )}
        >
          {config.text}
        </span>
      </div>

      {/* 右侧操作按钮 */}
      <div className="review-action-bar__right">
        <Button
          variant="secondary"
          size="md"
          loading={isProcessing}
          disabled={isProcessing || status === 'failed'}
          onClick={onGeneratePr}
          className="review-action-bar__btn"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
              <circle cx="18" cy="18" r="3" />
              <circle cx="6" cy="6" r="3" />
              <path d="M13 6h3a2 2 0 0 1 2 2v7" />
              <line x1="6" y1="9" x2="6" y2="21" />
            </svg>
          }
        >
          生成 Pull Request 描述
        </Button>
        <Button
          variant="primary"
          size="md"
          loading={isProcessing}
          disabled={isProcessing || status === 'failed'}
          onClick={onFixCode}
          className="review-action-bar__btn"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          }
        >
          根据 Review 修改代码
        </Button>
      </div>
    </div>
  )
}

export default ReviewActionBar
