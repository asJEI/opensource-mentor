import { ApiResponse } from '../types'

/**
 * 成功响应
 */
export function success<T>(data: T, message = 'ok'): ApiResponse<T> {
  return {
    success: true,
    data,
    message,
    code: 0,
  }
}

/**
 * 失败响应
 */
export function error(message: string, code = 500): ApiResponse<null> {
  return {
    success: false,
    data: null,
    message,
    code,
  }
}

/**
 * 延迟工具函数（模拟耗时）
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
