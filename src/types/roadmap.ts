/**
 * 路线图相关类型定义
 */

/** 步骤状态 */
export type RoadmapStepStatus = 'pending' | 'current' | 'completed'

/** 路线图任务 */
export interface RoadmapTask {
  /** 任务 ID */
  id: string
  /** 任务描述文本 */
  text: string
  /** 是否已完成 */
  completed: boolean
}

/** 路线图步骤（旧版，向后兼容） */
export interface RoadmapStep {
  /** 步骤 ID */
  id: string
  /** 第几天 */
  day: number
  /** 步骤标题 */
  title: string
  /** 步骤描述 */
  description: string
  /** 任务列表 */
  tasks: RoadmapTask[]
  /** 预计时长（分钟） */
  duration: number
  /** 当前状态 */
  status: RoadmapStepStatus
}

/** 路线图进度 */
export interface RoadmapProgress {
  /** 当前步骤索引 */
  currentStep: number
  /** 总步骤数 */
  totalSteps: number
  /** 已完成步骤数 */
  completedSteps: number
  /** 完成百分比（0-100） */
  percentage: number
}

// ============================================================
// 后端返回的新版路线图结构
// ============================================================

/** 路线图阶段（后端返回结构） */
export interface RoadmapPhase {
  /** 阶段 ID（前端生成） */
  id: string
  /** 阶段编号（1-based） */
  phase: number
  /** 阶段标题 */
  title: string
  /** 阶段目标（1-2 句话） */
  goal: string
  /** 学习内容列表 */
  learningItems: string[]
  /** 推荐实践 Issue */
  recommendedIssues: string[]
  /** 预计完成时间 */
  estimatedDuration: string
  /** 难度等级 */
  difficulty: 'easy' | 'medium' | 'hard'
  /** 完成标准 */
  completionCriteria: string[]
  /** 推荐资源 */
  resources: string[]
  /** 前端扩展：状态 */
  status: RoadmapStepStatus
  /** 前端扩展：任务列表（由 learningItems 转换） */
  tasks: RoadmapTask[]
}

/** 学习路线图（后端返回结构） */
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
