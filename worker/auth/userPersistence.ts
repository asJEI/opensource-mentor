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

export type ProfileStatus = 'pending' | 'generating' | 'ready' | 'failed'

type StructuredDeveloperProfileSnapshot = {
  level?: string
  languages?: unknown[]
  frameworks?: string[]
  domains?: string[]
  open_source_experience?: string
  strengths?: string[]
  possible_weaknesses?: string[]
  evidence?: string[]
  github_summary?: string
}

const APP_USER_SELECT = '*'
const DEVELOPER_PROFILE_SELECT = '*'
const OPTIONAL_PROFILE_COLUMNS = [
  'github_profile',
  'developer_profile',
  'profile_status',
  'developer_level',
  'languages',
  'frameworks',
  'domains',
  'open_source_experience',
  'strengths',
  'possible_weaknesses',
  'evidence',
  'github_summary',
  'open_source_goal',
  'preferred_tech_stack',
  'contribution_time_budget',
  'guidance_preference',
] as const

function encodeQuery(value: string | number): string {
  return encodeURIComponent(String(value))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasColumn(row: DeveloperProfileRow, column: string): boolean {
  return Object.prototype.hasOwnProperty.call(row, column)
}

function compactPatch(patch: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  )
}

function pickKnownProfilePatch(
  row: DeveloperProfileRow,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  return compactPatch(
    Object.fromEntries(
      Object.entries(patch).filter(([key]) => {
        if (key === 'updated_at') return hasColumn(row, key)
        if ((OPTIONAL_PROFILE_COLUMNS as readonly string[]).includes(key)) {
          return hasColumn(row, key)
        }
        return true
      }),
    ),
  )
}

function isMissingColumnError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return (
    message.includes('Could not find') ||
    message.includes('schema cache') ||
    /column .* does not exist/i.test(message)
  )
}

function isConflictError(error: unknown): boolean {
  if (error instanceof ApiError && error.status === 409) return true
  const message = error instanceof Error ? error.message : String(error)
  return (
    message.includes('duplicate key') ||
    message.includes('already exists') ||
    /\b23505\b/.test(message)
  )
}

function firstRow<T>(value: T[] | T | null | undefined): T | undefined {
  if (Array.isArray(value)) return value[0]
  if (value && typeof value === 'object') return value
  return undefined
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
      supabase.request<AppUserRow[] | AppUserRow>(
        `/app_users?github_id=eq.${encodeQuery(githubId)}&select=${APP_USER_SELECT}&limit=1`,
      ),
  )
  return firstRow(users) ?? null
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
        supabase.request<AppUserRow[] | AppUserRow>(
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
    return { appUser: firstRow(updated) ?? existing, isNew: false }
  }

  try {
    const inserted = await (diagnostics?.measure ?? ((_, operation) => operation()))(
      'supabase.app_user.upsert',
      () =>
        supabase.request<AppUserRow[] | AppUserRow>(
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
    const appUser = firstRow(inserted)
    if (!appUser) {
      throw new ApiError('创建用户失败', 502)
    }
    return { appUser, isNew: true }
  } catch (error) {
    if (!isConflictError(error)) throw error
    const raced = await findAppUserByGitHubId(env, identity.id, diagnostics)
    if (raced) return { appUser: raced, isNew: false }
    throw error
  }
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
      supabase.request<DeveloperProfileRow[] | DeveloperProfileRow>(
        `/developer_profiles?user_id=eq.${encodeQuery(appUserId)}&select=${DEVELOPER_PROFILE_SELECT}&limit=1`,
      ).catch(async () =>
        supabase.request<DeveloperProfileRow[] | DeveloperProfileRow>(
          `/developer_profiles?app_user_id=eq.${encodeQuery(appUserId)}&select=${DEVELOPER_PROFILE_SELECT}&limit=1`,
        ),
      ),
  )
  return firstRow(byUserId) ?? null
}

