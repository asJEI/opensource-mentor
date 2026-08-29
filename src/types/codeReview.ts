/**
 * 代码审查相关类型
 */

/** 审查任务状态 */
export type ReviewStatus = 'idle' | 'queued' | 'running' | 'completed' | 'failed'

/** 审查阶段状态 */
export type ReviewPhaseStatus = 'pending' | 'running' | 'completed' | 'failed'

/** 审查进度 */
export interface ReviewProgress {
  percent: number
  phases: {
    summary: ReviewPhaseStatus
    risk: ReviewPhaseStatus
    comments: ReviewPhaseStatus
  }
  lastEventAt: string | null
}

/** 严重程度 */
export type ReviewSeverity = 'critical' | 'high' | 'medium' | 'low' | 'suggestion'

/** 审查问题分类 */
export type ReviewCategory = 'bug' | 'performance' | 'security' | 'style' | 'best-practice' | 'other'

/** 审查问题项 */
export interface ReviewIssue {
  id: string
  severity: ReviewSeverity
  category: ReviewCategory
  title: string
  description: string
  file: string
  line: number | null
  symbol: string | null
  yourCode: string
  suggestionCode: string
  suggestionText: string
  whyItMatters: string
  confidence: 'high' | 'medium' | 'low'
  confidenceScore: number
}

/** 审查总结 */
export interface ReviewSummary {
  title: string
  summary: string
  keyChanges: string[]
  affectedSystems: string[]
  architecturalImpact: string
  overallFeedback: string
}

/** 风险项 */
export interface RiskItem {
  severity: 'critical' | 'high' | 'medium' | 'low'
  category: string
  description: string
  affectedFiles: string[]
  recommendation: string
  confidence: 'high' | 'medium' | 'low'
  reasoning: string
}

/** 风险审查报告 */
export interface RiskReviewReport {
  overallRiskLevel: 'critical' | 'high' | 'medium' | 'low'
  risks: RiskItem[]
}

/** 做得好的项 */
export interface PraiseItem {
  id: string
  title: string
  description: string
  file: string
  codeSnippet: string
  whyItMatters: string
}

/** 审查结果 */
export interface ReviewResult {
  summary: ReviewSummary
  risks: RiskReviewReport
  issues: ReviewIssue[]
  praises: PraiseItem[]
  tips: string[]
  stats: {
    critical: number
    high: number
    medium: number
    low: number
    suggestion: number
    praise: number
  }
}

/** 变更文件（用于三列 Diff 视图） */
export interface ReviewChangedFile {
  filename: string
  status: string
  additions: number
  deletions: number
  changes: number
  patch: string | null
}

export interface ReviewJobArtifacts {
  changedFiles: ReviewChangedFile[]
}

export type ReviewInputMode = 'pr' | 'compare'

/** Fork Compare 审查入参 */
export interface ReviewCompareInput {
  baseOwner: string
  baseRepo: string
  baseRef: string
  headOwner: string
  headRepo: string
  headRef: string
}

/** 创建审查请求 */
export type CreateReviewRequest =
  | { mode?: 'pr'; prUrl: string }
  | ({ mode: 'compare' } & ReviewCompareInput)

/** 审查任务记录 */
export interface ReviewJobRecord {
  reviewId: string
  status: ReviewStatus
  progress: ReviewProgress
  result: ReviewResult | null
  error: string | null
  prUrl: string
  mode?: ReviewInputMode
  sourceLabel?: string
  createPrUrl?: string | null
  artifacts?: ReviewJobArtifacts
  createdAt: string
  completedAt: string | null
}

/** 审查分类 Tab */
export type ReviewTab = 'critical' | 'improvement' | 'praise' | 'tips'

/** Diff 行 */
export interface DiffLine {
  type: 'added' | 'removed' | 'context'
  content: string
  oldLineNumber?: number
  newLineNumber?: number
}

/** Diff hunk */
export interface DiffHunk {
  header: string
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  lines: DiffLine[]
}
