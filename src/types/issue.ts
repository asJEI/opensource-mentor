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
