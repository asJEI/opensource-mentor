import { readSession } from '../auth/session'
import { readCurrentUser } from '../auth/userPersistence'
import type { PlatformEnv } from '../config'
import type { ReviewJobRecord } from '../code-review/store'
import { loadReviewRecord, storeReviewRecord } from '../code-review/store'
import { createSupabaseClient } from '../supabase/client'
import { ApiError } from '../http'

async function owner(request: Request, env: PlatformEnv) {
  const session = await readSession(request, env)
  if (!session) return null
  const current = await readCurrentUser(env, session.githubId)
  if (!current || current.appUser.id !== session.userId) throw new ApiError('登录状态已失效', 401)
  return session.userId
}
/** Logged-in results are saved BEFORE returning the generated review to the browser. */
export async function persistReview(request: Request, env: PlatformEnv, record: ReviewJobRecord) {
  const userId = await owner(request, env)
  if (!userId) {
    await storeReviewRecord(record)
    return
  }
  await createSupabaseClient(env).request('/workspace_review_runs', {
    method: 'POST',
    body: JSON.stringify({ id: record.reviewId, user_id: userId, record }),
  })
}
export async function readPersistedReview(
  request: Request,
  env: PlatformEnv,
  reviewId: string,
): Promise<ReviewJobRecord | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(reviewId))
    return null
  const userId = await owner(request, env)
  if (!userId) return loadReviewRecord(reviewId)
  const rows = await createSupabaseClient(env).request<Array<{ record: ReviewJobRecord }>>(
    `/workspace_review_runs?id=eq.${reviewId}&user_id=eq.${userId}&select=record&limit=1`,
  )
  // Never fall back to a shared cache for authenticated private results.
  return rows[0]?.record || null
}
