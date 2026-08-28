import axios from 'axios'
import type {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios'
import { BYOK_HEADERS } from '@shared/byok'
import { useSettingsStore } from '@/store/settings'
import { ApiClientError, getErrorMessage } from './errors'

/**
 * 统一响应格式（与后端对齐）
 */
export interface ApiResponse<T = unknown> {
  success: boolean
  data: T
  message?: string
  code?: number
  errorCode?: string
  /** @deprecated prefer errorCode */
  githubErrorCode?: string
  rateLimitReset?: number
}

const bffService: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
})

/**
 * Attach BYOK credentials via headers only (never URL query).
 * AI apiKey goes in X-AI-Key; GitHub token in X-User-GitHub-Token.
 */
bffService.interceptors.request.use(
  (requestConfig: InternalAxiosRequestConfig) => {
    const { githubConfig, aiConfig } = useSettingsStore.getState()

    if (
      githubConfig.mode === 'custom' &&
      githubConfig.token &&
      !requestConfig.headers[BYOK_HEADERS.githubToken]
    ) {
      requestConfig.headers[BYOK_HEADERS.githubToken] = githubConfig.token
    }

    if (aiConfig.mode === 'custom') {
      requestConfig.headers[BYOK_HEADERS.aiMode] = 'custom'
      requestConfig.headers[BYOK_HEADERS.aiProvider] = aiConfig.provider
      if (aiConfig.model) {
        requestConfig.headers[BYOK_HEADERS.aiModel] = aiConfig.model
      }
      if (aiConfig.baseUrl) {
        requestConfig.headers[BYOK_HEADERS.aiBaseUrl] = aiConfig.baseUrl
      }
      if (aiConfig.apiKey && !requestConfig.headers[BYOK_HEADERS.aiKey]) {
        requestConfig.headers[BYOK_HEADERS.aiKey] = aiConfig.apiKey
      }
    }

    return requestConfig
  },
)

bffService.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    const payload = response.data
    if (payload && payload.success) {
      return payload.data as any
    }
    const errorCode = payload?.errorCode || payload?.githubErrorCode
    return Promise.reject(
      new ApiClientError(payload?.message || '请求失败', {
        errorCode,
        status: response.status,
        rateLimitReset: payload?.rateLimitReset,
      }),
    )
  },
  (error) => {
    const status = error.response?.status as number | undefined
    const data = error.response?.data as ApiResponse | undefined
    const errorCode = data?.errorCode || data?.githubErrorCode
    const message = data?.message || error.message || '请求失败'

    // Never log request config / Authorization / API keys — message only.
    if (status) {
      console.error(`[${status}] ${errorCode || 'ERROR'}:`, message)
    } else {
      console.error('[Network Error]', message)
    }

    return Promise.reject(
      new ApiClientError(message, {
        errorCode,
        status,
        rateLimitReset: data?.rateLimitReset,
      }),
    )
  },
)

/** BFF GET — optional AbortSignal via config.signal */
export function bffGet<T = unknown>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<T> {
  return bffService.get<T, T>(url, config)
}

/** BFF POST — optional AbortSignal via config.signal */
export function bffPost<T = unknown>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  return bffService.post<T, T>(url, data, config)
}

export function bffPatch<T = unknown>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  return bffService.patch<T, T>(url, data, config)
}

export function mockDelay(minMs = 500, maxMs = 1500): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs
  return new Promise((resolve) => setTimeout(resolve, delay))
}

export { ApiClientError, getErrorMessage }
export default bffService
