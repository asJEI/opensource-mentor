import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { AppLayout } from '@/components/layout'
import { Button } from '@/components/ui'
import { AiPageError } from '@/components/business'
import {
  selectUserProfileContext,
  useRepositoryStore,
  useRoadmapStore,
  useToastStore,
  useUserStore,
} from '@/store'
import type { RoadmapPhase } from '@/types'

const GUIDE_SECTIONS = [
  {
    number: '01',
    title: '大致了解',
    pointsTitle: '本章要点',
    criteriaTitle: '读完可以确认',
    resourcesTitle: '建议先看',
  },
  {
    number: '02',
    title: '环境准备',
    pointsTitle: '安装与运行步骤',
    criteriaTitle: '环境就绪检查',
    resourcesTitle: '依据文档与命令',
  },
  {
    number: '03',
    title: '理解项目',
    pointsTitle: '建议先读的文件与模块',
    criteriaTitle: '理解完成标准',
    resourcesTitle: '真实仓库依据',
  },
  {
    number: '04',
    title: '复现问题',
    pointsTitle: '复现步骤（含预期行为 / 实际行为）',
    criteriaTitle: '复现完成标准',
    resourcesTitle: 'Issue 与运行依据',
  },
  {
    number: '05',
    title: '修正方案',
    pointsTitle: '建议方案',
    criteriaTitle: '方案确认检查',
    resourcesTitle: '仓库事实与参考',
  },
  {
    number: '06',
    title: '实现与验证',
    pointsTitle: '修改与验证步骤',
    criteriaTitle: '验证完成标准',
    resourcesTitle: '测试与命令依据',
  },
  {
    number: '07',
    title: 'PR 提交',
    pointsTitle: '提交前清单',
    criteriaTitle: 'PR 完成标准',
    resourcesTitle: '贡献指南与 PR 模板',
  },
] as const

const ArrowRightIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
)

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const RefreshIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </svg>
)

function normalizeSections(phases: RoadmapPhase[]) {
  return GUIDE_SECTIONS.map((section, index) => ({
    ...section,
    id: `guide-section-${index + 1}`,
    phase:
      phases.find((item) => item.phase === index + 1) ||
      phases.find((item) => item.title.includes(section.title)) ||
      null,
  }))
}

function EvidenceList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <section className="guide-content-block">
      <h3>{title}</h3>
      <ul className="guide-bullet-list">
        {items.map((item, index) => (
          <li key={`${title}-${index}`}>{item}</li>
        ))}
      </ul>
    </section>
  )
}

function generationLabel(phase: RoadmapPhase | null) {
  if (!phase) return '排队中'
  if (
    phase.generationStatus === 'ready' &&
    phase.learningItems?.length > 0 &&
    phase.goal &&
    !/暂未生成|正在生成|正在准备|不完整/.test(phase.goal)
  ) {
    return '已生成'
  }
  switch (phase.generationStatus) {
    case 'generating':
      return '生成中'
    case 'failed':
      return '失败'
    case 'ready':
      return '内容不完整'
    default:
      return '排队中'
  }
}

