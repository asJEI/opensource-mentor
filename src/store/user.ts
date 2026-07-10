import { create } from 'zustand'
import type { UserProfile, UserPreferences, SkillLevel, ContributionLevel } from '@/types'

/**
 * 默认用户资料
 */
const defaultProfile: UserProfile = {
  username: '',
  avatar: '',
  skillLevel: 'beginner' as SkillLevel,
  interests: [],
  techStack: [],
  contributionLevel: 'none' as ContributionLevel,
}

/**
 * 默认用户偏好
 */
const defaultPreferences: UserPreferences = {
  theme: 'light',
  language: 'zh-CN',
  notifications: true,
}

/**
 * 用户状态 Store
 * 管理用户个人资料、偏好设置、认证状态等
 */
interface UserState {
  /** 用户个人资料 */
  profile: UserProfile
  /** 用户偏好设置 */
  preferences: UserPreferences
  /** 是否已认证 */
  isAuthenticated: boolean

  // ---- Actions ----
  /** 部分更新用户资料 */
  updateProfile: (partial: Partial<UserProfile>) => void
  /** 部分更新用户偏好 */
  updatePreferences: (partial: Partial<UserPreferences>) => void
  /** 设置认证状态 */
  setAuthenticated: (value: boolean) => void
}

export const useUserStore = create<UserState>((set) => ({
  profile: defaultProfile,
  preferences: defaultPreferences,
  isAuthenticated: false,

  updateProfile: (partial: Partial<UserProfile>) =>
    set((state) => ({ profile: { ...state.profile, ...partial } })),

  updatePreferences: (partial: Partial<UserPreferences>) =>
    set((state) => ({ preferences: { ...state.preferences, ...partial } })),

  setAuthenticated: (value: boolean) => set({ isAuthenticated: value }),
}))

export default useUserStore
