import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { AppLayout } from '@/components/layout'
import { IssueRow, IssueExplainModal, NextStepCard, AiPageError } from '@/components/business'
import { useRepositoryStore, useIssueExplainStore, useToastStore, useCodeReviewStore } from '@/store'
import type { RecommendedIssue, DifficultyLevel } from '@/types'

// ==================== 图标组件 ====================
const CodeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
)

const SparklesIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />
  </svg>
)

const CheckCircleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
)

// ==================== 工具函数 ====================
/** 获取 Issue 的推荐分数（优先使用 recommendationScore，回退到 matchScore） */
const getScore = (issue: RecommendedIssue): number => {
  return issue.recommendationScore ?? issue.matchScore ?? 0
}

/** 获取 Issue 的难度等级（提供默认值） */
const getDifficulty = (issue: RecommendedIssue): DifficultyLevel => {
  return issue.difficulty ?? 'medium'
}

/** 获取 Issue 的预估时间（提供默认值） */
const getEstimatedTime = (issue: RecommendedIssue): number => {
  return issue.estimatedTime ?? 2
}

// ==================== Issues 页面 ====================
const Issues = () => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('ai')
  const [difficultyFilter, setDifficultyFilter] = useState('all')
  const [timeFilter, setTimeFilter] = useState('all')
  const [sortBy, setSortBy] = useState('match')

  // 从 repository store 获取数据（分开调用避免无限重渲染）
  const recommendedIssues = useRepositoryStore((s) => s.recommendedIssues)
  const issuesStatus = useRepositoryStore((s) => s.issuesStatus)
  const issuesError = useRepositoryStore((s) => s.issuesError)
  const currentOwner = useRepositoryStore((s) => s.currentOwner)
  const currentRepoName = useRepositoryStore((s) => s.currentRepoName)
  const loadRecommendedIssues = useRepositoryStore((s) => s.loadRecommendedIssues)
  const selectIssue = useRepositoryStore((s) => s.selectIssue)

  // 从 issue explain store 获取弹窗状态（分开调用避免无限重渲染）
  const currentExplain = useIssueExplainStore((s) => s.currentExplain)
  const explainStatus = useIssueExplainStore((s) => s.explainStatus)
  const explainError = useIssueExplainStore((s) => s.explainError)
  const modalVisible = useIssueExplainStore((s) => s.modalVisible)
  const currentIssue = useIssueExplainStore((s) => s.currentIssue)
  const explainIssue = useIssueExplainStore((s) => s.explainIssue)
  const openModal = useIssueExplainStore((s) => s.openModal)
  const closeModal = useIssueExplainStore((s) => s.closeModal)

  // 从 code review store 获取选中的 Issue 和设置方法
  const selectedIssue = useCodeReviewStore((s) => s.selectedIssue)
  const setSelectedIssue = useCodeReviewStore((s) => s.setSelectedIssue)

  // 页面加载时自动加载推荐 Issue 列表
  // 只在 idle 状态时加载，避免无限循环
  useEffect(() => {
    if (issuesStatus === 'idle') {
      const owner = currentOwner || 'microsoft'
      const name = currentRepoName || 'vscode'
      // 直接通过 getState 获取 action，避免依赖变化导致循环
      useRepositoryStore.getState().loadRecommendedIssues(owner, name)
    }
  }, [issuesStatus, currentOwner, currentRepoName])

  // 监听加载状态，加载成功时显示通知
  useEffect(() => {
    if (issuesStatus === 'success') {
      useToastStore.getState().showToast('success', '加载完成', `已为你推荐 ${recommendedIssues.length} 个 Issue`)
    } else if (issuesStatus === 'error' && issuesError) {
      useToastStore.getState().showToast('error', '加载失败', issuesError)
    }
  }, [issuesStatus, issuesError, recommendedIssues.length])

  // 筛选逻辑
  const filteredIssues = useMemo(() => {
    return recommendedIssues.filter((issue) => {
      // Tab 筛选
      if (activeTab === 'beginner' && !issue.labels.some((l) => l.name.toLowerCase().includes('good first'))) {
        return false
      }
      if (activeTab === 'docs' && !issue.labels.some((l) => l.name.toLowerCase().includes('doc'))) {
        return false
      }

      // 难度筛选
      if (difficultyFilter !== 'all' && getDifficulty(issue) !== difficultyFilter) {
        return false
      }

      // 时间筛选
      const estTime = getEstimatedTime(issue)
      if (timeFilter === 'short' && estTime > 2) return false
      if (timeFilter === 'medium' && (estTime <= 2 || estTime > 5)) return false
      if (timeFilter === 'long' && estTime <= 5) return false

      return true
    })
  }, [recommendedIssues, activeTab, difficultyFilter, timeFilter])

  // 排序
  const sortedIssues = useMemo(() => {
    return [...filteredIssues].sort((a, b) => {
      switch (sortBy) {
        case 'match':
          return getScore(b) - getScore(a)
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        case 'comments':
          return b.comments - a.comments
        case 'easiest': {
          const diffA = getDifficulty(a)
          const diffB = getDifficulty(b)
          if (diffA === diffB) return 0
          if (diffA === 'easy') return -1
          if (diffA === 'hard') return 1
          return diffB === 'easy' ? 1 : -1
        }
        default:
          return 0
      }
    })
  }, [filteredIssues, sortBy])

  // Tab 计数
  const tabCounts = useMemo(() => ({
    ai: recommendedIssues.length,
    beginner: recommendedIssues.filter((i) => i.labels.some((l) => l.name.toLowerCase().includes('good first'))).length,
    docs: recommendedIssues.filter((i) => i.labels.some((l) => l.name.toLowerCase().includes('doc'))).length,
  }), [recommendedIssues])

  // 点击"为什么推荐"按钮
  const handleExplain = (issue: RecommendedIssue) => {
    selectIssue(issue)
    // 重置解释状态并打开弹窗
    useIssueExplainStore.setState({ currentExplain: null, explainStatus: 'idle', explainError: null, currentIssue: issue })
    openModal()
    // 调用解释接口
    const owner = currentOwner || 'microsoft'
    const name = currentRepoName || 'vscode'
    explainIssue(owner, name, issue)
  }

  // 关闭弹窗
  const handleCloseModal = () => {
    closeModal()
  }

  // 跳转代码审查
  const handleStart = () => {
    if (currentIssue) {
      setSelectedIssue(currentIssue)
      closeModal()
      navigate('/code-review')
    }
  }

  const repoFullName = `${currentOwner || 'microsoft'}/${currentRepoName || 'vscode'}`
  const isLoading = issuesStatus === 'loading' || issuesStatus === 'idle'

  return (
    <AppLayout
      breadcrumbs={[
        { label: '工作台' },
        { label: repoFullName },
        { label: 'Issue 推荐' },
      ]}
    >
      <div className="app-page active">
        {/* 页面标题区 */}
        <div className="page-header">
          <div className="page-title-row">
            <div>
              <h1 className="page-title">Issue 推荐</h1>
              <p className="page-subtitle">AI 为你精选最适合的开源贡献机会</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="repo-pill">
                <CodeIcon />
                {repoFullName}
              </span>
              <span className="hero-badge" style={{ marginBottom: 0 }}>
                <span className="hero-badge-dot" />
                AI 匹配
              </span>
            </div>
          </div>
        </div>

        {/* 筛选栏 */}
        <div className="issues-toolbar">
          <div className="issues-tabs">
            <button
              className={clsx('issues-tab', activeTab === 'ai' && 'active')}
              onClick={() => setActiveTab('ai')}
            >
              AI 推荐
              <span className="issues-tab-count">{tabCounts.ai}</span>
            </button>
            <button
              className={clsx('issues-tab', activeTab === 'beginner' && 'active')}
              onClick={() => setActiveTab('beginner')}
            >
              新手友好
              <span className="issues-tab-count">{tabCounts.beginner}</span>
            </button>
            <button
              className={clsx('issues-tab', activeTab === 'docs' && 'active')}
              onClick={() => setActiveTab('docs')}
            >
              文档类
              <span className="issues-tab-count">{tabCounts.docs}</span>
            </button>
          </div>
          <div className="issues-filters">
            <select
              className="filter-select"
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value)}
            >
              <option value="all">全部难度</option>
              <option value="easy">简单</option>
              <option value="medium">中等</option>
              <option value="hard">困难</option>
            </select>
            <select
              className="filter-select"
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
            >
              <option value="all">全部时间</option>
              <option value="short">2 小时以内</option>
              <option value="medium">2-5 小时</option>
              <option value="long">5 小时以上</option>
            </select>
            <select
              className="filter-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="match">匹配度排序</option>
              <option value="newest">最新发布</option>
              <option value="comments">最多评论</option>
              <option value="easiest">最简单</option>
            </select>
          </div>
        </div>

        {/* Issue 列表 */}
        {isLoading ? (
          <div className="ai-loading active">
            <div className="ai-loading-spinner" />
            <div className="ai-loading-title">正在为你匹配 Issue...</div>
            <div className="ai-loading-desc">AI 正在分析你的技能和兴趣</div>
            <div className="ai-loading-steps">
              <div className="ai-loading-step done">
                <CheckCircleIcon />
                获取仓库 Issue 列表
              </div>
              <div className="ai-loading-step active">
                <span className="step-spinner" />
                分析你的技能画像
              </div>
              <div className="ai-loading-step">
                <SparklesIcon />
                智能匹配推荐
              </div>
            </div>
          </div>
        ) : issuesStatus === 'error' ? (
          <AiPageError
            title="加载失败"
            message={issuesError || '加载 Issue 列表时出现错误，请稍后重试'}
            onRetry={() =>
              loadRecommendedIssues(
                currentOwner || 'microsoft',
                currentRepoName || 'vscode',
              )
            }
          />
        ) : (
          <div className="issues-list">
            <div className="issues-list-header">
              <span style={{ marginLeft: '34px', flex: 1 }}>Issue 标题</span>
              <span style={{ width: '180px', textAlign: 'center' }}>AI 匹配</span>
            </div>
            {sortedIssues.length > 0 ? (
              sortedIssues.map((issue) => (
                <IssueRow key={issue.id} issue={issue} onExplain={handleExplain} />
              ))
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
                <p>没有找到符合条件的 Issue</p>
                <p style={{ marginTop: 8, fontSize: 13 }}>
                  可调整筛选条件，或返回工作台换一个仓库再试。
                </p>
              </div>
            )}
          </div>
        )}

        {/* 解释弹窗 */}
        <IssueExplainModal
          visible={modalVisible}
          onClose={handleCloseModal}
          onStart={handleStart}
          issue={currentIssue ?? undefined}
          explain={currentExplain ?? undefined}
          loading={explainStatus === 'loading'}
          error={explainError}
        />

        {/* 下一步：Issue → 学习路线（旅程中段），也可稍后去做 Code Review */}
        {selectedIssue && (
          <NextStepCard
            currentStep={2}
            totalSteps={6}
            title="已选择 Issue！"
            description={`已选中「${selectedIssue.title.slice(0, 30)}${selectedIssue.title.length > 30 ? '...' : ''}」。建议先生成学习路线，再继续 Mentoring 与 Review。`}
            buttonText="生成学习路线"
            nextPath="/roadmap"
          />
        )}
      </div>
    </AppLayout>
  )
}

export default Issues
