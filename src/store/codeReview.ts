import { create } from 'zustand'
import type {
  ReviewStatus,
  ReviewProgress,
  ReviewResult,
  ReviewTab,
  RecommendedIssue,
  ReviewJobArtifacts,
  ReviewInputMode,
  ReviewCompareInput,
  CreateReviewRequest,
} from '@/types'
import { codeReviewService } from '@/services'
import { getErrorMessage } from '@/services/errors'

interface CodeReviewState {
  reviewId: string | null
  status: ReviewStatus
  progress: ReviewProgress
  result: ReviewResult | null
  error: string | null
  prUrl: string
  mode: ReviewInputMode
  sourceLabel: string
  createPrUrl: string | null
  artifacts: ReviewJobArtifacts | null
  selectedFile: string | null
  compareInput: ReviewCompareInput
  selectedIssue: RecommendedIssue | null
  activeTab: ReviewTab
  expandedIssueId: string | null
  _pollTimer: ReturnType<typeof setInterval> | null

  setPrUrl: (url: string) => void
  setMode: (mode: ReviewInputMode) => void
  setCompareInput: (input: Partial<ReviewCompareInput>) => void
  setSelectedFile: (filename: string | null) => void
  setSelectedIssue: (issue: RecommendedIssue | null) => void
  startReview: () => Promise<void>
  pollReview: () => Promise<void>
  setActiveTab: (tab: ReviewTab) => void
  toggleIssue: (id: string) => void
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

const emptyCompare: ReviewCompareInput = {
  baseOwner: '',
  baseRepo: '',
  baseRef: 'main',
  headOwner: '',
  headRepo: '',
  headRef: '',
}

export const useCodeReviewStore = create<CodeReviewState>((set, get) => ({
  reviewId: null,
  status: 'idle',
  progress: initialProgress,
  result: null,
  error: null,
  prUrl: '',
  mode: 'pr',
  sourceLabel: '',
  createPrUrl: null,
  artifacts: null,
  selectedFile: null,
  compareInput: emptyCompare,
  selectedIssue: null,
  activeTab: 'critical',
  expandedIssueId: null,
  _pollTimer: null,

  setPrUrl: (url: string) => set({ prUrl: url }),

  setMode: (mode) => set({ mode }),

  setCompareInput: (input) =>
    set((state) => ({
      compareInput: { ...state.compareInput, ...input },
    })),

  setSelectedFile: (filename) => set({ selectedFile: filename }),

  setSelectedIssue: (issue) => set({ selectedIssue: issue }),

  startReview: async () => {
    const { prUrl, mode, compareInput, _pollTimer } = get()

    let payload: CreateReviewRequest
    if (mode === 'compare') {
      const { baseOwner, baseRepo, baseRef, headOwner, headRepo, headRef } =
        compareInput
      if (!baseOwner.trim() || !baseRepo.trim()) {
        set({ error: '请填写上游仓库 owner/repo' })
        return
      }
      if (!headOwner.trim() || !headRef.trim()) {
        set({ error: '请填写你的 GitHub 用户名与分支名' })
        return
      }
      payload = {
        mode: 'compare',
        baseOwner: baseOwner.trim(),
        baseRepo: baseRepo.trim(),
        baseRef: (baseRef || 'main').trim(),
        headOwner: headOwner.trim(),
        headRepo: (headRepo || baseRepo).trim(),
        headRef: headRef.trim(),
      }
    } else {
      if (!prUrl.trim()) {
        set({ error: '请输入 PR 链接' })
        return
      }
      payload = { mode: 'pr', prUrl: prUrl.trim() }
    }

    if (_pollTimer) {
      clearInterval(_pollTimer)
    }

    set({
      status: 'queued',
      error: null,
      result: null,
      artifacts: null,
      selectedFile: null,
      createPrUrl: null,
      sourceLabel: '',
      progress: initialProgress,
    })

    try {
      const record = await codeReviewService.createReview(payload)
      const firstFile = record.artifacts?.changedFiles[0]?.filename || null
      set({
        reviewId: record.reviewId,
        status: record.status,
        progress: record.progress,
        result: record.result,
        error: record.error,
        prUrl: record.prUrl || get().prUrl,
        mode: record.mode || mode,
        sourceLabel: record.sourceLabel || '',
        createPrUrl: record.createPrUrl || null,
        artifacts: record.artifacts || null,
        selectedFile: firstFile,
      })

      if (record.status === 'completed' || record.status === 'failed') {
        return
      }

      const timer = setInterval(() => {
        void get().pollReview()
      }, 2000)
      set({ _pollTimer: timer })
    } catch (err) {
      const message = getErrorMessage(err, '创建审查任务失败，请稍后重试')
      set({ status: 'failed', error: message, _pollTimer: null })
    }
  },

  pollReview: async () => {
    const { reviewId, status, _pollTimer } = get()

    if (!reviewId) return

    if (status === 'completed' || status === 'failed') {
      if (_pollTimer) {
        clearInterval(_pollTimer)
        set({ _pollTimer: null })
      }
      return
    }

    try {
      const record = await codeReviewService.getReview(reviewId)
      set((state) => ({
        status: record.status,
        progress: record.progress,
        result: record.result,
        error: record.error,
        sourceLabel: record.sourceLabel || state.sourceLabel,
        createPrUrl: record.createPrUrl ?? state.createPrUrl,
        artifacts: record.artifacts || state.artifacts,
        selectedFile:
          state.selectedFile ||
          record.artifacts?.changedFiles[0]?.filename ||
          null,
      }))

      if (record.status === 'completed' || record.status === 'failed') {
        if (_pollTimer) {
          clearInterval(_pollTimer)
          set({ _pollTimer: null })
        }
      }
    } catch (err) {
      const message = getErrorMessage(err, '获取审查状态失败')
      set({ error: message })
    }
  },

  setActiveTab: (tab: ReviewTab) => set({ activeTab: tab }),

  toggleIssue: (id: string) => {
    const { expandedIssueId } = get()
    set({ expandedIssueId: expandedIssueId === id ? null : id })
  },

  reset: () => {
    const { _pollTimer, compareInput } = get()
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
      mode: 'pr',
      sourceLabel: '',
      createPrUrl: null,
      artifacts: null,
      selectedFile: null,
      compareInput,
      selectedIssue: null,
      activeTab: 'critical',
      expandedIssueId: null,
      _pollTimer: null,
    })
  },
}))

export default useCodeReviewStore
