import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout'
import { Button } from '@/components/ui'
import { useToastStore, useRepositoryStore } from '@/store'
import { NextStepCard, JourneyActions, AiPageError } from '@/components/business'
import {
  AlertIcon,
  ArrowRightIcon,
  BranchIcon,
  CodeIcon,
  ExternalIcon,
  GitForkIcon,
  InfoIcon,
  IssueIcon,
  LogLine,
  Meter,
  PulseIcon,
  RefreshIcon,
  RepoStat,
  SectionRule,
  StarIcon,
  ZapIcon,
  deriveDifficulty,
  formatCount,
  getActivityLabel,
  getAreaDifficultyLabel,
  getFriendlyLabel,
  isBeginnerFriendly,
  parseRepoInput,
  type LogState,
} from './components'

const ONBOARDING_FLOW = [
  { title: '选定目标', desc: '在上方输入仓库，或从「Issue 推荐」挑一个任务' },
  { title: '读懂项目', desc: 'AI 给出项目定位、技术栈和可切入的贡献领域' },
  { title: '按指南推进', desc: '贡献指南把 Issue 拆成章节，卡住随时问 AI 导师' },
  { title: '审查并提交 PR', desc: '先做代码审查，再生成 PR 标题与描述' },
]

function localizeIssueDifficulty(raw?: string | null): string | null {
  if (!raw?.trim()) return null
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

function localizeEstimatedTime(raw?: string | null): string | null {
  if (!raw?.trim()) return null
  const value = raw.trim()
  const lower = value.toLowerCase()
  if (/[\u4e00-\u9fff]/.test(value)) return value
  if (/weekend/.test(lower)) return '约一个周末'
  if (/few hours|couple of hours|2-4 hours|2–4 hours/.test(lower)) return '约几小时'
  if (/half.?day/.test(lower)) return '约半天'
  if (/\bday\b|1 day|one day/.test(lower)) return '约一天'
  if (/week\b|1 week|one week/.test(lower)) return '约一周'
  if (/hour/.test(lower)) {
    const hours = value.match(/\d+(?:\.\d+)?/)?.[0]
    return hours ? `约 ${hours} 小时` : '约数小时'
  }
  return value
}

const Dashboard = () => {
  const navigate = useNavigate()
  const showToast = useToastStore((s) => s.showToast)

  // 从 store 获取数据（分开调用避免无限重渲染）
  const currentRepo = useRepositoryStore((s) => s.currentRepo)
  const analysis = useRepositoryStore((s) => s.analysis)
  const recommendedIssues = useRepositoryStore((s) => s.recommendedIssues)
  const analysisStatus = useRepositoryStore((s) => s.analysisStatus)
  const issuesStatus = useRepositoryStore((s) => s.issuesStatus)
  const analysisError = useRepositoryStore((s) => s.analysisError)
  const issuesError = useRepositoryStore((s) => s.issuesError)
  const analyzeRepo = useRepositoryStore((s) => s.analyzeRepo)
  const loadRecommendedIssues = useRepositoryStore(
    (s) => s.loadRecommendedIssues,
  )
  const currentOwner = useRepositoryStore((s) => s.currentOwner)
  const currentRepoName = useRepositoryStore((s) => s.currentRepoName)
  const activeContributionIssue = useRepositoryStore((s) => s.activeContributionIssue)
  const currentExplain = useRepositoryStore((s) => s.currentExplain)
  const explainStatus = useRepositoryStore((s) => s.explainStatus)
  const explainError = useRepositoryStore((s) => s.explainError)
  const explainIssue = useRepositoryStore((s) => s.explainIssue)

  // 输入框初始值从 store 读取（支持页面切换和刷新后保持）
  const [repoInput, setRepoInput] = useState(
    currentOwner && currentRepoName ? `${currentOwner}/${currentRepoName}` : '',
  )

  // 首次访问引导（localStorage 记录，关闭后不再显示）
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try {
      return !localStorage.getItem('opensource-mentor:onboarding-done')
    } catch {
      return true
    }
  })

  // 关闭引导
  const handleDismissOnboarding = () => {
    setShowOnboarding(false)
    try {
      localStorage.setItem('opensource-mentor:onboarding-done', 'true')
    } catch {
      // ignore
    }
  }

  // 是否正在加载（分析或 Issue 任一在加载）
  const isIssueMode = Boolean(activeContributionIssue)
  const isLoading = isIssueMode
    ? analysisStatus === 'loading'
    : analysisStatus === 'loading' || issuesStatus === 'loading'

  // 是否已完成分析（分析和 Issue 都成功）
  const hasAnalyzed =
    analysisStatus === 'success' &&
    (isIssueMode || issuesStatus === 'success') &&
    analysis !== null

  // 是否有错误
  const hasError = analysisStatus === 'error' || issuesStatus === 'error'
  const errorMessage = analysisError || issuesError || ''

  // 推荐 Issue 列表（取前 5 个用于展示）
  const displayIssues = useMemo(
    () => recommendedIssues.slice(0, 5),
    [recommendedIssues],
  )

  // 页面加载时：如果还没分析过，自动触发当前仓库分析
  // 如果已有分析结果（用户切换页面后回来），则保留现有状态不重新加载
  useEffect(() => {
    if (activeContributionIssue) {
      const { owner, name } = activeContributionIssue.repository
      setRepoInput(`${owner}/${name}`)
      if (analysisStatus === 'idle') {
        analyzeRepo(owner, name)
      }
      if (explainStatus === 'idle') {
        explainIssue(owner, name, activeContributionIssue)
      }
      return
    }

    if (analysisStatus === 'idle' && currentOwner && currentRepoName) {
      analyzeRepo(currentOwner, currentRepoName)
      loadRecommendedIssues(currentOwner, currentRepoName, { perPage: 10 })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeContributionIssue])

  /**
   * 处理分析按钮点击
   */
  const handleAnalyze = async () => {
    const parsed = parseRepoInput(repoInput)
    if (!parsed) {
      showToast(
        'error',
        '输入格式错误',
        '请输入 GitHub 仓库链接，或 owner/repo 格式',
      )
      return
    }

    try {
      await Promise.all([
        analyzeRepo(parsed.owner, parsed.name),
        loadRecommendedIssues(parsed.owner, parsed.name, { perPage: 10 }),
      ])

      const latest = useRepositoryStore.getState()
      if (
        latest.analysisStatus === 'error' ||
        latest.issuesStatus === 'error'
      ) {
        showToast(
          'error',
          '分析失败',
          latest.analysisError ||
            latest.issuesError ||
            '仓库分析失败，请稍后重试',
        )
      } else {
        showToast('success', '分析完成', `已完成对 ${repoInput} 的仓库分析`)
      }
    } catch {
      showToast('error', '分析失败', '仓库分析失败，请稍后重试')
    }
  }

  /**
   * 处理重新分析
   */
  const handleReanalyze = () => {
    handleAnalyze()
  }

  // 输入框前缀恒为 github.com/，粘贴完整链接时把它剥掉，保证前缀名副其实
  const handleRepoInputChange = (raw: string) => {
    setRepoInput(
      raw.replace(/^\s*(?:https?:\/\/)?(?:www\.)?github\.com\//i, '').trimStart(),
    )
  }

  // 仓库显示名称（优先用 store 中的 currentRepo，回退到输入值）
  const displayRepoName =
    currentRepo?.name || (parseRepoInput(repoInput)?.name ?? '')
  const displayRepoOwner =
    currentRepo?.owner || (parseRepoInput(repoInput)?.owner ?? '')
  const displayFullName = currentRepo?.fullName || repoInput
  const issueAnalysis = activeContributionIssue?.analysis
  const issueTechParts = issueAnalysis?.technologies?.length
    ? issueAnalysis.technologies
    : activeContributionIssue?.language
      ? [activeContributionIssue.language]
      : currentRepo?.language
        ? [currentRepo.language]
        : []
  const issueMetaParts = [
    localizeIssueDifficulty(issueAnalysis?.difficulty),
    localizeEstimatedTime(issueAnalysis?.estimatedTime),
  ].filter((part): part is string => Boolean(part))
  const confirmedContext = currentExplain?.confirmedContext?.length
    ? currentExplain.confirmedContext
    : [
        `已确认仓库：${displayFullName}`,
        activeContributionIssue
          ? `已确认 Issue：#${activeContributionIssue.issueNumber} ${activeContributionIssue.title}`
          : '已确认当前仓库基础信息。',
        currentRepo?.language
          ? `已确认主要语言：${currentRepo.language}`
          : '主要语言仍在等待仓库信息返回。',
      ]
  const possibleAreasToInspect = currentExplain?.possibleAreasToInspect?.length
    ? currentExplain.possibleAreasToInspect
    : [
        '建议先阅读 README、贡献指南和开发环境说明。',
        '根据 Issue 描述中的关键词，在仓库中搜索相关功能、文档或测试。',
        '如果无法定位代码，先在 Issue 下向维护者确认建议修改范围。',
      ]

  const handleStartLearning = () => {
    navigate('/roadmap')
  }

  // 新手友好度：分段仪表的取值与语气
  const friendliness = analysis?.beginnerFriendliness
  const friendlinessTone = analysis
    ? deriveDifficulty(analysis) === 'easy'
      ? 'good'
      : deriveDifficulty(analysis) === 'medium'
        ? 'brand'
        : 'hard'
    : 'brand'
  const contributionAreas = analysis?.contributionAreas ?? []
  const coreTech = analysis?.techStack?.coreTechnologies ?? []

  // 分析过程的三条日志：真实反映两个请求的状态
  const metadataState: LogState = analysisStatus === 'loading' ? 'running' : 'done'
  const architectureState: LogState =
    analysisStatus === 'success'
      ? 'done'
      : analysisStatus === 'error'
        ? 'failed'
        : analysisStatus === 'loading'
          ? 'running'
          : 'pending'
  const thirdStatus = isIssueMode ? explainStatus : issuesStatus
  const thirdState: LogState =
    thirdStatus === 'success'
      ? 'done'
      : thirdStatus === 'error'
        ? 'failed'
        : thirdStatus === 'loading'
          ? 'running'
          : 'pending'

  const analysisSectionIndex = isIssueMode ? '02' : '01'

  return (
    <AppLayout breadcrumbs={[{ label: '仓库分析' }]}>
      <div className="app-page active dash">
        {/* ---------- 页头：页面身份 + 仓库输入 ---------- */}
        <header className="dash-masthead">
          <div className="dash-masthead-text">
            <span className="osm-kicker">
              <span className="osm-kicker-dot" />
              Repository Analysis
            </span>
            <h1 className="dash-title">仓库分析</h1>
            <p className="dash-lede">
              {isIssueMode
                ? '围绕你选择的 Issue 理解仓库、任务背景和下一步思路。'
                : '输入一个 GitHub 仓库，先把它读懂，再决定从哪里下手。'}
            </p>
          </div>

          <div className="dash-masthead-tools">
            {isIssueMode ? (
              <div className="osm-note osm-note-brand">
                <InfoIcon />
                <span>
                  已按当前 Issue 锁定仓库 <code>{displayFullName}</code>
                  ，切换 Issue 即可分析其它仓库。
                </span>
              </div>
            ) : (
              <>
                <div className="osm-cmd">
                  <span className="osm-cmd-prefix">github.com/</span>
                  <input
                    className="osm-cmd-input"
                    type="text"
                    value={repoInput}
                    onChange={(e) => handleRepoInputChange(e.target.value)}
                    placeholder="owner/repo"
                    spellCheck={false}
                    aria-label="GitHub 仓库"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAnalyze()
                    }}
                  />
                  <Button
                    variant="primary"
                    loading={isLoading}
                    onClick={hasAnalyzed ? handleReanalyze : handleAnalyze}
                    icon={hasAnalyzed ? <RefreshIcon /> : <ZapIcon />}
                  >
                    {hasAnalyzed ? '重新分析' : '分析'}
                  </Button>
                </div>
                <p className="dash-tool-hint">
                  支持完整链接或 <code>owner/repo</code>，回车即可开始
                </p>
              </>
            )}
          </div>
        </header>

        {/* ---------- 分析对象：仓库本体 ---------- */}
        <div className="dash-subject osm-panel">
          {currentRepo ? (
            <div className="osm-repo">
              <span className="osm-repo-mark">
                <CodeIcon />
              </span>
              <div className="osm-repo-main">
                <div className="osm-repo-path">
                  <span className="osm-repo-owner">{displayRepoOwner}</span>
                  <span className="osm-repo-sep">/</span>
                  <span className="osm-repo-name">{displayRepoName}</span>
                </div>
                {currentRepo.description && (
                  <p className="osm-repo-desc">{currentRepo.description}</p>
                )}
                <div className="osm-repo-stats">
                  <RepoStat
                    icon={<StarIcon />}
                    value={formatCount(currentRepo.stars)}
                    label="stars"
                  />
                  <RepoStat
                    icon={<GitForkIcon />}
                    value={formatCount(currentRepo.forks)}
                    label="forks"
                  />
                  <RepoStat
                    icon={<IssueIcon />}
                    value={formatCount(currentRepo.issuesCount)}
                    label="open issues"
                  />
                  {currentRepo.language && (
                    <RepoStat icon={<CodeIcon />} value={currentRepo.language} />
                  )}
                  {currentRepo.defaultBranch && (
                    <RepoStat
                      icon={<BranchIcon />}
                      value={currentRepo.defaultBranch}
                    />
                  )}
                </div>
              </div>
              <div className="osm-repo-side">
                <Button
                  variant="secondary"
                  icon={<ExternalIcon />}
                  onClick={() =>
                    window.open(
                      currentRepo.htmlUrl ||
                        `https://github.com/${currentRepo.fullName}`,
                      '_blank',
                      'noopener,noreferrer',
                    )
                  }
                >
                  在 GitHub 查看
                </Button>
              </div>
            </div>
          ) : hasError ? (
            <div className="osm-repo dash-subject-error">
              <span className="osm-repo-mark">
                <AlertIcon />
              </span>
              <div className="osm-repo-main">
                <div className="dash-subject-error-title">仓库信息加载失败</div>
                <p className="osm-repo-desc">
                  {errorMessage || '请确认仓库地址是否正确，然后重新分析。'}
                </p>
              </div>
            </div>
          ) : isLoading ? (
            <div className="osm-repo" aria-busy="true">
              <span className="osm-skeleton dash-sk-mark" />
              <div className="osm-repo-main">
                <span className="osm-skeleton dash-sk-line dash-sk-w40" />
                <span className="osm-skeleton dash-sk-line dash-sk-w70" />
                <div className="osm-repo-stats">
                  <span className="osm-skeleton dash-sk-chip" />
                  <span className="osm-skeleton dash-sk-chip" />
                  <span className="osm-skeleton dash-sk-chip" />
                </div>
              </div>
            </div>
          ) : (
            <div className="osm-repo dash-subject-error">
              <span className="osm-repo-mark">
                <InfoIcon />
              </span>
              <div className="osm-repo-main">
                <div className="dash-subject-error-title">还没有选择要贡献的 Issue</div>
                <p className="osm-repo-desc">
                  建议先从 Issue 推荐中选定任务，系统会自动分析对应仓库。你也可以在上方手动输入仓库。
                </p>
              </div>
              <div className="osm-repo-side">
                <Button variant="primary" onClick={() => navigate('/issues')}>
                  去选择 Issue
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ---------- 首次使用：上手路径 ---------- */}
        {showOnboarding && !isIssueMode && (
          <section className="dash-flow">
            <SectionRule
              index="00"
              label="上手路径"
              aside={
                <button
                  type="button"
                  className="dash-dismiss"
                  onClick={handleDismissOnboarding}
                >
                  不再显示
                </button>
              }
            />
            <ol className="dash-flow-list">
              {ONBOARDING_FLOW.map((step, index) => (
                <li
                  key={step.title}
                  className={index === 0 ? 'dash-flow-item current' : 'dash-flow-item'}
                >
                  <span className="dash-flow-num">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <strong>{step.title}</strong>
                  <span className="dash-flow-desc">{step.desc}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <div className="osm-split">
          {/* ================= 主列 ================= */}
          <div className="dash-main">
            {/* 当前锁定的 Issue */}
            {activeContributionIssue && (
              <section className="osm-section">
                <SectionRule
                  index="01"
                  label="当前任务"
                  aside={`#${activeContributionIssue.issueNumber}`}
                />
                <div className="osm-panel dash-issue">
                  <div className="dash-issue-head">
                    <div>
                      <h2 className="dash-issue-title">
                        {activeContributionIssue.title}
                      </h2>
                      <div className="dash-issue-meta">
                        <span className="osm-tag osm-tag-brand">
                          {activeContributionIssue.repository.fullName}#
                          {activeContributionIssue.issueNumber}
                        </span>
                        {issueMetaParts.map((part) => (
                          <span key={part} className="osm-tag">
                            {part}
                          </span>
                        ))}
                        {issueTechParts.slice(0, 4).map((tech) => (
                          <span key={tech} className="osm-tag">
                            {tech}
                          </span>
                        ))}
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      icon={<ExternalIcon />}
                      onClick={() =>
                        window.open(
                          activeContributionIssue.issueUrl,
                          '_blank',
                          'noopener,noreferrer',
                        )
                      }
                    >
                      在 GitHub 查看
                    </Button>
                  </div>
                  <div className="dash-issue-foot">
                    开放中 · 评论 {activeContributionIssue.comments} · 更新于{' '}
                    {new Date(
                      activeContributionIssue.updatedAt,
                    ).toLocaleDateString('zh-CN')}
                  </div>
                </div>
              </section>
            )}

            {/* AI 分析 */}
            <section className="osm-section">
              <SectionRule
                index={analysisSectionIndex}
                label={isIssueMode ? '任务分析' : '项目理解'}
                aside={
                  analysis
                    ? `置信度 ${Math.round((analysis.confidence || 0) * 100)}%`
                    : undefined
                }
              />

              {isLoading && !hasAnalyzed ? (
                <div className="osm-log">
                  <LogLine state={metadataState}>读取仓库元数据</LogLine>
                  <LogLine state={architectureState}>分析项目架构与技术栈</LogLine>
                  <LogLine state={thirdState}>
                    {isIssueMode ? '生成当前 Issue 的上下文分析' : '评估难度并筛选推荐 Issue'}
                  </LogLine>
                </div>
              ) : hasError && !analysis ? (
                <AiPageError
                  kicker="ANALYSIS FAILED"
                  title="分析失败"
                  message={errorMessage || '仓库分析失败，请稍后重试'}
                  onRetry={handleReanalyze}
                />
              ) : hasAnalyzed && analysis ? (
                <div className="dash-analysis">
                  <div className="osm-ai">
                    <span className="osm-ai-mark">
                      <PulseIcon />
                      AI 摘要
                    </span>
                    <p className="osm-prose">
                      {isIssueMode && currentExplain
                        ? currentExplain.summary
                        : analysis.overview}
                    </p>
                  </div>

                  {!isIssueMode && coreTech.length > 0 && (
                    <div className="dash-subblock">
                      <h3 className="dash-subtitle">技术栈</h3>
                      <div className="osm-tags">
                        {coreTech.slice(0, 10).map((tech) => (
                          <span key={tech} className="osm-tag">
                            {tech}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {isIssueMode && (
                    <>
                      {explainStatus === 'loading' && (
                        <div className="osm-log">
                          <LogLine state="running">
                            正在生成当前 Issue 的分析
                          </LogLine>
                        </div>
                      )}

                      {currentExplain && (
                        <>
                          <div className="dash-subblock">
                            <h3 className="dash-subtitle">已确认的上下文</h3>
                            <ul className="osm-list osm-list-check">
                              {confirmedContext.map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          </div>

                          <div className="dash-subblock">
                            <h3 className="dash-subtitle">建议的推进步骤</h3>
                            <ol className="osm-list osm-list-ordered">
                              {currentExplain.steps.slice(0, 6).map((step) => (
                                <li key={step}>{step}</li>
                              ))}
                            </ol>
                          </div>

                          <div className="dash-subblock">
                            <h3 className="dash-subtitle">值得排查的位置</h3>
                            <ul className="osm-list osm-list-dash">
                              {possibleAreasToInspect.map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        </>
                      )}

                      {explainStatus === 'error' && (
                        <div className="osm-note osm-note-danger">
                          <AlertIcon />
                          <span>{explainError || '当前 Issue 分析暂时不可用'}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div className="osm-log">
                  <LogLine state="pending">
                    等待开始 — 在上方填入仓库后按回车
                  </LogLine>
                </div>
              )}
            </section>

            {/* 贡献领域 */}
            {!isIssueMode && hasAnalyzed && contributionAreas.length > 0 && (
              <section className="osm-section">
                <SectionRule
                  index="02"
                  label="可以切入的贡献领域"
                  aside={`${contributionAreas.length} 个`}
                />
                <div className="dash-areas">
                  {contributionAreas.slice(0, 6).map((area, index) => (
                    <article key={area.name} className="dash-area">
                      <span className="dash-area-index">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <div className="dash-area-body">
                        <div className="dash-area-head">
                          <h3>{area.name}</h3>
                          <span
                            className={`ai-tag difficulty-${area.difficulty}`}
                          >
                            {getAreaDifficultyLabel(area.difficulty)}
                          </span>
                        </div>
                        {area.description && (
                          <p className="dash-area-desc">{area.description}</p>
                        )}
                        {area.whyGoodForBeginners && (
                          <p className="dash-area-why">
                            {area.whyGoodForBeginners}
                          </p>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {/* 推荐 Issue */}
            {!isIssueMode && hasAnalyzed && (
              <section className="osm-section">
                <SectionRule
                  index={contributionAreas.length > 0 ? '03' : '02'}
                  label="推荐的入门 Issue"
                  aside={`${recommendedIssues.length} 个候选`}
                />
                {displayIssues.length > 0 ? (
                  <>
                    <div className="dash-issue-list">
                      {displayIssues.map((issue) => (
                        <button
                          key={issue.id}
                          type="button"
                          className="dash-issue-row"
                          onClick={() => navigate('/issues')}
                        >
                          <span className="dash-issue-num">#{issue.number}</span>
                          <span className="dash-issue-label">{issue.title}</span>
                          <ArrowRightIcon />
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="dash-more"
                      onClick={() => navigate('/issues')}
                    >
                      查看全部候选 Issue
                      <ArrowRightIcon />
                    </button>
                  </>
                ) : (
                  <div className="osm-note">
                    <InfoIcon />
                    <span>
                      这个仓库暂时没有筛出适合入门的 Issue。可以换一个仓库再试，或到「Issue
                      推荐」按你的画像跨仓库查找。
                    </span>
                  </div>
                )}
              </section>
            )}
          </div>

          {/* ================= 侧栏 ================= */}
          <aside className="osm-rail">
            <div className="osm-panel">
              <div className="osm-panel-head">
                <span className="osm-panel-title">新手友好度</span>
                <span className="osm-panel-aside">AI 评估</span>
              </div>
              <div className="osm-panel-body">
                {analysis && friendliness ? (
                  <Meter
                    score={friendliness.score || 0}
                    verdict={getFriendlyLabel(friendliness.level)}
                    verdictTone={friendlinessTone}
                    foot={
                      <>
                        {isBeginnerFriendly(analysis)
                          ? '适合作为第一个贡献目标'
                          : '上手门槛偏高，建议先熟悉相近项目'}
                        {recommendedIssues.length > 0 && (
                          <>
                            <span className="osm-meter-foot-sep">·</span>
                            {recommendedIssues.length} 个候选 Issue
                          </>
                        )}
                      </>
                    }
                  />
                ) : (
                  <div className="dash-rail-empty">
                    <span className="osm-skeleton dash-sk-line dash-sk-w40" />
                    <span className="osm-skeleton dash-sk-bar" />
                    <span className="osm-skeleton dash-sk-line dash-sk-w70" />
                  </div>
                )}
              </div>
            </div>

            <div className="osm-panel">
              <div className="osm-panel-head">
                <span className="osm-panel-title">项目概况</span>
              </div>
              <div className="osm-panel-body">
                <div className="osm-facts">
                  <div className="osm-fact">
                    <span className="osm-fact-key">
                      <CodeIcon />
                      主要语言
                    </span>
                    <span className="osm-fact-val">
                      {currentRepo?.language || '--'}
                    </span>
                  </div>
                  <div className="osm-fact">
                    <span className="osm-fact-key">
                      <PulseIcon />
                      项目活跃度
                    </span>
                    <span className="osm-fact-val">
                      {analysis ? getActivityLabel(analysis.activity?.level) : '--'}
                    </span>
                  </div>
                  <div className="osm-fact">
                    <span className="osm-fact-key">
                      <BranchIcon />
                      默认分支
                    </span>
                    <span className="osm-fact-val">
                      {currentRepo?.defaultBranch || '--'}
                    </span>
                  </div>
                  <div className="osm-fact">
                    <span className="osm-fact-key">
                      <IssueIcon />
                      开放 Issue
                    </span>
                    <span className="osm-fact-val">
                      {currentRepo ? currentRepo.issuesCount.toLocaleString() : '--'}
                    </span>
                  </div>
                  <div className="osm-fact">
                    <span className="osm-fact-key">
                      <InfoIcon />
                      许可证
                    </span>
                    <span className="osm-fact-val">
                      {currentRepo?.license || '--'}
                    </span>
                  </div>
                </div>

                {analysis?.domains?.length ? (
                  <div className="dash-rail-tags">
                    <span className="osm-kicker">Domains</span>
                    <div className="osm-tags">
                      {analysis.domains.slice(0, 6).map((domain) => (
                        <span key={domain} className="osm-tag">
                          {domain}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {hasAnalyzed && !isIssueMode && (
              <div className="osm-panel">
                <div className="osm-panel-body">
                  <JourneyActions
                    title="仓库已读懂，选择下一步"
                    description="建议先锁定一个 Issue，后续步骤都会围绕它展开。"
                    paths={[
                      {
                        title: '查看推荐 Issue',
                        description: '找到适合你当前水平的入门任务',
                        path: '/issues',
                        primary: true,
                      },
                      {
                        title: '打开贡献指南',
                        description: '需要先锁定一个 Issue 才能生成分章节指南',
                        path: '/roadmap',
                      },
                      {
                        title: '询问 AI 导师',
                        description: '针对仓库结构与贡献流程提问',
                        path: '/ai-mentor',
                      },
                    ]}
                  />
                </div>
              </div>
            )}
          </aside>
        </div>

        {/* ---------- 页脚：下一步 ---------- */}
        {hasAnalyzed && activeContributionIssue && (
          <div className="next-step-card">
            <div className="next-step-content">
              <div className="next-step-badge">下一步</div>
              <div className="next-step-title">开始解决这个 Issue</div>
              <div className="next-step-desc">
                贡献指南会围绕当前 Issue 生成：先理解背景，再拆成可以逐步完成的小任务。
              </div>
            </div>
            <button className="next-step-btn" onClick={handleStartLearning}>
              打开贡献指南
              <ArrowRightIcon />
            </button>
          </div>
        )}

        {hasAnalyzed && !activeContributionIssue && (
          <NextStepCard
            currentStep={2}
            totalSteps={6}
            title="仓库分析完成"
            description="下一步挑一个 Issue 锁定目标，后面的贡献指南、代码审查都会围绕它展开"
            buttonText="查看推荐 Issue"
            nextPath="/issues"
          />
        )}
      </div>
    </AppLayout>
  )
}

export default Dashboard
