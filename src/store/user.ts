import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type {
  ContributionInterest,
  ExperienceLevel,
  LearningGoal,
  ProgrammingLanguage,
  ProfileSetupStatus,
  UserProfile,
  UserProfileContext,
  UserProfileFormData,
  UserPreferences,
} from '@/types'

const USER_STORAGE_KEY = 'opensource-mentor:user-profile'
const USER_STORE_VERSION = 1

const contributionInterests = [
  'frontend',
  'backend',
  'documentation',
  'testing',
  'devops',
  'ai',
  'other',
] as const satisfies readonly ContributionInterest[]

const learningGoals = [
  'first_contribution',
  'find_beginner_friendly_issues',
  'improve_engineering',
  'learn_new_technology',
] as const satisfies readonly LearningGoal[]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function filterOptions<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T[] {
  if (!Array.isArray(value)) return []

  return [...new Set(
    value.filter(
      (item): item is T =>
        typeof item === 'string' && allowed.includes(item as T),
    ),
  )]
}

function normalizeLegacyLanguages(value: unknown): ProgrammingLanguage[] {
  if (!Array.isArray(value)) return []

  const aliases: Record<string, ProgrammingLanguage> = {
    javascript: 'javascript',
    js: 'javascript',
    typescript: 'typescript',
    ts: 'typescript',
    python: 'python',
    java: 'java',
    go: 'go',
    golang: 'go',
    rust: 'rust',
    c: 'cpp',
    'c++': 'cpp',
    'c/c++': 'cpp',
    cpp: 'cpp',
    other: 'other',
  }

  return [...new Set(
    value.flatMap((item) => {
      if (typeof item !== 'string') return []
      const language = aliases[item.trim().toLowerCase()]
      return language ? [language] : []
    }),
  )]
}

function normalizeExperienceLevel(value: unknown): ExperienceLevel {
  if (
    value === 'beginner' ||
    value === 'some_experience' ||
    value === 'project_experience'
  ) {
    return value
  }

  // 兼容旧版 skillLevel
  if (value === 'intermediate') return 'some_experience'
  if (value === 'advanced') return 'project_experience'
  return 'beginner'
}

function normalizeSetupStatus(
  value: unknown,
  hasLegacyAnswers: boolean,
): ProfileSetupStatus {
  if (value === 'not_started' || value === 'completed' || value === 'skipped') {
    return value
  }
  return hasLegacyAnswers ? 'completed' : 'not_started'
}

function normalizeProfile(value: unknown): UserProfile {
  const profile = isRecord(value) ? value : {}
  const languageSource =
    profile.programmingLanguages ?? profile.techStack
  const normalizedLanguages = normalizeLegacyLanguages(languageSource)
  const normalizedInterests = filterOptions(
    profile.interests,
    contributionInterests,
  )
  const hasLegacyAnswers =
    normalizedLanguages.length > 0 || normalizedInterests.length > 0

  return {
    version: 1,
    profileSetupStatus: normalizeSetupStatus(
      profile.profileSetupStatus,
      hasLegacyAnswers,
    ),
    programmingLanguages: normalizedLanguages,
    experienceLevel: normalizeExperienceLevel(
      profile.experienceLevel ?? profile.skillLevel,
    ),
    interests: normalizedInterests,
    goals: filterOptions(profile.goals, learningGoals),
    username: typeof profile.username === 'string' ? profile.username : '',
    avatar: typeof profile.avatar === 'string' ? profile.avatar : '',
    contributionLevel:
      profile.contributionLevel === 'low' ||
      profile.contributionLevel === 'medium' ||
      profile.contributionLevel === 'high'
        ? profile.contributionLevel
        : 'none',
  }
}

function normalizePreferences(value: unknown): UserPreferences {
  const preferences = isRecord(value) ? value : {}
  const theme =
    preferences.theme === 'dark' || preferences.theme === 'system'
      ? preferences.theme
      : 'light'

  return {
    theme,
    language:
      typeof preferences.language === 'string'
        ? preferences.language
        : 'zh-CN',
    notifications:
      typeof preferences.notifications === 'boolean'
        ? preferences.notifications
        : true,
  }
}

