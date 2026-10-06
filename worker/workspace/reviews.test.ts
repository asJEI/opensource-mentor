import { beforeEach, describe, expect, it, vi } from 'vitest'
import { persistReview, readPersistedReview } from './reviews'
import { readSession } from '../auth/session'
import { readCurrentUser } from '../auth/userPersistence'
import { createSupabaseClient } from '../supabase/client'
import { loadReviewRecord, storeReviewRecord, type ReviewJobRecord } from '../code-review/store'
import type { PlatformEnv } from '../config'
vi.mock('../auth/session', () => ({ readSession: vi.fn() }))
vi.mock('../auth/userPersistence', () => ({ readCurrentUser: vi.fn() }))
vi.mock('../supabase/client', () => ({ createSupabaseClient: vi.fn() }))
vi.mock('../code-review/store', () => ({ loadReviewRecord: vi.fn(), storeReviewRecord: vi.fn() }))
const id = '00000000-0000-4000-8000-000000000001'
const reviewId = '10000000-0000-4000-8000-000000000001'
const env = {} as PlatformEnv
const query = vi.fn()
const record: ReviewJobRecord = {
  reviewId,
  status: 'completed',
  progress: {
    percent: 100,
    phases: { summary: 'completed', risk: 'completed', comments: 'completed' },
    lastEventAt: null,
  },
  result: { summary: 'saved' },
  error: null,
  prUrl: 'https://github.com/owner/repo/pull/1',
  createdAt: 'now',
  completedAt: 'now',
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(readSession).mockResolvedValue({ userId: id, githubId: 1, exp: 9999999999 })
  vi.mocked(readCurrentUser).mockResolvedValue({
    appUser: { id, github_id: 1, github_username: 'test', github_avatar: '' },
    developerProfile: { id: 'profile', profile_setup_status: 'completed', profile_confirmed: true },
  })
  vi.mocked(createSupabaseClient).mockReturnValue({ request: query } as unknown as ReturnType<
    typeof createSupabaseClient
  >)
})
describe('durable owned review results', () => {
  it('persists an authenticated review without putting it in the shared cache', async () => {
    query.mockResolvedValue(undefined)
    await persistReview(new Request('https://mentor.test/api/code-review/reviews'), env, record)
    expect(query.mock.calls[0][0]).toBe('/workspace_review_runs')
    expect(JSON.parse(query.mock.calls[0][1].body)).toMatchObject({
      id: reviewId,
      user_id: id,
      record,
    })
    expect(storeReviewRecord).not.toHaveBeenCalled()
  })
  it('reads durable results through an ownership filter, never a private cache fallback', async () => {
    query.mockResolvedValue([{ record }])
    expect(await readPersistedReview(new Request('https://mentor.test'), env, reviewId)).toEqual(
      record,
    )
    expect(query.mock.calls[0][0]).toContain(`user_id=eq.${id}`)
    query.mockResolvedValue([])
    expect(await readPersistedReview(new Request('https://mentor.test'), env, reviewId)).toBe(null)
    expect(loadReviewRecord).not.toHaveBeenCalled()
  })
  it('retains existing temporary guest reviews without making private results public', async () => {
    vi.mocked(readSession).mockResolvedValue(null)
    await persistReview(new Request('https://mentor.test'), env, record)
    expect(storeReviewRecord).toHaveBeenCalledWith(record)
    expect(query).not.toHaveBeenCalled()
  })
  it('fails creation when the database cannot commit, instead of claiming the result is durable', async () => {
    query.mockRejectedValue(new Error('database unavailable'))
    await expect(persistReview(new Request('https://mentor.test'), env, record)).rejects.toThrow(
      'database unavailable',
    )
    expect(storeReviewRecord).not.toHaveBeenCalled()
  })
})
