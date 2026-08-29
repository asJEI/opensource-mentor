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

const DEFAULT_PHASE_TITLES = [
  '大致了解',
  '环境准备',
  '理解项目',
  '复现问题',
  '修正方案',
  '实现与验证',
  'PR 提交',
]

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

interface RoadmapState {
  roadmap: Roadmap | null
  steps: RoadmapPhase[]
  progress: RoadmapProgress
  isLoading: boolean
  /** 是否仍在后台生成后续章节 */
  isGeneratingMore: boolean
  error: string | null
  currentOwner: string
  currentRepo: string
  profileSignature: string
  generationToken: number

  loadRoadmap: (owner: string, repo: string, options?: { force?: boolean }) => Promise<void>
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

export const useRoadmapStore = create<RoadmapState>((set, get) => ({
  roadmap: null,
  steps: [],
  progress: initialProgress,
  isLoading: false,
  isGeneratingMore: false,
  error: null,
  currentOwner: '',
  currentRepo: '',
  profileSignature: '',
  generationToken: 0,

  loadRoadmap: async (owner, repo, options) => {
    const userProfile = getEffectiveUserProfileContext()
    const issueContext = buildIssueContext()
    if (!issueContext) {
      set({
        isLoading: false,
        isGeneratingMore: false,
        error: null,
        roadmap: null,
        steps: [],
        progress: initialProgress,
        currentOwner: owner,
        currentRepo: repo,
        profileSignature: '',
      })
      return
    }

    const profileSignature = JSON.stringify({ userProfile, issueContext })
    const current = get()
    if (
      !options?.force &&
      current.roadmap &&
      !current.error &&
      current.currentOwner === owner &&
      current.currentRepo === repo &&
      current.profileSignature === profileSignature &&
      current.steps.every((step) => step.generationStatus === 'ready')
    ) {
      return
    }

    const token = current.generationToken + 1
    set({
      isLoading: true,
      isGeneratingMore: false,
      error: null,
      currentOwner: owner,
      currentRepo: repo,
      profileSignature,
      generationToken: token,
      steps: createPlaceholderPhases(DEFAULT_PHASE_TITLES),
      progress: {
        currentStep: 0,
        totalSteps: DEFAULT_PHASE_TITLES.length,
        completedSteps: 0,
        percentage: 0,
      },
      roadmap: {
        title: '正在生成贡献指南…',
        description: '先读取仓库上下文，再按章节逐步生成。',
        totalEstimatedTime: '待确认',
        phases: [],
        tips: [],
        confidence: 0,
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

      const titles =
        prepared.phaseTitles?.length === DEFAULT_PHASE_TITLES.length
          ? prepared.phaseTitles
          : DEFAULT_PHASE_TITLES
      const placeholders = createPlaceholderPhases(titles)
      placeholders[0].generationStatus = 'generating'

      set({
        roadmap: {
          title: prepared.title,
          description: prepared.description,
          totalEstimatedTime: prepared.totalEstimatedTime || '待确认',
          phases: placeholders,
          tips: [],
          confidence: 0.7,
        },
        steps: placeholders,
        progress: calculateProgress(placeholders),
        isLoading: false,
        isGeneratingMore: true,
      })

      const shared = {
        repository: prepared.repository,
        readme: prepared.readme,
        repositoryContext: prepared.repositoryContext,
        issueContext: prepared.issueContext,
      }

      // 先生成第一章，立刻可阅读
      const firstPhase = await aiService.generateRoadmapPhase(
        owner,
        repo,
        1,
        userProfile,
        shared,
      )
      if (get().generationToken !== token) return

      let steps = patchPhase(get().steps, 1, {
        ...firstPhase,
        id: 'phase-0',
        status: 'current',
        generationStatus: 'ready' as RoadmapGenerationStatus,
        generationError: null,
      })
      set({
        steps,
        progress: calculateProgress(steps),
        roadmap: get().roadmap
          ? { ...get().roadmap!, phases: steps, title: prepared.title }
          : get().roadmap,
      })

      // 后台继续生成第 2-7 章
      for (let phaseNumber = 2; phaseNumber <= titles.length; phaseNumber += 1) {
        if (get().generationToken !== token) return

        steps = patchPhase(get().steps, phaseNumber, {
          generationStatus: 'generating',
          generationError: null,
          goal: '正在生成本章内容…',
        })
        set({ steps, progress: calculateProgress(steps), isGeneratingMore: true })

        try {
          const phase = await aiService.generateRoadmapPhase(
            owner,
            repo,
            phaseNumber,
            userProfile,
            shared,
          )
          if (get().generationToken !== token) return

          steps = patchPhase(get().steps, phaseNumber, {
            ...phase,
            id: `phase-${phaseNumber - 1}`,
            status:
              get().steps.find((item) => item.phase === phaseNumber)?.status ||
              'pending',
            generationStatus: 'ready',
            generationError: null,
          })
          set({
            steps,
            progress: calculateProgress(steps),
            roadmap: get().roadmap
              ? { ...get().roadmap!, phases: steps }
              : get().roadmap,
          })
        } catch (phaseError) {
          if (get().generationToken !== token) return
          const message = getErrorMessage(phaseError, '本章生成失败')
          steps = patchPhase(get().steps, phaseNumber, {
            generationStatus: 'failed',
            generationError: message,
            goal: '本章生成失败，可稍后重试整份指南。',
          })
          set({ steps, progress: calculateProgress(steps) })
        }
      }

      if (get().generationToken !== token) return
      set({ isGeneratingMore: false })
    } catch (err) {
      if (get().generationToken !== token) return
      const message = getErrorMessage(err, '贡献指南生成失败，请稍后重试')
      set({
        isLoading: false,
        isGeneratingMore: false,
        error: message,
      })
    }
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
  },
}))

export default useRoadmapStore
