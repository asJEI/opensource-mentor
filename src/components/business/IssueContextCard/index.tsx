import React from 'react'
import clsx from 'clsx'
import { Badge } from '@/components/ui'
import './index.css'

export interface IssueContextCardProps {
  /** Issue 信息 */
  issue: {
    number: number
    title: string
    labels: { name: string; color?: string }[]
    htmlUrl?: string
  }
  /** 仓库名称，如 "microsoft/vscode" */
  repoName: string
  /** 难度，如 "入门" */
  difficulty?: string
  /** 预计时间，如 "2-3 小时" */
  estimatedTime?: string
  /** 自定义类名 */
  className?: string
}

/**
 * Issue 上下文卡片
 * 粘性顶部展示当前 Issue 信息，让用户知道自己在为哪个 Issue 做贡献
 */
export const IssueContextCard: React.FC<IssueContextCardProps> = ({
  issue,
  repoName,
  difficulty,
  estimatedTime,
  className,
}) => {
  return (
    <div className={clsx('issue-context-card', className)}>
      <div className="issue-context-card__left">
        <div className="issue-context-card__title-row">
          <span className="issue-context-card__title">{issue.title}</span>
          <span className="issue-context-card__number">#{issue.number}</span>
        </div>
        <div className="issue-context-card__bottom-row">
          <span className="issue-context-card__repo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
            </svg>
            {repoName}
          </span>
          {issue.labels.length > 0 && (
            <div className="issue-context-card__labels">
              {issue.labels.map((label) => (
                <span
                  key={label.name}
                  className="issue-label"
                  style={{
                    backgroundColor: label.color ? `${label.color}20` : undefined,
                    color: label.color || undefined,
                  }}
                >
                  {label.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="issue-context-card__right">
        <div className="issue-context-card__meta">
          <div className="issue-context-card__meta-row">
            {difficulty && (
              <Badge variant="success" size="sm">
                {difficulty}
              </Badge>
            )}
            {estimatedTime && (
              <span className="issue-context-card__time">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                {estimatedTime}
              </span>
            )}
          </div>
          <span className="issue-context-card__contributing">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="6" />
              <circle cx="12" cy="12" r="2" />
            </svg>
            你正在贡献
          </span>
        </div>
      </div>
    </div>
  )
}

export default IssueContextCard