function GuideArticle({
  section,
  isCompleted,
  isCurrent,
  onComplete,
  onPrevious,
  onNext,
  onCodeReview,
  onPrGenerator,
  onMentor,
  onRetryPhase,
  isRetrying,
  isFirst,
  isLast,
}: {
  section: ReturnType<typeof normalizeSections>[number]
  isCompleted: boolean
  isCurrent: boolean
  onComplete: () => void
  onPrevious: () => void
  onNext: () => void
  onCodeReview: () => void
  onPrGenerator: () => void
  onMentor: () => void
  onRetryPhase: () => void
  isRetrying: boolean
  isFirst: boolean
  isLast: boolean
}) {
  const phase = section.phase
  const generationStatus = phase?.generationStatus
  const title = phase?.title || section.title
  const learningItems = phase?.learningItems || []
  const completionCriteria = phase?.completionCriteria || []
  const resources = phase?.resources || []
  const goal = phase?.goal || '这一章还没有生成内容。'
  const hasContent =
    learningItems.length > 0 &&
    Boolean(goal.trim()) &&
    !/暂未生成|正在生成|正在准备|不完整|失败/.test(goal)

  if (generationStatus === 'generating' || generationStatus === 'queued') {
    return (
      <article className="guide-reader">
        <div className="guide-reader-kicker">贡献指南 / {section.number}</div>
        <h2>{title}</h2>
        <div className="guide-phase-loading">
          <div className="ai-loading-spinner" />
          <p>
            {generationStatus === 'generating'
              ? '正在生成本章内容，请稍候…'
              : '排队等待生成，可先阅读已完成的章节。'}
          </p>
        </div>
      </article>
    )
  }

  if (generationStatus === 'failed' || !hasContent) {
    return (
      <article className="guide-reader">
        <div className="guide-reader-kicker">贡献指南 / {section.number}</div>
        <h2>{title}</h2>
        <p className="guide-reader-goal">
          {phase?.generationError ||
            '本章内容不完整。这通常是模型偶发返回空壳 JSON，不是接口挂了。'}
        </p>
        <div className="guide-action-row">
          <Button variant="primary" onClick={onRetryPhase} loading={isRetrying}>
            重试本章
          </Button>
        </div>
      </article>
    )
  }

  return (
    <article className="guide-reader">
      <div className="guide-reader-kicker">
        贡献指南 / {section.number}
        {isCurrent ? ' · 当前阅读' : ''}
        {isCompleted ? ' · 已完成' : ''}
      </div>
      <h2>{title}</h2>
      <p className="guide-reader-goal">{goal}</p>

      {phase?.estimatedDuration && (
        <p className="guide-reader-meta">预计用时：{phase.estimatedDuration}</p>
      )}

      <EvidenceList title={section.pointsTitle} items={learningItems} />
      <EvidenceList title={section.criteriaTitle} items={completionCriteria} />
      <EvidenceList title={section.resourcesTitle} items={resources} />

      {isLast && (
        <section className="guide-content-block guide-action-block">
          <h3>提交前的最后两步</h3>
          <p>
            先用代码审查检查修改，再进入 PR 生成器整理说明。遇到卡点也可以问 AI 导师。
          </p>
          <div className="guide-action-row">
            <Button variant="secondary" onClick={onCodeReview}>去代码审查</Button>
            <Button variant="primary" onClick={onPrGenerator}>去 PR 生成器</Button>
            <Button variant="ghost" onClick={onMentor}>问 AI 导师</Button>
          </div>
        </section>
      )}

      {!isLast && (
        <section className="guide-content-block guide-action-block">
          <h3>卡住了？</h3>
          <p>可以带着当前章节问题去问 AI 导师。</p>
          <div className="guide-action-row">
            <Button variant="secondary" onClick={onMentor}>问 AI 导师</Button>
          </div>
        </section>
      )}

      <div className="guide-reader-footer">
        <Button variant="secondary" onClick={onPrevious} disabled={isFirst}>
          上一章
        </Button>
        <Button
          variant={isCompleted ? 'secondary' : 'primary'}
          onClick={onComplete}
          icon={<CheckIcon />}
        >
          {isCompleted ? '已标记完成' : '标记本章完成'}
        </Button>
        <Button variant="primary" onClick={onNext} disabled={isLast} icon={<ArrowRightIcon />}>
          下一章
        </Button>
      </div>
    </article>
  )
}

