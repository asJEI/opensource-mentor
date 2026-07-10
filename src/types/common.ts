/**
 * 通用类型定义
 */

/** Toast 消息类型 */
export type ToastType = 'success' | 'error' | 'info' | 'warning'

/** 加载状态 */
export type LoadingState = 'idle' | 'loading' | 'success' | 'error'

/** Toast 消息 */
export interface ToastMessage {
  /** 消息 ID */
  id: string
  /** 消息类型 */
  type: ToastType
  /** 消息标题 */
  title: string
  /** 消息内容 */
  message: string
  /** 持续时间（毫秒） */
  duration: number
}

/**
 * 通用 API 响应包装
 * @template T 响应数据类型
 */
export interface ApiResponse<T> {
  /** 响应数据 */
  data: T
  /** 错误信息（如果有） */
  error?: string
  /** HTTP 状态码 */
  status: number
}

/** 分页参数 */
export interface PaginationParams {
  /** 当前页码（从 1 开始） */
  page: number
  /** 每页条数 */
  perPage: number
  /** 总条数 */
  total: number
}
