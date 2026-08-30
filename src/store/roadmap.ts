import { create } from 'zustand'
import type {
  Roadmap,
  RoadmapGenerationStatus,
  RoadmapPhase,
  RoadmapProgress,
  RoadmapStepStatus,
} from '@/types'
import { aiService } from '@/services'
import { getErrorMessage } from '@/services/errors'
import { getEffectiveUserProfileContext } from './user'
import { useRepositoryStore } from './repository'
import { GUIDE_PHASE_TITLES } from '@/constants/guidePhases'
import { extractStreamingGuidePreview } from '@/utils/streamingGuidePreview'

const DEFAULT_PHASE_TITLES = [...GUIDE_PHASE_TITLES]

const STORAGE_PREFIX = 'osm.contribution-guide.v1:'

function calculateProgress(phases: RoadmapPhase[]): RoadmapProgress {
  const readyPhases = phases.filter((s) => s.generationStatus === 'ready')
  const totalSteps = phases.length
  const completedSteps = phases.filter((s) => s.status === 'completed').length
  const percentage =
    totalSteps > 0 ? Math.round((readyPhases.length / totalSteps) * 100) : 0
  const currentStepIndex = phases.findIndex((s) => s.status === 'current')
  const currentStep = currentStepIndex >= 0 ? currentStepIndex : 0

  return {
    currentStep,
    totalSteps,
    completedSteps,
    percentage,
  }
}

function createPlaceholderPhases(titles: string[]): RoadmapPhase[] {
  return titles.map((title, idx) => ({
    id: `phase-${idx}`,
    phase: idx + 1,
    title,
    goal: '正在准备本章内容…',
    learningItems: [],
    recommendedIssues: [],
    estimatedDuration: '待确认',
    difficulty: 'medium',
    completionCriteria: [],
    resources: [],
    status: idx === 0 ? 'current' : 'pending',
    tasks: [],
    generationStatus: idx === 0 ? 'generating' : 'queued',
    generationError: null,
  }))
}

function patchPhase(
  steps: RoadmapPhase[],
  phaseNumber: number,
  patch: Partial<RoadmapPhase>,
): RoadmapPhase[] {
  return steps.map((step) =>
    step.phase === phaseNumber ? { ...step, ...patch } : step,
  )
}

function isPhaseContentReady(phase: RoadmapPhase | null | undefined): boolean {
  if (!phase) return false
  if (phase.generationStatus !== 'ready') return false
  if (/暂未生成|正在生成|正在准备|按步骤操作|参考后续章节/.test(phase.goal || '')) {
    return false
  }
  const substantiveSteps = (phase.actionSteps || []).filter((step) => {
    const hasCommands = (step.commands || []).some((item) => item.trim())
    const hasDescription = Boolean(step.description?.trim())
    const hasExpected = Boolean(step.expectedResult?.trim())
    return hasCommands || hasDescription || hasExpected
  })
  const hasFiles = (phase.fileRefs?.length || 0) >= 2
  const hasReproduce = (phase.reproduce?.steps?.length || 0) >= 2
  if (substantiveSteps.length >= 2) return true
  if (phase.phase === 3 && hasFiles) return true
  if (phase.phase === 4 && hasReproduce) return true
  return false
}

function cacheKey(owner: string, repo: string, issueNumber: number) {
  return `${STORAGE_PREFIX}${owner}/${repo}#${issueNumber}`
}

type SharedGuideContext = {
  repository: Record<string, unknown>
  readme: string
  repositoryContext: Record<string, unknown>
  issueContext?: Record<string, unknown> | null
}

type PersistedGuide = {
  key: string
  owner: string
  repo: string
  roadmap: Roadmap
  steps: RoadmapPhase[]
  sharedContext?: SharedGuideContext | null
  savedAt: number
}

function readPersistedGuide(key: string): PersistedGuide | null {
  if (!key || typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedGuide
    if (!parsed?.roadmap || !Array.isArray(parsed.steps)) return null
    return parsed
  } catch {
    return null
  }
}

