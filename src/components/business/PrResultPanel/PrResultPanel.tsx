import React from 'react'
import clsx from 'clsx'
import type { PrDraft, LoadingState, PrSuggestionType } from '@/types'
import { AiPageError } from '@/components/business'

export interface PrResultPanelProps {
  /** PR 草稿数据 */
  draft: PrDraft | null
  /** 加载状态 */
  status: LoadingState
  /** 错误信息 */
  error?: string | null
  /** 复制回调 */
  onCopy?: (text: string, label: string) => void
  /** 重试回调 */
  onRetry?: () => void
  /** 自定义类名 */
  className?: string
}

const suggestionIcons: Record<PrSuggestionType, React.ReactNode> = {
  tip: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
    </svg>
  ),
  warning: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  danger: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
}

/**
 * PR 生成结果面板
 * 展示 PR 标题、描述、变更点、测试建议、注意事项和改进建议
 */
export const PrResultPanel: React.FC<PrResultPanelProps> = ({
  draft,
  status,
  error,
  onCopy,
  onRetry,
  className,
}) => {
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard?.writeText(text)
    onCopy?.(text, label)
  }

  // Loading 状态
  if (status === 'loading') {
    return (
      <div className={className}>
        <div className="pr-loading active">
          <div className="pr-loading-spinner" />
          <div className="pr-loading-title">AI 正在生成 PR...</div>
          <div className="pr-loading-desc">
            请稍候，正在分析并生成专业的 PR 内容
          </div>
          <div className="pr-loading-steps">
            {[
              '分析 Issue 信息',
              '生成 PR 标题',
              '撰写 PR 描述',
              '整理变更建议',
            ].map((step, i) => (
              <div
                key={step}
                className={clsx('ai-loading-step', {
                  active: i === 0,
                  done: false,
                })}
              >
                <span className="step-spinner" />
                {step}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // 错误状态
  if (status === 'error') {
    return (
      <div className={className}>
        <div className="card-body">
          <AiPageError
            kicker="GENERATION FAILED"
            title="生成失败"
            message={error || 'PR 生成过程中出现错误，请稍后重试'}
            onRetry={onRetry}
          />
        </div>
      </div>
    )
  }

  // 空状态：说明缺什么，而不是画一个居中的大图标
  if (!draft) {
    return (
      <div className={className}>
        <div className="result-empty">
          <span className="osm-kicker">
            <span className="osm-kicker-dot" />
            AWAITING INPUT
          </span>
          <div className="result-empty-title">还没有生成 PR</div>
          <p className="result-empty-desc">
            填好左边的类型和改动描述，AI 会给出标题、描述、变更点和测试建议。
          </p>
          <ol className="osm-list osm-list-ordered result-empty-steps">
            <li>选择改动类型（fix / feat / docs）</li>
            <li>用一两句话说明你改了什么</li>
            <li>可选：填写要关联的 Issue 编号</li>
          </ol>
        </div>
      </div>
    )
  }

  const hasNewFields = !!(
    draft.changes?.length ||
    draft.testingTips?.length ||
    draft.notes?.length ||
    draft.improvementSuggestions?.length
  )

  return (
    <div className={clsx('pr-result-content active', className)}>
      {/* PR Title */}
      <div className="result-section">
        <div className="result-section-header">
          <div className="result-section-title">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            PR 标题
          </div>
          <button
            type="button"
            className="copy-btn"
            onClick={() => handleCopy(draft.title, 'PR 标题')}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            复制
          </button>
        </div>
        <div className="pr-title-display">{draft.title}</div>
      </div>

      {/* Description */}
      <div className="result-section">
        <div className="result-section-header">
          <div className="result-section-title">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            PR 描述
          </div>
          <button
            type="button"
            className="copy-btn"
            onClick={() => handleCopy(draft.description, 'PR 描述')}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            复制
          </button>
        </div>
        <div className="pr-description">
          <div style={{ whiteSpace: 'pre-wrap' }}>{draft.description}</div>
        </div>
      </div>

      {/* 置信度（新版字段） */}
      {draft.confidence !== undefined && (
        <div className="result-section">
          <div className="result-section-header">
            <div className="result-section-title">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              生成质量置信度
            </div>
            <span
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color:
                  draft.confidence >= 0.8
                    ? 'var(--green)'
                    : draft.confidence >= 0.5
                      ? 'var(--accent)'
                      : 'var(--warning)',
              }}
            >
              {Math.round(draft.confidence * 100)}%
            </span>
          </div>
          <div
            style={{
              width: '100%',
              height: '6px',
              background: 'var(--rule)',
              borderRadius: '3px',
              overflow: 'hidden',
              marginTop: '8px',
            }}
          >
            <div
              style={{
                width: `${Math.round(draft.confidence * 100)}%`,
                height: '100%',
                background:
                  draft.confidence >= 0.8
                    ? 'var(--green)'
                    : draft.confidence >= 0.5
                      ? 'var(--accent)'
                      : 'var(--warning)',
                borderRadius: '3px',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>
      )}

      {/* 主要变更点（新版字段） */}
      {draft.changes && draft.changes.length > 0 && (
        <div className="result-section">
          <div className="result-section-header">
            <div className="result-section-title">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
              主要变更点
            </div>
          </div>
          <div className="checklist">
            {draft.changes.map((change, index) => (
              <div key={index} className="checklist-item">
                <div
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '4px',
                    background: 'var(--accent-soft)',
                    color: 'var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    fontSize: '10px',
                    fontWeight: 700,
                  }}
                >
                  {index + 1}
                </div>
                <span>{change}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 测试建议（新版字段） */}
      {draft.testingTips && draft.testingTips.length > 0 && (
        <div className="result-section">
          <div className="result-section-header">
            <div className="result-section-title">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
              测试建议
            </div>
          </div>
          <div className="checklist">
            {draft.testingTips.map((tip, index) => (
              <div key={index} className="checklist-item">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    width: '14px',
                    height: '14px',
                    color: 'var(--green)',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>{tip}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 注意事项/风险点（新版字段） */}
      {draft.notes && draft.notes.length > 0 && (
        <div className="result-section">
          <div className="result-section-header">
            <div className="result-section-title">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              注意事项 / 风险点
            </div>
          </div>
          <div className="review-suggestions">
            {draft.notes.map((note, index) => (
              <div key={index} className="suggestion-card">
                <div className="suggestion-icon warning">
                  {suggestionIcons.warning}
                </div>
                <div className="suggestion-content">
                  <div className="suggestion-desc">{note}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 可改进的地方（新版字段） */}
      {draft.improvementSuggestions &&
        draft.improvementSuggestions.length > 0 && (
          <div className="result-section">
            <div className="result-section-header">
              <div className="result-section-title">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 18h6" />
                  <path d="M10 22h4" />
                  <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
                </svg>
                可改进建议
              </div>
            </div>
            <div className="review-suggestions">
              {draft.improvementSuggestions.map((suggestion, index) => (
                <div key={index} className="suggestion-card">
                  <div className="suggestion-icon tip">
                    {suggestionIcons.tip}
                  </div>
                  <div className="suggestion-content">
                    <div className="suggestion-desc">{suggestion}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      {/* 旧版：检查清单（向后兼容） */}
      {!hasNewFields && draft.checklist && draft.checklist.length > 0 && (
        <div className="result-section">
          <div className="result-section-header">
            <div className="result-section-title">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="9 11 12 14 22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
              提交前检查清单
            </div>
          </div>
          <div className="checklist">
            {draft.checklist.map((item, index) => (
              <label key={index} className="checklist-item">
                <input type="checkbox" defaultChecked={item.checked} />
                <span>{item.text}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* 旧版：Review Suggestions（向后兼容） */}
      {!hasNewFields && draft.suggestions && draft.suggestions.length > 0 && (
        <div className="result-section">
          <div className="result-section-header">
            <div className="result-section-title">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              审查建议
            </div>
          </div>
          <div className="review-suggestions">
            {draft.suggestions.map((suggestion, index) => (
              <div key={index} className="suggestion-card">
                <div className={clsx('suggestion-icon', suggestion.type)}>
                  {suggestionIcons[suggestion.type]}
                </div>
                <div className="suggestion-content">
                  <div className="suggestion-title">{suggestion.title}</div>
                  <div className="suggestion-desc">
                    {suggestion.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 关联 Issue 信息 */}
      {draft.relatedIssue && (
        <div className="result-section">
          <div className="result-section-header">
            <div className="result-section-title">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4" />
                <path d="M12 16h.01" />
              </svg>
              关联 Issue
            </div>
          </div>
          <div
            style={{
              display: 'inline-block',
              padding: '4px 12px',
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            {draft.relatedIssue}
          </div>
        </div>
      )}
    </div>
  )
}

export default PrResultPanel
