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
import type {
  GuideActionStep,
  GuideFileRef,
  GuideMentorContext,
  GuideReproduceBlock,
  RoadmapPhase,
} from '@/types'
import { buildGithubBlobUrl } from '@/utils/githubUrl'

const GUIDE_SECTIONS = [
  { number: '01', title: '大致了解' },
  { number: '02', title: '环境准备' },
  { number: '03', title: '理解项目' },
  { number: '04', title: '复现问题' },
  { number: '05', title: '修正方案' },
  { number: '06', title: '实现与验证' },
  { number: '07', title: 'PR 提交' },
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

const CopyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
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

function generationLabel(phase: RoadmapPhase | null) {
  if (!phase) return '排队中'
  const ready =
    phase.generationStatus === 'ready' &&
    ((phase.actionSteps?.length || 0) > 0 ||
      (phase.learningItems?.length || 0) > 0 ||
      (phase.fileRefs?.length || 0) > 0)
  if (ready) return '已生成'
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

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

function CommandBlock({
  commands,
  onCopied,
}: {
  commands: string[]
  onCopied: () => void
}) {
  if (commands.length === 0) return null
  return (
    <div className="guide-command-block">
      <pre>
        <code>{commands.join('\n')}</code>
      </pre>
      <Button
        variant="secondary"
        onClick={async () => {
          const ok = await copyText(commands.join('\n'))
          if (ok) onCopied()
        }}
        icon={<CopyIcon />}
      >
        复制命令
      </Button>
    </div>
  )
}

function ActionStepCard({
  step,
  index,
  onToggle,
}: {
  step: GuideActionStep
  index: number
  onToggle: () => void
}) {
  const showToast = useToastStore((s) => s.showToast)
  return (
    <section className={clsx('guide-action-step', step.completed && 'completed')}>
      <div className="guide-action-step-header">
        <span className="guide-action-step-index">
          {step.title?.startsWith('Step') ? step.title : `Step ${index + 1} · ${step.title}`}
        </span>
      </div>
      {step.description && <p className="guide-action-step-desc">{step.description}</p>}
      <CommandBlock
        commands={step.commands || []}
        onCopied={() => showToast('success', '已复制', '命令已复制到剪贴板')}
      />
      {step.expectedResult && (
        <div className="guide-expected">
          <strong>完成后，你应该看到：</strong>
          <p>{step.expectedResult}</p>
        </div>
      )}
      <label className="guide-checkbox">
        <input type="checkbox" checked={Boolean(step.completed)} onChange={onToggle} />
        <span>{step.checkboxLabel || '我已经完成'}</span>
      </label>
    </section>
  )
}

function FileRefsBlock({
  files,
  owner,
  repo,
  branch,
}: {
  files: GuideFileRef[]
  owner: string
  repo: string
  branch?: string
}) {
  if (files.length === 0) return null
  return (
    <section className="guide-content-block">
      <h3>建议先理解这 {files.length} 个文件</h3>
      <div className="guide-file-list">
        {files.map((file) => {
          const url =
            file.githubUrl ||
            buildGithubBlobUrl({ owner, repo, path: file.path, branch })
          return (
            <article key={file.path} className="guide-file-card">
              <code>{file.path}</code>
              <p>{file.reason}</p>
              <a href={url} target="_blank" rel="noreferrer">
                查看 GitHub 文件
              </a>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function ReproduceBlock({
  block,
  onToggle,
  onMentor,
}: {
  block: GuideReproduceBlock
  onToggle: () => void
  onMentor: () => void
}) {
  return (
    <section className={clsx('guide-reproduce', block.completed && 'completed')}>
      <h3>{block.title || '复现问题'}</h3>
      <ol className="guide-reproduce-steps">
        {block.steps.map((step, index) => (
          <li key={`${step}-${index}`}>{step}</li>
        ))}
      </ol>
      {block.constructExample && (
        <div className="guide-expected">
          <strong>然后构造：</strong>
          <pre>
            <code>{block.constructExample}</code>
          </pre>
        </div>
      )}
      {(block.expectedBehavior || block.actualBehavior) && (
        <div className="guide-behavior-grid">
          {block.expectedBehavior && (
            <div>
              <strong>预期：</strong>
              <p>{block.expectedBehavior}</p>
            </div>
          )}
          {block.actualBehavior && (
            <div>
              <strong>当前行为：</strong>
              <p>{block.actualBehavior}</p>
            </div>
          )}
        </div>
      )}
      <label className="guide-checkbox">
        <input type="checkbox" checked={Boolean(block.completed)} onChange={onToggle} />
        <span>{block.checkboxLabel || '我成功复现了问题'}</span>
      </label>
      <div className="guide-action-row">
        <Button variant="secondary" onClick={onMentor}>
          复现失败？问 AI 导师
        </Button>
      </div>
    </section>
  )
}

function GuideArticle({
  section,
  owner,
  repo,
  branch,
  isCompleted,
  isCurrent,
  onComplete,
  onPrevious,
  onNext,
  onCodeReview,
  onPrGenerator,
  onMentor,
  onRetryPhase,
  onToggleStep,
  onToggleReproduce,
  isRetrying,
  isFirst,
  isLast,
}: {
  section: ReturnType<typeof normalizeSections>[number]
  owner: string
  repo: string
  branch?: string
  isCompleted: boolean
  isCurrent: boolean
  onComplete: () => void
  onPrevious: () => void
  onNext: () => void
  onCodeReview: () => void
  onPrGenerator: () => void
  onMentor: (stuckHint?: string) => void
  onRetryPhase: () => void
  onToggleStep: (stepId: string) => void
  onToggleReproduce: () => void
  isRetrying: boolean
  isFirst: boolean
  isLast: boolean
}) {
  const phase = section.phase
  const generationStatus = phase?.generationStatus
  const title = phase?.title || section.title
  const actionSteps = phase?.actionSteps || []
  const fileRefs = phase?.fileRefs || []
  const reproduce = phase?.reproduce || null
  const learningItems = phase?.learningItems || []
  const hasStructured =
    actionSteps.length > 0 || fileRefs.length > 0 || (reproduce?.steps.length || 0) > 0
  const hasContent =
    hasStructured ||
    ((learningItems.length > 0) &&
      Boolean(phase?.goal?.trim()) &&
      !/暂未生成|正在生成|正在准备|不完整|失败/.test(phase?.goal || ''))

  if (generationStatus === 'generating' || generationStatus === 'queued') {
    return (
      <article className="guide-reader">
        <div className="guide-reader-kicker">贡献指南 / {section.number}</div>
        <h2>{title}</h2>
        <div className="guide-phase-loading">
          <div className="ai-loading-spinner" />
          <p>
            {generationStatus === 'generating'
              ? '正在生成本章行动步骤，请稍候…'
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
          {phase?.generationError || '本章内容不完整。可只重试本章，不必整份重来。'}
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
      <p className="guide-reader-goal">{phase?.actionIntro || phase?.goal}</p>
      {phase?.estimatedDuration && (
        <p className="guide-reader-meta">预计用时：{phase.estimatedDuration}</p>
      )}

      {actionSteps.map((step, index) => (
        <ActionStepCard
          key={step.id || `${section.id}-${index}`}
          step={step}
          index={index}
          onToggle={() => onToggleStep(step.id)}
        />
      ))}

      <FileRefsBlock files={fileRefs} owner={owner} repo={repo} branch={branch} />

      {reproduce && reproduce.steps.length > 0 && (
        <ReproduceBlock
          block={reproduce}
          onToggle={onToggleReproduce}
          onMentor={() => onMentor('我在复现问题上卡住了，请根据当前章节帮我排查。')}
        />
      )}

      {!hasStructured && learningItems.length > 0 && (
        <section className="guide-content-block">
          <h3>本章要点</h3>
          <ul className="guide-bullet-list">
            {learningItems.map((item, index) => (
              <li key={`${item}-${index}`}>{item}</li>
            ))}
          </ul>
        </section>
      )}

      {isLast && (
        <section className="guide-content-block guide-action-block">
          <h3>提交前的最后两步</h3>
          <div className="guide-action-row">
            <Button variant="secondary" onClick={onCodeReview}>去代码审查</Button>
            <Button variant="primary" onClick={onPrGenerator}>去 PR 生成器</Button>
            <Button variant="ghost" onClick={() => onMentor()}>问 AI 导师</Button>
          </div>
        </section>
      )}

      {!isLast && (
        <section className="guide-content-block guide-action-block">
          <h3>卡住了？</h3>
          <p>AI 导师会自动带上当前 Issue、章节和已完成进度，不用从头解释。</p>
          <div className="guide-action-row">
            <Button
              variant="secondary"
              onClick={() =>
                onMentor(`我在「${title}」这一章卡住了，请结合当前步骤继续指导我。`)
              }
            >
              问 AI 导师
            </Button>
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

function buildMentorContext(params: {
  owner: string
  repo: string
  branch?: string
  issueNumber?: number
  issueTitle?: string
  steps: RoadmapPhase[]
  activePhase: RoadmapPhase | null
  stuckHint?: string
}): GuideMentorContext | null {
  if (!params.activePhase) return null
  const currentStep =
    params.activePhase.actionSteps?.find((step) => !step.completed) ||
    params.activePhase.actionSteps?.[0]
  return {
    owner: params.owner,
    repo: params.repo,
    defaultBranch: params.branch,
    issueNumber: params.issueNumber,
    issueTitle: params.issueTitle,
    phaseNumber: params.activePhase.phase,
    phaseTitle: params.activePhase.title,
    phaseGoal: params.activePhase.goal,
    completedPhases: params.steps
      .filter((step) => step.status === 'completed')
      .map((step) => ({ phase: step.phase, title: step.title })),
    currentStepTitle: currentStep?.title,
    currentCommands: currentStep?.commands || [],
    stuckHint: params.stuckHint,
  }
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
  const toggleActionStep = useRoadmapStore((s) => s.toggleActionStep)
  const toggleReproduceComplete = useRoadmapStore((s) => s.toggleReproduceComplete)
  const updateStepStatus = useRoadmapStore((s) => s.updateStepStatus)
  const showToast = useToastStore((s) => s.showToast)
  const currentOwner = useRepositoryStore((s) => s.currentOwner)
  const currentRepoName = useRepositoryStore((s) => s.currentRepoName)
  const currentRepo = useRepositoryStore((s) => s.currentRepo)
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

  useEffect(() => {
    if (hasAutoFocused) return
    const firstReady = steps.findIndex(
      (step) =>
        step.generationStatus === 'ready' &&
        ((step.actionSteps?.length || 0) > 0 ||
          (step.learningItems?.length || 0) > 0),
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
      ((phase.actionSteps?.length || 0) > 0 ||
        (phase.learningItems?.length || 0) > 0 ||
        (phase.fileRefs?.length || 0) > 0)
    )
  }).length
  const failedCount = sections.filter((section) => section.phase?.generationStatus === 'failed').length
  const hasShell = steps.length > 0
  const issueTitle = activeContributionIssue
    ? `#${activeContributionIssue.issueNumber} ${activeContributionIssue.title}`
    : ''
  const branch = currentRepo?.defaultBranch || activeContributionIssue?.repository.defaultBranch

  const openMentor = (stuckHint?: string) => {
    const context = buildMentorContext({
      owner: currentOwner,
      repo: currentRepoName,
      branch,
      issueNumber: activeContributionIssue?.issueNumber,
      issueTitle: activeContributionIssue?.title,
      steps,
      activePhase: activeSection?.phase || null,
      stuckHint,
    })
    navigate('/mentor', { state: { guideContext: context } })
  }

  const handleRetryAll = () => {
    if (!activeContributionIssue) {
      navigate('/issues')
      return
    }
    setHasAutoFocused(false)
    loadRoadmap(currentOwner, currentRepoName, { force: true })
  }

  const handleComplete = () => {
    if (!activeSection?.phase?.id || activeSection.phase.generationStatus !== 'ready') return
    updateStepStatus(activeSection.phase.id, 'completed')
    showToast('success', '已记录进度', `「${activeSection.title}」已完成`)
    if (activeIndex < sections.length - 1) setActiveIndex((index) => index + 1)
  }

  const goNext = () => setActiveIndex((index) => Math.min(index + 1, sections.length - 1))
  const goPrevious = () => setActiveIndex((index) => Math.max(index - 1, 0))

  if (!activeContributionIssue) {
    return (
      <AppLayout breadcrumbs={[{ label: '学习中心' }, { label: '贡献指南' }]}>
        <div className="app-page active roadmap-shell">
          <AiPageError
            title="请先选择一个 Issue"
            message="贡献指南必须围绕你当前选择的 Issue 生成。"
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
              围绕「{issueTitle}」按可执行步骤推进。第一章就绪即可先做，后续章节后台继续生成。
            </p>
          </div>
          <div className="guide-header-actions">
            <span className="guide-progress-pill">
              已生成 {readyCount}/{sections.length || 7}
              {failedCount > 0 ? ` · 失败 ${failedCount}` : ''}
              {completedCount > 0 ? ` · 已读完 ${completedCount}` : ''}
            </span>
            {failedCount > 0 && (
              <Button variant="primary" onClick={() => retryFailedPhases()} loading={isGeneratingMore}>
                重试失败章节
              </Button>
            )}
            <Button variant="secondary" onClick={handleRetryAll} loading={isLoading} icon={<RefreshIcon />}>
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
                  status === 'ready' && 'ready',
                  status === 'generating' && 'generating',
                  status === 'failed' && 'failed',
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
                    section.phase?.status === 'completed' && 'completed',
                    section.phase?.generationStatus === 'generating' && 'generating',
                  )}
                  onClick={() => setActiveIndex(index)}
                >
                  <span className="guide-nav-number">{section.number}</span>
                  <span>{section.title}</span>
                  {section.phase?.status === 'completed' && <CheckIcon />}
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
              owner={currentOwner}
              repo={currentRepoName}
              branch={branch}
              isCompleted={activeSection.phase?.status === 'completed'}
              isCurrent={activeSection.phase?.status === 'current'}
              isFirst={activeIndex === 0}
              isLast={activeIndex === sections.length - 1}
              onComplete={handleComplete}
              onPrevious={goPrevious}
              onNext={goNext}
              onCodeReview={() => navigate('/code-review')}
              onPrGenerator={() => navigate('/pr-generator')}
              onMentor={openMentor}
              onRetryPhase={() => {
                const phaseNumber = activeSection.phase?.phase
                if (phaseNumber) retryPhase(phaseNumber)
              }}
              onToggleStep={(stepId) => {
                const phaseNumber = activeSection.phase?.phase
                if (phaseNumber) toggleActionStep(phaseNumber, stepId)
              }}
              onToggleReproduce={() => {
                const phaseNumber = activeSection.phase?.phase
                if (phaseNumber) toggleReproduceComplete(phaseNumber)
              }}
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
