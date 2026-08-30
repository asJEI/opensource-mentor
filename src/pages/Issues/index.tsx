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

function localizeDifficulty(raw?: string | null): string {
  if (!raw?.trim()) return '难度未知'
  const value = raw.trim().toLowerCase()
  const map: Record<string, string> = {
    beginner: '入门',
    'beginner+': '入门+',
    easy: '入门',
    intermediate: '中等',
    medium: '中等',
    advanced: '进阶',
    hard: '进阶',
    expert: '专家',
  }
  return map[value] || raw.trim()
}

function localizeEstimatedTime(raw?: string | null): string {
  if (!raw?.trim()) return '时间未知'
  const value = raw.trim()
  if (/[\u4e00-\u9fff]/.test(value)) return value
  const lower = value.toLowerCase()
  if (/weekend/.test(lower)) return '约一个周末'
  if (/few hours|couple of hours|2-4\s*h|2–4\s*h/.test(lower)) return '约几小时'
  if (/half.?day/.test(lower)) return '约半天'
  if (/\b1-3h\b|1–3h/.test(lower)) return '约 1-3 小时'
  if (/\b3-6h\b|3–6h/.test(lower)) return '约 3-6 小时'
  if (/\b6-12h\b|6–12h/.test(lower)) return '约 6-12 小时'
  if (/\bday\b|1 day|one day/.test(lower)) return '约一天'
  if (/week\b|1 week|one week/.test(lower)) return '约一周'
  const range = lower.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*h/)
  if (range) return `约 ${range[1]}-${range[2]} 小时`
  if (/hour|\bh\b/.test(lower)) {
    const hours = value.match(/\d+(?:\.\d+)?/)?.[0]
    return hours ? `约 ${hours} 小时` : '约数小时'
  }
  return value
}

function localizeScope(raw?: string | null): string {
  if (!raw?.trim()) return '未知'
  const value = raw.trim().toLowerCase()
  if (value === 'small') return '较小'
  if (value === 'medium') return '中等'
  if (value === 'large') return '较大'
  return raw.trim()
}

function availabilityLabel(issue: CandidateIssue): string {
  const status = issue.availability?.status
  if (status === 'ask_first' || issue.availability?.shouldAskFirst) return '建议先确认'
  if (status === 'possibly_outdated') return '先核验现状'
  if (status === 'uncertain') return '状态待确认'
  return '可以开始'
}

function availabilityDescription(issue: CandidateIssue): string {
  if (issue.availability?.reasons?.length) {
    return issue.availability.reasons.join(' ')
  }
  return issue.claimHint || '当前没有发现已分配、已认领或已有 PR 的明确信号。'
}

function looksLikeEnglishSummary(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  if (/[\u4e00-\u9fff]/.test(trimmed)) return false
  return /[A-Za-z]{3,}/.test(trimmed)
}

