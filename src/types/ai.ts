/**
 * AI / LLM 相关类型定义
 */

import type { Repository } from './repository'
import type { Issue } from './issue'

/** 聊天消息角色 */
export type ChatRole = 'user' | 'assistant' | 'system'

/** 单条聊天消息 */
export interface ChatMessage {
  /** 消息 ID */
  id: string
  /** 消息角色 */
  role: ChatRole
  /** 消息内容 */
  content: string
  /** 时间戳（ISO 格式） */
  timestamp: string
}

/** 聊天会话 */
export interface ChatSession {
  /** 会话 ID */
  id: string
  /** 消息列表 */
  messages: ChatMessage[]
  /** 关联的仓库信息 */
  repository?: Repository
  /** 关联的 Issue 信息 */
  issue?: Issue
  /** 创建时间（ISO 格式） */
  createdAt: string
}

/** AI 导师对话响应（后端返回） */
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

/** AI 建议类型 */
export type AISuggestionType = 'tip' | 'warning' | 'danger' | 'info'

/** AI 建议项 */
export interface AISuggestion {
  /** 建议标题 */
  title: string
  /** 建议详细描述 */
  description: string
  /** 建议类型 */
  type: AISuggestionType
}

/**
 * Issue 讲解与分析
 * AI 对 Issue 进行的深度解析结果
 */
export interface IssueExplain {
  /** 用 2-3 句话概括 */
  summary: string
  /** 难度等级 */
  difficulty: 'easy' | 'medium' | 'hard'
  /** 从真实仓库数据或 Issue 描述中确认的信息 */
  confirmedContext: string[]
  /** 需要提前了解的知识或技术点 */
  knowledge: string[]
  /** 解决步骤（详细步骤） */
  steps: string[]
  /** 无法确认具体代码位置时建议检查的方向 */
  possibleAreasToInspect: string[]
  /** 预估完成时间 */
  estimatedTime: string
  /** 实用提示或注意事项 */
  tips: string[]
}
