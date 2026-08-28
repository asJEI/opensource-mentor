import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type {
  ContributionInterest,
  ContributionTimeBudget,
  ExperienceLevel,
  GuidancePreference,
  LearningGoal,
  OpenSourceGoal,
  ProgrammingLanguage,
  ProfileSetupStatus,
  GitHubDeveloperProfile,
  UserProfile,
  UserProfileContext,
  UserProfileFormData,
  UserPreferences,
} from '@/types'

const USER_STORAGE_KEY = 'opensource-mentor:user-profile'
const USER_STORE_VERSION = 2

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

const openSourceGoals = [
  'ship_first_pr',
  'improve_skills',
  'build_github_profile',
  'contribute_liked_projects',
  'long_term_contributor',
] as const satisfies readonly OpenSourceGoal[]

const contributionTimeBudgets = [
  'lt_1h',
  '1_3h',
  '3_6h',
  'weekend',
  'no_preference',
] as const satisfies readonly ContributionTimeBudget[]

const guidancePreferences = [
  'step_by_step',
  'hints_when_stuck',
  'find_good_issues',
] as const satisfies readonly GuidancePreference[]

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

function normalizeOptionalEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | '' {
  return typeof value === 'string' && allowed.includes(value as T)
    ? (value as T)
    : ''
}

function normalizeTechStack(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [
    ...new Set(
      value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 16),
    ),
  ]
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
    version: 2,
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
    openSourceGoal: normalizeOptionalEnum(
      profile.openSourceGoal,
      openSourceGoals,
    ),
    preferredTechStack: normalizeTechStack(profile.preferredTechStack),
    contributionTimeBudget: normalizeOptionalEnum(
      profile.contributionTimeBudget,
      contributionTimeBudgets,
    ),
    guidancePreference: normalizeOptionalEnum(
      profile.guidancePreference,
      guidancePreferences,
    ),
    username: typeof profile.username === 'string' ? profile.username : '',
    avatar: typeof profile.avatar === 'string' ? profile.avatar : '',
    bio: typeof profile.bio === 'string' ? profile.bio : '',
    githubUrl:
      typeof profile.githubUrl === 'string' ? profile.githubUrl : '',
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
  version: 2,
  profileSetupStatus: 'not_started',
  programmingLanguages: [],
  experienceLevel: 'beginner',
  interests: [],
  goals: [],
  openSourceGoal: '',
  preferredTechStack: [],
  contributionTimeBudget: '',
  guidancePreference: '',
  username: '',
  avatar: '',
  bio: '',
  githubUrl: '',
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
  /** 是否已登录 GitHub */
  isAuthenticated: boolean
  /** GitHub OAuth 读取到的公开开发者画像 */
  githubProfile: GitHubDeveloperProfile | null

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
  /** 应用 GitHub OAuth 回调返回的公开画像 */
  applyGitHubOAuthProfile: (profile: GitHubDeveloperProfile) => void
  /** 应用服务端 /api/me 返回的持久化状态 */
  applyServerUserState: (input: {
    githubProfile: GitHubDeveloperProfile | null
    githubUsername: string
    githubAvatar: string
    profileSetupStatus: ProfileSetupStatus
    profileConfirmed: boolean
    openSourceGoal?: string | null
    preferredTechStack?: string[] | null
    contributionTimeBudget?: string | null
    guidancePreference?: string | null
  }) => void
  /** 退出当前设备上的 GitHub 登录态 */
  logout: () => void
}

type PersistedUserState = Pick<
  UserState,
  'profile' | 'preferences' | 'isAuthenticated' | 'githubProfile'
>

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
    openSourceGoal: current?.openSourceGoal ?? '',
    preferredTechStack: current?.preferredTechStack ?? [],
    contributionTimeBudget: current?.contributionTimeBudget ?? '',
    guidancePreference: current?.guidancePreference ?? '',
    username: current?.username ?? '',
    avatar: current?.avatar ?? '',
    bio: current?.bio ?? '',
    githubUrl: current?.githubUrl ?? '',
    contributionLevel: current?.contributionLevel ?? 'none',
  }
}

