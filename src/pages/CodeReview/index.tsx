import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout'
import {
  IssueContextCard,
  ReviewProgress,
  ReviewResultPanel,
  ReviewActionBar,
  NextStepCard,
  AiPageError,
} from '@/components/business'
import { useCodeReviewStore, useRepositoryStore, useToastStore } from '@/store'
import type { CandidateIssue, RecommendedIssue } from '@/types'

// ==================== 图标组件 ====================
const CodeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
)

const UploadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
)

const LinkIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
)

const FileCodeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
)

const AlertIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
)

function mapAnalysisDifficulty(
  value?: string | null,
): RecommendedIssue['difficulty'] {
  const lower = (value || '').toLowerCase()
  if (lower.includes('beginner') || lower === 'easy') return 'easy'
  if (lower.includes('advanced') || lower === 'hard' || lower === 'expert') {
    return 'hard'
  }
  return 'medium'
}

function estimateHoursFromText(raw?: string | null): number | undefined {
  if (!raw?.trim()) return undefined
  const hours = raw.match(/(\d+(?:\.\d+)?)\s*小时|(\d+(?:\.\d+)?)\s*h\b/i)
  if (hours) return Number(hours[1] || hours[2])
  if (/weekend|周末/i.test(raw)) return 8
  if (/day|天/i.test(raw)) return 6
  if (/week|周/i.test(raw)) return 20
  return undefined
}

/** 将当前贡献 Issue / 推荐 Issue 统一成审查页可用结构 */
function toReviewIssue(
  issue: CandidateIssue | RecommendedIssue,
): RecommendedIssue {
  const candidate = issue as CandidateIssue
  const recommended = issue as RecommendedIssue
  const number = candidate.issueNumber || issue.number
  const analysisDifficulty = candidate.analysis?.difficulty
  const analysisTime = candidate.analysis?.estimatedTime

  return {
    ...issue,
    number,
    htmlUrl: issue.htmlUrl || candidate.issueUrl || issue.htmlUrl,
    difficulty:
      recommended.difficulty ||
      (analysisDifficulty ? mapAnalysisDifficulty(analysisDifficulty) : 'medium'),
    estimatedTime:
      typeof recommended.estimatedTime === 'number'
        ? recommended.estimatedTime
        : estimateHoursFromText(analysisTime) || 2,
  }
}

