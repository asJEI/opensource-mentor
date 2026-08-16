/**
 * Express AppError / GitHub errors.
 * Error code strings align with shared/errors.ts (duplicated to keep server rootDir self-contained).
 */

const ErrorCode = {
  REPOSITORY_NOT_FOUND: 'REPOSITORY_NOT_FOUND',
  GITHUB_RATE_LIMIT: 'GITHUB_RATE_LIMIT',
  GITHUB_AUTH_ERROR: 'GITHUB_AUTH_ERROR',
  GITHUB_FORBIDDEN: 'GITHUB_FORBIDDEN',
  GITHUB_NETWORK_ERROR: 'GITHUB_NETWORK_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const

function normalizeErrorCode(raw: string | undefined | null): string {
  if (!raw) return ErrorCode.INTERNAL_ERROR
  switch (raw) {
    case 'REPO_NOT_FOUND':
    case ErrorCode.REPOSITORY_NOT_FOUND:
      return ErrorCode.REPOSITORY_NOT_FOUND
    case 'RATE_LIMITED':
    case ErrorCode.GITHUB_RATE_LIMIT:
      return ErrorCode.GITHUB_RATE_LIMIT
    case 'BAD_CREDENTIALS':
    case ErrorCode.GITHUB_AUTH_ERROR:
      return ErrorCode.GITHUB_AUTH_ERROR
    case 'FORBIDDEN':
    case ErrorCode.GITHUB_FORBIDDEN:
      return ErrorCode.GITHUB_FORBIDDEN
    case 'NETWORK_ERROR':
    case ErrorCode.GITHUB_NETWORK_ERROR:
      return ErrorCode.GITHUB_NETWORK_ERROR
    case 'NOT_FOUND':
      return ErrorCode.NOT_FOUND
    default:
      return raw
  }
}

/**
 * 业务错误基类
 * 支持自定义错误码，方便全局错误中间件识别
 */
export class AppError extends Error {
  public code: number
  public errorCode?: string
  public details?: unknown

  constructor(
    message: string,
    code = 500,
    details?: unknown,
    errorCode?: string,
  ) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.details = details
    this.errorCode = errorCode ? normalizeErrorCode(errorCode) : undefined
  }
}

/**
 * GitHub API 相关错误
 */
export class GitHubError extends AppError {
  public githubErrorCode?: string
  public rateLimitRemaining?: number
  public rateLimitReset?: number

  constructor(
    message: string,
    code = 502,
    options?: {
      githubErrorCode?: string
      errorCode?: string
      rateLimitRemaining?: number
      rateLimitReset?: number
      details?: unknown
    },
  ) {
    const raw = options?.errorCode || options?.githubErrorCode
    super(message, code, options?.details, raw)
    this.name = 'GitHubError'
    this.githubErrorCode = this.errorCode || normalizeErrorCode(raw)
    this.rateLimitRemaining = options?.rateLimitRemaining
    this.rateLimitReset = options?.rateLimitReset
  }
}

/**
 * 仓库不存在错误
 */
export class RepositoryNotFoundError extends GitHubError {
  constructor(owner: string, repo: string) {
    super(`仓库 ${owner}/${repo} 不存在`, 404, {
      errorCode: ErrorCode.REPOSITORY_NOT_FOUND,
      githubErrorCode: ErrorCode.REPOSITORY_NOT_FOUND,
    })
    this.name = 'RepositoryNotFoundError'
  }
}

/**
 * GitHub Rate Limit 错误
 */
export class RateLimitError extends GitHubError {
  constructor(resetTime?: number) {
    const resetStr = resetTime
      ? `将于 ${new Date(resetTime * 1000).toLocaleString('zh-CN')} 重置`
      : ''
    super(`GitHub API 调用频率超限，${resetStr}`, 429, {
      errorCode: ErrorCode.GITHUB_RATE_LIMIT,
      githubErrorCode: ErrorCode.GITHUB_RATE_LIMIT,
      rateLimitReset: resetTime,
    })
    this.name = 'RateLimitError'
  }
}
