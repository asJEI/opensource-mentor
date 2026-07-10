/**
 * PR 生成相关类型定义
 */

/** PR 类型（前端分类） */
export type PrType = 'bug' | 'feature' | 'docs'

/** PR 建议类型 */
export type PrSuggestionType = 'tip' | 'warning' | 'danger'

/** PR 检查清单项 */
export interface PrChecklistItem {
  /** 检查项文本 */
  text: string
  /** 是否已勾选 */
  checked: boolean
}

/** PR 建议项 */
export interface PrSuggestion {
  /** 建议类型 */
  type: PrSuggestionType
  /** 建议标题 */
  title: string
  /** 建议详细描述 */
  description: string
}

/** PR 草稿（后端返回的新版结构） */
export interface PrDraft {
  /** PR 标题 */
  title: string
  /** PR 描述 */
  description: string
  /** PR 类型（后端 type：feat/fix/docs/refactor/test/chore/style/perf） */
  type: PrType | string
  /** 关联 Issue 编号 */
  relatedIssue?: string
  /** 主要变更点列表 */
  changes?: string[]
  /** 测试建议 */
  testingTips?: string[]
  /** 注意事项/风险点 */
  notes?: string[]
  /** 生成质量置信度 0-1 */
  confidence?: number
  /** 可改进的地方 */
  improvementSuggestions?: string[]
  // ---- 旧版字段（向后兼容）----
  /** PR 检查清单（旧版） */
  checklist?: PrChecklistItem[]
  /** AI 给出的建议列表（旧版） */
  suggestions?: PrSuggestion[]
}
