import { create } from 'zustand'
import type { IssueExplain, LoadingState, RecommendedIssue } from '@/types'
import { repositoryService } from '@/services'

/**
 * Issue 解释状态 Store
 * 管理 Issue 的 AI 解释结果和弹窗状态
 */
interface IssueExplainState {
  /** 当前 Issue 的 AI 解释结果 */
  currentExplain: IssueExplain | null
  /** 解释加载状态 */
  explainStatus: LoadingState
  /** 解释错误信息 */
  explainError: string | null
  /** 解释弹窗是否可见 */
  modalVisible: boolean
  /** 当前解释的 Issue 数据 */
  currentIssue: RecommendedIssue | null
  /** 当前仓库 owner */
  currentOwner: string
  /** 当前仓库 name */
  currentRepo: string

  // ---- Actions ----
  /**
   * 获取 Issue 的 AI 解释
   * 调用 repositoryService.getIssueExplain
   */
  explainIssue: (owner: string, name: string, issue: RecommendedIssue) => Promise<void>
  /** 打开解释弹窗 */
  openModal: () => void
  /** 关闭解释弹窗 */
  closeModal: () => void
  /** 设置当前仓库 */
  setCurrentRepository: (owner: string, repo: string) => void
}

export const useIssueExplainStore = create<IssueExplainState>((set) => ({
  currentExplain: null,
  explainStatus: 'idle',
  explainError: null,
  modalVisible: false,
  currentIssue: null,
  currentOwner: 'microsoft',
  currentRepo: 'vscode',

  explainIssue: async (owner: string, name: string, issue: RecommendedIssue) => {
    set({
      explainStatus: 'loading',
      explainError: null,
      currentIssue: issue,
      currentOwner: owner,
      currentRepo: name,
    })
    try {
      const explain = await repositoryService.getIssueExplain(owner, name, issue)
      set({
        currentExplain: explain,
        explainStatus: 'success',
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Issue 解释失败，请稍后重试'
      set({ explainStatus: 'error', explainError: message })
    }
  },

  openModal: () => set({ modalVisible: true }),

  closeModal: () => set({ modalVisible: false }),

  setCurrentRepository: (owner: string, repo: string) => {
    set({ currentOwner: owner, currentRepo: repo })
  },
}))

export default useIssueExplainStore
