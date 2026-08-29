/**
 * Shared application error codes for Worker + frontend.
 * Prefer matching on these codes over parsing error.message strings.
 */

export const ErrorCode = {
  // AI
  AI_PROVIDER_ERROR: 'AI_PROVIDER_ERROR',
  AI_AUTH_ERROR: 'AI_AUTH_ERROR',
  AI_RATE_LIMIT: 'AI_RATE_LIMIT',
  AI_TIMEOUT: 'AI_TIMEOUT',
  AI_NETWORK_ERROR: 'AI_NETWORK_ERROR',
  AI_NOT_CONFIGURED: 'AI_NOT_CONFIGURED',
  AI_INVALID_BASE_URL: 'AI_INVALID_BASE_URL',
  AI_INVALID_MODEL: 'AI_INVALID_MODEL',

  // GitHub
  GITHUB_AUTH_ERROR: 'GITHUB_AUTH_ERROR',
  GITHUB_RATE_LIMIT: 'GITHUB_RATE_LIMIT',
  GITHUB_FORBIDDEN: 'GITHUB_FORBIDDEN',
  GITHUB_NETWORK_ERROR: 'GITHUB_NETWORK_ERROR',
  REPOSITORY_NOT_FOUND: 'REPOSITORY_NOT_FOUND',
  NOT_FOUND: 'NOT_FOUND',

  // Generic
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  REVIEW_FAILED: 'REVIEW_FAILED',
} as const

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode]

/** User-facing copy keyed by error code (frontend / product layer). */
export const ERROR_CODE_MESSAGES: Record<ErrorCode, string> = {
  AI_PROVIDER_ERROR: 'AI 服务暂时不可用，请稍后重试',
  AI_AUTH_ERROR: 'AI API Key 无效或无权限',
  AI_RATE_LIMIT: 'AI 服务商触发限流。请稍等后重试，或改用自己的 API Key',
  AI_TIMEOUT: 'AI 请求超时，请稍后重试',
  AI_NETWORK_ERROR: '无法连接 AI 服务商，请稍后重试',
  AI_NOT_CONFIGURED: '平台 AI API 尚未配置',
  AI_INVALID_BASE_URL: 'AI Base URL 无效',
  AI_INVALID_MODEL: 'AI 模型不能为空',
  GITHUB_AUTH_ERROR: 'GitHub Token 无效或已过期',
  GITHUB_RATE_LIMIT: 'GitHub API 调用频率超限',
  GITHUB_FORBIDDEN: 'GitHub API 访问被拒绝',
  GITHUB_NETWORK_ERROR: '无法连接 GitHub',
  REPOSITORY_NOT_FOUND: '仓库不存在',
  NOT_FOUND: '资源不存在',
  VALIDATION_ERROR: '请求参数无效',
  INTERNAL_ERROR: '服务器内部错误',
  REVIEW_FAILED: '审查失败，请稍后重试',
}

/**
 * Map legacy githubErrorCode values to canonical ErrorCode.
 * Worker historically used REPO_NOT_FOUND / RATE_LIMITED / BAD_CREDENTIALS.
 */
export function normalizeErrorCode(raw: string | undefined | null): ErrorCode {
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
      if ((Object.values(ErrorCode) as string[]).includes(raw)) {
        return raw as ErrorCode
      }
      return ErrorCode.INTERNAL_ERROR
  }
}

export function messageForErrorCode(
  code: ErrorCode,
  fallback?: string,
): string {
  return fallback?.trim() || ERROR_CODE_MESSAGES[code]
}
