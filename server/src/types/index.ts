/**
 * 统一响应格式
 */
export interface ApiResponse<T = unknown> {
  success: boolean
  data: T
  message?: string
  code?: number
}

/**
 * 仓库信息
 */
export interface Repository {
  id: number
  name: string
  fullName: string
  owner: string
  ownerAvatar: string
  description: string | null
  stars: number
  forks: number
  watchers: number
  openIssues: number
  language: string | null
  topics: string[]
  license: string | null
  homepage: string | null
  defaultBranch: string
  createdAt: string
  updatedAt: string
  size: number
  htmlUrl: string
}

/**
 * Issue 标签
 */
export interface IssueLabel {
  id: number
  name: string
  color: string
  description: string | null
}

/**
 * Issue
 */
export interface Issue {
  id: number
  number: number
  title: string
  body: string | null
  state: 'open' | 'closed'
  author: string
  authorAvatar: string
  labels: IssueLabel[]
  comments: number
  createdAt: string
  updatedAt: string
  htmlUrl: string
}

/**
 * AI 解释 Issue 结果
 */
export interface IssueExplain {
  summary: string
  difficulty: 'easy' | 'medium' | 'hard'
  knowledge: string[]
  steps: string[]
  estimatedTime: string
  tips: string[]
}

// ============================================================
// 仓库 AI 分析
// ============================================================

/**
 * 仓库 AI 分析结果
 */
export interface RepoAnalysis {
  /** 项目概述（2-3 句话） */
  overview: string
  /** 项目技术栈分析 */
  techStack: TechStackAnalysis
  /** 项目活跃度评估 */
  activity: ActivityAnalysis
  /** 对新人友好度评估 */
  beginnerFriendliness: BeginnerFriendliness
  /** 主要技术领域/标签 */
  domains: string[]
  /** 适合新人的入门建议 */
  gettingStartedTips: string[]
  /** 主要贡献领域 */
  contributionAreas: ContributionArea[]
  /** 分析置信度 0-1 */
  confidence: number
}

/**
 * 技术栈分析
 */
export interface TechStackAnalysis {
  /** 主要语言 */
  primaryLanguage: string
  /** 核心技术/框架 */
  coreTechnologies: string[]
  /** 构建工具 */
  buildTools: string[]
  /** 测试框架 */
  testFrameworks: string[]
  /** 架构模式简述 */
  architecture: string
}

/**
 * 活跃度分析
 */
export interface ActivityAnalysis {
  /** 活跃度等级 */
  level: 'very-active' | 'active' | 'moderate' | 'low' | 'inactive'
  /** 最近提交频率描述 */
  commitFrequency: string
  /** 维护者响应速度 */
  maintainerResponsiveness: string
  /** 最近一次重大更新 */
  lastMajorUpdate: string
}

/**
 * 新人友好度
 */
export interface BeginnerFriendliness {
  /** 友好度等级 */
  level: 'very-friendly' | 'friendly' | 'moderate' | 'challenging' | 'hard'
  /** 评分 0-10 */
  score: number
  /** 友好因素 */
  friendlyFactors: string[]
  /** 挑战因素 */
  challengingFactors: string[]
}

/**
 * 贡献领域
 */
export interface ContributionArea {
  /** 领域名称 */
  name: string
  /** 描述 */
  description: string
  /** 难度 */
  difficulty: 'easy' | 'medium' | 'hard'
  /** 适合入门的原因 */
  whyGoodForBeginners: string
}

// ============================================================
// Issue 推荐打分
// ============================================================

/**
 * 带推荐评分的 Issue
 */
export interface RecommendedIssue extends Issue {
  /** 推荐分数 0-100 */
  recommendationScore: number
  /** 置信度 0-1 */
  confidence: number
  /** 推荐理由（可解释性） */
  recommendationReasons: string[]
  /** 匹配维度得分 */
  matchDetails: MatchDetails
}

/**
 * 匹配维度详情
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

/**
 * Issue 推荐结果
 */
export interface IssueRecommendation {
  /** 推荐的 Issue 列表（按分数降序） */
  items: RecommendedIssue[]
  /** 总数 */
  total: number
  /** 推荐说明 */
  summary: string
}

// ============================================================
// PR 草稿生成
// ============================================================

/**
 * PR 草稿生成结果
 */
export interface PrDraft {
  /** PR 标题 */
  title: string
  /** PR 描述 */
  description: string
  /** 变更类型 */
  type: 'feat' | 'fix' | 'docs' | 'refactor' | 'test' | 'chore' | 'style' | 'perf'
  /** 关联 Issue 编号 */
  relatedIssue: string
  /** 变更摘要列表 */
  changes: string[]
  /** 测试建议 */
  testingTips: string[]
  /** 注意事项/风险点 */
  notes: string[]
  /** 生成质量置信度 0-1 */
  confidence: number
  /** 可改进的地方 */
  improvementSuggestions: string[]
}

// ============================================================
// 学习路线图
// ============================================================

/**
 * 路线图阶段
 */
