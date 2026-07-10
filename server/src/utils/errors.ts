/**
 * 业务错误基类
 * 支持自定义错误码，方便全局错误中间件识别
 */
export class AppError extends Error {
  public code: number
  public details?: unknown

  constructor(message: string, code = 500, details?: unknown) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.details = details
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
      rateLimitRemaining?: number
      rateLimitReset?: number
      details?: unknown
    },
  ) {
    super(message, code, options?.details)
    this.name = 'GitHubError'
    this.githubErrorCode = options?.githubErrorCode
    this.rateLimitRemaining = options?.rateLimitRemaining
    this.rateLimitReset = options?.rateLimitReset
  }
}

/**
 * 仓库不存在错误
 */
export class RepositoryNotFoundError extends GitHubError {
  constructor(owner: string, repo: string) {
    super(`仓库 ${owner}/${repo} 不存在`, 404, { githubErrorCode: 'REPO_NOT_FOUND' })
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
      githubErrorCode: 'RATE_LIMITED',
      rateLimitReset: resetTime,
    })
    this.name = 'RateLimitError'
  }
}
