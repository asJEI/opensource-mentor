/**
 * Issue 相关类型定义
 */

import type { DifficultyLevel } from './repository'

/** Issue 标签 */
export interface IssueLabel {
  /** 标签 ID */
  id: string
  /** 标签名称 */
  name: string
  /** 标签颜色（十六进制） */
  color: string
  /** 标签描述 */
  description: string
}

/** Issue 基本信息 */
export interface Issue {
  /** Issue ID */
  id: string
  /** Issue 编号 */
  number: number
  /** Issue 标题 */
  title: string
  /** Issue 内容 */
  body: string
  /** 状态：开放或关闭 */
  state: 'open' | 'closed'
  /** 作者用户名 */
  author: string
  /** 作者头像 */
  authorAvatar?: string
  /** 标签列表 */
  labels: IssueLabel[]
  /** 评论数量 */
  comments: number
  /** 创建时间（ISO 格式） */
  createdAt: string
  /** 更新时间（ISO 格式） */
  updatedAt: string
  /** HTML 链接 */
  htmlUrl?: string
  /** 被指派的用户列表 */
  assignees: string[]
}

/**
 * 匹配度细分（旧版，向后兼容）
 */
export interface MatchBreakdown {
  /** 技能匹配度 */
  skillMatch: number
  /** 难度匹配度 */
  difficultyMatch: number
  /** 兴趣匹配度 */
  interestMatch: number
  /** 贡献经验匹配度 */
  contributionMatch: number
}

/**
 * 匹配维度详情（后端返回的新版）
 */
export interface MatchDetails {
  /** 难度匹配分 0-100 */
  difficultyMatch: number
  /** 技术匹配分 0-100 */
  skillMatch: number
  /** 影响价值分 0-100 */
  impactScore: number
  /** 活跃度分 0-100 */
  activityScore: number
  /** 新人友好分 0-100 */
  beginnerFriendlyScore: number
}

/** AI 推荐的 Issue（扩展自基础 Issue） */
export interface RecommendedIssue extends Issue {
  /** 综合匹配分数（0-100）— 旧字段 */
  matchScore?: number
  /** 推荐分数（0-100）— 后端新字段 */
  recommendationScore?: number
  /** 置信度（0-1） */
  confidence?: number
  /** AI 评估的难度等级 */
  difficulty?: DifficultyLevel
  /** 预计完成时间（小时） */
  estimatedTime?: number
  /** AI 推荐理由（旧字段，单条字符串） */
  aiReasoning?: string
  /** 与当前用户画像匹配的理由 */
  matchReasons?: string[]
  /** 推荐理由列表（可解释性） */
  recommendationReasons?: string[]
  /** 匹配度细分项（旧版） */
  breakdown?: MatchBreakdown
  /** 匹配维度详情（新版，后端返回） */
  matchDetails?: MatchDetails
}

/** Issue 推荐结果 */
export interface IssueRecommendation {
  /** 推荐的 Issue 列表（按分数降序） */
  items: RecommendedIssue[]
  /** 总数 */
  total: number
  /** 推荐说明 */
  summary: string
}

/** 服务端候选 Issue 搜索结果（尚未做最终推荐排序） */
export interface CandidateIssue extends Issue {
  issueNumber: number
  issueUrl: string
  repository: {
    owner: string
    name: string
    fullName: string
    url: string
    description?: string | null
    stars?: number
    forks?: number
    openIssues?: number
    topics?: string[]
    defaultBranch?: string
    updatedAt?: string
  }
  language: string | null
  languageSource: 'query' | 'unknown'
  user: {
    login: string
    avatarUrl: string
  }
  assignee: { login: string; avatarUrl: string } | null
  analysis?: {
    summary: string
    difficulty: 'Beginner' | 'Beginner+' | 'Intermediate' | 'Advanced'
    estimatedTime: string
    whyThisFitsYou: string[]
    technologies: string[]
    scopeAssessment: 'small' | 'medium' | 'large'
    confidence: number
  }
  whyThisFitsYou?: string[]
  matchScore?: number
  candidateMatchDetails?: {
    technologyMatch: number
    levelMatch: number
    timeMatch: number
    clarityScore: number
    repositoryHealth: number
  }
  recommendationFallback?: boolean
  availability?: {
    status:
      | 'ready_to_start'
      | 'ask_first'
      | 'claimed'
      | 'assigned'
      | 'has_linked_pr'
      | 'possibly_outdated'
      | 'uncertain'
    canRecommend: boolean
    shouldAskFirst: boolean
    reasons: string[]
    evidence: string[]
    linkedPullRequests: Array<{
      number: number
      title: string
      url: string
      state: 'open' | 'closed'
    }>
  }
  /** 是否需要先认领：claim_required | direct_submit */
  contributionAccess?: 'claim_required' | 'direct_submit'
  /** 认领/直接提交说明 */
  claimHint?: string
}

export interface CandidateIssueAnalysisResult {
  issueId: string
  analysis: NonNullable<CandidateIssue['analysis']>
  whyThisFitsYou: string[]
  matchScore: number
  matchDetails: NonNullable<CandidateIssue['candidateMatchDetails']>
  fromCache: boolean
  recommendationFallback: boolean
  contributionAccess?: 'claim_required' | 'direct_submit'
  claimHint?: string
  availability?: CandidateIssue['availability']
}

export interface CandidateIssuesMeta {
  queries: string[]
  rawCount: number
  deduplicatedCount: number
  filteredCount: number
  recommendedCount: number
  languages: string[]
  warnings: string[]
  failedQueries: Array<{ query: string; message: string; status?: number }>
}

export interface CandidateIssuesResult {
  issues: CandidateIssue[]
  meta: CandidateIssuesMeta
}

/** Issue 筛选条件 */
export interface IssueFilter {
  /** 按难度筛选 */
  difficulty?: DifficultyLevel
  /** 按标签筛选 */
  labels?: string
  /** 排序方式 */
  sortBy?: 'match' | 'newest' | 'comments' | 'popular'
  /** 搜索关键词 */
  search?: string
  /** 状态 */
  state?: 'open' | 'closed' | 'all'
  /** 页码 */
  page?: number
  /** 每页数量 */
  perPage?: number
}
