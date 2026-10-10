import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { error } from '../utils/response'
import { AppError, GitHubError } from '../utils/errors'
import { localizedErrorMessage } from '../../../shared/errors'
import { requestLocale } from '../../../shared/locale'

/**
 * 全局异常处理中间件
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
) {
  console.error(`[Error] ${req.method} ${req.path}:`, err.message)

  // 业务错误（AppError / GitHubError 等）
  if (err instanceof AppError) {
    const responseData: Record<string, unknown> = {
      success: false,
      data: null,
      message: localizedErrorMessage(err.message, err.errorCode, requestLocale(req.header('Accept-Language'))),
      code: err.code,
    }

    if (err.errorCode) {
      responseData.errorCode = err.errorCode
    }

    // GitHub 错误附加详细信息
    if (err instanceof GitHubError) {
      responseData.errorCode = err.errorCode || err.githubErrorCode
      responseData.githubErrorCode = err.githubErrorCode || err.errorCode
      if (err.rateLimitReset !== undefined) {
        responseData.rateLimitReset = err.rateLimitReset
      }
    }

    res.status(err.code).json(responseData)
    return
  }

  // Zod 参数校验错误
  if (err instanceof ZodError) {
    const messages = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')
    res.status(400).json(error(requestLocale(req.header('Accept-Language')) === 'en-US'
      ? `Invalid request parameters: ${err.errors.map((e) => e.path.join('.')).join(', ')}`
      : `参数校验失败: ${messages}`, 400))
    return
  }

  // Axios 错误（兜底，理论上应该在 Service 层被转换为 GitHubError）
  const axiosErr = err as any
  if (axiosErr.isAxiosError) {
    const status = axiosErr.response?.status || 502
    const message =
      axiosErr.response?.data?.message ||
      axiosErr.response?.statusText ||
      '第三方 API 调用失败'
    res.status(status).json(error(requestLocale(req.header('Accept-Language')) === 'en-US' ? `Upstream service error: ${message}` : `上游服务错误: ${message}`, status))
    return
  }

  // 其他未知错误
  res.status(500).json(error(localizedErrorMessage(err.message || '服务器内部错误', undefined, requestLocale(req.header('Accept-Language'))), 500))
}

/**
 * 404 处理中间件
 */
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json(error(requestLocale(req.header('Accept-Language')) === 'en-US'
    ? `Endpoint not found: ${req.method} ${req.path}` : `接口不存在: ${req.method} ${req.path}`, 404))
}
