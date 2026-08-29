import { useState, useEffect, useMemo } from 'react'
import clsx from 'clsx'
import { AppLayout } from '@/components/layout'
import { Button, Card } from '@/components/ui'
import { useToastStore, useRepositoryStore } from '@/store'
import {
  NextStepCard,
  JourneyActions,
  AiPageError,
} from '@/components/business'
import {
  AlertIcon,
  BotIcon,
  CheckIcon,
  CodeIcon,
  GitForkIcon,
  InfoIcon,
  IssueIcon,
  RefreshIcon,
  SparklesIcon,
  StarIcon,
  StatCard,
  ZapIcon,
  deriveDifficulty,
  getFriendlyLabel,
  isBeginnerFriendly,
  parseRepoInput,
} from './components'
import type { CandidateIssue } from '@/types'

const Dashboard = () => {
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
    `${currentOwner}/${currentRepoName}`,
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

  // 推荐 Issue 列表（取前 4 个用于展示）
  const displayIssues = useMemo(() => {
    return recommendedIssues.slice(0, 4).map((issue) => issue.title)
  }, [recommendedIssues])

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

    if (analysisStatus === 'idle') {
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

  // 仓库显示名称（优先用 store 中的 currentRepo，回退到输入值）
  const displayRepoName =
    currentRepo?.name || (parseRepoInput(repoInput)?.name ?? '')
  const displayRepoOwner =
    currentRepo?.owner || (parseRepoInput(repoInput)?.owner ?? '')
  const displayFullName = currentRepo?.fullName || repoInput

  return (
    <AppLayout breadcrumbs={[{ label: '仓库分析' }]}>
      <div className="app-page active">
        {/* 页面标题区 */}
        <div className="page-header">
          <div className="page-title-row">
            <div>
              <h1 className="page-title">仓库分析</h1>
              <p className="page-subtitle">
                {activeContributionIssue
                  ? '围绕你选择的 Issue 理解仓库、任务背景和下一步思路'
                  : '输入 GitHub 仓库地址，AI 智能分析项目结构与难度'}
              </p>
            </div>
            <div className="repo-pill">
              <CodeIcon />
              {displayFullName}
            </div>
          </div>
        </div>

        {activeContributionIssue && (
          <section className="selected-issue-panel">
            <div className="selected-issue-header">
              <div>
                <h3>当前 Issue</h3>
                <h2 className="selected-issue-title">
                  {activeContributionIssue.repository.fullName}#
                  {activeContributionIssue.issueNumber} ·{' '}
                  {activeContributionIssue.title}
                </h2>
              </div>
              <Button
                variant="secondary"
                onClick={() => window.open(activeContributionIssue.issueUrl, '_blank', 'noopener,noreferrer')}
              >
                在 GitHub 查看
              </Button>
            </div>
            <div className="selected-issue-grid">
              <div>
                <h3>Issue 基本信息</h3>
                <p>
                  Open · 评论 {activeContributionIssue.comments} · 更新于{' '}
                  {new Date(activeContributionIssue.updatedAt).toLocaleDateString('zh-CN')}
                </p>
              </div>
              <div>
                <h3>技术栈</h3>
                <p>{activeContributionIssue.language || currentRepo?.language || '后续补充'}</p>
              </div>
              <div>
                <h3>标签</h3>
                <p>
                  {activeContributionIssue.labels.map((label: CandidateIssue['labels'][number]) => label.name).join('、') ||
                    '无标签'}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* 首次使用引导 */}
        {showOnboarding && !activeContributionIssue && (
          <div className="onboarding-card">
            <div className="onboarding-header">
              <div className="onboarding-title">
                <SparklesIcon />
                欢迎使用 Open Source Mentor！
              </div>
              <button
                className="onboarding-close"
                onClick={handleDismissOnboarding}
                title="关闭引导"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <p className="onboarding-desc">
              从理解一个陌生仓库，到完成你的第一次 Open Source Contribution：
            </p>
            <div className="onboarding-steps">
              <div className="onboarding-step active">
                <div className="step-number">1</div>
                <div className="step-info">
                  <div className="step-title">选择仓库</div>
                  <div className="step-desc">输入 GitHub 地址并分析</div>
                </div>
              </div>
              <div className="step-arrow">→</div>
              <div className="onboarding-step">
                <div className="step-number">2</div>
                <div className="step-info">
                  <div className="step-title">找适合 Issue</div>
                  <div className="step-desc">匹配适合你的入门任务</div>
                </div>
              </div>
              <div className="step-arrow">→</div>
              <div className="onboarding-step">
                <div className="step-number">3</div>
                <div className="step-info">
                  <div className="step-title">学习与 Mentoring</div>
                  <div className="step-desc">路线图 + AI 导师陪跑</div>
                </div>
              </div>
              <div className="step-arrow">→</div>
              <div className="onboarding-step">
                <div className="step-number">4</div>
                <div className="step-info">
                  <div className="step-title">Review 与 PR</div>
                  <div className="step-desc">审查代码并生成 PR 草稿</div>
                </div>
              </div>
            </div>
            <div className="onboarding-tip">
              <InfoIcon />
              <span>
                无需登录即可开始。当前示例仓库为{' '}
                <strong>{displayFullName}</strong>
                ，也可在下方换成你感兴趣的仓库。
              </span>
            </div>
          </div>
        )}

        {/* 统计行 */}
        <div className="stat-row">
          <StatCard
            icon={<StarIcon />}
            iconClass="yellow"
            label="GitHub Stars"
            value={currentRepo ? currentRepo.stars.toLocaleString() : '--'}
            change={
              currentRepo
                ? `Forks ${currentRepo.forks.toLocaleString()}`
                : '等待分析'
            }
            changeUp={true}
          />
          <StatCard
            icon={<IssueIcon />}
            iconClass="green"
            label="推荐 Issue"
            value={
              recommendedIssues.length > 0
                ? String(recommendedIssues.length)
                : '--'
            }
            change={
              analysis
                ? `匹配度 ${Math.round((analysis.confidence || 0) * 100)}%`
                : 'AI 智能匹配'
            }
            changeUp={true}
          />
          <StatCard
            icon={<SparklesIcon />}
            iconClass="purple"
            label="新手友好度"
            value={
              analysis
                ? getFriendlyLabel(analysis.beginnerFriendliness?.level)
                : '--'
            }
            change={
              analysis
                ? `评分 ${analysis.beginnerFriendliness?.score || 0}/10`
                : 'AI 评估中'
            }
            changeUp={true}
          />
          <StatCard
            icon={<ZapIcon />}
            iconClass="blue"
            label="贡献领域"
            value={
              analysis?.contributionAreas?.length
                ? String(analysis.contributionAreas.length)
                : '--'
            }
            change={
              analysis?.domains?.length
                ? `${analysis.domains.slice(0, 2).join('、')}${analysis.domains.length > 2 ? '等' : ''}`
                : '分析中...'
            }
            changeUp={true}
          />
        </div>

        {/* 分析网格 */}
        <div className="analysis-grid">
          {/* 左侧：仓库信息卡 */}
          <Card title="仓库信息" icon={<CodeIcon />} className="repo-info-card">
            {/* 加载骨架屏 */}
            {isLoading && !currentRepo && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                <div
                  style={{ display: 'flex', gap: '12px', alignItems: 'center' }}
                >
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '12px',
                      background: 'var(--border)',
                    }}
                  />
                  <div
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    <div
                      style={{
                        width: '60%',
                        height: '16px',
                        borderRadius: '4px',
                        background: 'var(--border)',
                      }}
                    />
                    <div
                      style={{
                        width: '40%',
                        height: '12px',
                        borderRadius: '4px',
                        background: 'var(--border)',
                      }}
                    />
                  </div>
                </div>
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    style={{ display: 'flex', justifyContent: 'space-between' }}
                  >
                    <div
                      style={{
                        width: '80px',
                        height: '14px',
                        borderRadius: '4px',
                        background: 'var(--border)',
                      }}
                    />
                    <div
                      style={{
                        width: '60px',
                        height: '14px',
                        borderRadius: '4px',
                        background: 'var(--border)',
                      }}
                    />
                  </div>
                ))}
                <div
                  style={{
                    height: '40px',
                    borderRadius: '8px',
                    background: 'var(--border)',
                    marginTop: '8px',
                  }}
                />
              </div>
            )}

            {/* 错误状态 */}
            {hasError && !currentRepo && (
              <div
                style={{
                  textAlign: 'center',
                  padding: '24px 0',
                  color: 'var(--muted)',
                }}
              >
                <AlertIcon />
                <div
                  style={{
                    marginTop: '8px',
                    fontWeight: 500,
                    color: 'var(--red)',
                  }}
                >
                  加载失败
                </div>
                <div style={{ fontSize: '13px', marginTop: '4px' }}>
                  {errorMessage}
                </div>
              </div>
            )}

            {/* 仓库信息内容 */}
            {currentRepo && (
              <>
                <div className="repo-info-header">
                  <div className="repo-icon">
                    <CodeIcon />
                  </div>
                  <div>
                    <div className="repo-name">{displayRepoName}</div>
                    <div className="repo-owner">{displayRepoOwner}</div>
                  </div>
                </div>

                <div className="repo-stats">
                  <div className="repo-stat-row">
                    <span className="repo-stat-label">
                      <StarIcon />
                      Stars
                    </span>
                    <span className="repo-stat-value">
                      {currentRepo.stars.toLocaleString()}
                    </span>
                  </div>
                  <div className="repo-stat-row">
                    <span className="repo-stat-label">
                      <GitForkIcon />
                      Forks
                    </span>
                    <span className="repo-stat-value">
                      {currentRepo.forks.toLocaleString()}
                    </span>
                  </div>
                  <div className="repo-stat-row">
                    <span className="repo-stat-label">
                      <IssueIcon />
                      Issues
                    </span>
                    <span className="repo-stat-value">
                      {currentRepo.issuesCount.toLocaleString()}
                    </span>
                  </div>
                  <div className="repo-stat-row">
                    <span className="repo-stat-label">
                      <CodeIcon />
                      语言
                    </span>
                    <span className="repo-stat-value">
                      {currentRepo.language}
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* 仓库输入框 + 分析按钮 */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                marginTop: currentRepo ? '0' : '16px',
              }}
            >
              {activeContributionIssue ? (
                <div className="profile-default-notice">
                  已根据当前 Issue 自动选择仓库：{activeContributionIssue.repository.fullName}
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    className="form-input"
                    value={repoInput}
                    onChange={(e) => setRepoInput(e.target.value)}
                    placeholder="https://github.com/owner/repo"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleAnalyze()
                      }
                    }}
                  />
                  <button
                    className="analyze-btn"
                    onClick={hasAnalyzed ? handleReanalyze : handleAnalyze}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <span className="btn-spinner" />
                        分析中...
                      </>
                    ) : hasAnalyzed ? (
                      <>
                        <RefreshIcon />
                        重新分析
                      </>
                    ) : (
                      <>
                        <ZapIcon />
                        开始分析
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </Card>

          {/* 右侧：AI 摘要卡 */}
          <Card
            title="AI 分析摘要"
            icon={<BotIcon />}
            className="ai-summary-card"
          >
            {isLoading && !hasAnalyzed ? (
              <div className="ai-loading active">
                <div className="ai-loading-spinner" />
                <div className="ai-loading-title">正在分析仓库...</div>
                <div className="ai-loading-desc">
                  AI 正在深入分析项目结构和代码
                </div>
                <div className="ai-loading-steps">
                  <div
                    className={clsx(
                      'ai-loading-step',
                      analysisStatus !== 'loading' ? 'done' : 'active',
                    )}
                  >
                    {analysisStatus !== 'loading' ? (
                      <CheckIcon />
                    ) : (
                      <span className="step-spinner" />
                    )}
                    获取仓库基本信息
                  </div>
                  <div
                    className={clsx(
                      'ai-loading-step',
                      analysisStatus === 'success'
                        ? 'done'
                        : analysisStatus === 'loading'
                          ? 'active'
                          : '',
                    )}
                  >
                    {analysisStatus === 'success' ? (
                      <CheckIcon />
                    ) : analysisStatus === 'loading' ? (
                      <span className="step-spinner" />
                    ) : (
                      <InfoIcon />
                    )}
                    分析项目架构与技术栈
                  </div>
                  <div
                    className={clsx(
                      'ai-loading-step',
                      issuesStatus === 'success'
                        ? 'done'
                        : issuesStatus === 'loading'
                          ? 'active'
                          : '',
                    )}
                  >
                    {issuesStatus === 'success' ? (
                      <CheckIcon />
                    ) : issuesStatus === 'loading' ? (
                      <span className="step-spinner" />
                    ) : (
                      <InfoIcon />
                    )}
                    评估难度与推荐 Issue
                  </div>
                </div>
              </div>
            ) : hasError && !analysis ? (
              <AiPageError
                className="ai-loading active"
                title="分析失败"
                message={errorMessage || '仓库分析失败，请稍后重试'}
                onRetry={handleReanalyze}
              />
            ) : hasAnalyzed && analysis ? (
              <div className="ai-content active">
                <div className="ai-summary-text">
                  <strong>AI 摘要：</strong> {analysis.overview}
                </div>

                <div className="ai-metrics-row">
                  <div className="ai-metric">
                    <div className="ai-metric-label">项目难度</div>
                    <div
                      className="ai-metric-value"
                      style={{
                        color:
                          deriveDifficulty(analysis) === 'easy'
                            ? 'var(--green)'
                            : deriveDifficulty(analysis) === 'medium'
                              ? 'var(--yellow)'
                              : 'var(--red)',
                      }}
                    >
                      {deriveDifficulty(analysis) === 'easy'
                        ? '简单'
                        : deriveDifficulty(analysis) === 'medium'
                          ? '中等'
                          : '困难'}
                    </div>
                  </div>
                  <div className="ai-metric">
                    <div className="ai-metric-label">新手友好</div>
                    <div
                      className="ai-metric-value"
                      style={{
                        color: isBeginnerFriendly(analysis)
                          ? 'var(--green)'
                          : 'var(--red)',
                      }}
                    >
                      {isBeginnerFriendly(analysis) ? '是' : '否'}
                    </div>
                  </div>
                  <div className="ai-metric">
                    <div className="ai-metric-label">推荐 Issue</div>
                    <div
                      className="ai-metric-value"
                      style={{ color: 'var(--accent)' }}
                    >
                      {recommendedIssues.length} 个
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    marginBottom: '12px',
                    fontSize: '14px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <SparklesIcon />
                  推荐入门 Issue
                </div>
                <div className="suggested-issues-list">
                  {activeContributionIssue ? (
                    <>
                      <div className="suggested-issue">
                        <div className="suggested-issue-icon">
                          <CheckIcon />
                        </div>
                        <span className="suggested-issue-text">
                          当前任务：{activeContributionIssue.title}
                        </span>
                      </div>
                      {explainStatus === 'loading' && (
                        <div className="suggested-issue">
                          <div className="suggested-issue-icon">
                            <span className="step-spinner" />
                          </div>
                          <span className="suggested-issue-text">
                            正在生成当前 Issue 简要分析…
                          </span>
                        </div>
                      )}
                      {currentExplain && (
                        <>
                          <div className="ai-summary-text">
                            <strong>AI 对当前 Issue 的简要分析：</strong>{' '}
                            {currentExplain.summary}
                          </div>
                          <div
                            style={{
                              marginTop: 14,
                              fontSize: 14,
                              fontWeight: 600,
                            }}
                          >
                            Suggested Approach
                          </div>
                          <ol className="suggested-approach-list">
                            {currentExplain.steps.slice(0, 5).map((step) => (
                              <li key={step}>{step}</li>
                            ))}
                          </ol>
                        </>
                      )}
                      {explainStatus === 'error' && (
                        <div className="profile-default-notice">
                          {explainError || '当前 Issue 简要分析暂时不可用'}
                        </div>
                      )}
                    </>
                  ) : displayIssues.length > 0 ? (
                    displayIssues.map((issue, i) => (
                      <div key={i} className="suggested-issue">
                        <div className="suggested-issue-icon">
                          <CheckIcon />
                        </div>
                        <span className="suggested-issue-text">{issue}</span>
                      </div>
                    ))
                  ) : (
                    <div
                      style={{
                        color: 'var(--muted)',
                        fontSize: '13px',
                        padding: '8px 0',
                      }}
                    >
                      暂无推荐 Issue
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="ai-loading active">
                <div className="ai-loading-spinner" />
                <div className="ai-loading-title">准备开始分析</div>
                <div className="ai-loading-desc">
                  输入仓库地址，点击开始分析
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* 分析完成后的连续路径引导 */}
        {hasAnalyzed && (
          <>
            <JourneyActions
              title="仓库已理解，选择下一步"
              description="推荐先从适合的 Issue 开始，也可以先看学习路线或直接问 AI Mentor。"
              paths={[
                {
                  title: '查看推荐 Issue',
                  description: '找到适合你当前水平的入门任务',
                  path: '/issues',
                  primary: true,
                },
                {
                  title: '生成学习路线',
                  description: '按阶段规划这次贡献要学什么',
                  path: '/roadmap',
                },
                {
                  title: '询问 AI Mentor',
                  description: '针对仓库结构与贡献流程提问',
                  path: '/ai-mentor',
                },
              ]}
            />
            <NextStepCard
              currentStep={1}
              totalSteps={6}
              title="仓库分析完成！"
              description="下一步查看 AI 为你推荐的适合 Issue"
              buttonText="查看推荐 Issue"
              nextPath="/issues"
            />
          </>
        )}
      </div>
    </AppLayout>
  )
}

export default Dashboard
