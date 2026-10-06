/** Versioned Web persistence contract. Credentials and UI-only state are excluded. */
import type {
  CandidateIssue,
  Repository,
  RepoAnalysis,
  IssueExplain,
  Roadmap,
  RoadmapPhase,
  ChatMessage,
  GuideMentorContext,
  PrType,
  PrDraft,
  ReviewStatus,
  ReviewProgress,
  ReviewResult,
  ReviewInputMode,
  ReviewCompareInput,
  ReviewJobArtifacts,
} from '../src/types'

export const WORKSPACE_KINDS = ['selection', 'repository', 'guide', 'chat', 'pr', 'review'] as const
export type WorkspaceKind = (typeof WORKSPACE_KINDS)[number]
export type WorkspacePayloads = {
  selection: {
    currentOwner: string
    currentRepoName: string
    activeContributionIssue: CandidateIssue | null
  }
  repository: {
    currentRepo: Repository | null
    analysis: RepoAnalysis | null
    currentExplain: IssueExplain | null
  }
  guide: {
    roadmap: Roadmap | null
    steps: RoadmapPhase[]
    currentOwner: string
    currentRepo: string
    cacheKey: string
  }
  chat: {
    messages: ChatMessage[]
    sessionId: string | null
    currentOwner: string
    currentRepo: string
    guideContext: GuideMentorContext | null
  }
  pr: {
    prType: PrType
    summary: string
    linkedIssue: string
    prDraft: PrDraft | null
    currentOwner: string
    currentRepo: string
  }
  review: {
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
    compareInput: ReviewCompareInput
  }
}
export type WorkspaceDocument<K extends WorkspaceKind = WorkspaceKind> = {
  context_id: string
  kind: K
  content: WorkspacePayloads[K]
  revision: number
  updated_at: string
}
export type WorkspaceSaveResult = {
  status: 'saved' | 'conflict'
  document: WorkspaceDocument | null
}
export type WorkspaceWrite = {
  scope: string
  kind: WorkspaceKind
  content: WorkspacePayloads[WorkspaceKind]
  expectedRevision: number
  operationId: string
}
export const MAX_WORKSPACE_BYTES = 2 * 1024 * 1024

