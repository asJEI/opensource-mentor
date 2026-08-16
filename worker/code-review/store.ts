/** Persist completed review jobs in Cloudflare Cache API (~1h TTL). */

export type ReviewPhaseStatus = 'pending' | 'running' | 'completed' | 'failed'
export type ReviewStatus =
  | 'idle'
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'

export interface ReviewProgress {
  percent: number
  phases: {
    summary: ReviewPhaseStatus
    risk: ReviewPhaseStatus
    comments: ReviewPhaseStatus
  }
  lastEventAt: string | null
}

export interface ReviewJobRecord {
  reviewId: string
  status: ReviewStatus
  progress: ReviewProgress
  result: unknown
  error: string | null
  prUrl: string
  createdAt: string
  completedAt: string | null
}

const TTL_SECONDS = 3600

function cacheKeyFor(reviewId: string): Request {
  return new Request(`https://code-review.internal/reviews/${reviewId}`, {
    method: 'GET',
  })
}

export async function storeReviewRecord(
  record: ReviewJobRecord,
): Promise<void> {
  const response = new Response(JSON.stringify(record), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${TTL_SECONDS}`,
    },
  })
  await caches.default.put(cacheKeyFor(record.reviewId), response)
}

export async function loadReviewRecord(
  reviewId: string,
): Promise<ReviewJobRecord | null> {
  const cached = await caches.default.match(cacheKeyFor(reviewId))
  if (!cached) return null
  try {
    return (await cached.json()) as ReviewJobRecord
  } catch {
    return null
  }
}

export function generateReviewId(): string {
  return crypto.randomUUID()
}
