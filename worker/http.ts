import { ErrorCode, normalizeErrorCode } from '../shared/errors'
import { redactSecrets } from '../shared/byok'

export class ApiError extends Error {
  readonly status: number
  /** HTTP-ish numeric code kept for legacy clients (same as status). */
  readonly code: number
  /** Canonical machine-readable error code. */
  readonly errorCode: ErrorCode
  /**
   * @deprecated Prefer errorCode. Kept for API response compatibility.
   */
  readonly githubErrorCode: string
  readonly rateLimitReset?: number

  constructor(
    message: string,
    status = 500,
    options?: {
      errorCode?: ErrorCode | string
      /** @deprecated use errorCode */
      githubErrorCode?: string
      rateLimitReset?: number
    },
  ) {
    super(redactSecrets(message))
    this.name = 'ApiError'
    this.status = status
    this.code = status
    const raw = options?.errorCode || options?.githubErrorCode
    this.errorCode = normalizeErrorCode(raw)
    this.githubErrorCode = this.errorCode
    this.rateLimitReset = options?.rateLimitReset
  }
}

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
} as const

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS })
}

export function success<T>(data: T, message = 'ok'): Response {
  return json({
    success: true,
    data,
    message,
    code: 0,
  })
}

export function failure(
  message: string,
  status = 500,
  extra?: Record<string, unknown>,
): Response {
  return json(
    {
      success: false,
      data: null,
      message: redactSecrets(message),
      code: status,
      ...extra,
    },
    status,
  )
}

export function toErrorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    const extra: Record<string, unknown> = {
      errorCode: error.errorCode,
      githubErrorCode: error.githubErrorCode,
    }
    if (error.rateLimitReset !== undefined) {
      extra.rateLimitReset = error.rateLimitReset
    }
    return failure(error.message, error.status, extra)
  }

  const rawMessage =
    error instanceof Error ? error.message : '服务器内部错误'
  return failure(redactSecrets(rawMessage), 500, {
    errorCode: ErrorCode.INTERNAL_ERROR,
    githubErrorCode: ErrorCode.INTERNAL_ERROR,
  })
}
