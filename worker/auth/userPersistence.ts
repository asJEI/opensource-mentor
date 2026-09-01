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

export type OAuthPersistenceDiagnostics = {
  measure: <T>(
    stage: string,
    operation: () => Promise<T>,
    metadata?: Record<string, unknown>,
  ) => Promise<T>
}

const APP_USER_SELECT = '*'
const DEVELOPER_PROFILE_SELECT = '*'
const OPTIONAL_PROFILE_COLUMNS = [
  'github_profile',
  'developer_profile',
  'open_source_goal',
  'preferred_tech_stack',
  'contribution_time_budget',
  'guidance_preference',
] as const

function encodeQuery(value: string | number): string {
  return encodeURIComponent(String(value))
}

function hasColumn(row: DeveloperProfileRow, column: string): boolean {
  return Object.prototype.hasOwnProperty.call(row, column)
}

function pickKnownProfilePatch(
  row: DeveloperProfileRow,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(patch).filter(([key]) => {
      if (key === 'updated_at') return hasColumn(row, key)
      if ((OPTIONAL_PROFILE_COLUMNS as readonly string[]).includes(key)) {
        return hasColumn(row, key)
      }
      return true
    }),
  )
}

async function findAppUserByGitHubId(
  env: PlatformEnv,
  githubId: number,
  diagnostics?: OAuthPersistenceDiagnostics,
): Promise<AppUserRow | null> {
  const supabase = createSupabaseClient(env)
  const users = await (diagnostics?.measure ?? ((_, operation) => operation()))(
    'supabase.app_user.query',
    () =>
      supabase.request<AppUserRow[]>(
        `/app_users?github_id=eq.${encodeQuery(githubId)}&select=${APP_USER_SELECT}&limit=1`,
      ),
  )
  return users[0] ?? null
}

async function upsertAppUser(
  env: PlatformEnv,
  identity: GitHubIdentity,
  diagnostics?: OAuthPersistenceDiagnostics,
): Promise<{ appUser: AppUserRow; isNew: boolean }> {
  const supabase = createSupabaseClient(env)
  const existing = await findAppUserByGitHubId(env, identity.id, diagnostics)
  const now = new Date().toISOString()

  if (existing) {
    const updated = await (diagnostics?.measure ?? ((_, operation) => operation()))(
      'supabase.app_user.upsert',
      () =>
        supabase.request<AppUserRow[]>(
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
        ),
      { operation: 'patch' },
    )
    return { appUser: updated[0] ?? existing, isNew: false }
  }

  const inserted = await (diagnostics?.measure ?? ((_, operation) => operation()))(
    'supabase.app_user.upsert',
    () =>
      supabase.request<AppUserRow[]>(
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
      ),
    { operation: 'insert' },
  )

  if (!inserted[0]) {
    throw new ApiError('创建用户失败', 502)
  }
  return { appUser: inserted[0], isNew: true }
}

async function findDeveloperProfile(
  env: PlatformEnv,
  appUserId: string,
  diagnostics?: OAuthPersistenceDiagnostics,
): Promise<DeveloperProfileRow | null> {
  const supabase = createSupabaseClient(env)
  const byUserId = await (diagnostics?.measure ?? ((_, operation) => operation()))(
    'supabase.developer_profile.query',
    () =>
      supabase.request<DeveloperProfileRow[]>(
        `/developer_profiles?user_id=eq.${encodeQuery(appUserId)}&select=${DEVELOPER_PROFILE_SELECT}&limit=1`,
      ).catch(async () =>
        supabase.request<DeveloperProfileRow[]>(
          `/developer_profiles?app_user_id=eq.${encodeQuery(appUserId)}&select=${DEVELOPER_PROFILE_SELECT}&limit=1`,
        ),
      ),
  )
  return byUserId[0] ?? null
}

