import type { GitHubDeveloperProfile } from '@/types'
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
    github_profile?: GitHubDeveloperProfile | null
    developer_profile?: GitHubDeveloperProfile['developerProfile'] | null
    open_source_goal?: string | null
    preferred_tech_stack?: string[] | null
    contribution_time_budget?: string | null
    guidance_preference?: string | null
  }
}

export default authService