/**
 * 默认用户资料
 */
export const DEFAULT_USER_PROFILE: UserProfile = {
  version: 1,
  profileSetupStatus: 'not_started',
  programmingLanguages: [],
  experienceLevel: 'beginner',
  interests: [],
  goals: [],
  username: '',
  avatar: '',
  contributionLevel: 'none',
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
  /** 是否已登录（预留：未来 GitHub OAuth / D1 用户体系；当前始终访客模式） */
  isAuthenticated: boolean

  // ---- Actions ----
  /** 部分更新用户资料 */
  updateProfile: (partial: Partial<UserProfile>) => void
  /** 保存问卷结果并标记画像已完成 */
  completeProfileSetup: (formData: UserProfileFormData) => void
  /** 跳过问卷并使用纯新手默认画像 */
  skipProfileSetup: () => void
  /** 重置为纯新手画像，保留已有展示身份 */
  resetProfile: () => void
  /** 部分更新用户偏好 */
  updatePreferences: (partial: Partial<UserPreferences>) => void
  /** 设置认证状态 */
  setAuthenticated: (value: boolean) => void
}

type PersistedUserState = Pick<UserState, 'profile' | 'preferences'>

/** 推荐、路线等业务统一使用的最小画像 selector */
export const selectUserProfileContext = (
  state: Pick<UserState, 'profile'>,
): UserProfileContext => ({
  profileSetupStatus: state.profile.profileSetupStatus,
  programmingLanguages: state.profile.programmingLanguages,
  experienceLevel: state.profile.experienceLevel,
  interests: state.profile.interests,
  goals: state.profile.goals,
})

export const getEffectiveUserProfileContext = (): UserProfileContext => {
  const profile = useUserStore.getState().profile
  return selectUserProfileContext({
    profile:
      profile.profileSetupStatus === 'not_started'
        ? createDefaultProfile('skipped', profile)
        : profile,
  })
}

function createDefaultProfile(
  status: ProfileSetupStatus,
  current?: UserProfile,
): UserProfile {
  return {
    ...DEFAULT_USER_PROFILE,
    profileSetupStatus: status,
    programmingLanguages: [],
    interests: [],
    goals: [],
    username: current?.username ?? '',
    avatar: current?.avatar ?? '',
    contributionLevel: current?.contributionLevel ?? 'none',
  }
}

function normalizePersistedState(value: unknown): PersistedUserState {
  const state = isRecord(value) ? value : {}
  return {
    profile: normalizeProfile(state.profile),
    preferences: normalizePreferences(state.preferences),
  }
}

export const useUserStore = create<UserState>()(
  persist<UserState, [], [], PersistedUserState>(
    (set) => ({
      profile: { ...DEFAULT_USER_PROFILE },
      preferences: defaultPreferences,
      isAuthenticated: false,

      updateProfile: (partial) =>
        set((state) => ({
          profile: normalizeProfile({ ...state.profile, ...partial }),
        })),

      completeProfileSetup: (formData) =>
        set((state) => ({
          profile: normalizeProfile({
            ...state.profile,
            ...formData,
            profileSetupStatus: 'completed',
          }),
        })),

      skipProfileSetup: () =>
        set((state) => ({
          profile: createDefaultProfile('skipped', state.profile),
        })),

      resetProfile: () =>
        set((state) => ({
          profile: createDefaultProfile('completed', state.profile),
        })),

      updatePreferences: (partial) =>
        set((state) => ({
          preferences: normalizePreferences({
            ...state.preferences,
            ...partial,
          }),
        })),

      /** 预留：未来 GitHub OAuth 成功后置 true；当前产品不要求登录 */
      setAuthenticated: (value) => set({ isAuthenticated: value }),
    }),
    {
      name: USER_STORAGE_KEY,
      version: USER_STORE_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        profile: state.profile,
        preferences: state.preferences,
      }),
      migrate: (persistedState) =>
        normalizePersistedState(persistedState),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...normalizePersistedState(persistedState),
      }),
    },
  ),
)

export default useUserStore
