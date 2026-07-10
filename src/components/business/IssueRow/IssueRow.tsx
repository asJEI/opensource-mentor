import React from 'react'
import clsx from 'clsx'
import type { RecommendedIssue, DifficultyLevel } from '@/types'

export interface IssueRowProps {
  /** Issue 数据 */
  issue: RecommendedIssue
  /** 为什么推荐按钮点击回调 */
  onExplain?: (issue: RecommendedIssue) => void
  /** 行点击回调 */
  onClick?: (issue: RecommendedIssue) => void
  /** 自定义类名 */
  className?: string
}

const difficultyLabelMap: Record<DifficultyLevel, string> = {
  easy: '新手友好',
  medium: '中等难度',
  hard: '较有挑战',
}

/** 获取推荐分数（优先使用新版 recommendationScore，回退到旧版 matchScore） */
const getScore = (issue: RecommendedIssue): number => {
  return issue.recommendationScore ?? issue.matchScore ?? 0
}

/** 获取难度等级（提供默认值） */
const getDifficulty = (issue: RecommendedIssue): DifficultyLevel => {
  return issue.difficulty ?? 'medium'
}

/** 获取预估时间（提供默认值） */
const getEstimatedTime = (issue: RecommendedIssue): number => {
  return issue.estimatedTime ?? 2
}

/**
 * Issue 行组件（GitHub 风格）
 * 显示 Issue 标题、标签、元信息和 AI 匹配数据
 */
export const IssueRow: React.FC<IssueRowProps> = ({
  issue,
  onExplain,
  onClick,
  className,
}) => {
  const handleExplainClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onExplain?.(issue)
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return '今天'
    if (diffDays === 1) return '昨天'
    if (diffDays < 7) return `${diffDays} 天前`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} 周前`
    return `${Math.floor(diffDays / 30)} 个月前`
  }

  return (
    <div
      className={clsx('issue-row', className)}
      onClick={() => onClick?.(issue)}
    >
      {/* 打开图标 */}
      <svg
        className="issue-open-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>

      {/* 主内容 */}
      <div className="issue-main">
        <div className="issue-title-row">
          <span className="issue-title">
            #{issue.number} {issue.title}
          </span>
          <div className="issue-labels">
            {issue.labels?.map((label) => (
              <span
                key={label.name}
                className="issue-label"
                style={{
                  backgroundColor: `${label.color}20`,
                  color: label.color,
                }}
              >
                {label.name}
              </span>
            ))}
          </div>
        </div>
        <div className="issue-meta">
          <span>
            由 <a href="#">{issue.author}</a> 于 {formatDate(issue.createdAt)} 创建
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ width: '12px', height: '12px' }}
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {issue.comments}
          </span>
        </div>
      </div>

      {/* AI 匹配信息 */}
      <div className="issue-ai-info">
        <div className="ai-confidence">
          <span className="confidence-score">{getScore(issue)}</span>
          <span className="confidence-label">匹配度</span>
        </div>
        <div className="ai-tags">
          <span className={clsx('ai-tag', `difficulty-${getDifficulty(issue)}`)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            {difficultyLabelMap[getDifficulty(issue)]}
          </span>
          <span className="ai-tag">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            约 {getEstimatedTime(issue)} 小时
          </span>
        </div>
        <button
          type="button"
          className="explain-btn"
          onClick={handleExplainClick}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          为什么推荐
        </button>
      </div>
    </div>
  )
}

export default IssueRow
