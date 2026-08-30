import { create } from 'zustand'
import type {
  Repository,
  RepoAnalysis,
  Issue,
  IssueExplain,
  RecommendedIssue,
  CandidateIssue,
  CandidateIssueAnalysisResult,
  CandidateIssuesMeta,
  LoadingState,
} from '@/types'
import { githubService, repositoryService } from '@/services'
import { getErrorMessage } from '@/services/errors'
import { getEffectiveUserProfileContext } from './user'

// localStorage 键名
const STORAGE_KEY = 'opensource-mentor:repository'

/**
 * 从 localStorage 读取保存的仓库信息
 */
function loadSavedRepository(): {
  owner: string
  repoName: string
  hasData: boolean
  activeIssue: CandidateIssue | null
} {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (parsed.owner && parsed.repoName) {
        return {
          owner: parsed.owner,
          repoName: parsed.repoName,
          hasData: true,
          activeIssue: parsed.activeIssue ?? null,
        }
      }
    }
  } catch {
    // 忽略读取错误
  }
  return { owner: 'microsoft', repoName: 'vscode', hasData: false, activeIssue: null }
}

/**
 * 保存仓库信息到 localStorage
 */
function saveRepositoryToStorage(
  owner: string,
  repoName: string,
  activeIssue?: CandidateIssue | null,
) {
  try {
    const previous = localStorage.getItem(STORAGE_KEY)
    const previousIssue =
      activeIssue === undefined && previous
        ? JSON.parse(previous).activeIssue ?? null
        : null
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        owner,
        repoName,
        activeIssue: activeIssue === undefined ? previousIssue : activeIssue,
      }),
    )
  } catch {
    // 忽略保存错误
  }
}

/**
 * 清除 localStorage 中的仓库信息
 */
function clearRepositoryFromStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // 忽略清除错误
  }
}

/**
 * 仓库相关状态 Store
 * 管理当前选中的仓库、分析结果、Issue 列表、推荐 Issue 等
 */
interface RepositoryState {
  /** 当前选中的仓库 */
  currentRepo: Repository | null
  /** 仓库 AI 分析结果（新版） */
  analysis: RepoAnalysis | null
  /** 仓库分析加载状态 */
  analysisStatus: LoadingState
  /** 仓库分析错误信息 */
  analysisError: string | null
  /** 仓库 Issue 列表（基础） */
  issues: Issue[]
  /** AI 推荐的 Issue 列表 */
  recommendedIssues: RecommendedIssue[]
  /** Issue 加载状态 */
  issuesStatus: LoadingState
  /** Issue 加载错误信息 */
  issuesError: string | null
  /** 当前选中的推荐 Issue */
  selectedIssue: RecommendedIssue | null
  /** 登录后根据用户画像拉取的候选 Issue */
  candidateIssues: CandidateIssue[]
  candidateIssuesMeta: CandidateIssuesMeta | null
  candidateIssuesStatus: LoadingState
  candidateIssuesError: string | null
  candidateIssueAnalysisStatus: Record<string, LoadingState>
  /** 用户点击 Start Contribution 后选中的当前贡献 Issue */
  activeContributionIssue: CandidateIssue | null
  /** 当前仓库 owner */
  currentOwner: string
  /** 当前仓库 name */
  currentRepoName: string
  /** 当前 Issue 的 AI 解释结果 */
  currentExplain: IssueExplain | null
  explainStatus: LoadingState
  explainError: string | null
  modalVisible: boolean
  currentIssue: RecommendedIssue | null

