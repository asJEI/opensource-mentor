import type { PlatformEnv } from '../config'
import { ApiError, success } from '../http'
import { createGitHubService } from './factory'

function requireQuery(params: URLSearchParams, key: string): string {
  const value = params.get(key)?.trim()
  if (!value) {
    throw new ApiError(`${key} 不能为空`, 400, {
      errorCode: 'VALIDATION_ERROR',
    })
  }
  return value
}

function optionalEnum<T extends string>(
  value: string | null,
  allowed: readonly T[],
  fallback: T,
): T {
  if (!value) return fallback
  if ((allowed as readonly string[]).includes(value)) return value as T
  throw new ApiError(`无效参数: ${value}`, 400, {
    errorCode: 'VALIDATION_ERROR',
  })
}

/** GET /api/repository?owner=&repo= */
export async function handleGetRepository(
  request: Request,
  env: PlatformEnv,
): Promise<Response> {
  const url = new URL(request.url)
  const owner = requireQuery(url.searchParams, 'owner')
  const repo = requireQuery(url.searchParams, 'repo')
  const service = createGitHubService(request, env)
  const repository = await service.getRepository(owner, repo)
  return success(repository)
}

/** GET /api/issues?owner=&repo=&... */
export async function handleGetIssues(
  request: Request,
  env: PlatformEnv,
): Promise<Response> {
  const url = new URL(request.url)
  const owner = requireQuery(url.searchParams, 'owner')
  const repo = requireQuery(url.searchParams, 'repo')
  const page = Number(url.searchParams.get('page') || '1')
  const perPage = Number(url.searchParams.get('perPage') || '20')

  if (!Number.isInteger(page) || page < 1) {
    throw new ApiError('page 必须是 >= 1 的整数', 400)
  }
  if (!Number.isInteger(perPage) || perPage < 1 || perPage > 100) {
    throw new ApiError('perPage 必须是 1-100 的整数', 400)
  }

  const service = createGitHubService(request, env)
  const result = await service.getIssues(owner, repo, {
    state: optionalEnum(
      url.searchParams.get('state'),
      ['open', 'closed', 'all'] as const,
      'open',
    ),
    labels: url.searchParams.get('labels') || undefined,
    sort: optionalEnum(
      url.searchParams.get('sort'),
      ['created', 'updated', 'comments'] as const,
      'created',
    ),
    direction: optionalEnum(
      url.searchParams.get('direction'),
      ['asc', 'desc'] as const,
      'desc',
    ),
    page,
    perPage,
  })

  return success({
    items: result.items,
    total: result.total,
    page,
    perPage,
  })
}

/** POST /api/github/test-connection */
export async function handleTestGitHubConnection(
  request: Request,
  env: PlatformEnv,
): Promise<Response> {
  const service = createGitHubService(request, env)
  const account = await service.testConnection()
  return success({
    success: true,
    message: `已连接 GitHub 账号 ${account.login}`,
    account: account.login,
  })
}
