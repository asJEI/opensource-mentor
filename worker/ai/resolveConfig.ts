/**
 * Resolve runtime AI client from platform secrets and optional request BYOK.
 * Prefer Header transport (X-AI-Key); body.aiProviderConfig is a fallback without requiring apiKey in body.
 * Never log request headers/body — they may contain secrets.
 */

import {
  normalizeBaseUrl,
  normalizeProvider,
  type PlatformLlmProvider,
} from '../../shared/config'
import { BYOK_HEADERS } from '../../shared/byok'
import { ErrorCode } from '../../shared/errors'
import { resolvePlatformConfig, type PlatformEnv } from '../config'
import { ApiError } from '../http'
import { createAIClient, type AIClient } from './client'
import { PROVIDER_DEFAULT_BASE_URL } from './providers'

export interface RequestAIProviderConfig {
  mode: 'platform' | 'custom'
  provider: PlatformLlmProvider
  baseUrl?: string
  apiKey?: string
  model: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function headerValue(request: Request, name: string): string | undefined {
  const value = request.headers.get(name)?.trim()
  return value || undefined
}

function parseBodyAIConfig(
  raw: unknown,
): Partial<RequestAIProviderConfig> | undefined {
  if (raw === undefined || raw === null) return undefined
  if (!isRecord(raw)) {
    throw new ApiError('aiProviderConfig 格式无效', 400, {
      errorCode: ErrorCode.VALIDATION_ERROR,
    })
  }

  const mode = raw.mode === 'custom' ? 'custom' : 'platform'
  const provider = normalizeProvider(
    typeof raw.provider === 'string' ? raw.provider : undefined,
  )
  const model =
    typeof raw.model === 'string' && raw.model.trim()
      ? raw.model.trim()
      : undefined
  const baseUrl =
    typeof raw.baseUrl === 'string' && raw.baseUrl.trim()
      ? normalizeBaseUrl(raw.baseUrl, '')
      : undefined
  const apiKey =
    typeof raw.apiKey === 'string' && raw.apiKey.trim()
      ? raw.apiKey.trim()
      : undefined

  return { mode, provider, baseUrl, apiKey, model }
}

function parseHeaderAIConfig(
  request: Request,
): Partial<RequestAIProviderConfig> | undefined {
  const modeRaw = headerValue(request, BYOK_HEADERS.aiMode)
  const providerRaw = headerValue(request, BYOK_HEADERS.aiProvider)
  const model = headerValue(request, BYOK_HEADERS.aiModel)
  const baseUrlRaw = headerValue(request, BYOK_HEADERS.aiBaseUrl)
  const apiKey = headerValue(request, BYOK_HEADERS.aiKey)

  if (!modeRaw && !providerRaw && !model && !baseUrlRaw && !apiKey) {
    return undefined
  }

  return {
    mode: modeRaw === 'custom' ? 'custom' : 'platform',
    provider: normalizeProvider(providerRaw),
    model,
    baseUrl: baseUrlRaw ? normalizeBaseUrl(baseUrlRaw, '') : undefined,
    apiKey,
  }
}

function mergeAIConfig(
  headerConfig: Partial<RequestAIProviderConfig> | undefined,
  bodyConfig: Partial<RequestAIProviderConfig> | undefined,
): RequestAIProviderConfig | undefined {
  if (!headerConfig && !bodyConfig) return undefined

  const mode =
    headerConfig?.mode === 'custom' || bodyConfig?.mode === 'custom'
      ? 'custom'
      : 'platform'
  const provider = normalizeProvider(
    headerConfig?.provider || bodyConfig?.provider,
  )
  const model = (headerConfig?.model || bodyConfig?.model || '').trim()
  const apiKey =
    (headerConfig?.apiKey || bodyConfig?.apiKey || '').trim() || undefined
  const baseUrl =
    (headerConfig?.baseUrl || bodyConfig?.baseUrl || '').trim() || undefined

  if (mode === 'custom' && !model) {
    throw new ApiError('AI 模型不能为空', 400, {
      errorCode: ErrorCode.VALIDATION_ERROR,
    })
  }

  if (mode === 'custom' && !apiKey) {
    throw new ApiError(
      '自定义 AI API 必须提供 apiKey（请通过 X-AI-Key 发送）',
      400,
      {
        errorCode: ErrorCode.VALIDATION_ERROR,
      },
    )
  }

  const resolvedBaseUrl =
    baseUrl ||
    (mode === 'custom'
      ? PROVIDER_DEFAULT_BASE_URL[provider] || undefined
      : undefined)

  if (
    mode === 'custom' &&
    provider === 'openai-compatible' &&
    !resolvedBaseUrl
  ) {
    throw new ApiError('OpenAI Compatible 必须提供 baseUrl', 400, {
      errorCode: ErrorCode.VALIDATION_ERROR,
    })
  }

  return {
    mode,
    provider,
    model,
    baseUrl: resolvedBaseUrl,
    apiKey,
  }
}

/**
 * Resolve AI client for this request only. User keys are never written to env/KV/D1/logs.
 */
export async function resolveAIClient(
  env: PlatformEnv,
  request: Request,
  body: unknown,
): Promise<{ client: AIClient; isCustom: boolean }> {
  const platform = resolvePlatformConfig(env)
  const bodyConfig = isRecord(body)
    ? parseBodyAIConfig(body.aiProviderConfig)
    : undefined
  const headerConfig = parseHeaderAIConfig(request)
  const requestConfig = mergeAIConfig(headerConfig, bodyConfig)

  if (requestConfig?.mode === 'custom') {
    return {
      isCustom: true,
      client: createAIClient({
        provider: requestConfig.provider,
        apiKey: requestConfig.apiKey!,
        baseUrl: requestConfig.baseUrl,
        model: requestConfig.model,
        timeoutMs: platform.llmTimeoutMs,
      }),
    }
  }

  const clientAddress =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'local'
  const rateLimit = await env.PLATFORM_AI_RATE_LIMITER.limit({
    key: `platform:${clientAddress}`,
  })
  if (!rateLimit.success) {
    throw new ApiError(
      '平台 AI 每分钟额度已用完。请稍等约 1 分钟再试，或在设置里改用自己的 API Key（BYOK 不受平台限流）。',
      429,
      {
        errorCode: ErrorCode.AI_RATE_LIMIT,
      },
    )
  }

  if (!platform.platformLlmApiKey) {
    throw new ApiError(
      '平台 AI API 尚未配置。请设置 PLATFORM_LLM_API_KEY，或在请求中提供自定义 AI 配置。',
      503,
      { errorCode: ErrorCode.AI_NOT_CONFIGURED },
    )
  }

  return {
    isCustom: false,
    client: createAIClient({
      provider: platform.defaultLlmProvider,
      apiKey: platform.platformLlmApiKey,
      baseUrl: platform.defaultLlmBaseUrl,
      model: platform.defaultLlmModel,
      timeoutMs: platform.llmTimeoutMs,
    }),
  }
}
