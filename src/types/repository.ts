/**
 * 仓库相关类型定义
 */

/** 难度等级 */
export type DifficultyLevel = 'easy' | 'medium' | 'hard'

/** 分析状态 */
export type AnalysisStatus = 'idle' | 'loading' | 'success' | 'error'

/** 开源仓库基本信息 */
export interface Repository {
  /** 仓库 ID */
  id: string
  /** 仓库所有者（用户名或组织名） */
  owner: string
  /** 仓库名称 */
  name: string
  /** 完整名称（owner/name） */
  fullName: string
  /** 仓库描述 */
  description: string
  /** Star 数量 */
  stars: number
  /** Fork 数量 */
  forks: number
  /** Issue 总数 */
  issuesCount: number
  /** 主要编程语言 */
  language: string
  /** 仓库大小（KB） */
  size: number
  /** 项目主页地址 */
  homepage: string
  /** 主题标签列表 */
  topics: string[]
  /** 许可证类型 */
  license: string
  /** 创建时间（ISO 格式） */
  createdAt: string
  /** 更新时间（ISO 格式） */
  updatedAt: string
  /** 默认分支名称 */
  defaultBranch: string
  /** 所有者头像 */
  ownerAvatar?: string
  /** Watch 数量 */
  watchers?: number
  /** HTML 链接 */
  htmlUrl?: string
}

// ============================================================
// 仓库 AI 分析（后端返回的新版）
// ============================================================

/** 技术栈分析 */
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

/** 活跃度分析 */
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

/** 新人友好度 */
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

/** 贡献领域 */
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

/** 仓库 AI 分析结果（后端新版） */
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

// ============================================================
// 旧版 RepositoryAnalysis（向后兼容）
// ============================================================

/** 仓库 AI 分析结果（旧版，保留兼容） */
export interface RepositoryAnalysis {
  /** 仓库整体摘要 */
  summary: string
  /** 整体难度等级评估 */
  difficulty: DifficultyLevel
  /** 架构描述 */
  architecture: string
  /** 推荐新手解决的 Issue 数量 */
  suggestedIssuesCount: number
  /** 文件树结构概览 */
  fileTree: string
  /** 关键洞察与建议 */
  insights: string[]
  /** 技术栈列表 */
  techStack: string[]
  /** 是否适合新手参与 */
  isBeginnerFriendly: boolean
}
