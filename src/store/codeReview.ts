import { create } from 'zustand'
import type {
  ReviewStatus,
  ReviewProgress,
  ReviewResult,
  ReviewTab,
  RecommendedIssue,
} from '@/types'
import { codeReviewService } from '@/services'

/**
 * 代码审查状态 Store
 * 管理代码审查任务的创建、轮询、结果展示等状态
 */
interface CodeReviewState {
  /** 审查任务 ID */
  reviewId: string | null
  /** 审查任务状态 */
  status: ReviewStatus
  /** 审查进度 */
  progress: ReviewProgress
  /** 审查结果 */
  result: ReviewResult | null
  /** 错误信息 */
  error: string | null
  /** PR 链接 */
  prUrl: string
  /** 当前选中的 Issue（从 Issue 列表页跳转时带入） */
  selectedIssue: RecommendedIssue | null
  /** 当前激活的 Tab */
  activeTab: ReviewTab
  /** 当前展开的问题项 ID */
  expandedIssueId: string | null
  /** 轮询定时器 ID（内部使用） */
  _pollTimer: ReturnType<typeof setInterval> | null

  // ---- Actions ----
  /** 设置 PR 链接 */
  setPrUrl: (url: string) => void
  /** 设置选中的 Issue（跨页面传递） */
  setSelectedIssue: (issue: RecommendedIssue | null) => void
  /** 开始审查：创建任务 + 启动轮询 */
  startReview: () => Promise<void>
  /** 轮询审查状态 */
  pollReview: () => Promise<void>
  /** 设置当前激活的 Tab */
  setActiveTab: (tab: ReviewTab) => void
  /** 切换问题项展开/收起 */
  toggleIssue: (id: string) => void
  /** 重置所有状态 */
  reset: () => void
}

const initialProgress: ReviewProgress = {
  percent: 0,
  phases: {
    summary: 'pending',
    risk: 'pending',
    comments: 'pending',
  },
  lastEventAt: null,
}

export const useCodeReviewStore = create<CodeReviewState>((set, get) => ({
  reviewId: null,
  status: 'idle',
  progress: initialProgress,
  result: null,
  error: null,
  prUrl: '',
  selectedIssue: null,
  activeTab: 'critical',
  expandedIssueId: null,
  _pollTimer: null,

  setPrUrl: (url: string) => set({ prUrl: url }),

  setSelectedIssue: (issue) => set({ selectedIssue: issue }),

  startReview: async () => {
    const { prUrl, _pollTimer } = get()

    if (!prUrl.trim()) {
      set({ error: '请输入 PR 链接' })
      return
    }

    // 清除已有定时器
    if (_pollTimer) {
      clearInterval(_pollTimer)
    }

    set({ status: 'queued', error: null, result: null, progress: initialProgress })

    try {
      const { reviewId, status, progress } = await codeReviewService.createReview(prUrl.trim())
      set({ reviewId, status, progress })

      // 启动轮询：每 2 秒拉取一次状态
      const timer = setInterval(() => {
        void get().pollReview()
      }, 2000)
      set({ _pollTimer: timer })
    } catch (err) {
      const message = err instanceof Error ? err.message : '创建审查任务失败，请稍后重试'
      set({ status: 'failed', error: message, _pollTimer: null })
    }
  },

  pollReview: async () => {
    const { reviewId, status, _pollTimer } = get()

    if (!reviewId) return

    // 已结束状态不再轮询
    if (status === 'completed' || status === 'failed') {
      if (_pollTimer) {
        clearInterval(_pollTimer)
        set({ _pollTimer: null })
      }
      return
    }

    try {
      const record = await codeReviewService.getReview(reviewId)
      set({
        status: record.status,
        progress: record.progress,
        result: record.result,
        error: record.error,
      })

      // 任务结束，清除定时器
      if (record.status === 'completed' || record.status === 'failed') {
        if (_pollTimer) {
          clearInterval(_pollTimer)
          set({ _pollTimer: null })
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '获取审查状态失败'
      set({ error: message })
    }
  },

  setActiveTab: (tab: ReviewTab) => set({ activeTab: tab }),

  toggleIssue: (id: string) => {
    const { expandedIssueId } = get()
    set({ expandedIssueId: expandedIssueId === id ? null : id })
  },

  reset: () => {
    const { _pollTimer } = get()
    if (_pollTimer) {
      clearInterval(_pollTimer)
    }
    set({
      reviewId: null,
      status: 'idle',
      progress: initialProgress,
      result: null,
      error: null,
      prUrl: '',
      selectedIssue: null,
      activeTab: 'critical',
      expandedIssueId: null,
      _pollTimer: null,
    })
  },
}))

export default useCodeReviewStore
