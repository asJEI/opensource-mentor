import { workspaceScope, type WorkspaceKind, type WorkspacePayloads } from '@shared/workspace'
import { workspaceService } from '@/services/workspaceService'
import { useUserStore } from '@/store/user'
import { useRepositoryStore } from '@/store/repository'
import { useRoadmapStore } from '@/store/roadmap'
import { useChatStore } from '@/store/chat'
import { usePrStore } from '@/store/pr'
import { useCodeReviewStore } from '@/store/codeReview'
import { useWorkspaceStore } from '@/store/workspace'
import { WorkspaceSync } from './workspaceSync'

let applying = false
let switching = false
let userId: string | null = null
let scope = 'workspace'
let contextGeneration = 0
let legacy: WorkspacePayloads | null = null
const scopeFor = (selection: WorkspacePayloads['selection']) =>
  workspaceScope(
    selection.currentOwner,
    selection.currentRepoName,
    selection.activeContributionIssue?.issueNumber,
  )

export function captureWorkspace(): WorkspacePayloads {
  const repo = useRepositoryStore.getState(),
    guide = useRoadmapStore.getState(),
    chat = useChatStore.getState(),
    pr = usePrStore.getState(),
    review = useCodeReviewStore.getState()
  const steps = guide.steps.map(({ streamingPreview, ...step }) =>
    streamingPreview ? { ...step, goal: '正在生成本章内容…', actionIntro: undefined } : step,
  )
  return {
    selection: {
      currentOwner: repo.currentOwner,
      currentRepoName: repo.currentRepoName,
      activeContributionIssue: repo.activeContributionIssue,
    },
    repository: {
      currentRepo: repo.currentRepo,
      analysis: repo.analysis,
      currentExplain: repo.currentExplain,
    },
    guide: {
      roadmap: guide.roadmap ? { ...guide.roadmap, phases: steps } : null,
      steps,
      currentOwner: guide.currentOwner,
      currentRepo: guide.currentRepo,
      cacheKey: guide.cacheKey,
    },
    chat: {
      messages: chat.messages,
      sessionId: chat.sessionId,
      currentOwner: chat.currentOwner,
      currentRepo: chat.currentRepo,
      guideContext: chat.guideContext,
    },
    pr: {
      prType: pr.prType,
      summary: pr.summary,
      linkedIssue: pr.linkedIssue,
      prDraft: pr.prDraft,
      currentOwner: pr.currentOwner,
      currentRepo: pr.currentRepo,
    },
    review: {
      reviewId: review.reviewId,
      status: review.status,
      progress: review.progress,
      result: review.result,
      error: review.error,
      prUrl: review.prUrl,
      mode: review.mode,
      sourceLabel: review.sourceLabel,
      createPrUrl: review.createPrUrl,
      artifacts: review.artifacts,
      compareInput: review.compareInput,
    },
  }
}
function apply(kind: WorkspaceKind, content: WorkspacePayloads[WorkspaceKind]) {
  applying = true
  try {
    switch (kind) {
      case 'selection': {
        const data = content as WorkspacePayloads['selection']
        useRepositoryStore.setState({ ...data, selectedIssue: data.activeContributionIssue })
        break
      }
      case 'repository': {
        const data = content as WorkspacePayloads['repository']
        useRepositoryStore.setState({
          ...data,
          analysisStatus: data.analysis ? 'success' : 'idle',
          explainStatus: data.currentExplain ? 'success' : 'idle',
        })
        break
      }
      case 'guide': {
        const data = content as WorkspacePayloads['guide']
        const steps = data.steps.map((step) =>
          ['generating', 'queued'].includes(step.generationStatus || '')
            ? {
                ...step,
                generationStatus: 'failed' as const,
                generationError: '上次生成已中断，可重试本章',
              }
            : step,
        )
        useRoadmapStore.setState({
          ...data,
          steps,
          roadmap: data.roadmap ? { ...data.roadmap, phases: steps } : null,
          progress: {
            currentStep: Math.max(
              0,
              steps.findIndex((step) => step.status === 'current'),
            ),
            totalSteps: steps.length,
            completedSteps: steps.filter((step) => step.status === 'completed').length,
            percentage: steps.length
              ? Math.round(
                  (100 * steps.filter((step) => step.status === 'completed').length) / steps.length,
                )
              : 0,
          },
          isLoading: false,
          isGeneratingMore: false,
          error: null,
          sharedContext: null,
        })
        break
      }
      case 'chat':
        useChatStore.setState({
          ...(content as WorkspacePayloads['chat']),
          isStreaming: false,
          error: null,
        })
        break
      case 'pr':
        usePrStore.setState({
          ...(content as WorkspacePayloads['pr']),
          isGenerating: false,
          error: null,
        })
        break
      case 'review': {
        const data = content as WorkspacePayloads['review']
        useCodeReviewStore.setState({
          ...data,
          status: data.status === 'running' || data.status === 'queued' ? 'failed' : data.status,
          error:
            data.status === 'running' || data.status === 'queued'
              ? '上次审查未完成，请重新发起'
              : data.error,
        })
        break
      }
    }
  } finally {
    applying = false
  }
}
export const workspaceSync = new WorkspaceSync(
  workspaceService,
  {
    getItem: (key) => localStorage.getItem(key),
    setItem: (key, value) => localStorage.setItem(key, value),
  },
  (recordScope, kind, content) => {
    if (kind === 'selection') apply(kind, content)
    else if (recordScope === scope) apply(kind, content)
    if (
      kind === 'selection' &&
      !switching &&
      scopeFor(content as WorkspacePayloads['selection']) !== scope
    )
      void restoreContext()
  },
  (state) => useWorkspaceStore.setState({ ...state, contextId: workspaceSync.contextId(scope) }),
)