export interface RoadmapPhase {
  /** 阶段编号（1-based） */
  phase: number
  /** 阶段标题 */
  title: string
  /** 阶段目标（1-2 句话） */
  goal: string
  /** 学习内容列表 */
  learningItems: string[]
  /** 推荐实践 Issue（good first issue 等） */
  recommendedIssues: string[]
  /** 预计完成时间 */
  estimatedDuration: string
  /** 难度等级 */
  difficulty: 'easy' | 'medium' | 'hard'
  /** 完成标准（怎么判断自己掌握了） */
  completionCriteria: string[]
  /** 推荐资源/文档链接标题 */
  resources: string[]
}

/**
 * 学习路线图
 */
export interface Roadmap {
  /** 路线图标题 */
  title: string
  /** 路线图简介 */
  description: string
  /** 总预计时间 */
  totalEstimatedTime: string
  /** 阶段列表 */
  phases: RoadmapPhase[]
  /** 给学习者的建议 */
  tips: string[]
  /** 生成置信度 */
  confidence: number
}

// ============================================================
// AI 导师对话
// ============================================================

/**
 * 对话角色
 */
export type ChatRole = 'system' | 'user' | 'assistant'

/**
 * 单条对话消息
 */
export interface ChatMessage {
  /** 角色 */
  role: ChatRole
  /** 消息内容 */
  content: string
  /** 时间戳（ISO 字符串） */
  timestamp?: string
}

/**
 * AI 导师对话响应
 */
export interface ChatResponse {
  /** AI 回复消息 */
  message: string
  /** 回复中提到的相关 Issue 编号 */
  relatedIssues?: number[]
  /** 回复中建议的下一步操作 */
  suggestedNextSteps?: string[]
  /** 回复的置信度（0-1） */
  confidence?: number
}

// ============================================================
// 通用
// ============================================================

/**
 * 分页参数
 */
export interface PaginationParams {
  page: number
  perPage: number
}

/**
 * 分页结果
 */
export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  perPage: number
}

// ============================================================
// 代码审查 (PR-Review Agent)
// ============================================================

/**
 * 审查任务状态
 */
export type ReviewStatus = 'idle' | 'queued' | 'running' | 'completed' | 'failed'

/**
 * 审查阶段状态
 */
export type ReviewPhaseStatus = 'pending' | 'running' | 'completed' | 'failed'

/**
 * 审查进度
 */
export interface ReviewProgress {
  /** 进度百分比 0-100 */
  percent: number
  /** 各阶段状态 */
  phases: {
    summary: ReviewPhaseStatus
    risk: ReviewPhaseStatus
    comments: ReviewPhaseStatus
  }
  /** 最后事件时间 */
  lastEventAt: string | null
}

/**
 * 审查严重程度
 */
export type ReviewSeverity = 'critical' | 'high' | 'medium' | 'low' | 'suggestion'

/**
 * 审查问题项
 */
export interface ReviewIssue {
  /** 问题 ID */
  id: string
  /** 严重程度 */
  severity: ReviewSeverity
  /** 分类：bug / performance / security / style / best-practice / other */
  category: string
  /** 问题标题 */
  title: string
  /** 问题描述 */
  description: string
  /** 涉及文件 */
  file: string
  /** 行号 */
  line: number | null
  /** 关联的函数/类名 */
  symbol: string | null
  /** 你的代码片段 */
  yourCode: string
  /** 修改建议代码 */
  suggestionCode: string
  /** 修改建议文字说明 */
  suggestionText: string
  /** 导师小课堂 - 为什么要改 */
  whyItMatters: string
  /** 置信度 high/medium/low */
  confidence: 'high' | 'medium' | 'low'
  /** 置信度分数 0-1 */
  confidenceScore: number
}

/**
 * 审查总结
 */
export interface ReviewSummary {
  /** 总结标题 */
  title: string
  /** 整体摘要 */
  summary: string
  /** 关键变更列表 */
  keyChanges: string[]
  /** 受影响系统 */
  affectedSystems: string[]
  /** 架构影响 */
  architecturalImpact: string
  /** 整体评价（鼓励性语言） */
  overallFeedback: string
}

/**
 * 风险审查报告
 */
export interface RiskReviewReport {
  /** 整体风险等级 */
  overallRiskLevel: 'critical' | 'high' | 'medium' | 'low'
  /** 风险项列表 */
  risks: RiskItem[]
}

/**
 * 风险项
 */
export interface RiskItem {
  severity: 'critical' | 'high' | 'medium' | 'low'
  category: string
  description: string
  affectedFiles: string[]
  recommendation: string
  confidence: 'high' | 'medium' | 'low'
  reasoning: string
}

/**
 * 做得好的项（正向反馈）
 */
export interface PraiseItem {
  id: string
  title: string
  description: string
  file: string
  codeSnippet: string
  whyItMatters: string
}

/**
 * 审查结果
 */
export interface ReviewResult {
  /** 审查总结 */
  summary: ReviewSummary
  /** 风险报告 */
  risks: RiskReviewReport
  /** 问题列表（需要修改的） */
  issues: ReviewIssue[]
  /** 做得好的列表 */
  praises: PraiseItem[]
  /** 小提示/知识 */
  tips: string[]
  /** 统计 */
  stats: {
    critical: number
    high: number
    medium: number
    low: number
    suggestion: number
    praise: number
  }
}

/**
 * 审查任务记录
 */
export interface ReviewJobRecord {
  reviewId: string
  status: ReviewStatus
  progress: ReviewProgress
  result: ReviewResult | null
  error: string | null
  prUrl: string
  createdAt: string
  completedAt: string | null
}
