import { AsyncLocalStorage } from 'node:async_hooks'
import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'
import type { AIProviderConfig } from '../types'

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

const aiProviderConfigSchema = z.object({
  mode: z.enum(['platform', 'custom']),
  provider: z.enum(['deepseek', 'openai-compatible']),
  baseUrl: z
    .string()
    .url()
    .refine((value) => /^https:\/\//i.test(value), 'baseUrl 必须使用 HTTPS')
    .refine(isPublicProviderUrl, 'baseUrl 不允许指向本地或私有网络')
    .optional(),
  apiKey: z.string().min(1).max(1000).optional(),
  model: z.string().min(1).max(200),
}).superRefine((value, context) => {
  if (value.mode === 'custom' && (!value.baseUrl || !value.apiKey)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: '自定义 AI API 必须提供 baseUrl 和 apiKey',
    })
  }
})

/**
 * AI 自定义配置仅保留在当前异步请求链，不写入服务端存储或日志。
 */
export const aiRequestContext = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const rawConfig = req.body?.aiProviderConfig
  if (!rawConfig) {
    aiConfigStorage.run(undefined, next)
    return
  }

  const parsed = aiProviderConfigSchema.safeParse(rawConfig)
  if (!parsed.success) {
    next(parsed.error)
    return
  }

  aiConfigStorage.run(parsed.data, next)
}

export const getRequestAIConfig = (): AIProviderConfig | undefined =>
  aiConfigStorage.getStore()