function normalizeGitHubProfile(value: unknown): GitHubDeveloperProfile | null {
  if (!isRecord(value) || !isRecord(value.profile)) return null
  if (
    typeof value.authenticatedAt !== 'string' ||
    typeof value.profile.username !== 'string' ||
    typeof value.profile.avatar !== 'string'
  ) {
    return null
  }

  return value as unknown as GitHubDeveloperProfile
}

function normalizePersistedState(value: unknown): PersistedUserState {
  const state = isRecord(value) ? value : {}
  const githubProfile = normalizeGitHubProfile(state.githubProfile)
  return {
    profile: normalizeProfile(state.profile),
    preferences: normalizePreferences(state.preferences),
    isAuthenticated:
      typeof state.isAuthenticated === 'boolean'
        ? state.isAuthenticated
        : Boolean(githubProfile),
    githubProfile,
  }
}

export const useUserStore = create<UserState>()(
  persist<UserState, [], [], PersistedUserState>(
    (set) => ({
      profile: { ...DEFAULT_USER_PROFILE },
      preferences: defaultPreferences,
      isAuthenticated: false,
      githubProfile: null,

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

      setAuthenticated: (value) => set({ isAuthenticated: value }),

      applyGitHubOAuthProfile: (githubProfile) =>
        set((state) => ({
          isAuthenticated: true,
          githubProfile,
          profile: normalizeProfile({
            ...state.profile,
            username: githubProfile.profile.name || githubProfile.profile.username,
            avatar: githubProfile.profile.avatar,
            bio: githubProfile.profile.bio,
            githubUrl: githubProfile.profile.htmlUrl,
            profileSetupStatus:
              state.profile.profileSetupStatus === 'completed'
                ? 'completed'
                : 'not_started',
            preferredTechStack:
              state.profile.preferredTechStack.length > 0
                ? state.profile.preferredTechStack
                : [
                    ...new Set([
                      ...(githubProfile.developerProfile?.languages.map(
                        (item) => item.name,
                      ) ?? []),
                      ...(githubProfile.developerProfile?.frameworks ?? []),
                    ]),
                  ].slice(0, 8),
            contributionLevel:
              githubProfile.inferredContributionLevel ??
              state.profile.contributionLevel,
          }),
        })),

      applyServerUserState: (input) =>
        set((state) => {
          const githubProfile = input.githubProfile
          return {
            isAuthenticated: true,
            githubProfile,
            profile: normalizeProfile({
              ...state.profile,
              username:
                githubProfile?.profile.name ||
                githubProfile?.profile.username ||
                input.githubUsername,
              avatar: githubProfile?.profile.avatar || input.githubAvatar,
              bio: githubProfile?.profile.bio || state.profile.bio,
              githubUrl:
                githubProfile?.profile.htmlUrl || state.profile.githubUrl,
              profileSetupStatus: input.profileSetupStatus,
              openSourceGoal: input.openSourceGoal,
              preferredTechStack: input.preferredTechStack,
              contributionTimeBudget: input.contributionTimeBudget,
              guidancePreference: input.guidancePreference,
              contributionLevel:
                githubProfile?.inferredContributionLevel ??
                state.profile.contributionLevel,
            }),
          }
        }),

      logout: () =>
        set((state) => ({
          isAuthenticated: false,
          githubProfile: null,
          profile: normalizeProfile({
            ...state.profile,
            username: '',
            avatar: '',
            bio: '',
            githubUrl: '',
            contributionLevel: 'none',
          }),
        })),
    }),
    {
      name: USER_STORAGE_KEY,
      version: USER_STORE_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        profile: state.profile,
        preferences: state.preferences,
        isAuthenticated: state.isAuthenticated,
        githubProfile: state.githubProfile,
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
