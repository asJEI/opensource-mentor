import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { AppLayout } from '@/components/layout'
import { Button } from '@/components/ui'
import { AiPageError, NextStepCard } from '@/components/business'
import {
  selectUserProfileContext,
  useRepositoryStore,
  useRoadmapStore,
  useToastStore,
  useUserStore,
} from '@/store'
import type { ExperienceLevel, RoadmapPhase } from '@/types'

// ==================== 图标组件 ====================
const BookOpenIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </svg>
)

const CodeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
)

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
)

const TargetIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </svg>
)

const GitPullRequestIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="18" r="3" />
    <circle cx="6" cy="6" r="3" />
    <path d="M13 6h3a2 2 0 0 1 2 2v7" />
    <line x1="6" y1="9" x2="6" y2="21" />
  </svg>
)

const TrophyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16" />
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
  </svg>
)

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
)

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const ArrowRightIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
)

const RotateCcwIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </svg>
)

// ==================== 阶段图标映射 ====================
const phaseIcons: Record<number, React.ReactNode> = {
  1: <BookOpenIcon />,
  2: <CodeIcon />,
  3: <SearchIcon />,
  4: <TargetIcon />,
  5: <GitPullRequestIcon />,
  6: <TrophyIcon />,
}

// ==================== 用户水平选项 ====================
const experienceLevelOptions = [
  { value: 'beginner' as const, label: '第一次接触开源', desc: '从基础流程开始' },
  { value: 'some_experience' as const, label: '写过一些代码', desc: '有基础开发经验' },
  { value: 'project_experience' as const, label: '有完整项目经验', desc: '可跳过部分基础阶段' },
]

// ==================== ProgressOverview 组件 ====================
function ProgressOverview() {
  const steps = useRoadmapStore((s) => s.steps)
  const progress = useRoadmapStore((s) => s.progress)
  const roadmap = useRoadmapStore((s) => s.roadmap)
  const [animatedPercentage, setAnimatedPercentage] = useState(0)

  useEffect(() => {
    // 环形进度条动画
    const timer = setTimeout(() => {
      setAnimatedPercentage(progress.percentage)
    }, 100)
    return () => clearTimeout(timer)
  }, [progress.percentage])

  const circumference = 2 * Math.PI * 35 // r = 35
  const strokeDashoffset = circumference - (animatedPercentage / 100) * circumference

  const completedSteps = steps.filter((s) => s.status === 'completed').length
  const currentStepIndex = steps.findIndex((s) => s.status === 'current')
  const pendingSteps = steps.filter((s) => s.status === 'pending').length

  return (
    <div className="progress-overview">
      {/* 环形进度条 */}
      <div className="progress-circle-wrap">
        <svg viewBox="0 0 80 80">
          <defs>
            <linearGradient id="roadmapGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="50%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
          </defs>
          <circle className="progress-circle-bg" cx="40" cy="40" r="35" />
          <circle
            className="progress-circle-fill"
            cx="40"
            cy="40"
            r="35"
            style={{
              strokeDasharray: circumference,
              strokeDashoffset: strokeDashoffset,
            }}
          />
        </svg>
        <div className="progress-circle-text">{animatedPercentage}%</div>
      </div>

      {/* 进度信息 */}
      <div className="progress-info">
        <h3>学习进度总览</h3>
        <p>
          {roadmap?.totalEstimatedTime
            ? `预计总耗时 ${roadmap.totalEstimatedTime}，按照路线图逐步推进`
            : `共 ${steps.length} 个阶段，按照路线图逐步推进`}
        </p>
        <div className="progress-stats">
          <div className="progress-stat">
            <span className="progress-stat-dot" />
            已完成 {completedSteps} 阶段
          </div>
          <div className="progress-stat">
            <span className="progress-stat-dot current" />
            进行中 {currentStepIndex >= 0 ? 1 : 0} 阶段
          </div>
          <div className="progress-stat">
            <span className="progress-stat-dot pending" />
            待完成 {pendingSteps} 阶段
          </div>
        </div>
      </div>
    </div>
  )
}