function writePersistedGuide(payload: PersistedGuide) {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(payload.key, JSON.stringify(payload))
  } catch {
    // ignore quota / private mode
  }
}

interface RoadmapState {
  roadmap: Roadmap | null
  steps: RoadmapPhase[]
  progress: RoadmapProgress
  isLoading: boolean
  isGeneratingMore: boolean
  error: string | null
  currentOwner: string
  currentRepo: string
  /** 稳定缓存键：owner/repo#issueNumber */
  cacheKey: string
  generationToken: number
  sharedContext: SharedGuideContext | null

  loadRoadmap: (owner: string, repo: string, options?: { force?: boolean }) => Promise<void>
  /** 只重试指定失败章节，保留其他已生成内容 */
  retryPhase: (phaseNumber: number) => Promise<void>
  /** 只重试全部失败章节 */
  retryFailedPhases: () => Promise<void>
  /** 切换行动步骤勾选 */
  toggleActionStep: (phaseNumber: number, stepId: string) => void
  /** 切换复现块勾选 */
  toggleReproduceComplete: (phaseNumber: number) => void
  nextStep: () => void
  resetProgress: () => void
  updateStepStatus: (stepId: string, status: RoadmapStepStatus) => void
}

const initialProgress: RoadmapProgress = {
  currentStep: 0,
  totalSteps: 0,
  completedSteps: 0,
  percentage: 0,
}

function buildIssueContext() {
  const repositoryState = useRepositoryStore.getState()
  const activeIssue = repositoryState.activeContributionIssue
  if (!activeIssue) return null

  return {
    issue: {
      number: activeIssue.issueNumber,
      title: activeIssue.title,
      body: activeIssue.body,
      language: activeIssue.language,
      analysis: activeIssue.analysis,
      whyThisFitsYou: activeIssue.whyThisFitsYou,
      matchScore: activeIssue.matchScore,
    },
    repository: repositoryState.currentRepo
      ? {
          fullName: repositoryState.currentRepo.fullName,
          description: repositoryState.currentRepo.description,
          language: repositoryState.currentRepo.language,
          stars: repositoryState.currentRepo.stars,
          forks: repositoryState.currentRepo.forks,
          issuesCount: repositoryState.currentRepo.issuesCount,
          defaultBranch: repositoryState.currentRepo.defaultBranch,
        }
      : {
          fullName: activeIssue.repository.fullName,
          description: activeIssue.repository.description,
          language: activeIssue.language,
          stars: activeIssue.repository.stars,
          forks: activeIssue.repository.forks,
          issuesCount: activeIssue.repository.openIssues,
          defaultBranch: activeIssue.repository.defaultBranch,
        },
    confirmedContext: repositoryState.currentExplain?.confirmedContext ?? [],
    possibleAreasToInspect:
      repositoryState.currentExplain?.possibleAreasToInspect ?? [],
  }
}

function persistCurrent(get: () => RoadmapState) {
  const state = get()
  if (!state.cacheKey || !state.roadmap || state.steps.length === 0) return
  writePersistedGuide({
    key: state.cacheKey,
    owner: state.currentOwner,
    repo: state.currentRepo,
    roadmap: { ...state.roadmap, phases: state.steps },
    steps: state.steps,
    sharedContext: state.sharedContext,
    savedAt: Date.now(),
  })
}