  // ---- Actions ----
  /**
   * 分析仓库
   * 调用 repositoryService.analyzeRepository 获取分析结果
   */
  analyzeRepo: (owner: string, name: string) => Promise<void>
  /**
   * 加载推荐 Issue 列表
   * 调用 repositoryService.getRecommendedIssues
   */
  loadRecommendedIssues: (
    owner: string,
    name: string,
    params?: {
      state?: 'open' | 'closed' | 'all'
      labels?: string
      perPage?: number
      page?: number
    },
  ) => Promise<void>
  /** 选中某个推荐 Issue */
  selectIssue: (issue: RecommendedIssue | null) => void
  /** 加载登录用户候选 Issue */
  loadCandidateIssues: () => Promise<void>
  analyzeCandidateIssue: (
    issue: CandidateIssue,
    options?: { force?: boolean },
  ) => Promise<void>
  /** 选择候选 Issue 开始贡献 */
  startContribution: (issue: CandidateIssue) => void
  /** 设置当前仓库信息 */
  setCurrentRepo: (repo: Repository | null) => void
  /** 清空仓库相关所有状态 */
  clearRepo: () => void
  explainIssue: (
    owner: string,
    name: string,
    issue: RecommendedIssue,
  ) => Promise<void>
  openModal: () => void
  closeModal: () => void
}

// 从 localStorage 读取保存的仓库信息
const savedRepo = loadSavedRepository()

