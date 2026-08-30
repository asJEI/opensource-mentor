import { AsyncLocalStorage } from 'node:async_hooks'
import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'
import type { AIProviderConfig } from '../types'
import { AppError } from '../utils/errors'

/** Keep in sync with shared/byok.ts — duplicated to avoid Express rootDir coupling. */
const BYOK_HEADERS = {
  aiMode: 'X-AI-Mode',
  aiProvider: 'X-AI-Provider',
  aiModel: 'X-AI-Model',
  aiBaseUrl: 'X-AI-Base-Url',
  aiKey: 'X-AI-Key',
} as const

const aiConfigStorage = new AsyncLocalStorage<AIProviderConfig | undefined>()

function isPublicProviderUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname.toLowerCase()
    return !(
      hostname === 'localhost' ||
      hostname.endsWith('.local') ||
      hostname === '::1' ||
      /^127\./.test(hostname) ||
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^169\.254\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
      /^(fc|fd|fe8|fe9|fea|feb)/.test(hostname)
    )
  } catch {
    return false
  }
}

const aiProviderConfigSchema = z
  .object({
    mode: z.enum(['platform', 'custom']),
    provider: z.enum(['deepseek', 'openai', 'orcarouter', 'openai-compatible']),
    baseUrl: z
      .string()
      .url()
      .refine((value) => /^https:\/\//i.test(value), 'baseUrl 必须使用 HTTPS')
      .refine(isPublicProviderUrl, 'baseUrl 不允许指向本地或私有网络')
      .optional(),
    apiKey: z.string().min(1).max(1000).optional(),
    model: z.string().min(1).max(200),
  })
  .superRefine((value, context) => {
    if (value.mode !== 'custom') return
    if (!value.apiKey) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: '自定义 AI API 必须提供 apiKey（请通过 X-AI-Key 发送）',
      })
    }
    if (value.provider === 'openai-compatible' && !value.baseUrl) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'OpenAI Compatible 必须提供 baseUrl',
      })
    }
  })

function header(req: Request, name: string): string | undefined {
  const value = req.header(name)?.trim()
  return value || undefined
}

function buildConfigFromRequest(req: Request): unknown | undefined {
  const bodyConfig = req.body?.aiProviderConfig as
    | Record<string, unknown>
    | undefined

  const headerMode = header(req, BYOK_HEADERS.aiMode)
  const headerProvider = header(req, BYOK_HEADERS.aiProvider)
  const headerModel = header(req, BYOK_HEADERS.aiModel)
  const headerBaseUrl = header(req, BYOK_HEADERS.aiBaseUrl)
  const headerKey = header(req, BYOK_HEADERS.aiKey)

  const hasHeaders =
    headerMode || headerProvider || headerModel || headerBaseUrl || headerKey
  if (!bodyConfig && !hasHeaders) return undefined

  const mode =
    headerMode === 'custom' || bodyConfig?.mode === 'custom'
      ? 'custom'
      : 'platform'

  return {
    mode,
    provider:
      headerProvider ||
      (typeof bodyConfig?.provider === 'string'
        ? bodyConfig.provider
        : 'deepseek'),
    model: headerModel || bodyConfig?.model,
    baseUrl: headerBaseUrl || bodyConfig?.baseUrl,
    // Prefer header key; never require body.apiKey when header is set.
    apiKey: headerKey || bodyConfig?.apiKey,
  }
}

/**
 * AI 自定义配置仅保留在当前异步请求链，不写入服务端存储或日志。
 * Prefer X-AI-* headers for secrets; body may carry non-secret fields.
 */
export const aiRequestContext = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const rawConfig = buildConfigFromRequest(req)
  if (!rawConfig) {
    aiConfigStorage.run(undefined, next)
    return
  }

  const parsed = aiProviderConfigSchema.safeParse(rawConfig)
  if (!parsed.success) {
    next(parsed.error)
    return
  }

  // Default base URLs for known providers when custom mode omits baseUrl.
  const data = { ...parsed.data }
  if (data.mode === 'custom' && !data.baseUrl) {
    if (data.provider === 'deepseek') {
      data.baseUrl = 'https://api.deepseek.com'
    } else if (data.provider === 'openai') {
      data.baseUrl = 'https://api.openai.com/v1'
    } else if (data.provider === 'orcarouter') {
      data.baseUrl = 'https://api.orcarouter.ai/v1'
    }
  }

  if (
    data.mode === 'custom' &&
    data.provider === 'openai-compatible' &&
    !data.baseUrl
  ) {
    next(new AppError('OpenAI Compatible 必须提供 baseUrl', 400))
    return
  }

  aiConfigStorage.run(data, next)
}

export const getRequestAIConfig = (): AIProviderConfig | undefined =>
  aiConfigStorage.getStore()