async function postDeveloperProfile(
  env: PlatformEnv,
  body: Record<string, unknown>,
): Promise<DeveloperProfileRow> {
  const supabase = createSupabaseClient(env)
  const rows = await supabase.request<DeveloperProfileRow[] | DeveloperProfileRow>(
    `/developer_profiles?select=${DEVELOPER_PROFILE_SELECT}`,
    {
      method: 'POST',
      prefer: 'return=representation',
      body: JSON.stringify(body),
    },
  )
  const row = firstRow(rows)
  if (!row) {
    throw new ApiError('创建 Developer Profile 失败', 502)
  }
  return row
}

async function insertDeveloperProfile(
  env: PlatformEnv,
  appUserId: string,
  diagnostics?: OAuthPersistenceDiagnostics,
): Promise<DeveloperProfileRow> {
  const required = {
    profile_setup_status: 'not_started',
    profile_confirmed: false,
  }
  // Login must not depend on optional profile_status / flattened columns.
  // If those columns exist, the database default already sets pending.
  const attempts: Array<Record<string, unknown>> = [
    { user_id: appUserId, ...required },
    { app_user_id: appUserId, ...required },
  ]

  let lastError: unknown
  for (const body of attempts) {
    try {
      return await (diagnostics?.measure ?? ((_, operation) => operation()))(
        'supabase.developer_profile.create',
        () => postDeveloperProfile(env, body),
        { relation: 'user_id' in body ? 'user_id' : 'app_user_id' },
      )
    } catch (error) {
      lastError = error
      if (isConflictError(error)) {
        const existing = await findDeveloperProfile(env, appUserId, diagnostics)
        if (existing) return existing
      }
      if (!isMissingColumnError(error) && !isConflictError(error)) {
        throw error
      }
    }
  }

  const existing = await findDeveloperProfile(env, appUserId, diagnostics)
  if (existing) return existing
  throw lastError instanceof ApiError
    ? lastError
    : new ApiError('创建 Developer Profile 失败', 502)
}

function toStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  return value.filter((item): item is string => typeof item === 'string')
}

function unwrapStructuredDeveloperProfile(
  value: unknown,
): StructuredDeveloperProfileSnapshot | undefined {
  if (!isRecord(value)) return undefined

  const nested = value.developerProfile ?? value.developer_profile
  if (isRecord(nested)) {
    const nestedProfile = nested as StructuredDeveloperProfileSnapshot
    if (
      typeof nestedProfile.level === 'string' ||
      Array.isArray(nestedProfile.languages) ||
      Array.isArray(nestedProfile.frameworks)
    ) {
      return nestedProfile
    }
  }

  if (
    typeof value.level === 'string' ||
    Array.isArray(value.frameworks) ||
    Array.isArray(value.domains) ||
    typeof value.open_source_experience === 'string' ||
    typeof value.github_summary === 'string'
  ) {
    return value as StructuredDeveloperProfileSnapshot
  }

  return undefined
}

function flattenDeveloperProfile(
  developerProfile: unknown,
): Record<string, unknown> {
  const profile = unwrapStructuredDeveloperProfile(developerProfile)
  if (!profile) return {}

  return compactPatch({
    developer_level:
      typeof profile.level === 'string' ? profile.level : undefined,
    languages: Array.isArray(profile.languages) ? profile.languages : undefined,
    frameworks: toStringArray(profile.frameworks),
    domains: toStringArray(profile.domains),
    open_source_experience:
      typeof profile.open_source_experience === 'string'
        ? profile.open_source_experience
        : undefined,
    strengths: toStringArray(profile.strengths),
    possible_weaknesses: toStringArray(profile.possible_weaknesses),
    evidence: toStringArray(profile.evidence),
    github_summary:
      typeof profile.github_summary === 'string'
        ? profile.github_summary
        : undefined,
  })
}

