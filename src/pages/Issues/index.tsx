import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { AppLayout } from '@/components/layout'
import { AiPageError } from '@/components/business'
import { Button } from '@/components/ui'
import { useRepositoryStore, useToastStore, useUserStore } from '@/store'
import type { CandidateIssue } from '@/types'

const CodeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
)

const IssueIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8h.01" />
    <path d="M12 12v4" />
  </svg>
)

function summarizeBody(body: string, maxLength = 260): string {
  const text = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_\-[\]()`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength).trim()}…`
}

function formatDate(value: string): string {
  if (!value) return '未知'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '未知'
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const CandidateIssueCard = ({
  issue,
  expanded,
  onToggle,
  onStart,
}: {
  issue: CandidateIssue
  expanded: boolean
  onToggle: () => void
  onStart: () => void
}) => {
  const visibleLabels = issue.labels.slice(0, 5)

  return (
    <article className={clsx('issue-row-card', expanded && 'expanded')}>
      <button type="button" className="issue-row-main" onClick={onToggle}>
        <span className="issue-row-status" aria-hidden="true">
          <IssueIcon />
        </span>
        <span className="issue-row-title-block">
          <strong>
            {issue.title}{' '}
            <small>#{issue.issueNumber}</small>
          </strong>
          <span>{issue.repository.fullName}</span>
        </span>
        <span className="issue-row-meta">
          <span>{issue.language || '语言未知'}</span>
        </span>
      </button>

      <div className="issue-row-labels">
        {visibleLabels.map((label: CandidateIssue['labels'][number]) => (
          <span key={label.id || label.name} className="issue-label-chip">
            {label.name}
          </span>
        ))}
        {issue.labels.length > visibleLabels.length && (
          <span className="issue-label-chip muted">
            +{issue.labels.length - visibleLabels.length}
          </span>
        )}
      </div>

      {expanded && (
        <div className="issue-expanded-panel">
          <div className="issue-expanded-grid">
            <section>
              <h3>Issue 简介</h3>
              <p>{issue.title}</p>
            </section>
            <section>
              <h3>原始描述摘要</h3>
              <p>{summarizeBody(issue.body)}</p>
            </section>
            <section>
              <h3>为什么适合你</h3>
              <p>
                当前阶段已基于你的技术栈和公开 Issue 数据拉取候选项；
                更精确的匹配原因会在后续推荐算法补齐后展示。
              </p>
            </section>
            <section>
              <h3>仓库基本信息</h3>
              <p>
                <a href={issue.repository.url} target="_blank" rel="noreferrer">
                  {issue.repository.fullName}
                </a>
                {' · '}
                更新于 {formatDate(issue.updatedAt)} · 评论 {issue.comments}
              </p>
            </section>
            <section>
              <h3>匹配信息</h3>
              <p>难度、预计时间和匹配分暂未生成，等待后续推荐算法补充真实结果。</p>
            </section>
          </div>

          <div className="issue-expanded-footer">
            <a href={issue.issueUrl} target="_blank" rel="noreferrer">
              在 GitHub 查看
            </a>
            <Button variant="primary" onClick={onStart}>
              开始贡献
            </Button>
          </div>
        </div>
      )}
    </article>
  )
}

const Issues = () => {
  const navigate = useNavigate()
  const showToast = useToastStore((state) => state.showToast)
  const isAuthenticated = useUserStore((state) => state.isAuthenticated)
  const profile = useUserStore((state) => state.profile)
  const issues = useRepositoryStore((state) => state.candidateIssues)
  const meta = useRepositoryStore((state) => state.candidateIssuesMeta)
  const status = useRepositoryStore((state) => state.candidateIssuesStatus)
  const error = useRepositoryStore((state) => state.candidateIssuesError)
  const loadCandidateIssues = useRepositoryStore(
    (state) => state.loadCandidateIssues,
  )
  const startContribution = useRepositoryStore(
    (state) => state.startContribution,
  )
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated) return
    if (status === 'idle') void loadCandidateIssues()
  }, [isAuthenticated, loadCandidateIssues, status])

  useEffect(() => {
    if (status === 'success') {
      showToast('success', '候选 Issue 已加载', `已筛选出 ${issues.length} 个候选 Issue`)
    }
    if (status === 'error' && error) {
      showToast('error', '候选 Issue 加载失败', error)
    }
  }, [error, issues.length, showToast, status])

  const languageText = useMemo(() => {
    if (meta?.languages.length) return meta.languages.join('、')
    if (profile.preferredTechStack.length) return profile.preferredTechStack.join('、')
    return '通用 good first issue / help wanted'
  }, [meta?.languages, profile.preferredTechStack])

  const handleStart = (issue: CandidateIssue) => {
    startContribution(issue)
    showToast('success', '已选择 Issue', `开始分析 ${issue.repository.fullName}#${issue.issueNumber}`)
    navigate('/dashboard')
  }

  const isLoading = status === 'idle' || status === 'loading'

  return (
    <AppLayout breadcrumbs={[{ label: 'Issue 推荐' }]}>
      <div className="app-page active">
        <div className="page-header">
          <div className="page-title-row">
            <div>
              <h1 className="page-title">Issue 推荐首页</h1>
              <p className="page-subtitle">
                根据你的 GitHub 画像和 onboarding 偏好，从 GitHub 拉取候选 Issue。
              </p>
            </div>
            <span className="repo-pill">
              <CodeIcon />
              {languageText}
            </span>
          </div>
        </div>

        {!isAuthenticated ? (
          <AiPageError
            title="需要先登录 GitHub"
            message="候选 Issue 会基于你的 Developer Profile 生成，请先回到首页完成 GitHub 登录。"
            onRetry={() => navigate('/')}
            retryLabel="回到首页"
          />
        ) : isLoading ? (
          <div className="ai-loading active">
            <div className="ai-loading-spinner" />
            <div className="ai-loading-title">正在获取候选 Issue...</div>
            <div className="ai-loading-desc">
              正在从 GitHub 拉取 good first issue / help wanted 候选项
            </div>
          </div>
        ) : status === 'error' ? (
          <AiPageError
            title="加载候选 Issue 失败"
            message={error || '请稍后重试'}
            onRetry={loadCandidateIssues}
          />
        ) : (
          <>
            <div className="issues-toolbar">
              <div className="issues-tabs">
                <button className="issues-tab active">
                  候选 Issues
                  <span className="issues-tab-count">{issues.length}</span>
                </button>
              </div>
              {meta && (
                <div className="issues-filters">
                  <span className="filter-select">
                    原始 {meta.rawCount}
                  </span>
                  <span className="filter-select">
                    去重 {meta.deduplicatedCount}
                  </span>
                  <span className="filter-select">
                    已筛选 {meta.filteredCount}
                  </span>
                </div>
              )}
            </div>

            {meta?.warnings.length ? (
              <div className="profile-default-notice">
                {meta.warnings.join(' ')}
              </div>
            ) : null}

            <div className="issues-list candidate-issues-list">
              {issues.length > 0 ? (
                issues.map((issue) => (
                  <CandidateIssueCard
                    key={issue.id}
                    issue={issue}
                    expanded={expandedId === issue.id}
                    onToggle={() =>
                      setExpandedId((current) =>
                        current === issue.id ? null : issue.id,
                      )
                    }
                    onStart={() => handleStart(issue)}
                  />
                ))
              ) : (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
                  暂未找到候选 Issue。当前阶段不会为了凑数扩展到普通 issue 搜索。
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  )
}

export default Issues