// ==================== RoadmapTimeline 组件 ====================
function RoadmapTimeline() {
  const steps = useRoadmapStore((s) => s.steps)
  const progress = useRoadmapStore((s) => s.progress)

  // 计算时间线填充高度
  const fillPercentage = steps.length > 1
    ? (progress.completedSteps / (steps.length - 1)) * 100
    : 0

  return (
    <div className="timeline">
      {/* 时间线 */}
      <div className="timeline-line">
        <div
          className="timeline-line-fill"
          style={{ height: `${fillPercentage}%` }}
        />
      </div>

      {/* 时间点 */}
      {steps.map((phase, index) => (
        <div
          key={phase.id}
          className={clsx(
            'timeline-item',
            phase.status === 'completed' && 'completed',
            phase.status === 'current' && 'current',
          )}
          style={{
            animationDelay: `${index * 0.1}s`,
          }}
        >
          {/* 左侧内容（偶数索引） */}
          <div className={clsx('timeline-side', index % 2 === 0 ? 'left' : 'right')}>
            {index % 2 === 0 && <TimelineCard phase={phase} />}
          </div>

          {/* 节点 */}
          <div className="timeline-node">
            {phase.status === 'completed' ? (
              <CheckIcon />
            ) : (
              phaseIcons[phase.phase] || <TargetIcon />
            )}
          </div>

          {/* 右侧内容（奇数索引） */}
          <div className={clsx('timeline-side', index % 2 === 0 ? 'right' : 'left')}>
            {index % 2 !== 0 && <TimelineCard phase={phase} />}
          </div>
        </div>
      ))}
    </div>
  )
}

// ==================== TimelineCard 组件 ====================
function TimelineCard({ phase }: { phase: RoadmapPhase }) {
  const difficultyLabel: Record<string, string> = {
    easy: '简单',
    medium: '中等',
    hard: '困难',
  }

  const difficultyClass: Record<string, string> = {
    easy: 'difficulty-easy',
    medium: 'difficulty-medium',
    hard: 'difficulty-hard',
  }

  return (
    <div className="timeline-card">
      <span className="card-day-badge">
        <ClockIcon />
        第 {phase.phase} 阶段 · {phase.estimatedDuration}
      </span>
      <h3>{phase.title}</h3>
      <p>{phase.goal}</p>

      {/* 难度标签 */}
      <div className={clsx('card-difficulty', difficultyClass[phase.difficulty])}>
        难度：{difficultyLabel[phase.difficulty] || phase.difficulty}
      </div>

      <ul className="card-tasks">
        {phase.tasks.map((task) => (
          <li key={task.id} className={clsx('card-task', task.completed && 'completed')}>
            <span className="card-task-icon">
              <CheckIcon />
            </span>
            <span className="card-task-text">{task.text}</span>
          </li>
        ))}
      </ul>

      <div className="card-footer">
        <span className="card-duration">
          <ClockIcon />
          预计 {phase.estimatedDuration}
        </span>
        {phase.status === 'current' && (
          <span className="card-link">
            开始学习
            <ArrowRightIcon />
          </span>
        )}
        {phase.status === 'completed' && (
          <span className="card-link" style={{ color: 'var(--green)' }}>
            已完成
            <CheckIcon />
          </span>
        )}
      </div>
    </div>
  )
}