function structuredFromRow(
  row: DeveloperProfileRow,
): StructuredDeveloperProfileSnapshot | undefined {
  const fromJson =
    unwrapStructuredDeveloperProfile(row.developer_profile) ??
    unwrapStructuredDeveloperProfile(row.github_profile)
  if (fromJson && typeof fromJson.level === 'string') return fromJson

  if (
    row.developer_level ||
    (Array.isArray(row.languages) && row.languages.length > 0) ||
    (Array.isArray(row.frameworks) && row.frameworks.length > 0)
  ) {
    return {
      level: typeof row.developer_level === 'string' ? row.developer_level : undefined,
      languages: Array.isArray(row.languages) ? row.languages : undefined,
      frameworks: toStringArray(row.frameworks),
      domains: toStringArray(row.domains),
      open_source_experience:
        typeof row.open_source_experience === 'string'
          ? row.open_source_experience
          : undefined,
      strengths: toStringArray(row.strengths),
      possible_weaknesses: toStringArray(row.possible_weaknesses),
      evidence: toStringArray(row.evidence),
      github_summary:
        typeof row.github_summary === 'string' ? row.github_summary : undefined,
    }
  }

  return fromJson
}

function hydrateDeveloperProfileRow(row: DeveloperProfileRow): DeveloperProfileRow {
  const structured = structuredFromRow(row)
  const githubProfile = isRecord(row.github_profile)
    ? {
        ...row.github_profile,
        developerProfile:
          structured ??
          unwrapStructuredDeveloperProfile(row.github_profile),
      }
    : row.github_profile

  return {
    ...row,
    profile_status:
      row.profile_status ?? (structured ? 'ready' : 'pending'),
    developer_profile: structured ?? row.developer_profile,
    github_profile: githubProfile,
    developer_level:
      row.developer_level ??
      (typeof structured?.level === 'string' ? structured.level : null),
    languages: row.languages ?? structured?.languages ?? row.languages,
    frameworks: row.frameworks ?? structured?.frameworks ?? row.frameworks,
    domains: row.domains ?? structured?.domains ?? row.domains,
    open_source_experience:
      row.open_source_experience ?? structured?.open_source_experience ?? null,
    strengths: row.strengths ?? structured?.strengths ?? row.strengths,
    possible_weaknesses:
      row.possible_weaknesses ??
      structured?.possible_weaknesses ??
      row.possible_weaknesses,
    evidence: row.evidence ?? structured?.evidence ?? row.evidence,
    github_summary: row.github_summary ?? structured?.github_summary ?? null,
  }
}

async function patchDeveloperProfile(
  env: PlatformEnv,
  existing: DeveloperProfileRow,
  appUserId: string,
  patch: Record<string, unknown>,
  options: { filterUnknown?: boolean } = {},
): Promise<DeveloperProfileRow> {
  const relationColumn = existing.user_id ? 'user_id' : 'app_user_id'
  const supabase = createSupabaseClient(env)
  const knownPatch =
    options.filterUnknown === false
      ? compactPatch(patch)
      : pickKnownProfilePatch(existing, patch)

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
  profileStatus: ProfileStatus = 'ready',
  diagnostics?: OAuthPersistenceDiagnostics,
): Promise<DeveloperProfileRow> {
  const structured =
    unwrapStructuredDeveloperProfile(developerProfile) ??
    unwrapStructuredDeveloperProfile(githubProfile)
  const flattened = flattenDeveloperProfile(structured ?? developerProfile)
  const corePatch = compactPatch({
    profile_status: profileStatus,
    github_profile: githubProfile,
    developer_profile: structured ?? developerProfile,
    updated_at: new Date().toISOString(),
  })
  const fullPatch = {
    ...corePatch,
    ...flattened,
  }

  const runPatch = (patch: Record<string, unknown>, filterUnknown: boolean) =>
    patchDeveloperProfile(env, existing, appUserId, patch, { filterUnknown })

  try {
    return await (diagnostics?.measure ?? ((_, operation) => operation()))(
      'supabase.developer_profile.snapshot',
      () => runPatch(fullPatch, false),
      {
        flattened_keys: Object.keys(flattened),
      },
    )
  } catch (error) {
    if (!isMissingColumnError(error)) throw error

    console.warn(
      '[supabase] developer profile snapshot includes unknown columns, retrying with compatible subset',
    )

    try {
      const compatible = await runPatch(fullPatch, true)
      const leftover = compactPatch(
        Object.fromEntries(
          Object.entries(flattened).filter(
            ([key]) => !hasColumn(compatible, key) && !hasColumn(existing, key),
          ),
        ),
      )
      if (Object.keys(leftover).length === 0) return compatible

      return await runPatch(
        {
          ...leftover,
          updated_at: new Date().toISOString(),
        },
        false,
      ).catch(() => compatible)
    } catch (fallbackError) {
      if (!isMissingColumnError(fallbackError)) throw fallbackError
      console.warn(
        '[supabase] flattened developer profile columns unavailable, persisting github/developer JSON only',
      )
      return runPatch(corePatch, true)
    }
  }
}

