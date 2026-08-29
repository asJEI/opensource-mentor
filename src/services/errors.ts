import {
  ErrorCode,
  messageForErrorCode,
  normalizeErrorCode,
  type ErrorCode as AppErrorCode,
} from '@shared/errors'

export { ErrorCode, messageForErrorCode, normalizeErrorCode }
export type { AppErrorCode }

/**
 * Client-side API error that preserves machine-readable errorCode.
 * Prefer matching on errorCode instead of message.includes(...).
 */
export class ApiClientError extends Error {
  readonly errorCode: AppErrorCode
  readonly status?: number
  readonly rateLimitReset?: number

  constructor(
    message: string,
    options?: {
      errorCode?: string | null
      status?: number
      rateLimitReset?: number
    },
  ) {
    const code = normalizeErrorCode(options?.errorCode)
    super(message.trim() || messageForErrorCode(code))
    this.name = 'ApiClientError'
    this.errorCode = code
    this.status = options?.status
    this.rateLimitReset = options?.rateLimitReset
  }
}

export function isApiClientError(error: unknown): error is ApiClientError {
  return error instanceof ApiClientError
}

/**
 * User-facing connection / AI errors — never expose Axios stacks.
 */
export function getConnectionErrorMessage(
  error: unknown,
  fallback = '连接失败，请检查配置后重试',
): string {
  if (!isApiClientError(error) && !(error instanceof Error)) {
    return fallback
  }

  const message = error instanceof Error ? error.message.trim() : ''
  const lower = message.toLowerCase()

  if (error instanceof ApiClientError) {
    switch (error.errorCode) {
      case ErrorCode.AI_AUTH_ERROR:
        return 'API Key 无效'
      case ErrorCode.GITHUB_AUTH_ERROR:
        return 'GitHub Token 无效或已过期'
      case ErrorCode.AI_TIMEOUT:
        return 'API 请求超时'
      case ErrorCode.AI_NETWORK_ERROR:
      case ErrorCode.GITHUB_NETWORK_ERROR:
        return '无法连接服务商'
      case ErrorCode.AI_INVALID_BASE_URL:
        return 'Base URL 无法访问'
      case ErrorCode.AI_RATE_LIMIT:
        if (/平台|BYOK|自己的 API Key/i.test(message)) return message
        return (
          message ||
          'AI 服务商触发限流。请稍等 30～60 秒后重试；贡献指南可只重试失败章节。'
        )
      case ErrorCode.GITHUB_RATE_LIMIT:
        return message.includes('重置')
          ? message
          : 'GitHub API 调用频率超限，建议配置 Token'
      case ErrorCode.AI_NOT_CONFIGURED:
        return '尚未配置可用的 AI API'
      case ErrorCode.VALIDATION_ERROR:
        return message || '配置不完整'
      default:
        break
    }
  }

  if (/model[_ ]?not[_ ]?found|does not exist|unknown model/i.test(lower)) {
    return '模型不存在'
  }
  if (/invalid.?api.?key|incorrect.?api.?key|unauthorized|401/i.test(lower)) {
    return 'API Key 无效'
  }
  if (/timeout|timed out|aborted due to timeout/i.test(lower)) {
    return 'API 请求超时'
  }
  if (/enotfound|econnrefused|network|fetch failed|unreachable/i.test(lower)) {
    return '无法连接服务商'
  }
  if (/base.?url|invalid url|ssl|certificate/i.test(lower)) {
    return 'Base URL 无法访问'
  }

  if (!message) return fallback
  if (/at\s+\S+\s+\(|AxiosError|stack/i.test(message)) {
    return fallback
  }
  return message.length > 160 ? `${message.slice(0, 160)}…` : message
}

/** Resolve a display message from any thrown value. */
export function getErrorMessage(error: unknown, fallback = '请求失败'): string {
  if (isApiClientError(error) || error instanceof Error) {
    return getConnectionErrorMessage(error, fallback)
  }
  return fallback
}