async function insertDeveloperProfile(
  env: PlatformEnv,
  appUserId: string,
  githubProfile?: unknown,
  developerProfile?: unknown,
  diagnostics?: OAuthPersistenceDiagnostics,
): Promise<DeveloperProfileRow> {
  const supabase = createSupabaseClient(env)
  const base = {
    profile_setup_status: 'not_started',
    profile_confirmed: false,
  }

  const inserted = await (diagnostics?.measure ?? ((_, operation) => operation()))(
    'supabase.developer_profile.create',
    () =>
      supabase.request<DeveloperProfileRow[]>(
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
      ),
  )

  if (!inserted[0]) {
    throw new ApiError('创建 Developer Profile 失败', 502)
  }
  return patchProfileSnapshot(
    env,
    inserted[0],
    appUserId,
    githubProfile,
    developerProfile,
    diagnostics,
  )
}

async function patchDeveloperProfile(
  env: PlatformEnv,
  existing: DeveloperProfileRow,
  appUserId: string,
  patch: Record<string, unknown>,
): Promise<DeveloperProfileRow> {
  const relationColumn = existing.user_id ? 'user_id' : 'app_user_id'
  const supabase = createSupabaseClient(env)
  const knownPatch = pickKnownProfilePatch(existing, patch)

  if (Object.keys(knownPatch).length === 0) return existing

  const updated = await supabase.request<DeveloperProfileRow[]>(
    `/developer_profiles?${relationColumn}=eq.${encodeQuery(appUserId)}&select=${DEVELOPER_PROFILE_SELECT}`,
    {
      method: 'PATCH',
      prefer: 'return=representation',
      body: JSON.stringify(knownPatch),
    },
  )
  return updated[0] ?? existing
}

async function patchProfileSnapshot(
  env: PlatformEnv,
  existing: DeveloperProfileRow,
  appUserId: string,
  githubProfile?: unknown,
  developerProfile?: unknown,
  diagnostics?: OAuthPersistenceDiagnostics,
): Promise<DeveloperProfileRow> {
  const patch = pickKnownProfilePatch(existing, {
    github_profile: githubProfile,
    developer_profile: developerProfile,
    updated_at: new Date().toISOString(),
  })
  if (Object.keys(patch).length === 0) return existing

  try {
    return await (diagnostics?.measure ?? ((_, operation) => operation()))(
      'supabase.developer_profile.snapshot',
      () => patchDeveloperProfile(env, existing, appUserId, patch),
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (
      message.includes('Could not find') ||
      message.includes('column') ||
      message.includes('schema cache')
    ) {
      console.warn(
        '[supabase] developer profile snapshot columns unavailable, skipping optional profile persistence',
      )
      return existing
    }
    throw error
  }
}

export async function persistOAuthUser(
  env: PlatformEnv,
  identity: GitHubIdentity,
  githubProfile: unknown,
  developerProfile: unknown,
  diagnostics?: OAuthPersistenceDiagnostics,
): Promise<UserPersistenceResult> {
  const { appUser, isNew } = await upsertAppUser(env, identity, diagnostics)
  const existingProfile = await findDeveloperProfile(env, appUser.id, diagnostics)

  if (existingProfile) {
    const updated = await patchProfileSnapshot(
      env,
      existingProfile,
      appUser.id,
      githubProfile,
      developerProfile,
      diagnostics,
    )
    return { appUser, developerProfile: updated }
  }

  if (!isNew) {
    return {
      appUser,
      developerProfile: await insertDeveloperProfile(
        env,
        appUser.id,
        githubProfile,
        developerProfile,
        diagnostics,
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
      diagnostics,
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
  const cleanPatch = pickKnownProfilePatch(existing, {
    ...patch,
    updated_at: new Date().toISOString(),
  })
  const updated = await patchDeveloperProfile(
    env,
    existing,
    appUserId,
    cleanPatch,
  ).catch(async (error) => {
    const fallbackPatch = {
      profile_setup_status: patch.profile_setup_status,
      profile_confirmed: patch.profile_confirmed,
      updated_at: new Date().toISOString(),
    }
    return patchDeveloperProfile(
      env,
      existing,
      appUserId,
      Object.fromEntries(
        Object.entries(fallbackPatch).filter(([, value]) => value !== undefined),
      ),
    )
  })
  if (!updated) throw new ApiError('更新 Developer Profile 失败', 502)
  return updated
}
