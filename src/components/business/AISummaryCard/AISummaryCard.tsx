import React from 'react'
import clsx from 'clsx'
import type { RepositoryAnalysis, DifficultyLevel } from '@/types'
import { Card } from '@/components/ui'

export interface AISummaryCardProps {
  /** AI 分析结果 */
  analysis: RepositoryAnalysis
  /** 自定义类名 */
  className?: string
  /** 建议 Issue 点击回调 */
  onIssueClick?: (index: number) => void
}

const difficultyToStars: Record<DifficultyLevel, number> = {
  easy: 1,
  medium: 2,
  hard: 3,
}

const difficultyLabels: Record<DifficultyLevel, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
}

/**
 * AI 分析摘要卡片
 * 显示 AI 对仓库的整体分析结果
 */
export const AISummaryCard: React.FC<AISummaryCardProps> = ({
  analysis,
  className,
  onIssueClick,
}) => {
  const starCount = difficultyToStars[analysis.difficulty]

  // 模拟建议 Issue 列表（从 insights 生成）
  const suggestedIssues = analysis.insights?.slice(0, 3) || []

  const renderStars = () => {
    const stars = []
    for (let i = 0; i < 3; i++) {
      stars.push(
        <svg
          key={i}
          className={clsx('difficulty-star', { empty: i >= starCount })}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      )
    }
    return stars
  }

  return (
    <Card
      className={clsx('ai-content active', className)}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'var(--accent-soft)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ width: '16px', height: '16px', color: 'var(--accent)' }}
            >
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>AI 分析报告</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
              基于 {analysis.techStack?.length || 0} 项技术栈分析
            </div>
          </div>
        </div>
      }
    >
      {/* 摘要文字 */}
      <p className="ai-summary-text">{analysis.summary}</p>

      {/* 指标行 */}
      <div className="ai-metrics-row">
        <div className="ai-metric">
          <div className="difficulty-bar">{renderStars()}</div>
          <div className="ai-metric-label">难度等级</div>
          <div className="ai-metric-value">{difficultyLabels[analysis.difficulty]}</div>
        </div>
        <div className="ai-metric">
          <div
            style={{
              fontSize: '20px',
              marginBottom: '4px',
              color: 'var(--accent)',
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ width: '20px', height: '20px' }}
            >
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>
          <div className="ai-metric-label">架构类型</div>
          <div className="ai-metric-value" style={{ fontSize: '13px' }}>
            {analysis.architecture}
          </div>
        </div>
        <div className="ai-metric">
          <div
            style={{
              fontSize: '20px',
              fontWeight: 700,
              background: 'var(--gradient)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              marginBottom: '4px',
            }}
          >
            {analysis.suggestedIssuesCount}
          </div>
          <div className="ai-metric-label">推荐 Issue 数</div>
          <div className="ai-metric-value" style={{ fontSize: '12px', color: 'var(--muted)' }}>
            适合新手
          </div>
        </div>
      </div>

      {/* 建议 Issue 列表 */}
      {suggestedIssues.length > 0 && (
        <div className="suggested-issues-list">
          <div
            style={{
              fontSize: '13px',
              fontWeight: 600,
              marginBottom: '8px',
              color: 'var(--ink)',
            }}
          >
            关键洞察
          </div>
          {suggestedIssues.map((issue, index) => (
            <div
              key={index}
              className="suggested-issue"
              onClick={() => onIssueClick?.(index)}
            >
              <svg
                className="suggested-issue-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span className="suggested-issue-text">{issue}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

export default AISummaryCard
