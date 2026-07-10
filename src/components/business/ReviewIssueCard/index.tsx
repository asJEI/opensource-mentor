import React from 'react'
import clsx from 'clsx'
import type { ReviewIssue } from '@/types/codeReview'
import { Button } from '@/components/ui'
import './index.css'

export interface ReviewIssueCardProps {
  /** 审查问题 */
  issue: ReviewIssue
  /** 是否展开 */
  expanded: boolean
  /** 切换展开/折叠 */
  onToggle: () => void
  /** 自定义类名 */
  className?: string
}

const categoryLabels: Record<string, string> = {
  bug: 'Bug',
  performance: '性能',
  security: '安全',
  style: '风格',
  'best-practice': '最佳实践',
  other: '其他',
}

/**
 * 单个审查问题卡片
 * 可展开/折叠，展示问题详情和修改建议
 */
export const ReviewIssueCard: React.FC<ReviewIssueCardProps> = ({
  issue,
  expanded,
  onToggle,
  className,
}) => {
  const handleCopySuggestion = () => {
    navigator.clipboard?.writeText(issue.suggestionCode)
  }

  return (
    <div
      className={clsx(
        'review-issue-card',
        { 'review-issue-card--expanded': expanded },
        className
      )}
    >
      {/* 头部 */}
      <div
        className="review-issue-card__header"
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggle()
          }
        }}
      >
        {/* 严重程度色条 */}
        <div
          className={clsx(
            'review-issue-card__severity-bar',
            `review-issue-card__severity-bar--${issue.severity}`
          )}
        />

        {/* 主体 */}
        <div className="review-issue-card__main">
          <div className="review-issue-card__title-row">
            <span className="review-issue-card__title">{issue.title}</span>
            <span className="review-issue-card__category">
              {categoryLabels[issue.category] || issue.category}
            </span>
          </div>
          <div className="review-issue-card__desc">{issue.description}</div>
        </div>

        {/* 右侧元信息 */}
        <div className="review-issue-card__meta">
          <div className="review-issue-card__file-info">
            <div className="review-issue-card__file-path">{issue.file}</div>
            {issue.line && (
              <div className="review-issue-card__file-line">
                Line {issue.line}
              </div>
            )}
          </div>
          <div className="review-issue-card__toggle">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>
      </div>

      {/* 展开内容 */}
      <div className="review-issue-card__expand">
        <div className="review-issue-card__body">
          {/* 问题描述 */}
          <div className="review-issue-section">
            <div className="review-issue-section__header">
              <span className="review-issue-section__icon">📝</span>
              <span>问题描述</span>
            </div>
            <div className="review-issue-section__content">
              {issue.description}
            </div>
          </div>

          {/* 你的代码 */}
          <div className="review-issue-section">
            <div className="review-issue-section__header">
              <span className="review-issue-section__icon">💻</span>
              <span>你的代码</span>
            </div>
            <div className="review-issue-code">
              <div className="review-issue-code__header">
                <span>
                  {issue.file}
                  {issue.line ? `:${issue.line}` : ''}
                </span>
              </div>
              <pre className="review-issue-code__pre">
                <code className="review-issue-code__code">
                  {issue.yourCode}
                </code>
              </pre>
            </div>
          </div>

          {/* 修改建议 */}
          <div className="review-issue-section">
            <div className="review-issue-section__header">
              <span className="review-issue-section__icon">💡</span>
              <span>修改建议</span>
            </div>
            <div className="review-issue-code review-issue-code--suggestion">
              <div className="review-issue-code__header">
                <span className="review-issue-code__badge">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  建议代码
                </span>
              </div>
              <pre className="review-issue-code__pre">
                <code className="review-issue-code__code">
                  {issue.suggestionCode}
                </code>
              </pre>
            </div>
            <div
              className="review-issue-section__content"
              style={{ paddingLeft: '22px', marginTop: '4px' }}
            >
              {issue.suggestionText}
            </div>
          </div>

          {/* 导师小课堂 */}
          <div className="review-issue-section">
            <div className="review-issue-lesson">
              <div className="review-issue-lesson__title">
                <span>🎓</span>
                <span>导师小课堂：为什么要改？</span>
              </div>
              <div className="review-issue-lesson__text">
                {issue.whyItMatters}
              </div>
            </div>
          </div>

          {/* 底部操作 */}
          <div className="review-issue-card__actions">
            <Button
              size="sm"
              variant="secondary"
              onClick={handleCopySuggestion}
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              }
            >
              复制建议代码
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ReviewIssueCard
