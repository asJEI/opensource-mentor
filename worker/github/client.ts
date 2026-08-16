import { ApiError } from '../http'

const DEFAULT_TIMEOUT_MS = 15_000
const USER_AGENT = 'OpenSource-Mentor-Worker'

export interface GitHubClientOptions {
  baseUrl: string
  /** Request-scoped user token, then platform token, else anonymous. */
  token?: string
  timeoutMs?: number
}

/**
 * Resolve GitHub auth for one request.
 * Never log or return the token value.
 */
export function resolveGitHubToken(
  request: Request,
  platformToken: string,
): string | undefined {
  const header = request.headers.get('X-User-GitHub-Token')
  if (header !== null) {
    const trimmed = header.trim()
    if (trimmed.length < 8 || trimmed.length > 500) {
      throw new ApiError('GitHub Token 格式无效', 400, {
        errorCode: 'VALIDATION_ERROR',
      })
    }
    return trimmed
  }
  return platformToken || undefined
}

export class GitHubClient {
  private readonly baseUrl: string
  private readonly token?: string
  private readonly timeoutMs: number

  constructor(options: GitHubClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '')
    this.token = options.token
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  }

  async getJson<T = unknown>(
    path: string,
    init?: {
      query?: Record<string, string | number | undefined>
      accept?: string
    },
  ): Promise<{ data: T; headers: Headers }> {
    const url = new URL(
      path.startsWith('http') ? path : `${this.baseUrl}${path}`,
    )
    if (init?.query) {
      for (const [key, value] of Object.entries(init.query)) {
        if (value !== undefined && value !== '') {
          url.searchParams.set(key, String(value))
        }
      }
    }

    const headers: Record<string, string> = {
      Accept: init?.accept ?? 'application/vnd.github.v3+json',
      'User-Agent': USER_AGENT,
    }
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`
    }

    let response: Response
    try {
      response = await fetch(url.toString(), {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(this.timeoutMs),
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'TimeoutError') {
        throw new ApiError('GitHub API 请求超时，请稍后重试', 504, {
          errorCode: 'GITHUB_NETWORK_ERROR',
        })
      }
      throw new ApiError('无法连接 GitHub API，请稍后重试', 502, {
        errorCode: 'GITHUB_NETWORK_ERROR',
      })
    }

    if (!response.ok) {
      throw await this.toApiError(response, path)
    }

    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      return { data: (await response.json()) as T, headers: response.headers }
    }

    const text = await response.text()
    return { data: text as T, headers: response.headers }
  }

  private async toApiError(response: Response, path: string): Promise<ApiError> {
    let message = `GitHub API 请求失败 (${response.status})`
    let body: { message?: string } | null = null
    try {
      body = (await response.json()) as { message?: string }
      if (body?.message) {
        // Strip any accidental credential-looking content from upstream message.
        message = body.message.replace(/gh[pousr]_[A-Za-z0-9_]{10,}/g, '[redacted]')
      }
    } catch {
      // ignore non-JSON error bodies
    }

    if (response.status === 404) {
      const match = path.match(/\/repos\/([^/]+)\/([^/?]+)/)
      if (match) {
        return new ApiError(`仓库 ${match[1]}/${match[2]} 不存在`, 404, {
          errorCode: 'REPOSITORY_NOT_FOUND',
        })
      }
      return new ApiError('资源不存在', 404, { errorCode: 'NOT_FOUND' })
    }

    if (response.status === 401) {
      return new ApiError('GitHub Token 无效或已过期', 401, {
        errorCode: 'GITHUB_AUTH_ERROR',
      })
    }

    if (response.status === 403) {
      const remaining = response.headers.get('x-ratelimit-remaining')
      const reset = response.headers.get('x-ratelimit-reset')
      const lower = (body?.message || '').toLowerCase()
      const isRateLimit =
        remaining === '0' ||
        lower.includes('rate limit') ||
        lower.includes('abuse rate')

      if (isRateLimit) {
        const resetNum = reset ? Number(reset) : undefined
        const resetHint =
          resetNum && Number.isFinite(resetNum)
            ? `将于 ${new Date(resetNum * 1000).toISOString()} 重置`
            : '请稍后重试或配置 GitHub Token'
        return new ApiError(`GitHub API 调用频率超限，${resetHint}`, 429, {
          errorCode: 'GITHUB_RATE_LIMIT',
          rateLimitReset: resetNum,
        })
      }

      return new ApiError(message || 'GitHub API 访问被拒绝', 403, {
        errorCode: 'GITHUB_FORBIDDEN',
      })
    }

    return new ApiError(message, response.status, {
      errorCode: 'INTERNAL_ERROR',
    })
  }
}
