import axios from 'axios'
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios'

/**
 * 统一响应格式（与后端对齐）
 */
export interface ApiResponse<T = unknown> {
  success: boolean
  data: T
  message?: string
  code?: number
}

// ============================================================
// BFF API 实例（主要使用，调用后端 /api）
// ============================================================

const bffService: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
})

bffService.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    // 直接返回 data 字段（后端统一格式 { success, data, message, code }）
    const payload = response.data
    if (payload && payload.success) {
      return payload.data as any
    }
    return Promise.reject(new Error(payload?.message || '请求失败'))
  },
  (error) => {
    const status = error.response?.status
    const message =
      error.response?.data?.message || error.message || '请求失败'

    switch (status) {
      case 400:
        console.error('[400] 参数错误:', message)
        break
      case 401:
        console.error('[401] 未授权')
        break
      case 403:
        console.error('[403] 被拒绝:', message)
        break
      case 404:
        console.error('[404] 资源不存在:', message)
        break
      case 429:
        console.error('[429] 频率限制:', message)
        break
      case 500:
      case 502:
      case 503:
        console.error(`[${status}] 服务器错误:`, message)
        break
      default:
        if (status) {
          console.error(`[${status}] ${message}`)
        } else {
          console.error('[Network Error]', message)
        }
    }

    return Promise.reject(new Error(message))
  },
)

/** BFF GET */
export function bffGet<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> {
  return bffService.get<T, T>(url, config)
}

/** BFF POST */
export function bffPost<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
  return bffService.post<T, T>(url, data, config)
}

// ============================================================
// GitHub API 实例（保留，供直接调用 GitHub 用）
// ============================================================

const githubService: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_GITHUB_API_BASE_URL || 'https://api.github.com',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/vnd.github.v3+json',
  },
})

githubService.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = import.meta.env.VITE_GITHUB_TOKEN
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    console.error('[GitHub Request Error]', error)
    return Promise.reject(error)
  },
)

githubService.interceptors.response.use(
  (response: AxiosResponse) => response.data,
  (error) => {
    const status = error.response?.status
    const message = error.response?.data?.message || error.message || 'GitHub 请求失败'
    console.error(`[GitHub ${status || 'Error'}] ${message}`)
    return Promise.reject(new Error(message))
  },
)

/** GitHub GET */
export function githubGet<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> {
  return githubService.get<T, T>(url, config)
}

// ============================================================
// 工具函数
// ============================================================

/**
 * 模拟异步延迟（开发调试用）
 */
export function mockDelay(minMs = 500, maxMs = 1500): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs
  return new Promise((resolve) => setTimeout(resolve, delay))
}

// 导出默认实例（兼容旧代码）
export default bffService
