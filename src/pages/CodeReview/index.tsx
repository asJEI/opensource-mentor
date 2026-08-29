import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout'
import {
  IssueContextCard,
  ReviewProgress,
  ReviewWorkspace,
  ReviewActionBar,
  NextStepCard,
  AiPageError,
} from '@/components/business'
import {
  useCodeReviewStore,
  useRepositoryStore,
  useToastStore,
  useUserStore,
} from '@/store'
import type { CandidateIssue, RecommendedIssue } from '@/types'

function parseGitHubRepoUrl(raw: string): {
  owner: string
  repo: string
  branch: string
} | null {
  const value = raw.trim()
  if (!value) return null

  const compareMatch = value.match(
    /github\.com\/([^/]+)\/([^/#?\s]+)\/compare\/([^/\s]+?)\.\.\.([^:/\s]+):([^/\s?#]+)/i,
  )
  if (compareMatch) {
    return {
      owner: compareMatch[4],
      repo: compareMatch[2].replace(/\.git$/i, ''),
      branch: decodeURIComponent(compareMatch[5]),
    }
  }

  const treeMatch = value.match(
    /github\.com\/([^/]+)\/([^/#?\s]+)(?:\/tree\/([^?#\s]+))?/i,
  )
  if (treeMatch) {
    return {
      owner: treeMatch[1],
      repo: treeMatch[2].replace(/\.git$/i, ''),
      branch: treeMatch[3] ? decodeURIComponent(treeMatch[3]) : '',
    }
  }

  const shortMatch = value.match(/^([^/\s]+)\/([^/\s#?]+)$/)
  if (shortMatch) {
    return {
      owner: shortMatch[1],
      repo: shortMatch[2].replace(/\.git$/i, ''),
      branch: '',
    }
  }

  return null
}

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

const GitBranchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="6" y1="3" x2="6" y2="15" />
    <circle cx="18" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <path d="M18 9a9 9 0 0 1-9 9" />
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

const CodeReview = () => {
  const navigate = useNavigate()
  const status = useCodeReviewStore((s) => s.status)
  const progress = useCodeReviewStore((s) => s.progress)
  const result = useCodeReviewStore((s) => s.result)
  const error = useCodeReviewStore((s) => s.error)
  const selectedIssue = useCodeReviewStore((s) => s.selectedIssue)
  const mode = useCodeReviewStore((s) => s.mode)
  const compareInput = useCodeReviewStore((s) => s.compareInput)
  const artifacts = useCodeReviewStore((s) => s.artifacts)
  const selectedFile = useCodeReviewStore((s) => s.selectedFile)
  const sourceLabel = useCodeReviewStore((s) => s.sourceLabel)
  const createPrUrl = useCodeReviewStore((s) => s.createPrUrl)
  const setPrUrl = useCodeReviewStore((s) => s.setPrUrl)
  const setMode = useCodeReviewStore((s) => s.setMode)
  const setCompareInput = useCodeReviewStore((s) => s.setCompareInput)
  const setSelectedFile = useCodeReviewStore((s) => s.setSelectedFile)
  const startReview = useCodeReviewStore((s) => s.startReview)
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
  const githubUsername = useUserStore(
    (s) => s.githubProfile?.profile.username || s.profile.username || '',
  )
  const isAuthenticated = useUserStore((s) => s.isAuthenticated)

  const [prUrlInput, setPrUrlInput] = useState('')
  const [forkRepoUrl, setForkRepoUrl] = useState('')
  const [forkBranch, setForkBranch] = useState('')

  const boundIssue = useMemo(() => {
    if (activeContributionIssue) return toReviewIssue(activeContributionIssue)
    if (selectedIssue) return toReviewIssue(selectedIssue)
    return null
  }, [activeContributionIssue, selectedIssue])

  const repoName = activeContributionIssue
    ? activeContributionIssue.repository.fullName
    : `${currentOwner || 'microsoft'}/${currentRepoName || 'vscode'}`

  const [upstreamOwner, upstreamRepo] = useMemo(() => {
    const parts = repoName.split('/')
    return [parts[0] || currentOwner || '', parts[1] || currentRepoName || '']
  }, [repoName, currentOwner, currentRepoName])

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
  }, [activeContributionIssue, selectedIssue, setSelectedIssue])

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

  useEffect(() => {
    if (!upstreamOwner || !upstreamRepo) return
    setCompareInput({
      baseOwner: upstreamOwner,
      baseRepo: upstreamRepo,
      headRepo: compareInput.headRepo || upstreamRepo,
      baseRef: compareInput.baseRef || 'main',
      ...(githubUsername && !compareInput.headOwner
        ? { headOwner: githubUsername }
        : {}),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upstreamOwner, upstreamRepo, githubUsername])

  useEffect(() => {
    if (!githubUsername) return
    if (compareInput.headOwner) return
    setCompareInput({ headOwner: githubUsername })
  }, [githubUsername, compareInput.headOwner, setCompareInput])

  const applyForkRepoUrl = (raw: string) => {
    setForkRepoUrl(raw)
    const parsed = parseGitHubRepoUrl(raw)
    if (!parsed) return
    setCompareInput({
      headOwner: parsed.owner,
      headRepo: parsed.repo,
      ...(parsed.branch ? { headRef: parsed.branch } : {}),
    })
    if (parsed.branch) {
      setForkBranch(parsed.branch)
    }
  }

  const handleSelectIssue = (issue: RecommendedIssue) => {
    setSelectedIssue(toReviewIssue(issue))
    showToast(
      'success',
      '已选择 Issue',
      `已选择 #${issue.number}，可以开始提交代码了`,
    )
  }

  const handleStartReview = () => {
    if (mode === 'pr') {
      if (!prUrlInput.trim()) {
        showToast('error', '请输入 PR 链接', '需要知道你提交的 PR 才能审查哦')
        return
      }
      setPrUrl(prUrlInput.trim())
    } else {
      const parsed = parseGitHubRepoUrl(forkRepoUrl)
      const headOwner =
        parsed?.owner || compareInput.headOwner || githubUsername
      const headRepo =
        parsed?.repo || compareInput.headRepo || upstreamRepo
      const headRef = (
        forkBranch ||
        parsed?.branch ||
        compareInput.headRef
      ).trim()

      if (!forkRepoUrl.trim() && !headOwner) {
        showToast(
          'error',
          '请粘贴你的 Fork 仓库链接',
          '例如 https://github.com/你的用户名/仓库名',
        )
        return
      }
      if (!headOwner) {
        showToast(
          'error',
          '无法识别 GitHub 用户名',
          '请粘贴完整仓库链接，或先登录 GitHub',
        )
        return
      }
      if (!headRef) {
        showToast(
          'error',
          '请填写分支名',
          '填写你已 push 的分支，例如 fix/issue-15',
        )
        return
      }

      setCompareInput({
        baseOwner: upstreamOwner || compareInput.baseOwner,
        baseRepo: upstreamRepo || compareInput.baseRepo,
        baseRef: compareInput.baseRef || 'main',
        headOwner,
        headRepo,
        headRef,
      })
    }
    void startReview()
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

  const handleOpenCreatePr = () => {
    if (!createPrUrl) return
    window.open(createPrUrl, '_blank', 'noopener,noreferrer')
    showToast(
      'success',
      '已打开 GitHub Compare',
      '确认无误后可直接创建 Pull Request 合并申请',
    )
  }

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
            </div>

            <div className="quick-issue-list">
              {recommendedIssues.slice(0, 5).map((issue) => (
                <button
                  key={issue.number}
                  className="quick-issue-card"
                  onClick={() => handleSelectIssue(issue)}
                >
                  <div className="quick-issue-card__main">
                    <span className="quick-issue-number">#{issue.number}</span>
                    <span className="quick-issue-title">{issue.title}</span>
                  </div>
                  <div className="quick-issue-card__meta">
                    <span
                      className={`quick-issue-difficulty difficulty-${issue.difficulty || 'medium'}`}
                    >
                      {issue.difficulty === 'easy'
                        ? '入门'
                        : issue.difficulty === 'hard'
                          ? '进阶'
                          : '中等'}
                    </span>
                  </div>
                </button>
              ))}
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
                支持 PR 链接，或审查你个人 Fork 分支相对上游的改动
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
                </div>
                <div className="submit-card__subtitle">
                  推荐：先把修改 push 到个人 Fork，再审查相对上游的 diff，通过后去开合并申请
                </div>
              </div>

              <div className="demo-notice">
                <div className="demo-notice__icon">💡</div>
                <div className="demo-notice__content">
                  <strong>推荐流程</strong>
                  <p>
                    Fork 上游仓库 → 本地修改并 push 到个人分支 → 用「Fork
                    分支」审查 → 通过后一键打开 GitHub Compare 发起 PR。
                  </p>
                </div>
              </div>

              <div className="submit-modes">
                <button
                  className={mode === 'pr' ? 'active' : ''}
                  onClick={() => setMode('pr')}
                >
                  <LinkIcon />
                  PR 链接
                </button>
                <button
                  className={mode === 'compare' ? 'active' : ''}
                  onClick={() => setMode('compare')}
                >
                  <GitBranchIcon />
                  Fork 分支
                </button>
              </div>

              {mode === 'pr' && (
                <div className="submit-form">
                  <label className="form-label">
                    GitHub PR 链接
                    <span className="form-hint">
                      若你已开好 PR，可直接粘贴链接审查
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
                    💡 尚未开 PR 时，可切换到「Fork 分支」粘贴你的仓库链接
                  </div>
                </div>
              )}

              {mode === 'compare' && (
                <div className="submit-form compare-form">
                  <label className="form-label">
                    你的 Fork 仓库链接
                    <span className="form-hint">
                      粘贴个人仓库地址即可，用户名会自动识别
                      {githubUsername
                        ? `（当前登录：${githubUsername}）`
                        : isAuthenticated
                          ? ''
                          : '；未登录也可从链接识别'}
                    </span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder={`https://github.com/${githubUsername || 'your-username'}/${upstreamRepo || 'repo'}`}
                    value={forkRepoUrl}
                    onChange={(e) => applyForkRepoUrl(e.target.value)}
                  />

                  <label className="form-label" style={{ marginTop: 14 }}>
                    你的分支名
                    <span className="form-hint">
                      已 push 的分支；若链接含 /tree/分支 会自动填入
                    </span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="fix/issue-15"
                    value={forkBranch || compareInput.headRef}
                    onChange={(e) => {
                      setForkBranch(e.target.value)
                      setCompareInput({ headRef: e.target.value })
                    }}
                  />

                  <label className="form-label" style={{ marginTop: 14 }}>
                    对比上游分支
                    <span className="form-hint">
                      默认对比 {upstreamOwner}/{upstreamRepo}
                    </span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={compareInput.baseRef || 'main'}
                    onChange={(e) =>
                      setCompareInput({ baseRef: e.target.value })
                    }
                    placeholder="main"
                  />

                  <div className="form-tip">
                    系统会拉取{' '}
                    <code>
                      {upstreamOwner || 'upstream'}/{upstreamRepo || 'repo'}:
                      {compareInput.baseRef || 'main'}
                      ...
                      {compareInput.headOwner ||
                        githubUsername ||
                        'you'}
                      :
                      {forkBranch || compareInput.headRef || 'branch'}
                    </code>{' '}
                    的变更进行审查
                  </div>
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
                  审查约需 30 秒，结果会以「文件列表 | Diff | AI 审查」三列展示
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
          <div className="code-review__workspace">
            <ReviewWorkspace
              result={result}
              artifacts={artifacts}
              selectedFile={selectedFile}
              onSelectFile={setSelectedFile}
              sourceLabel={sourceLabel}
              createPrUrl={createPrUrl}
              onOpenCreatePr={handleOpenCreatePr}
              onGeneratePrDesc={handleGeneratePr}
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
            description={
              createPrUrl
                ? '改动看起来不错。可先打开 GitHub 发起合并申请，随后再到 PR 生成器完善描述。'
                : '下一步生成专业的 PR 描述，让你的贡献更易被合并'
            }
            buttonText={createPrUrl ? '去开合并申请' : '生成 PR 描述'}
            nextPath="/pr-generator"
            onClick={createPrUrl ? handleOpenCreatePr : handleGeneratePr}
          />
        )}
      </div>
    </AppLayout>
  )
}

export default CodeReview
