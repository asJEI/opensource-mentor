import React from 'react'
import clsx from 'clsx'
import type { Repository } from '@/types'
import { Button } from '@/components/ui'

export interface RepoInfoCardProps {
  /** 仓库信息 */
  repo: Repository
  /** 重新分析回调 */
  onReanalyze?: () => void
  /** 是否加载中 */
  loading?: boolean
  /** 自定义类名 */
  className?: string
}

/**
 * 仓库信息卡片
 * 显示仓库基本信息、统计数据和重新分析按钮
 */
export const RepoInfoCard: React.FC<RepoInfoCardProps> = ({
  repo,
  onReanalyze,
  loading = false,
  className,
}) => {
  const stats = [
    {
      label: 'Stars',
      value: repo.stars.toLocaleString(),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ),
    },
    {
      label: 'Forks',
      value: repo.forks.toLocaleString(),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="18" r="3" />
          <circle cx="6" cy="6" r="3" />
          <circle cx="18" cy="6" r="3" />
          <path d="M18 9v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9" />
          <path d="M12 12v3" />
        </svg>
      ),
    },
    {
      label: 'Language',
      value: repo.language,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      ),
    },
    {
      label: 'Size',
      value: `${(repo.size / 1024).toFixed(1)} MB`,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
        </svg>
      ),
    },
    {
      label: 'Issues',
      value: repo.issuesCount.toLocaleString(),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      ),
    },
  ]

  return (
    <div className={clsx('card', className)}>
      <div className="card-body">
        <div className="repo-info-header">
          <div className="repo-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
            </svg>
          </div>
          <div>
            <div className="repo-name">{repo.name}</div>
            <div className="repo-owner">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              {repo.owner}
            </div>
          </div>
        </div>

        <div className="repo-stats">
          {stats.map((stat) => (
            <div key={stat.label} className="repo-stat-row">
              <span className="repo-stat-label">
                {stat.icon}
                {stat.label}
              </span>
              <span className="repo-stat-value">{stat.value}</span>
            </div>
          ))}
        </div>

        {repo.topics && repo.topics.length > 0 && (
          <div className="repo-badge" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
            {repo.topics.slice(0, 4).map((topic) => (
              <span
                key={topic}
                style={{
                  fontSize: '11px',
                  padding: '3px 10px',
                  background: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  borderRadius: 'var(--radius-full)',
                  fontWeight: 500,
                }}
              >
                {topic}
              </span>
            ))}
          </div>
        )}

        <Button
          variant="primary"
          size="md"
          loading={loading}
          onClick={onReanalyze}
          className="analyze-btn"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          }
        >
          重新分析
        </Button>
      </div>
    </div>
  )
}

export default RepoInfoCard
