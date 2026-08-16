import type { NextFunction, Request, Response } from 'express'
import { error } from '../utils/response'

interface RateLimitBucket {
  count: number
  resetAt: number
}

const WINDOW_MS = 60_000
const MAX_PLATFORM_AI_REQUESTS = 10
const buckets = new Map<string, RateLimitBucket>()
let lastCleanupAt = 0

function usesCustomAI(req: Request): boolean {
  if (req.header('X-AI-Mode') === 'custom') return true
  const config = req.body?.aiProviderConfig
  return Boolean(
    config && typeof config === 'object' && config.mode === 'custom',
  )
}

function cleanupExpiredBuckets(now: number): void {
  if (now - lastCleanupAt < WINDOW_MS) return
  lastCleanupAt = now
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

/** Protect the shared platform LLM quota; BYOK requests use the user's quota. */
export function platformAIRateLimit(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (usesCustomAI(req)) {
    next()
    return
  }

  const now = Date.now()
  cleanupExpiredBuckets(now)
  const key = req.ip || 'unknown'
  const current = buckets.get(key)
  const bucket =
    current && current.resetAt > now
      ? current
      : { count: 0, resetAt: now + WINDOW_MS }

  bucket.count += 1
  buckets.set(key, bucket)

  if (bucket.count > MAX_PLATFORM_AI_REQUESTS) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((bucket.resetAt - now) / 1000),
    )
    res.setHeader('Retry-After', String(retryAfterSeconds))
    res
      .status(429)
      .json(error('平台 AI 请求过于频繁，请稍后重试或使用自己的 API Key', 429))
    return
  }

  next()
}