export function workspaceScope(owner: string, repo: string, issueNumber?: number | null): string {
  if (!owner || !repo) return 'workspace'
  return `${owner.toLowerCase()}/${repo.toLowerCase()}#${issueNumber || 0}`
}
export function isWorkspaceScope(scope: unknown): scope is string {
  return (
    typeof scope === 'string' &&
    (scope === 'workspace' || /^[a-z0-9][a-z0-9-]{0,38}\/[a-z0-9_.-]{1,100}#\d{1,10}$/.test(scope))
  )
}
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
const fields: Record<WorkspaceKind, string[]> = {
  selection: ['currentOwner', 'currentRepoName', 'activeContributionIssue'],
  repository: ['currentRepo', 'analysis', 'currentExplain'],
  guide: ['roadmap', 'steps', 'currentOwner', 'currentRepo', 'cacheKey'],
  chat: ['messages', 'sessionId', 'currentOwner', 'currentRepo', 'guideContext'],
  pr: ['prType', 'summary', 'linkedIssue', 'prDraft', 'currentOwner', 'currentRepo'],
  review: [
    'reviewId',
    'status',
    'progress',
    'result',
    'error',
    'prUrl',
    'mode',
    'sourceLabel',
    'createPrUrl',
    'artifacts',
    'compareInput',
  ],
}
function safeJson(value: unknown, depth = 0): boolean {
  if (depth > 30) return false
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.every((item) => safeJson(item, depth + 1))
  if (!isRecord(value)) return false
  return Object.entries(value).every(
    ([key, item]) =>
      !/^(?:__proto__|constructor|prototype|apiKey|token|access_token|refresh_token|secretKey|password|authorization)$/i.test(
        key,
      ) && safeJson(item, depth + 1),
  )
}
/** Reject unknown root fields instead of accepting arbitrary serialized stores. */
export function validWorkspaceContent(
  kind: WorkspaceKind,
  value: unknown,
): value is WorkspacePayloads[WorkspaceKind] {
  if (!WORKSPACE_KINDS.includes(kind)) return false
  if (!isRecord(value) || !safeJson(value)) return false
  if (
    Object.keys(value).some((key) => !fields[kind].includes(key)) ||
    fields[kind].some((key) => !(key in value))
  )
    return false
  const stringFields = [
    'currentOwner',
    'currentRepoName',
    'currentRepo',
    'cacheKey',
    'summary',
    'linkedIssue',
    'prUrl',
    'sourceLabel',
  ]
  if (
    stringFields.some(
      (key) =>
        key in value &&
        !(kind === 'repository' && key === 'currentRepo') &&
        typeof value[key] !== 'string',
    )
  )
    return false
  const objectFields = [
    'activeContributionIssue',
    'currentRepo',
    'analysis',
    'currentExplain',
    'roadmap',
    'guideContext',
    'prDraft',
    'result',
    'artifacts',
  ]
  if (
    objectFields.some(
      (key) =>
        key in value &&
        !(key === 'currentRepo' && kind !== 'repository') &&
        value[key] !== null &&
        !isRecord(value[key]),
    )
  )
    return false
  if (kind === 'selection' && value.activeContributionIssue) {
    const issue = value.activeContributionIssue
    if (
      !isRecord(issue) ||
      !isRecord(issue.repository) ||
      typeof issue.id !== 'string' ||
      typeof issue.title !== 'string' ||
      !Number.isSafeInteger(issue.issueNumber) ||
      Number(issue.issueNumber) < 1 ||
      typeof issue.repository.owner !== 'string' ||
      typeof issue.repository.name !== 'string'
    )
      return false
    if (
      issue.repository.owner.toLowerCase() !== String(value.currentOwner).toLowerCase() ||
      issue.repository.name.toLowerCase() !== String(value.currentRepoName).toLowerCase()
    )
      return false
  }
  if (kind === 'guide') {
    if (!Array.isArray(value.steps) || value.steps.length > 100) return false
    if (
      !value.steps.every(
        (step) =>
          isRecord(step) &&
          typeof step.id === 'string' &&
          Number.isInteger(step.phase) &&
          ['pending', 'current', 'completed'].includes(String(step.status)) &&
          Array.isArray(step.tasks) &&
          (!step.actionSteps || Array.isArray(step.actionSteps)),
      )
    )
      return false
    if (
      value.roadmap &&
      (!isRecord(value.roadmap) ||
        typeof value.roadmap.title !== 'string' ||
        !Array.isArray(value.roadmap.phases))
    )
      return false
  }
  if (
    kind === 'chat' &&
    (!Array.isArray(value.messages) ||
      value.messages.length > 2000 ||
      !value.messages.every(
        (message) =>
          isRecord(message) &&
          typeof message.id === 'string' &&
          ['user', 'assistant', 'system'].includes(String(message.role)) &&
          typeof message.content === 'string' &&
          typeof message.timestamp === 'string',
      ))
  )
    return false
  for (const key of ['sessionId', 'reviewId', 'error', 'createPrUrl'])
    if (key in value && value[key] !== null && typeof value[key] !== 'string') return false
  if (
    kind === 'pr' &&
    (!['bug', 'feature', 'docs'].includes(String(value.prType)) ||
      (value.prDraft !== null &&
        (!isRecord(value.prDraft) ||
          typeof value.prDraft.title !== 'string' ||
          typeof value.prDraft.description !== 'string')))
  )
    return false
  if (
    kind === 'review' &&
    (!['idle', 'queued', 'running', 'completed', 'failed'].includes(String(value.status)) ||
      !['pr', 'compare'].includes(String(value.mode)) ||
      !isRecord(value.progress) ||
      !isRecord(value.compareInput))
  )
    return false
  return true
}
export function parseWorkspaceWrite(value: unknown): WorkspaceWrite {
  if (
    !isRecord(value) ||
    Object.keys(value).some(
      (key) => !['scope', 'kind', 'content', 'expectedRevision', 'operationId'].includes(key),
    )
  )
    throw new Error('工作区请求格式不正确')
  if (!isWorkspaceScope(value.scope) || !WORKSPACE_KINDS.includes(value.kind as WorkspaceKind))
    throw new Error('工作区或数据类型不正确')
  const kind = value.kind as WorkspaceKind
  if (kind === 'selection' && value.scope !== 'workspace')
    throw new Error('任务选择必须保存到用户工作区')
  if (
    !Number.isSafeInteger(value.expectedRevision) ||
    Number(value.expectedRevision) < 0 ||
    typeof value.operationId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value.operationId,
    ) ||
    !validWorkspaceContent(kind, value.content)
  )
    throw new Error('工作区内容或版本不正确')
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > MAX_WORKSPACE_BYTES)
    throw new Error('工作区内容超过大小限制')
  return {
    scope: value.scope,
    kind,
    content: value.content,
    expectedRevision: Number(value.expectedRevision),
    operationId: value.operationId,
  }
}