// ==================== 用户水平选择器 ====================
function UserLevelSelector({ owner, repo }: { owner: string; repo: string }) {
  const profile = useUserStore((s) => s.profile)
  const completeProfileSetup = useUserStore((s) => s.completeProfileSetup)
  const loadRoadmap = useRoadmapStore((s) => s.loadRoadmap)
  const isLoading = useRoadmapStore((s) => s.isLoading)
  const showToast = useToastStore((s) => s.showToast)

  const handleLevelChange = async (level: ExperienceLevel) => {
    if (level === profile.experienceLevel) return
    completeProfileSetup({
      programmingLanguages: profile.programmingLanguages,
      experienceLevel: level,
      interests: profile.interests,
      goals: profile.goals,
    })
    void useRepositoryStore.getState().loadRecommendedIssues(owner, repo)
    showToast('info', '正在重新生成', `已切换到${experienceLevelOptions.find((o) => o.value === level)?.label}，正在生成新路线图...`)
    await loadRoadmap(owner, repo)
  }

  return (
    <div className="user-level-selector">
      <span className="user-level-label">你的水平：</span>
      <div className="user-level-options">
        {experienceLevelOptions.map((option) => (
          <button
            key={option.value}
            className={clsx(
              'user-level-option',
              profile.experienceLevel === option.value && 'active',
              isLoading && 'disabled',
            )}
            onClick={() => handleLevelChange(option.value)}
            disabled={isLoading}
            title={option.desc}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ==================== 错误状态组件 ====================
function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <AiPageError
      className="roadmap-error"
      title="路线图加载失败"
      message={error}
      onRetry={onRetry}
      retryLabel="重新加载"
    />
  )
}

// ==================== Roadmap 页面 ====================
const Roadmap = () => {
  const roadmap = useRoadmapStore((s) => s.roadmap)
  const steps = useRoadmapStore((s) => s.steps)
  const progress = useRoadmapStore((s) => s.progress)
  const isLoading = useRoadmapStore((s) => s.isLoading)
  const error = useRoadmapStore((s) => s.error)
  const loadRoadmap = useRoadmapStore((s) => s.loadRoadmap)
  const nextStep = useRoadmapStore((s) => s.nextStep)
  const resetProgress = useRoadmapStore((s) => s.resetProgress)
  const showToast = useToastStore((s) => s.showToast)
  const currentOwner = useRepositoryStore((s) => s.currentOwner)
  const currentRepoName = useRepositoryStore((s) => s.currentRepoName)
  const profileSignature = useUserStore((s) =>
    JSON.stringify(selectUserProfileContext(s)),
  )

  // 页面加载、仓库变化或用户画像变化时，交由 Store 判断是否需要重新生成
  useEffect(() => {
    if (currentOwner && currentRepoName) {
      loadRoadmap(currentOwner, currentRepoName)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOwner, currentRepoName, profileSignature])

  const handleNext = () => {
    const currentIndex = steps.findIndex((s) => s.status === 'current')
    if (currentIndex === steps.length - 1) {
      // 已经是最后一步，标记为完成
      const newSteps = steps.map((s, i) =>
        i === currentIndex ? { ...s, status: 'completed' as const } : s,
      )
      useRoadmapStore.setState({
        steps: newSteps,
        progress: {
          currentStep: steps.length,
          totalSteps: steps.length,
          completedSteps: steps.length,
          percentage: 100,
        },
      })
      showToast('success', '恭喜完成！', '你已完成全部学习路线，快去贡献吧！')
      return
    }

    nextStep()
    const nextStepIndex = currentIndex + 1
    showToast('success', '进度已更新', `已进入第 ${nextStepIndex + 1} 阶段：${steps[nextStepIndex]?.title || ''}`)
  }

  const handleReset = () => {
    resetProgress()
    showToast('info', '已重置', '学习进度已重置，可以重新开始')
  }

  const handleRetry = () => {
    loadRoadmap(currentOwner, currentRepoName)
  }

  const navigate = useNavigate()

  const currentStep = steps.find((s) => s.status === 'current')
  const isAllCompleted = steps.length > 0 && steps.every((s) => s.status === 'completed')
  const hasData = steps.length > 0

  // 加载状态
  if (isLoading && !hasData) {
    return (
      <AppLayout breadcrumbs={[{ label: '学习中心' }, { label: '学习路线' }]}>
        <div className="app-page active">
          <div className="ai-loading active">
            <div className="ai-loading-spinner" />
            <div className="ai-loading-title">正在生成学习路线...</div>
            <div className="ai-loading-desc">AI 正在为你定制专属学习路径</div>
          </div>
        </div>
      </AppLayout>
    )
  }

  // 错误状态
  if (error && !hasData) {
    return (
      <AppLayout breadcrumbs={[{ label: '学习中心' }, { label: '学习路线' }]}>
        <div className="app-page active" style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <ErrorState error={error} onRetry={handleRetry} />
        </div>
      </AppLayout>
    )
  }

  // 空状态：尚未分析仓库
  if (!isLoading && !hasData) {
    return (
      <AppLayout breadcrumbs={[{ label: '学习中心' }, { label: '学习路线' }]}>
        <div className="app-page active" style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <AiPageError
            title="还没有学习路线"
            message="请先在仓库分析页选择并分析一个仓库，再回来生成个性化路线。"
            onRetry={() => navigate('/dashboard')}
            retryLabel="去仓库分析"
            showSettingsLink={false}
          />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout breadcrumbs={[{ label: '学习中心' }, { label: '学习路线' }]}>
      <div className="app-page active" style={{ maxWidth: '1100px', margin: '0 auto' }}>
        {/* 页面标题 */}
        <div className="roadmap-header">
          <h1>{roadmap?.title || '开源贡献学习路线'}</h1>
          <p>{roadmap?.description || '按照路线图逐步推进，开启你的开源之旅'}</p>
          {/* 用户水平选择器 */}
          <UserLevelSelector owner={currentOwner} repo={currentRepoName} />
        </div>

        {/* 进度总览卡 */}
        {hasData && <ProgressOverview />}

        {/* 时间轴 */}
        {hasData && <RoadmapTimeline />}

        {/* 底部控制按钮 */}
        {hasData && (
          <div className="roadmap-controls">
            <Button variant="secondary" onClick={handleReset} icon={<RotateCcwIcon />}>
              重置进度
            </Button>
            {!isAllCompleted ? (
              <Button variant="primary" onClick={handleNext} icon={<ArrowRightIcon />}>
                {currentStep?.phase === 1 && progress.completedSteps === 0 ? '开始学习' : '完成当前，下一阶段'}
              </Button>
            ) : (
              <Button variant="primary" onClick={handleReset} icon={<TrophyIcon />}>
                恭喜完成！再来一次
              </Button>
            )}
          </div>
        )}

        {hasData && (
          <NextStepCard
            currentStep={3}
            totalSteps={6}
            title="学习路线已就绪"
            description="遇到卡点时可以直接问 AI Mentor，再继续 Code Review 与 PR。"
            buttonText="询问 AI Mentor"
            nextPath="/ai-mentor"
          />
        )}
      </div>
    </AppLayout>
  )
}

export default Roadmap
