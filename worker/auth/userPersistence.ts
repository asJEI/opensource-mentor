import { ApiError } from '../http'
import { createSupabaseClient, type AppUserRow, type DeveloperProfileRow } from '../supabase/client'
import type { PlatformEnv } from '../config'

export type GitHubIdentity = {
  id: number
  login: string
  avatar_url: string
}

export type UserPersistenceResult = {
  appUser: AppUserRow
  developerProfile: DeveloperProfileRow
}

export type DeveloperProfilePatch = {
  profile_setup_status?: 'not_started' | 'completed' | 'skipped'
  profile_confirmed?: boolean
  open_source_goal?: string
  preferred_tech_stack?: string[]
  contribution_time_budget?: string
  guidance_preference?: string
}

const APP_USER_SELECT = '*'
const DEVELOPER_PROFILE_SELECT = '*'

function encodeQuery(value: string | number): string {
  return encodeURIComponent(String(value))
}

async function findAppUserByGitHubId(
  env: PlatformEnv,
  githubId: number,
): Promise<AppUserRow | null> {
  const supabase = createSupabaseClient(env)
  const users = await supabase.request<AppUserRow[]>(
    `/app_users?github_id=eq.${encodeQuery(githubId)}&select=${APP_USER_SELECT}&limit=1`,
  )
  return users[0] ?? null
}

async function upsertAppUser(
  env: PlatformEnv,
  identity: GitHubIdentity,
): Promise<{ appUser: AppUserRow; isNew: boolean }> {
  const supabase = createSupabaseClient(env)
  const existing = await findAppUserByGitHubId(env, identity.id)
  const now = new Date().toISOString()

  if (existing) {
    const updated = await supabase.request<AppUserRow[]>(
      `/app_users?github_id=eq.${encodeQuery(identity.id)}&select=${APP_USER_SELECT}`,
      {
        method: 'PATCH',
        prefer: 'return=representation',
        body: JSON.stringify({
          github_username: identity.login,
          github_avatar: identity.avatar_url,
          updated_at: now,
        }),
      },
    )
    return { appUser: updated[0] ?? existing, isNew: false }
  }

  const inserted = await supabase.request<AppUserRow[]>(
    `/app_users?select=${APP_USER_SELECT}`,
    {
      method: 'POST',
      prefer: 'return=representation',
      body: JSON.stringify({
        github_id: identity.id,
        github_username: identity.login,
        github_avatar: identity.avatar_url,
      }),
    },
  )

  if (!inserted[0]) {
    throw new ApiError('创建用户失败', 502)
  }
  return { appUser: inserted[0], isNew: true }
}

async function findDeveloperProfile(
  env: PlatformEnv,
  appUserId: string,
): Promise<DeveloperProfileRow | null> {
  const supabase = createSupabaseClient(env)
  const byUserId = await supabase.request<DeveloperProfileRow[]>(
    `/developer_profiles?user_id=eq.${encodeQuery(appUserId)}&select=${DEVELOPER_PROFILE_SELECT}&limit=1`,
  ).catch(async () =>
    supabase.request<DeveloperProfileRow[]>(
      `/developer_profiles?app_user_id=eq.${encodeQuery(appUserId)}&select=${DEVELOPER_PROFILE_SELECT}&limit=1`,
    ),
  )
  return byUserId[0] ?? null
}

async function insertDeveloperProfile(
  env: PlatformEnv,
  appUserId: string,
  githubProfile?: unknown,
  developerProfile?: unknown,
): Promise<DeveloperProfileRow> {
  const supabase = createSupabaseClient(env)
  const base = {
    profile_setup_status: 'not_started',
    profile_confirmed: false,
    github_profile: githubProfile,
    developer_profile: developerProfile,
  }

  const inserted = await supabase.request<DeveloperProfileRow[]>(
    `/developer_profiles?select=${DEVELOPER_PROFILE_SELECT}`,
    {
      method: 'POST',
      prefer: 'return=representation',
      body: JSON.stringify({
        user_id: appUserId,
        ...base,
      }),
    },
  ).catch(async () =>
    supabase.request<DeveloperProfileRow[]>(
      `/developer_profiles?select=${DEVELOPER_PROFILE_SELECT}`,
      {
        method: 'POST',
        prefer: 'return=representation',
        body: JSON.stringify({
          app_user_id: appUserId,
          ...base,
        }),
      },
    ),
  )

  if (!inserted[0]) {
    throw new ApiError('创建 Developer Profile 失败', 502)
  }
  return inserted[0]
}

export async function persistOAuthUser(
  env: PlatformEnv,
  identity: GitHubIdentity,
  githubProfile: unknown,
  developerProfile: unknown,
): Promise<UserPersistenceResult> {
  const { appUser, isNew } = await upsertAppUser(env, identity)
  const existingProfile = await findDeveloperProfile(env, appUser.id)

  if (existingProfile) {
    const relationColumn = existingProfile.user_id ? 'user_id' : 'app_user_id'
    const supabase = createSupabaseClient(env)
    const updated = await supabase.request<DeveloperProfileRow[]>(
      `/developer_profiles?${relationColumn}=eq.${encodeQuery(appUser.id)}&select=${DEVELOPER_PROFILE_SELECT}`,
      {
        method: 'PATCH',
        prefer: 'return=representation',
        body: JSON.stringify({
          github_profile: githubProfile,
          developer_profile: developerProfile,
          updated_at: new Date().toISOString(),
        }),
      },
    )
    return { appUser, developerProfile: updated[0] ?? existingProfile }
  }

  if (!isNew) {
    return {
      appUser,
      developerProfile: await insertDeveloperProfile(
        env,
        appUser.id,
        githubProfile,
        developerProfile,
      ),
    }
  }

  return {
    appUser,
    developerProfile: await insertDeveloperProfile(
      env,
      appUser.id,
      githubProfile,
      developerProfile,
    ),
  }
}

export async function readCurrentUser(
  env: PlatformEnv,
  githubId: number,
): Promise<UserPersistenceResult | null> {
  const appUser = await findAppUserByGitHubId(env, githubId)
  if (!appUser) return null
  const developerProfile = await findDeveloperProfile(env, appUser.id)
  if (!developerProfile) return null
  return { appUser, developerProfile }
}

export async function updateDeveloperProfile(
  env: PlatformEnv,
  appUserId: string,
  patch: DeveloperProfilePatch,
): Promise<DeveloperProfileRow> {
  const existing = await findDeveloperProfile(env, appUserId)
  if (!existing) {
    throw new ApiError('Developer Profile 不存在', 404)
  }
  const relationColumn = existing.user_id ? 'user_id' : 'app_user_id'
  const supabase = createSupabaseClient(env)
  const updated = await supabase.request<DeveloperProfileRow[]>(
    `/developer_profiles?${relationColumn}=eq.${encodeQuery(appUserId)}&select=${DEVELOPER_PROFILE_SELECT}`,
    {
      method: 'PATCH',
      prefer: 'return=representation',
      body: JSON.stringify({
        ...patch,
        updated_at: new Date().toISOString(),
      }),
    },
  )
  if (!updated[0]) throw new ApiError('更新 Developer Profile 失败', 502)
  return updated[0]
}
