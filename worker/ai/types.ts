import type { IssueDto, RepositoryDto } from '../github/types'

export type UserProfileContext = {
  profileSetupStatus: 'not_started' | 'completed' | 'skipped'
  programmingLanguages: Array<
    | 'javascript'
    | 'typescript'
    | 'python'
    | 'java'
    | 'go'
    | 'rust'
    | 'cpp'
    | 'other'
  >
  experienceLevel: 'beginner' | 'some_experience' | 'project_experience'
  interests: Array<
    | 'frontend'
    | 'backend'
    | 'documentation'
    | 'testing'
    | 'devops'
    | 'ai'
    | 'other'
  >
  goals: Array<
    | 'first_contribution'
    | 'find_beginner_friendly_issues'
    | 'improve_engineering'
    | 'learn_new_technology'
  >
}

export interface RepoAnalysis {
  overview: string
  techStack: {
    primaryLanguage: string
    coreTechnologies: string[]
    buildTools: string[]
    testFrameworks: string[]
    architecture: string
  }
  activity: {
    level: 'very-active' | 'active' | 'moderate' | 'low' | 'inactive'
    commitFrequency: string
    maintainerResponsiveness: string
    lastMajorUpdate: string
  }
  beginnerFriendliness: {
    level: 'very-friendly' | 'friendly' | 'moderate' | 'challenging' | 'hard'
    score: number
    friendlyFactors: string[]
    challengingFactors: string[]
  }
  domains: string[]
  gettingStartedTips: string[]
  contributionAreas: Array<{
    name: string
    description: string
    difficulty: 'easy' | 'medium' | 'hard'
    whyGoodForBeginners: string
  }>
  confidence: number
}

export interface MatchDetails {
  difficultyMatch: number
  skillMatch: number
  impactScore: number
  activityScore: number
  beginnerFriendlyScore: number
}

export interface RecommendedIssue extends IssueDto {
  matchScore: number
  matchReasons: string[]
  difficulty: 'easy' | 'medium' | 'hard'
  recommendationScore: number
  confidence: number
  recommendationReasons: string[]
  matchDetails: MatchDetails
}

export interface IssueRecommendation {
  items: RecommendedIssue[]
  total: number
  summary: string
}

export interface PrDraft {
  title: string
  description: string
  type:
    | 'feat'
    | 'fix'
    | 'docs'
    | 'refactor'
    | 'test'
    | 'chore'
    | 'style'
    | 'perf'
  relatedIssue: string
  changes: string[]
  testingTips: string[]
  notes: string[]
  confidence: number
  improvementSuggestions: string[]
}

export interface GuideFileRef {
  path: string
  reason: string
}

export interface GuideActionStep {
  id?: string
  title: string
  description?: string
  commands?: string[]
  expectedResult?: string
  checkboxLabel?: string
}

export interface GuideReproduceBlock {
  title?: string
  steps: string[]
  constructExample?: string
  expectedBehavior?: string
  actualBehavior?: string
  checkboxLabel?: string
}

export interface RoadmapPhase {
  phase: number
  title: string
  goal: string
  actionIntro?: string
  actionSteps?: GuideActionStep[]
  fileRefs?: GuideFileRef[]
  reproduce?: GuideReproduceBlock | null
  learningItems: string[]
  recommendedIssues: string[]
  estimatedDuration: string
  difficulty: 'easy' | 'medium' | 'hard'
  completionCriteria: string[]
  resources: string[]
}

export interface Roadmap {
  title: string
  description: string
  totalEstimatedTime: string
  phases: RoadmapPhase[]
  tips: string[]
  confidence: number
}

/** 从前端贡献指南带入 AI 导师的进度上下文 */
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

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatResponse {
  message: string
  relatedIssues?: number[]
  suggestedNextSteps?: string[]
  confidence?: number
}

export type { IssueDto, RepositoryDto }
