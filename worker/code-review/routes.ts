import type { PlatformEnv } from '../config'
import { createGitHubService } from '../github/factory'
import { ApiError, success } from '../http'
import { isRecord } from '../ai/json'
import { resolveAIClient } from '../ai/resolveConfig'
import { createLLMReview, createRuleReview } from './review'
import {
  generateReviewId,
  loadReviewRecord,
  storeReviewRecord,
  type ReviewJobRecord,
  type ReviewProgress,
} from './store'

async function parseJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    throw new ApiError('请求体必须是合法 JSON', 400, {
      errorCode: 'VALIDATION_ERROR',
    })
  }
}

function completedProgress(now: string): ReviewProgress {
  return {
    percent: 100,
    phases: {
      summary: 'completed',
      risk: 'completed',
      comments: 'completed',
    },
    lastEventAt: now,
  }
}

/** POST /api/code-review/reviews - execute a real grounded LLM review. */
export async function handleCreateReview(
  request: Request,
  env: PlatformEnv,
): Promise<Response> {
  const body = await parseJsonBody(request)
  if (!isRecord(body)) {
    throw new ApiError('请求体必须是 JSON 对象', 400, {
      errorCode: 'VALIDATION_ERROR',
    })
  }

  const prUrl = typeof body.prUrl === 'string' ? body.prUrl.trim() : ''
  if (!prUrl) {
    throw new ApiError('prUrl 不能为空', 400, {
      errorCode: 'VALIDATION_ERROR',
    })
  }
  try {
    new URL(prUrl)
  } catch {
    throw new ApiError('prUrl 必须是有效的 URL', 400, {
      errorCode: 'VALIDATION_ERROR',
    })
  }

  const github = createGitHubService(request, env)
  const parsed = github.parsePrUrl(prUrl)
  if (!parsed) {
    throw new ApiError('PR URL 格式不正确，请输入正确的 GitHub PR 链接', 400, {
      errorCode: 'VALIDATION_ERROR',
    })
  }

  const { owner, repo, pullNumber } = parsed
  const reviewId = generateReviewId()
  const now = new Date().toISOString()
  const prInfo = await github.getPullRequest(owner, repo, pullNumber)
  const { files } = await github.getPullRequestFiles(owner, repo, pullNumber)
  const diff = await github.getPullRequestDiff(owner, repo, pullNumber)
  let repoLanguage = 'TypeScript'
  try {
    const repoInfo = await github.getRepository(owner, repo)
    repoLanguage = repoInfo.language || 'TypeScript'
  } catch {
    // Repository language is optional review context.
  }
  const reviewInput = {
    prUrl,
    prTitle: String(prInfo.title || ''),
    prBody: String(prInfo.body || ''),
    files,
    diff,
    repoLanguage,
    repoFullName: `${owner}/${repo}`,
  }
  let result
  try {
    const { client } = await resolveAIClient(env, request, body)
    result = await createLLMReview(reviewInput, {
      complete: ({ system, user, temperature }) =>
        client.chatCompletions({
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          temperature,
          timeoutMs: 120_000,
          responseFormat: { type: 'json_object' },
        }),
    })
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.status === 400 ||
        error.status === 401 ||
        error.status === 403 ||
        error.status === 429)
    ) {
      throw error
    }
    console.error(
      JSON.stringify({
        message: 'LLM review unavailable, using deterministic rules',
        error: error instanceof Error ? error.message : 'unknown error',
      }),
    )
    result = createRuleReview(reviewInput)
  }
  const record: ReviewJobRecord = {
    reviewId,
    status: 'completed',
    progress: completedProgress(now),
    result,
    error: null,
    prUrl,
    createdAt: now,
    completedAt: new Date().toISOString(),
  }
  await storeReviewRecord(record)
  return success(record, '审查已完成')
}

/** GET /api/code-review/reviews/:id */
export async function handleGetReview(
  _request: Request,
  _env: PlatformEnv,
  reviewId: string,
): Promise<Response> {
  if (!reviewId.trim()) {
    throw new ApiError('审查任务 ID 不能为空', 400, {
      errorCode: 'VALIDATION_ERROR',
    })
  }

  const record = await loadReviewRecord(reviewId.trim())
  if (!record) {
    throw new ApiError('审查任务不存在', 404, {
      errorCode: 'NOT_FOUND',
    })
  }

  return success(record)
}

/** GET /api/code-review/health */
export async function handleCodeReviewHealth(
  request: Request,
  env: PlatformEnv,
): Promise<Response> {
  try {
    const github = createGitHubService(request, env)
    await github.getRepository('microsoft', 'vscode')
    return success({ ok: true })
  } catch {
    return success({ ok: false })
  }
}
