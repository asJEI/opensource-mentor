import { useState, useEffect, useMemo } from 'react'
import clsx from 'clsx'
import { AppLayout } from '@/components/layout'
import { Card } from '@/components/ui'
import { useToastStore, useRepositoryStore } from '@/store'
import { NextStepCard } from '@/components/business'
import type { RepoAnalysis, DifficultyLevel } from '@/types'

// ==================== 图标组件 ====================
const CodeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
)

const StarIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
)

const GitForkIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="18" r="3" />
    <circle cx="6" cy="6" r="3" />
    <circle cx="18" cy="6" r="3" />
    <path d="M18 9v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9" />
    <path d="M12 12v3" />
  </svg>
)

const IssueIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
)

const ZapIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
)

const BotIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="8" width="18" height="12" rx="3" />
    <path d="M12 2v4" />
    <circle cx="9" cy="14" r="1" />
    <circle cx="15" cy="14" r="1" />
    <path d="M9 18h6" />
  </svg>
)

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const ArrowUpIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="19" x2="12" y2="5" />
    <polyline points="5 12 12 5 19 12" />
  </svg>
)

const ArrowDownIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <polyline points="19 12 12 19 5 12" />
  </svg>
)

const RefreshIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
)

const InfoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
)

const AlertIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
)

const SparklesIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />
  </svg>
)

// ==================== StatCard 组件 ====================
interface StatCardProps {
  icon: React.ReactNode
  iconClass: string
  label: string
  value: string
  change: string
  changeUp: boolean
}

function StatCard({ icon, iconClass, label, value, change, changeUp }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="stat-label">
        <span className={clsx('stat-label-icon', iconClass)}>{icon}</span>
        {label}
      </div>
      <div className="stat-value">{value}</div>
      <div className={clsx('stat-change', !changeUp && 'down')}>
        {changeUp ? <ArrowUpIcon /> : <ArrowDownIcon />}
        {change}
      </div>
    </div>
  )
}

// ==================== 工具函数 ====================

/**
 * 解析仓库输入字符串，提取 owner 和 name
 * @param input 格式为 "owner/repo" 的字符串
 */
function parseRepoInput(input: string): { owner: string; name: string } | null {
  const trimmed = input.trim()
  const parts = trimmed.split('/')
  if (parts.length === 2 && parts[0] && parts[1]) {
    return { owner: parts[0], name: parts[1] }
  }
  return null
}

/**
 * 从 RepoAnalysis 推导难度等级
 * 根据 beginnerFriendliness 的 level 映射
 */
function deriveDifficulty(analysis: RepoAnalysis): DifficultyLevel {
  const level = analysis.beginnerFriendliness?.level
  if (level === 'very-friendly' || level === 'friendly') return 'easy'
  if (level === 'moderate') return 'medium'
  return 'hard'
}

/**
 * 从 RepoAnalysis 判断是否新手友好
 */
function isBeginnerFriendly(analysis: RepoAnalysis): boolean {
  const level = analysis.beginnerFriendliness?.level
  return level === 'very-friendly' || level === 'friendly' || level === 'moderate'
}

/**
 * 新手友好度等级中文映射
 */
function getFriendlyLabel(level?: string): string {
  const map: Record<string, string> = {
    'very-friendly': '非常友好',
    'friendly': '友好',
    'moderate': '适中',
    'challenging': '有挑战',
    'hard': '较难',
  }
  return map[level || ''] || '未知'
}