async function generateOnePhase(params: {
  owner: string
  repo: string
  phaseNumber: number
  userProfile: ReturnType<typeof getEffectiveUserProfileContext>
  shared: {
    repository: Record<string, unknown>
    readme: string
    repositoryContext: Record<string, unknown>
    issueContext?: Record<string, unknown> | null
  }
  onStream?: (preview: string) => void
}): Promise<RoadmapPhase> {
  const maxAttempts = 2
  let lastError: unknown

  const runOnce = async (useStream: boolean) => {
    if (useStream) {
      return aiService.streamGenerateRoadmapPhase(
        params.owner,
        params.repo,
        params.phaseNumber,
        params.userProfile,
        params.shared,
        {
          onDelta(_delta, accumulated) {
            params.onStream?.(accumulated)
          },
        },
      )
    }
    return aiService.generateRoadmapPhase(
      params.owner,
      params.repo,
      params.phaseNumber,
      params.userProfile,
      params.shared,
    )
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      let phase: RoadmapPhase
      try {
        phase = await runOnce(true)
      } catch (streamError) {
        const streamMessage = getErrorMessage(streamError, '')
        const canFallback =
          /流式响应|stream|network|fetch|内容不完整|超时|timeout|限流|429/i.test(
            streamMessage,
          )
        if (!canFallback) throw streamError
        phase = await runOnce(false)
      }

      if (!isPhaseContentReady({ ...phase, generationStatus: 'ready' })) {
        throw new Error('本章生成结果为空')
      }
      return phase
    } catch (error) {
      lastError = error
      const message = getErrorMessage(error, '')
      const isRateLimited =
        /限流|429|rate.?limit|过于频繁|额度已用完/i.test(message)
      const isTimeout = /超时|timeout|timed out|aborted/i.test(message)
      if ((!isRateLimited && !isTimeout) || attempt >= maxAttempts) break
      await new Promise((resolve) =>
        setTimeout(resolve, (isTimeout ? 1500 : 2500) * attempt),
      )
    }
  }
  throw lastError instanceof Error ? lastError : new Error('本章生成失败')
}

