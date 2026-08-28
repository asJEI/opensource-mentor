/**
 * 用户相关类型定义
 */

/** 用户画像数据版本；升级结构时递增并在 Store 中执行迁移 */
export type UserProfileVersion = 2

/** 用户掌握或正在学习的编程语言 */
export type ProgrammingLanguage =
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'java'
  | 'go'
  | 'rust'
  | 'cpp'
  | 'other'

/** 开发与开源经验 */
export type ExperienceLevel =
  | 'beginner'
  | 'some_experience'
  | 'project_experience'

/** 感兴趣的贡献方向 */
export type ContributionInterest =
  | 'frontend'
  | 'backend'
  | 'documentation'
  | 'testing'
  | 'devops'
  | 'ai'
  | 'other'

/** 参与开源的目标 */
export type LearningGoal =
  | 'first_contribution'
  | 'find_beginner_friendly_issues'
  | 'improve_engineering'
  | 'learn_new_technology'

export type OpenSourceGoal =
  | 'ship_first_pr'
  | 'improve_skills'
  | 'build_github_profile'
  | 'contribute_liked_projects'
  | 'long_term_contributor'

export type ContributionTimeBudget =
  | 'lt_1h'
  | '1_3h'
  | '3_6h'
  | 'weekend'
  | 'no_preference'

export type GuidancePreference =
  | 'step_by_step'
  | 'hints_when_stuck'
  | 'find_good_issues'

/** 用户画像填写状态 */
export type ProfileSetupStatus = 'not_started' | 'completed' | 'skipped'

/** 贡献等级 */
export type ContributionLevel = 'none' | 'low' | 'medium' | 'high'

/** 用户个人资料 */
export interface UserProfile {
  /** 数据结构版本，用于 localStorage 数据迁移 */
  version: UserProfileVersion
  /** 首次画像问卷状态 */
  profileSetupStatus: ProfileSetupStatus
  /** 用户掌握或正在学习的语言 */
  programmingLanguages: ProgrammingLanguage[]
  /** 当前开发与开源经验 */
  experienceLevel: ExperienceLevel
  /** 感兴趣的贡献方向 */
  interests: ContributionInterest[]
  /** 学习和贡献目标 */
  goals: LearningGoal[]
  /** 首次进入产品时补充的开源目标 */
  openSourceGoal: OpenSourceGoal | ''
  /** 希望工作的技术栈，来自 GitHub 预选并允许用户编辑 */
  preferredTechStack: string[]
  /** 下一次贡献的期望时间投入 */
  contributionTimeBudget: ContributionTimeBudget | ''
  /** 希望获得的陪伴程度 */
  guidancePreference: GuidancePreference | ''
  /** 用户名 */
  username: string
  /** 头像 URL */
  avatar: string
  /** GitHub 个人简介 */
  bio: string
  /** GitHub 主页 URL */
  githubUrl: string
  /** 开源贡献等级 */
  contributionLevel: ContributionLevel
}

export interface GitHubRepositoryProfile {
  name: string
  fullName: string
  owner: string
  htmlUrl: string
  description: string
  language: string
  topics: string[]
  stars: number
  forks: number
  isFork: boolean
  isArchived: boolean
  isOwnRepository: boolean
  pushedAt: string
  updatedAt: string
}

export interface GitHubDeveloperProfile {
  authenticatedAt: string
  inferredContributionLevel?: Exclude<ContributionLevel, 'none'>
  developerProfile?: StructuredDeveloperProfile
  profile: {
    username: string
    name: string
    avatar: string
    bio: string
    htmlUrl: string
    company: string
    blog: string
    location: string
    publicRepos: number
    followers: number
    following: number
    createdAt: string
  }
  repositories: GitHubRepositoryProfile[]
  recentRepositories: string[]
  languages: Array<{ name: string; score: number; repositories: number }>
  topics: Array<{ name: string; count: number }>
  projectTypes: Array<{ type: string; score: number }>
  contributions: {
    publicEventCount: number
    pullRequestsAuthored: number
    issuesAuthored: number
    contributedToOthers: boolean
    externalContributionCount: number
    recentEventTypes: Record<string, number>
    recentExternalRepositories: string[]
    recentPullRequests: Array<{
      title: string
      url: string
      repository: string
      state: string
      updatedAt: string
    }>
    recentIssues: Array<{
      title: string
      url: string
      repository: string
      state: string
      updatedAt: string
    }>
  }
}

export interface StructuredDeveloperProfile {
  level: 'beginner' | 'intermediate' | 'advanced'
  confidence: number
  languages: Array<{
    name: string
    level: 'beginner' | 'intermediate' | 'advanced'
    confidence: number
  }>
  frameworks: string[]
  domains: string[]
  open_source_experience: 'none' | 'beginner' | 'experienced'
  strengths: string[]
  possible_weaknesses: string[]
  evidence: string[]
  github_summary: string
}

/** 画像表单可编辑字段；展示身份字段由其他流程维护 */
export type UserProfileFormData = Pick<
  UserProfile,
  'programmingLanguages' | 'experienceLevel' | 'interests' | 'goals'
> &
  Partial<
    Pick<
      UserProfile,
      | 'openSourceGoal'
      | 'preferredTechStack'
      | 'contributionTimeBudget'
      | 'guidancePreference'
    >
  >

/** 发送给个性化业务的最小画像上下文，不包含展示身份信息 */
export type UserProfileContext = Pick<
  UserProfile,
  | 'profileSetupStatus'
  | 'programmingLanguages'
  | 'experienceLevel'
  | 'interests'
  | 'goals'
>

/** 用户偏好设置 */
export interface UserPreferences {
  /** 主题：亮色 / 暗色 / 跟随系统 */
  theme: 'light' | 'dark' | 'system'
  /** 界面语言 */
  language: string
  /** 是否启用通知 */
  notifications: boolean
}
