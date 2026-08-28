import type { PlatformEnv } from '../config'
import { ApiError, success } from '../http'
import { clearSessionCookie, readSession } from './session'
import {
  readCurrentUser,
  updateDeveloperProfile,
  type DeveloperProfilePatch,
} from './userPersistence'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function mapMePayload(
  result: NonNullable<Awaited<ReturnType<typeof readCurrentUser>>>,
) {
  return {
    user: {
      id: result.appUser.id,
      githubId: result.appUser.github_id,
      githubUsername: result.appUser.github_username,
      githubAvatar: result.appUser.github_avatar,
      createdAt: result.appUser.created_at,
      updatedAt: result.appUser.updated_at,
    },
    developerProfile: result.developerProfile,
  }
}

export async function handleGetMe(
  request: Request,
  env: PlatformEnv,
): Promise<Response> {
  const session = await readSession(request, env)
  if (!session) throw new ApiError('未登录', 401)

  const result = await readCurrentUser(env, session.githubId)
  if (!result || result.appUser.id !== session.userId) {
    throw new ApiError('登录状态已失效', 401)
  }

  return success(mapMePayload(result))
}

export async function handleLogout(request: Request): Promise<Response> {
  const response = success({ ok: true })
  response.headers.append('Set-Cookie', clearSessionCookie(request))
  return response
}

async function parseJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    throw new ApiError('请求体必须是合法 JSON', 400)
  }
}

function parseDeveloperProfilePatch(body: unknown): DeveloperProfilePatch {
  if (!isRecord(body)) throw new ApiError('请求体必须是 JSON 对象', 400)
  const patch: DeveloperProfilePatch = {}

  if (
    body.profileSetupStatus === 'not_started' ||
    body.profileSetupStatus === 'completed' ||
    body.profileSetupStatus === 'skipped'
  ) {
    patch.profile_setup_status = body.profileSetupStatus
  }
  if (typeof body.profileConfirmed === 'boolean') {
    patch.profile_confirmed = body.profileConfirmed
  }
  if (typeof body.openSourceGoal === 'string') {
    patch.open_source_goal = body.openSourceGoal
  }
  if (Array.isArray(body.preferredTechStack)) {
    patch.preferred_tech_stack = body.preferredTechStack
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 16)
  }
  if (typeof body.contributionTimeBudget === 'string') {
    patch.contribution_time_budget = body.contributionTimeBudget
  }
  if (typeof body.guidancePreference === 'string') {
    patch.guidance_preference = body.guidancePreference
  }

  return patch
}

export async function handleUpdateDeveloperProfile(
  request: Request,
  env: PlatformEnv,
): Promise<Response> {
  const session = await readSession(request, env)
  if (!session) throw new ApiError('未登录', 401)

  const updated = await updateDeveloperProfile(
    env,
    session.userId,
    parseDeveloperProfilePatch(await parseJsonBody(request)),
  )
  const result = await readCurrentUser(env, session.githubId)
  if (!result) throw new ApiError('登录状态已失效', 401)

  return success(
    mapMePayload({
      appUser: result.appUser,
      developerProfile: updated,
    }),
  )
}
