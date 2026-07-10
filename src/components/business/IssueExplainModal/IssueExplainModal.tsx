import React from 'react'
import type { RecommendedIssue, IssueExplain, DifficultyLevel } from '@/types'
import { Modal, Button } from '@/components/ui'

export interface IssueExplainModalProps {
  /** 是否显示 */
  visible: boolean
  /** 关闭回调 */
  onClose: () => void
  /** 开始解决回调 */
  onStart?: () => void
  /** Issue 数据 */
  issue?: RecommendedIssue
  /** AI 解释数据 */
  explain?: IssueExplain
  /** 加载状态 */
  loading?: boolean
  /** 错误信息 */
  error?: string | null
  /** 自定义类名 */
  className?: string
}

const difficultyLabelMap: Record<DifficultyLevel, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
}

const difficultyColorMap: Record<DifficultyLevel, string> = {
  easy: '#28a745',
  medium: '#fbca04',
  hard: '#d73a4a',
}

/**
 * Issue 解释弹窗组件
 * 展示 AI 为什么推荐这个 Issue 的详细分析
 */
export const IssueExplainModal: React.FC<IssueExplainModalProps> = ({
  visible,
  onClose,
  onStart,
  issue,
  explain,
  loading = false,
  error = null,
  className,
}) => {
  const breakdown = issue?.breakdown
  const matchDetails = issue?.matchDetails

  // 优先使用新版 matchDetails，其次使用旧版 breakdown
  const matchItems = matchDetails
    ? [
        { label: '难度匹配', value: matchDetails.difficultyMatch },
        { label: '技能匹配', value: matchDetails.skillMatch },
        { label: '影响价值', value: matchDetails.impactScore },
        { label: '活跃程度', value: matchDetails.activityScore },
        { label: '新人友好', value: matchDetails.beginnerFriendlyScore },
      ]
    : breakdown
      ? [
          { label: '技能匹配', value: breakdown.skillMatch },
          { label: '难度匹配', value: breakdown.difficultyMatch },
          { label: '兴趣匹配', value: breakdown.interestMatch },
          { label: '经验匹配', value: breakdown.contributionMatch },
        ]
      : []

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose}>
        关闭
      </Button>
      <Button variant="primary" onClick={onStart}>
        去代码审查
      </Button>
    </>
  )

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title="AI 为什么推荐这个 Issue？"
      subtitle={issue ? `#${issue.number} ${issue.title}` : ''}
      className={className}
      footer={footer}
      icon={
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="22" />
        </svg>
      }
    >
      {/* 加载状态 */}
      {loading && !explain ? (
        <div className="ai-loading active">
          <div className="ai-loading-spinner" />
          <div className="ai-loading-title">AI 正在分析...</div>
          <div className="ai-loading-desc">正在生成推荐理由和修改建议</div>
        </div>
      ) : error ? (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--danger)' }}>
          {error}
        </div>
      ) : explain ? (
        <>
          {/* 匹配度分析 */}
          {matchItems.length > 0 && (
            <div className="reason-section">
              <div className="reason-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                综合匹配度分析
              </div>
              <div className="match-breakdown">
                {matchItems.map((item) => (
                  <div key={item.label} className="match-item">
                    <span className="match-item-label">{item.label}</span>
                    <div className="match-item-bar">
                      <div
                        className="match-item-fill"
                        style={{ width: `${item.value}%` }}
                      />
                    </div>
                    <span className="match-item-value">{item.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 推荐理由 */}
          {issue?.recommendationReasons && issue.recommendationReasons.length > 0 && (
            <div className="reason-section">
              <div className="reason-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                推荐理由
              </div>
              <div className="reason-content">
                <ul>
                  {issue.recommendationReasons.map((reason, i) => (
                    <li key={i}>{reason}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* AI 说明摘要 */}
          <div className="reason-section">
            <div className="reason-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
              Issue 概述
            </div>
            <div className="reason-content">
              <p style={{ fontSize: '13px', color: 'var(--ink-2)', lineHeight: '1.7' }}>
                {explain.summary}
              </p>
            </div>
          </div>

          {/* 难度与预估时间 */}
          <div className="reason-section">
            <div className="reason-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              难度与时间预估
            </div>
            <div className="reason-content">
              <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>难度等级：</span>
                  <span
                    style={{
                      fontWeight: 600,
                      color: difficultyColorMap[explain.difficulty],
                    }}
                  >
                    {difficultyLabelMap[explain.difficulty]}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>预估时间：</span>
                  <span style={{ fontWeight: 600, color: 'var(--ink-1)' }}>
                    {explain.estimatedTime}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 需要了解的知识 */}
          {explain.knowledge && explain.knowledge.length > 0 && (
            <div className="reason-section">
              <div className="reason-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                </svg>
                需要了解的知识
              </div>
              <div className="reason-content">
                <ul>
                  {explain.knowledge.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* 解决步骤 */}
          {explain.steps && explain.steps.length > 0 && (
            <div className="reason-section">
              <div className="reason-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 18 22 12 16 6" />
                  <polyline points="8 6 2 12 8 18" />
                </svg>
                解决步骤
              </div>
              <div className="reason-content">
                <ol style={{ paddingLeft: '20px', margin: 0 }}>
                  {explain.steps.map((step, i) => (
                    <li
                      key={i}
                      style={{
                        marginBottom: i < explain.steps.length - 1 ? '8px' : 0,
                        fontSize: '13px',
                        color: 'var(--ink-2)',
                        lineHeight: '1.6',
                      }}
                    >
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}

          {/* 实用提示 */}
          {explain.tips && explain.tips.length > 0 && (
            <div className="reason-section">
              <div className="reason-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18h6" />
                  <path d="M10 22h4" />
                  <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
                </svg>
                实用提示
              </div>
              <div className="reason-content">
                <ul>
                  {explain.tips.map((tip, i) => (
                    <li key={i}>{tip}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </>
      ) : null}
    </Modal>
  )
}

export default IssueExplainModal
