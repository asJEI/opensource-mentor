/**
 * Unified OpenAI-compatible chat client for all providers.
 * Provider-specific URL defaults live in providers.ts.
 * Never log apiKey or request bodies that include credentials.
 */

import { redactSecrets } from '../../shared/byok'
import { ErrorCode } from '../../shared/errors'
import { ApiError } from '../http'
import {
  resolveChatCompletionsUrl,
  resolveProviderBaseUrl,
  type AIConfig,
  type AIProvider,
} from './providers'

export type { AIConfig, AIProvider }
export type AIClientConfig = AIConfig

export interface AIClient {
  readonly provider: AIProvider
  readonly model: string
  readonly baseUrl: string
  chatCompletions: (params: {
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
    temperature?: number
    topP?: number
    timeoutMs?: number
    responseFormat?: { type: 'json_object' | 'text' }
  }) => Promise<string>
}

function isTimeoutError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const name = 'name' in error ? String(error.name) : ''
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase()
  return (
    name === 'TimeoutError' ||
    name === 'AbortError' ||
    message.includes('aborted due to timeout') ||
    message.includes('timed out')
  )
}

export function createAIClient(config: AIConfig): AIClient {
  const apiKey = config.apiKey.trim()
  if (!apiKey) {
    throw new ApiError('AI API Key 未配置', 503, {
      errorCode: ErrorCode.AI_NOT_CONFIGURED,
    })
  }

  const model = config.model.trim()
  if (!model) {
    throw new ApiError('AI 模型不能为空', 400, {
      errorCode: ErrorCode.AI_INVALID_MODEL,
    })
  }

  const baseUrl = resolveProviderBaseUrl(config)
  const timeoutMs = config.timeoutMs ?? 60_000
  const completionsUrl = resolveChatCompletionsUrl(baseUrl)

  return {
    provider: config.provider,
    model,
    baseUrl,
    async chatCompletions(params) {
      try {
        const response = await fetch(completionsUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: params.messages,
            temperature: params.temperature ?? 0.7,
            top_p: params.topP ?? 0.9,
            ...(params.responseFormat
              ? { response_format: params.responseFormat }
              : {}),
          }),
          signal: AbortSignal.timeout(params.timeoutMs ?? timeoutMs),
        })

        if (!response.ok) {
          let upstreamMessage = `AI 服务请求失败 (${response.status})`
          try {
            const body = (await response.json()) as {
              error?: { message?: string }
              message?: string
            }
            const raw = body.error?.message || body.message || upstreamMessage
            upstreamMessage = redactSecrets(String(raw))
          } catch {
            // ignore non-JSON error bodies
          }

          if (response.status === 401 || response.status === 403) {
            throw new ApiError('AI API Key 无效或无权限', 401, {
              errorCode: ErrorCode.AI_AUTH_ERROR,
            })
          }
          if (response.status === 429) {
            throw new ApiError('AI 服务触发限流，请稍后重试', 429, {
              errorCode: ErrorCode.AI_RATE_LIMIT,
            })
          }
          throw new ApiError(
            upstreamMessage,
            response.status >= 400 ? response.status : 502,
            { errorCode: ErrorCode.AI_PROVIDER_ERROR },
          )
        }

        const data = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>
        }
        return data.choices?.[0]?.message?.content || '{}'
      } catch (error) {
        if (error instanceof ApiError) throw error
        if (isTimeoutError(error)) {
          throw new ApiError('AI 请求超时，请稍后重试', 504, {
            errorCode: ErrorCode.AI_TIMEOUT,
          })
        }
        throw new ApiError('无法连接 AI 服务商，请稍后重试', 502, {
          errorCode: ErrorCode.AI_NETWORK_ERROR,
        })
      }
    },
  }
}
