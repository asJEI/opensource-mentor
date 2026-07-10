import React from 'react'
import clsx from 'clsx'
import type { ReviewResult, ReviewTab, ReviewSeverity } from '@/types/codeReview'
import { ReviewIssueCard } from '@/components/business/ReviewIssueCard'
import './index.css'

export interface ReviewResultPanelProps {
  /** 审查结果 */
  result: ReviewResult
  /** 当前激活的 Tab */
  activeTab: ReviewTab
  /** Tab 切换回调 */
  onTabChange: (tab: ReviewTab) => void
  /** 展开的问题 ID */
  expandedIssueId: string | null
  /** 切换问题展开/折叠 */
  onToggleIssue: (id: string) => void
  /** 自定义类名 */
  className?: string
}

interface TabConfig {
  key: ReviewTab
  icon: string
  label: string
}

const tabConfigs: TabConfig[] = [
  { key: 'critical', icon: '🔴', label: '严重问题' },
  { key: 'improvement', icon: '🟡', label: '改进建议' },
  { key: 'praise', icon: '🟢', label: '做得好的' },
  { key: 'tips', icon: 'ℹ️', label: '小提示' },
]

/** 严重程度排序权重 */
const severityWeight: Record<ReviewSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  suggestion: 0,
}

/**
 * 获取指定 Tab 的问题数量
 */
const getTabCount = (result: ReviewResult, tab: ReviewTab): number => {
  switch (tab) {
    case 'critical':
      return result.stats.critical
    case 'improvement':
      return result.stats.high + result.stats.medium + result.stats.low + result.stats.suggestion
    case 'praise':
      return result.stats.praise
    case 'tips':
      return result.tips.length
    default:
      return 0
  }
}

/**
 * 审查结果面板
 * 左侧分类 Tab + 右侧内容列表
 */
export const ReviewResultPanel: React.FC<ReviewResultPanelProps> = ({
  result,
  activeTab,
  onTabChange,
  expandedIssueId,
  onToggleIssue,
  className,
}) => {
  // 严重问题列表（critical 严重程度）
  const criticalIssues = result.issues
    .filter((i) => i.severity === 'critical')
    .sort((a, b) => severityWeight[b.severity] - severityWeight[a.severity])

  // 改进建议列表（high/medium/low/suggestion）
  const improvementIssues = result.issues
    .filter((i) => i.severity !== 'critical')
    .sort((a, b) => severityWeight[b.severity] - severityWeight[a.severity])

  const renderContent = () => {
    switch (activeTab) {
      case 'critical':
        if (criticalIssues.length === 0) {
          return renderEmpty(
            '🎉',
            '没有严重问题',
            '太棒了！你的代码中没有发现严重问题，继续保持～'
          )
        }
        return (
          <div className="review-issue-list">
            {criticalIssues.map((issue) => (
              <ReviewIssueCard
                key={issue.id}
                issue={issue}
                expanded={expandedIssueId === issue.id}
                onToggle={() => onToggleIssue(issue.id)}
              />
            ))}
          </div>
        )

      case 'improvement':
        if (improvementIssues.length === 0) {
          return renderEmpty(
            '✨',
            '没有改进建议',
            '你的代码已经很完善了，没有需要改进的地方～'
          )
        }
        return (
          <div className="review-issue-list">
            {improvementIssues.map((issue) => (
              <ReviewIssueCard
                key={issue.id}
                issue={issue}
                expanded={expandedIssueId === issue.id}
                onToggle={() => onToggleIssue(issue.id)}
              />
            ))}
          </div>
        )

      case 'praise':
        if (result.praises.length === 0) {
          return renderEmpty(
            '🌟',
            '暂无表扬',
            '继续努力，写出更优秀的代码吧！'
          )
        }
        return (
          <div className="review-praise-list">
            {result.praises.map((praise) => (
              <div key={praise.id} className="praise-card">
                <div className="praise-card__header">
                  <span className="praise-card__icon">👏</span>
                  <div>
                    <div className="praise-card__title">{praise.title}</div>
                    <div className="praise-card__file">{praise.file}</div>
                  </div>
                </div>
                <div className="praise-card__desc">{praise.description}</div>
                <div className="praise-card__code">{praise.codeSnippet}</div>
                <div className="praise-card__why">
                  <strong>💡 为什么做得好：</strong> {praise.whyItMatters}
                </div>
              </div>
            ))}
          </div>
        )

      case 'tips':
        if (result.tips.length === 0) {
          return renderEmpty(
            '💡',
            '暂无小提示',
            '之后会有更多实用的编程技巧分享给你～'
          )
        }
        return (
          <div className="review-tips-list">
            {result.tips.map((tip, index) => (
              <div key={index} className="tip-card">
                <div className="tip-card__icon">💡</div>
                <div className="tip-card__content">{tip}</div>
              </div>
            ))}
          </div>
        )

      default:
        return null
    }
  }

  const renderEmpty = (icon: string, title: string, desc: string) => (
    <div className="review-empty">
      <div className="review-empty__icon">{icon}</div>
      <div className="review-empty__title">{title}</div>
      <div className="review-empty__desc">{desc}</div>
    </div>
  )

  const activeTabConfig = tabConfigs.find((t) => t.key === activeTab)

  return (
    <div className={clsx('review-result-panel', className)}>
      {/* 左侧 Tab 栏 */}
      <div className="review-result-panel__tabs">
        {tabConfigs.map((tab) => (
          <div
            key={tab.key}
            className={clsx('review-result-panel__tab', {
              'review-result-panel__tab--active': activeTab === tab.key,
            })}
            onClick={() => onTabChange(tab.key)}
          >
            <span className="review-result-panel__tab-icon">{tab.icon}</span>
            <span className="review-result-panel__tab-label">{tab.label}</span>
            <span className="review-result-panel__tab-count">
              {getTabCount(result, tab.key)}
            </span>
          </div>
        ))}
      </div>

      {/* 右侧内容区 */}
      <div className="review-result-panel__content">
        <div className="review-result-panel__content-title">
          {activeTabConfig?.icon} {activeTabConfig?.label}
        </div>
        {renderContent()}
      </div>
    </div>
  )
}

export default ReviewResultPanel