function resetTools() {
  applying = true
  try {
    const guide = useRoadmapStore.getState()
    useRoadmapStore.setState({
      roadmap: null,
      steps: [],
      progress: { currentStep: 0, totalSteps: 0, completedSteps: 0, percentage: 0 },
      currentOwner: '',
      currentRepo: '',
      cacheKey: '',
      sharedContext: null,
      generationToken: guide.generationToken + 1,
      isLoading: false,
      isGeneratingMore: false,
      error: null,
    })
    useChatStore.getState().clearChat()
    useChatStore.setState({
      currentOwner: useRepositoryStore.getState().currentOwner,
      currentRepo: useRepositoryStore.getState().currentRepoName,
    })
    usePrStore.getState().resetPr()
    usePrStore.setState({
      currentOwner: useRepositoryStore.getState().currentOwner,
      currentRepo: useRepositoryStore.getState().currentRepoName,
    })
    useCodeReviewStore.getState().reset()
    useCodeReviewStore.setState({ compareInput: useCodeReviewStore.getInitialState().compareInput })
    useRepositoryStore.getState().invalidateRequests()
    useRepositoryStore.setState({
      currentRepo: null,
      analysis: null,
      currentExplain: null,
      currentIssue: null,
      analysisStatus: 'idle',
      analysisError: null,
      explainStatus: 'idle',
      explainError: null,
      issues: [],
      recommendedIssues: [],
      issuesStatus: 'idle',
      issuesError: null,
    })
  } finally {
    applying = false
  }
}
async function restoreContext() {
  const generation = ++contextGeneration
  switching = true
  useWorkspaceStore.setState({ restoring: true })
  scope = scopeFor(captureWorkspace().selection)
  resetTools()
  await workspaceSync.load(scope)
  if (generation !== contextGeneration) return
  switching = false
  useWorkspaceStore.setState({ restoring: false })
  void workspaceSync.flush()
}
async function activate(nextUser: string | null) {
  const generation = ++contextGeneration
  const previousUser = userId
  if (!previousUser && nextUser) {
    legacy = captureWorkspace()
    // An old guide can still be in sessionStorage without having been loaded into Zustand.
    if (legacy.selection.activeContributionIssue && !legacy.guide.roadmap) {
      try {
        const selection = legacy.selection
        const key = `osm.contribution-guide.v1:${selection.currentOwner}/${selection.currentRepoName}#${selection.activeContributionIssue!.issueNumber}`
        const saved = JSON.parse(sessionStorage.getItem(key) || 'null')
        if (saved?.roadmap && Array.isArray(saved.steps))
          legacy.guide = {
            roadmap: saved.roadmap,
            steps: saved.steps,
            cacheKey: key,
            currentOwner: selection.currentOwner,
            currentRepo: selection.currentRepoName,
          }
      } catch {
        /* Invalid legacy data remains untouched. */
      }
    }
  }
  workspaceSync.stop()
  userId = nextUser
  switching = true
  useWorkspaceStore.setState({
    userId: nextUser,
    restoring: !!nextUser,
    legacyAvailable: !!nextUser && !!legacy?.selection.currentOwner,
    contextId: null,
  })
  applying = true
  useRepositoryStore.getState().clearRepo({ preserveStorage: true })
  applying = false
  resetTools()
  scope = 'workspace'
  if (!nextUser) {
    switching = false
    return
  }
  await workspaceSync.start(nextUser)
  if (generation !== contextGeneration) return
  scope = scopeFor(captureWorkspace().selection)
  if (scope !== 'workspace') await workspaceSync.load(scope)
  if (generation !== contextGeneration) return
  switching = false
  useWorkspaceStore.setState({ restoring: false })
  void workspaceSync.flush()
}
export async function importLegacyWorkspace() {
  if (!legacy || !userId) return
  const imported = legacy
  apply('selection', imported.selection)
  await restoreContext()
  for (const kind of ['repository', 'guide', 'chat', 'pr', 'review'] as const)
    apply(kind, imported[kind])
  workspaceSync.update('workspace', 'selection', imported.selection)
  for (const kind of ['repository', 'guide', 'chat', 'pr', 'review'] as const)
    workspaceSync.update(scope, kind, imported[kind])
  await workspaceSync.flush()
  if (!workspaceSync.hasPending()) {
    legacy = null
    useWorkspaceStore.setState({ legacyAvailable: false })
  }
}
export async function refreshWorkspace() {
  if (
    useRoadmapStore.getState().isGeneratingMore ||
    useRoadmapStore.getState().isLoading ||
    useChatStore.getState().isStreaming ||
    usePrStore.getState().isGenerating ||
    ['running', 'queued'].includes(useCodeReviewStore.getState().status)
  ) {
    void workspaceSync.flush()
    return
  }
  if (!userId || switching || workspaceSync.hasPending()) {
    void workspaceSync.flush()
    return
  }
  const before = scope
  const generation = contextGeneration
  switching = true
  await workspaceSync.load('workspace')
  if (generation !== contextGeneration) return
  const next = scopeFor(captureWorkspace().selection)
  switching = false
  if (before !== next) await restoreContext()
  else await workspaceSync.load(scope)
}
export function initializeWorkspaceSync() {
  const disposers = [
    useUserStore.subscribe((state) => {
      const next = state.isAuthenticated ? state.serverUserId : null
      if (next !== userId) void activate(next)
    }),
  ]
  disposers.push(
    useRepositoryStore.subscribe((state, previous) => {
      if (!userId || applying) return
      const selection = {
        currentOwner: state.currentOwner,
        currentRepoName: state.currentRepoName,
        activeContributionIssue: state.activeContributionIssue,
      }
      const previousSelection = {
        currentOwner: previous.currentOwner,
        currentRepoName: previous.currentRepoName,
        activeContributionIssue: previous.activeContributionIssue,
      }
      if (JSON.stringify(selection) !== JSON.stringify(previousSelection)) {
        workspaceSync.update('workspace', 'selection', selection)
        if (scopeFor(selection) !== scope) {
          void restoreContext()
          return
        }
      }
      workspaceSync.update(scope, 'repository', captureWorkspace().repository)
    }),
  )
  for (const [kind, store] of [
    ['guide', useRoadmapStore],
    ['chat', useChatStore],
    ['pr', usePrStore],
    ['review', useCodeReviewStore],
  ] as const) {
    disposers.push(
      store.subscribe(() => {
        if (!userId || applying) return
        const captured = captureWorkspace()[kind]
        // Streaming fragments and loading flags are not committed as final business content.
        workspaceSync.update(scope, kind, captured)
      }),
    )
  }
  const onOnline = () => {
    void workspaceSync.flush()
    void refreshWorkspace()
  }
  const onFocus = () => {
    void refreshWorkspace()
  }
  const onPageHide = () => {
    void workspaceSync.flush()
  }
  window.addEventListener('online', onOnline)
  window.addEventListener('focus', onFocus)
  window.addEventListener('pagehide', onPageHide)
  return () => {
    disposers.forEach((dispose) => dispose())
    window.removeEventListener('online', onOnline)
    window.removeEventListener('focus', onFocus)
    window.removeEventListener('pagehide', onPageHide)
    workspaceSync.stop()
  }
}
