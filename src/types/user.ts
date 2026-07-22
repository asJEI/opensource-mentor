/**
 * 用户相关类型定义
 */

/** 用户画像数据版本；升级结构时递增并在 Store 中执行迁移 */
export type UserProfileVersion = 1

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
  /** 用户名 */
  username: string
  /** 头像 URL */
  avatar: string
  /** 开源贡献等级 */
  contributionLevel: ContributionLevel
}

/** 画像表单可编辑字段；展示身份字段由其他流程维护 */
export type UserProfileFormData = Pick<
  UserProfile,
  'programmingLanguages' | 'experienceLevel' | 'interests' | 'goals'
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