// ==================== Dashboard 页面 ====================
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
  const loadRecommendedIssues = useRepositoryStore((s) => s.loadRecommendedIssues)
  const currentOwner = useRepositoryStore((s) => s.currentOwner)
  const currentRepoName = useRepositoryStore((s) => s.currentRepoName)

  // 输入框初始值从 store 读取（支持页面切换和刷新后保持）
  const [repoInput, setRepoInput] = useState(`${currentOwner}/${currentRepoName}`)

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
  const isLoading = analysisStatus === 'loading' || issuesStatus === 'loading'

  // 是否已完成分析（分析和 Issue 都成功）
  const hasAnalyzed = analysisStatus === 'success' && issuesStatus === 'success' && analysis !== null

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
    if (analysisStatus === 'idle') {
      analyzeRepo(currentOwner, currentRepoName)
      loadRecommendedIssues(currentOwner, currentRepoName, { perPage: 10 })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * 处理分析按钮点击
   */
  const handleAnalyze = async () => {
    const parsed = parseRepoInput(repoInput)
    if (!parsed) {
      showToast('error', '输入格式错误', '请输入正确的仓库地址，格式为 owner/repo')
      return
    }

    try {
      await Promise.all([
        analyzeRepo(parsed.owner, parsed.name),
        loadRecommendedIssues(parsed.owner, parsed.name, { perPage: 10 }),
      ])

      if (analysisStatus === 'error' || issuesStatus === 'error') {
        showToast('error', '分析失败', errorMessage || '仓库分析失败，请稍后重试')
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
  const displayRepoName = currentRepo?.name || (parseRepoInput(repoInput)?.name ?? '')
  const displayRepoOwner = currentRepo?.owner || (parseRepoInput(repoInput)?.owner ?? '')
  const displayFullName = currentRepo?.fullName || repoInput

  return (
    <AppLayout breadcrumbs={[{ label: '工作台' }]}>
      <div className="app-page active">
        {/* 页面标题区 */}
        <div className="page-header">
          <div className="page-title-row">
            <div>
              <h1 className="page-title">仓库分析</h1>
              <p className="page-subtitle">输入 GitHub 仓库地址，AI 智能分析项目结构与难度</p>
            </div>
            <div className="repo-pill">
              <CodeIcon />
              {displayFullName}
            </div>
          </div>
        </div>

        {/* 首次使用引导 */}
        {showOnboarding && (
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
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <p className="onboarding-desc">
              只需四步，开启你的开源贡献之旅：
            </p>
            <div className="onboarding-steps">
              <div className="onboarding-step active">
                <div className="step-number">1</div>
                <div className="step-info">
                  <div className="step-title">仓库分析</div>
                  <div className="step-desc">AI 分析项目难度与技术栈</div>
                </div>
              </div>
              <div className="step-arrow">→</div>
              <div className="onboarding-step">
                <div className="step-number">2</div>
                <div className="step-info">
                  <div className="step-title">Issue 推荐</div>
                  <div className="step-desc">匹配最适合你的入门任务</div>
                </div>
              </div>
              <div className="step-arrow">→</div>
              <div className="onboarding-step">
                <div className="step-number">3</div>
                <div className="step-info">
                  <div className="step-title">代码审查</div>
                  <div className="step-desc">AI 导师帮你检查代码质量</div>
                </div>
              </div>
              <div className="step-arrow">→</div>
              <div className="onboarding-step">
                <div className="step-number">4</div>
                <div className="step-info">
                  <div className="step-title">学习路线</div>
                  <div className="step-desc">系统提升开源贡献能力</div>
                </div>
              </div>
            </div>
            <div className="onboarding-tip">
              <InfoIcon />
              <span>当前正在为你分析示例仓库 <strong>{displayFullName}</strong>，稍等片刻即可开始探索～</span>
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
            change={currentRepo ? `Forks ${currentRepo.forks.toLocaleString()}` : '等待分析'}
            changeUp={true}
          />
          <StatCard
            icon={<IssueIcon />}
            iconClass="green"
            label="推荐 Issue"
            value={recommendedIssues.length > 0 ? String(recommendedIssues.length) : '--'}
            change={analysis ? `匹配度 ${Math.round((analysis.confidence || 0) * 100)}%` : 'AI 智能匹配'}
            changeUp={true}
          />
          <StatCard
            icon={<SparklesIcon />}
            iconClass="purple"
            label="新手友好度"
            value={analysis ? getFriendlyLabel(analysis.beginnerFriendliness?.level) : '--'}
            change={analysis ? `评分 ${analysis.beginnerFriendliness?.score || 0}/10` : 'AI 评估中'}
            changeUp={true}
          />
          <StatCard
            icon={<ZapIcon />}
            iconClass="blue"
            label="贡献领域"
            value={analysis?.contributionAreas?.length ? String(analysis.contributionAreas.length) : '--'}
            change={analysis?.domains?.length ? `${analysis.domains.slice(0, 2).join('、')}${analysis.domains.length > 2 ? '等' : ''}` : '分析中...'}
            changeUp={true}
          />
        </div>

        {/* 分析网格 */}
        <div className="analysis-grid">
          {/* 左侧：仓库信息卡 */}
          <Card
            title="仓库信息"
            icon={<CodeIcon />}
            className="repo-info-card"
          >
            {/* 加载骨架屏 */}
            {isLoading && !currentRepo && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--border)' }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ width: '60%', height: '16px', borderRadius: '4px', background: 'var(--border)' }} />
                    <div style={{ width: '40%', height: '12px', borderRadius: '4px', background: 'var(--border)' }} />
                  </div>
                </div>
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ width: '80px', height: '14px', borderRadius: '4px', background: 'var(--border)' }} />
                    <div style={{ width: '60px', height: '14px', borderRadius: '4px', background: 'var(--border)' }} />
                  </div>
                ))}
                <div style={{ height: '40px', borderRadius: '8px', background: 'var(--border)', marginTop: '8px' }} />
              </div>
            )}

            {/* 错误状态 */}
            {hasError && !currentRepo && (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--muted)' }}>
                <AlertIcon />
                <div style={{ marginTop: '8px', fontWeight: 500, color: 'var(--red)' }}>加载失败</div>
                <div style={{ fontSize: '13px', marginTop: '4px' }}>{errorMessage}</div>
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
                    <div className="repo-owner">
                      {displayRepoOwner}
                    </div>
                  </div>
                </div>

                <div className="repo-stats">
                  <div className="repo-stat-row">
                    <span className="repo-stat-label">
                      <StarIcon />
                      Stars
                    </span>
                    <span className="repo-stat-value">{currentRepo.stars.toLocaleString()}</span>
                  </div>
                  <div className="repo-stat-row">
                    <span className="repo-stat-label">
                      <GitForkIcon />
                      Forks
                    </span>
                    <span className="repo-stat-value">{currentRepo.forks.toLocaleString()}</span>
                  </div>
                  <div className="repo-stat-row">
                    <span className="repo-stat-label">
                      <IssueIcon />
                      Issues
                    </span>
                    <span className="repo-stat-value">{currentRepo.issuesCount.toLocaleString()}</span>
                  </div>
                  <div className="repo-stat-row">
                    <span className="repo-stat-label">
                      <CodeIcon />
                      语言
                    </span>
                    <span className="repo-stat-value">{currentRepo.language}</span>
                  </div>
                </div>
              </>
            )}

            {/* 仓库输入框 + 分析按钮 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: currentRepo ? '0' : '16px' }}>
              <input
                type="text"
                className="form-input"
                value={repoInput}
                onChange={(e) => setRepoInput(e.target.value)}
                placeholder="owner/repo"
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
                <div className="ai-loading-desc">AI 正在深入分析项目结构和代码</div>
                <div className="ai-loading-steps">
                  <div className={clsx('ai-loading-step', analysisStatus !== 'loading' ? 'done' : 'active')}>
                    {analysisStatus !== 'loading' ? <CheckIcon /> : <span className="step-spinner" />}
                    获取仓库基本信息
                  </div>
                  <div className={clsx('ai-loading-step', analysisStatus === 'success' ? 'done' : analysisStatus === 'loading' ? 'active' : '')}>
                    {analysisStatus === 'success' ? <CheckIcon /> : analysisStatus === 'loading' ? <span className="step-spinner" /> : <InfoIcon />}
                    分析项目架构与技术栈
                  </div>
                  <div className={clsx('ai-loading-step', issuesStatus === 'success' ? 'done' : issuesStatus === 'loading' ? 'active' : '')}>
                    {issuesStatus === 'success' ? <CheckIcon /> : issuesStatus === 'loading' ? <span className="step-spinner" /> : <InfoIcon />}
                    评估难度与推荐 Issue
                  </div>
                </div>
              </div>
            ) : hasError && !analysis ? (
              <div className="ai-loading active" style={{ alignItems: 'center' }}>
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: 'var(--red-soft)',
                    color: 'var(--red)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '16px',
                  }}
                >
                  <AlertIcon />
                </div>
                <div className="ai-loading-title">分析失败</div>
                <div className="ai-loading-desc">{errorMessage}</div>
                <button
                  className="analyze-btn"
                  style={{ marginTop: '16px', width: 'auto' }}
                  onClick={handleReanalyze}
                >
                  <RefreshIcon />
                  重试
                </button>
              </div>
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
                      style={{ color: isBeginnerFriendly(analysis) ? 'var(--green)' : 'var(--red)' }}
                    >
                      {isBeginnerFriendly(analysis) ? '是' : '否'}
                    </div>
                  </div>
                  <div className="ai-metric">
                    <div className="ai-metric-label">推荐 Issue</div>
                    <div className="ai-metric-value" style={{ color: 'var(--accent)' }}>
                      {recommendedIssues.length} 个
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: '12px', fontSize: '14px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <SparklesIcon />
                  推荐入门 Issue
                </div>
                <div className="suggested-issues-list">
                  {displayIssues.length > 0 ? (
                    displayIssues.map((issue, i) => (
                      <div key={i} className="suggested-issue">
                        <div className="suggested-issue-icon">
                          <CheckIcon />
                        </div>
                        <span className="suggested-issue-text">{issue}</span>
                      </div>
                    ))
                  ) : (
                    <div style={{ color: 'var(--muted)', fontSize: '13px', padding: '8px 0' }}>
                      暂无推荐 Issue
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="ai-loading active">
                <div className="ai-loading-spinner" />
                <div className="ai-loading-title">准备开始分析</div>
                <div className="ai-loading-desc">输入仓库地址，点击开始分析</div>
              </div>
            )}
          </Card>
        </div>

        {/* 下一步引导：分析完成后引导去 Issue 推荐 */}
        {hasAnalyzed && (
          <NextStepCard
            currentStep={1}
            totalSteps={4}
            title="仓库分析完成！"
            description="AI 已为你分析完仓库，下一步看看为你推荐了哪些适合新手的 Issue"
            buttonText="查看推荐 Issue"
            nextPath="/issues"
          />
        )}
      </div>
    </AppLayout>
  )
}

export default Dashboard
