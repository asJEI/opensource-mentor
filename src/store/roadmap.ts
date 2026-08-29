import { create } from 'zustand'
import type { Roadmap, RoadmapPhase, RoadmapProgress, RoadmapStepStatus } from '@/types'
import { aiService } from '@/services'
import { getErrorMessage } from '@/services/errors'
import { getEffectiveUserProfileContext } from './user'
import { useRepositoryStore } from './repository'

/**
 * 计算路线图进度
 */
function calculateProgress(phases: RoadmapPhase[]): RoadmapProgress {
  const totalSteps = phases.length
  const completedSteps = phases.filter((s) => s.status === 'completed').length
  const percentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0
  const currentStepIndex = phases.findIndex((s) => s.status === 'current')
  const currentStep = currentStepIndex >= 0 ? currentStepIndex : 0

  return {
    currentStep,
    totalSteps,
    completedSteps,
    percentage,
  }
}

/**
 * 路线图状态 Store
 * 管理贡献路线图的阶段、进度和加载状态
 */
interface RoadmapState {
  /** 路线图完整数据 */
  roadmap: Roadmap | null
  /** 路线图阶段列表（从 roadmap.phases 派生） */
  steps: RoadmapPhase[]
  /** 路线图进度 */
  progress: RoadmapProgress
  /** 是否正在加载路线图 */
  isLoading: boolean
  /** 加载错误信息 */
  error: string | null
  /** 当前路线图所属的仓库 owner */
  currentOwner: string
  /** 当前路线图所属的仓库名 */
  currentRepo: string
  /** 生成当前缓存路线时使用的画像签名 */
  profileSignature: string

  // ---- Actions ----
  /**
   * 加载/生成 Contribution Guide
   * 调用 aiService.generateRoadmap
   */
  loadRoadmap: (owner: string, repo: string, options?: { force?: boolean }) => Promise<void>
  /** 进入下一阶段 */
  nextStep: () => void
  /** 重置进度 */
  resetProgress: () => void
  /**
   * 更新指定阶段的状态
   */
  updateStepStatus: (stepId: string, status: RoadmapStepStatus) => void
}

const initialProgress: RoadmapProgress = {
  currentStep: 0,
  totalSteps: 0,
  completedSteps: 0,
  percentage: 0,
}

export const useRoadmapStore = create<RoadmapState>((set, get) => ({
  roadmap: null,
  steps: [],
  progress: initialProgress,
  isLoading: false,
  error: null,
  currentOwner: '',
  currentRepo: '',
  profileSignature: '',

  loadRoadmap: async (owner, repo, options) => {
    const userProfile = getEffectiveUserProfileContext()
    const repositoryState = useRepositoryStore.getState()
    const activeIssue = repositoryState.activeContributionIssue
    if (!activeIssue) {
      set({
        isLoading: false,
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

    const issueContext = {
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

    const profileSignature = JSON.stringify({ userProfile, issueContext })
    const current = get()
    if (
      !options?.force &&
      current.roadmap &&
      !current.error &&
      current.currentOwner === owner &&
      current.currentRepo === repo &&
      current.profileSignature === profileSignature
    ) {
      return
    }

    set({
      isLoading: true,
      error: null,
      currentOwner: owner,
      currentRepo: repo,
      profileSignature,
    })
    try {
      const roadmap = await aiService.generateRoadmap(
        owner,
        repo,
        userProfile,
        issueContext,
      )
      const steps = roadmap.phases
      // 标记第一步为当前步骤
      if (steps.length > 0) {
        steps[0].status = 'current'
      }
      const progress = calculateProgress(steps)
      if (
        get().profileSignature !== profileSignature ||
        get().currentOwner !== owner ||
        get().currentRepo !== repo
      ) return
      set({ roadmap, steps, progress, isLoading: false })
    } catch (err) {
      if (
        get().profileSignature !== profileSignature ||
        get().currentOwner !== owner ||
        get().currentRepo !== repo
      ) return
      const message = getErrorMessage(err, 'Contribution Guide 生成失败，请稍后重试')
      set({ isLoading: false, error: message })
    }
  },

  nextStep: () => {
    const { steps } = get()
    const currentIndex = steps.findIndex((s) => s.status === 'current')

    if (currentIndex === -1 || currentIndex >= steps.length - 1) {
      return
    }

    const newSteps = steps.map((step, index) => {
      if (index === currentIndex) {
        return { ...step, status: 'completed' as RoadmapStepStatus }
      }
      if (index === currentIndex + 1) {
        return { ...step, status: 'current' as RoadmapStepStatus }
      }
      return step
    })

    const progress = calculateProgress(newSteps)
    set({ steps: newSteps, progress })
  },

  resetProgress: () => {
    const { steps } = get()
    if (steps.length === 0) return

    const newSteps = steps.map((step, index) => ({
      ...step,
      status: (index === 0 ? 'current' : 'pending') as RoadmapStepStatus,
      tasks: step.tasks.map((task) => ({ ...task, completed: false })),
    }))

    const progress = calculateProgress(newSteps)
    set({ steps: newSteps, progress })
  },

  updateStepStatus: (stepId: string, status: RoadmapStepStatus) => {
    const { steps } = get()
    const targetIndex = steps.findIndex((step) => step.id === stepId)
    if (targetIndex < 0) return

    const newSteps = steps.map((step, index) => {
      if (step.id === stepId) {
        return { ...step, status }
      }
      if (
        status === 'completed' &&
        index === targetIndex + 1 &&
        step.status === 'pending'
      ) {
        return { ...step, status: 'current' as RoadmapStepStatus }
      }
      return step
    })
    const progress = calculateProgress(newSteps)
    set({ steps: newSteps, progress })
  },

}))

export default useRoadmapStore
