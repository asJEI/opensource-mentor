import { create } from 'zustand'
import type { Repository, RepoAnalysis, Issue, RecommendedIssue, LoadingState } from '@/types'
import { repositoryService } from '@/services'
import { selectUserProfileContext, useUserStore } from './user'

// localStorage 键名
const STORAGE_KEY = 'opensource-mentor:repository'

/**
 * 从 localStorage 读取保存的仓库信息
 */
function loadSavedRepository(): { owner: string; repoName: string; hasData: boolean } {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (parsed.owner && parsed.repoName) {
        return { owner: parsed.owner, repoName: parsed.repoName, hasData: true }
      }
    }
  } catch {
    // 忽略读取错误
  }
  return { owner: 'microsoft', repoName: 'vscode', hasData: false }
}

/**
 * 保存仓库信息到 localStorage
 */
function saveRepositoryToStorage(owner: string, repoName: string) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ owner, repoName }))
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
  /** 当前仓库 owner */
  currentOwner: string
  /** 当前仓库 name */
  currentRepoName: string

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
  loadRecommendedIssues: (owner: string, name: string, params?: {
    state?: 'open' | 'closed' | 'all'
    labels?: string
    perPage?: number
    page?: number
  }) => Promise<void>
  /** 选中某个推荐 Issue */
  selectIssue: (issue: RecommendedIssue | null) => void
  /** 设置当前仓库信息 */
  setCurrentRepo: (repo: Repository | null) => void
  /** 清空仓库相关所有状态 */
  clearRepo: () => void
}

// 从 localStorage 读取保存的仓库信息
const savedRepo = loadSavedRepository()

export const useRepositoryStore = create<RepositoryState>((set) => ({
  currentRepo: null,
  analysis: null,
  analysisStatus: 'idle',
  analysisError: null,
  issues: [],
  recommendedIssues: [],
  issuesStatus: 'idle',
  issuesError: null,
  selectedIssue: null,
  currentOwner: savedRepo.owner,
  currentRepoName: savedRepo.repoName,

  analyzeRepo: async (owner: string, name: string) => {
    set({ analysisStatus: 'loading', analysisError: null, currentOwner: owner, currentRepoName: name })
    // 保存到 localStorage
    saveRepositoryToStorage(owner, name)
    try {
      const { repository, analysis } = await repositoryService.analyzeRepository(owner, name)
      set({
        analysis,
        analysisStatus: 'success',
        currentRepo: repository,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : '仓库分析失败，请稍后重试'
      set({ analysisStatus: 'error', analysisError: message })
    }
  },

  loadRecommendedIssues: async (owner: string, name: string, params) => {
    const userProfile = selectUserProfileContext(useUserStore.getState())
    // 首次画像尚未处理时先不请求，避免默认结果覆盖用户刚填写后的个性化结果
    if (userProfile.profileSetupStatus === 'not_started') return

    set({ issuesStatus: 'loading', issuesError: null, currentOwner: owner, currentRepoName: name })
    // 保存到 localStorage
    saveRepositoryToStorage(owner, name)
    try {
      const recommendedIssues = await repositoryService.getRecommendedIssues(
        owner,
        name,
        userProfile,
        params,
      )
      set({
        recommendedIssues,
        issues: recommendedIssues,
        issuesStatus: 'success',
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载 Issue 列表失败，请稍后重试'
      set({ issuesStatus: 'error', issuesError: message })
    }
  },

  selectIssue: (issue: RecommendedIssue | null) => set({ selectedIssue: issue }),

  setCurrentRepo: (repo: Repository | null) => set({ currentRepo: repo }),

  clearRepo: () => {
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
      currentOwner: 'microsoft',
      currentRepoName: 'vscode',
    })
  },
}))

export default useRepositoryStore
