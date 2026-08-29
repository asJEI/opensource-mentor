/**
 * 贡献指南 / 路线图类型
 */

export type RoadmapStepStatus = 'pending' | 'current' | 'completed'

export type RoadmapGenerationStatus =
  | 'queued'
  | 'generating'
  | 'ready'
  | 'failed'

export interface RoadmapTask {
  id: string
  text: string
  completed: boolean
}

/** 真实仓库文件引用 */
export interface GuideFileRef {
  path: string
  reason: string
  githubUrl?: string
}

/** 可执行行动步骤 */
export interface GuideActionStep {
  id: string
  title: string
  description?: string
  commands?: string[]
  expectedResult?: string
  checkboxLabel?: string
  completed?: boolean
}

/** 复现问题专用块 */
export interface GuideReproduceBlock {
  title?: string
  steps: string[]
  constructExample?: string
  expectedBehavior?: string
  actualBehavior?: string
  checkboxLabel?: string
  completed?: boolean
}

export interface RoadmapStep {
  id: string
  day: number
  title: string
  description: string
  tasks: RoadmapTask[]
  duration: number
  status: RoadmapStepStatus
}

export interface RoadmapProgress {
  currentStep: number
  totalSteps: number
  completedSteps: number
  percentage: number
}

export interface RoadmapPhase {
  id: string
  phase: number
  title: string
  goal: string
  /** 章节导语 */
  actionIntro?: string
  /** 结构化行动步骤 */
  actionSteps?: GuideActionStep[]
  /** 建议阅读的真实文件 */
  fileRefs?: GuideFileRef[]
  /** 复现专用块（第 4 章等） */
  reproduce?: GuideReproduceBlock | null
  /** 兼容旧字段：纯文本要点 */
  learningItems: string[]
  recommendedIssues: string[]
  estimatedDuration: string
  difficulty: 'easy' | 'medium' | 'hard'
  completionCriteria: string[]
  resources: string[]
  status: RoadmapStepStatus
  tasks: RoadmapTask[]
  generationStatus?: RoadmapGenerationStatus
  generationError?: string | null
}

export interface Roadmap {
  title: string
  description: string
  totalEstimatedTime: string
  phases: RoadmapPhase[]
  tips: string[]
  confidence: number
}

/** 带给 AI 导师的贡献指南上下文 */
export interface GuideMentorContext {
  owner: string
  repo: string
  defaultBranch?: string
  issueNumber?: number
  issueTitle?: string
  phaseNumber: number
  phaseTitle: string
  phaseGoal?: string
  completedPhases: Array<{ phase: number; title: string }>
  currentStepTitle?: string
  currentCommands?: string[]
  stuckHint?: string
}