export const useRepositoryStore = create<RepositoryState>((set, get) => {
  let analysisRequestId = 0
  let issuesRequestId = 0
  let explainRequestId = 0

  return {
    currentRepo: null,
    analysis: null,
    analysisStatus: 'idle',
    analysisError: null,
    issues: [],
    recommendedIssues: [],
    issuesStatus: 'idle',
    issuesError: null,
    selectedIssue: savedRepo.activeIssue,
    candidateIssues: [],
    candidateIssuesMeta: null,
    candidateIssuesStatus: 'idle',
    candidateIssuesError: null,
    candidateIssueAnalysisStatus: {},
    activeContributionIssue: savedRepo.activeIssue,
    currentOwner: savedRepo.owner,
    currentRepoName: savedRepo.repoName,
    currentExplain: null,
    explainStatus: 'idle',
    explainError: null,
    modalVisible: false,
    currentIssue: null,

    analyzeRepo: async (owner: string, name: string) => {
      const requestId = ++analysisRequestId
      set({
        analysisStatus: 'loading',
        analysisError: null,
        currentOwner: owner,
        currentRepoName: name,
      })
      // 保存到 localStorage
      saveRepositoryToStorage(owner, name)
      try {
        const { repository, analysis } =
          await repositoryService.analyzeRepository(owner, name)
        if (requestId !== analysisRequestId) return
        set({
          analysis,
          analysisStatus: 'success',
          currentRepo: repository,
        })
      } catch (err) {
        if (requestId !== analysisRequestId) return
        const message = getErrorMessage(err, '仓库分析失败，请稍后重试')
        set({ analysisStatus: 'error', analysisError: message })
      }
    },

    loadRecommendedIssues: async (owner: string, name: string, params) => {
      const requestId = ++issuesRequestId
      const userProfile = getEffectiveUserProfileContext()

      set({
        issuesStatus: 'loading',
        issuesError: null,
        currentOwner: owner,
        currentRepoName: name,
      })
      // 保存到 localStorage
      saveRepositoryToStorage(owner, name)
      try {
        const recommendedIssues = await repositoryService.getRecommendedIssues(
          owner,
          name,
          userProfile,
          params,
        )
        if (requestId !== issuesRequestId) return
        set({
          recommendedIssues,
          issues: recommendedIssues,
          issuesStatus: 'success',
        })
      } catch (err) {
        if (requestId !== issuesRequestId) return
        const message = getErrorMessage(err, '加载 Issue 列表失败，请稍后重试')
        set({ issuesStatus: 'error', issuesError: message })
      }
    },

    selectIssue: (issue: RecommendedIssue | null) =>
      set({ selectedIssue: issue }),

    loadCandidateIssues: async () => {
      const requestId = ++issuesRequestId
      set({
        candidateIssuesStatus: 'loading',
        candidateIssuesError: null,
      })
      try {
        const result = await githubService.getCandidateIssues()
        if (requestId !== issuesRequestId) return
        set({
          candidateIssues: result.issues,
          candidateIssuesMeta: result.meta,
          candidateIssuesStatus: 'success',
          candidateIssueAnalysisStatus: result.issues.reduce<Record<string, LoadingState>>(
            (acc, issue) => {
              acc[issue.id] = issue.analysis ? 'success' : 'idle'
              return acc
            },
            {},
          ),
        })
      } catch (err) {
        if (requestId !== issuesRequestId) return
        const message = getErrorMessage(err, '加载候选 Issue 失败，请稍后重试')
        set({
          candidateIssuesStatus: 'error',
          candidateIssuesError: message,
        })
      }
    },

    analyzeCandidateIssue: async (issue: CandidateIssue, options) => {
      const currentStatus = get().candidateIssueAnalysisStatus[issue.id]
      if (currentStatus === 'loading') return
      if (currentStatus === 'success' && !options?.force) return

      set((state) => ({
        candidateIssueAnalysisStatus: {
          ...state.candidateIssueAnalysisStatus,
          [issue.id]: 'loading',
        },
      }))

      try {
        const result: CandidateIssueAnalysisResult =
          await githubService.analyzeCandidateIssue(issue)
        set((state) => ({
          candidateIssues: state.candidateIssues
            .map((candidate) =>
              candidate.id === result.issueId
                ? {
                    ...candidate,
                    analysis: result.analysis,
                    whyThisFitsYou: result.whyThisFitsYou,
                    matchScore: result.matchScore,
                    candidateMatchDetails: result.matchDetails,
                    recommendationFallback: result.recommendationFallback,
                    contributionAccess:
                      result.contributionAccess || candidate.contributionAccess,
                    claimHint: result.claimHint || candidate.claimHint,
                    availability: result.availability || candidate.availability,
                  }
                : candidate,
            )
            .sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0)),
          candidateIssueAnalysisStatus: {
            ...state.candidateIssueAnalysisStatus,
            [result.issueId]: 'success',
          },
        }))
      } catch {
        set((state) => ({
          candidateIssueAnalysisStatus: {
            ...state.candidateIssueAnalysisStatus,
            [issue.id]: 'error',
          },
        }))
      }
    },

    startContribution: (issue: CandidateIssue) => {
      set({
        activeContributionIssue: issue,
        selectedIssue: issue,
        currentOwner: issue.repository.owner,
        currentRepoName: issue.repository.name,
        analysisStatus: 'idle',
        analysisError: null,
        issuesStatus: 'idle',
        issuesError: null,
      })
      saveRepositoryToStorage(issue.repository.owner, issue.repository.name, issue)
    },

    setCurrentRepo: (repo: Repository | null) => set({ currentRepo: repo }),

    explainIssue: async (owner, name, issue) => {
      const requestId = ++explainRequestId
      set({
        explainStatus: 'loading',
        explainError: null,
        currentIssue: issue,
        currentOwner: owner,
        currentRepoName: name,
      })
      try {
        const currentExplain = await repositoryService.getIssueExplain(
          owner,
          name,
          issue,
        )
        if (requestId !== explainRequestId) return
        set({ currentExplain, explainStatus: 'success' })
      } catch (err) {
        if (requestId !== explainRequestId) return
        set({
          explainStatus: 'error',
          explainError: getErrorMessage(err, 'Issue 解释失败，请稍后重试'),
        })
      }
    },

    openModal: () => set({ modalVisible: true }),
    closeModal: () => set({ modalVisible: false }),

    clearRepo: () => {
      analysisRequestId += 1
      issuesRequestId += 1
      explainRequestId += 1
      clearRepositoryFromStorage()
      set({
        currentRepo: null,
        analysis: null,
        analysisStatus: 'idle',
        analysisError: null,
        issues: [],
        recommendedIssues: [],
        issuesStatus: 'idle',
        issuesError: null,
        selectedIssue: null,
        candidateIssues: [],
        candidateIssuesMeta: null,
        candidateIssuesStatus: 'idle',
        candidateIssuesError: null,
        candidateIssueAnalysisStatus: {},
        activeContributionIssue: null,
        currentOwner: 'microsoft',
        currentRepoName: 'vscode',
        currentExplain: null,
        explainStatus: 'idle',
        explainError: null,
        modalVisible: false,
        currentIssue: null,
      })
    },
  }
})

export default useRepositoryStore
