import type { PlatformEnv } from '../config'
import { createGitHubService } from '../github/factory'
import type { PullRequestFile } from '../github/service'
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

function mapArtifacts(files: PullRequestFile[]) {
  return {
    changedFiles: files.map((file) => ({
      filename: file.filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      changes: file.changes,
      patch: file.patch || null,
    })),
  }
}

function readTrimmed(body: Record<string, unknown>, key: string): string {
  const value = body[key]
  return typeof value === 'string' ? value.trim() : ''
}

function buildCompareCreatePrUrl(params: {
  baseOwner: string
  baseRepo: string
  baseRef: string
  headOwner: string
  headRef: string
}): string {
  const head = `${params.headOwner}:${params.headRef}`
  return `https://github.com/${params.baseOwner}/${params.baseRepo}/compare/${encodeURIComponent(params.baseRef)}...${encodeURIComponent(head)}?expand=1`
}

type ReviewSource =
  | {
      mode: 'pr'
      sourceLabel: string
      prUrl: string
      prTitle: string
      prBody: string
      files: PullRequestFile[]
      diff: string
      repoFullName: string
      createPrUrl: string | null
    }
  | {
      mode: 'compare'
      sourceLabel: string
      prUrl: string
      prTitle: string
      prBody: string
      files: PullRequestFile[]
      diff: string
      repoFullName: string
      createPrUrl: string
    }

async function resolveReviewSource(
  request: Request,
  env: PlatformEnv,
  body: Record<string, unknown>,
): Promise<ReviewSource> {
  const github = createGitHubService(request, env)
  const mode =
    readTrimmed(body, 'mode') === 'compare' ||
    Boolean(readTrimmed(body, 'headOwner') || readTrimmed(body, 'headRef'))
      ? 'compare'
      : 'pr'

  if (mode === 'compare') {
    const baseOwner = readTrimmed(body, 'baseOwner')
    const baseRepo = readTrimmed(body, 'baseRepo')
    const baseRef = readTrimmed(body, 'baseRef') || 'main'
    const headOwner = readTrimmed(body, 'headOwner')
    const headRepo = readTrimmed(body, 'headRepo') || baseRepo
    const headRef = readTrimmed(body, 'headRef')

    if (!baseOwner || !baseRepo || !headOwner || !headRef) {
      throw new ApiError(
        'Fork 审查需要 baseOwner、baseRepo、headOwner、headRef',
        400,
        { errorCode: 'VALIDATION_ERROR' },
      )
    }

    const headSpec =
      headOwner === baseOwner && headRepo === baseRepo
        ? headRef
        : `${headOwner}:${headRef}`

    const comparison = await github.compareCommits(
      baseOwner,
      baseRepo,
      baseRef,
      headSpec,
    )
    if (!comparison.files.length) {
      throw new ApiError(
        '未检测到相对上游的代码变更，请确认分支已 push 且相对 base 有提交',
        400,
        { errorCode: 'VALIDATION_ERROR' },
      )
    }

    let diff = ''
    try {
      diff = await github.compareCommitsDiff(
        baseOwner,
        baseRepo,
        baseRef,
        headSpec,
      )
    } catch {
      diff = comparison.files
        .map((file) => file.patch)
        .filter(Boolean)
        .join('\n\n')
    }

    const latestMessage =
      comparison.commits[comparison.commits.length - 1]?.message ||
      `Compare ${baseRef}...${headSpec}`
    const createPrUrl = buildCompareCreatePrUrl({
      baseOwner,
      baseRepo,
      baseRef,
      headOwner,
      headRef,
    })

    return {
      mode: 'compare',
      sourceLabel: `${baseOwner}/${baseRepo} ${baseRef}...${headSpec}`,
      prUrl: comparison.htmlUrl || createPrUrl,
      prTitle: latestMessage,
      prBody: [
        `审查来源：用户 Fork 分支相对上游的 Compare`,
        `Base: ${baseOwner}/${baseRepo}@${baseRef}`,
        `Head: ${headOwner}/${headRepo}@${headRef}`,
        `Commits ahead: ${comparison.aheadBy}`,
        `Files changed: ${comparison.files.length}`,
      ].join('\n'),
      files: comparison.files,
      diff,
      repoFullName: `${baseOwner}/${baseRepo}`,
      createPrUrl,
    }
  }

  const prUrl = readTrimmed(body, 'prUrl')
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

  const parsed = github.parsePrUrl(prUrl)
  if (!parsed) {
    throw new ApiError('PR URL 格式不正确，请输入正确的 GitHub PR 链接', 400, {
      errorCode: 'VALIDATION_ERROR',
    })
  }

  const { owner, repo, pullNumber } = parsed
  const prInfo = await github.getPullRequest(owner, repo, pullNumber)
  const { files } = await github.getPullRequestFiles(owner, repo, pullNumber)
  const diff = await github.getPullRequestDiff(owner, repo, pullNumber)

  return {
    mode: 'pr',
    sourceLabel: `${owner}/${repo}#${pullNumber}`,
    prUrl,
    prTitle: String(prInfo.title || ''),
    prBody: String(prInfo.body || ''),
    files,
    diff,
    repoFullName: `${owner}/${repo}`,
    createPrUrl: null,
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

  const source = await resolveReviewSource(request, env, body)
  const github = createGitHubService(request, env)
  const reviewId = generateReviewId()
  const now = new Date().toISOString()

  let repoLanguage = 'TypeScript'
  try {
    const [owner, repo] = source.repoFullName.split('/')
    if (owner && repo) {
      const repoInfo = await github.getRepository(owner, repo)
      repoLanguage = repoInfo.language || 'TypeScript'
    }
  } catch {
    // Repository language is optional review context.
  }

  const reviewInput = {
    prUrl: source.prUrl,
    prTitle: source.prTitle,
    prBody: source.prBody,
    files: source.files,
    diff: source.diff,
    repoLanguage,
    repoFullName: source.repoFullName,
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
    prUrl: source.prUrl,
    mode: source.mode,
    sourceLabel: source.sourceLabel,
    createPrUrl: source.createPrUrl,
    artifacts: mapArtifacts(source.files),
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
    throw new ApiError('reviewId 不能为空', 400, {
      errorCode: 'VALIDATION_ERROR',
    })
  }

  const record = await loadReviewRecord(reviewId.trim())
  if (!record) {
    throw new ApiError('审查任务不存在或已过期', 404, {
      errorCode: 'NOT_FOUND',
    })
  }
  return success(record, 'ok')
}

/** GET /api/code-review/health */
export async function handleCodeReviewHealth(
  request: Request,
  env: PlatformEnv,
): Promise<Response> {
  const github = createGitHubService(request, env)
  try {
    await github.getRepository('microsoft', 'vscode')
    return success({ ok: true }, 'ok')
  } catch (error) {
    return success(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'unknown',
      },
      'degraded',
    )
  }
}
