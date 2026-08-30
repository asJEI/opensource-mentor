/**
 * 类型定义统一导出入口
 * 所有业务类型均通过此文件统一导出，方便外部引用
 */

// 仓库相关
export type {
  Repository,
  RepositoryAnalysis,
  DifficultyLevel,
  AnalysisStatus,
  RepoAnalysis,
  TechStackAnalysis,
  ActivityAnalysis,
  BeginnerFriendliness,
  ContributionArea,
} from './repository'

// Issue 相关
export type {
  Issue,
  IssueLabel,
  RecommendedIssue,
  MatchBreakdown,
  MatchDetails,
  IssueFilter,
  IssueRecommendation,
  CandidateIssue,
  CandidateIssueAnalysisResult,
  CandidateIssuesMeta,
  CandidateIssuesResult,
} from './issue'

// AI / LLM 相关
export type {
  ChatMessage,
  ChatSession,
  ChatRole,
  AISuggestion,
  AISuggestionType,
  IssueExplain,
  ChatResponse,
} from './ai'

// PR 生成相关
export type { PrType, PrDraft, PrChecklistItem, PrSuggestion, PrSuggestionType } from './pr'

// 路线图相关
export type {
  RoadmapStep,
  RoadmapTask,
  RoadmapProgress,
  RoadmapStepStatus,
  RoadmapGenerationStatus,
  Roadmap,
  RoadmapPhase,
  GuideFileRef,
  GuideActionStep,
  GuideReproduceBlock,
  GuideMentorContext,
} from './roadmap'

// 用户相关
export type {
  UserProfile,
  UserProfileFormData,
  UserProfileContext,
  UserProfileVersion,
  ProgrammingLanguage,
  ExperienceLevel,
  ContributionInterest,
  ContributionTimeBudget,
  GuidancePreference,
  OpenSourceGoal,
  LearningGoal,
  ProfileSetupStatus,
  UserPreferences,
  ContributionLevel,
  GitHubDeveloperProfile,
  GitHubRepositoryProfile,
  StructuredDeveloperProfile,
} from './user'

// 通用
export type {
  ToastMessage,
  ToastType,
  LoadingState,
  ApiResponse,
  PaginationParams,
} from './common'

// 代码审查相关
export type {
  ReviewStatus,
  ReviewPhaseStatus,
  ReviewProgress,
  ReviewSeverity,
  ReviewCategory,
  ReviewIssue,
  ReviewSummary,
  RiskItem,
  RiskReviewReport,
  PraiseItem,
  ReviewResult,
  ReviewChangedFile,
  ReviewJobArtifacts,
  ReviewInputMode,
  ReviewCompareInput,
  CreateReviewRequest,
  ReviewJobRecord,
  ReviewTab,
  DiffLine,
  DiffHunk,
} from './codeReview'

// API 设置
export type {
  ApiConfigMode,
  GitHubApiConfig,
  AIProvider,
  AIProviderConfig,
  AIModelOption,
  AIModelsResult,
  ConnectionTestResult,
} from './settings'
