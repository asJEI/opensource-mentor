import { create } from 'zustand'
import type { PrType, PrDraft } from '@/types'
import { aiService } from '@/services'
import { getErrorMessage } from '@/services/errors'

/**
 * PR 生成状态 Store
 * 管理 PR 草稿生成的表单状态和结果
 */
interface PrState {
  /** PR 类型 */
  prType: PrType
  /** PR 摘要描述 */
  summary: string
  /** 关联的 Issue 编号 */
  linkedIssue: string
  /** 生成的 PR 草稿 */
  prDraft: PrDraft | null
  /** 是否正在生成 PR */
  isGenerating: boolean
  /** 生成错误信息 */
  error: string | null
  /** 当前仓库 owner */
  currentOwner: string
  /** 当前仓库 name */
  currentRepo: string

  // ---- Actions ----
  /** 设置 PR 类型 */
  setPrType: (type: PrType) => void
  /** 设置 PR 摘要 */
  setSummary: (text: string) => void
  /** 设置关联 Issue */
  setLinkedIssue: (text: string) => void
  /** 设置当前仓库 */
  setCurrentRepository: (owner: string, repo: string) => void
  /**
   * 生成 PR 草稿
   * 调用 aiService.generatePrDraft
   */
  generatePr: (issueNumber?: number, additionalContext?: string) => Promise<void>
  /** 重置 PR 生成状态 */
  resetPr: () => void
}

export const usePrStore = create<PrState>((set, get) => ({
  prType: 'bug',
  summary: '',
  linkedIssue: '',
  prDraft: null,
  isGenerating: false,
  error: null,
  currentOwner: '',
  currentRepo: '',

  setPrType: (type: PrType) => set({ prType: type }),

  setSummary: (text: string) => set({ summary: text }),

  setLinkedIssue: (text: string) => set({ linkedIssue: text }),

  setCurrentRepository: (owner: string, repo: string) => {
    set({ currentOwner: owner, currentRepo: repo })
  },

  generatePr: async (issueNumber?: number, additionalContext?: string) => {
    const { prType, currentOwner, currentRepo, linkedIssue } = get()
    const issueNum = issueNumber || (linkedIssue ? parseInt(linkedIssue, 10) : 0)

    if (!issueNum) {
      set({ error: '请输入关联的 Issue 编号' })
      return
    }

    set({ isGenerating: true, error: null })
    try {
      const draft = await aiService.generatePrDraft(
        currentOwner,
        currentRepo,
        issueNum,
        prType,
        additionalContext,
      )
      set({ prDraft: draft, isGenerating: false })
    } catch (err) {
      const message = getErrorMessage(err, 'PR 生成失败，请稍后重试')
      set({ isGenerating: false, error: message })
    }
  },

  resetPr: () =>
    set({
      prType: 'bug',
      summary: '',
      linkedIssue: '',
      prDraft: null,
      isGenerating: false,
      error: null,
    }),
}))

export default usePrStore
