/**
 * 用户相关类型定义
 */

/** 技能等级 */
export type SkillLevel = 'beginner' | 'intermediate' | 'advanced'

/** 贡献等级 */
export type ContributionLevel = 'none' | 'low' | 'medium' | 'high'

/** 用户个人资料 */
export interface UserProfile {
  /** 用户名 */
  username: string
  /** 头像 URL */
  avatar: string
  /** 技能等级 */
  skillLevel: SkillLevel
  /** 兴趣领域列表 */
  interests: string[]
  /** 掌握的技术栈 */
  techStack: string[]
  /** 开源贡献等级 */
  contributionLevel: ContributionLevel
}

/** 用户偏好设置 */
export interface UserPreferences {
  /** 主题：亮色 / 暗色 / 跟随系统 */
  theme: 'light' | 'dark' | 'system'
  /** 界面语言 */
  language: string
  /** 是否启用通知 */
  notifications: boolean
}