const Roadmap = () => {
  const roadmap = useRoadmapStore((s) => s.roadmap)
  const steps = useRoadmapStore((s) => s.steps)
  const progress = useRoadmapStore((s) => s.progress)
  const isLoading = useRoadmapStore((s) => s.isLoading)
  const isGeneratingMore = useRoadmapStore((s) => s.isGeneratingMore)
  const error = useRoadmapStore((s) => s.error)
  const loadRoadmap = useRoadmapStore((s) => s.loadRoadmap)
  const retryPhase = useRoadmapStore((s) => s.retryPhase)
  const retryFailedPhases = useRoadmapStore((s) => s.retryFailedPhases)
  const updateStepStatus = useRoadmapStore((s) => s.updateStepStatus)
  const showToast = useToastStore((s) => s.showToast)
  const currentOwner = useRepositoryStore((s) => s.currentOwner)
  const currentRepoName = useRepositoryStore((s) => s.currentRepoName)
  const activeContributionIssue = useRepositoryStore((s) => s.activeContributionIssue)
  const profileSignature = useUserStore((s) =>
    JSON.stringify(selectUserProfileContext(s)),
  )
  const navigate = useNavigate()
  const [activeIndex, setActiveIndex] = useState(0)
  const [hasAutoFocused, setHasAutoFocused] = useState(false)

  useEffect(() => {
    if (currentOwner && currentRepoName && activeContributionIssue) {
      setHasAutoFocused(false)
      loadRoadmap(currentOwner, currentRepoName)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOwner, currentRepoName, profileSignature, activeContributionIssue?.id])

  // 第一章真正有内容后再自动聚焦
  useEffect(() => {
    if (hasAutoFocused) return
    const firstReady = steps.findIndex(
      (step) =>
        step.generationStatus === 'ready' &&
        (step.learningItems?.length || 0) > 0 &&
        step.goal &&
        !/暂未生成|正在生成|正在准备|不完整/.test(step.goal),
    )
    if (firstReady >= 0) {
      setActiveIndex(firstReady)
      setHasAutoFocused(true)
    }
  }, [steps, hasAutoFocused])

  const sections = useMemo(() => normalizeSections(steps), [steps])
  const activeSection = sections[activeIndex] || sections[0]
  const completedCount = sections.filter((section) => section.phase?.status === 'completed').length
  const readyCount = sections.filter((section) => {
    const phase = section.phase
    return (
      phase?.generationStatus === 'ready' &&
      (phase.learningItems?.length || 0) > 0 &&
      phase.goal &&
      !/暂未生成|正在生成|正在准备|不完整/.test(phase.goal)
    )
  }).length
  const failedCount = sections.filter((section) => {
    const phase = section.phase
    if (!phase) return false
    if (phase.generationStatus === 'failed') return true
    return (
      phase.generationStatus === 'ready' &&
      ((phase.learningItems?.length || 0) === 0 ||
        /暂未生成|不完整|失败/.test(phase.goal || ''))
    )
  }).length

  const hasShell = steps.length > 0
  const issueTitle = activeContributionIssue
    ? `#${activeContributionIssue.issueNumber} ${activeContributionIssue.title}`
    : ''

  const handleRetryAll = () => {
    if (!activeContributionIssue) {
      navigate('/issues')
      return
    }
    setHasAutoFocused(false)
    loadRoadmap(currentOwner, currentRepoName, { force: true })
  }

  const handleRetryFailed = () => {
    retryFailedPhases()
  }

  const handleRetryActivePhase = () => {
    const phaseNumber = activeSection?.phase?.phase
    if (!phaseNumber) return
    retryPhase(phaseNumber)
  }

  const handleComplete = () => {
    if (!activeSection?.phase?.id || activeSection.phase.generationStatus !== 'ready') return
    if ((activeSection.phase.learningItems?.length || 0) === 0) return
    updateStepStatus(activeSection.phase.id, 'completed')
    showToast('success', '已记录进度', `「${activeSection.title}」已完成`)
    if (activeIndex < sections.length - 1) {
      setActiveIndex((index) => index + 1)
    }
  }

  const goNext = () => setActiveIndex((index) => Math.min(index + 1, sections.length - 1))
  const goPrevious = () => setActiveIndex((index) => Math.max(index - 1, 0))

  if (!activeContributionIssue) {
    return (
      <AppLayout breadcrumbs={[{ label: '学习中心' }, { label: '贡献指南' }]}>
        <div className="app-page active roadmap-shell">
          <AiPageError
            title="请先选择一个 Issue"
            message="贡献指南必须围绕你当前选择的 Issue 生成。请先在 Issue 推荐中选定目标 Issue。"
            onRetry={() => navigate('/issues')}
            retryLabel="去选择 Issue"
            showSettingsLink={false}
          />
        </div>
      </AppLayout>
    )
  }

  if (error && !hasShell) {
    return (
      <AppLayout breadcrumbs={[{ label: '学习中心' }, { label: '贡献指南' }]}>
        <div className="app-page active roadmap-shell">
          <AiPageError
            className="roadmap-error"
            title="贡献指南加载失败"
            message={error}
            onRetry={handleRetryAll}
            retryLabel="重新加载"
          />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout breadcrumbs={[{ label: '学习中心' }, { label: '贡献指南' }]}>
      <div className="app-page active roadmap-shell">
        <header className="guide-header">
          <div>
            <span className="guide-eyebrow">贡献指南</span>
            <h1>{roadmap?.title || `围绕 ${issueTitle} 的贡献指南`}</h1>
            <p>
              围绕「{issueTitle}」按步骤生成。第一章就绪即可先读，后续章节在后台继续生成。
            </p>
          </div>
          <div className="guide-header-actions">
            <span className="guide-progress-pill">
              已生成 {readyCount}/{sections.length || 7}
              {failedCount > 0 ? ` · 失败 ${failedCount}` : ''}
              {completedCount > 0 ? ` · 已读完 ${completedCount}` : ''}
            </span>
            {failedCount > 0 && (
              <Button
                variant="primary"
                onClick={handleRetryFailed}
                loading={isGeneratingMore}
              >
                重试失败章节
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={handleRetryAll}
              loading={isLoading}
              icon={<RefreshIcon />}
            >
              全部重新生成
            </Button>
          </div>
        </header>

        {(isLoading || isGeneratingMore) && (
          <div className="guide-stream-banner">
            {isLoading
              ? '正在读取仓库文档与 Issue 上下文…'
              : `后台继续生成后续章节（${progress.percentage}%）`}
          </div>
        )}

        <div className="guide-step-cards">
          {sections.map((section, index) => {
            const status = section.phase?.generationStatus || 'queued'
            return (
              <button
                key={section.id}
                type="button"
                className={clsx(
                  'guide-step-card',
                  index === activeIndex && 'active',
                  status === 'ready' &&
                    (section.phase?.learningItems?.length || 0) > 0 &&
                    'ready',
                  status === 'generating' && 'generating',
                  (status === 'failed' ||
                    (status === 'ready' &&
                      (section.phase?.learningItems?.length || 0) === 0)) &&
                    'failed',
                  section.phase?.status === 'completed' && 'completed',
                )}
                onClick={() => setActiveIndex(index)}
              >
                <span className="guide-step-card-number">{section.number}</span>
                <span className="guide-step-card-body">
                  <strong>{section.title}</strong>
                  <em>{generationLabel(section.phase)}</em>
                </span>
                {status === 'generating' && <span className="guide-step-card-spinner" />}
                {status === 'ready' && section.phase?.status === 'completed' && <CheckIcon />}
              </button>
            )
          })}
        </div>

        <div className="guide-layout">
          <aside className="guide-sidebar">
            <div className="guide-sidebar-title">章节目录</div>
            <nav className="guide-nav">
              {sections.map((section, index) => (
                <button
                  key={section.id}
                  className={clsx(
                    'guide-nav-item',
                    index === activeIndex && 'active',
                    section.phase?.status === 'current' && 'current',
                    section.phase?.status === 'completed' && 'completed',
                    section.phase?.generationStatus === 'generating' && 'generating',
                  )}
                  onClick={() => setActiveIndex(index)}
                >
                  <span className="guide-nav-number">{section.number}</span>
                  <span>{section.title}</span>
                  {section.phase?.generationStatus === 'ready' &&
                    section.phase?.status === 'completed' && <CheckIcon />}
                  {section.phase?.generationStatus === 'generating' && (
                    <span className="guide-nav-dot" />
                  )}
                </button>
              ))}
            </nav>
          </aside>

          {activeSection && (
            <GuideArticle
              section={activeSection}
              isCompleted={activeSection.phase?.status === 'completed'}
              isCurrent={activeSection.phase?.status === 'current'}
              isFirst={activeIndex === 0}
              isLast={activeIndex === sections.length - 1}
              onComplete={handleComplete}
              onPrevious={goPrevious}
              onNext={goNext}
              onCodeReview={() => navigate('/code-review')}
              onPrGenerator={() => navigate('/pr-generator')}
              onMentor={() => navigate('/mentor')}
              onRetryPhase={handleRetryActivePhase}
              isRetrying={
                isGeneratingMore &&
                activeSection.phase?.generationStatus === 'generating'
              }
            />
          )}
        </div>
      </div>
    </AppLayout>
  )
}

export default Roadmap