const CandidateIssueCard = ({
  issue,
  expanded,
  analysisStatus,
  onToggle,
  onStart,
}: {
  issue: CandidateIssue
  expanded: boolean
  analysisStatus: 'idle' | 'loading' | 'success' | 'error'
  onToggle: () => void
  onStart: () => void
}) => {
  const analysis = issue.analysis
  const technologies = analysis?.technologies?.length
    ? analysis.technologies
    : [issue.language].filter((item): item is string => Boolean(item))
  const shortReason =
    issue.whyThisFitsYou?.[0] ||
    (issue.recommendationFallback
      ? 'AI 分析暂时不可用，已根据 GitHub 基础字段推荐。'
      : analysisStatus === 'loading' || analysisStatus === 'idle'
        ? '正在分析匹配度…'
      : '该 Issue 与你的当前画像存在一定匹配。')
  const contributionAccess =
    issue.contributionAccess ||
    (issue.claimHint?.includes('认领') ? 'claim_required' : 'direct_submit')
  const claimHint =
    availabilityDescription(issue) ||
    issue.claimHint ||
    (contributionAccess === 'claim_required'
      ? '开始动手前，请先按仓库要求在 Issue 下评论认领，并等待维护者审核或指派。'
      : '当前看不需要额外认领，可直接按 Issue 完成修改并提交 PR。')
  const availabilityText = availabilityLabel(issue)

  return (
    <article className={clsx('issue-row-card', expanded && 'expanded')}>
      <button type="button" className="issue-row-main" onClick={onToggle}>
        <span className="issue-row-status" aria-hidden="true">
          <IssueIcon />
        </span>
        <span className="issue-row-title-block">
          <span>{issue.repository.fullName}</span>
          <strong>
            {issue.title}{' '}
            <small>#{issue.issueNumber}</small>
          </strong>
          <em>{shortReason}</em>
        </span>
        <span className="issue-row-meta">
          <span
            className={clsx(
              'issue-access-chip',
              issue.availability?.status === 'possibly_outdated'
                ? 'possibly-outdated'
                : contributionAccess === 'claim_required'
                ? 'claim-required'
                : 'direct-submit',
            )}
          >
            {availabilityText}
          </span>
          {technologies.slice(0, 3).map((technology) => (
            <span key={technology}>{technology}</span>
          ))}
          {analysis?.difficulty && (
            <span>{localizeDifficulty(analysis.difficulty)}</span>
          )}
          {analysis?.estimatedTime && (
            <span>{localizeEstimatedTime(analysis.estimatedTime)}</span>
          )}
        </span>
      </button>

      {expanded && (
        <div className="issue-expanded-panel">
          <div className="issue-expanded-grid">
            <section>
              <h3>贡献方式</h3>
              <p>
                <strong>
                  {contributionAccess === 'claim_required'
                    ? '建议先确认'
                    : availabilityText}
                </strong>
                {' · '}
                {claimHint}
              </p>
              {issue.availability?.linkedPullRequests?.length ? (
                <p>
                  已发现关联 PR：
                  {issue.availability.linkedPullRequests
                    .map((pr) => `#${pr.number} ${pr.title}`)
                    .join('；')}
                </p>
              ) : null}
            </section>
            <section>
              <h3>Issue 简介</h3>
              <p>
                {analysisStatus === 'loading'
                  ? '正在生成中文简介…'
                  : analysis?.summary &&
                      !looksLikeEnglishSummary(analysis.summary)
                    ? analysis.summary
                    : analysis?.summary
                      ? '正在准备中文简介…'
                      : issue.title}
              </p>
            </section>
            <section>
              <h3>为什么适合你</h3>
              <ul className="issue-fit-list">
                {(issue.whyThisFitsYou?.length
                  ? issue.whyThisFitsYou
                  : [shortReason]
                ).map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </section>
            <section>
              <h3>你可能会接触的技术</h3>
              <p>
                {technologies.length
                  ? technologies.join(' · ')
                  : '暂无明确技术栈'}
              </p>
            </section>
            <section>
              <h3>仓库基本信息</h3>
              <p>
                <a href={issue.repository.url} target="_blank" rel="noreferrer">
                  {issue.repository.fullName}
                </a>
                {' · '}
                Star {issue.repository.stars ?? '未知'} · Fork{' '}
                {issue.repository.forks ?? '未知'} · 开放 Issues{' '}
                {issue.repository.openIssues ?? '未知'} · 更新于{' '}
                {formatDate(issue.repository.updatedAt || issue.updatedAt)}
              </p>
            </section>
            <section>
              <h3>匹配信息</h3>
              <p>
                {localizeDifficulty(analysis?.difficulty)} ·{' '}
                {localizeEstimatedTime(analysis?.estimatedTime)} · 范围{' '}
                {localizeScope(analysis?.scopeAssessment)}
              </p>
            </section>
          </div>

          <div className="issue-expanded-footer">
            <div className="issue-source-actions">
              <a href={issue.issueUrl} target="_blank" rel="noreferrer">
                在 GitHub 查看 ↗
              </a>
              <details className="issue-source-summary">
                <summary>查看原始描述摘要</summary>
                <p>{summarizeBody(issue.body)}</p>
              </details>
            </div>
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
  const analysisStatusByIssue = useRepositoryStore(
    (state) => state.candidateIssueAnalysisStatus,
  )
  const loadCandidateIssues = useRepositoryStore(
    (state) => state.loadCandidateIssues,
  )
  const startContribution = useRepositoryStore(
    (state) => state.startContribution,
  )
  const analyzeCandidateIssue = useRepositoryStore(
    (state) => state.analyzeCandidateIssue,
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

  useEffect(() => {
    if (status !== 'success' || issues.length === 0) return
    let cancelled = false
    let cursor = 0
    let running = 0
    const concurrency = 3

    const runNext = () => {
      if (cancelled) return
      while (running < concurrency && cursor < issues.length) {
        const issue = issues[cursor]
        cursor += 1
        if (!issue) continue
        const needsChineseRefresh = Boolean(
          issue.analysis?.summary &&
            looksLikeEnglishSummary(issue.analysis.summary),
        )
        if (issue.analysis && !needsChineseRefresh) continue
        const currentStatus = analysisStatusByIssue[issue.id]
        if (currentStatus === 'loading') continue
        if (currentStatus === 'success' && !needsChineseRefresh) continue
        running += 1
        void analyzeCandidateIssue(issue, {
          force: needsChineseRefresh,
        }).finally(() => {
          running -= 1
          runNext()
        })
      }
    }

    runNext()
    return () => {
      cancelled = true
    }
  }, [analysisStatusByIssue, analyzeCandidateIssue, issues, status])

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
  const aiFallbackWarnings =
    meta?.warnings.filter((warning) => warning.includes('AI')) ?? []

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
                  为你推荐
                  <span className="issues-tab-count">{issues.length}</span>
                </button>
              </div>
            </div>

            {aiFallbackWarnings.length ? (
              <div className="issue-subtle-notice">
                部分推荐暂时使用基础信息生成，稍后刷新可能会更完整。
              </div>
            ) : null}

            <div className="issues-list candidate-issues-list">
              {issues.length > 0 ? (
                issues.map((issue) => (
                  <CandidateIssueCard
                    key={issue.id}
                    issue={issue}
                    expanded={expandedId === issue.id}
                    analysisStatus={analysisStatusByIssue[issue.id] || 'idle'}
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