// ==================== CodeReview 页面 ====================
const CodeReview = () => {
  const navigate = useNavigate()
  const status = useCodeReviewStore((s) => s.status)
  const progress = useCodeReviewStore((s) => s.progress)
  const result = useCodeReviewStore((s) => s.result)
  const error = useCodeReviewStore((s) => s.error)
  const selectedIssue = useCodeReviewStore((s) => s.selectedIssue)
  const activeTab = useCodeReviewStore((s) => s.activeTab)
  const expandedIssueId = useCodeReviewStore((s) => s.expandedIssueId)
  const setPrUrl = useCodeReviewStore((s) => s.setPrUrl)
  const startReview = useCodeReviewStore((s) => s.startReview)
  const setActiveTab = useCodeReviewStore((s) => s.setActiveTab)
  const toggleIssue = useCodeReviewStore((s) => s.toggleIssue)
  const reset = useCodeReviewStore((s) => s.reset)

  const currentOwner = useRepositoryStore((s) => s.currentOwner)
  const currentRepoName = useRepositoryStore((s) => s.currentRepoName)
  const recommendedIssues = useRepositoryStore((s) => s.recommendedIssues)
  const issuesStatus = useRepositoryStore((s) => s.issuesStatus)
  const loadRecommendedIssues = useRepositoryStore((s) => s.loadRecommendedIssues)
  const activeContributionIssue = useRepositoryStore(
    (s) => s.activeContributionIssue,
  )
  const setSelectedIssue = useCodeReviewStore((s) => s.setSelectedIssue)
  const showToast = useToastStore((s) => s.showToast)

  const DEMO_PR_URL = 'https://github.com/microsoft/vscode/pull/325329'

  const [submitMode, setSubmitMode] = useState<'pr' | 'diff' | 'file'>('pr')
  const [prUrlInput, setPrUrlInput] = useState(DEMO_PR_URL)

  // 优先绑定用户已选的贡献 Issue，再回退到审查页本地选择
  const boundIssue = useMemo(() => {
    if (activeContributionIssue) return toReviewIssue(activeContributionIssue)
    if (selectedIssue) return toReviewIssue(selectedIssue)
    return null
  }, [activeContributionIssue, selectedIssue])

  const repoName = activeContributionIssue
    ? activeContributionIssue.repository.fullName
    : `${currentOwner || 'microsoft'}/${currentRepoName || 'vscode'}`

  // 进入页面时同步当前贡献 Issue，直接进入提交界面
  useEffect(() => {
    if (!activeContributionIssue) return
    const next = toReviewIssue(activeContributionIssue)
    if (
      selectedIssue?.number === next.number &&
      selectedIssue?.title === next.title
    ) {
      return
    }
    setSelectedIssue(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeContributionIssue?.id, activeContributionIssue?.issueNumber])

  // 仅在没有当前 Issue 时，才加载推荐列表供手动选择
  useEffect(() => {
    if (
      !boundIssue &&
      recommendedIssues.length === 0 &&
      issuesStatus === 'idle'
    ) {
      loadRecommendedIssues(currentOwner, currentRepoName, { perPage: 5 })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundIssue])

  const handleSelectIssue = (issue: RecommendedIssue) => {
    setSelectedIssue(toReviewIssue(issue))
    showToast(
      'success',
      '已选择 Issue',
      `已选择 #${issue.number}，可以开始提交代码了`,
    )
  }

  const handleStartReview = () => {
    if (submitMode === 'pr') {
      if (!prUrlInput.trim()) {
        showToast('error', '请输入 PR 链接', '需要知道你提交的 PR 才能审查哦')
        return
      }
      setPrUrl(prUrlInput.trim())
    } else if (submitMode === 'diff') {
      showToast('info', '功能开发中', '粘贴 Diff 功能即将上线，敬请期待～')
      return
    } else {
      showToast('info', '功能开发中', '文件上传功能即将上线，敬请期待～')
      return
    }
    startReview()
  }

  const handleFixCode = () => {
    showToast('info', '修改指南已生成', 'AI 导师已为你整理好修改清单')
  }

  const handleGeneratePr = () => {
    showToast('success', '正在生成 PR 描述', '即将跳转到 PR 生成器...')
    setTimeout(() => {
      navigate('/pr-generator')
    }, 800)
  }

  // 未选择 Issue 的空状态（仅当全局也没有当前贡献 Issue）
  if (!boundIssue && status === 'idle') {
    return (
      <AppLayout breadcrumbs={[{ label: '代码审查' }]}>
        <div className="app-page active code-review-page">
          <div className="page-header">
            <div className="page-title-row">
              <div>
                <h1 className="page-title">代码审查</h1>
                <p className="page-subtitle">
                  AI 导师帮你检查代码，确保第一次贡献就高质量通过
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="repo-pill">
                  <CodeIcon />
                  {repoName}
                </span>
                <span className="hero-badge" style={{ marginBottom: 0 }}>
                  <span className="hero-badge-dot" />
                  AI 导师审查
                </span>
              </div>
            </div>
          </div>

          <div className="code-review__empty">
            <div className="empty-state">
              <div className="empty-state__icon">
                <AlertIcon />
              </div>
              <h2>选择一个 Issue 开始代码审查</h2>
              <p className="empty-desc">
                代码审查需要针对具体的 Issue 和你提交的代码进行。
              </p>
              <p className="empty-desc">
                从下方推荐中选一个，或去 Issue 推荐页查看更多。
              </p>

              {issuesStatus === 'loading' && (
                <div className="quick-issues-loading">
                  <div className="loading-spinner" />
                  <span>正在加载推荐 Issue...</span>
                </div>
              )}

              {issuesStatus === 'success' && recommendedIssues.length > 0 && (
                <div className="quick-issues">
                  <div className="quick-issues-title">
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
                    AI 为你推荐（Top {Math.min(5, recommendedIssues.length)}）
                  </div>
                  <div className="quick-issues-list">
                    {recommendedIssues.slice(0, 5).map((issue) => (
                      <div
                        key={issue.id}
                        className="quick-issue-card"
                        onClick={() => handleSelectIssue(issue)}
                      >
                        <div className="quick-issue-header">
                          <span className="quick-issue-number">
                            #{issue.number}
                          </span>
                          <span
                            className={`quick-issue-difficulty difficulty-${issue.difficulty || 'medium'}`}
                          >
                            {issue.difficulty === 'easy'
                              ? '新手友好'
                              : issue.difficulty === 'hard'
                                ? '较有挑战'
                                : '中等难度'}
                          </span>
                        </div>
                        <div className="quick-issue-title">{issue.title}</div>
                        <div className="quick-issue-meta">
                          <span>
                            <svg
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
                            约 {issue.estimatedTime || 2} 小时
                          </span>
                          <span className="quick-issue-score">
                            匹配度{' '}
                            {issue.recommendationScore ?? issue.matchScore ?? 0}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                className="btn btn-primary"
                onClick={() => navigate('/issues')}
              >
                查看更多 Issue
              </button>
            </div>
          </div>
        </div>
      </AppLayout>
    )
  }

  const issue = boundIssue!

  return (
    <AppLayout breadcrumbs={[{ label: '代码审查' }]}>
      <div className="app-page active code-review-page">
        <div className="page-header">
          <div className="page-title-row">
            <div>
              <h1 className="page-title">代码审查</h1>
              <p className="page-subtitle">
                AI 导师帮你检查代码，确保第一次贡献就高质量通过
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="repo-pill">
                <CodeIcon />
                {repoName}
              </span>
              <span className="hero-badge" style={{ marginBottom: 0 }}>
                <span className="hero-badge-dot" />
                AI 导师审查
              </span>
            </div>
          </div>
        </div>

        <div className="code-review__issue-context">
          <IssueContextCard
            issue={{
              number: issue.number,
              title: issue.title,
              labels: (issue.labels || []).map((l) => ({
                name: l.name,
                color: l.color,
              })),
              htmlUrl: issue.htmlUrl,
            }}
            repoName={repoName}
            difficulty={
              issue.difficulty === 'easy'
                ? '入门'
                : issue.difficulty === 'hard'
                  ? '进阶'
                  : '中等'
            }
            estimatedTime={
              issue.estimatedTime
                ? `${issue.estimatedTime} 小时`
                : '2-3 小时'
            }
          />
        </div>

        {status === 'idle' && (
          <div className="code-review__submit">
            <div className="submit-card card">
              <div className="submit-card__header">
                <div className="submit-card__title">
                  <UploadIcon />
                  提交你的代码
                  <span className="demo-badge">Demo</span>
                </div>
                <div className="submit-card__subtitle">
                  把你为这个 Issue 写的代码交给 AI 导师检查一下吧
                </div>
              </div>

              <div className="demo-notice">
                <div className="demo-notice__icon">💡</div>
                <div className="demo-notice__content">
                  <strong>Demo 版本说明</strong>
                  <p>
                    当前为演示版本，仅支持 PR 链接方式提交。已为你预设了示例
                    PR，点击「开始 AI 审查」即可体验完整流程。
                  </p>
                </div>
              </div>

              <div className="submit-modes">
                <button
                  className={submitMode === 'pr' ? 'active' : ''}
                  onClick={() => setSubmitMode('pr')}
                >
                  <LinkIcon />
                  PR 链接
                </button>
                <button
                  className={`mode-disabled ${submitMode === 'diff' ? 'active' : ''}`}
                  onClick={() => {
                    setSubmitMode('diff')
                    showToast(
                      'info',
                      '功能开发中',
                      '粘贴 Diff 功能即将上线，敬请期待～',
                    )
                  }}
                  title="功能开发中，敬请期待"
                >
                  <FileCodeIcon />
                  粘贴 Diff
                  <span className="mode-tag">未完成</span>
                </button>
                <button
                  className={`mode-disabled ${submitMode === 'file' ? 'active' : ''}`}
                  onClick={() => {
                    setSubmitMode('file')
                    showToast(
                      'info',
                      '功能开发中',
                      '文件上传功能即将上线，敬请期待～',
                    )
                  }}
                  title="功能开发中，敬请期待"
                >
                  <UploadIcon />
                  上传文件
                  <span className="mode-tag">未完成</span>
                </button>
              </div>

              {submitMode === 'pr' && (
                <div className="submit-form">
                  <label className="form-label">
                    GitHub PR 链接
                    <span className="form-hint">
                      输入 GitHub Pull Request 链接进行审查
                    </span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="https://github.com/owner/repo/pull/123"
                    value={prUrlInput}
                    onChange={(e) => setPrUrlInput(e.target.value)}
                  />
                  <div className="form-tip">
                    💡 已为你预设了示例 PR，可直接点击下方按钮体验审查流程
                  </div>
                </div>
              )}

              {submitMode === 'diff' && (
                <div className="submit-form mode-disabled-content">
                  <div className="mode-disabled-icon">🚧</div>
                  <h4>粘贴 Diff 功能开发中</h4>
                  <p>
                    该功能即将上线，敬请期待～
                    <br />
                    目前请使用 PR 链接方式提交代码审查。
                  </p>
                </div>
              )}

              {submitMode === 'file' && (
                <div className="submit-form mode-disabled-content">
                  <div className="mode-disabled-icon">🚧</div>
                  <h4>文件上传功能开发中</h4>
                  <p>
                    该功能即将上线，敬请期待～
                    <br />
                    目前请使用 PR 链接方式提交代码审查。
                  </p>
                </div>
              )}

              <div className="submit-actions">
                <button
                  className="btn btn-primary btn-lg"
                  onClick={handleStartReview}
                >
                  🚀 开始 AI 审查
                </button>
                <p className="submit-disclaimer">
                  审查约需 30 秒，AI 导师会从功能性、规范性、安全性等多维度帮你检查
                </p>
              </div>
            </div>
          </div>
        )}

        {(status === 'queued' || status === 'running') && (
          <div className="code-review__progress">
            <ReviewProgress status={status} progress={progress} error={error} />
          </div>
        )}

        {status === 'completed' && result && (
          <div className="code-review__result">
            <ReviewResultPanel
              result={result}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              expandedIssueId={expandedIssueId}
              onToggleIssue={toggleIssue}
            />
          </div>
        )}

        {status === 'failed' && (
          <AiPageError
            className="code-review__error"
            title="审查遇到了一点问题"
            message={error || '请检查网络或 GitHub Token 后重试'}
            onRetry={() => reset()}
            retryLabel="重新提交"
          />
        )}

        {(status === 'completed' ||
          status === 'running' ||
          status === 'queued') && (
          <ReviewActionBar
            status={status}
            onFixCode={handleFixCode}
            onGeneratePr={handleGeneratePr}
          />
        )}

        {status === 'completed' && result && (
          <NextStepCard
            currentStep={5}
            totalSteps={6}
            title="AI 审查完成！"
            description="下一步生成专业的 PR 描述，让你的贡献更易被合并"
            buttonText="生成 PR 描述"
            nextPath="/pr-generator"
            onClick={handleGeneratePr}
          />
        )}
      </div>
    </AppLayout>
  )
}

export default CodeReview