export async function persistOAuthUser(
  env: PlatformEnv,
  identity: GitHubIdentity,
  githubProfile: unknown,
  developerProfile: unknown,
  diagnostics?: OAuthPersistenceDiagnostics,
): Promise<UserPersistenceResult> {
  const persisted = await persistOAuthLogin(env, identity, diagnostics)
  const updated = await updateOAuthDeveloperProfileSnapshot(
    env,
    persisted.appUser.id,
    githubProfile,
    developerProfile,
    'ready',
    diagnostics,
  )
  return {
    appUser: persisted.appUser,
    developerProfile: updated ?? persisted.developerProfile,
  }
}

export async function persistOAuthLogin(
  env: PlatformEnv,
  identity: GitHubIdentity,
  diagnostics?: OAuthPersistenceDiagnostics,
): Promise<UserPersistenceResult> {
  const { appUser } = await upsertAppUser(env, identity, diagnostics)
  const existingProfile = await findDeveloperProfile(env, appUser.id, diagnostics)
  if (existingProfile) {
    return {
      appUser,
      developerProfile: hydrateDeveloperProfileRow(existingProfile),
    }
  }

  try {
    return {
      appUser,
      developerProfile: hydrateDeveloperProfileRow(
        await insertDeveloperProfile(env, appUser.id, diagnostics),
      ),
    }
  } catch (error) {
    const raced = await findDeveloperProfile(env, appUser.id, diagnostics)
    if (raced) {
      return {
        appUser,
        developerProfile: hydrateDeveloperProfileRow(raced),
      }
    }
    throw error
  }
}

export async function setDeveloperProfileStatus(
  env: PlatformEnv,
  appUserId: string,
  profileStatus: ProfileStatus,
): Promise<DeveloperProfileRow | null> {
  const existing = await findDeveloperProfile(env, appUserId)
  if (!existing) return null
  try {
    return hydrateDeveloperProfileRow(
      await patchDeveloperProfile(
        env,
        existing,
        appUserId,
        {
          profile_status: profileStatus,
          updated_at: new Date().toISOString(),
        },
        { filterUnknown: false },
      ),
    )
  } catch (error) {
    if (!isMissingColumnError(error)) throw error
    return hydrateDeveloperProfileRow(
      await patchDeveloperProfile(env, existing, appUserId, {
        profile_status: profileStatus,
        updated_at: new Date().toISOString(),
      }),
    )
  }
}

export async function updateOAuthDeveloperProfileSnapshot(
  env: PlatformEnv,
  appUserId: string,
  githubProfile: unknown,
  developerProfile: unknown,
  profileStatus: ProfileStatus,
  diagnostics?: OAuthPersistenceDiagnostics,
): Promise<DeveloperProfileRow | null> {
  const existing =
    (await findDeveloperProfile(env, appUserId, diagnostics)) ??
    (await insertDeveloperProfile(env, appUserId, diagnostics).catch(() => null))
  if (!existing) return null
  if (githubProfile === undefined && developerProfile === undefined) {
    return setDeveloperProfileStatus(env, appUserId, profileStatus)
  }
  return hydrateDeveloperProfileRow(
    await patchProfileSnapshot(
      env,
      existing,
      appUserId,
      githubProfile,
      developerProfile,
      profileStatus,
      diagnostics,
    ),
  )
}

export async function readCurrentUser(
  env: PlatformEnv,
  githubId: number,
): Promise<UserPersistenceResult | null> {
  const appUser = await findAppUserByGitHubId(env, githubId)
  if (!appUser) return null
  const developerProfile = await findDeveloperProfile(env, appUser.id)
  if (!developerProfile) return null
  return {
    appUser,
    developerProfile: hydrateDeveloperProfileRow(developerProfile),
  }
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
  return hydrateDeveloperProfileRow(updated)
}
