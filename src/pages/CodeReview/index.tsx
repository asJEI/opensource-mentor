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
import { githubService } from '@/services'
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

function rankBranches(branches: string[], issueNumber?: number): string[] {
  const issueKey = issueNumber ? String(issueNumber) : ''
  return [...branches].sort((a, b) => {
    const aIssue = issueKey && a.includes(issueKey) ? 1 : 0
    const bIssue = issueKey && b.includes(issueKey) ? 1 : 0
    if (aIssue !== bIssue) return bIssue - aIssue
    const aDefault = a === 'main' || a === 'master' ? 1 : 0
    const bDefault = b === 'main' || b === 'master' ? 1 : 0
    if (aDefault !== bDefault) return aDefault - bDefault
    return a.localeCompare(b)
  })
}

function pickSuggestedBranch(
  branches: string[],
  issueNumber?: number,
): string {
  const ranked = rankBranches(branches, issueNumber)
  const issueKey = issueNumber ? String(issueNumber) : ''
  if (issueKey) {
    const matched = ranked.find((name) => name.includes(issueKey))
    if (matched) return matched
  }
  return (
    ranked.find((name) => name !== 'main' && name !== 'master') ||
    ranked[0] ||
    ''
  )
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
  const [forkBranches, setForkBranches] = useState<string[]>([])
  const [branchesLoading, setBranchesLoading] = useState(false)
  const [branchesError, setBranchesError] = useState<string | null>(null)

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

  const loadForkBranches = async (
    owner: string,
    repo: string,
    preferredBranch?: string,
  ) => {
    if (!owner || !repo) return
    setBranchesLoading(true)
    setBranchesError(null)
    try {
      const branches = await githubService.listBranches(owner, repo)
      const ranked = rankBranches(branches, boundIssue?.number)
      setForkBranches(ranked)
      const nextBranch =
        preferredBranch && ranked.includes(preferredBranch)
          ? preferredBranch
          : forkBranch && ranked.includes(forkBranch)
            ? forkBranch
            : pickSuggestedBranch(ranked, boundIssue?.number)
      if (nextBranch) {
        setForkBranch(nextBranch)
        setCompareInput({ headRef: nextBranch })
      }
    } catch (err) {
      setForkBranches([])
      setBranchesError(
        err instanceof Error ? err.message : '加载分支列表失败，可手动填写',
      )
    } finally {
      setBranchesLoading(false)
    }
  }

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
    void loadForkBranches(parsed.owner, parsed.repo, parsed.branch || undefined)
  }

  // 登录后自动填入个人 Fork 地址并拉取分支
  useEffect(() => {
    if (forkRepoUrl) return
    if (!githubUsername || !upstreamRepo) return
    const url = `https://github.com/${githubUsername}/${upstreamRepo}`
    setForkRepoUrl(url)
    setCompareInput({
      headOwner: githubUsername,
      headRepo: upstreamRepo,
    })
    void loadForkBranches(githubUsername, upstreamRepo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [githubUsername, upstreamRepo])

  // Issue 变化时，优先自动选中含 Issue 编号的分支
  useEffect(() => {
    if (!forkBranches.length || !boundIssue?.number) return
    const issueKey = String(boundIssue.number)
    if (forkBranch.includes(issueKey)) return
    const suggested = pickSuggestedBranch(forkBranches, boundIssue.number)
    if (!suggested || !suggested.includes(issueKey)) return
    setForkBranch(suggested)
    setCompareInput({ headRef: suggested })
  }, [
    boundIssue?.number,
    forkBranches,
    forkBranch,
    setCompareInput,
  ])

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
    showToast(
      'info',
      '修改建议在右侧面板',
      '「AI 审查」栏已按文件列出问题、风险和建议，逐条对照修改即可；有疑问可以问 AI 导师',
    )
  }

  const handleGeneratePr = () => {
    showToast('info', '正在前往 PR 生成器', '在那里补一句改动说明，就能生成标题和描述')
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
                <span className="osm-kicker">
                  <span className="osm-kicker-dot" />
                  CODE REVIEW
                </span>
                <h1 className="page-title">代码审查</h1>
                <p className="page-subtitle">
                  提交 PR 前先让 AI 过一遍改动，减少来回修改的次数
                </p>
              </div>
              <span className="repo-pill">
                <CodeIcon />
                {repoName}
              </span>
            </div>
          </div>

          <div className="code-review__empty">
            <div className="empty-state">
              <span className="osm-kicker">
                <span className="osm-kicker-dot" />
                NO ISSUE BOUND
              </span>
              <h2>选择一个 Issue 开始代码审查</h2>
              <p className="empty-desc">
                审查需要知道你在解决哪个 Issue。可以从下面的候选中选一个；
                如果列表是空的，请先到「Issue 推荐」锁定任务。
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
              <span className="osm-kicker">
                <span className="osm-kicker-dot" />
                CODE REVIEW
              </span>
              <h1 className="page-title">代码审查</h1>
              <p className="page-subtitle">
                支持 PR 链接，或审查你个人 Fork 分支相对上游的改动
              </p>
            </div>
            <span className="repo-pill">
              <CodeIcon />
              {repoName}
            </span>
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
                      粘贴后自动识别用户名并加载分支
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
                    onBlur={() => {
                      const parsed = parseGitHubRepoUrl(forkRepoUrl)
                      if (!parsed) return
                      void loadForkBranches(
                        parsed.owner,
                        parsed.repo,
                        parsed.branch || forkBranch || undefined,
                      )
                    }}
                  />

                  <label className="form-label" style={{ marginTop: 14 }}>
                    你的分支
                    <span className="form-hint">
                      {branchesLoading
                        ? '正在从 GitHub 加载分支…'
                        : boundIssue?.number
                          ? `优先匹配含 #${boundIssue.number} 的分支，一般无需手填`
                          : '从列表选择你已 push 的改动分支'}
                    </span>
                  </label>
                  {forkBranches.length > 0 ? (
                    <select
                      className="form-input"
                      value={
                        forkBranches.includes(forkBranch)
                          ? forkBranch
                          : forkBranches[0]
                      }
                      onChange={(e) => {
                        setForkBranch(e.target.value)
                        setCompareInput({ headRef: e.target.value })
                      }}
                    >
                      {forkBranches.map((name) => (
                        <option key={name} value={name}>
                          {boundIssue?.number &&
                          name.includes(String(boundIssue.number))
                            ? `⭐ ${name}（匹配 Issue #${boundIssue.number}）`
                            : name}
                        </option>
                      ))}
                    </select>
                  ) : (
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
                  )}
                  {branchesError ? (
                    <div className="form-tip" style={{ color: '#f87171' }}>
                      {branchesError}
                    </div>
                  ) : null}
                  {forkBranches.length > 0 ? (
                    <div className="form-tip">
                      已加载 {forkBranches.length} 个分支
                      {boundIssue?.number &&
                      forkBranch.includes(String(boundIssue.number))
                        ? `，已自动选中与 Issue #${boundIssue.number} 相关的分支`
                        : '，可在列表中切换'}
                      。仍可粘贴带 /tree/分支 的仓库链接自动识别。
                    </div>
                  ) : null}

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
                      {compareInput.headOwner || githubUsername || 'you'}:
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
                  改动越大耗时越长，通常在 30 秒左右；结果会以「文件列表 | Diff | AI
                  审查」三列展示
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
            kicker="REVIEW FAILED"
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
            title="AI 审查完成"
            description={
              createPrUrl
                ? '确认审查结果没有遗漏后，可以打开 GitHub 发起合并申请，再回到 PR 生成器完善描述。'
                : '确认审查结果没有遗漏后，下一步生成 PR 描述，让维护者更容易 review'
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