export const useRoadmapStore = create<RoadmapState>((set, get) => ({
  roadmap: null,
  steps: [],
  progress: initialProgress,
  isLoading: false,
  isGeneratingMore: false,
  error: null,
  currentOwner: '',
  currentRepo: '',
  cacheKey: '',
  generationToken: 0,
  sharedContext: null,

  loadRoadmap: async (owner, repo, options) => {
    const userProfile = getEffectiveUserProfileContext()
    const issueContext = buildIssueContext()
    const activeIssue = useRepositoryStore.getState().activeContributionIssue
    if (!issueContext || !activeIssue) {
      set({
        isLoading: false,
        isGeneratingMore: false,
        error: null,
        roadmap: null,
        steps: [],
        progress: initialProgress,
        currentOwner: owner,
        currentRepo: repo,
        cacheKey: '',
        sharedContext: null,
      })
      return
    }

    const key = cacheKey(owner, repo, activeIssue.issueNumber)
    const current = get()

    // 内存已有同一 Issue 的指南：不重复生成（除非 force）
    if (
      !options?.force &&
      current.cacheKey === key &&
      current.roadmap &&
      current.steps.some(isPhaseContentReady) &&
      !current.isGeneratingMore
    ) {
      // 若有空壳“已生成”，纠正状态后按需补生成
      const broken = current.steps.filter(
        (step) =>
          step.generationStatus === 'ready' && !isPhaseContentReady(step),
      )
      if (broken.length === 0) {
        if (current.steps.every((step) => step.generationStatus === 'ready')) {
          return
        }
        // 有未完成章节则继续后台补齐，但不清空已有内容
      } else {
        const fixed = current.steps.map((step) =>
          broken.some((item) => item.phase === step.phase)
            ? {
                ...step,
                generationStatus: 'failed' as RoadmapGenerationStatus,
                generationError: '本章内容不完整，请重新生成',
                goal: '本章内容不完整，请点击重新生成。',
              }
            : step,
        )
        set({ steps: fixed, progress: calculateProgress(fixed) })
      }
      if (current.steps.every((step) => isPhaseContentReady(step))) return
    }

    // sessionStorage 恢复
    if (!options?.force) {
      const persisted = readPersistedGuide(key)
      if (persisted && persisted.steps.some(isPhaseContentReady)) {
        const restoredSteps = persisted.steps.map((step) =>
          step.generationStatus === 'ready' && !isPhaseContentReady(step)
            ? {
                ...step,
                generationStatus: 'failed' as RoadmapGenerationStatus,
                generationError: '本章内容不完整',
              }
            : step,
        )
        set({
          roadmap: persisted.roadmap,
          steps: restoredSteps,
          progress: calculateProgress(restoredSteps),
          isLoading: false,
          isGeneratingMore: false,
          error: null,
          currentOwner: owner,
          currentRepo: repo,
          cacheKey: key,
          sharedContext: persisted.sharedContext || null,
        })
        if (restoredSteps.every(isPhaseContentReady)) return
        // 未完成的章节继续补生成；不打断已恢复内容
      }
    }

    const token = current.generationToken + 1
    const existingReady =
      !options?.force && current.cacheKey === key
        ? current.steps.filter(isPhaseContentReady)
        : !options?.force
          ? readPersistedGuide(key)?.steps.filter(isPhaseContentReady) || []
          : []

    const titles = DEFAULT_PHASE_TITLES
    let steps = createPlaceholderPhases(titles).map((placeholder) => {
      const ready = existingReady.find((item) => item.phase === placeholder.phase)
      if (!ready) return placeholder
      return {
        ...ready,
        generationStatus: 'ready' as RoadmapGenerationStatus,
        generationError: null,
      }
    })

    const firstMissing = steps.find((step) => !isPhaseContentReady(step))
    steps = steps.map((step) => {
      if (isPhaseContentReady(step)) return step
      if (firstMissing && step.phase === firstMissing.phase) {
        return { ...step, generationStatus: 'generating', goal: '正在生成本章内容…' }
      }
      return {
        ...step,
        generationStatus: 'queued',
        goal: step.goal?.includes('不完整') ? step.goal : '排队等待生成…',
      }
    })

    set({
      isLoading: existingReady.length === 0,
      isGeneratingMore: true,
      error: null,
      currentOwner: owner,
      currentRepo: repo,
      cacheKey: key,
      generationToken: token,
      steps,
      progress: calculateProgress(steps),
      roadmap: {
        title:
          current.cacheKey === key && current.roadmap?.title
            ? current.roadmap.title
            : `贡献指南：#${activeIssue.issueNumber} ${activeIssue.title}`,
        description:
          '围绕当前 Issue 分步理解问题、准备环境、复现并提交 PR。第一章就绪即可阅读，其余章节后台继续生成。',
        totalEstimatedTime: '待确认',
        phases: steps,
        tips: current.roadmap?.tips || [],
        confidence: 0.7,
      },
    })

    try {
      const prepared = await aiService.prepareRoadmapContext(
        owner,
        repo,
        userProfile,
        issueContext,
      )
      if (get().generationToken !== token) return

      set({
        isLoading: false,
        roadmap: {
          title: prepared.title,
          description: prepared.description,
          totalEstimatedTime: prepared.totalEstimatedTime || '待确认',
          phases: get().steps,
          tips: [],
          confidence: 0.7,
        },
      })

      const shared = {
        repository: prepared.repository,
        readme: prepared.readme,
        repositoryContext: prepared.repositoryContext,
        issueContext: prepared.issueContext,
      }
      set({ sharedContext: shared })

      const generatePhase = async (phaseNumber: number) => {
        if (get().generationToken !== token) return
        if (isPhaseContentReady(get().steps.find((s) => s.phase === phaseNumber))) {
          return
        }

        steps = patchPhase(get().steps, phaseNumber, {
          generationStatus: 'generating',
          generationError: null,
          streamingPreview: undefined,
          goal: '正在生成本章内容…',
        })
        set({ steps, progress: calculateProgress(steps), isGeneratingMore: true })

        let lastStreamUpdate = 0
        const applyStreamPreview = (accumulated: string) => {
          if (get().generationToken !== token) return
          const now = Date.now()
          if (now - lastStreamUpdate < 80) return
          lastStreamUpdate = now
          const preview = extractStreamingGuidePreview(accumulated)
          steps = patchPhase(get().steps, phaseNumber, {
            streamingPreview: accumulated,
            goal: preview.goal || '正在生成本章内容…',
            actionIntro: preview.actionIntro,
          })
          set({ steps })
        }

        try {
          const phase = await generateOnePhase({
            owner,
            repo,
            phaseNumber,
            userProfile,
            shared,
            onStream: applyStreamPreview,
          })
          if (get().generationToken !== token) return

          steps = patchPhase(get().steps, phaseNumber, {
            ...phase,
            id: `phase-${phaseNumber - 1}`,
            status:
              get().steps.find((item) => item.phase === phaseNumber)?.status ||
              (phaseNumber === 1 ? 'current' : 'pending'),
            generationStatus: 'ready',
            generationError: null,
            streamingPreview: undefined,
          })
          set({
            steps,
            progress: calculateProgress(steps),
            roadmap: get().roadmap
              ? { ...get().roadmap!, phases: steps }
              : get().roadmap,
          })
          persistCurrent(get)
        } catch (phaseError) {
          if (get().generationToken !== token) return
          const message = getErrorMessage(phaseError, '本章生成失败')
          steps = patchPhase(get().steps, phaseNumber, {
            generationStatus: 'failed',
            generationError: message,
            goal: '本章生成失败，可点击「重试本章」。',
            learningItems: [],
          })
          set({ steps, progress: calculateProgress(steps) })
          persistCurrent(get)
        }
      }

      // 第一章决定用户能否立刻开始阅读，优先生成；其余章节后台限并发补齐。
      await generatePhase(1)
      if (get().generationToken !== token) return

      const remainingPhases = titles
        .map((_, index) => index + 1)
        .filter((phaseNumber) => phaseNumber !== 1)
        .filter((phaseNumber) => !isPhaseContentReady(
          get().steps.find((step) => step.phase === phaseNumber),
        ))
      const concurrency = 1
      let cursor = 0
      const workers = Array.from(
        { length: Math.min(concurrency, remainingPhases.length) },
        async () => {
          while (cursor < remainingPhases.length) {
            if (get().generationToken !== token) return
            const phaseNumber = remainingPhases[cursor]
            cursor += 1
            await generatePhase(phaseNumber)
          }
        },
      )
      await Promise.all(workers)

      if (get().generationToken !== token) return
      set({ isGeneratingMore: false, isLoading: false })
      persistCurrent(get)
    } catch (err) {
      if (get().generationToken !== token) return
      const message = getErrorMessage(err, '贡献指南生成失败，请稍后重试')
      // 若已有可读章节，保留它们，只提示错误
      if (get().steps.some(isPhaseContentReady)) {
        set({ isLoading: false, isGeneratingMore: false })
        persistCurrent(get)
        return
      }
      set({
        isLoading: false,
        isGeneratingMore: false,
        error: message,
      })
    }
  },

  retryPhase: async (phaseNumber) => {
    const state = get()
    if (
      !state.currentOwner ||
      !state.currentRepo ||
      phaseNumber < 1 ||
      phaseNumber > DEFAULT_PHASE_TITLES.length
    ) {
      return
    }

    const userProfile = getEffectiveUserProfileContext()
    const issueContext = buildIssueContext()
    if (!issueContext) return

    const token = state.generationToken + 1
    set({
      generationToken: token,
      isGeneratingMore: true,
      steps: patchPhase(state.steps, phaseNumber, {
        generationStatus: 'generating',
        generationError: null,
        streamingPreview: undefined,
        goal: '正在重新生成本章…',
        learningItems: [],
      }),
    })

    let lastStreamUpdate = 0
    const applyStreamPreview = (accumulated: string) => {
      if (get().generationToken !== token) return
      const now = Date.now()
      if (now - lastStreamUpdate < 80) return
      lastStreamUpdate = now
      const preview = extractStreamingGuidePreview(accumulated)
      set({
        steps: patchPhase(get().steps, phaseNumber, {
          streamingPreview: accumulated,
          goal: preview.goal || '正在重新生成本章…',
          actionIntro: preview.actionIntro,
        }),
      })
    }

    try {
      let shared = get().sharedContext
      if (!shared) {
        const prepared = await aiService.prepareRoadmapContext(
          state.currentOwner,
          state.currentRepo,
          userProfile,
          issueContext,
        )
        if (get().generationToken !== token) return
        shared = {
          repository: prepared.repository,
          readme: prepared.readme,
          repositoryContext: prepared.repositoryContext,
          issueContext: prepared.issueContext,
        }
        set({ sharedContext: shared })
      }

      const phase = await generateOnePhase({
        owner: state.currentOwner,
        repo: state.currentRepo,
        phaseNumber,
        userProfile,
        shared,
        onStream: applyStreamPreview,
      })
      if (get().generationToken !== token) return

      const steps = patchPhase(get().steps, phaseNumber, {
        ...phase,
        id: `phase-${phaseNumber - 1}`,
        status:
          get().steps.find((item) => item.phase === phaseNumber)?.status ||
          'pending',
        generationStatus: 'ready',
        generationError: null,
        streamingPreview: undefined,
      })
      set({
        steps,
        progress: calculateProgress(steps),
        isGeneratingMore: false,
        roadmap: get().roadmap
          ? { ...get().roadmap!, phases: steps }
          : get().roadmap,
      })
      persistCurrent(get)
    } catch (error) {
      if (get().generationToken !== token) return
      const message = getErrorMessage(error, '本章重试失败')
      const steps = patchPhase(get().steps, phaseNumber, {
        generationStatus: 'failed',
        generationError: message,
        goal: '本章生成失败，可再次点击「重试本章」。',
        learningItems: [],
      })
      set({
        steps,
        progress: calculateProgress(steps),
        isGeneratingMore: false,
      })
      persistCurrent(get)
    }
  },

  retryFailedPhases: async () => {
    const failed = get()
      .steps.filter(
        (step) =>
          step.generationStatus === 'failed' || !isPhaseContentReady(step),
      )
      .map((step) => step.phase)
    for (const phaseNumber of failed) {
      await get().retryPhase(phaseNumber)
    }
  },

  toggleActionStep: (phaseNumber, stepId) => {
    const steps = get().steps.map((phase) => {
      if (phase.phase !== phaseNumber) return phase
      return {
        ...phase,
        actionSteps: (phase.actionSteps || []).map((step) =>
          step.id === stepId ? { ...step, completed: !step.completed } : step,
        ),
      }
    })
    set({ steps, progress: calculateProgress(steps) })
    persistCurrent(get)
  },

  toggleReproduceComplete: (phaseNumber) => {
    const steps = get().steps.map((phase) => {
      if (phase.phase !== phaseNumber || !phase.reproduce) return phase
      return {
        ...phase,
        reproduce: {
          ...phase.reproduce,
          completed: !phase.reproduce.completed,
        },
      }
    })
    set({ steps, progress: calculateProgress(steps) })
    persistCurrent(get)
  },

  nextStep: () => {
    const { steps } = get()
    const currentIndex = steps.findIndex((s) => s.status === 'current')
    if (currentIndex === -1 || currentIndex >= steps.length - 1) return

    const newSteps = steps.map((step, index) => {
      if (index === currentIndex) {
        return { ...step, status: 'completed' as RoadmapStepStatus }
      }
      if (index === currentIndex + 1) {
        return { ...step, status: 'current' as RoadmapStepStatus }
      }
      return step
    })
    set({ steps: newSteps, progress: calculateProgress(newSteps) })
    persistCurrent(get)
  },

  resetProgress: () => {
    const { steps } = get()
    if (steps.length === 0) return
    const newSteps = steps.map((step, index) => ({
      ...step,
      status: (index === 0 ? 'current' : 'pending') as RoadmapStepStatus,
      tasks: step.tasks.map((task) => ({ ...task, completed: false })),
    }))
    set({ steps: newSteps, progress: calculateProgress(newSteps) })
    persistCurrent(get)
  },

  updateStepStatus: (stepId, status) => {
    const { steps } = get()
    const targetIndex = steps.findIndex((step) => step.id === stepId)
    if (targetIndex < 0) return

    const newSteps = steps.map((step, index) => {
      if (step.id === stepId) return { ...step, status }
      if (
        status === 'completed' &&
        index === targetIndex + 1 &&
        step.status === 'pending'
      ) {
        return { ...step, status: 'current' as RoadmapStepStatus }
      }
      return step
    })
    set({ steps: newSteps, progress: calculateProgress(newSteps) })
    persistCurrent(get)
  },
}))

export default useRoadmapStore
