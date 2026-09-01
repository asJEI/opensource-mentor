import type {
  DeveloperProfileStatus,
  GitHubDeveloperProfile,
  StructuredDeveloperProfile,
} from '@/types'
import { bffGet, bffPatch, bffPost } from './request'

export const GITHUB_OAUTH_PROFILE_STORAGE_KEY =
  'opensource-mentor:github-oauth-profile'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isGitHubDeveloperProfile(
  value: unknown,
): value is GitHubDeveloperProfile {
  if (!isRecord(value) || !isRecord(value.profile)) return false
  return (
    typeof value.profile.username === 'string' &&
    typeof value.profile.avatar === 'string'
  )
}

function isStructuredDeveloperProfile(
  value: unknown,
): value is StructuredDeveloperProfile {
  if (!isRecord(value)) return false
  return (
    (value.level === 'beginner' ||
      value.level === 'intermediate' ||
      value.level === 'advanced') &&
    Array.isArray(value.languages)
  )
}

function structuredFromMe(
  row: ServerMeResponse['developerProfile'],
): StructuredDeveloperProfile | null {
  if (isStructuredDeveloperProfile(row.developer_profile)) {
    return row.developer_profile
  }
  if (
    isGitHubDeveloperProfile(row.github_profile) &&
    isStructuredDeveloperProfile(row.github_profile.developerProfile)
  ) {
    return row.github_profile.developerProfile
  }
  if (
    row.developer_level === 'beginner' ||
    row.developer_level === 'intermediate' ||
    row.developer_level === 'advanced'
  ) {
    return {
      level: row.developer_level,
      confidence: 0.5,
      languages: Array.isArray(row.languages)
        ? row.languages.filter(
            (item): item is StructuredDeveloperProfile['languages'][number] =>
              isRecord(item) && typeof item.name === 'string',
          )
        : [],
      frameworks: row.frameworks ?? [],
      domains: row.domains ?? [],
      open_source_experience:
        row.open_source_experience === 'none' ||
        row.open_source_experience === 'beginner' ||
        row.open_source_experience === 'experienced'
          ? row.open_source_experience
          : 'none',
      strengths: row.strengths ?? [],
      possible_weaknesses: row.possible_weaknesses ?? [],
      evidence: row.evidence ?? [],
      github_summary: row.github_summary ?? '',
    }
  }
  return null
}

export function hydrateGitHubProfileFromMe(
  me: ServerMeResponse,
  fallback: GitHubDeveloperProfile | null = null,
): GitHubDeveloperProfile | null {
  const structured = structuredFromMe(me.developerProfile)
  const githubProfile = isGitHubDeveloperProfile(
    me.developerProfile.github_profile,
  )
    ? me.developerProfile.github_profile
    : fallback

  if (!githubProfile) return fallback
  return {
    ...githubProfile,
    developerProfile: structured ?? githubProfile.developerProfile,
  }
}

export function toServerUserState(
  me: ServerMeResponse,
  fallbackGithubProfile: GitHubDeveloperProfile | null = null,
) {
  return {
    githubProfile: hydrateGitHubProfileFromMe(me, fallbackGithubProfile),
    githubUsername: me.user.githubUsername,
    githubAvatar: me.user.githubAvatar,
    profileSetupStatus: me.developerProfile.profile_setup_status,
    profileConfirmed: me.developerProfile.profile_confirmed,
    profileStatus: me.developerProfile.profile_status ?? 'pending',
    openSourceGoal: me.developerProfile.open_source_goal,
    preferredTechStack: me.developerProfile.preferred_tech_stack,
    contributionTimeBudget: me.developerProfile.contribution_time_budget,
    guidancePreference: me.developerProfile.guidance_preference,
  }
}

export const authService = {
  startGitHubLogin() {
    window.location.assign('/api/auth/github/start')
  },

  consumeGitHubOAuthProfile(): GitHubDeveloperProfile | null {
    const raw = window.localStorage.getItem(GITHUB_OAUTH_PROFILE_STORAGE_KEY)
    if (!raw) return null

    window.localStorage.removeItem(GITHUB_OAUTH_PROFILE_STORAGE_KEY)

    try {
      const parsed = JSON.parse(raw) as unknown
      return isGitHubDeveloperProfile(parsed) ? parsed : null
    } catch {
      return null
    }
  },

  getMe() {
    return bffGet<ServerMeResponse>('/me')
  },

  updateDeveloperProfile(payload: {
    profileSetupStatus?: 'not_started' | 'completed' | 'skipped'
    profileConfirmed?: boolean
    openSourceGoal?: string
    preferredTechStack?: string[]
    contributionTimeBudget?: string
    guidancePreference?: string
  }) {
    return bffPatch<ServerMeResponse>('/me/developer-profile', payload)
  },

  logout() {
    return bffPost<{ ok: true }>('/me/logout')
  },
}

export type ServerMeResponse = {
  user: {
    id: string
    githubId: number
    githubUsername: string
    githubAvatar: string
    createdAt?: string
    updatedAt?: string
  }
  developerProfile: {
    id: string
    profile_setup_status: 'not_started' | 'completed' | 'skipped'
    profile_confirmed: boolean
    profile_status?: DeveloperProfileStatus
    github_profile?: GitHubDeveloperProfile | null
    developer_profile?: StructuredDeveloperProfile | null
    developer_level?: string | null
    languages?: StructuredDeveloperProfile['languages'] | null
    frameworks?: string[] | null
    domains?: string[] | null
    open_source_experience?: string | null
    strengths?: string[] | null
    possible_weaknesses?: string[] | null
    evidence?: string[] | null
    github_summary?: string | null
    open_source_goal?: string | null
    preferred_tech_stack?: string[] | null
    contribution_time_budget?: string | null
    guidance_preference?: string | null
  }
}

export default authService
